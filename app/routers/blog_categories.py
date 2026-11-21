from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models import BlogCategory, CityPost, User
from app.schemas import BlogCategoryCreate, BlogCategoryOut, BlogCategoryUpdate
from app.utils import unique_slug

router = APIRouter(prefix="/blog-categories", tags=["City blog"])
admin_router = APIRouter(prefix="/admin/blog-categories", tags=["Admin"])


@router.get("", response_model=list[BlogCategoryOut])
def list_blog_categories(db: Session = Depends(get_db)):
    return db.scalars(select(BlogCategory).order_by(BlogCategory.name)).all()


@router.get("/slug/{slug}", response_model=BlogCategoryOut)
def get_blog_category_by_slug(slug: str, db: Session = Depends(get_db)):
    category = db.scalar(select(BlogCategory).where(BlogCategory.slug == slug))
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blog category not found",
        )
    return category


@admin_router.get("", response_model=list[BlogCategoryOut])
def list_blog_categories_admin(
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return db.scalars(select(BlogCategory).order_by(BlogCategory.name)).all()


@admin_router.post("", response_model=BlogCategoryOut, status_code=status.HTTP_201_CREATED)
def create_blog_category(
    payload: BlogCategoryCreate,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    name = payload.name.strip()
    exists = db.scalar(
        select(BlogCategory.id).where(func.lower(BlogCategory.name) == name.lower())
    )
    if exists is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Blog category already exists",
        )

    category = BlogCategory(
        name=name,
        slug=unique_slug(db, BlogCategory, name),
        description=payload.description.strip() if payload.description else None,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@admin_router.patch("/{category_id}", response_model=BlogCategoryOut)
def update_blog_category(
    category_id: int,
    payload: BlogCategoryUpdate,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    category = db.get(BlogCategory, category_id)
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blog category not found",
        )

    data = payload.model_dump(exclude_unset=True)
    if data.get("name") is not None:
        name = data["name"].strip()
        duplicate = db.scalar(
            select(BlogCategory.id).where(
                func.lower(BlogCategory.name) == name.lower(),
                BlogCategory.id != category.id,
            )
        )
        if duplicate is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Blog category already exists",
            )
        if name != category.name:
            data["slug"] = unique_slug(
                db, BlogCategory, name, exclude_id=category.id
            )
        data["name"] = name
    if "description" in data:
        data["description"] = (
            data["description"].strip() if data["description"] else None
        )

    for field, value in data.items():
        setattr(category, field, value)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@admin_router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_blog_category(
    category_id: int,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    category = db.get(BlogCategory, category_id)
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blog category not found",
        )
    post_count = db.scalar(
        select(func.count(CityPost.id)).where(
            CityPost.blog_category_id == category.id
        )
    )
    if post_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a blog category that still has posts",
        )
    db.delete(category)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
