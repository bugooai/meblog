"""DAO layer for Post - database CRUD operations."""
import re
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Post, Project, Tag
from app.models.tag import post_tags
from app.schemas import PostCreate, PostUpdate
from app.services.storage import normalize_media_value
from app.utils.logger import logger
from app.utils.slug import generate_unique_slug


class PostDao:
    @staticmethod
    def _normalize_tag_slug(value: str) -> str:
        normalized = value.strip().lower()
        normalized = re.sub(r"[\s_]+", "-", normalized)
        normalized = re.sub(r"-+", "-", normalized)
        return normalized.strip("-")

    @staticmethod
    async def _get_post_with_relations(db: AsyncSession, post_id: str) -> Post | None:
        stmt = (
            select(Post)
            .options(selectinload(Post.project), selectinload(Post.tags))
            .where(Post.id == post_id, Post.is_deleted.is_(False))
        )
        return (await db.execute(stmt)).scalar_one_or_none()

    @staticmethod
    async def get_posts(
        db: AsyncSession,
        page: int = 1,
        size: int = 10,
        project_slug: Optional[str] = None,
        tag_slug: Optional[str] = None,
        q: Optional[str] = None,
        include_unpublished: bool = False,
        include_hidden: bool = False,
    ) -> tuple[list[Post], int]:
        project_join_condition = Post.project_id == Project.id
        filters = [Post.is_deleted.is_(False)]
        if not include_unpublished:
            filters.append(Post.status == "published")
        if not include_hidden:
            filters.extend(
                [
                    Post.is_hidden.is_(False),
                    or_(Post.project_id.is_(None), Project.is_hidden.is_(False)),
                ]
            )
        if q:
            search = f"%{q}%"
            filters.append(or_(Post.title.ilike(search), Post.content.ilike(search)))

        count_stmt = (
            select(func.count(Post.id))
            .select_from(Post)
            .outerjoin(Project, project_join_condition)
            .where(*filters)
        )
        stmt = (
            select(Post)
            .options(
                selectinload(Post.project),
                selectinload(Post.tags),
            )
            .outerjoin(Project, project_join_condition)
            .where(*filters)
            .order_by(Post.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )

        if project_slug:
            count_stmt = count_stmt.where(Project.slug == project_slug)
            stmt = stmt.where(Project.slug == project_slug)
        if tag_slug:
            normalized_tag_slug = PostDao._normalize_tag_slug(tag_slug)
            tag_filters = [Tag.slug == tag_slug]
            if normalized_tag_slug and normalized_tag_slug != tag_slug:
                tag_filters.append(Tag.slug == normalized_tag_slug)
            tagged_post_ids = (
                select(post_tags.c.post_id)
                .join(Tag, Tag.id == post_tags.c.tag_id)
                .where(or_(*tag_filters))
            )
            count_stmt = count_stmt.where(Post.id.in_(tagged_post_ids))
            stmt = stmt.where(Post.id.in_(tagged_post_ids))

        total = (await db.execute(count_stmt)).scalar_one()
        posts = (await db.execute(stmt)).scalars().all()
        return posts, total

    @staticmethod
    async def get_post_by_id(
        db: AsyncSession,
        post_id: str,
        include_unpublished: bool = False,
        include_hidden: bool = False,
    ) -> Post | None:
        stmt = (
            select(Post)
            .options(selectinload(Post.project), selectinload(Post.tags))
            .outerjoin(Project, Post.project_id == Project.id)
            .where(Post.id == post_id, Post.is_deleted.is_(False))
        )
        if not include_unpublished:
            stmt = stmt.where(Post.status == "published")
        if not include_hidden:
            stmt = stmt.where(
                Post.is_hidden.is_(False),
                or_(Post.project_id.is_(None), Project.is_hidden.is_(False)),
            )
        return (await db.execute(stmt)).scalar_one_or_none()

    @staticmethod
    async def get_post_by_slug(
        db: AsyncSession,
        slug: str,
        include_unpublished: bool = False,
        include_hidden: bool = False,
    ) -> Post | None:
        stmt = (
            select(Post)
            .options(selectinload(Post.project), selectinload(Post.tags))
            .outerjoin(Project, Post.project_id == Project.id)
            .where(Post.slug == slug, Post.is_deleted.is_(False))
        )
        if not include_unpublished:
            stmt = stmt.where(Post.status == "published")
        if not include_hidden:
            stmt = stmt.where(
                Post.is_hidden.is_(False),
                or_(Post.project_id.is_(None), Project.is_hidden.is_(False)),
            )
        return (await db.execute(stmt)).scalar_one_or_none()

    @staticmethod
    async def create_post(db: AsyncSession, post: PostCreate, creator_id: str) -> Post:
        slug = await generate_unique_slug(db, post.title)
        db_post = Post(
            title=post.title,
            slug=slug,
            cover=normalize_media_value(post.cover),
            content=post.content,
            summary=post.summary or (post.content[:200] + "..." if len(post.content) > 200 else post.content),
            project_id=post.project_id,
            status=post.status,
            is_hidden=post.is_hidden,
            user_id=creator_id,
            created_by=creator_id,
            updated_by=creator_id,
        )
        if post.tag_ids:
            tags = (await db.execute(select(Tag).where(Tag.id.in_(post.tag_ids)))).scalars().all()
            db_post.tags = tags
        db.add(db_post)
        await db.commit()
        logger.info(f"Created post: {db_post.title} (ID: {db_post.id})")
        return await PostDao._get_post_with_relations(db, db_post.id)

    @staticmethod
    async def update_post(
        db: AsyncSession,
        post_id: str,
        post: PostUpdate,
        updater_id: str,
        include_unpublished: bool = False,
        include_hidden: bool = False,
    ) -> Post | None:
        db_post = await PostDao.get_post_by_id(
            db,
            post_id,
            include_unpublished=include_unpublished,
            include_hidden=include_hidden,
        )
        if not db_post:
            return None

        if post.title is not None:
            db_post.title = post.title
            db_post.slug = await generate_unique_slug(db, post.title, exclude_id=post_id)
        if "cover" in post.model_fields_set:
            db_post.cover = normalize_media_value(post.cover)
        if post.content is not None:
            db_post.content = post.content
        if post.summary is not None:
            db_post.summary = post.summary
        if "project_id" in post.model_fields_set:
            db_post.project_id = post.project_id
        if post.status is not None:
            db_post.status = post.status
        if post.is_hidden is not None:
            db_post.is_hidden = post.is_hidden
        if post.tag_ids is not None:
            tags = (await db.execute(select(Tag).where(Tag.id.in_(post.tag_ids)))).scalars().all()
            db_post.tags = tags
        db_post.updated_by = updater_id

        await db.commit()
        logger.info(f"Updated post: {db_post.title} (ID: {db_post.id})")
        return await PostDao._get_post_with_relations(db, db_post.id)

    @staticmethod
    async def delete_post(db: AsyncSession, post_id: str) -> bool:
        db_post = (await db.execute(select(Post).where(Post.id == post_id))).scalar_one_or_none()
        if not db_post:
            return False
        db_post.is_deleted = True
        await db.commit()
        logger.info(f"Soft deleted post: {db_post.title} (ID: {db_post.id})")
        return True