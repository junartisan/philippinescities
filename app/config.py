from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Philippines Business Directory API"
    app_version: str = "1.0.0"
    api_prefix: str = "/api"
    environment: str = "development"

    secret_key: str = "change-this-secret-key-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    database_url: str = "sqlite:///./directory.db"
    cors_origins: str = "*"

    admin_email: str | None = None
    admin_password: str | None = None

    backend_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"
    upload_dir: str = "uploads"
    max_cover_image_bytes: int = 5 * 1024 * 1024
    google_client_id: str | None = None
    google_client_secret: str | None = None
    facebook_app_id: str | None = None
    facebook_app_secret: str | None = None
    facebook_graph_version: str = "v23.0"

    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str | None = None
    smtp_from_name: str = "Philippines Cities"
    smtp_use_tls: bool = True
    email_verification_expire_minutes: int = 60 * 24

    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    stripe_price_id: str | None = None
    stripe_featured_price_id: str | None = None
    stripe_currency: str = "php"
    stripe_plan_name: str = "Business article plan"
    stripe_featured_plan_name: str = "Featured listing"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
