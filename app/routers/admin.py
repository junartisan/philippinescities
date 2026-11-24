from datetime import timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database import get_db
from app.deps import get_current_admin, get_current_editor, get_current_moderator
from app.models import (
    Article,
    ArticleAccessOverride,
    ArticleType,
    BlogCategory,
    BlogContributorProfile,
    BlogContributorStatus,
    Business,
    BusinessStatus,
    Category,
    City,
    CityPost,
    CityPostReviewStatus,
    CityPostType,
    Claim,
    ClaimStatus,
    FeaturedPaymentMethod,
    FeaturedPaymentStatus,
    FeaturedRequest,
    FeaturedRequestStatus,
    ManualPayment,
    PaymentStatus,
    Review,
    User,
    UserRole,
    utcnow,
)
from app.queries import business_query, paginate_businesses, serialize_business
from app.schemas import (
    AdminReviewOut,
    AdminStats,
    ArticleList,
    BusinessCreate,
    BusinessList,
    BusinessOut,
    BlogContributorCitiesUpdate,
    BlogContributorDecision,
    BlogContributorOut,
    BusinessReject,
    CityPostCreate,
    CityPostList,
    CityPostOut,
    CityPostReviewDecision,
    CityPostUpdate,
    ClaimDecision,
    ClaimOut,
    FeaturedRequestDecision,
    FeaturedRequestOut,
    FeaturedRequestReject,
    ManualPaymentDecision,
    ManualPaymentOut,
    ManualPaymentReject,
    RoleUpdate,
    SubscriptionApprove,
    SubscriptionDisapprove,
    UserOut,
)
from app.utils import (
    plain_text_length,
    sanitize_post_body,
    unique_slug,
    validate_city_post_parent,
)

router = APIRouter(prefix="/admin", tags=["Admin"])


def _load_manual_payment(db: Session, payment_id: int) -> ManualPayment:
    payment = db.scalar(
        select(ManualPayment)
        .options(
            joinedload(ManualPayment.business),
            joinedload(ManualPayment.user),
        )
        .where(ManualPayment.id == payment_id)
    )
    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Manual payment request not found",
        )
    return payment


def _featured_request_query():
    return select(FeaturedRequest).options(
        joinedload(FeaturedRequest.business).joinedload(Business.category),
        joinedload(FeaturedRequest.business).joinedload(Business.city),
        joinedload(FeaturedRequest.user),
        joinedload(FeaturedRequest.reviewed_by),
    )


def _load_featured_request(db: Session, request_id: int) -> FeaturedRequest:
    featured_request = db.scalar(
        _featured_request_query().where(FeaturedRequest.id == request_id)
    )
    if featured_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Featured listing request not found",
        )
    return featured_request


def _business_out(db: Session, business_id: int) -> BusinessOut:
    row = db.execute(business_query().where(Business.id == business_id)).first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found",
        )
    return serialize_business(row[0], row[1], row[2])


def _city_post_query():
    return select(CityPost).options(
        joinedload(CityPost.city),
        joinedload(CityPost.blog_category),
        joinedload(CityPost.author),
        joinedload(CityPost.reviewed_by),
    )


def _load_city_post(db: Session, post_id: int) -> CityPostOut:
    post = db.scalar(_city_post_query().where(CityPost.id == post_id))
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return post


def _contributor_query():
    return select(BlogContributorProfile).options(
        joinedload(BlogContributorProfile.user),
        joinedload(BlogContributorProfile.reviewed_by),
        selectinload(BlogContributorProfile.cities),
    )


def _load_contributor(db: Session, profile_id: int) -> BlogContributorOut:
    profile = db.scalar(_contributor_query().where(BlogContributorProfile.id == profile_id))
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contributor application not found",
        )
    return profile


def _resolve_contributor_cities(db: Session, city_ids: list[int]) -> list[City]:
    ids = list(dict.fromkeys(city_ids))
    if not ids:
        return []
    cities = db.scalars(select(City).where(City.id.in_(ids))).all()
    if len(cities) != len(ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more selected cities are invalid",
        )
    return cities


