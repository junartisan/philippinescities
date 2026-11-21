import re
from html import escape, unescape
from html.parser import HTMLParser
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session


def slugify(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    return value.strip("-") or "item"


def unique_slug(
    db: Session,
    model: type[Any],
    source: str,
    exclude_id: int | None = None,
) -> str:
    base = slugify(source)
    candidate = base
    counter = 2
    while True:
        stmt = select(model.id).where(model.slug == candidate)
        if exclude_id is not None:
            stmt = stmt.where(model.id != exclude_id)
        if db.scalar(stmt) is None:
            return candidate
        candidate = f"{base}-{counter}"
        counter += 1


_HTML_TAG_RE = re.compile(r"</?[a-zA-Z][^>]*>")
_ALLOWED_RICH_TEXT_TAGS = {
    "a",
    "blockquote",
    "br",
    "em",
    "h2",
    "h3",
    "h4",
    "hr",
    "li",
    "ol",
    "p",
    "strong",
    "u",
    "ul",
}
_VOID_RICH_TEXT_TAGS = {"br", "hr"}
_IGNORED_RICH_TEXT_TAGS = {"script", "style"}


def _safe_link(value: str) -> bool:
    candidate = value.strip().lower()
    return candidate.startswith(
        ("http://", "https://", "mailto:", "/", "#")
    )


class _RichTextSanitizer(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.ignored_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag in _IGNORED_RICH_TEXT_TAGS:
            self.ignored_depth += 1
            return
        if self.ignored_depth or tag not in _ALLOWED_RICH_TEXT_TAGS:
            return
        rendered: list[str] = []
        if tag == "a":
            for name, value in attrs:
                name = name.lower()
                if name == "href" and value and _safe_link(value):
                    rendered.append(f'href="{escape(value, quote=True)}"')
                    rendered.append('rel="noopener noreferrer"')
                    rendered.append('target="_blank"')
                elif name == "title" and value:
                    rendered.append(f'title="{escape(value, quote=True)}"')
        attributes = f" {' '.join(rendered)}" if rendered else ""
        self.parts.append(f"<{tag}{attributes}>")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        if tag.lower() not in _VOID_RICH_TEXT_TAGS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in _IGNORED_RICH_TEXT_TAGS:
            self.ignored_depth = max(0, self.ignored_depth - 1)
            return
        if self.ignored_depth or tag not in _ALLOWED_RICH_TEXT_TAGS:
            return
        if tag not in _VOID_RICH_TEXT_TAGS:
            self.parts.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        if self.ignored_depth:
            return
        self.parts.append(escape(data, quote=False))


def sanitize_post_body(value: str) -> str:
    if not _HTML_TAG_RE.search(value):
        return value
    sanitizer = _RichTextSanitizer()
    sanitizer.feed(value)
    sanitizer.close()
    return "".join(sanitizer.parts)


def plain_text_length(value: str) -> int:
    text = _HTML_TAG_RE.sub(" ", value)
    return len(re.sub(r"\s+", "", unescape(text)))
