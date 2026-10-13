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

    class Config:
        case_sensitive = True
        env_file_encoding = "utf-8"
        env_file = None
        extra = "ignore"