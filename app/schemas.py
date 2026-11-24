from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import (
    ArticleAccessOverride,
    ArticleType,
    BlogContributorStatus,
    BusinessStatus,
    CityPostReviewStatus,
    CityPostType,
    ClaimStatus,
    FeaturedPaymentMethod,
    FeaturedPaymentStatus,
    FeaturedRequestStatus,
    PaymentMethod,
    PaymentStatus,
    UserRole,
)
from app.utils import sanitize_post_body


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=120)
    phone: str | None = Field(default=None, max_length=30)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    phone: str | None = Field(default=None, max_length=30)
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserOut(ORMModel):
    id: int
    email: str
    full_name: str
    phone: str | None
    avatar_url: str | None
    role: UserRole
    is_active: bool
    created_at: datetime


class UserPublic(ORMModel):
    id: int
    full_name: str


class UserBrief(ORMModel):
    id: int
    full_name: str
    email: str


class RoleUpdate(BaseModel):
    role: UserRole


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RegisterResponse(BaseModel):
    message: str
    email: EmailStr


class EmailVerificationRequest(BaseModel):
    token: str = Field(min_length=16, max_length=4096)


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=16, max_length=4096)
    password: str = Field(min_length=8, max_length=128)


class CategoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class CategoryOut(ORMModel):
    id: int
    name: str
    slug: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class CityCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    province: str | None = Field(default=None, max_length=120)
    region: str | None = Field(default=None, max_length=120)


class CityUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    province: str | None = Field(default=None, max_length=120)
    region: str | None = Field(default=None, max_length=120)


class CityOut(ORMModel):
    id: int
    name: str
    slug: str
    province: str | None
    region: str | None
    created_at: datetime
    updated_at: datetime


class BusinessCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    address: str | None = Field(default=None, max_length=300)
    phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    website: str | None = Field(default=None, max_length=255)
    logo_url: str | None = Field(default=None, max_length=500)
    category_id: int
    city_id: int


class BusinessUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    address: str | None = Field(default=None, max_length=300)
    phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    website: str | None = Field(default=None, max_length=255)
    logo_url: str | None = Field(default=None, max_length=500)
    category_id: int | None = None
    city_id: int | None = None


class BusinessOut(ORMModel):
    id: int
    name: str
    slug: str
    description: str | None
    address: str | None
    phone: str | None
    email: EmailStr | None
    website: str | None
    logo_url: str | None
    status: BusinessStatus
    is_claimed: bool
    is_paid: bool
    article_access_override: ArticleAccessOverride | None
    article_access_notes: str | None
    is_featured: bool
    featured_until: datetime | None
    rejection_reason: str | None
    category: CategoryOut
    city: CityOut
    owner: UserPublic | None
    average_rating: float = 0.0
    review_count: int = 0
    created_at: datetime
    updated_at: datetime


class BusinessBrief(ORMModel):
    id: int
    name: str
    slug: str


class ArticleBusinessOut(BusinessBrief):
    logo_url: str | None
    category: CategoryOut
    city: CityOut


class FeaturedBusinessOut(BusinessBrief):
    category: CategoryOut
    city: CityOut


class BusinessList(BaseModel):
    items: list[BusinessOut]
    total: int
    page: int
    page_size: int
    pages: int


class BusinessReject(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class ClaimCreate(BaseModel):
    business_id: int
    message: str | None = Field(default=None, max_length=1000)


class ClaimDecision(BaseModel):
    admin_notes: str | None = Field(default=None, max_length=1000)


class ClaimOut(ORMModel):
    id: int
    business_id: int
    user_id: int
    message: str | None
    status: ClaimStatus
    admin_notes: str | None
    business: BusinessBrief
    user: UserBrief
    created_at: datetime
    updated_at: datetime
    reviewed_at: datetime | None


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=2000)


class ReviewUpdate(BaseModel):
    rating: int | None = Field(default=None, ge=1, le=5)
    comment: str | None = Field(default=None, max_length=2000)


