from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import BlogCategory, Category, City, User, UserRole
from app.security import hash_password
from app.utils import unique_slug

DEFAULT_CATEGORIES = [
    ("Restaurants & Cafes", "Dining establishments, coffee shops, and food stalls"),
    ("Hotels & Accommodation", "Hotels, resorts, inns, and transient homes"),
    ("Retail & Shopping", "Stores, boutiques, and shopping centers"),
    ("Health & Medical", "Clinics, hospitals, pharmacies, and laboratories"),
    ("Beauty & Wellness", "Salons, spas, barbershops, and wellness centers"),
    ("Automotive", "Repair shops, dealerships, and car services"),
    ("Education & Training", "Schools, tutorial centers, and training providers"),
    ("Real Estate", "Brokers, developers, and property managers"),
    ("Professional Services", "Legal, accounting, and consulting services"),
    ("Technology", "IT services, software companies, and electronics"),
    ("Entertainment & Leisure", "Cinemas, recreation centers, and event venues"),
    ("Home Services", "Contractors, cleaning, and repair services"),
]

DEFAULT_BLOG_CATEGORIES = [
    ("Local news", "Updates and announcements from around the city"),
    ("City guides", "Practical guides for residents and visitors"),
    ("Food & dining", "Restaurants, cafes, and local flavors"),
    ("Things to do", "Activities, attractions, and weekend ideas"),
    ("Business features", "Profiles of local businesses and entrepreneurs"),
    ("Community stories", "People, places, and stories from the community"),
]

DEFAULT_CITIES = [
    ("Quezon City", "Metro Manila", "National Capital Region"),
    ("Manila", "Metro Manila", "National Capital Region"),
    ("Makati", "Metro Manila", "National Capital Region"),
    ("Pasig", "Metro Manila", "National Capital Region"),
    ("Taguig", "Metro Manila", "National Capital Region"),
    ("Cebu City", "Cebu", "Central Visayas"),
    ("Mandaue", "Cebu", "Central Visayas"),
    ("Lapu-Lapu", "Cebu", "Central Visayas"),
    ("Davao City", "Davao del Sur", "Davao Region"),
    ("Baguio", "Benguet", "Cordillera Administrative Region"),
    ("Iloilo City", "Iloilo", "Western Visayas"),
    ("Bacolod", "Negros Occidental", "Western Visayas"),
    ("Cagayan de Oro", "Misamis Oriental", "Northern Mindanao"),
    ("General Santos", "South Cotabato", "SOCCSKSARGEN"),
    ("Dagupan", "Pangasinan", "Ilocos Region"),
    ("Naga", "Camarines Sur", "Bicol Region"),
    ("Tacloban", "Leyte", "Eastern Visayas"),
    ("Zamboanga City", "Zamboanga del Sur", "Zamboanga Peninsula"),
]


def seed_directory(db: Session) -> None:
    for name, description in DEFAULT_CATEGORIES:
        exists = db.scalar(
            select(Category.id).where(func.lower(Category.name) == name.lower())
        )
        if exists is None:
            db.add(
                Category(
                    name=name,
                    slug=unique_slug(db, Category, name),
                    description=description,
                )
            )
    for name, description in DEFAULT_BLOG_CATEGORIES:
        exists = db.scalar(
            select(BlogCategory.id).where(
                func.lower(BlogCategory.name) == name.lower()
            )
        )
        if exists is None:
            db.add(
                BlogCategory(
                    name=name,
                    slug=unique_slug(db, BlogCategory, name),
                    description=description,
                )
            )
    for name, province, region in DEFAULT_CITIES:
        exists = db.scalar(
            select(City.id).where(
                func.lower(City.name) == name.lower(),
                func.coalesce(func.lower(City.province), "") == province.lower(),
            )
        )
        if exists is None:
            db.add(
                City(
                    name=name,
                    province=province,
                    region=region,
                    slug=unique_slug(db, City, f"{name} {province}"),
                )
            )
    db.commit()


def bootstrap_admin(db: Session) -> None:
    if not settings.admin_email or not settings.admin_password:
        return
    email = settings.admin_email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(
            email=email,
            hashed_password=hash_password(settings.admin_password),
            full_name="Administrator",
            role=UserRole.admin,
        )
        db.add(user)
    elif user.role != UserRole.admin:
        user.role = UserRole.admin
    db.commit()
