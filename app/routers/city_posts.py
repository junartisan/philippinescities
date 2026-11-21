from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import CityPost, CityPostReviewStatus, CityPostType
from app.schemas import CityPostPublicList, CityPostPublicOut

router = APIRouter(prefix="/city-posts", tags=["City blog"])


@router.get("", response_model=CityPostPublicList)
def list_city_posts(
    city_id: int | None = Query(default=None),
    blog_category_id: int | None = Query(default=None),
    post_type: CityPostType | None = Query(default=None, alias="type"),
    search: str | None = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=100),
    db: Session = Depends(get_db),
):
    filters = [
        CityPost.is_published.is_(True),
        CityPost.review_status == CityPostReviewStatus.approved,
    ]
    if city_id is not None:
        filters.append(CityPost.city_id == city_id)
    if blog_category_id is not None:
        filters.append(CityPost.blog_category_id == blog_category_id)
    if post_type is not None:
        filters.append(CityPost.post_type == post_type)
    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(
            or_(CityPost.title.ilike(term), CityPost.summary.ilike(term), CityPost.body.ilike(term))
        )

    total = db.scalar(select(func.count(CityPost.id)).where(*filters)) or 0
    items = (
        db.scalars(
            select(CityPost)
            .options(
                joinedload(CityPost.city),
                joinedload(CityPost.blog_category),
                joinedload(CityPost.author),
                joinedload(CityPost.reviewed_by),
            )
            .where(*filters)
            .order_by(CityPost.published_at.desc(), CityPost.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        .unique()
        .all()
    )
    return CityPostPublicList(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.get("/{slug}", response_model=CityPostPublicOut)
def get_city_post(slug: str, db: Session = Depends(get_db)):
    post = db.scalar(
        select(CityPost)
        .options(
            joinedload(CityPost.city),
            joinedload(CityPost.blog_category),
            joinedload(CityPost.author),
            joinedload(CityPost.reviewed_by),
        )
        .where(
            CityPost.slug == slug,
            CityPost.is_published.is_(True),
            CityPost.review_status == CityPostReviewStatus.approved,
        )
    )
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return post
