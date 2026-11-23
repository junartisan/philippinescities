from __future__ import annotations

import argparse
import json
import mimetypes
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import httpx
from sqlalchemy import select

import sys
ROOT = Path(__file__).resolve().parents[1]
if not (ROOT / "app").is_dir():
    ROOT = Path.cwd()
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.migrations import ensure_schema
from app.models import BlogCategory, City, CityPost, CityPostReviewStatus, CityPostType, User
from app.seed import seed_directory
from app.utils import normalize_article_html, plain_text, sanitize_post_body, seo_summary, slugify

LOCAL_UPLOAD_RE = re.compile(r"https?://(?:localhost|127\.0\.0\.1)(?::\d+)?(/uploads/[^\s\"'<>]+)")


def parse_dt(value: str | None):
    if not value:
        return None
    v = value.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(v)
    except ValueError:
        for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
            try:
                dt = datetime.strptime(v, fmt)
                break
            except ValueError:
                continue
        else:
            return None
    if dt.tzinfo is None:
        from datetime import timezone
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def normalize_status(value: str | None) -> CityPostReviewStatus:
    try:
        return CityPostReviewStatus(value or "approved")
    except ValueError:
        return CityPostReviewStatus.approved


def normalize_type(value: str | None) -> CityPostType:
    try:
        return CityPostType(value or "article")
    except ValueError:
        return CityPostType.article


def rewrite_local_uploads(text: str | None, backend_url: str) -> str | None:
    if not text:
        return text
    return LOCAL_UPLOAD_RE.sub(lambda m: f"{backend_url.rstrip('/')}{m.group(1)}", text)


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def copy_upload(src_uploads: Path, upload_path: str) -> bool:
    rel = upload_path.lstrip("/")
    if not rel.startswith("uploads/"):
        return False
    src = src_uploads.parent / rel
    if not src.exists() or not src.is_file():
        return False
    dest = Path(settings.upload_dir).resolve() / rel.removeprefix("uploads/")
    ensure_parent(dest)
    if not dest.exists():
        dest.write_bytes(src.read_bytes())
    return True


def copy_referenced_uploads(*values: str | None, src_uploads: Path, backend_url: str) -> None:
    for value in values:
        if not value:
            continue
        for match in LOCAL_UPLOAD_RE.finditer(value):
            copy_upload(src_uploads, match.group(1))
        # also handle already-rewritten backend urls
        prefix = backend_url.rstrip("/") + "/uploads/"
        for part in re.findall(re.escape(prefix) + r"[^\s\"'<>]+", value):
            path = "/uploads/" + part[len(prefix):]
            copy_upload(src_uploads, path)


def main() -> int:
    parser = argparse.ArgumentParser(description="Import exported city posts JSON into current DB.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--src-uploads", default=str(ROOT / "uploads"))
    parser.add_argument("--backend-url", default=settings.backend_url)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    payload = json.loads(Path(args.input).read_text(encoding="utf-8"))
    posts = payload.get("posts", [])
    src_uploads = Path(args.src_uploads).resolve()
    backend_url = args.backend_url.rstrip("/")

    Base.metadata.create_all(bind=engine)
    ensure_schema(engine)
    with SessionLocal() as db:
        seed_directory(db)

    created = updated = skipped = failed = 0
    with SessionLocal() as db:
        default_city = db.execute(select(City).order_by(City.id.asc())).scalars().first()
        for item in posts:
            try:
                source_id = (item.get("source_id") or "").strip() or None
                slug = slugify(item.get("slug") or item.get("title") or "post")
                existing = None
                if source_id:
                    existing = db.execute(select(CityPost).where(CityPost.source_id == source_id)).scalar_one_or_none()
                if existing is None:
                    existing = db.execute(select(CityPost).where(CityPost.slug == slug)).scalar_one_or_none()

                city = None
                city_slug = (item.get("city_slug") or "").strip()
                if city_slug:
                    city = db.execute(select(City).where(City.slug == city_slug)).scalar_one_or_none()
                if city is None and item.get("city_id"):
                    city = db.get(City, int(item["city_id"]))
                if city is None:
                    city = default_city
                if city is None:
                    raise ValueError("No city available")

                cat = None
                cat_slug = (item.get("blog_category_slug") or "").strip()
                if cat_slug:
                    cat = db.execute(select(BlogCategory).where(BlogCategory.slug == cat_slug)).scalar_one_or_none()
                if cat is None and item.get("blog_category_id"):
                    cat = db.get(BlogCategory, int(item["blog_category_id"]))

                author = None
                author_email = (item.get("author_email") or "").strip().lower()
                if author_email:
                    author = db.execute(select(User).where(User.email == author_email)).scalar_one_or_none()
                if author is None and item.get("author_id"):
                    author = db.get(User, int(item["author_id"]))

                body = rewrite_local_uploads(item.get("body"), backend_url) or ""
                body = sanitize_post_body(body)
                cover = rewrite_local_uploads(item.get("cover_image_url"), backend_url)
                summary = item.get("summary") or seo_summary(plain_text(normalize_article_html(body)))
                copy_referenced_uploads(body, cover, src_uploads=src_uploads, backend_url=backend_url)

                attrs = dict(
                    city_id=city.id,
                    author_id=author.id if author else None,
                    blog_category_id=cat.id if cat else None,
                    title=(item.get("title") or "Untitled").strip(),
                    slug=slug,
                    summary=summary,
                    body=body,
                    cover_image_url=cover,
                    post_type=normalize_type(item.get("post_type")),
                    event_starts_at=parse_dt(item.get("event_starts_at")),
                    event_ends_at=parse_dt(item.get("event_ends_at")),
                    is_published=bool(item.get("is_published", True)),
                    published_at=parse_dt(item.get("published_at")),
                    review_status=normalize_status(item.get("review_status")),
                    review_notes=item.get("review_notes"),
                    reviewed_by_id=item.get("reviewed_by_id") if item.get("reviewed_by_id") and db.get(User, int(item["reviewed_by_id"])) else None,
                    reviewed_at=parse_dt(item.get("reviewed_at")),
                    source_id=source_id,
                    source_url=item.get("source_url"),
                )

                if existing is None:
                    obj = CityPost(**attrs)
                    db.add(obj)
                    created += 1
                else:
                    for k, v in attrs.items():
                        setattr(existing, k, v)
                    updated += 1

                if not args.dry_run:
                    db.commit()
                else:
                    db.rollback()
            except Exception as exc:
                db.rollback()
                failed += 1
                print(f"FAILED id={item.get('id')} slug={item.get('slug')} err={exc}")
        if args.dry_run:
            print(f"dry_run found={len(posts)} created={created} updated={updated} skipped={skipped} failed={failed}")
        else:
            print(f"found={len(posts)} created={created} updated={updated} skipped={skipped} failed={failed}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