def _aware(value):
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _validate_city_post_dates(
    post_type: CityPostType,
    starts_at,
    ends_at,
) -> tuple:
    if post_type != CityPostType.event:
        return None, None
    starts_at = _aware(starts_at)
    ends_at = _aware(ends_at)
    if starts_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event posts require a start date and time",
        )
    if ends_at is not None and ends_at < starts_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event end time cannot be before the start time",
        )
    return starts_at, ends_at


def _load_claim(db: Session, claim_id: int) -> Claim:
    claim = db.scalar(
        select(Claim)
        .options(joinedload(Claim.user), joinedload(Claim.business))
        .where(Claim.id == claim_id)
    )
    if claim is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")
    return claim


@router.get("/stats", response_model=AdminStats)
def get_stats(
    _: User = Depends(get_current_moderator),
    db: Session = Depends(get_db),
):
    return AdminStats(
        users=db.scalar(select(func.count(User.id))) or 0,
        businesses=db.scalar(select(func.count(Business.id))) or 0,
        pending_businesses=db.scalar(
            select(func.count(Business.id)).where(Business.status == BusinessStatus.pending)
        )
        or 0,
        claims=db.scalar(select(func.count(Claim.id))) or 0,
        pending_claims=db.scalar(
            select(func.count(Claim.id)).where(Claim.status == ClaimStatus.pending)
        )
        or 0,
        pending_manual_payments=db.scalar(
            select(func.count(ManualPayment.id)).where(
                ManualPayment.status == PaymentStatus.pending
            )
        )
        or 0,
        pending_featured_requests=db.scalar(
            select(func.count(FeaturedRequest.id)).where(
                FeaturedRequest.status == FeaturedRequestStatus.pending
            )
        )
        or 0,
        pending_contributors=db.scalar(
            select(func.count(BlogContributorProfile.id)).where(
                BlogContributorProfile.status == BlogContributorStatus.pending
            )
        )
        or 0,
        pending_city_posts=db.scalar(
            select(func.count(CityPost.id)).where(
                CityPost.review_status == CityPostReviewStatus.pending
            )
        )
        or 0,
        reviews=db.scalar(select(func.count(Review.id))) or 0,
        categories=db.scalar(select(func.count(Category.id))) or 0,
        cities=db.scalar(select(func.count(City.id))) or 0,
    )


@router.get("/businesses", response_model=BusinessList)
def list_all_businesses(
    status_filter: BusinessStatus | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _: User = Depends(get_current_moderator),
    db: Session = Depends(get_db),
):
    filters = []
    if status_filter is not None:
        filters.append(Business.status == status_filter)
    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(or_(Business.name.ilike(term), Business.address.ilike(term)))

    stmt = business_query().where(*filters).order_by(Business.created_at.desc())
    return paginate_businesses(db, stmt, filters, page, page_size)


