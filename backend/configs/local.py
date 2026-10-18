from configs.base import BaseSettingsConfig


class LocalSettings(BaseSettingsConfig):
    """Local environment configuration."""

    # Swagger/OpenAPI is a development convenience: on locally, off everywhere
    # else (see BaseSettingsConfig.EXPOSE_OPENAPI).
    EXPOSE_OPENAPI: bool = True

    class Config:
        env_file = ".env.local"
        case_sensitive = True
