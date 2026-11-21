from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import case, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_active_user, get_optional_user
from app.models import (
    Business,
    BusinessStatus,
    Category,
    City,
    User,
    UserRole,
    utcnow,
)
from app.queries import business_query, paginate_businesses, serialize_business
from app.schemas import (
    BusinessCreate,
    BusinessList,
    BusinessOut,
    BusinessUpdate,
)
from app.utils import unique_slug

router = APIRouter(prefix="/businesses", tags=["Businesses"])


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


def _can_view(business: Business, user: User | None) -> bool:
    if business.status == BusinessStatus.approved:
        return True
    if user is None:
        return False
    return user.role in (UserRole.admin, UserRole.supervisor) or business.owner_id == user.id


@router.get("", response_model=BusinessList)
def list_businesses(
    city_id: int | None = Query(default=None),
    category_id: int | None = Query(default=None),
    search: str | None = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    filters = [Business.status == BusinessStatus.approved]
    if city_id is not None:
        filters.append(Business.city_id == city_id)
    if category_id is not None:
        filters.append(Business.category_id == category_id)
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
    rows = (
        db.execute(
            business_query()
            .where(Business.owner_id == user.id)
            .order_by(Business.created_at.desc())
        )
        .unique()
        .all()
    )
    return [serialize_business(business, avg, count) for business, avg, count in rows]


@router.get("/slug/{slug}", response_model=BusinessOut)
def get_business_by_slug(
    slug: str,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    row = db.execute(business_query().where(Business.slug == slug)).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    if not _can_view(row[0], user):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    return serialize_business(row[0], row[1], row[2])


@router.get("/{business_id}", response_model=BusinessOut)
def get_business(
    business_id: int,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    row = db.execute(business_query().where(Business.id == business_id)).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    if not _can_view(row[0], user):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    return serialize_business(row[0], row[1], row[2])


@router.post("", response_model=BusinessOut, status_code=status.HTTP_201_CREATED)
def create_business(
    payload: BusinessCreate,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    _validate_relations(db, payload.category_id, payload.city_id)

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
        owner_id=user.id,
        created_by_id=user.id,
        status=BusinessStatus.pending,
    )
    db.add(business)
    db.commit()
    return _load_business(db, business.id)


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

    is_admin = user.role == UserRole.admin
    if not is_admin and business.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update listings you own",
        )

    data = payload.model_dump(exclude_unset=True)
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
    return _load_business(db, business.id)


@router.delete("/{business_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_business(
    business_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    business = db.get(Business, business_id)
    if business is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    if user.role != UserRole.admin and business.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete listings you own",
        )
    db.delete(business)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
