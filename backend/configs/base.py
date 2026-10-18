from pydantic_settings import BaseSettings


class BaseSettingsConfig(BaseSettings):
    """Base configuration class with common settings"""
    
    # Project info
    PROJECT_NAME: str = "Meblog"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Site URL (used for sitemap, RSS feed, SEO)
    SITE_URL: str = "http://localhost:3000"
    
    # Database default (override via backend/.env in real environments)
    DATABASE_URL: str = "sqlite:///./meblog.db"
    TEST_DATABASE_URL: str = "sqlite:///:memory:"
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    # Public self-signup. Keep False in production: with no account yet the
    # first registration still runs so the owner can bootstrap.
    ALLOW_REGISTRATION: bool = False

    # OpenAPI schema (/api/v1/openapi.json) plus the /docs and /redoc UIs that
    # come with it. The document hands out every route, parameter and response
    # shape without authentication, so it stays off unless an environment asks
    # for it explicitly (LocalSettings does).
    EXPOSE_OPENAPI: bool = False
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # CORS
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000"
    
    # Application
    APP_ENV: str = "local"
    FRONTEND_REVALIDATE_URL: str = ""
    FRONTEND_REVALIDATE_TOKEN: str = ""

    # Object storage (OSS)
    OSS_PROVIDER: str = "aliyun_oss"
    OSS_ENDPOINT: str = ""
    OSS_ACCESS_KEY_ID: str = ""
    OSS_ACCESS_KEY_SECRET: str = ""
    OSS_BUCKET: str = ""
    OSS_PUBLIC_BASE_URL: str = ""
    OSS_SIGN_EXPIRE_SECONDS: int = 3600
    # Upload size cap enforced while streaming the request body, so an
    # oversized file cannot exhaust worker memory.
    MAX_UPLOAD_SIZE_MB: int = 20

    class Config:
        case_sensitive = True
        env_file_encoding = "utf-8"
        env_file = None
        extra = "ignore"
