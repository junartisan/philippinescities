from datetime import timezone
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database import get_db
from app.deps import get_current_active_user
from app.models import (
    BlogCategory,
    BlogContributorProfile,
    BlogContributorStatus,
    City,
    CityPost,
    CityPostReviewStatus,
    CityPostType,
    User,
    utcnow,
)
from app.schemas import (
    BlogContributorApply,
    BlogContributorProfileOut,
    BlogContributorProfileUpdate,
    BlogContributorStatusOut,
    CityPostList,
    CityPostOut,
    ContributorPostCreate,
    ContributorPostUpdate,
    WriterCredentialOut,
)
from app.utils import plain_text_length, sanitize_post_body, unique_slug

router = APIRouter(prefix="/contributor", tags=["Contributors"])


def _city_post_query():
    return select(CityPost).options(
        joinedload(CityPost.city),
        joinedload(CityPost.blog_category),
        joinedload(CityPost.author),
        joinedload(CityPost.reviewed_by),
    )


def _profile(db: Session, user: User) -> BlogContributorProfile | None:
    return db.scalar(
        select(BlogContributorProfile)
        .options(selectinload(BlogContributorProfile.cities))
        .where(BlogContributorProfile.user_id == user.id)
    )


def _require_contributor(db: Session, user: User) -> BlogContributorProfile:
    profile = _profile(db, user)
    if profile is None or profile.status != BlogContributorStatus.approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Approved blog contributor access required",
        )
    return profile


def _resolve_cities(db: Session, city_ids: list[int]) -> list[City]:
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


def _ensure_city_access(profile: BlogContributorProfile, city_id: int) -> None:
    if city_id not in {city.id for city in profile.cities}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not approved to write for this city",
        )


def _load_post(db: Session, post_id: int) -> CityPostOut:
    post = db.scalar(_city_post_query().where(CityPost.id == post_id))
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return post


