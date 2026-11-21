from pathlib import Path

from app.database import SessionLocal
from app.models import BlogCategory, City, CityPost, CityPostReviewStatus
from app.utils import normalize_article_html, sanitize_post_body, seo_summary
from scripts.import_wordpress import ImageImporter, _seo_slug_source, import_export


WXR = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
  xmlns:wp="http://wordpress.org/export/1.2/">
  <channel>
    <title>Old Site</title>
    <link>https://old.example</link>
    <item>
      <title>Imported City Guide</title>
      <link>https://old.example/imported-city-guide</link>
      <wp:post_id>101</wp:post_id>
      <wp:post_name>imported-city-guide</wp:post_name>
      <wp:post_type>page</wp:post_type>
      <wp:status>publish</wp:status>
      <wp:post_date_gmt>2025-01-02 03:04:05</wp:post_date_gmt>
      <content:encoded><![CDATA[<p>Hello <a href="https://example.com">world</a>.</p><p onclick="bad()">Safe text.</p>]]></content:encoded>
      <excerpt:encoded><![CDATA[A short imported summary.]]></excerpt:encoded>
    </item>
  </channel>
</rss>
"""


def test_sanitize_post_body_allows_safe_images_and_blocks_handlers():
    body = (
        '<figure><img src="https://images.example/a.jpg" alt="A city" '
        'onerror="alert(1)" width="640" /><figcaption>A caption</figcaption></figure>'
    )
    result = sanitize_post_body(body)

    assert '<img src="https://images.example/a.jpg"' in result
    assert 'alt="A city"' in result
    assert 'width="640"' in result
    assert "<figure>" in result
    assert "<figcaption>A caption</figcaption>" in result
    assert "onerror" not in result


def test_normalize_article_html_removes_wordpress_heading_code():
    body = (
        '<!-- wp:gutenbee/heading {"uniqueId":"a5641f-3240-48"} -->'
        '<h1 id="block-a5641f-3240-48" class="wp-block-gutenbee-heading" '
        'style="color:#ffffff">History</h1>'
        '<style>.wp-block-gutenbee-heading.block-a5641f-3240-48 { padding: 10px; }</style>'
        "<!-- /wp:gutenbee/heading -->\n\n"
        "Plain text with\xa0space.\n\n"
        '<img class="wp-image-269 alignleft" src="https://images.example/map.png" alt="Map">\n\n'
        "<!-- wp:paragraph --><p>Hi <em></em>there.</p><!-- /wp:paragraph -->"
    )

    result = normalize_article_html(body)

    assert "<h2>History</h2>" in result
    assert "<p>Plain text with space.</p>" in result
    assert '<p><img src="https://images.example/map.png" alt="Map"></p>' in result
    assert "<p>Hi there.</p>" in result
    assert "wp:" not in result
    assert "wp-block" not in result
    assert "wp-image" not in result
    assert "<style" not in result
    assert "style=" not in result
    assert "id=" not in result
    assert "\xa0" not in result


def test_normalize_article_html_removes_comment_only_wp_code():
    result = normalize_article_html(
        "<!--wp:paragraph -->Hello<!-- /wp:paragraph --><!--more-->"
    )
    assert result == "<p>Hello</p>"


def test_normalize_article_html_adds_seo_heading_from_title():
    result = normalize_article_html("<p>Ilagan is the capital of Isabela.</p>", "Ilagan City, Isabela")

    assert result.startswith("<h2>Ilagan City, Isabela</h2>")
    assert result.endswith("<p>Ilagan is the capital of Isabela.</p>")


def test_normalize_article_html_promotes_first_heading_to_h2():
    result = normalize_article_html("<h4> history: </h4><p>Old content.</p>", "Ilagan City")

    assert result.startswith("<h2>History</h2>")
    assert "<h4" not in result
    assert "<h3" not in result


def test_seo_summary_and_slug_source():
    summary = seo_summary("<p>A short city guide.</p>", "City Guide")

    assert summary == "A short city guide."
    assert seo_summary("<h2>History</h2><p>Santiago was founded in 1686.</p>") == (
        "Santiago was founded in 1686."
    )
    assert _seo_slug_source("Legazpi City Directory", "directory") == "Legazpi City Directory"
    assert _seo_slug_source("Ilagan City, Isabela", "ilagan-city-isabela") == "ilagan-city-isabela"


def test_normalize_article_html_converts_shortcodes_and_keeps_blocks_well_formed():
    body = (
        '[list style="style5"]\n'
        "[li]Children's Playground[/li] - Fun for kids.\n"
        "[li]Burnham Lagoon[/li] - Boats for hire.\n"
        "[/list]\n\n"
        '[caption id="attachment_1" align="alignright" width="300"]'
        '<img src="https://images.example/park.jpg" alt="Park" /> Park view[/caption]\n\n'
        "<blockquote>\n<p>Quoted text.</p>\n</blockquote>"
    )

    result = normalize_article_html(body)

    assert "<ul>" in result
    assert "<li><strong>Children's Playground</strong> - Fun for kids.</li>" in result
    assert "<li><strong>Burnham Lagoon</strong> - Boats for hire.</li>" in result
    assert '<figure><img src="https://images.example/park.jpg" alt="Park"><figcaption>Park view</figcaption></figure>' in result
    assert result.count("<blockquote><p>Quoted text.</p></blockquote>") == 1
    assert "[list" not in result
    assert "[li]" not in result
    assert "[caption" not in result


def test_import_wordpress_pages_into_city_blog(client, tmp_path: Path):
    xml_path = tmp_path / "export.xml"
    xml_path.write_text(WXR)

    with SessionLocal() as db:
        db.query(CityPost).filter(CityPost.source_id.like("old.example:%")).delete(
            synchronize_session=False
        )
        db.commit()
        city = db.query(City).filter(City.name == "Manila").one()
        category = db.query(BlogCategory).filter(BlogCategory.slug == "community-stories").one()
        images = ImageImporter(
            upload_root=tmp_path,
            backend_url="https://api.example",
            enabled=False,
        )
        try:
            stats = import_export(
                xml_path=xml_path,
                db=db,
                city=city,
                category=category,
                author=None,
                images=images,
                post_types={"page"},
                statuses={"publish"},
                limit=None,
                skip_existing=False,
            )
        finally:
            images.close()

        assert stats.found == 1
        assert stats.created == 1

        post = db.query(CityPost).filter(CityPost.source_id == "old.example:101").one()
        assert post.title == "Imported City Guide"
        assert post.slug == "imported-city-guide"
        assert post.summary == "A short imported summary."
        assert 'href="https://example.com"' in post.body
        assert "onclick" not in post.body
        assert post.is_published is True
        assert post.review_status == CityPostReviewStatus.approved
        assert post.published_at.year == 2025


def test_import_wordpress_can_skip_existing_posts(client, tmp_path: Path):
    xml_path = tmp_path / "export.xml"
    xml_path.write_text(WXR)

    with SessionLocal() as db:
        db.query(CityPost).filter(CityPost.source_id.like("old.example:%")).delete(
            synchronize_session=False
        )
        db.commit()
        city = db.query(City).filter(City.name == "Manila").one()
        category = db.query(BlogCategory).filter(BlogCategory.slug == "community-stories").one()
        images = ImageImporter(
            upload_root=tmp_path,
            backend_url="https://api.example",
            enabled=False,
        )
        try:
            first = import_export(
                xml_path=xml_path,
                db=db,
                city=city,
                category=category,
                author=None,
                images=images,
                post_types={"page"},
                statuses={"publish"},
                limit=None,
                skip_existing=False,
            )
            second = import_export(
                xml_path=xml_path,
                db=db,
                city=city,
                category=category,
                author=None,
                images=images,
                post_types={"page"},
                statuses={"publish"},
                limit=None,
                skip_existing=True,
            )
        finally:
            images.close()

        assert first.created == 1
        assert second.found == 1
        assert second.skipped == 1
        assert second.created == 0
