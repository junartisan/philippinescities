from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models import Business, BusinessStatus, Category, User
from app.schemas import CategoryCreate, CategoryOut, CategoryUpdate
from app.utils import unique_slug

router = APIRouter(prefix="/categories", tags=["Categories"])


def _validate_parent(
    db: Session,
    parent_id: int | None,
    category_id: int | None = None,
) -> None:
    if parent_id is None:
        return
    if parent_id == category_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A category cannot be its own parent",
        )
    parent = db.get(Category, parent_id)
    if parent is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid parent_id")
    if parent.parent_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Categories support one level of subcategories only",
        )


def _category_out(
    category: Category,
    categories: list[Category],
    counts: dict[int, int],
    child_counts: Counter[int],
) -> CategoryOut:
    total = counts.get(category.id, 0)
    for child in categories:
        if child.parent_id == category.id:
            total += counts.get(child.id, 0)
    result = CategoryOut.model_validate(category)
    result.business_count = total
    result.child_count = child_counts.get(category.id, 0)
    return result


def _list_out(db: Session, categories: list[Category]) -> list[CategoryOut]:
    by_id = {category.id: category for category in categories}
    counts = dict(
        db.execute(
            select(Business.category_id, func.count(Business.id))
            .where(Business.status == BusinessStatus.approved)
            .group_by(Business.category_id)
        ).all()
    )
    child_counts = Counter(
        category.parent_id for category in categories if category.parent_id is not None
    )

    def sort_key(category: Category) -> tuple[int, str, str]:
        parent = by_id.get(category.parent_id) if category.parent_id else None
        group = (parent or category).name.lower()
        return (0 if category.parent_id is None else 1, group, category.name.lower())

    ordered = sorted(categories, key=sort_key)
    return [_category_out(item, categories, counts, child_counts) for item in ordered]


def _single_out(db: Session, category: Category, categories: list[Category]) -> CategoryOut:
    return next(item for item in _list_out(db, categories) if item.id == category.id)


@router.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return _list_out(db, db.scalars(select(Category)).all())


@router.get("/slug/{slug}", response_model=CategoryOut)
def get_category_by_slug(slug: str, db: Session = Depends(get_db)):
    categories = db.scalars(select(Category)).all()
    category = next((item for item in categories if item.slug == slug), None)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return _single_out(db, category, categories)


@router.get("/{category_id}", response_model=CategoryOut)
def get_category(category_id: int, db: Session = Depends(get_db)):
    categories = db.scalars(select(Category)).all()
    category = next((item for item in categories if item.id == category_id), None)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return _single_out(db, category, categories)


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
    _validate_parent(db, payload.parent_id)

    category = Category(
        name=name,
        slug=unique_slug(db, Category, name),
        description=payload.description,
        parent_id=payload.parent_id,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return get_category(category.id, db)


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
    if "parent_id" in data:
        _validate_parent(db, data["parent_id"], category_id)
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
    return get_category(category.id, db)


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
    child_count = db.scalar(
        select(func.count(Category.id)).where(Category.parent_id == category.id)
    )
    if child_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a category that still has subcategories",
        )
    db.delete(category)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
