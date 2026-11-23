from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / "directory.db"
DEFAULT_OUT = ROOT / "deploy" / "city-posts-export.json"


def main() -> int:
    parser = argparse.ArgumentParser(description="Export local city_posts to JSON for production import.")
    parser.add_argument("--db", default=str(DEFAULT_DB))
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    args = parser.parse_args()

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT
          p.*,
          c.slug AS city_slug,
          bc.slug AS blog_category_slug,
          u.email AS author_email
        FROM city_posts p
        LEFT JOIN cities c ON c.id = p.city_id
        LEFT JOIN blog_categories bc ON bc.id = p.blog_category_id
        LEFT JOIN users u ON u.id = p.author_id
        ORDER BY p.id ASC
        """
    ).fetchall()
    posts = []
    for row in rows:
        post = dict(row)
        for key in ("is_published",):
            if key in post and post[key] is not None:
                post[key] = bool(post[key])
        posts.append(post)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"posts": posts}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"exported={len(posts)} out={out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
