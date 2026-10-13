"""
DAO layer for Tag - database CRUD operations.
"""
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Tag, Post, Project
from app.models.tag import post_tags
from app.schemas import TagCreate, TagUpdate
from app.utils.logger import logger
from app.utils.slug import generate_slug


class TagDao:
    """Data Access Object for Tag operations."""

    @staticmethod
    def generate_slug(text: str) -> str:
        """Generate a URL-friendly slug from text."""
        return generate_slug(text, max_length=50)

    @staticmethod
    async def get_tags(
        db: AsyncSession,
        include_hidden_posts: bool = False,
        include_unpublished_posts: bool = False,
        include_hidden_projects: bool = False,
    ):
        """Get all tags with their post counts in a single query."""
        try:
            tags = (await db.execute(select(Tag))).scalars().all()

            if not tags:
                return tags

            tag_ids = [t.id for t in tags]

            post_filters = [Post.is_deleted.is_(False), post_tags.c.tag_id.in_(tag_ids)]
            if not include_unpublished_posts:
                post_filters.append(Post.status == "published")
            if not include_hidden_posts:
                post_filters.append(Post.is_hidden.is_(False))
            if not include_hidden_projects:
                post_filters.append(or_(Post.project_id.is_(None), Project.is_hidden.is_(False)))

            counts = (
                await db.execute(
                    select(post_tags.c.tag_id, func.count(post_tags.c.post_id).label("count"))
                    .join(Post, Post.id == post_tags.c.post_id)
                    .outerjoin(Project, Project.id == Post.project_id)
                    .where(
                        *post_filters,
                    )
                    .group_by(post_tags.c.tag_id)
                )
            ).all()

            count_map = {tag_id: count for tag_id, count in counts}
            for tag in tags:
                tag.post_count = count_map.get(tag.id, 0)

            return tags
        except Exception as e:
            logger.error(f"Error getting tags: {e}")
            raise

    @staticmethod
    async def get_tag_by_id(db: AsyncSession, tag_id: str):
        try:
            return (await db.execute(select(Tag).where(Tag.id == tag_id))).scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error getting tag by ID {tag_id}: {e}")
            raise

    @staticmethod
    async def get_tag_by_slug(db: AsyncSession, slug: str):
        try:
            return (await db.execute(select(Tag).where(Tag.slug == slug))).scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error getting tag by slug {slug}: {e}")
            raise

    @staticmethod
    async def create_tag(db: AsyncSession, tag: TagCreate):
        try:
            existing = (await db.execute(select(Tag).where(Tag.name == tag.name))).scalar_one_or_none()
            if existing:
                raise ValueError("Tag with this name already exists")
            slug = TagDao.generate_slug(tag.name)
            db_tag = Tag(
                name=tag.name,
                slug=slug,
                created_by=tag.created_by,
                updated_by=tag.created_by,
            )
            db.add(db_tag)
            await db.commit()
            await db.refresh(db_tag)
            logger.info(f"Created tag: {db_tag.name} (ID: {db_tag.id})")
            return db_tag
        except Exception as e:
            await db.rollback()
            logger.error(f"Error creating tag: {e}")
            raise

    @staticmethod
    async def update_tag(db: AsyncSession, tag_id: str, tag: TagUpdate):
        try:
            db_tag = await TagDao.get_tag_by_id(db, tag_id)
            if not db_tag:
                return None
            if tag.name is not None:
                existing = (
                    await db.execute(select(Tag).where(Tag.name == tag.name, Tag.id != tag_id))
                ).scalar_one_or_none()
                if existing:
                    raise ValueError("Tag with this name already exists")
                db_tag.name = tag.name
                db_tag.slug = TagDao.generate_slug(tag.name)
            if tag.updated_by is not None:
                db_tag.updated_by = tag.updated_by
            await db.commit()
            await db.refresh(db_tag)
            logger.info(f"Updated tag: {db_tag.name} (ID: {db_tag.id})")
            return db_tag
        except Exception as e:
            await db.rollback()
            logger.error(f"Error updating tag {tag_id}: {e}")
            raise

    @staticmethod
    async def delete_tag(db: AsyncSession, tag_id: str):
        try:
            db_tag = await TagDao.get_tag_by_id(db, tag_id)
            if not db_tag:
                return False
            await db.delete(db_tag)
            await db.commit()
            logger.info(f"Deleted tag: {db_tag.name} (ID: {db_tag.id})")
            return True
        except Exception as e:
            await db.rollback()
            logger.error(f"Error deleting tag {tag_id}: {e}")
            raise