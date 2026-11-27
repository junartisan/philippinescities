from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def enum_column(enum_cls: type[enum.Enum]) -> Enum:
    return Enum(
        enum_cls,
        native_enum=False,
        length=20,
        values_callable=lambda members: [member.value for member in members],
    )


class UserRole(str, enum.Enum):
    user = "user"
    owner = "owner"
    editor = "editor"
    supervisor = "supervisor"
    admin = "admin"


class UserRoleAssignment(Base):
    __tablename__ = "user_roles"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[UserRole] = mapped_column(enum_column(UserRole), primary_key=True)
    user: Mapped["User"] = relationship(back_populates="role_assignments")


class BusinessStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class ClaimStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class BusinessTeamRole(str, enum.Enum):
    corporate_admin = "corporate_admin"
    branch_manager = "branch_manager"
    staff = "staff"


class BusinessInvitationStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"
    revoked = "revoked"
    expired = "expired"


class BusinessVerificationMethod(str, enum.Enum):
    registration = "registration"
    domain_email = "domain_email"
    branch_staff = "branch_staff"


class BusinessVerificationStatus(str, enum.Enum):
    unverified = "unverified"
    pending = "pending"
    verified = "verified"
    rejected = "rejected"


class ArticleType(str, enum.Enum):
    product_update = "product_update"
    service_update = "service_update"
    promo = "promo"
    event = "event"
    sports = "sports"
    other = "other"


class CityPostType(str, enum.Enum):
    article = "article"
    event = "event"


class CityPostReviewStatus(str, enum.Enum):
    draft = "draft"
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class BlogContributorStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class PaymentMethod(str, enum.Enum):
    cash = "cash"
    bank_transfer = "bank_transfer"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class ArticleAccessOverride(str, enum.Enum):
    approved = "approved"
    rejected = "rejected"


class FeaturedPaymentMethod(str, enum.Enum):
    cash = "cash"
    bank_transfer = "bank_transfer"
    stripe = "stripe"


class FeaturedPaymentStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    rejected = "rejected"


class FeaturedRequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


