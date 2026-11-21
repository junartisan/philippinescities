from math import ceil

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models import Business, Review
from app.schemas import BusinessList, BusinessOut


def business_query():
    average_rating = (
        select(func.coalesce(func.avg(Review.rating), 0.0))
        .where(Review.business_id == Business.id)
        .correlate(Business)
        .scalar_subquery()
    )
    review_count = (
        select(func.count(Review.id))
        .where(Review.business_id == Business.id)
        .correlate(Business)
        .scalar_subquery()
    )
    return (
        select(
            Business,
            average_rating.label("average_rating"),
            review_count.label("review_count"),
        )
        .options(
            joinedload(Business.category),
            joinedload(Business.city),
            joinedload(Business.owner),
        )
    )


def serialize_business(
    business: Business,
    average_rating: float | None = None,
    review_count: int | None = None,
) -> BusinessOut:
    result = BusinessOut.model_validate(business)
    result.average_rating = round(float(average_rating or 0), 2)
    result.review_count = int(review_count or 0)
    return result


def paginate_businesses(
    db: Session,
    stmt,
    filters: list,
    page: int,
    page_size: int,
) -> BusinessList:
    total = db.scalar(select(func.count(Business.id)).where(*filters)) or 0
    rows = db.execute(stmt.offset((page - 1) * page_size).limit(page_size)).unique().all()
    items = [serialize_business(business, avg, count) for business, avg, count in rows]
    pages = ceil(total / page_size) if total else 0
    return BusinessList(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )
