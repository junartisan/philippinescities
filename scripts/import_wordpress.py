from __future__ import annotations

import argparse
import hashlib
import html
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlparse

import httpx
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.migrations import ensure_schema
from app.models import (
    BlogCategory,
    City,
    CityPost,
    CityPostReviewStatus,
    CityPostType,
    User,
)
from app.seed import seed_directory
from app.utils import (
    normalize_article_html,
    plain_text,
    sanitize_post_body,
    seo_summary,
    slugify,
)

NAMESPACES = {
    "content": "http://purl.org/rss/1.0/modules/content/",
    "dc": "http://purl.org/dc/elements/1.1/",
    "excerpt": "http://wordpress.org/export/1.2/excerpt/",
    "wp": "http://wordpress.org/export/1.2/",
}

IMAGE_EXTENSIONS = {
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

IMG_SRC_RE = re.compile(r"(\bsrc\s*=\s*)([\"'])(.*?)\2", re.IGNORECASE)
SRCSET_RE = re.compile(r"\s+srcset\s*=\s*([\"']).*?\1", re.IGNORECASE)
SOURCE_HOST = "philippinescities.com"
GENERIC_SLUGS = {
    "account",
    "advertise",
    "contact",
    "directory",
    "home",
    "hotels",
    "listings",
    "my-listings",
    "protected",
    "sample-page",
    "signup",
    "tips",
    "top-cities",
}
NON_ARTICLE_TITLES = {
    "advertise",
    "contact",
    "home",
    "hotels",
    "listings",
    "my listings",
    "protected content",
    "sample page",
    "signup",
    "tips",
}


@dataclass
class WordPressItem:
    post_id: str
    post_type: str
    status: str
    title: str
    slug: str
    link: str
    guid: str
    body: str
    excerpt: str
    published_at: datetime
    creator: str
    thumbnail_id: str


@dataclass
class ImportStats:
    found: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0


def _tag(name: str) -> str:
    prefix, local = name.split(":", 1)
    return f"{{{NAMESPACES[prefix]}}}{local}"


def _element_text(element, name: str, default: str = "") -> str:
    target = element.find(_tag(name)) if ":" in name else element.find(name)
    if target is None:
        return default
    return "".join(target.itertext()).strip() or default


def _parse_datetime(value: str) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except ValueError:
        try:
            parsed = parsedate_to_datetime(value)
        except (TypeError, ValueError):
            return datetime.now(timezone.utc)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _first_image_url(body: str) -> str:
    match = IMG_SRC_RE.search(body)
    return html.unescape(match.group(3).strip()) if match else ""


def parse_export(xml_path: Path, post_types: set[str], statuses: set[str]) -> list[WordPressItem]:
    import xml.etree.ElementTree as ET

    root = ET.parse(xml_path).getroot()
    channel = root.find("channel")
    if channel is None:
        raise ValueError("WordPress export has no channel element")

    raw_items = channel.findall("item")
    attachments: dict[str, str] = {}
    for item in raw_items:
        if _element_text(item, "wp:post_type") != "attachment":
            continue
        attachment_id = _element_text(item, "wp:post_id")
        attachment_url = (
            _element_text(item, "attachment_url")
            or _element_text(item, "guid")
            or _element_text(item, "link")
        )
        if attachment_id and attachment_url:
            attachments[attachment_id] = attachment_url

    items: list[WordPressItem] = []
    for item in raw_items:
        item_type = _element_text(item, "wp:post_type", "post")
        item_status = _element_text(item, "wp:status", "publish")
        if item_type not in post_types or item_status not in statuses:
            continue

        title = _element_text(item, "title", "Untitled")
        link = _element_text(item, "link")
        guid = _element_text(item, "guid")
        body = _element_text(item, "content:encoded")
        excerpt = _element_text(item, "excerpt:encoded")
        published_at = _parse_datetime(
            _element_text(item, "wp:post_date_gmt") or _element_text(item, "pubDate")
        )
        items.append(
            WordPressItem(
                post_id=_element_text(item, "wp:post_id"),
                post_type=item_type,
                status=item_status,
                title=title,
                slug=_element_text(item, "wp:post_name") or slugify(title),
                link=link,
                guid=guid,
                body=body,
                excerpt=excerpt,
                published_at=published_at,
                creator=_element_text(item, "dc:creator"),
                thumbnail_id="",
            )
        )

        current = items[-1]
        for meta in item.findall(_tag("wp:postmeta")):
            if _element_text(meta, "wp:meta_key") == "_thumbnail_id":
                current.thumbnail_id = attachments.get(
                    _element_text(meta, "wp:meta_value"), ""
                )

    return items


class ImageImporter:
    def __init__(self, upload_root: Path, backend_url: str, enabled: bool) -> None:
        self.upload_root = upload_root
        self.backend_url = backend_url.rstrip("/")
        self.enabled = enabled
        self.cache: dict[str, str] = {}
        self.client = httpx.Client(
            timeout=20,
            follow_redirects=True,
            headers={"User-Agent": "PhilippinesCitiesImporter/1.0"},
        )

    def close(self) -> None:
        self.client.close()

    def import_url(self, value: str, stem: str) -> str:
        url = html.unescape(value.strip())
        if not url or not self.enabled:
            return url
        if url in self.cache:
            return self.cache[url]
        if url.startswith("/uploads/"):
            self.cache[url] = url
            return url
        if not url.startswith(("http://", "https://")):
            return url

        try:
            response = self.client.get(url)
            response.raise_for_status()
            content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
            extension = IMAGE_EXTENSIONS.get(content_type)
            if not extension and len(response.content) > 1024 * 1024:
                return url
            if not extension:
                suffix = Path(urlparse(url).path).suffix.lower()
                extension = suffix if suffix in {".gif", ".jpg", ".jpeg", ".png", ".webp"} else ".jpg"
            if extension == ".jpeg":
                extension = ".jpg"

            digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:12]
            safe_stem = slugify(stem)[:60] or "image"
            filename = f"{safe_stem}-{digest}{extension}"
            relative = Path("imports") / datetime.now(timezone.utc).strftime("%Y/%m") / filename
            target = self.upload_root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                target.write_bytes(response.content)
            public_url = f"{self.backend_url}/uploads/{relative.as_posix()}"
            self.cache[url] = public_url
            return public_url
        except Exception:
            return url

    def rewrite_body(self, body: str, stem: str) -> str:
        def replace(match: re.Match[str]) -> str:
            original = match.group(3).strip()
            replacement = self.import_url(original, stem)
            return f'{match.group(1)}{match.group(2)}{replacement}{match.group(2)}'

        rewritten = IMG_SRC_RE.sub(replace, body)
        return SRCSET_RE.sub("", rewritten)


def _lookup_city(db: Session, slug_or_name: str) -> City:
    normalized = slug_or_name.strip().lower()
    city = db.scalar(
        select(City).where(
            or_(
                City.slug == normalized,
                City.name.ilike(slug_or_name.strip()),
            )
        )
    )
    if city is None:
        available = ", ".join(c.slug for c in db.scalars(select(City).order_by(City.slug)).all())
        raise ValueError(f"City '{slug_or_name}' not found. Available: {available}")
    return city


def _lookup_category(db: Session, slug_or_name: str) -> BlogCategory:
    normalized = slug_or_name.strip().lower()
    category = db.scalar(
        select(BlogCategory).where(
            or_(
                BlogCategory.slug == normalized,
                BlogCategory.name.ilike(slug_or_name.strip()),
            )
        )
    )
    if category is None:
        available = ", ".join(
            c.slug for c in db.scalars(select(BlogCategory).order_by(BlogCategory.slug)).all()
        )
        raise ValueError(f"Blog category '{slug_or_name}' not found. Available: {available}")
    return category


def _lookup_author(db: Session, email: str | None) -> User | None:
    if not email:
        return None
    return db.scalar(select(User).where(User.email == email.strip().lower()))


def _summary_for(item: WordPressItem, body: str = "") -> str:
    source = sanitize_post_body(item.excerpt) if item.excerpt else body
    return seo_summary(source, item.title)


def _source_identifier(item: WordPressItem, site_host: str) -> str:
    if item.post_id:
        return f"{site_host}:{item.post_id}"[:100]
    return (item.guid or item.link or item.slug)[:100]


def _find_existing(db: Session, source_id: str, source_url: str) -> CityPost | None:
    conditions = []
    if source_id:
        conditions.append(CityPost.source_id == source_id)
    if source_url:
        conditions.append(CityPost.source_url == source_url)
    if not conditions:
        return None
    return db.scalar(select(CityPost).where(or_(*conditions)).order_by(CityPost.id))


def _next_slug(base: str, used_slugs: set[str]) -> str:
    slug = slugify(base)
    candidate = slug
    counter = 2
    while candidate in used_slugs:
        candidate = f"{slug}-{counter}"
        counter += 1
    used_slugs.add(candidate)
    return candidate


def _seo_slug_source(title: str, current_slug: str) -> str:
    slug = slugify(current_slug)
    if not slug or slug in GENERIC_SLUGS:
        return title
    return current_slug


def import_export(
    xml_path: Path,
    db: Session,
    city: City,
    category: BlogCategory,
    author: User | None,
    images: ImageImporter,
    post_types: set[str],
    statuses: set[str],
    limit: int | None,
    skip_existing: bool,
    dry_run: bool = False,
) -> ImportStats:
    items = parse_export(xml_path, post_types, statuses)
    stats = ImportStats(found=len(items))
    channel_link = ""
    try:
        import xml.etree.ElementTree as ET

        channel = ET.parse(xml_path).getroot().find("channel")
        if channel is not None:
            channel_link = _element_text(channel, "link")
    except Exception:
        channel_link = ""
    site_host = urlparse(channel_link or settings.frontend_url).netloc or "wordpress"
    used_slugs = {row[0] for row in db.execute(select(CityPost.slug)).all() if row[0]}

    for item in items[:limit] if limit else items:
        if item.title.strip().lower() in NON_ARTICLE_TITLES:
            stats.skipped += 1
            continue
        source_id = _source_identifier(item, site_host)
        source_url = (item.link or item.guid)[:500] or None
        existing = _find_existing(db, source_id, source_url or "")
        if existing and skip_existing:
            stats.skipped += 1
            continue

        try:
            body = images.rewrite_body(item.body, item.slug or item.title)
            cover_url = ""
            if item.thumbnail_id:
                cover_url = images.import_url(item.thumbnail_id, f"{item.slug}-cover")
            if not cover_url:
                cover_url = _first_image_url(body)
            body = normalize_article_html(body, item.title)
            summary = _summary_for(item, body)
            if not body.strip():
                stats.skipped += 1
                continue

            if dry_run:
                if existing:
                    stats.updated += 1
                else:
                    stats.created += 1
                continue

            if existing:
                existing.title = item.title[:200]
                available_slugs = {slug for slug in used_slugs if slug != existing.slug}
                new_slug = _next_slug(
                    _seo_slug_source(item.title, existing.slug), available_slugs
                )
                if new_slug != existing.slug:
                    existing.slug = new_slug
                    used_slugs.add(new_slug)
                existing.summary = summary or None
                existing.body = body
                existing.cover_image_url = cover_url[:500] or None
                existing.source_id = source_id
                existing.source_url = source_url
                existing.published_at = item.published_at
                existing.is_published = True
                existing.review_status = CityPostReviewStatus.approved
                stats.updated += 1
                target = existing
            else:
                target = CityPost(
                    city_id=city.id,
                    blog_category_id=category.id,
                    author_id=author.id if author else None,
                    title=item.title[:200],
                    slug=_next_slug(_seo_slug_source(item.title, item.slug), used_slugs),
                    summary=summary or None,
                    body=body,
                    cover_image_url=cover_url[:500] or None,
                    source_id=source_id,
                    source_url=source_url,
                    post_type=CityPostType.article,
                    is_published=True,
                    published_at=item.published_at,
                    review_status=CityPostReviewStatus.approved,
                    reviewed_by_id=author.id if author else None,
                    reviewed_at=datetime.now(timezone.utc),
                )
                db.add(target)
                stats.created += 1
        except Exception as exc:
            stats.failed += 1
            print(f"FAILED: {item.title}: {exc}", file=sys.stderr)

    if not dry_run:
        db.commit()
    return stats