class ReviewOut(ORMModel):
    id: int
    business_id: int
    rating: int
    comment: str | None
    user: UserPublic
    created_at: datetime
    updated_at: datetime


class AdminReviewOut(ReviewOut):
    business: BusinessBrief


class ArticleCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    summary: str | None = Field(default=None, max_length=500)
    body: str = Field(min_length=10, max_length=200000)
    cover_image_url: str | None = Field(default=None, max_length=500)
    article_type: ArticleType = ArticleType.other
    event_starts_at: datetime | None = None
    event_ends_at: datetime | None = None
    is_published: bool = True


class ArticleUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=200)
    summary: str | None = Field(default=None, max_length=500)
    body: str | None = Field(default=None, min_length=10, max_length=200000)
    cover_image_url: str | None = Field(default=None, max_length=500)
    article_type: ArticleType | None = None
    event_starts_at: datetime | None = None
    event_ends_at: datetime | None = None
    is_published: bool | None = None


class ArticleOut(ORMModel):
    id: int
    business_id: int
    title: str
    slug: str
    summary: str | None
    body: str
    cover_image_url: str | None
    article_type: ArticleType
    event_starts_at: datetime | None
    event_ends_at: datetime | None
    is_published: bool
    published_at: datetime
    business: ArticleBusinessOut
    author: UserPublic | None
    created_at: datetime
    updated_at: datetime


class ArticleList(BaseModel):
    items: list[ArticleOut]
    total: int
    page: int
    page_size: int
    pages: int


class BlogCategoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class BlogCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class BlogCategoryOut(ORMModel):
    id: int
    name: str
    slug: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class CityPostBreadcrumbOut(ORMModel):
    id: int
    title: str
    slug: str


class CityPostOptionOut(ORMModel):
    id: int
    title: str
    slug: str
    parent_id: int | None


class CityPostCreate(BaseModel):
    city_id: int | None = None
    blog_category_id: int | None = None
    parent_id: int | None = None
    title: str = Field(min_length=3, max_length=200)
    summary: str | None = Field(default=None, max_length=500)
    body: str = Field(min_length=10, max_length=200000)
    cover_image_url: str | None = Field(default=None, max_length=500)
    post_type: CityPostType = CityPostType.article
    event_starts_at: datetime | None = None
    event_ends_at: datetime | None = None
    is_published: bool = True


class CityPostUpdate(BaseModel):
    city_id: int | None = Field(default=None)
    blog_category_id: int | None = None
    parent_id: int | None = None
    title: str | None = Field(default=None, min_length=3, max_length=200)
    summary: str | None = Field(default=None, max_length=500)
    body: str | None = Field(default=None, min_length=10, max_length=200000)
    cover_image_url: str | None = Field(default=None, max_length=500)
    post_type: CityPostType | None = None
    event_starts_at: datetime | None = None
    event_ends_at: datetime | None = None
    is_published: bool | None = None


class CityPostOut(ORMModel):
    id: int
    city_id: int | None
    blog_category_id: int | None
    parent_id: int | None
    title: str
    slug: str
    summary: str | None
    body: str
    cover_image_url: str | None
    post_type: CityPostType
    event_starts_at: datetime | None
    event_ends_at: datetime | None
    is_published: bool
    published_at: datetime
    review_status: CityPostReviewStatus
    review_notes: str | None
    reviewed_at: datetime | None
    city: CityOut | None
    blog_category: BlogCategoryOut | None
    author: UserPublic | None
    reviewed_by: UserPublic | None
    created_at: datetime
    updated_at: datetime

    @field_validator("body")
    @classmethod
    def _sanitize_body(cls, value: str) -> str:
        return sanitize_post_body(value)


class CityPostList(BaseModel):
    items: list[CityPostOut]
    total: int
    page: int
    page_size: int
    pages: int


