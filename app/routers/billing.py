from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.billing import (
    ensure_stripe_customer,
    handle_stripe_event,
    stripe_configured,
    stripe_featured_configured,
    stripe_request,
    verify_stripe_signature,
)
from app.config import settings
from app.database import get_db
from app.deps import get_current_active_user
from app.models import (
    ArticleAccessOverride,
    Business,
    BusinessStatus,
    FeaturedPaymentStatus,
    FeaturedRequest,
    FeaturedRequestStatus,
    ManualPayment,
    PaymentMethod,
    PaymentStatus,
    User,
    UserRole,
)
from app.roles import has_role
from app.schemas import (
    AccountBillingBusinessOut,
    AccountBillingOut,
    BillingConfigOut,
    BillingStatusOut,
    CheckoutSessionOut,
    FeaturedStatusOut,
    ManualPaymentCreate,
    ManualPaymentOut,
    PortalSessionOut,
)

router = APIRouter(prefix="/billing", tags=["Billing"])


def _owned_business(db: Session, business_id: int, user: User) -> Business:
    business = db.get(Business, business_id)
    if business is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    if business.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the listing owner can manage billing",
        )
    return business


def _manual_payment_query():
    return select(ManualPayment).options(
        joinedload(ManualPayment.business),
        joinedload(ManualPayment.user),
    )


def _load_manual_payment(db: Session, payment_id: int) -> ManualPayment:
    payment = db.scalar(
        _manual_payment_query().where(ManualPayment.id == payment_id)
    )
    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Manual payment request not found",
        )
    return payment


def _latest_manual_payment(db: Session, business_id: int) -> ManualPayment | None:
    return db.scalar(
        _manual_payment_query()
        .where(ManualPayment.business_id == business_id)
        .order_by(ManualPayment.created_at.desc())
        .limit(1)
    )


def _pending_manual_payment(db: Session, business_id: int) -> ManualPayment | None:
    return db.scalar(
        _manual_payment_query()
        .where(
            ManualPayment.business_id == business_id,
            ManualPayment.status == PaymentStatus.pending,
        )
        .order_by(ManualPayment.created_at.desc())
        .limit(1)
    )


@router.get("/config", response_model=BillingConfigOut)
def billing_config():
    return BillingConfigOut(
        enabled=stripe_configured(),
        plan_name=settings.stripe_plan_name,
    )


@router.get("/account", response_model=AccountBillingOut)
def account_billing(
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    businesses = (
        db.scalars(
            select(Business)
            .options(joinedload(Business.category), joinedload(Business.city))
            .where(Business.owner_id == user.id)
            .order_by(Business.name.asc())
        )
        .unique()
        .all()
    )
    business_ids = [business.id for business in businesses]

    payments_by_business: dict[int, list[ManualPayment]] = {}
    featured_by_business: dict[int, list[FeaturedRequest]] = {}
    if business_ids:
        payments = (
            db.scalars(
                _manual_payment_query()
                .where(ManualPayment.business_id.in_(business_ids))
                .order_by(ManualPayment.created_at.desc())
            )
            .unique()
            .all()
        )
        for payment in payments:
            payments_by_business.setdefault(payment.business_id, []).append(payment)

        featured_requests = (
            db.scalars(
                select(FeaturedRequest)
                .options(
                    joinedload(FeaturedRequest.business).joinedload(Business.category),
                    joinedload(FeaturedRequest.business).joinedload(Business.city),
                    joinedload(FeaturedRequest.user),
                )
                .where(FeaturedRequest.business_id.in_(business_ids))
                .order_by(FeaturedRequest.created_at.desc())
            )
            .unique()
            .all()
        )
        for featured_request in featured_requests:
            featured_by_business.setdefault(
                featured_request.business_id, []
            ).append(featured_request)

    items: list[AccountBillingBusinessOut] = []
    for business in businesses:
        business_payments = payments_by_business.get(business.id, [])
        latest_payment = business_payments[0] if business_payments else None
        pending_payment = next(
            (payment for payment in business_payments if payment.status == PaymentStatus.pending),
            None,
        )

        business_featured = featured_by_business.get(business.id, [])
        latest_featured = business_featured[0] if business_featured else None
        pending_featured = next(
            (
                request
                for request in business_featured
                if request.status == FeaturedRequestStatus.pending
            ),
            None,
        )

        items.append(
            AccountBillingBusinessOut(
                business=business,
                article=BillingStatusOut(
                    business_id=business.id,
                    is_paid=business.is_paid,
                    subscription_status=business.subscription_status,
                    current_period_end=business.subscription_current_period_end,
                    manual_paid_until=business.manual_paid_until,
                    article_access_override=business.article_access_override,
                    article_access_notes=business.article_access_notes,
                    manual_payment_pending=pending_payment is not None,
                    latest_manual_payment=latest_payment,
                    stripe_enabled=stripe_configured(),
                    plan_name=settings.stripe_plan_name,
                    has_customer=bool(user.stripe_customer_id),
                ),
                featured=FeaturedStatusOut(
                    business_id=business.id,
                    is_featured=business.is_featured,
                    featured_until=business.featured_until,
                    pending_request=pending_featured,
                    latest_request=latest_featured,
                    stripe_enabled=stripe_featured_configured(),
                    plan_name=settings.stripe_featured_plan_name,
                ),
                manual_payments=business_payments,
                featured_requests=business_featured,
            )
        )

    return AccountBillingOut(
        has_stripe_customer=bool(user.stripe_customer_id),
        article_stripe_enabled=stripe_configured(),
        featured_stripe_enabled=stripe_featured_configured(),
        article_plan_name=settings.stripe_plan_name,
        featured_plan_name=settings.stripe_featured_plan_name,
        active_article_subscriptions=sum(1 for item in items if item.article.is_paid),
        active_featured_listings=sum(1 for item in items if item.featured.is_featured),
        pending_payments=sum(
            1 for payment in payments_by_business.values() for item in payment if item.status == PaymentStatus.pending
        )
        + sum(
            1
            for requests in featured_by_business.values()
            for item in requests
            if item.status == FeaturedRequestStatus.pending
            and item.payment_status == FeaturedPaymentStatus.pending
        ),
        businesses=items,
    )


@router.get("/businesses/{business_id}", response_model=BillingStatusOut)
def business_billing_status(
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
            detail="You cannot view this listing's billing status",
        )
    owner = business.owner
    latest_payment = _latest_manual_payment(db, business.id)
    pending_payment = _pending_manual_payment(db, business.id)
    return BillingStatusOut(
        business_id=business.id,
        is_paid=business.is_paid,
        subscription_status=business.subscription_status,
        current_period_end=business.subscription_current_period_end,
        manual_paid_until=business.manual_paid_until,
        article_access_override=business.article_access_override,
        article_access_notes=business.article_access_notes,
        manual_payment_pending=pending_payment is not None,
        latest_manual_payment=latest_payment,
        stripe_enabled=stripe_configured(),
        plan_name=settings.stripe_plan_name,
        has_customer=bool(owner and owner.stripe_customer_id),
    )


@router.get(
    "/businesses/{business_id}/manual-payments",
    response_model=list[ManualPaymentOut],
)
def list_manual_payments(
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
            detail="You cannot view this listing's payment requests",
        )
    return (
        db.scalars(
            _manual_payment_query()
            .where(ManualPayment.business_id == business_id)
            .order_by(ManualPayment.created_at.desc())
        )
        .unique()
        .all()
    )


@router.post(
    "/businesses/{business_id}/manual-payments",
    response_model=ManualPaymentOut,
    status_code=status.HTTP_201_CREATED,
)
def submit_manual_payment(
    business_id: int,
    payload: ManualPaymentCreate,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    business = _owned_business(db, business_id, user)
    if business.status != BusinessStatus.approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only approved listings can submit a payment",
        )
    if business.is_paid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This listing already has an active payment",
        )
    if business.article_access_override == ArticleAccessOverride.rejected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Article subscription access was disabled by an admin",
        )
    if _pending_manual_payment(db, business.id) is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A manual payment request is already awaiting approval",
        )

    reference = payload.reference.strip() if payload.reference else None
    notes = payload.notes.strip() if payload.notes else None
    if payload.method == PaymentMethod.bank_transfer and not reference:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A bank transfer reference is required",
        )

    payment = ManualPayment(
        business_id=business.id,
        user_id=user.id,
        method=payload.method,
        reference=reference,
        notes=notes,
        status=PaymentStatus.pending,
    )
    db.add(payment)
    db.commit()
    return _load_manual_payment(db, payment.id)