def _parse_csv(value: str) -> set[str]:
    return {part.strip().lower() for part in value.split(",") if part.strip()}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Import WordPress XML pages/posts into Philippines Cities city blog posts."
    )
    parser.add_argument("xml_file", type=Path, nargs="?")
    parser.add_argument("--city-slug", default="manila")
    parser.add_argument("--category-slug", default="community-stories")
    parser.add_argument("--author-email", default=settings.admin_email)
    parser.add_argument("--post-types", default="page,post")
    parser.add_argument("--statuses", default="publish")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--skip-existing", action="store_true")
    parser.add_argument("--no-images", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--normalize-existing", action="store_true")
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    ensure_schema(engine)

    if args.normalize_existing:
        with SessionLocal() as db:
            posts = (
                db.query(CityPost)
                .filter(CityPost.source_id.like(f"{SOURCE_HOST}:%"))
                .all()
            )
            used_slugs = {
                row[0]
                for row in db.execute(select(CityPost.slug)).all()
                if row[0]
            }
            normalized = 0
            deleted = 0
            for post in posts:
                if post.title.strip().lower() in NON_ARTICLE_TITLES:
                    db.delete(post)
                    deleted += 1
                    continue
                cleaned = normalize_article_html(post.body or "", post.title)
                if not cleaned.strip():
                    db.delete(post)
                    deleted += 1
                    continue
                changed = False
                if cleaned != post.body:
                    post.body = cleaned
                    changed = True
                summary = seo_summary(cleaned, post.title)
                if summary != (post.summary or ""):
                    post.summary = summary or None
                    changed = True
                available_slugs = {slug for slug in used_slugs if slug != post.slug}
                new_slug = _next_slug(
                    _seo_slug_source(post.title, post.slug), available_slugs
                )
                if new_slug != post.slug:
                    post.slug = new_slug
                    used_slugs.add(new_slug)
                    changed = True
                if changed:
                    normalized += 1
            db.commit()
        print(f"normalized={normalized} deleted_empty={deleted}")
        return 0

    if args.xml_file is None or not args.xml_file.exists():
        print(f"XML file not found: {args.xml_file}", file=sys.stderr)
        return 1

    with SessionLocal() as db:
        seed_directory(db)
        try:
            city = _lookup_city(db, args.city_slug)
            category = _lookup_category(db, args.category_slug)
        except ValueError as exc:
            print(str(exc), file=sys.stderr)
            return 1
        author = _lookup_author(db, args.author_email)

        images = ImageImporter(
            upload_root=Path(settings.upload_dir),
            backend_url=settings.backend_url,
            enabled=not args.no_images and not args.dry_run,
        )
        try:
            stats = import_export(
                xml_path=args.xml_file,
                db=db,
                city=city,
                category=category,
                author=author,
                images=images,
                post_types=_parse_csv(args.post_types),
                statuses=_parse_csv(args.statuses),
                limit=args.limit,
                skip_existing=args.skip_existing,
                dry_run=args.dry_run,
            )
        finally:
            images.close()

    print(
        f"found={stats.found} created={stats.created} "
        f"updated={stats.updated} skipped={stats.skipped} failed={stats.failed}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
