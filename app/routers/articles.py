from datetime import datetime, timezone
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_current_active_user
from app.models import (
    Article,
    ArticleAccessOverride,
    ArticleType,
    Business,
    BusinessStatus,
    User,
    UserRole,
    utcnow,
)
from app.roles import has_any_role, has_role
from app.schemas import ArticleCreate, ArticleList, ArticleOut, ArticleUpdate
from app.utils import unique_slug

router = APIRouter(tags=["Articles"])

PAID_STATUSES = ("active", "trialing")


def _article_query():
    return select(Article).options(
        joinedload(Article.author),
        joinedload(Article.business).joinedload(Business.category),
        joinedload(Article.business).joinedload(Business.city),
    )


def _published_filters() -> list:
    return [
        Article.is_published.is_(True),
        Business.status == BusinessStatus.approved,
        or_(
            Business.article_access_override.is_(None),
            Business.article_access_override != ArticleAccessOverride.rejected,
        ),
        or_(
            Business.subscription_status.in_(PAID_STATUSES),
            (Business.manual_paid_until.is_not(None))
            & (Business.manual_paid_until > utcnow()),
        ),
    ]


def _paginate(
    db: Session,
    stmt,
    filters: list,
    page: int,
    page_size: int,
) -> ArticleList:
    total = (
        db.scalar(
            select(func.count(Article.id)).join(Business, Article.business_id == Business.id).where(*filters)
        )
        or 0
    )
    items = (
        db.scalars(
            stmt.join(Business, Article.business_id == Business.id)
            .where(*filters)
            .order_by(Article.published_at.desc())
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
        pages=ceil(total / page_size) if total else 0,
    )


def _is_content_editor(user: User) -> bool:
    return has_any_role(user, (UserRole.admin, UserRole.editor))


def _owned_business(db: Session, business_id: int, user: User) -> Business:
    business = db.get(Business, business_id)
    if business is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    if business.owner_id != user.id and not _is_content_editor(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the listing owner can manage articles",
        )
    return business


def _load_article(db: Session, article_id: int) -> ArticleOut:
    article = db.scalar(_article_query().where(Article.id == article_id))
    if article is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    return article


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _validate_event_dates(
    article_type: ArticleType,
    starts_at: datetime | None,
    ends_at: datetime | None,
) -> tuple[datetime | None, datetime | None]:
    if article_type != ArticleType.event:
        return None, None
    starts_at = _aware(starts_at)
    ends_at = _aware(ends_at)
    if starts_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event articles require a start date and time",
        )
    if ends_at is not None and ends_at < starts_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event end time cannot be before the start time",
        )
    return starts_at, ends_at


@router.get("/articles", response_model=ArticleList)
def list_articles(
    business_id: int | None = Query(default=None),
    article_type: ArticleType | None = Query(default=None, alias="type"),
    search: str | None = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=50),
    db: Session = Depends(get_db),
):
    filters = _published_filters()
    if business_id is not None:
        filters.append(Article.business_id == business_id)
    if article_type is not None:
        filters.append(Article.article_type == article_type)
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
    return _paginate(db, _article_query(), filters, page, page_size)


@router.get("/articles/{slug}", response_model=ArticleOut)
def get_article(slug: str, db: Session = Depends(get_db)):
    article = db.scalar(
        _article_query()
        .join(Business, Article.business_id == Business.id)
        .where(Article.slug == slug, *_published_filters())
    )
    if article is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    return article


@router.get("/businesses/{business_id}/articles/manage", response_model=ArticleList)
def manage_business_articles(
    business_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    _owned_business(db, business_id, user)
    filters = [Article.business_id == business_id]
    total = db.scalar(select(func.count(Article.id)).where(*filters)) or 0
    items = (
        db.scalars(
            _article_query()
            .where(*filters)
            .order_by(Article.published_at.desc())
        )
        .unique()
        .all()
    )
    return ArticleList(
        items=items,
        total=total,
        page=1,
        page_size=max(1, len(items)),
        pages=1 if total else 0,
    )


@router.post(
    "/businesses/{business_id}/articles",
    response_model=ArticleOut,
    status_code=status.HTTP_201_CREATED,
)
def create_article(
    business_id: int,
    payload: ArticleCreate,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    business = _owned_business(db, business_id, user)
    if business.status != BusinessStatus.approved and not _is_content_editor(user):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only approved listings can publish articles",
        )
    if not business.is_paid and not _is_content_editor(user):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="A paid subscription is required to publish articles for this listing",
        )

    event_starts_at, event_ends_at = _validate_event_dates(
        payload.article_type, payload.event_starts_at, payload.event_ends_at
    )
    title = payload.title.strip()
    body = payload.body.strip()
    if len(title) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Title must be at least 3 characters",
        )
    if len(body) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Update details must be at least 10 characters",
        )
    article = Article(
        business_id=business.id,
        author_id=user.id,
        title=title,
        slug=unique_slug(db, Article, title),
        summary=payload.summary.strip() or None if payload.summary else None,
        body=body,
        cover_image_url=payload.cover_image_url,
        article_type=payload.article_type,
        event_starts_at=event_starts_at,
        event_ends_at=event_ends_at,
        is_published=payload.is_published,
        published_at=utcnow(),
    )
    db.add(article)
    db.commit()
    return _load_article(db, article.id)


@router.patch("/articles/{article_id}", response_model=ArticleOut)
def update_article(
    article_id: int,
    payload: ArticleUpdate,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    article = db.get(Article, article_id)
    if article is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    if article.business.owner_id != user.id and not _is_content_editor(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the listing owner can edit this article",
        )

    data = payload.model_dump(exclude_unset=True)
    if "is_published" in data and data["is_published"] is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="is_published cannot be null",
        )
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
        if title != article.title:
            data["slug"] = unique_slug(db, Article, title, exclude_id=article.id)
        data["title"] = title
    if "summary" in data:
        data["summary"] = data["summary"].strip() or None if data["summary"] else None
    if "body" in data and data["body"] is not None:
        body = data["body"].strip()
        if len(body) < 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Update details must be at least 10 characters",
            )
        data["body"] = body

    final_type = data.get("article_type", article.article_type)
    starts_at = data.get("event_starts_at", article.event_starts_at)
    ends_at = data.get("event_ends_at", article.event_ends_at)
    starts_at, ends_at = _validate_event_dates(final_type, starts_at, ends_at)
    data["event_starts_at"] = starts_at
    data["event_ends_at"] = ends_at
    if data.get("is_published") and not article.is_published:
        data["published_at"] = utcnow()

    for field, value in data.items():
        setattr(article, field, value)
    db.add(article)
    db.commit()
    return _load_article(db, article.id)


@router.delete("/articles/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_article(
    article_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    article = db.get(Article, article_id)
    if article is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    if article.business.owner_id != user.id and not has_role(user, UserRole.admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the listing owner can delete this article",
        )
    db.delete(article)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
