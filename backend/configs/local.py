from configs.base import BaseSettingsConfig


class LocalSettings(BaseSettingsConfig):
    """Local environment configuration."""

    class Config:
        env_file = ".env.local"
        case_sensitive = True

