from configs.base import BaseSettingsConfig


class TestSettings(BaseSettingsConfig):
    """Test environment configuration"""
    
    class Config:
        env_file = ".env.test"
        case_sensitive = True
