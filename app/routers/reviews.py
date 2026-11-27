from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_current_active_user
from app.models import Business, BusinessStatus, Review, User, UserRole
from app.roles import has_any_role
from app.schemas import ReviewCreate, ReviewOut, ReviewUpdate

router = APIRouter(tags=["Reviews"])


def _get_approved_business(db: Session, business_id: int) -> Business:
    business = db.get(Business, business_id)
    if business is None or business.status != BusinessStatus.approved:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Approved business not found"
        )
    return business


def _load_review(db: Session, review_id: int) -> ReviewOut:
    review = db.scalar(
        select(Review).options(joinedload(Review.user)).where(Review.id == review_id)
    )
    if review is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    return review


@router.get("/businesses/{business_id}/reviews", response_model=list[ReviewOut])
def list_reviews(business_id: int, db: Session = Depends(get_db)):
    _get_approved_business(db, business_id)
    return (
        db.scalars(
            select(Review)
            .options(joinedload(Review.user))
            .where(Review.business_id == business_id)
            .order_by(Review.created_at.desc())
        )
        .unique()
        .all()
    )


@router.post(
    "/businesses/{business_id}/reviews",
    response_model=ReviewOut,
    status_code=status.HTTP_201_CREATED,
)
def create_review(
    business_id: int,
    payload: ReviewCreate,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    business = _get_approved_business(db, business_id)
    if business.owner_id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot review your own business",
        )
    existing = db.scalar(
        select(Review.id).where(Review.business_id == business_id, Review.user_id == user.id)
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already reviewed this business",
        )

    review = Review(
        business_id=business_id,
        user_id=user.id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(review)
    db.commit()
    return _load_review(db, review.id)


@router.patch("/reviews/{review_id}", response_model=ReviewOut)
def update_review(
    review_id: int,
    payload: ReviewUpdate,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    review = db.get(Review, review_id)
    if review is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    if review.user_id != user.id and not has_any_role(
        user, (UserRole.admin, UserRole.editor)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own review",
        )
    data = payload.model_dump(exclude_unset=True)
    if "rating" in data and data["rating"] is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="rating cannot be null"
        )
    for field, value in data.items():
        setattr(review, field, value)
    db.add(review)
    db.commit()
    return _load_review(db, review.id)


@router.delete("/reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(
    review_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    review = db.get(Review, review_id)
    if review is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    if review.user_id != user.id and not has_any_role(
        user, (UserRole.admin, UserRole.supervisor)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this review",
        )
    db.delete(review)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
