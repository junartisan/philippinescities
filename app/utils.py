import re
from html import escape, unescape
from html.parser import HTMLParser
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import CityPost


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
    "code",
    "em",
    "figcaption",
    "figure",
    "h2",
    "h3",
    "h4",
    "hr",
    "img",
    "li",
    "ol",
    "p",
    "pre",
    "s",
    "strong",
    "sub",
    "sup",
    "table",
    "tbody",
    "td",
    "th",
    "thead",
    "tr",
    "u",
    "ul",
}
_VOID_RICH_TEXT_TAGS = {"br", "hr", "img"}
_IGNORED_RICH_TEXT_TAGS = {"script", "style"}
_TAG_ALIASES = {
    "b": "strong",
    "del": "s",
    "h1": "h2",
    "h5": "h3",
    "h6": "h3",
    "i": "em",
    "strike": "s",
}
_ALIGNED_RICH_TEXT_TAGS = {"blockquote", "h2", "h3", "h4", "p"}
_BLOCK_TAGS = {
    "blockquote",
    "figure",
    "h2",
    "h3",
    "h4",
    "hr",
    "ol",
    "p",
    "pre",
    "table",
    "ul",
}
_EMPTY_INLINE_TAG_RE = re.compile(
    r"<(code|em|s|strong|sub|sup|u|a)\b[^>]*>\s*</\1>", re.IGNORECASE
)
_SHORTCODE_CAPTION_RE = re.compile(r"\[caption\b[^\]]*\](.*?)\[/caption\]", re.IGNORECASE | re.DOTALL)
_SHORTCODE_LIST_RE = re.compile(r"\[list\b[^\]]*\](.*?)\[/list\]", re.IGNORECASE | re.DOTALL)
_SHORTCODE_LI_RE = re.compile(
    r"\[li\](.*?)\[/li\](.*?)(?=\[li\]|$)", re.IGNORECASE | re.DOTALL
)
_SHORTCODE_REMOVE_RE = re.compile(r"\[(?:gallery|gs_contact_form)\b[^\]]*\]", re.IGNORECASE)
_HEADING_RE = re.compile(r"<(h2|h3|h4)\b[^>]*>(.*?)</\1>", re.IGNORECASE | re.DOTALL)


def _safe_link(value: str) -> bool:
    candidate = value.strip().lower()
    return candidate.startswith(
        ("http://", "https://", "mailto:", "/", "#")
    )


def _safe_image(value: str) -> bool:
    candidate = value.strip().lower()
    return candidate.startswith(("http://", "https://", "/"))


def validate_city_post_parent(
    db: Session,
    post_id: int | None,
    parent_id: int | None,
) -> str | None:
    if parent_id is None:
        return None
    parent = db.get(CityPost, parent_id)
    if parent is None:
        return "Invalid parent_id"
    if post_id is not None and parent_id == post_id:
        return "A post cannot be its own parent"

    current = parent
    seen = {parent_id}
    for _ in range(50):
        ancestor_id = current.parent_id
        if ancestor_id is None:
            break
        if post_id is not None and ancestor_id == post_id:
            return "Parent selection would create a cycle"
        if ancestor_id in seen:
            break
        seen.add(ancestor_id)
        ancestor = db.get(CityPost, ancestor_id)
        if ancestor is None:
            break
        current = ancestor
    return None


class _RichTextSanitizer(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.ignored_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = _TAG_ALIASES.get(tag.lower(), tag.lower())
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
        elif tag == "img":
            for name, value in attrs:
                name = name.lower()
                if name == "src" and value and _safe_image(value):
                    rendered.append(f'src="{escape(value, quote=True)}"')
                elif name in {"alt", "title", "loading"} and value:
                    rendered.append(f'{name}="{escape(value, quote=True)}"')
                elif name in {"width", "height"} and value and value.isdigit():
                    rendered.append(f'{name}="{value}"')
        elif tag in {"td", "th"}:
            for name, value in attrs:
                name = name.lower()
                if name in {"colspan", "rowspan"} and value and value.isdigit():
                    span = int(value)
                    if 1 <= span <= 20:
                        rendered.append(f'{name}="{span}"')
        if tag in _ALIGNED_RICH_TEXT_TAGS:
            for name, value in attrs:
                if name.lower() != "style" or not value:
                    continue
                align = re.search(
                    r"(?:^|;)\s*text-align\s*:\s*(left|center|right|justify)\b",
                    value,
                    re.IGNORECASE,
                )
                if align:
                    rendered.append(
                        f'style="text-align: {align.group(1).lower()}"'
                    )
        attributes = f" {' '.join(rendered)}" if rendered else ""
        self.parts.append(f"<{tag}{attributes}>")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        if tag.lower() not in _VOID_RICH_TEXT_TAGS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag: str) -> None:
        tag = _TAG_ALIASES.get(tag.lower(), tag.lower())
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
    value = re.sub(r"<!--.*?-->", "", value, flags=re.DOTALL)
    if not _HTML_TAG_RE.search(value):
        return value
    sanitizer = _RichTextSanitizer()
    sanitizer.feed(value)
    sanitizer.close()
    return "".join(sanitizer.parts)


