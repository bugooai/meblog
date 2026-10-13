"""DAO layer for About - database CRUD operations."""
import json
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import AuthorProfile, SiteSettings
from app.schemas import AboutUpdate
from app.services.storage import normalize_media_value


class AboutDao:
    @staticmethod
    async def get_author_settings(db: AsyncSession) -> AuthorProfile | None:
        return (await db.execute(select(AuthorProfile))).scalar_one_or_none()

    @staticmethod
    async def create_author_settings(db: AsyncSession, admin_id: str | None = None) -> AuthorProfile:
        settings = AuthorProfile(username="颜如玉", created_by=admin_id, updated_by=admin_id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
        return settings

    @staticmethod
    async def get_site_settings(db: AsyncSession) -> SiteSettings | None:
        return (await db.execute(select(SiteSettings))).scalar_one_or_none()

    @staticmethod
    async def create_site_settings(db: AsyncSession, admin_id: str | None = None) -> SiteSettings:
        settings = SiteSettings(
            wechat_guide_text="扫码关注公众号，获取更多精彩内容",
            wechat_show_on_article=True,
            wechat_show_in_sidebar=True,
            footer_github_url=None,
            beian_icp=None,
            created_by=admin_id,
            updated_by=admin_id,
        )
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
        return settings

    @staticmethod
    async def update_author_settings(
        db: AsyncSession,
        author: AuthorProfile,
        update_data: AboutUpdate,
        admin_id: str | None = None,
    ) -> AuthorProfile:
        if update_data.username is not None:
            author.username = update_data.username
        if update_data.avatar_url is not None:
            author.avatar_url = normalize_media_value(update_data.avatar_url)
        if update_data.avatar_thumb_url is not None:
            author.avatar_thumb_url = normalize_media_value(update_data.avatar_thumb_url)
        if update_data.bio is not None:
            author.bio = update_data.bio
        if update_data.tech_stack is not None:
            author.tech_stack_json = json.dumps(update_data.tech_stack, ensure_ascii=False)
        if update_data.tech_stack_items is not None:
            tech_stack_items = []
            for index, item in enumerate(update_data.tech_stack_items):
                parsed = item.model_dump()
                parsed["background_image_url"] = normalize_media_value(parsed.get("background_image_url"))
                if parsed.get("sort_order") is None:
                    parsed["sort_order"] = index
                tech_stack_items.append(parsed)
            author.tech_stack_json = json.dumps(
                tech_stack_items,
                ensure_ascii=False,
            )
        if update_data.career_timeline is not None:
            author.career_timeline_json = json.dumps(
                [item.model_dump() for item in update_data.career_timeline],
                ensure_ascii=False,
            )
        if update_data.github_url is not None:
            author.github_url = update_data.github_url
        if update_data.zhihu_url is not None:
            author.zhihu_url = update_data.zhihu_url
        if update_data.twitter_url is not None:
            author.twitter_url = update_data.twitter_url
        if update_data.wechat_id is not None:
            author.wechat_id = update_data.wechat_id
        if admin_id is not None:
            author.updated_by = admin_id

        await db.commit()
        await db.refresh(author)
        return author

    @staticmethod
    def parse_tech_stack(author: AuthorProfile) -> list:
        """Parse tech_stack_json field."""
        if author.tech_stack_json:
            try:
                return json.loads(author.tech_stack_json)
            except json.JSONDecodeError:
                pass
        return []

    @staticmethod
    def parse_career_timeline(author: AuthorProfile) -> list:
        """Parse career_timeline_json field."""
        if author.career_timeline_json:
            try:
                return json.loads(author.career_timeline_json)
            except json.JSONDecodeError:
                pass
        return []