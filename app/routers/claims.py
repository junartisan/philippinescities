from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_current_active_user
from app.models import Business, BusinessStatus, Claim, ClaimStatus, User, UserRole
from app.schemas import ClaimCreate, ClaimOut

router = APIRouter(prefix="/claims", tags=["Claims"])


def _load_claim(db: Session, claim_id: int) -> Claim:
    claim = db.scalar(
        select(Claim)
        .options(joinedload(Claim.user), joinedload(Claim.business))
        .where(Claim.id == claim_id)
    )
    if claim is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")
    return claim


@router.post("", response_model=ClaimOut, status_code=status.HTTP_201_CREATED)
def create_claim(
    payload: ClaimCreate,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    business = db.get(Business, payload.business_id)
    if business is None or business.status != BusinessStatus.approved:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Approved business not found"
        )
    if business.owner_id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already own this listing",
        )
    pending = db.scalar(
        select(Claim.id).where(
            Claim.business_id == business.id,
            Claim.user_id == user.id,
            Claim.status == ClaimStatus.pending,
        )
    )
    if pending is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a pending claim for this listing",
        )

    claim = Claim(
        business_id=business.id,
        user_id=user.id,
        message=payload.message,
    )
    db.add(claim)
    db.commit()
    return _load_claim(db, claim.id)


@router.get("/mine", response_model=list[ClaimOut])
def my_claims(
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return (
        db.scalars(
            select(Claim)
            .options(joinedload(Claim.user), joinedload(Claim.business))
            .where(Claim.user_id == user.id)
            .order_by(Claim.created_at.desc())
        )
        .unique()
        .all()
    )


@router.get("/{claim_id}", response_model=ClaimOut)
def get_claim(
    claim_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    claim = _load_claim(db, claim_id)
    if claim.user_id != user.id and user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    return claim
