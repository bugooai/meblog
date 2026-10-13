"""
DAO layer for Project - database CRUD operations.
"""
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Project, Post
from app.schemas import ProjectCreate, ProjectUpdate
from app.services.storage import normalize_media_value
from app.utils.slug import generate_slug
from app.utils.logger import logger


class ProjectDao:
    """Data Access Object for Project operations."""

    @staticmethod
    async def get_projects(
        db: AsyncSession,
        include_hidden: bool = False,
        include_hidden_posts: bool = False,
        include_unpublished_posts: bool = False,
    ):
        try:
            post_filters = [Post.project_id == Project.id, Post.is_deleted.is_(False)]
            if not include_unpublished_posts:
                post_filters.append(Post.status == "published")
            if not include_hidden_posts:
                post_filters.append(Post.is_hidden.is_(False))

            stmt = (
                select(Project, func.count(Post.id).label("post_count"))
                .outerjoin(
                    Post,
                    and_(*post_filters),
                )
                .group_by(Project.id)
                .order_by(Project.is_pinned.desc(), Project.sort_order.desc(), Project.created_at.desc())
            )
            if not include_hidden:
                stmt = stmt.where(Project.is_hidden.is_(False))

            projects = (await db.execute(stmt)).all()

            result = []
            for proj, count in projects:
                proj.post_count = count
                result.append(proj)
            return result
        except Exception as e:
            logger.error(f"Error getting projects: {e}")
            raise

    @staticmethod
    async def get_project_by_id(db: AsyncSession, project_id: str):
        try:
            return (await db.execute(select(Project).where(Project.id == project_id))).scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error getting project by ID {project_id}: {e}")
            raise

    @staticmethod
    async def get_project_by_slug(db: AsyncSession, slug: str, include_hidden: bool = False):
        try:
            stmt = select(Project).where(Project.slug == slug)
            if not include_hidden:
                stmt = stmt.where(Project.is_hidden.is_(False))
            return (await db.execute(stmt)).scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error getting project by slug {slug}: {e}")
            raise

    @staticmethod
    async def create_project(db: AsyncSession, project: ProjectCreate):
        try:
            existing = (await db.execute(select(Project).where(Project.name == project.name))).scalar_one_or_none()
            if existing:
                raise ValueError("Project with this name already exists")
            slug = generate_slug(project.name)
            db_project = Project(
                name=project.name,
                slug=slug,
                cover=normalize_media_value(project.cover),
                is_hidden=project.is_hidden,
                is_pinned=project.is_pinned,
                sort_order=project.sort_order,
                created_by=project.created_by,
                updated_by=project.created_by,
            )
            db.add(db_project)
            await db.commit()
            await db.refresh(db_project)
            logger.info(f"Created project: {db_project.name} (ID: {db_project.id})")
            return db_project
        except Exception as e:
            await db.rollback()
            logger.error(f"Error creating project: {e}")
            raise

    @staticmethod
    async def update_project(db: AsyncSession, project_id: str, project: ProjectUpdate):
        try:
            db_project = await ProjectDao.get_project_by_id(db, project_id)
            if not db_project:
                return None
            if project.name is not None:
                existing = (
                    await db.execute(select(Project).where(Project.name == project.name, Project.id != project_id))
                ).scalar_one_or_none()
                if existing:
                    raise ValueError("Project with this name already exists")
                db_project.name = project.name
                db_project.slug = generate_slug(project.name)
            if "cover" in project.model_fields_set:
                db_project.cover = normalize_media_value(project.cover)
            if project.is_hidden is not None:
                db_project.is_hidden = project.is_hidden
            if project.is_pinned is not None:
                db_project.is_pinned = project.is_pinned
            if project.sort_order is not None:
                db_project.sort_order = project.sort_order
            if project.updated_by is not None:
                db_project.updated_by = project.updated_by
            await db.commit()
            await db.refresh(db_project)
            logger.info(f"Updated project: {db_project.name} (ID: {db_project.id})")
            return db_project
        except Exception as e:
            await db.rollback()
            logger.error(f"Error updating project {project_id}: {e}")
            raise

    @staticmethod
    async def delete_project(db: AsyncSession, project_id: str):
        try:
            db_project = await ProjectDao.get_project_by_id(db, project_id)
            if not db_project:
                return False
            post_count = (
                await db.execute(
                    select(func.count(Post.id)).where(
                        Post.project_id == project_id,
                        Post.is_deleted.is_(False),
                    )
                )
            ).scalar_one()
            if post_count > 0:
                raise ValueError("Project has posts, cannot delete")
            await db.delete(db_project)
            await db.commit()
            logger.info(f"Deleted project: {db_project.name} (ID: {db_project.id})")
            return True
        except Exception as e:
            await db.rollback()
            logger.error(f"Error deleting project {project_id}: {e}")
            raise