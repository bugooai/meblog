from pydantic import BaseModel
from typing import Optional


class SiteSettingsResponse(BaseModel):
    """Public site settings response (no auth required)."""
    id: str
    site_name: str
    site_logo_url: Optional[str] = None
    site_favicon_url: Optional[str] = None
    wechat_qr_url: Optional[str] = None
    wechat_guide_text: str
    wechat_show_on_article: bool
    wechat_show_in_sidebar: bool
    footer_github_url: Optional[str] = None
    beian_icp: Optional[str] = None

    class Config:
        from_attributes = True


class SiteSettingsUpdate(BaseModel):
    """Admin update payload for site settings."""
    site_name: Optional[str] = None
    site_logo_url: Optional[str] = None
    site_favicon_url: Optional[str] = None
    wechat_qr_url: Optional[str] = None
    wechat_guide_text: Optional[str] = None
    wechat_show_on_article: Optional[bool] = None
    wechat_show_in_sidebar: Optional[bool] = None
    footer_github_url: Optional[str] = None
    beian_icp: Optional[str] = None


class SeoSettingsResponse(BaseModel):
    """Public SEO settings response (no auth required)."""
    id: str
    site_name: str
    site_description: str
    site_keywords: Optional[str] = None
    default_og_image_url: Optional[str] = None

    class Config:
        from_attributes = True


class SeoSettingsUpdate(BaseModel):
    """Admin update payload for SEO settings."""
    site_name: Optional[str] = None
    site_description: Optional[str] = None
    site_keywords: Optional[str] = None
    default_og_image_url: Optional[str] = None