def _normalize_fragment(value: str) -> str:
    value = value.replace("\xa0", " ")
    value = re.sub(r"\s+", " ", value)
    value = re.sub(r"(<[a-zA-Z][^>]*>)\s+", r"\1", value)
    value = re.sub(r"\s+(</[a-zA-Z][^>]*>)", r"\1", value)
    value = _EMPTY_INLINE_TAG_RE.sub("", value)
    return value.strip()


def _inner_html(value: str, tag: str) -> str:
    match = re.match(rf"^<{tag}\b[^>]*>(.*)</{tag}>$", value, re.IGNORECASE | re.DOTALL)
    return match.group(1).strip() if match else value.strip()


def _caption_shortcode(inner: str) -> str:
    image = re.search(r"<img\b[^>]*>", inner, re.IGNORECASE)
    if not image:
        return f"<figure>{inner.strip()}</figure>"
    link_end = inner.find("</a>", image.end())
    split_at = link_end + 4 if link_end >= 0 else image.end()
    media = inner[:split_at].strip()
    caption = inner[split_at:].strip()
    if caption:
        return f"<figure>{media}<figcaption>{caption}</figcaption></figure>"
    return f"<figure>{media}</figure>"


def _list_shortcode(inner: str) -> str:
    entries: list[str] = []
    for part in re.split(r"(?=\[li\])", inner, flags=re.IGNORECASE):
        match = _SHORTCODE_LI_RE.match(part.strip())
        if not match:
            continue
        label = match.group(1).strip()
        detail = match.group(2).strip()
        if detail:
            detail = f" {detail}"
        entries.append(f"<li><strong>{label}</strong>{detail}</li>")
    if not entries:
        return f"<ul><li>{inner.strip()}</li></ul>"
    return "<ul>" + "".join(entries) + "</ul>"


def _convert_wp_shortcodes(value: str) -> str:
    value = _SHORTCODE_CAPTION_RE.sub(lambda match: _caption_shortcode(match.group(1)), value)
    value = _SHORTCODE_LIST_RE.sub(lambda match: _list_shortcode(match.group(1)), value)
    value = _SHORTCODE_REMOVE_RE.sub("", value)
    return value