@router.post("/businesses/{business_id}/checkout", response_model=CheckoutSessionOut)
def create_checkout(
    business_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if not stripe_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is not configured",
        )
    business = _owned_business(db, business_id, user)
    if business.status != BusinessStatus.approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only approved listings can be subscribed",
        )
    if business.is_paid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This listing already has an active subscription",
        )
    if business.article_access_override == ArticleAccessOverride.rejected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Article subscription access was disabled by an admin",
        )
    if business.stripe_subscription_id and business.subscription_status not in {
        None,
        "canceled",
        "incomplete_expired",
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Manage the existing subscription instead of creating a new one",
        )
    if _pending_manual_payment(db, business.id) is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A manual payment request is awaiting approval",
        )

    customer_id = ensure_stripe_customer(db, user)
    frontend = settings.frontend_url.rstrip("/")
    session = stripe_request(
        "POST",
        "checkout/sessions",
        {
            "mode": "subscription",
            "customer": customer_id,
            "line_items": [{"price": settings.stripe_price_id, "quantity": 1}],
            "success_url": (
                f"{frontend}/dashboard/listings/{business.id}/articles"
                "?checkout=success"
            ),
            "cancel_url": (
                f"{frontend}/dashboard/listings/{business.id}/articles"
                "?checkout=cancelled"
            ),
            "client_reference_id": f"business:{business.id}",
            "metadata": {
                "business_id": str(business.id),
                "user_id": str(user.id),
            },
            "subscription_data": {
                "metadata": {
                    "business_id": str(business.id),
                    "user_id": str(user.id),
                }
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
    return CheckoutSessionOut(checkout_url=checkout_url)


@router.post("/businesses/{business_id}/portal", response_model=PortalSessionOut)
def create_portal(
    business_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if not stripe_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is not configured",
        )
    business = _owned_business(db, business_id, user)
    if not user.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account does not have a billing customer yet",
        )
    frontend = settings.frontend_url.rstrip("/")
    session = stripe_request(
        "POST",
        "billing_portal/sessions",
        {
            "customer": user.stripe_customer_id,
            "return_url": f"{frontend}/dashboard/listings/{business.id}/articles",
        },
    )
    portal_url = str(session.get("url") or "").strip()
    if not portal_url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Stripe did not return a billing portal URL",
        )
    return PortalSessionOut(portal_url=portal_url)


@router.post("/webhook", status_code=status.HTTP_204_NO_CONTENT)
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    payload = await request.body()
    event = verify_stripe_signature(payload, request.headers.get("stripe-signature"))
    handle_stripe_event(db, event)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
