from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.migrations import ensure_schema
from app.routers import (
    admin,
    articles,
    auth,
    billing,
    blog_categories,
    businesses,
    categories,
    cities,
    city_posts,
    claims,
    contributors,
    featured,
    invitations,
    reviews,
    uploads,
)
from app.seed import bootstrap_admin, seed_directory

Base.metadata.create_all(bind=engine)
ensure_schema(engine)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_schema(engine)
    with SessionLocal() as db:
        seed_directory(db)
        bootstrap_admin(db)
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Business directory API for the Philippines. Users can register, browse listings "
        "by category and city, submit businesses, claim existing listings (admin approved), "
        "and leave reviews."
    ),
    lifespan=lifespan,
    openapi_tags=[
        {"name": "Authentication", "description": "Registration, login, and profile updates"},
        {"name": "Categories", "description": "Directory categories"},
        {"name": "Cities", "description": "Cities where listings are located"},
        {"name": "Businesses", "description": "Listings, ownership, and directory browsing"},
        {"name": "Claims", "description": "Claim ownership of existing listings"},
        {"name": "Business invitations", "description": "Brand and branch team invitations"},
        {"name": "Reviews", "description": "Reviews from registered users"},
        {"name": "Articles", "description": "Business updates, products, promos, and events"},
        {"name": "City blog", "description": "Admin-published city articles and events"},
        {"name": "Contributors", "description": "Approved blog contributors and their submissions"},
        {"name": "Uploads", "description": "Cover image uploads for articles and city blog posts"},
        {"name": "Featured listings", "description": "Paid featured placements for approved business listings"},
        {"name": "Billing", "description": "Paid listing subscriptions via Stripe, cash, or bank transfer"},
        {"name": "Admin", "description": "Moderation and approval workflows"},
        {"name": "Health", "description": "Service health checks"},
    ],
)

upload_directory = Path(settings.upload_dir)
upload_directory.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_directory), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (
    auth,
    categories,
    cities,
    businesses,
    claims,
    invitations,
    reviews,
    articles,
    blog_categories,
    city_posts,
    contributors,
    featured,
    uploads,
    billing,
    admin,
):
    app.include_router(router.router, prefix=settings.api_prefix)
app.include_router(blog_categories.admin_router, prefix=settings.api_prefix)


@app.get("/", tags=["Health"])
def root():
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "health": f"{settings.api_prefix}/health",
    }


@app.get(f"{settings.api_prefix}/health", tags=["Health"])
def health():
    return {"status": "ok"}
