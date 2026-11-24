from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_current_active_user
from app.models import (
    CityPost,
    CityPostComment,
    CityPostReviewStatus,
    CityPostType,
    User,
    UserRole,
)
from app.schemas import (
    CityPostBreadcrumbOut,
    CityPostCommentCreate,
    CityPostCommentOut,
    CityPostOptionOut,
    CityPostPublicList,
    CityPostPublicOut,
)

router = APIRouter(prefix="/city-posts", tags=["City blog"])


def _get_published_post(db: Session, slug: str) -> CityPost:
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


def _public_breadcrumbs(db: Session, post: CityPost) -> list[CityPostBreadcrumbOut]:
    chain: list[CityPostBreadcrumbOut] = []
    current: CityPost | None = post
    seen: set[int] = set()
    while current is not None and len(chain) < 10:
        if current.is_published and current.review_status == CityPostReviewStatus.approved:
            chain.append(
                CityPostBreadcrumbOut(
                    id=current.id,
                    title=current.title,
                    slug=current.slug,
                )
            )
        parent_id = current.parent_id
        if parent_id is None or parent_id in seen:
            break
        seen.add(parent_id)
        current = db.get(CityPost, parent_id)
    chain.reverse()
    return chain


def _public_children(db: Session, post: CityPost) -> list[CityPostBreadcrumbOut]:
    children = db.scalars(
        select(CityPost)
        .where(
            CityPost.parent_id == post.id,
            CityPost.is_published.is_(True),
            CityPost.review_status == CityPostReviewStatus.approved,
        )
        .order_by(CityPost.title.asc(), CityPost.id.asc())
        .limit(50)
    ).all()
    return [
        CityPostBreadcrumbOut(id=child.id, title=child.title, slug=child.slug)
        for child in children
    ]


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


@router.get("/parent-options", response_model=list[CityPostOptionOut])
def list_city_post_parent_options(db: Session = Depends(get_db)):
    return db.scalars(
        select(CityPost)
        .where(
            CityPost.is_published.is_(True),
            CityPost.review_status == CityPostReviewStatus.approved,
        )
        .order_by(CityPost.title.asc(), CityPost.id.asc())
        .limit(300)
    ).all()


@router.get("/{slug}", response_model=CityPostPublicOut)
def get_city_post(slug: str, db: Session = Depends(get_db)):
    post = _get_published_post(db, slug)
    result = CityPostPublicOut.model_validate(post)
    result.breadcrumbs = _public_breadcrumbs(db, post)
    result.children = _public_children(db, post)
    return result


@router.get("/{slug}/comments", response_model=list[CityPostCommentOut])
def list_city_post_comments(slug: str, db: Session = Depends(get_db)):
    post = _get_published_post(db, slug)
    return (
        db.scalars(
            select(CityPostComment)
            .options(joinedload(CityPostComment.user))
            .where(CityPostComment.city_post_id == post.id)
            .order_by(CityPostComment.created_at.desc(), CityPostComment.id.desc())
        )
        .unique()
        .all()
    )


@router.post(
    "/{slug}/comments",
    response_model=CityPostCommentOut,
    status_code=status.HTTP_201_CREATED,
)
def create_city_post_comment(
    slug: str,
    payload: CityPostCommentCreate,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    post = _get_published_post(db, slug)
    body = payload.body.strip()
    if not body:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Comment cannot be empty"
        )
    comment = CityPostComment(city_post_id=post.id, user_id=user.id, body=body)
    db.add(comment)
    db.commit()
    return db.scalar(
        select(CityPostComment)
        .options(joinedload(CityPostComment.user))
        .where(CityPostComment.id == comment.id)
    )


@router.delete("/{slug}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_city_post_comment(
    slug: str,
    comment_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    post = _get_published_post(db, slug)
    comment = db.scalar(
        select(CityPostComment).where(
            CityPostComment.id == comment_id,
            CityPostComment.city_post_id == post.id,
        )
    )
    if comment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    if comment.user_id != user.id and user.role not in (
        UserRole.admin,
        UserRole.supervisor,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this comment",
        )
    db.delete(comment)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
