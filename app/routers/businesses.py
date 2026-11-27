import hashlib
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import case, or_, select
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.database import get_db
from app.deps import get_current_active_user, get_optional_user
from app.email import send_business_invitation_email
from app.models import (
    Business,
    BusinessInvitation,
    BusinessInvitationStatus,
    BusinessStatus,
    BusinessTeamMember,
    BusinessTeamRole,
    BusinessVerification,
    BusinessVerificationMethod,
    BusinessVerificationStatus,
    Category,
    City,
    User,
    UserRole,
    utcnow,
)
from app.permissions import (
    business_access_role,
    can_change_parent,
    can_edit_business_fields,
    can_manage_team,
)
from app.queries import business_query, paginate_businesses, serialize_business
from app.roles import has_any_role, has_role
from app.schemas import (
    BusinessBrief,
    BusinessCreate,
    BusinessInvitationCreate,
    BusinessInvitationOut,
    BusinessList,
    BusinessOut,
    BusinessTeamMemberOut,
    BusinessUpdate,
    BusinessVerificationOut,
    BusinessVerificationSubmit,
)
from app.utils import unique_slug, validate_business_parent

router = APIRouter(prefix="/businesses", tags=["Businesses"])

INVITE_EXPIRE_HOURS = 24 * 7
ROLE_LABELS = {
    BusinessTeamRole.corporate_admin: "corporate admin",
    BusinessTeamRole.branch_manager: "branch manager",
    BusinessTeamRole.staff: "branch staff",
}


def _brief(business: Business) -> BusinessBrief:
    return BusinessBrief(
        id=business.id,
        name=business.name,
        slug=business.slug,
    )


