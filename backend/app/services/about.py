"""Service layer for About - business logic."""
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Admin
from app.schemas import AboutResponse, AboutUpdate
from app.dao import AboutDao
from app.services.storage import resolve_media_url


class AboutService:
    @staticmethod
    async def get_or_create_author_settings(db: AsyncSession, admin_id: str | None = None):
        settings = await AboutDao.get_author_settings(db)
        if not settings:
            settings = await AboutDao.create_author_settings(db, admin_id=admin_id)
        return settings

    @staticmethod
    async def get_or_create_site_settings(db: AsyncSession, admin_id: str | None = None):
        settings = await AboutDao.get_site_settings(db)
        if not settings:
            settings = await AboutDao.create_site_settings(db, admin_id=admin_id)
        return settings

    @staticmethod
    async def build_about_response(db: AsyncSession) -> AboutResponse:
        author = await AboutService.get_or_create_author_settings(db)
        site_settings = await AboutService.get_or_create_site_settings(db)
        raw_tech_stack = AboutDao.parse_tech_stack(author)
        raw_career_timeline = AboutDao.parse_career_timeline(author)

        tech_stack_items: list[dict] = []
        if raw_tech_stack:
            if all(isinstance(item, str) for item in raw_tech_stack):
                tech_stack_items = [
                    {
                        "name": item,
                        "summary": None,
                        "sort_order": index,
                        "background_image_url": None,
                    }
                    for index, item in enumerate(raw_tech_stack)
                ]
            elif all(isinstance(item, dict) for item in raw_tech_stack):
                tech_stack_items = [
                    {
                        "name": str(item.get("name") or "").strip(),
                        "summary": str(item.get("summary") or "").strip() or None,
                        "sort_order": (
                            int(item.get("sort_order"))
                            if str(item.get("sort_order") or "").strip().isdigit()
                            else index
                        ),
                        "background_image_url": resolve_media_url(item.get("background_image_url") or item.get("icon_url")),
                    }
                    for index, item in enumerate(raw_tech_stack)
                    if str(item.get("name") or "").strip()
                ]

        tech_stack_items.sort(key=lambda item: item.get("sort_order", 0))
        tech_stack = [item["name"] for item in tech_stack_items]
        career_timeline = [
            {
                "period": str(item.get("period") or "").strip(),
                "title": str(item.get("title") or "").strip(),
                "description": str(item.get("description") or "").strip(),
                "tag": str(item.get("tag") or "").strip() or None,
                "short_tag": (
                    str(item.get("short_tag") or "").strip()
                    or str(item.get("tag") or "").strip()
                    or None
                ),
            }
            for item in raw_career_timeline
            if isinstance(item, dict)
            and str(item.get("period") or "").strip()
            and str(item.get("title") or "").strip()
            and str(item.get("description") or "").strip()
        ]

        return AboutResponse(
            username=author.username,
            avatar_url=resolve_media_url(author.avatar_url),
            avatar_thumb_url=resolve_media_url(author.avatar_thumb_url),
            bio=author.bio,
            tech_stack=tech_stack,
            tech_stack_items=tech_stack_items,
            career_timeline=career_timeline,
            github_url=author.github_url,
            zhihu_url=author.zhihu_url,
            twitter_url=author.twitter_url,
            wechat_id=author.wechat_id,
            wechat_qr_url=resolve_media_url(site_settings.wechat_qr_url),
            wechat_guide_text=site_settings.wechat_guide_text,
        )

    @staticmethod
    async def get_about_service(db: AsyncSession) -> AboutResponse:
        return await AboutService.build_about_response(db)

    @staticmethod
    async def update_about_service(
        db: AsyncSession,
        update_data: AboutUpdate,
        current_admin: Admin,
    ) -> AboutResponse:
        author = await AboutService.get_or_create_author_settings(db, admin_id=current_admin.id)
        await AboutDao.update_author_settings(db, author, update_data, admin_id=current_admin.id)
        return await AboutService.build_about_response(db)