from sqlalchemy import inspect
from sqlalchemy.engine import Engine


def ensure_schema(engine: Engine) -> None:
    inspector = inspect(engine)
    timestamp_type = (
        "TIMESTAMP WITH TIME ZONE" if engine.dialect.name == "postgresql" else "DATETIME"
    )
    if "users" not in inspector.get_table_names():
        return

    existing = {column["name"] for column in inspector.get_columns("users")}
    with engine.begin() as connection:
        if "avatar_url" not in existing:
            connection.exec_driver_sql("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500)")
        if "google_id" not in existing:
            connection.exec_driver_sql("ALTER TABLE users ADD COLUMN google_id VARCHAR(255)")
        if "facebook_id" not in existing:
            connection.exec_driver_sql("ALTER TABLE users ADD COLUMN facebook_id VARCHAR(255)")
        if "stripe_customer_id" not in existing:
            connection.exec_driver_sql(
                "ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255)"
            )
        if "email_verified_at" not in existing:
            connection.exec_driver_sql(
                f"ALTER TABLE users ADD COLUMN email_verified_at {timestamp_type}"
            )
        connection.exec_driver_sql(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_id ON users (google_id)"
        )
        connection.exec_driver_sql(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_facebook_id ON users (facebook_id)"
        )
        connection.exec_driver_sql(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_stripe_customer_id "
            "ON users (stripe_customer_id)"
        )
        connection.exec_driver_sql(
            "UPDATE users SET email_verified_at = COALESCE(email_verified_at, created_at) "
            "WHERE email_verified_at IS NULL"
        )

    if "businesses" in inspector.get_table_names():
        existing = {column["name"] for column in inspector.get_columns("businesses")}
        with engine.begin() as connection:
            if "stripe_subscription_id" not in existing:
                connection.exec_driver_sql(
                    "ALTER TABLE businesses ADD COLUMN stripe_subscription_id VARCHAR(255)"
                )
            if "stripe_price_id" not in existing:
                connection.exec_driver_sql(
                    "ALTER TABLE businesses ADD COLUMN stripe_price_id VARCHAR(255)"
                )
            if "subscription_status" not in existing:
                connection.exec_driver_sql(
                    "ALTER TABLE businesses ADD COLUMN subscription_status VARCHAR(32)"
                )
            if "subscription_current_period_end" not in existing:
                connection.exec_driver_sql(
                    "ALTER TABLE businesses ADD COLUMN "
                    f"subscription_current_period_end {timestamp_type}"
                )
            if "manual_paid_until" not in existing:
                connection.exec_driver_sql(
                    "ALTER TABLE businesses ADD COLUMN "
                    f"manual_paid_until {timestamp_type}"
                )
            if "article_access_override" not in existing:
                connection.exec_driver_sql(
                    "ALTER TABLE businesses ADD COLUMN article_access_override VARCHAR(20)"
                )
            if "article_access_notes" not in existing:
                connection.exec_driver_sql(
                    "ALTER TABLE businesses ADD COLUMN article_access_notes VARCHAR(1000)"
                )
            if "featured_until" not in existing:
                connection.exec_driver_sql(
                    "ALTER TABLE businesses ADD COLUMN "
                    f"featured_until {timestamp_type}"
                )
            connection.exec_driver_sql(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_businesses_stripe_subscription_id "
                "ON businesses (stripe_subscription_id)"
            )
            connection.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_businesses_featured_until "
                "ON businesses (featured_until)"
            )

    if "city_posts" in inspector.get_table_names():
        existing = {column["name"] for column in inspector.get_columns("city_posts")}
        columns = {column["name"]: column for column in inspector.get_columns("city_posts")}
        with engine.begin() as connection:
            if "blog_category_id" not in existing:
                connection.exec_driver_sql(
                    "ALTER TABLE city_posts ADD COLUMN blog_category_id INTEGER"
                )
            if columns.get("city_id", {}).get("nullable") is False:
                if engine.dialect.name == "postgresql":
                    connection.exec_driver_sql(
                        "ALTER TABLE city_posts ALTER COLUMN city_id DROP NOT NULL"
                    )
                elif engine.dialect.name == "sqlite":
                    # SQLite cannot alter column nullability in-place; app/schema handles this for fresh DBs.
                    pass
            if "review_status" not in existing:
                connection.exec_driver_sql(
                    "ALTER TABLE city_posts ADD COLUMN review_status VARCHAR(20) "
                    "NOT NULL DEFAULT 'approved'"
                )
            if "review_notes" not in existing:
                connection.exec_driver_sql(
                    "ALTER TABLE city_posts ADD COLUMN review_notes VARCHAR(1000)"
                )
            if "reviewed_by_id" not in existing:
                connection.exec_driver_sql(
                    "ALTER TABLE city_posts ADD COLUMN reviewed_by_id INTEGER"
                )
            if "reviewed_at" not in existing:
                connection.exec_driver_sql(
                    "ALTER TABLE city_posts ADD COLUMN "
                    f"reviewed_at {timestamp_type}"
                )
            if "source_id" not in existing:
                connection.exec_driver_sql(
                    "ALTER TABLE city_posts ADD COLUMN source_id VARCHAR(100)"
                )
            if "source_url" not in existing:
                connection.exec_driver_sql(
                    "ALTER TABLE city_posts ADD COLUMN source_url VARCHAR(500)"
                )
            connection.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_city_posts_source_id "
                "ON city_posts (source_id)"
            )
            connection.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_city_posts_source_url "
                "ON city_posts (source_url)"
            )
            connection.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_city_posts_blog_category_id "
                "ON city_posts (blog_category_id)"
            )
            connection.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_city_posts_review_status "
                "ON city_posts (review_status)"
            )
            connection.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_city_posts_reviewed_by_id "
                "ON city_posts (reviewed_by_id)"
            )

    if "city_post_comments" in inspector.get_table_names():
        with engine.begin() as connection:
            connection.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_city_post_comments_city_post_id "
                "ON city_post_comments (city_post_id)"
            )
            connection.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_city_post_comments_user_id "
                "ON city_post_comments (user_id)"
            )
            connection.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_city_post_comments_created_at "
                "ON city_post_comments (created_at)"
            )

    if "blog_contributor_profiles" in inspector.get_table_names():
        existing = {
            column["name"] for column in inspector.get_columns("blog_contributor_profiles")
        }
        with engine.begin() as connection:
            if "headline" not in existing:
                connection.exec_driver_sql(
                    "ALTER TABLE blog_contributor_profiles ADD COLUMN headline VARCHAR(120)"
                )
            if "bio" not in existing:
                connection.exec_driver_sql(
                    "ALTER TABLE blog_contributor_profiles ADD COLUMN bio VARCHAR(1000)"
                )
            if "credentials" not in existing:
                connection.exec_driver_sql(
                    "ALTER TABLE blog_contributor_profiles ADD COLUMN credentials VARCHAR(1000)"
                )
