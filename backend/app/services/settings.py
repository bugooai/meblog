"""Service layer for Settings - business logic."""
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas import (
    SiteSettingsResponse,
    SiteSettingsUpdate,
    SeoSettingsResponse,
    SeoSettingsUpdate,
)
from app.models import SiteSettings, Admin
from app.dao import SettingsDao
from app.services.storage import resolve_media_url


class SettingsService:
    @staticmethod
    def _to_seo_settings_response(settings: SiteSettings) -> SeoSettingsResponse:
        return SeoSettingsResponse(
            id=settings.id,
            site_name=settings.site_name or "技术博客",
            site_description=settings.site_description or "分享技术与生活的个人博客",
            site_keywords=settings.site_keywords,
            default_og_image_url=resolve_media_url(settings.default_og_image_url),
        )

    @staticmethod
    def _to_site_settings_response(settings: SiteSettings) -> SiteSettingsResponse:
        return SiteSettingsResponse(
            id=settings.id,
            site_name=settings.site_name or "技术博客",
            site_logo_url=resolve_media_url(settings.site_logo_url),
            site_favicon_url=resolve_media_url(settings.site_favicon_url),
            wechat_qr_url=resolve_media_url(settings.wechat_qr_url),
            wechat_guide_text=settings.wechat_guide_text,
            wechat_show_on_article=settings.wechat_show_on_article,
            wechat_show_in_sidebar=settings.wechat_show_in_sidebar,
            footer_github_url=settings.footer_github_url,
            beian_icp=settings.beian_icp,
        )

    @staticmethod
    async def get_or_create_site_settings(db: AsyncSession) -> SiteSettings:
        settings = await SettingsDao.get_site_settings(db)
        if not settings:
            settings = await SettingsDao.create_site_settings(db)
        return settings

    @staticmethod
    async def get_site_settings_service(db: AsyncSession) -> SiteSettingsResponse:
        settings = await SettingsService.get_or_create_site_settings(db)
        return SettingsService._to_site_settings_response(settings)

    @staticmethod
    async def update_site_settings_service(
        db: AsyncSession,
        payload: SiteSettingsUpdate,
        current_admin: Admin,
    ) -> SiteSettingsResponse:
        try:
            settings = await SettingsService.get_or_create_site_settings(db)
            updated = await SettingsDao.update_site_settings(
                db,
                settings,
                payload,
                admin_id=current_admin.id,
            )
            return SettingsService._to_site_settings_response(updated)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to update site settings: {e}")

    @staticmethod
    async def get_seo_settings_service(db: AsyncSession) -> SeoSettingsResponse:
        settings = await SettingsService.get_or_create_site_settings(db)
        return SettingsService._to_seo_settings_response(settings)

    @staticmethod
    async def update_seo_settings_service(
        db: AsyncSession,
        payload: SeoSettingsUpdate,
        current_admin: Admin,
    ) -> SeoSettingsResponse:
        try:
            settings = await SettingsService.get_or_create_site_settings(db)
            updated = await SettingsDao.update_seo_settings(
                db,
                settings,
                payload,
                admin_id=current_admin.id,
            )
            return SettingsService._to_seo_settings_response(updated)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to update seo settings: {e}")