blog_contributor_cities = Table(
    "blog_contributor_cities",
    Base.metadata,
    Column(
        "profile_id",
        ForeignKey("blog_contributor_profiles.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "city_id",
        ForeignKey("cities.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    facebook_id: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    role: Mapped[UserRole] = mapped_column(
        enum_column(UserRole), default=UserRole.user, nullable=False
    )
    role_assignments: Mapped[list[UserRoleAssignment]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    @property
    def roles(self) -> list[UserRole]:
        return [assignment.role for assignment in self.role_assignments]

    owned_businesses: Mapped[list[Business]] = relationship(
        "Business",
        back_populates="owner",
        foreign_keys="Business.owner_id",
    )
    created_businesses: Mapped[list[Business]] = relationship(
        "Business",
        back_populates="created_by",
        foreign_keys="Business.created_by_id",
    )
    claims: Mapped[list[Claim]] = relationship(
        "Claim",
        back_populates="user",
        foreign_keys="Claim.user_id",
        cascade="all, delete-orphan",
    )
    reviews: Mapped[list[Review]] = relationship(
        "Review",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    articles: Mapped[list[Article]] = relationship(
        "Article",
        back_populates="author",
        foreign_keys="Article.author_id",
    )
    city_posts: Mapped[list[CityPost]] = relationship(
        "CityPost",
        back_populates="author",
        foreign_keys="CityPost.author_id",
    )
    city_post_comments: Mapped[list[CityPostComment]] = relationship(
        "CityPostComment",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    blog_contributor_profile: Mapped[BlogContributorProfile | None] = relationship(
        "BlogContributorProfile",
        back_populates="user",
        foreign_keys="BlogContributorProfile.user_id",
        uselist=False,
        cascade="all, delete-orphan",
    )
    manual_payments: Mapped[list[ManualPayment]] = relationship(
        "ManualPayment",
        back_populates="user",
        foreign_keys="ManualPayment.user_id",
    )
    featured_requests: Mapped[list[FeaturedRequest]] = relationship(
        "FeaturedRequest",
        back_populates="user",
        foreign_keys="FeaturedRequest.user_id",
    )
    business_team_members: Mapped[list[BusinessTeamMember]] = relationship(
        "BusinessTeamMember",
        back_populates="user",
        foreign_keys="BusinessTeamMember.user_id",
        cascade="all, delete-orphan",
    )
    business_invitations: Mapped[list[BusinessInvitation]] = relationship(
        "BusinessInvitation",
        foreign_keys="BusinessInvitation.invited_by_id",
    )


class Category(TimestampMixin, Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    businesses: Mapped[list[Business]] = relationship(back_populates="category")
    parent: Mapped[Category | None] = relationship(
        "Category",
        remote_side=[id],
        back_populates="children",
    )
    children: Mapped[list[Category]] = relationship(
        "Category",
        back_populates="parent",
        cascade="all, delete-orphan",
    )


class City(TimestampMixin, Base):
    __tablename__ = "cities"
    __table_args__ = (
        UniqueConstraint("name", "province", name="uq_city_name_province"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True, nullable=False)
    province: Mapped[str | None] = mapped_column(String(120))
    region: Mapped[str | None] = mapped_column(String(120))

    businesses: Mapped[list[Business]] = relationship(back_populates="city")
    city_posts: Mapped[list[CityPost]] = relationship(
        back_populates="city", cascade="all, delete-orphan"
    )
    blog_contributors: Mapped[list[BlogContributorProfile]] = relationship(
        secondary=blog_contributor_cities,
        back_populates="cities",
    )


class Business(TimestampMixin, Base):
    __tablename__ = "businesses"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(240), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str | None] = mapped_column(String(300))
    phone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(255))
    website: Mapped[str | None] = mapped_column(String(255))
    logo_url: Mapped[str | None] = mapped_column(String(500))

    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id"), index=True, nullable=False
    )
    city_id: Mapped[int] = mapped_column(ForeignKey("cities.id"), index=True, nullable=False)
    owner_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("businesses.id", ondelete="SET NULL"), index=True
    )

    status: Mapped[BusinessStatus] = mapped_column(
        enum_column(BusinessStatus), default=BusinessStatus.pending, index=True, nullable=False
    )
    rejection_reason: Mapped[str | None] = mapped_column(String(500))

    hours: Mapped[str | None] = mapped_column(String(500))
    promo_headline: Mapped[str | None] = mapped_column(String(200))
    promo_details: Mapped[str | None] = mapped_column(Text)
    verification_status: Mapped[BusinessVerificationStatus] = mapped_column(
        enum_column(BusinessVerificationStatus),
        default=BusinessVerificationStatus.unverified,
        index=True,
        nullable=False,
    )
    verification_method: Mapped[BusinessVerificationMethod | None] = mapped_column(
        enum_column(BusinessVerificationMethod)
    )
    verification_reference: Mapped[str | None] = mapped_column(String(500))
    verification_notes: Mapped[str | None] = mapped_column(String(1000))
    verified_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    stripe_subscription_id: Mapped[str | None] = mapped_column(
        String(255), unique=True, index=True
    )
    stripe_price_id: Mapped[str | None] = mapped_column(String(255))
    subscription_status: Mapped[str | None] = mapped_column(String(32))
    subscription_current_period_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    manual_paid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    article_access_override: Mapped[ArticleAccessOverride | None] = mapped_column(
        enum_column(ArticleAccessOverride), index=True
    )
    article_access_notes: Mapped[str | None] = mapped_column(String(1000))
    featured_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), index=True
    )

    category: Mapped[Category] = relationship(back_populates="businesses")
    city: Mapped[City] = relationship(back_populates="businesses")
    owner: Mapped[User | None] = relationship(
        back_populates="owned_businesses", foreign_keys=[owner_id]
    )
    created_by: Mapped[User | None] = relationship(
        back_populates="created_businesses", foreign_keys=[created_by_id]
    )
    claims: Mapped[list[Claim]] = relationship(
        back_populates="business", cascade="all, delete-orphan"
    )
    reviews: Mapped[list[Review]] = relationship(
        back_populates="business", cascade="all, delete-orphan"
    )
    articles: Mapped[list[Article]] = relationship(
        back_populates="business", cascade="all, delete-orphan"
    )
    manual_payments: Mapped[list[ManualPayment]] = relationship(
        back_populates="business", cascade="all, delete-orphan"
    )
    featured_requests: Mapped[list[FeaturedRequest]] = relationship(
        back_populates="business", cascade="all, delete-orphan"
    )
    parent: Mapped[Business | None] = relationship(
        back_populates="children", remote_side=[id]
    )
    children: Mapped[list[Business]] = relationship(
        back_populates="parent", order_by="Business.name"
    )
    team_members: Mapped[list[BusinessTeamMember]] = relationship(
        back_populates="business", cascade="all, delete-orphan"
    )
    invitations: Mapped[list[BusinessInvitation]] = relationship(
        back_populates="business", cascade="all, delete-orphan"
    )
    verifications: Mapped[list[BusinessVerification]] = relationship(
        back_populates="business", cascade="all, delete-orphan"
    )
    verified_by: Mapped[User | None] = relationship(foreign_keys=[verified_by_id])

    @property
    def is_claimed(self) -> bool:
        return self.owner_id is not None

    @property
    def is_featured(self) -> bool:
        if self.featured_until is None:
            return False
        featured_until = self.featured_until
        if featured_until.tzinfo is None:
            featured_until = featured_until.replace(tzinfo=timezone.utc)
        return featured_until > utcnow()

    @property
    def is_paid(self) -> bool:
        if self.article_access_override == ArticleAccessOverride.rejected:
            return False
        if self.subscription_status in {"active", "trialing"}:
            return True
        if self.manual_paid_until is None:
            return False
        paid_until = self.manual_paid_until
        if paid_until.tzinfo is None:
            paid_until = paid_until.replace(tzinfo=timezone.utc)
        return paid_until > utcnow()


class Claim(TimestampMixin, Base):
    __tablename__ = "claims"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(
        ForeignKey("businesses.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    message: Mapped[str | None] = mapped_column(String(1000))
    status: Mapped[ClaimStatus] = mapped_column(
        enum_column(ClaimStatus), default=ClaimStatus.pending, index=True, nullable=False
    )
    admin_notes: Mapped[str | None] = mapped_column(String(1000))
    reviewed_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    business: Mapped[Business] = relationship(back_populates="claims")
    user: Mapped[User] = relationship(back_populates="claims", foreign_keys=[user_id])


class BusinessTeamMember(TimestampMixin, Base):
    __tablename__ = "business_team_members"
    __table_args__ = (
        UniqueConstraint("business_id", "user_id", name="uq_business_team_business_user"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(
        ForeignKey("businesses.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    role: Mapped[BusinessTeamRole] = mapped_column(
        enum_column(BusinessTeamRole), index=True, nullable=False
    )
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    business: Mapped[Business] = relationship(back_populates="team_members")
    user: Mapped[User] = relationship(
        back_populates="business_team_members", foreign_keys=[user_id]
    )


class BusinessInvitation(TimestampMixin, Base):
    __tablename__ = "business_invitations"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(
        ForeignKey("businesses.id", ondelete="CASCADE"), index=True, nullable=False
    )
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    role: Mapped[BusinessTeamRole] = mapped_column(
        enum_column(BusinessTeamRole), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    status: Mapped[BusinessInvitationStatus] = mapped_column(
        enum_column(BusinessInvitationStatus),
        default=BusinessInvitationStatus.pending,
        index=True,
        nullable=False,
    )
    message: Mapped[str | None] = mapped_column(String(1000))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    invited_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    accepted_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    business: Mapped[Business] = relationship(back_populates="invitations")


class BusinessVerification(TimestampMixin, Base):
    __tablename__ = "business_verifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(
        ForeignKey("businesses.id", ondelete="CASCADE"), index=True, nullable=False
    )
    method: Mapped[BusinessVerificationMethod] = mapped_column(
        enum_column(BusinessVerificationMethod), index=True, nullable=False
    )
    status: Mapped[BusinessVerificationStatus] = mapped_column(
        enum_column(BusinessVerificationStatus),
        default=BusinessVerificationStatus.pending,
        index=True,
        nullable=False,
    )
    reference: Mapped[str | None] = mapped_column(String(500))
    document_url: Mapped[str | None] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(String(1000))
    admin_notes: Mapped[str | None] = mapped_column(String(1000))
    submitted_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    reviewed_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    business: Mapped[Business] = relationship(back_populates="verifications")


class Review(TimestampMixin, Base):
    __tablename__ = "reviews"
    __table_args__ = (
        UniqueConstraint("business_id", "user_id", name="uq_review_business_user"),
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_review_rating_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(
        ForeignKey("businesses.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str | None] = mapped_column(String(2000))

    business: Mapped[Business] = relationship(back_populates="reviews")
    user: Mapped[User] = relationship(back_populates="reviews")


class Article(TimestampMixin, Base):
    __tablename__ = "articles"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(
        ForeignKey("businesses.id", ondelete="CASCADE"), index=True, nullable=False
    )
    author_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    title: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(240), unique=True, index=True, nullable=False)
    summary: Mapped[str | None] = mapped_column(String(500))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    cover_image_url: Mapped[str | None] = mapped_column(String(500))
    article_type: Mapped[ArticleType] = mapped_column(
        enum_column(ArticleType), default=ArticleType.other, index=True, nullable=False
    )
    event_starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    event_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_published: Mapped[bool] = mapped_column(default=True, index=True, nullable=False)
    published_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    business: Mapped[Business] = relationship(back_populates="articles")
    author: Mapped[User | None] = relationship(back_populates="articles")


class BlogCategory(TimestampMixin, Base):
    __tablename__ = "blog_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))

    city_posts: Mapped[list[CityPost]] = relationship(back_populates="blog_category")


class CityPost(TimestampMixin, Base):
    __tablename__ = "city_posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    city_id: Mapped[int | None] = mapped_column(
        ForeignKey("cities.id", ondelete="CASCADE"), index=True
    )
    blog_category_id: Mapped[int | None] = mapped_column(
        ForeignKey("blog_categories.id", ondelete="SET NULL"), index=True
    )
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("city_posts.id", ondelete="SET NULL"), index=True
    )
    author_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    title: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(240), unique=True, index=True, nullable=False)
    summary: Mapped[str | None] = mapped_column(String(500))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    cover_image_url: Mapped[str | None] = mapped_column(String(500))
    source_id: Mapped[str | None] = mapped_column(String(100), index=True)
    source_url: Mapped[str | None] = mapped_column(String(500), index=True)
    post_type: Mapped[CityPostType] = mapped_column(
        enum_column(CityPostType), default=CityPostType.article, index=True, nullable=False
    )
    event_starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    event_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_published: Mapped[bool] = mapped_column(default=True, index=True, nullable=False)
    published_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    review_status: Mapped[CityPostReviewStatus] = mapped_column(
        enum_column(CityPostReviewStatus),
        default=CityPostReviewStatus.approved,
        index=True,
        nullable=False,
    )
    review_notes: Mapped[str | None] = mapped_column(String(1000))
    reviewed_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    city: Mapped[City | None] = relationship(back_populates="city_posts")
    blog_category: Mapped[BlogCategory | None] = relationship(
        back_populates="city_posts"
    )
    parent: Mapped[CityPost | None] = relationship(
        back_populates="children", remote_side=[id]
    )
    children: Mapped[list[CityPost]] = relationship(
        back_populates="parent", order_by="CityPost.title"
    )
    author: Mapped[User | None] = relationship(
        back_populates="city_posts", foreign_keys=[author_id]
    )
    reviewed_by: Mapped[User | None] = relationship(foreign_keys=[reviewed_by_id])
    comments: Mapped[list[CityPostComment]] = relationship(
        back_populates="city_post", cascade="all, delete-orphan"
    )


class CityPostComment(TimestampMixin, Base):
    __tablename__ = "city_post_comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    city_post_id: Mapped[int] = mapped_column(
        ForeignKey("city_posts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    body: Mapped[str] = mapped_column(String(2000), nullable=False)

    city_post: Mapped[CityPost] = relationship(back_populates="comments")
    user: Mapped[User] = relationship(back_populates="city_post_comments")


class BlogContributorProfile(TimestampMixin, Base):
    __tablename__ = "blog_contributor_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    status: Mapped[BlogContributorStatus] = mapped_column(
        enum_column(BlogContributorStatus),
        default=BlogContributorStatus.pending,
        index=True,
        nullable=False,
    )
    message: Mapped[str | None] = mapped_column(String(2000))
    admin_notes: Mapped[str | None] = mapped_column(String(1000))
    headline: Mapped[str | None] = mapped_column(String(120))
    bio: Mapped[str | None] = mapped_column(String(1000))
    credentials: Mapped[str | None] = mapped_column(String(1000))
    reviewed_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(
        back_populates="blog_contributor_profile", foreign_keys=[user_id]
    )
    reviewed_by: Mapped[User | None] = relationship(foreign_keys=[reviewed_by_id])
    cities: Mapped[list[City]] = relationship(
        secondary=blog_contributor_cities,
        back_populates="blog_contributors",
        order_by=City.name,
    )


class ManualPayment(TimestampMixin, Base):
    __tablename__ = "manual_payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(
        ForeignKey("businesses.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    method: Mapped[PaymentMethod] = mapped_column(
        enum_column(PaymentMethod), index=True, nullable=False
    )
    reference: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(String(2000))
    status: Mapped[PaymentStatus] = mapped_column(
        enum_column(PaymentStatus), default=PaymentStatus.pending, index=True, nullable=False
    )
    admin_notes: Mapped[str | None] = mapped_column(String(1000))
    reviewed_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    paid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    business: Mapped[Business] = relationship(back_populates="manual_payments")
    user: Mapped[User | None] = relationship(
        back_populates="manual_payments", foreign_keys=[user_id]
    )


class FeaturedRequest(TimestampMixin, Base):
    __tablename__ = "featured_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(
        ForeignKey("businesses.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    message: Mapped[str | None] = mapped_column(String(1000))
    payment_method: Mapped[FeaturedPaymentMethod] = mapped_column(
        enum_column(FeaturedPaymentMethod), index=True, nullable=False
    )
    payment_status: Mapped[FeaturedPaymentStatus] = mapped_column(
        enum_column(FeaturedPaymentStatus),
        default=FeaturedPaymentStatus.pending,
        index=True,
        nullable=False,
    )
    payment_reference: Mapped[str | None] = mapped_column(String(255))
    payment_notes: Mapped[str | None] = mapped_column(String(2000))
    stripe_session_id: Mapped[str | None] = mapped_column(
        String(255), unique=True, index=True
    )
    status: Mapped[FeaturedRequestStatus] = mapped_column(
        enum_column(FeaturedRequestStatus),
        default=FeaturedRequestStatus.pending,
        index=True,
        nullable=False,
    )
    admin_notes: Mapped[str | None] = mapped_column(String(1000))
    reviewed_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    featured_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    business: Mapped[Business] = relationship(back_populates="featured_requests")
    user: Mapped[User | None] = relationship(
        back_populates="featured_requests", foreign_keys=[user_id]
    )
    reviewed_by: Mapped[User | None] = relationship(foreign_keys=[reviewed_by_id])