class CityPostPublicOut(ORMModel):
    id: int
    city_id: int | None
    blog_category_id: int | None
    parent_id: int | None
    title: str
    slug: str
    summary: str | None
    body: str
    cover_image_url: str | None
    post_type: CityPostType
    event_starts_at: datetime | None
    event_ends_at: datetime | None
    is_published: bool
    published_at: datetime
    review_status: CityPostReviewStatus
    city: CityOut | None
    blog_category: BlogCategoryOut | None
    author: UserPublic | None
    breadcrumbs: list[CityPostBreadcrumbOut] = Field(default_factory=list)
    children: list[CityPostBreadcrumbOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    @field_validator("body")
    @classmethod
    def _sanitize_body(cls, value: str) -> str:
        return sanitize_post_body(value)


class CityPostPublicList(BaseModel):
    items: list[CityPostPublicOut]
    total: int
    page: int
    page_size: int
    pages: int


class CityPostCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class CityPostCommentOut(ORMModel):
    id: int
    city_post_id: int
    body: str
    user: UserPublic
    created_at: datetime
    updated_at: datetime


class CityPostReviewDecision(BaseModel):
    admin_notes: str | None = Field(default=None, max_length=1000)


class BlogContributorApply(BaseModel):
    message: str | None = Field(default=None, max_length=2000)
    city_ids: list[int] = Field(min_length=1, max_length=20)


class BlogContributorDecision(BaseModel):
    admin_notes: str | None = Field(default=None, max_length=1000)
    city_ids: list[int] | None = Field(default=None, max_length=20)


class BlogContributorCitiesUpdate(BaseModel):
    city_ids: list[int] = Field(default_factory=list, max_length=20)


class BlogContributorProfileUpdate(BaseModel):
    headline: str | None = Field(default=None, max_length=120)
    bio: str | None = Field(default=None, max_length=1000)
    credentials: str | None = Field(default=None, max_length=1000)


class BlogContributorProfileOut(ORMModel):
    id: int
    user_id: int
    status: BlogContributorStatus
    message: str | None
    headline: str | None
    bio: str | None
    credentials: str | None
    reviewed_at: datetime | None
    user: UserBrief
    cities: list[CityOut]
    created_at: datetime
    updated_at: datetime


class WriterCredentialOut(BaseModel):
    user_id: int
    full_name: str
    avatar_url: str | None
    headline: str | None
    bio: str | None
    credentials: str | None
    cities: list[str]


class BlogContributorOut(ORMModel):
    id: int
    user_id: int
    status: BlogContributorStatus
    message: str | None
    admin_notes: str | None
    headline: str | None
    bio: str | None
    credentials: str | None
    reviewed_at: datetime | None
    user: UserBrief
    cities: list[CityOut]
    created_at: datetime
    updated_at: datetime


class BlogContributorStatusOut(BaseModel):
    status: BlogContributorStatus | None
    message: str | None
    admin_notes: str | None
    reviewed_at: datetime | None
    can_apply: bool
    cities: list[CityOut]


class ContributorPostCreate(BaseModel):
    city_id: int | None = None
    blog_category_id: int | None = None
    parent_id: int | None = None
    title: str = Field(min_length=3, max_length=200)
    summary: str | None = Field(default=None, max_length=500)
    body: str = Field(min_length=10, max_length=200000)
    cover_image_url: str | None = Field(default=None, max_length=500)
    post_type: CityPostType = CityPostType.article
    event_starts_at: datetime | None = None
    event_ends_at: datetime | None = None
    submit_for_review: bool = True


class ContributorPostUpdate(BaseModel):
    city_id: int | None = None
    blog_category_id: int | None = None
    parent_id: int | None = None
    title: str | None = Field(default=None, min_length=3, max_length=200)
    summary: str | None = Field(default=None, max_length=500)
    body: str | None = Field(default=None, min_length=10, max_length=200000)
    cover_image_url: str | None = Field(default=None, max_length=500)
    post_type: CityPostType | None = None
    event_starts_at: datetime | None = None
    event_ends_at: datetime | None = None
    submit_for_review: bool | None = None


class ManualPaymentCreate(BaseModel):
    method: PaymentMethod
    reference: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=2000)