@router.post("/businesses", response_model=BusinessOut, status_code=status.HTTP_201_CREATED)
def create_unclaimed_business(
    payload: BusinessCreate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    if db.get(Category, payload.category_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid category_id")
    if db.get(City, payload.city_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid city_id")

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
        owner_id=None,
        created_by_id=admin.id,
        status=BusinessStatus.approved,
    )
    db.add(business)
    db.commit()
    row = db.execute(business_query().where(Business.id == business.id)).first()
    return serialize_business(row[0], row[1], row[2])


@router.post("/businesses/{business_id}/approve", response_model=BusinessOut)
def approve_business(
    business_id: int,
    _: User = Depends(get_current_moderator),
    db: Session = Depends(get_db),
):
    business = db.get(Business, business_id)
    if business is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    business.status = BusinessStatus.approved
    business.rejection_reason = None
    if business.owner_id is None:
        business.owner_id = business.created_by_id
    if business.owner_id is not None:
        owner = db.get(User, business.owner_id)
        if owner is not None and owner.role == UserRole.user:
            owner.role = UserRole.owner

    db.add(business)
    db.commit()
    row = db.execute(business_query().where(Business.id == business.id)).first()
    return serialize_business(row[0], row[1], row[2])


@router.post("/businesses/{business_id}/reject", response_model=BusinessOut)
def reject_business(
    business_id: int,
    payload: BusinessReject,
    _: User = Depends(get_current_moderator),
    db: Session = Depends(get_db),
):
    business = db.get(Business, business_id)
    if business is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    business.status = BusinessStatus.rejected
    business.rejection_reason = payload.reason
    db.add(business)
    db.commit()
    row = db.execute(business_query().where(Business.id == business.id)).first()
    return serialize_business(row[0], row[1], row[2])


@router.post(
    "/businesses/{business_id}/subscription/approve",
    response_model=BusinessOut,
)
def approve_subscription(
    business_id: int,
    payload: SubscriptionApprove,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    business = db.get(Business, business_id)
    if business is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    if business.status != BusinessStatus.approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only approved listings can receive subscription approval",
        )

    paid_until = payload.paid_until or (utcnow() + timedelta(days=30))
    if paid_until.tzinfo is None:
        paid_until = paid_until.replace(tzinfo=timezone.utc)
    else:
        paid_until = paid_until.astimezone(timezone.utc)
    if paid_until <= utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="paid_until must be in the future",
        )

    reviewed_at = utcnow()
    business.article_access_override = ArticleAccessOverride.approved
    business.article_access_notes = payload.admin_notes
    business.manual_paid_until = paid_until

    pending = db.scalars(
        select(ManualPayment)
        .where(
            ManualPayment.business_id == business.id,
            ManualPayment.status == PaymentStatus.pending,
        )
        .order_by(ManualPayment.created_at.desc())
    ).all()
    for index, payment in enumerate(pending):
        if index == 0:
            payment.status = PaymentStatus.approved
            payment.paid_until = paid_until
            payment.admin_notes = payload.admin_notes
        else:
            payment.status = PaymentStatus.rejected
            payment.admin_notes = "Another payment request was approved for this listing"
        payment.reviewed_by_id = admin.id
        payment.reviewed_at = reviewed_at
        db.add(payment)

    db.add(business)
    db.commit()
    return _business_out(db, business.id)


@router.post(
    "/businesses/{business_id}/subscription/disapprove",
    response_model=BusinessOut,
)
def disapprove_subscription(
    business_id: int,
    payload: SubscriptionDisapprove,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    business = db.get(Business, business_id)
    if business is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    reviewed_at = utcnow()
    business.article_access_override = ArticleAccessOverride.rejected
    business.article_access_notes = payload.admin_notes
    business.manual_paid_until = None

    pending = db.scalars(
        select(ManualPayment).where(
            ManualPayment.business_id == business.id,
            ManualPayment.status == PaymentStatus.pending,
        )
    ).all()
    for payment in pending:
        payment.status = PaymentStatus.rejected
        payment.admin_notes = payload.admin_notes or "Subscription disapproved by an admin"
        payment.reviewed_by_id = admin.id
        payment.reviewed_at = reviewed_at
        db.add(payment)

    db.add(business)
    db.commit()
    return _business_out(db, business.id)


@router.post(
    "/businesses/{business_id}/subscription/reset",
    response_model=BusinessOut,
)
def reset_subscription(
    business_id: int,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    business = db.get(Business, business_id)
    if business is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    business.article_access_override = None
    business.article_access_notes = None
    db.add(business)
    db.commit()
    return _business_out(db, business.id)


@router.get("/manual-payments", response_model=list[ManualPaymentOut])
def list_manual_payments(
    status_filter: PaymentStatus | None = Query(default=None, alias="status"),
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    stmt = (
        select(ManualPayment)
        .options(
            joinedload(ManualPayment.business),
            joinedload(ManualPayment.user),
        )
        .order_by(ManualPayment.created_at.desc())
    )
    if status_filter is not None:
        stmt = stmt.where(ManualPayment.status == status_filter)
    return db.scalars(stmt).unique().all()


@router.post(
    "/manual-payments/{payment_id}/approve",
    response_model=ManualPaymentOut,
)
def approve_manual_payment(
    payment_id: int,
    payload: ManualPaymentDecision,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    payment = _load_manual_payment(db, payment_id)
    if payment.status != PaymentStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This payment request has already been reviewed",
        )
    business = payment.business
    if business.status != BusinessStatus.approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only approved listings can receive payment approval",
        )
    if business.subscription_status in {"active", "trialing"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This listing already has an active Stripe subscription",
        )

    paid_until = payload.paid_until or (utcnow() + timedelta(days=30))
    if paid_until.tzinfo is None:
        paid_until = paid_until.replace(tzinfo=timezone.utc)
    else:
        paid_until = paid_until.astimezone(timezone.utc)
    if paid_until <= utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="paid_until must be in the future",
        )

    reviewed_at = utcnow()
    payment.status = PaymentStatus.approved
    payment.admin_notes = payload.admin_notes
    payment.reviewed_by_id = admin.id
    payment.reviewed_at = reviewed_at
    payment.paid_until = paid_until
    business.manual_paid_until = paid_until
    business.article_access_override = ArticleAccessOverride.approved
    business.article_access_notes = payload.admin_notes

    other_pending = db.scalars(
        select(ManualPayment).where(
            ManualPayment.business_id == business.id,
            ManualPayment.status == PaymentStatus.pending,
            ManualPayment.id != payment.id,
        )
    ).all()
    for other in other_pending:
        other.status = PaymentStatus.rejected
        other.admin_notes = "Another payment request was approved for this listing"
        other.reviewed_by_id = admin.id
        other.reviewed_at = reviewed_at
        db.add(other)

    db.add(payment)
    db.add(business)
    db.commit()
    return _load_manual_payment(db, payment.id)


@router.post(
    "/manual-payments/{payment_id}/reject",
    response_model=ManualPaymentOut,
)
def reject_manual_payment(
    payment_id: int,
    payload: ManualPaymentReject,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    payment = _load_manual_payment(db, payment_id)
    if payment.status != PaymentStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This payment request has already been reviewed",
        )
    payment.status = PaymentStatus.rejected
    payment.admin_notes = payload.admin_notes
    payment.reviewed_by_id = admin.id
    payment.reviewed_at = utcnow()
    db.add(payment)
    db.commit()
    return _load_manual_payment(db, payment.id)


@router.get("/featured-requests", response_model=list[FeaturedRequestOut])
def list_featured_requests(
    status_filter: FeaturedRequestStatus | None = Query(default=None, alias="status"),
    payment_status: FeaturedPaymentStatus | None = Query(default=None),
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    stmt = _featured_request_query().order_by(FeaturedRequest.created_at.desc())
    if status_filter is not None:
        stmt = stmt.where(FeaturedRequest.status == status_filter)
    if payment_status is not None:
        stmt = stmt.where(FeaturedRequest.payment_status == payment_status)
    return db.scalars(stmt).unique().all()


@router.post(
    "/featured-requests/{request_id}/approve",
    response_model=FeaturedRequestOut,
)
def approve_featured_request(
    request_id: int,
    payload: FeaturedRequestDecision,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    featured_request = _load_featured_request(db, request_id)
    if featured_request.status != FeaturedRequestStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This featured listing request has already been reviewed",
        )
    business = featured_request.business
    if business.status != BusinessStatus.approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only approved listings can be featured",
        )
    if (
        featured_request.payment_method != FeaturedPaymentMethod.cash
        and featured_request.payment_method != FeaturedPaymentMethod.bank_transfer
        and featured_request.payment_status != FeaturedPaymentStatus.paid
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The Stripe payment has not been completed",
        )

    featured_until = payload.featured_until or (utcnow() + timedelta(days=30))
    if featured_until.tzinfo is None:
        featured_until = featured_until.replace(tzinfo=timezone.utc)
    else:
        featured_until = featured_until.astimezone(timezone.utc)
    if featured_until <= utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="featured_until must be in the future",
        )

    reviewed_at = utcnow()
    featured_request.status = FeaturedRequestStatus.approved
    featured_request.payment_status = FeaturedPaymentStatus.paid
    featured_request.admin_notes = payload.admin_notes
    featured_request.reviewed_by_id = admin.id
    featured_request.reviewed_at = reviewed_at
    featured_request.featured_until = featured_until
    business.featured_until = featured_until

    other_pending = db.scalars(
        select(FeaturedRequest).where(
            FeaturedRequest.business_id == business.id,
            FeaturedRequest.status == FeaturedRequestStatus.pending,
            FeaturedRequest.id != featured_request.id,
        )
    ).all()
    for other in other_pending:
        other.status = FeaturedRequestStatus.rejected
        other.admin_notes = "Another featured listing request was approved"
        other.reviewed_by_id = admin.id
        other.reviewed_at = reviewed_at
        db.add(other)

    db.add(featured_request)
    db.add(business)
    db.commit()
    return _load_featured_request(db, featured_request.id)


@router.post(
    "/featured-requests/{request_id}/reject",
    response_model=FeaturedRequestOut,
)
def reject_featured_request(
    request_id: int,
    payload: FeaturedRequestReject,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    featured_request = _load_featured_request(db, request_id)
    if featured_request.status != FeaturedRequestStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This featured listing request has already been reviewed",
        )
    featured_request.status = FeaturedRequestStatus.rejected
    if featured_request.payment_status != FeaturedPaymentStatus.paid:
        featured_request.payment_status = FeaturedPaymentStatus.rejected
    featured_request.admin_notes = payload.admin_notes
    featured_request.reviewed_by_id = admin.id
    featured_request.reviewed_at = utcnow()
    db.add(featured_request)
    db.commit()
    return _load_featured_request(db, featured_request.id)


@router.delete(
    "/businesses/{business_id}/featured",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_featured_listing(
    business_id: int,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    business = db.get(Business, business_id)
    if business is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    business.featured_until = None
    db.add(business)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/articles", response_model=ArticleList)
def list_all_articles(
    business_id: int | None = Query(default=None),
    city_id: int | None = Query(default=None),
    category_id: int | None = Query(default=None),
    article_type: ArticleType | None = Query(default=None, alias="type"),
    published: bool | None = Query(default=None),
    search: str | None = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _: User = Depends(get_current_editor),
    db: Session = Depends(get_db),
):
    filters = []
    if business_id is not None:
        filters.append(Article.business_id == business_id)
    if city_id is not None:
        filters.append(Business.city_id == city_id)
    if category_id is not None:
        filters.append(Business.category_id == category_id)
    if article_type is not None:
        filters.append(Article.article_type == article_type)
    if published is not None:
        filters.append(Article.is_published.is_(published))
    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(
            or_(
                Article.title.ilike(term),
                Article.summary.ilike(term),
                Article.body.ilike(term),
                Business.name.ilike(term),
            )
        )

    total = (
        db.scalar(
            select(func.count(Article.id))
            .join(Business, Article.business_id == Business.id)
            .where(*filters)
        )
        or 0
    )
    items = (
        db.scalars(
            select(Article)
            .options(
                joinedload(Article.author),
                joinedload(Article.business).joinedload(Business.category),
                joinedload(Article.business).joinedload(Business.city),
            )
            .join(Business, Article.business_id == Business.id)
            .where(*filters)
            .order_by(Article.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        .unique()
        .all()
    )
    return ArticleList(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size if total else 0,
    )


@router.get("/city-posts", response_model=CityPostList)
def list_all_city_posts(
    city_id: int | None = Query(default=None),
    blog_category_id: int | None = Query(default=None),
    post_type: CityPostType | None = Query(default=None, alias="type"),
    published: bool | None = Query(default=None),
    review_status: CityPostReviewStatus | None = Query(default=None),
    search: str | None = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    _: User = Depends(get_current_editor),
    db: Session = Depends(get_db),
):
    filters = []
    if city_id is not None:
        filters.append(CityPost.city_id == city_id)
    if blog_category_id is not None:
        filters.append(CityPost.blog_category_id == blog_category_id)
    if post_type is not None:
        filters.append(CityPost.post_type == post_type)
    if published is not None:
        filters.append(CityPost.is_published.is_(published))
    if review_status is not None:
        filters.append(CityPost.review_status == review_status)
    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(or_(CityPost.title.ilike(term), CityPost.body.ilike(term)))

    total = db.scalar(select(func.count(CityPost.id)).where(*filters)) or 0
    items = (
        db.scalars(
            _city_post_query()
            .where(*filters)
            .order_by(CityPost.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        .unique()
        .all()
    )
    return CityPostList(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.post("/city-posts", response_model=CityPostOut, status_code=status.HTTP_201_CREATED)
def create_city_post(
    payload: CityPostCreate,
    admin: User = Depends(get_current_editor),
    db: Session = Depends(get_db),
):
    if payload.city_id is not None and db.get(City, payload.city_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid city_id")
    if (
        payload.blog_category_id is not None
        and db.get(BlogCategory, payload.blog_category_id) is None
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid blog_category_id",
        )
    parent_error = validate_city_post_parent(db, None, payload.parent_id)
    if parent_error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=parent_error)
    title = payload.title.strip()
    body = sanitize_post_body(payload.body.strip())
    if len(title) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Title must be at least 3 characters",
        )
    if plain_text_length(body) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Post body must be at least 10 characters",
        )
    starts_at, ends_at = _validate_city_post_dates(
        payload.post_type, payload.event_starts_at, payload.event_ends_at
    )
    post = CityPost(
        city_id=payload.city_id,
        blog_category_id=payload.blog_category_id,
        parent_id=payload.parent_id,
        author_id=admin.id,
        title=title,
        slug=unique_slug(db, CityPost, title),
        summary=payload.summary.strip() or None if payload.summary else None,
        body=body,
        cover_image_url=payload.cover_image_url,
        post_type=payload.post_type,
        event_starts_at=starts_at,
        event_ends_at=ends_at,
        is_published=payload.is_published,
        published_at=utcnow(),
        review_status=CityPostReviewStatus.approved,
        reviewed_by_id=admin.id,
        reviewed_at=utcnow(),
    )
    db.add(post)
    db.commit()
    return _load_city_post(db, post.id)


@router.patch("/city-posts/{post_id}", response_model=CityPostOut)
def update_city_post(
    post_id: int,
    payload: CityPostUpdate,
    _: User = Depends(get_current_editor),
    db: Session = Depends(get_db),
):
    post = db.get(CityPost, post_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    data = payload.model_dump(exclude_unset=True)
    if "city_id" in data:
        if data["city_id"] is not None and db.get(City, data["city_id"]) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid city_id")
    if (
        data.get("blog_category_id") is not None
        and db.get(BlogCategory, data["blog_category_id"]) is None
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid blog_category_id",
        )
    if "parent_id" in data:
        parent_error = validate_city_post_parent(db, post.id, data["parent_id"])
        if parent_error:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=parent_error)
    if "title" in data:
        if data["title"] is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="title cannot be null"
            )
        title = data["title"].strip()
        if len(title) < 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Title must be at least 3 characters",
            )
        if title != post.title:
            data["slug"] = unique_slug(db, CityPost, title, exclude_id=post.id)
        data["title"] = title
    if "summary" in data:
        data["summary"] = data["summary"].strip() or None if data["summary"] else None
    if "body" in data and data["body"] is not None:
        body = sanitize_post_body(data["body"].strip())
        if plain_text_length(body) < 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Post body must be at least 10 characters",
            )
        data["body"] = body

    final_type = data.get("post_type", post.post_type)
    starts_at = data.get("event_starts_at", post.event_starts_at)
    ends_at = data.get("event_ends_at", post.event_ends_at)
    starts_at, ends_at = _validate_city_post_dates(final_type, starts_at, ends_at)
    data["event_starts_at"] = starts_at
    data["event_ends_at"] = ends_at

    if data.get("is_published") and not post.is_published:
        data["published_at"] = utcnow()

    for field, value in data.items():
        setattr(post, field, value)
    db.add(post)
    db.commit()
    return _load_city_post(db, post.id)


@router.delete("/city-posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_city_post(
    post_id: int,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    post = db.get(CityPost, post_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    db.delete(post)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/city-posts/{post_id}/approve", response_model=CityPostOut)
def approve_city_post(
    post_id: int,
    payload: CityPostReviewDecision,
    admin: User = Depends(get_current_editor),
    db: Session = Depends(get_db),
):
    post = db.get(CityPost, post_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    if post.review_status == CityPostReviewStatus.approved and post.is_published:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Post is already approved and published",
        )
    post.review_status = CityPostReviewStatus.approved
    post.is_published = True
    post.review_notes = payload.admin_notes
    post.reviewed_by_id = admin.id
    post.reviewed_at = utcnow()
    post.published_at = utcnow()
    db.add(post)
    db.commit()
    return _load_city_post(db, post.id)


@router.post("/city-posts/{post_id}/reject", response_model=CityPostOut)
def reject_city_post(
    post_id: int,
    payload: CityPostReviewDecision,
    admin: User = Depends(get_current_editor),
    db: Session = Depends(get_db),
):
    post = db.get(CityPost, post_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    post.review_status = CityPostReviewStatus.rejected
    post.is_published = False
    post.review_notes = payload.admin_notes
    post.reviewed_by_id = admin.id
    post.reviewed_at = utcnow()
    db.add(post)
    db.commit()
    return _load_city_post(db, post.id)


@router.get("/contributors", response_model=list[BlogContributorOut])
def list_contributors(
    status_filter: BlogContributorStatus | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None, max_length=120),
    _: User = Depends(get_current_editor),
    db: Session = Depends(get_db),
):
    stmt = _contributor_query()
    if status_filter is not None:
        stmt = stmt.where(BlogContributorProfile.status == status_filter)
    if search and search.strip():
        term = f"%{search.strip()}%"
        stmt = stmt.join(BlogContributorProfile.user).where(
            or_(User.full_name.ilike(term), User.email.ilike(term))
        )
    return db.scalars(stmt.order_by(BlogContributorProfile.created_at.desc())).unique().all()


@router.post(
    "/contributors/{profile_id}/approve",
    response_model=BlogContributorOut,
)
def approve_contributor(
    profile_id: int,
    payload: BlogContributorDecision,
    admin: User = Depends(get_current_editor),
    db: Session = Depends(get_db),
):
    profile = db.get(BlogContributorProfile, profile_id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contributor application not found",
        )
    city_ids = (
        payload.city_ids
        if payload.city_ids is not None
        else [city.id for city in profile.cities]
    )
    cities = _resolve_contributor_cities(db, city_ids)
    if not cities:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assign at least one city before approving this contributor",
        )
    profile.status = BlogContributorStatus.approved
    profile.admin_notes = payload.admin_notes
    profile.reviewed_by_id = admin.id
    profile.reviewed_at = utcnow()
    profile.cities = cities
    db.add(profile)
    db.commit()
    return _load_contributor(db, profile.id)


@router.patch(
    "/contributors/{profile_id}/cities",
    response_model=BlogContributorOut,
)
def update_contributor_cities(
    profile_id: int,
    payload: BlogContributorCitiesUpdate,
    _: User = Depends(get_current_editor),
    db: Session = Depends(get_db),
):
    profile = db.get(BlogContributorProfile, profile_id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contributor application not found",
        )
    profile.cities = _resolve_contributor_cities(db, payload.city_ids)
    db.add(profile)
    db.commit()
    return _load_contributor(db, profile.id)


@router.post(
    "/contributors/{profile_id}/reject",
    response_model=BlogContributorOut,
)
def reject_contributor(
    profile_id: int,
    payload: BlogContributorDecision,
    admin: User = Depends(get_current_editor),
    db: Session = Depends(get_db),
):
    profile = db.get(BlogContributorProfile, profile_id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contributor application not found",
        )
    profile.status = BlogContributorStatus.rejected
    profile.admin_notes = payload.admin_notes
    profile.reviewed_by_id = admin.id
    profile.reviewed_at = utcnow()
    db.add(profile)
    db.commit()
    return _load_contributor(db, profile.id)


@router.get("/reviews", response_model=list[AdminReviewOut])
def list_all_reviews(
    search: str | None = Query(default=None, max_length=120),
    _: User = Depends(get_current_moderator),
    db: Session = Depends(get_db),
):
    stmt = select(Review).options(
        joinedload(Review.user),
        joinedload(Review.business),
    )
    if search and search.strip():
        term = f"%{search.strip()}%"
        stmt = (
            stmt.join(Review.user)
            .join(Review.business)
            .where(
                or_(
                    Review.comment.ilike(term),
                    Business.name.ilike(term),
                    User.full_name.ilike(term),
                    User.email.ilike(term),
                )
            )
        )
    return db.scalars(stmt.order_by(Review.created_at.desc())).unique().all()


@router.get("/claims", response_model=list[ClaimOut])
def list_claims(
    status_filter: ClaimStatus | None = Query(default=None, alias="status"),
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    stmt = (
        select(Claim)
        .options(joinedload(Claim.user), joinedload(Claim.business))
        .order_by(Claim.created_at.desc())
    )
    if status_filter is not None:
        stmt = stmt.where(Claim.status == status_filter)
    return db.scalars(stmt).unique().all()


@router.post("/claims/{claim_id}/approve", response_model=ClaimOut)
def approve_claim(
    claim_id: int,
    payload: ClaimDecision,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    claim = db.scalar(
        select(Claim)
        .options(joinedload(Claim.user), joinedload(Claim.business))
        .where(Claim.id == claim_id)
    )
    if claim is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")
    if claim.status != ClaimStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Claim has already been processed",
        )

    reviewed_at = utcnow()
    claim.business.owner_id = claim.user_id
    if claim.user.role == UserRole.user:
        claim.user.role = UserRole.owner
    claim.status = ClaimStatus.approved
    claim.admin_notes = payload.admin_notes
    claim.reviewed_by_id = admin.id
    claim.reviewed_at = reviewed_at

    db.execute(
        update(Claim)
        .where(
            Claim.business_id == claim.business_id,
            Claim.id != claim.id,
            Claim.status == ClaimStatus.pending,
        )
        .values(
            status=ClaimStatus.rejected,
            admin_notes="Listing was claimed by another user",
            reviewed_by_id=admin.id,
            reviewed_at=reviewed_at,
        )
    )
    db.add(claim)
    db.commit()
    return _load_claim(db, claim.id)


@router.post("/claims/{claim_id}/reject", response_model=ClaimOut)
def reject_claim(
    claim_id: int,
    payload: ClaimDecision,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    claim = db.get(Claim, claim_id)
    if claim is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")
    if claim.status != ClaimStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Claim has already been processed",
        )
    claim.status = ClaimStatus.rejected
    claim.admin_notes = payload.admin_notes
    claim.reviewed_by_id = admin.id
    claim.reviewed_at = utcnow()
    db.add(claim)
    db.commit()
    return _load_claim(db, claim.id)


@router.get("/users", response_model=list[UserOut])
def list_users(
    search: str | None = Query(default=None, max_length=120),
    role: UserRole | None = Query(default=None),
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    stmt = select(User).order_by(User.created_at.desc())
    if search and search.strip():
        term = f"%{search.strip()}%"
        stmt = stmt.where(or_(User.email.ilike(term), User.full_name.ilike(term)))
    if role is not None:
        stmt = stmt.where(User.role == role)
    return db.scalars(stmt).all()


@router.patch("/users/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: int,
    payload: RoleUpdate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == admin.id and payload.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admins cannot remove their own admin role",
        )
    user.role = payload.role
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
