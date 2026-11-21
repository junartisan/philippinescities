from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models import Business, City, CityPost, User
from app.schemas import CityCreate, CityOut, CityUpdate
from app.utils import unique_slug

router = APIRouter(prefix="/cities", tags=["Cities"])


@router.get("", response_model=list[CityOut])
def list_cities(
    province: str | None = Query(default=None, max_length=120),
    region: str | None = Query(default=None, max_length=120),
    search: str | None = Query(default=None, max_length=120),
    db: Session = Depends(get_db),
):
    stmt = select(City).order_by(City.name)
    if province:
        stmt = stmt.where(func.lower(City.province) == province.strip().lower())
    if region:
        stmt = stmt.where(func.lower(City.region) == region.strip().lower())
    if search:
        stmt = stmt.where(City.name.ilike(f"%{search.strip()}%"))
    return db.scalars(stmt).all()


@router.get("/{city_id}", response_model=CityOut)
def get_city(city_id: int, db: Session = Depends(get_db)):
    city = db.get(City, city_id)
    if city is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="City not found")
    return city


@router.post("", response_model=CityOut, status_code=status.HTTP_201_CREATED)
def create_city(
    payload: CityCreate,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    name = payload.name.strip()
    province = payload.province.strip() if payload.province else None
    exists = db.scalar(
        select(City.id).where(
            func.lower(City.name) == name.lower(),
            func.coalesce(func.lower(City.province), "") == (province or "").lower(),
        )
    )
    if exists is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="City already exists")

    city = City(
        name=name,
        province=province,
        region=payload.region.strip() if payload.region else None,
        slug=unique_slug(db, City, f"{name} {province or ''}"),
    )
    db.add(city)
    db.commit()
    db.refresh(city)
    return city


@router.patch("/{city_id}", response_model=CityOut)
def update_city(
    city_id: int,
    payload: CityUpdate,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    city = db.get(City, city_id)
    if city is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="City not found")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()
    if "province" in data and data["province"] is not None:
        data["province"] = data["province"].strip()

    new_name = data.get("name", city.name)
    new_province = data.get("province", city.province)
    if "name" in data or "province" in data:
        duplicate = db.scalar(
            select(City.id).where(
                func.lower(City.name) == new_name.lower(),
                func.coalesce(func.lower(City.province), "") == (new_province or "").lower(),
                City.id != city.id,
            )
        )
        if duplicate is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="City already exists")
        data["slug"] = unique_slug(
            db, City, f"{new_name} {new_province or ''}", exclude_id=city.id
        )

    for field, value in data.items():
        setattr(city, field, value)
    db.add(city)
    db.commit()
    db.refresh(city)
    return city


@router.delete("/{city_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_city(
    city_id: int,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    city = db.get(City, city_id)
    if city is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="City not found")
    business_count = db.scalar(select(func.count(Business.id)).where(Business.city_id == city.id))
    if business_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a city that still has businesses",
        )
    post_count = db.scalar(select(func.count(CityPost.id)).where(CityPost.city_id == city.id))
    if post_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a city that still has blog posts",
        )
    db.delete(city)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
