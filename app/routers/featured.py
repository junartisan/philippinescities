from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.billing import (
    ensure_stripe_customer,
    stripe_featured_configured,
    stripe_request,
)
from app.config import settings
from app.database import get_db
from app.deps import get_current_active_user
from app.models import (
    Business,
    BusinessStatus,
    FeaturedPaymentMethod,
    FeaturedPaymentStatus,
    FeaturedRequest,
    FeaturedRequestStatus,
    User,
    UserRole,
)
from app.roles import has_role
from app.schemas import (
    FeaturedCheckoutOut,
    FeaturedRequestCreate,
    FeaturedRequestOut,
    FeaturedStatusOut,
)

router = APIRouter(prefix="/featured", tags=["Featured listings"])


def _owned_business(db: Session, business_id: int, user: User) -> Business:
    business = db.get(Business, business_id)
    if business is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    if business.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the listing owner can request a featured listing",
        )
    return business


def _request_query():
    return select(FeaturedRequest).options(
        joinedload(FeaturedRequest.business).joinedload(Business.category),
        joinedload(FeaturedRequest.business).joinedload(Business.city),
        joinedload(FeaturedRequest.user),
    )


def _load_request(db: Session, request_id: int) -> FeaturedRequest:
    request = db.scalar(_request_query().where(FeaturedRequest.id == request_id))
    if request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Featured listing request not found",
        )
    return request


def _latest_request(db: Session, business_id: int) -> FeaturedRequest | None:
    return db.scalar(
        _request_query()
        .where(FeaturedRequest.business_id == business_id)
        .order_by(FeaturedRequest.created_at.desc())
        .limit(1)
    )


def _pending_request(db: Session, business_id: int) -> FeaturedRequest | None:
    return db.scalar(
        _request_query()
        .where(
            FeaturedRequest.business_id == business_id,
            FeaturedRequest.status == FeaturedRequestStatus.pending,
        )
        .order_by(FeaturedRequest.created_at.desc())
        .limit(1)
    )


def _start_checkout(
    db: Session,
    request: FeaturedRequest,
    user: User,
) -> str:
    if not stripe_featured_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Featured listing card payments are not configured",
        )
    business = request.business
    customer_id = ensure_stripe_customer(db, user)
    frontend = settings.frontend_url.rstrip("/")
    session = stripe_request(
        "POST",
        "checkout/sessions",
        {
            "mode": "payment",
            "customer": customer_id,
            "line_items": [
                {"price": settings.stripe_featured_price_id, "quantity": 1}
            ],
            "success_url": (
                f"{frontend}/dashboard/listings/{business.id}/featured"
                "?checkout=success"
            ),
            "cancel_url": (
                f"{frontend}/dashboard/listings/{business.id}/featured"
                "?checkout=cancelled"
            ),
            "client_reference_id": f"featured:{request.id}",
            "metadata": {
                "featured_request_id": str(request.id),
                "business_id": str(business.id),
                "user_id": str(user.id),
                "purpose": "featured",
            },
            "allow_promotion_codes": True,
        },
    )
    checkout_url = str(session.get("url") or "").strip()
    if not checkout_url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Stripe did not return a checkout URL",
        )
    session_id = str(session.get("id") or "").strip()
    if session_id:
        request.stripe_session_id = session_id[:255]
        db.add(request)
        db.commit()
    return checkout_url


@router.get("/businesses/{business_id}", response_model=FeaturedStatusOut)
def featured_status(
    business_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    business = db.get(Business, business_id)
    if business is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    if business.owner_id != user.id and not has_role(user, UserRole.admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot view this listing's featured status",
        )
    latest = _latest_request(db, business.id)
    pending = _pending_request(db, business.id)
    return FeaturedStatusOut(
        business_id=business.id,
        is_featured=business.is_featured,
        featured_until=business.featured_until,
        pending_request=pending,
        latest_request=latest,
        stripe_enabled=stripe_featured_configured(),
        plan_name=settings.stripe_featured_plan_name,
    )


@router.get(
    "/businesses/{business_id}/requests",
    response_model=list[FeaturedRequestOut],
)
def list_featured_requests(
    business_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    business = db.get(Business, business_id)
    if business is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    if business.owner_id != user.id and not has_role(user, UserRole.admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot view this listing's featured requests",
        )
    return (
        db.scalars(
            _request_query()
            .where(FeaturedRequest.business_id == business_id)
            .order_by(FeaturedRequest.created_at.desc())
        )
        .unique()
        .all()
    )


@router.post(
    "/businesses/{business_id}/requests",
    response_model=FeaturedRequestOut | FeaturedCheckoutOut,
    status_code=status.HTTP_201_CREATED,
)
def create_featured_request(
    business_id: int,
    payload: FeaturedRequestCreate,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    business = _owned_business(db, business_id, user)
    if business.status != BusinessStatus.approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only approved listings can request a featured placement",
        )
    if business.is_featured:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This listing is already featured",
        )
    if _pending_request(db, business.id) is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A featured listing request is already awaiting review",
        )
    if (
        payload.payment_method == FeaturedPaymentMethod.bank_transfer
        and not (payload.payment_reference or "").strip()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A bank transfer reference is required",
        )
    if (
        payload.payment_method == FeaturedPaymentMethod.stripe
        and not stripe_featured_configured()
    ):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Featured listing card payments are not configured",
        )

    featured_request = FeaturedRequest(
        business_id=business.id,
        user_id=user.id,
        message=(payload.message or "").strip() or None,
        payment_method=payload.payment_method,
        payment_status=FeaturedPaymentStatus.pending,
        payment_reference=(payload.payment_reference or "").strip() or None,
        payment_notes=(payload.payment_notes or "").strip() or None,
        status=FeaturedRequestStatus.pending,
    )
    db.add(featured_request)
    db.commit()

    if payload.payment_method == FeaturedPaymentMethod.stripe:
        try:
            checkout_url = _start_checkout(db, featured_request, user)
        except HTTPException:
            db.delete(featured_request)
            db.commit()
            raise
        return FeaturedCheckoutOut(
            request=_load_request(db, featured_request.id),
            checkout_url=checkout_url,
        )
    return _load_request(db, featured_request.id)


@router.post(
    "/requests/{request_id}/checkout",
    response_model=FeaturedCheckoutOut,
)
def retry_featured_checkout(
    request_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    featured_request = _load_request(db, request_id)
    if featured_request.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only pay for your own featured listing request",
        )
    if featured_request.status != FeaturedRequestStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This featured listing request has already been reviewed",
        )
    if featured_request.payment_method != FeaturedPaymentMethod.stripe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This request is not using Stripe checkout",
        )
    if featured_request.payment_status == FeaturedPaymentStatus.paid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This featured listing request has already been paid",
        )
    checkout_url = _start_checkout(db, featured_request, user)
    return FeaturedCheckoutOut(
        request=_load_request(db, featured_request.id),
        checkout_url=checkout_url,
    )


@router.delete("/requests/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_featured_request(
    request_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    featured_request = _load_request(db, request_id)
    if featured_request.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only cancel your own featured listing request",
        )
    if featured_request.status != FeaturedRequestStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This featured listing request has already been reviewed",
        )
    if featured_request.payment_status == FeaturedPaymentStatus.paid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Paid featured listing requests cannot be cancelled",
        )
    featured_request.status = FeaturedRequestStatus.rejected
    featured_request.payment_status = FeaturedPaymentStatus.rejected
    featured_request.admin_notes = "Cancelled by the business owner"
    db.add(featured_request)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
