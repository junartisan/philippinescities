from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models import Business, Category, User
from app.schemas import CategoryCreate, CategoryOut, CategoryUpdate
from app.utils import unique_slug

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.scalars(select(Category).order_by(Category.name)).all()


@router.get("/{category_id}", response_model=CategoryOut)
def get_category(category_id: int, db: Session = Depends(get_db)):
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return category


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    name = payload.name.strip()
    exists = db.scalar(select(Category.id).where(func.lower(Category.name) == name.lower()))
    if exists is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category already exists")

    category = Category(
        name=name,
        slug=unique_slug(db, Category, name),
        description=payload.description,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.patch("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    data = payload.model_dump(exclude_unset=True)
    if data.get("name") is not None:
        name = data["name"].strip()
        duplicate = db.scalar(
            select(Category.id).where(
                func.lower(Category.name) == name.lower(),
                Category.id != category.id,
            )
        )
        if duplicate is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category already exists")
        if name != category.name:
            data["slug"] = unique_slug(db, Category, name, exclude_id=category.id)
        data["name"] = name

    for field, value in data.items():
        setattr(category, field, value)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    business_count = db.scalar(
        select(func.count(Business.id)).where(Business.category_id == category.id)
    )
    if business_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a category that still has businesses",
        )
    db.delete(category)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