def _aware(value):
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _validate_dates(
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


@router.get("/status", response_model=BlogContributorStatusOut)
def get_contributor_status(
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    profile = _profile(db, user)
    return BlogContributorStatusOut(
        status=profile.status if profile else None,
        message=profile.message if profile else None,
        admin_notes=profile.admin_notes if profile else None,
        reviewed_at=profile.reviewed_at if profile else None,
        can_apply=profile is None or profile.status == BlogContributorStatus.rejected,
        cities=profile.cities if profile else [],
    )


@router.get("/profile", response_model=BlogContributorProfileOut)
def get_writer_profile(
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return _require_contributor(db, user)


@router.patch("/profile", response_model=BlogContributorProfileOut)
def update_writer_profile(
    payload: BlogContributorProfileUpdate,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    profile = _require_contributor(db, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if isinstance(value, str):
            value = value.strip() or None
        setattr(profile, field, value)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/writers/{user_id}", response_model=WriterCredentialOut)
def get_writer_credential(user_id: int, db: Session = Depends(get_db)):
    profile = db.scalar(
        select(BlogContributorProfile)
        .options(
            joinedload(BlogContributorProfile.user),
            selectinload(BlogContributorProfile.cities),
        )
        .where(
            BlogContributorProfile.user_id == user_id,
            BlogContributorProfile.status == BlogContributorStatus.approved,
        )
    )
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Writer profile not found"
        )
    return WriterCredentialOut(
        user_id=profile.user_id,
        full_name=profile.user.full_name,
        avatar_url=profile.user.avatar_url,
        headline=profile.headline,
        bio=profile.bio,
        credentials=profile.credentials,
        cities=[city.name for city in profile.cities],
    )


@router.post("/apply", response_model=BlogContributorStatusOut)
def apply_as_contributor(
    payload: BlogContributorApply,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    profile = _profile(db, user)
    if profile is not None and profile.status == BlogContributorStatus.approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already an approved blog contributor",
        )
    if profile is not None and profile.status == BlogContributorStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Your contributor application is already pending review",
        )

    cities = _resolve_cities(db, payload.city_ids)
    if not cities:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select at least one city you want to write for",
        )
    message = payload.message.strip() or None if payload.message else None
    if profile is None:
        profile = BlogContributorProfile(
            user_id=user.id,
            status=BlogContributorStatus.pending,
            message=message,
        )
    else:
        profile.status = BlogContributorStatus.pending
        profile.message = message
        profile.admin_notes = None
        profile.reviewed_by_id = None
        profile.reviewed_at = None
    profile.cities = cities
    db.add(profile)
    db.commit()
    return get_contributor_status(user, db)


@router.get("/posts", response_model=CityPostList)
def list_my_posts(
    review_status: CityPostReviewStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    _require_contributor(db, user)
    filters = [CityPost.author_id == user.id]
    if review_status is not None:
        filters.append(CityPost.review_status == review_status)
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
        pages=ceil(total / page_size) if total else 0,
    )


@router.post("/posts", response_model=CityPostOut, status_code=status.HTTP_201_CREATED)
def create_my_post(
    payload: ContributorPostCreate,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    profile = _require_contributor(db, user)
    if db.get(City, payload.city_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid city_id")
    if (
        payload.blog_category_id is not None
        and db.get(BlogCategory, payload.blog_category_id) is None
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid blog_category_id",
        )
    _ensure_city_access(profile, payload.city_id)
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
    starts_at, ends_at = _validate_dates(
        payload.post_type, payload.event_starts_at, payload.event_ends_at
    )
    post = CityPost(
        city_id=payload.city_id,
        blog_category_id=payload.blog_category_id,
        author_id=user.id,
        title=title,
        slug=unique_slug(db, CityPost, title),
        summary=payload.summary.strip() or None if payload.summary else None,
        body=body,
        cover_image_url=payload.cover_image_url,
        post_type=payload.post_type,
        event_starts_at=starts_at,
        event_ends_at=ends_at,
        is_published=False,
        published_at=utcnow(),
        review_status=(
            CityPostReviewStatus.pending
            if payload.submit_for_review
            else CityPostReviewStatus.draft
        ),
    )
    db.add(post)
    db.commit()
    return _load_post(db, post.id)


@router.patch("/posts/{post_id}", response_model=CityPostOut)
def update_my_post(
    post_id: int,
    payload: ContributorPostUpdate,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    profile = _require_contributor(db, user)
    post = db.get(CityPost, post_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    if post.author_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own posts",
        )
    if post.review_status == CityPostReviewStatus.approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Approved posts can only be edited by an admin",
        )

    data = payload.model_dump(exclude_unset=True)
    submit_for_review = data.pop("submit_for_review", None)
    if "city_id" in data:
        if data["city_id"] is None or db.get(City, data["city_id"]) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid city_id")
    if (
        data.get("blog_category_id") is not None
        and db.get(BlogCategory, data["blog_category_id"]) is None
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid blog_category_id",
        )
    _ensure_city_access(profile, data.get("city_id", post.city_id))
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
    starts_at, ends_at = _validate_dates(final_type, starts_at, ends_at)
    data["event_starts_at"] = starts_at
    data["event_ends_at"] = ends_at

    if submit_for_review is True:
        data["review_status"] = CityPostReviewStatus.pending
        data["review_notes"] = None
        data["reviewed_by_id"] = None
        data["reviewed_at"] = None
    elif submit_for_review is False:
        data["review_status"] = CityPostReviewStatus.draft
    data["is_published"] = False

    for field, value in data.items():
        setattr(post, field, value)
    db.add(post)
    db.commit()
    return _load_post(db, post.id)


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_post(
    post_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    _require_contributor(db, user)
    post = db.get(CityPost, post_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    if post.author_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own posts",
        )
    if post.review_status == CityPostReviewStatus.approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Approved posts must be removed by an admin",
        )
    db.delete(post)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
