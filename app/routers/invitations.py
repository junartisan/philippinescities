import hashlib
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_current_active_user
from app.models import (
    Business,
    BusinessInvitation,
    BusinessInvitationStatus,
    BusinessTeamMember,
    BusinessTeamRole,
    BusinessVerification,
    BusinessVerificationMethod,
    BusinessVerificationStatus,
    User,
    utcnow,
)
from app.permissions import can_manage_team
from app.schemas import (
    BusinessBrief,
    BusinessInvitationOut,
    InvitationAction,
)

router = APIRouter(prefix="/invitations", tags=["Business invitations"])

ROLE_RANK = {
    BusinessTeamRole.staff: 0,
    BusinessTeamRole.branch_manager: 1,
    BusinessTeamRole.corporate_admin: 2,
}


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _brief(business: Business) -> BusinessBrief:
    return BusinessBrief(id=business.id, name=business.name, slug=business.slug)


def _serialize(db: Session, invitation: BusinessInvitation, token: str | None = None) -> BusinessInvitationOut:
    result = BusinessInvitationOut.model_validate(invitation)
    business = db.get(Business, invitation.business_id)
    if business is not None:
        result.business = _brief(business)
    result.token = token
    return result


def _ensure_pending(db: Session, invitation: BusinessInvitation) -> None:
    if invitation.status != BusinessInvitationStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This invitation is {invitation.status.value}",
        )
    if _aware(invitation.expires_at) <= utcnow():
        invitation.status = BusinessInvitationStatus.expired
        db.add(invitation)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This invitation has expired")


def _find_invitation(db: Session, token: str) -> BusinessInvitation:
    token_hash = _token_hash(token)
    invitation = db.scalar(
        select(BusinessInvitation)
        .options(joinedload(BusinessInvitation.business))
        .where(BusinessInvitation.token_hash == token_hash)
    )
    if invitation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    _ensure_pending(db, invitation)
    return invitation


def _load_user_invitation(
    db: Session,
    user: User,
    invitation_id: int,
) -> BusinessInvitation:
    invitation = db.get(BusinessInvitation, invitation_id)
    if invitation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    if invitation.email.lower() != user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation was sent to a different email address",
        )
    _ensure_pending(db, invitation)
    return invitation


def _verify_branch_staff(db: Session, user: User, business: Business) -> None:
    if business.parent_id is None:
        return
    existing = db.scalar(
        select(BusinessVerification.id).where(
            BusinessVerification.business_id == business.id,
            BusinessVerification.method == BusinessVerificationMethod.branch_staff,
            BusinessVerification.status == BusinessVerificationStatus.verified,
        )
    )
    if existing is not None:
        return
    record = BusinessVerification(
        business_id=business.id,
        method=BusinessVerificationMethod.branch_staff,
        status=BusinessVerificationStatus.verified,
        notes="Verified by an accepted branch team invitation.",
        submitted_by_id=user.id,
        reviewed_by_id=user.id,
        reviewed_at=utcnow(),
    )
    db.add(record)
    business.verification_status = BusinessVerificationStatus.verified
    business.verification_method = BusinessVerificationMethod.branch_staff
    business.verification_notes = record.notes
    business.verified_by_id = user.id
    business.verified_at = record.reviewed_at


def _accept_invitation(
    db: Session,
    user: User,
    invitation: BusinessInvitation,
) -> BusinessInvitationOut:
    if invitation.email.lower() != user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation was sent to a different email address",
        )

    business = db.get(Business, invitation.business_id)
    if business is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    member = db.scalar(
        select(BusinessTeamMember).where(
            BusinessTeamMember.business_id == business.id,
            BusinessTeamMember.user_id == user.id,
        )
    )
    if member is not None:
        if ROLE_RANK[invitation.role] > ROLE_RANK[member.role]:
            member.role = invitation.role
            db.add(member)
    else:
        db.add(
            BusinessTeamMember(
                business_id=business.id,
                user_id=user.id,
                role=invitation.role,
                created_by_id=invitation.invited_by_id,
            )
        )

    if invitation.role in (BusinessTeamRole.branch_manager, BusinessTeamRole.staff):
        _verify_branch_staff(db, user, business)

    invitation.status = BusinessInvitationStatus.accepted
    invitation.accepted_by_id = user.id
    db.add(invitation)
    db.commit()
    return _serialize(db, invitation)


def _decline_invitation(
    db: Session,
    user: User,
    invitation: BusinessInvitation,
) -> BusinessInvitationOut:
    if invitation.email.lower() != user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation was sent to a different email address",
        )
    invitation.status = BusinessInvitationStatus.declined
    db.add(invitation)
    db.commit()
    return _serialize(db, invitation)


@router.get("/mine", response_model=list[BusinessInvitationOut])
def my_invitations(
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    invitations = db.scalars(
        select(BusinessInvitation)
        .options(joinedload(BusinessInvitation.business))
        .where(
            or_(
                BusinessInvitation.email == user.email.lower(),
                BusinessInvitation.email == user.email,
            ),
            BusinessInvitation.status == BusinessInvitationStatus.pending,
        )
        .order_by(BusinessInvitation.created_at.desc())
    ).unique().all()
    for invitation in invitations:
        if _aware(invitation.expires_at) <= utcnow():
            invitation.status = BusinessInvitationStatus.expired
    db.commit()
    return [_serialize(db, invitation) for invitation in invitations]


@router.get("/token/{token}", response_model=BusinessInvitationOut)
def invitation_from_token(
    token: str,
    db: Session = Depends(get_db),
):
    invitation = _find_invitation(db, token)
    return _serialize(db, invitation)


@router.post("/accept", response_model=BusinessInvitationOut)
def accept_invitation(
    payload: InvitationAction,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    invitation = _find_invitation(db, payload.token)
    return _accept_invitation(db, user, invitation)


@router.post("/decline", response_model=BusinessInvitationOut)
def decline_invitation(
    payload: InvitationAction,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    invitation = _find_invitation(db, payload.token)
    return _decline_invitation(db, user, invitation)


@router.post("/{invitation_id}/accept", response_model=BusinessInvitationOut)
def accept_invitation_by_id(
    invitation_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    invitation = _load_user_invitation(db, user, invitation_id)
    return _accept_invitation(db, user, invitation)


@router.post("/{invitation_id}/decline", response_model=BusinessInvitationOut)
def decline_invitation_by_id(
    invitation_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    invitation = _load_user_invitation(db, user, invitation_id)
    return _decline_invitation(db, user, invitation)


@router.post("/{invitation_id}/revoke", response_model=BusinessInvitationOut)
def revoke_invitation(
    invitation_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    invitation = db.get(BusinessInvitation, invitation_id)
    if invitation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    business = db.get(Business, invitation.business_id)
    if business is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    if not can_manage_team(db, user, business):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    if invitation.status != BusinessInvitationStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This invitation is {invitation.status.value}",
        )
    invitation.status = BusinessInvitationStatus.revoked
    db.add(invitation)
    db.commit()
    return _serialize(db, invitation)