class ManualPaymentDecision(BaseModel):
    paid_until: datetime | None = None
    admin_notes: str | None = Field(default=None, max_length=1000)


class ManualPaymentReject(BaseModel):
    admin_notes: str | None = Field(default=None, max_length=1000)


class ManualPaymentOut(ORMModel):
    id: int
    business_id: int
    user_id: int | None
    method: PaymentMethod
    reference: str | None
    notes: str | None
    status: PaymentStatus
    admin_notes: str | None
    reviewed_at: datetime | None
    paid_until: datetime | None
    business: BusinessBrief
    user: UserBrief | None
    created_at: datetime
    updated_at: datetime


class FeaturedRequestCreate(BaseModel):
    payment_method: FeaturedPaymentMethod
    message: str | None = Field(default=None, max_length=1000)
    payment_reference: str | None = Field(default=None, max_length=255)
    payment_notes: str | None = Field(default=None, max_length=2000)


class FeaturedRequestDecision(BaseModel):
    featured_until: datetime | None = None
    admin_notes: str | None = Field(default=None, max_length=1000)


class FeaturedRequestReject(BaseModel):
    admin_notes: str | None = Field(default=None, max_length=1000)


class FeaturedRequestOut(ORMModel):
    id: int
    business_id: int
    user_id: int | None
    message: str | None
    payment_method: FeaturedPaymentMethod
    payment_status: FeaturedPaymentStatus
    payment_reference: str | None
    payment_notes: str | None
    status: FeaturedRequestStatus
    admin_notes: str | None
    reviewed_at: datetime | None
    featured_until: datetime | None
    business: FeaturedBusinessOut
    user: UserBrief | None
    created_at: datetime
    updated_at: datetime


class FeaturedCheckoutOut(BaseModel):
    request: FeaturedRequestOut
    checkout_url: str


class FeaturedStatusOut(BaseModel):
    business_id: int
    is_featured: bool
    featured_until: datetime | None
    pending_request: FeaturedRequestOut | None
    latest_request: FeaturedRequestOut | None
    stripe_enabled: bool
    plan_name: str


class BillingConfigOut(BaseModel):
    enabled: bool
    plan_name: str


class SubscriptionApprove(BaseModel):
    paid_until: datetime | None = None
    admin_notes: str | None = Field(default=None, max_length=1000)


class SubscriptionDisapprove(BaseModel):
    admin_notes: str | None = Field(default=None, max_length=1000)


class BillingStatusOut(BaseModel):
    business_id: int
    is_paid: bool
    subscription_status: str | None
    current_period_end: datetime | None
    manual_paid_until: datetime | None
    article_access_override: ArticleAccessOverride | None
    article_access_notes: str | None
    manual_payment_pending: bool
    latest_manual_payment: ManualPaymentOut | None
    stripe_enabled: bool
    plan_name: str
    has_customer: bool


class AccountBillingBusinessOut(BaseModel):
    business: ArticleBusinessOut
    article: BillingStatusOut
    featured: FeaturedStatusOut
    manual_payments: list[ManualPaymentOut]
    featured_requests: list[FeaturedRequestOut]


class AccountBillingOut(BaseModel):
    has_stripe_customer: bool
    article_stripe_enabled: bool
    featured_stripe_enabled: bool
    article_plan_name: str
    featured_plan_name: str
    active_article_subscriptions: int
    active_featured_listings: int
    pending_payments: int
    businesses: list[AccountBillingBusinessOut]


class CheckoutSessionOut(BaseModel):
    checkout_url: str


class PortalSessionOut(BaseModel):
    portal_url: str


class OAuthExchangeRequest(BaseModel):
    code: str = Field(min_length=10, max_length=2000)


class OAuthProviders(BaseModel):
    google: bool
    facebook: bool


class AdminStats(BaseModel):
    users: int
    businesses: int
    pending_businesses: int
    claims: int
    pending_claims: int
    pending_manual_payments: int
    pending_featured_requests: int
    pending_contributors: int
    pending_city_posts: int
    reviews: int
    categories: int
    cities: int
