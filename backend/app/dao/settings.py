"""DAO layer for Settings - database CRUD operations."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import SiteSettings
from app.schemas import SiteSettingsUpdate, SeoSettingsUpdate
from app.services.storage import normalize_media_value


class SettingsDao:
    @staticmethod
    async def get_site_settings(db: AsyncSession) -> SiteSettings | None:
        return (await db.execute(select(SiteSettings))).scalar_one_or_none()

    @staticmethod
    async def create_site_settings(db: AsyncSession) -> SiteSettings:
        settings = SiteSettings(
            site_name="技术博客",
            site_logo_url=None,
            site_favicon_url=None,
            site_description="分享技术与生活的个人博客",
            site_keywords="技术,博客,编程,AI",
            default_og_image_url=None,
            wechat_guide_text="扫码关注公众号，获取更多精彩内容",
            wechat_show_on_article=True,
            wechat_show_in_sidebar=True,
            footer_github_url=None,
            beian_icp=None,
        )
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
        return settings

    @staticmethod
    async def update_seo_settings(
        db: AsyncSession,
        settings: SiteSettings,
        payload: SeoSettingsUpdate,
        admin_id: str | None = None,
    ) -> SiteSettings:
        if payload.site_name is not None:
            settings.site_name = payload.site_name
        if payload.site_description is not None:
            settings.site_description = payload.site_description
        if payload.site_keywords is not None:
            settings.site_keywords = payload.site_keywords
        if payload.default_og_image_url is not None:
            settings.default_og_image_url = normalize_media_value(payload.default_og_image_url)
        if admin_id is not None:
            settings.updated_by = admin_id

        await db.commit()
        await db.refresh(settings)
        return settings

    @staticmethod
    async def update_site_settings(
        db: AsyncSession,
        settings: SiteSettings,
        payload: SiteSettingsUpdate,
        admin_id: str | None = None,
    ) -> SiteSettings:
        if payload.site_name is not None:
            settings.site_name = payload.site_name
        if payload.site_logo_url is not None:
            settings.site_logo_url = normalize_media_value(payload.site_logo_url)
        if payload.site_favicon_url is not None:
            settings.site_favicon_url = normalize_media_value(payload.site_favicon_url)
        if payload.wechat_qr_url is not None:
            settings.wechat_qr_url = normalize_media_value(payload.wechat_qr_url)
        if payload.wechat_guide_text is not None:
            settings.wechat_guide_text = payload.wechat_guide_text
        if payload.wechat_show_on_article is not None:
            settings.wechat_show_on_article = payload.wechat_show_on_article
        if payload.wechat_show_in_sidebar is not None:
            settings.wechat_show_in_sidebar = payload.wechat_show_in_sidebar
        if payload.footer_github_url is not None:
            settings.footer_github_url = payload.footer_github_url
        if payload.beian_icp is not None:
            settings.beian_icp = payload.beian_icp
        if admin_id is not None:
            settings.updated_by = admin_id

        await db.commit()
        await db.refresh(settings)
        return settings