class _ArticleNormalizer(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.blocks: list[str] = []
        self.inline_parts: list[str] = []
        self.block_parts: list[str] = []
        self.block_stack: list[str] = []
        self.block_tag: str = ""

    def _finish_inline(self) -> None:
        raw = "".join(self.inline_parts)
        self.inline_parts = []
        for part in re.split(r"(?:\n\s*\n|(?:<br\s*/?>){2,})", raw, flags=re.IGNORECASE):
            text = _normalize_fragment(part)
            text = re.sub(r"^(?:<br\s*/?>)+", "", text, flags=re.IGNORECASE)
            text = re.sub(r"(?:<br\s*/?>)+$", "", text, flags=re.IGNORECASE)
            if text:
                self.blocks.append(f"<p>{text}</p>")

    def _finish_block(self, tag: str) -> None:
        raw = "".join(self.block_parts)
        self.block_parts = []
        if not tag:
            return
        text = _normalize_fragment(raw)
        inner = _inner_html(text, tag)
        if tag == "hr":
            self.blocks.append("<hr>")
            return
        if not inner:
            return
        if tag == "blockquote" and "<p" not in inner.lower():
            self.blocks.append(f"<blockquote><p>{inner}</p></blockquote>")
            return
        if tag in {"ul", "ol"} and "<li" not in inner.lower():
            self.blocks.append(f"<p>{inner}</p>")
            return
        self.blocks.append(text)

    def flush(self) -> None:
        self._finish_inline()
        while self.block_stack:
            self.block_parts.append(f"</{self.block_stack[-1]}>")
            self.block_stack.pop()
        if self.block_tag:
            self._finish_block(self.block_tag)
            self.block_tag = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        start = self.get_starttag_text() or f"<{tag}>"
        if self.block_stack:
            self.block_parts.append(start)
            if tag in _BLOCK_TAGS:
                self.block_stack.append(tag)
            return
        if tag in _BLOCK_TAGS:
            self._finish_inline()
            self.block_parts.append(start)
            self.block_stack.append(tag)
            self.block_tag = tag
            return
        self.inline_parts.append(start)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        start = self.get_starttag_text() or f"<{tag}>"
        if self.block_stack:
            self.block_parts.append(start)
        else:
            self.inline_parts.append(start)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if self.block_stack:
            self.block_parts.append(f"</{tag}>")
            if tag == self.block_stack[-1]:
                self.block_stack.pop()
                if not self.block_stack:
                    self._finish_block(self.block_tag)
                    self.block_tag = ""
            return
        if tag in _BLOCK_TAGS:
            return
        self.inline_parts.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        if self.block_stack:
            self.block_parts.append(data)
        else:
            self.inline_parts.append(data)


def normalize_article_html(value: str, title: str = "") -> str:
    sanitized = sanitize_post_body(_convert_wp_shortcodes(value).replace("\xa0", " "))
    normalizer = _ArticleNormalizer()
    normalizer.feed(sanitized)
    normalizer.close()
    normalizer.flush()
    result = "".join(normalizer.blocks)
    result = re.sub(r"<p>\s*</p>", "", result)
    return normalize_article_headings(result.strip(), title)


def plain_text(value: str) -> str:
    text = _HTML_TAG_RE.sub(" ", value)
    return re.sub(r"\s+", " ", unescape(text)).strip()


def clean_heading_text(value: str) -> str:
    text = plain_text(value.replace("\xa0", " ")).strip()
    text = re.sub(r"\s+", " ", text).rstrip(":").strip()
    if text and text[0].islower():
        text = text[0].upper() + text[1:]
    return text


def normalize_article_headings(value: str, title: str = "") -> str:
    def replace_heading(match: re.Match[str]) -> str:
        text = clean_heading_text(match.group(2))
        if not text:
            return ""
        tag = match.group(1).lower()
        return f"<{tag}>{text}</{tag}>"

    result = _HEADING_RE.sub(replace_heading, value)
    result = re.sub(r"<h4\b[^>]*>(.*?)</h4>", r"<h3>\1</h3>", result, flags=re.IGNORECASE | re.DOTALL)

    if not re.search(r"<h2\b", result, re.IGNORECASE):
        for tag in ("h3", "h2"):
            match = re.search(
                rf"<{tag}\b[^>]*>(.*?)</{tag}>", result, re.IGNORECASE | re.DOTALL
            )
            if match:
                text = clean_heading_text(match.group(1))
                if text:
                    result = (
                        result[: match.start()]
                        + f"<h2>{text}</h2>"
                        + result[match.end() :]
                    )
                break

    if not re.search(r"<h[23]\b", result, re.IGNORECASE):
        heading = clean_heading_text(title)
        if heading:
            result = f"<h2>{heading}</h2>{result}"
    return result.strip()


def seo_summary(value: str, title: str = "", limit: int = 160) -> str:
    value = re.sub(r"<h[1-6]\b[^>]*>.*?</h[1-6]>", " ", value, flags=re.IGNORECASE | re.DOTALL)
    text = plain_text(value).replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    if not text and title:
        text = f"Explore {clean_heading_text(title)} on Philippines Cities."
    if not text:
        return ""
    if len(text) <= limit:
        return text if text[-1] in ".!?" else f"{text}."
    cut = text[:limit].rsplit(" ", 1)[0].rstrip(" ,;:-")
    return f"{cut}."


def plain_text_length(value: str) -> int:
    return len(re.sub(r"\s+", "", plain_text(value)))