def _validate_relations(
    db: Session,
    category_id: int | None = None,
    city_id: int | None = None,
) -> None:
    if category_id is not None and db.get(Category, category_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid category_id")
    if city_id is not None and db.get(City, city_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid city_id")


def _load_business(db: Session, business_id: int) -> BusinessOut:
    row = db.execute(business_query().where(Business.id == business_id)).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    return serialize_business(row[0], row[1], row[2])


def _context_business(
    db: Session,
    user: User | None,
    business: Business,
    average_rating: float | None = None,
    review_count: int | None = None,
) -> BusinessOut:
    lineage: list[BusinessBrief] = []
    current: Business | None = business
    seen: set[int] = set()
    while current is not None and current.id not in seen:
        seen.add(current.id)
        lineage.append(_brief(current))
        current = db.get(Business, current.parent_id) if current.parent_id else None
    lineage.reverse()
    branches = db.scalars(
        select(Business)
        .where(Business.parent_id == business.id, Business.status == BusinessStatus.approved)
        .order_by(Business.name.asc(), Business.id.asc())
        .limit(50)
    ).all()
    role = business_access_role(db, user, business) if user is not None else None
    return serialize_business(
        business,
        average_rating,
        review_count,
        lineage=lineage,
        branches=[_brief(branch) for branch in branches],
        my_role=role,
    )


def _can_view(db: Session, business: Business, user: User | None) -> bool:
    if business.status == BusinessStatus.approved:
        return True
    if user is None:
        return False
    if has_any_role(user, (UserRole.admin, UserRole.supervisor)):
        return True
    return business_access_role(db, user, business) is not None


def _domain_from_url(value: str | None) -> str | None:
    if not value:
        return None
    candidate = value.strip().lower()
    candidate = candidate.split("://", 1)[-1].split("/", 1)[0].split("?", 1)[0]
    candidate = candidate.split("@")[-1].split(":", 1)[0]
    if candidate.startswith("www."):
        candidate = candidate[4:]
    return candidate or None


def _team_manager_business(db: Session, user: User, business_id: int) -> Business:
    business = db.get(Business, business_id)
    if business is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    if not can_manage_team(db, user, business):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only brand owners and corporate admins can manage teams",
        )
    return business


@router.get("", response_model=BusinessList)
def list_businesses(
    city_id: int | None = Query(default=None),
    category_id: int | None = Query(default=None),
    brand_id: int | None = Query(default=None),
    search: str | None = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    filters = [Business.status == BusinessStatus.approved]
    if city_id is not None:
        filters.append(Business.city_id == city_id)
    if category_id is not None:
        category_ids = [category_id]
        category_ids.extend(
            db.scalars(select(Category.id).where(Category.parent_id == category_id)).all()
        )
        filters.append(Business.category_id.in_(category_ids))
    if brand_id is not None:
        filters.append(Business.parent_id == brand_id)
    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(
            or_(
                Business.name.ilike(term),
                Business.description.ilike(term),
                Business.address.ilike(term),
            )
        )

    featured_rank = case(
        (
            Business.featured_until.is_not(None)
            & (Business.featured_until > utcnow()),
            0,
        ),
        else_=1,
    )
    stmt = (
        business_query()
        .where(*filters)
        .order_by(featured_rank, Business.name.asc())
    )
    return paginate_businesses(db, stmt, filters, page, page_size)


@router.get("/mine", response_model=list[BusinessOut])
def my_businesses(
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    direct_memberships = select(BusinessTeamMember.business_id).where(
        BusinessTeamMember.user_id == user.id
    )
    corporate_memberships = select(BusinessTeamMember.business_id).where(
        BusinessTeamMember.user_id == user.id,
        BusinessTeamMember.role == BusinessTeamRole.corporate_admin,
    )
    rows = (
        db.execute(
            business_query()
            .where(
                or_(
                    Business.owner_id == user.id,
                    Business.id.in_(direct_memberships),
                    Business.parent_id.in_(corporate_memberships),
                )
            )
            .order_by(Business.created_at.desc())
        )
        .unique()
        .all()
    )
    return [
        _context_business(db, user, business, avg, count)
        for business, avg, count in rows
    ]


@router.get("/brand-options", response_model=list[BusinessBrief])
def brand_options(
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    brands = db.scalars(
        select(Business)
        .where(
            Business.parent_id.is_(None),
            Business.status == BusinessStatus.approved,
        )
        .order_by(Business.name.asc())
        .limit(300)
    ).all()
    return [_brief(brand) for brand in brands if can_manage_team(db, user, brand)]


@router.get("/slug/{slug}", response_model=BusinessOut)
def get_business_by_slug(
    slug: str,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    row = db.execute(business_query().where(Business.slug == slug)).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    if not _can_view(db, row[0], user):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    return _context_business(db, user, row[0], row[1], row[2])


@router.get("/{business_id}/branches", response_model=list[BusinessBrief])
def business_branches(
    business_id: int,
    db: Session = Depends(get_db),
):
    business = db.get(Business, business_id)
    if business is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    branches = db.scalars(
        select(Business)
        .where(Business.parent_id == business_id, Business.status == BusinessStatus.approved)
        .order_by(Business.name.asc(), Business.id.asc())
    ).all()
    return [_brief(branch) for branch in branches]


@router.get("/{business_id}/team", response_model=list[BusinessTeamMemberOut])
def business_team(
    business_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    _team_manager_business(db, user, business_id)
    members = db.scalars(
        select(BusinessTeamMember)
        .options(joinedload(BusinessTeamMember.user))
        .where(BusinessTeamMember.business_id == business_id)
        .order_by(BusinessTeamMember.created_at.asc())
    ).unique().all()
    return members


@router.get("/{business_id}/invitations", response_model=list[BusinessInvitationOut])
def business_invitations(
    business_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    business = _team_manager_business(db, user, business_id)
    invitations = db.scalars(
        select(BusinessInvitation)
        .where(BusinessInvitation.business_id == business_id)
        .order_by(BusinessInvitation.created_at.desc())
    ).all()
    return [
        BusinessInvitationOut.model_validate(invitation).model_copy(
            update={"business": _brief(business)}
        )
        for invitation in invitations
    ]


@router.post(
    "/{business_id}/invitations",
    response_model=BusinessInvitationOut,
    status_code=status.HTTP_201_CREATED,
)
def create_business_invitation(
    business_id: int,
    payload: BusinessInvitationCreate,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    business = _team_manager_business(db, user, business_id)
    email = str(payload.email).lower().strip()
    existing_member = db.scalar(
        select(BusinessTeamMember.id)
        .join(User, User.id == BusinessTeamMember.user_id)
        .where(BusinessTeamMember.business_id == business_id, User.email == email)
    )
    if existing_member is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This user is already on the team",
        )
    pending = db.scalar(
        select(BusinessInvitation.id).where(
            BusinessInvitation.business_id == business_id,
            BusinessInvitation.email == email,
            BusinessInvitation.status == BusinessInvitationStatus.pending,
            BusinessInvitation.expires_at > utcnow(),
        )
    )
    if pending is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pending invitation already exists for this email",
        )

    token = secrets.token_urlsafe(32)
    invitation = BusinessInvitation(
        business_id=business_id,
        email=email,
        role=payload.role,
        token_hash=hashlib.sha256(token.encode("utf-8")).hexdigest(),
        status=BusinessInvitationStatus.pending,
        message=payload.message,
        expires_at=utcnow() + timedelta(hours=INVITE_EXPIRE_HOURS),
        invited_by_id=user.id,
    )
    db.add(invitation)
    db.flush()
    sent = send_business_invitation_email(
        to_email=email,
        business_name=business.name,
        inviter_name=user.full_name,
        role_label=ROLE_LABELS[payload.role],
        token=token,
        expires_hours=INVITE_EXPIRE_HOURS,
    )
    db.commit()
    result = BusinessInvitationOut.model_validate(invitation)
    result.business = _brief(business)
    result.token = None if sent else token
    return result


@router.delete(
    "/{business_id}/team/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_business_team_member(
    business_id: int,
    member_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    _team_manager_business(db, user, business_id)
    member = db.get(BusinessTeamMember, member_id)
    if member is None or member.business_id != business_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team member not found")
    db.delete(member)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{business_id}/verification", response_model=BusinessVerificationOut)
def business_verification(
    business_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    business = db.get(Business, business_id)
    if business is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    if business_access_role(db, user, business) is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    record = db.scalar(
        select(BusinessVerification)
        .where(BusinessVerification.business_id == business_id)
        .order_by(BusinessVerification.created_at.desc(), BusinessVerification.id.desc())
    )
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No verification submitted")
    result = BusinessVerificationOut.model_validate(record)
    result.business = _brief(business)
    return result


@router.post("/{business_id}/verification", response_model=BusinessVerificationOut)
def submit_business_verification(
    business_id: int,
    payload: BusinessVerificationSubmit,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    business = db.get(Business, business_id)
    if business is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    role = business_access_role(db, user, business)
    if role is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    reference = payload.reference.strip() if payload.reference else None
    document_url = payload.document_url.strip() if payload.document_url else None
    notes = payload.notes.strip() if payload.notes else None
    result_status = BusinessVerificationStatus.pending

    if payload.method == BusinessVerificationMethod.registration:
        if not reference and not document_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Provide a registration number or document link",
            )
    elif payload.method == BusinessVerificationMethod.domain_email:
        email_domain = user.email.rsplit("@", 1)[-1].lower()
        parent = db.get(Business, business.parent_id) if business.parent_id else None
        allowed_domains = {
            _domain_from_url(business.website),
            _domain_from_url(parent.website) if parent else None,
        }
        allowed_domains.discard(None)
        if reference:
            allowed_domains.add(reference.strip().lower().lstrip("@"))
        if email_domain in allowed_domains:
            result_status = BusinessVerificationStatus.verified
            notes = notes or "Official domain email matched the listing website."
        else:
            notes = notes or "Email domain did not match the listing website."
    elif payload.method == BusinessVerificationMethod.branch_staff:
        if business.parent_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Branch staff verification requires a branch listing",
            )
        result_status = BusinessVerificationStatus.verified
        notes = notes or "Verified by an accepted branch staff invitation."

    record = BusinessVerification(
        business_id=business_id,
        method=payload.method,
        status=result_status,
        reference=reference,
        document_url=document_url,
        notes=notes,
        submitted_by_id=user.id,
        reviewed_by_id=user.id if result_status == BusinessVerificationStatus.verified else None,
        reviewed_at=utcnow() if result_status == BusinessVerificationStatus.verified else None,
    )
    db.add(record)
    business.verification_status = result_status
    business.verification_method = payload.method
    business.verification_reference = reference
    business.verification_notes = notes
    business.verified_by_id = user.id if result_status == BusinessVerificationStatus.verified else None
    business.verified_at = utcnow() if result_status == BusinessVerificationStatus.verified else None
    db.commit()
    result = BusinessVerificationOut.model_validate(record)
    result.business = _brief(business)
    return result


@router.get("/{business_id}", response_model=BusinessOut)
def get_business(
    business_id: int,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    row = db.execute(business_query().where(Business.id == business_id)).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    if not _can_view(db, row[0], user):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    return _context_business(db, user, row[0], row[1], row[2])


@router.post("", response_model=BusinessOut, status_code=status.HTTP_201_CREATED)
def create_business(
    payload: BusinessCreate,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    _validate_relations(db, payload.category_id, payload.city_id)
    parent = None
    if payload.parent_id is not None:
        parent_error = validate_business_parent(db, None, payload.parent_id)
        if parent_error:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=parent_error)
        parent = db.get(Business, payload.parent_id)
        if parent is None or not can_manage_team(db, user, parent):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot add branches to this brand",
            )

    business = Business(
        name=payload.name.strip(),
        slug=unique_slug(db, Business, payload.name),
        description=payload.description,
        address=payload.address,
        phone=payload.phone,
        email=str(payload.email).lower() if payload.email else None,
        website=payload.website,
        logo_url=payload.logo_url,
        category_id=payload.category_id,
        city_id=payload.city_id,
        parent_id=payload.parent_id,
        hours=payload.hours,
        promo_headline=payload.promo_headline,
        promo_details=payload.promo_details,
        owner_id=parent.owner_id if parent is not None and parent.owner_id else user.id,
        created_by_id=user.id,
        status=BusinessStatus.pending,
    )
    db.add(business)
    db.flush()
    if parent is not None and business.owner_id != user.id:
        db.add(
            BusinessTeamMember(
                business_id=business.id,
                user_id=user.id,
                role=BusinessTeamRole.corporate_admin,
                created_by_id=user.id,
            )
        )
    db.commit()
    return _context_business(db, user, business)


@router.patch("/{business_id}", response_model=BusinessOut)
def update_business(
    business_id: int,
    payload: BusinessUpdate,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    business = db.get(Business, business_id)
    if business is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    role = business_access_role(db, user, business)
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update listings you manage",
        )

    data = payload.model_dump(exclude_unset=True)
    if "parent_id" in data:
        if not can_change_parent(db, user, business):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the owner can change the parent brand",
            )
        parent_error = validate_business_parent(db, business.id, data["parent_id"])
        if parent_error:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=parent_error)
    if not can_edit_business_fields(db, user, business, set(data) - {"parent_id"}):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your role cannot edit one or more of these fields",
        )
    if "name" in data:
        if data["name"] is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="name cannot be null")
        data["name"] = data["name"].strip()
        if data["name"] != business.name:
            data["slug"] = unique_slug(db, Business, data["name"], exclude_id=business.id)
    if "category_id" in data:
        if data["category_id"] is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="category_id cannot be null"
            )
        _validate_relations(db, category_id=data["category_id"])
    if "city_id" in data:
        if data["city_id"] is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="city_id cannot be null"
            )
        _validate_relations(db, city_id=data["city_id"])
    if "email" in data and data["email"] is not None:
        data["email"] = str(data["email"]).lower()

    for field, value in data.items():
        setattr(business, field, value)
    db.add(business)
    db.commit()
    return _context_business(db, user, business)


@router.delete("/{business_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_business(
    business_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    business = db.get(Business, business_id)
    if business is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    if not has_role(user, UserRole.admin) and business.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete listings you own",
        )
    child = db.scalar(select(Business.id).where(Business.parent_id == business_id))
    if child is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Remove or reassign branches before deleting this brand",
        )
    db.delete(business)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
