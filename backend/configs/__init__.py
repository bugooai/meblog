import os
from configs.local import LocalSettings
from configs.production import ProductionSettings
from configs.test import TestSettings


def get_setting_class():
    """Get settings based on APP_ENV."""
    app_env = os.getenv("APP_ENV", "local").strip().lower()
    if app_env in {"test", "testing"}:
        return TestSettings
    if app_env in {"prod", "production"}:
        return ProductionSettings
    return LocalSettings


# Default settings instance
settings = get_setting_class()()
