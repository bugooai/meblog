"""
Service layer for Project - business logic.
"""
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.models import Admin
from app.schemas import ProjectCreate, ProjectUpdate, ProjectResponse
from app.dao import ProjectDao
from app.utils.logger import logger


class ProjectService:
    """Service class for Project business logic."""
    
    @staticmethod
    async def list_projects(
        db: AsyncSession,
        current_user: Admin | None = None,
        include_hidden: bool = False,
    ) -> List[ProjectResponse]:
        try:
            can_view_hidden = current_user is not None and current_user.is_admin and include_hidden
            projects = await ProjectDao.get_projects(
                db,
                include_hidden=can_view_hidden,
                include_hidden_posts=can_view_hidden,
                include_unpublished_posts=can_view_hidden,
            )
            return projects
        except Exception as e:
            logger.error(f"Error listing projects: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    @staticmethod
    async def get_project_by_slug(
        db: AsyncSession,
        slug: str,
        current_user: Admin | None = None,
        include_hidden: bool = False,
    ) -> ProjectResponse:
        try:
            can_view_hidden = current_user is not None and current_user.is_admin and include_hidden
            project = await ProjectDao.get_project_by_slug(db, slug, include_hidden=can_view_hidden)
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")
            return project
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting project by slug {slug}: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    @staticmethod
    async def create_project(
        db: AsyncSession,
        project: ProjectCreate,
        current_admin: Admin,
    ) -> ProjectResponse:
        try:
            project.created_by = current_admin.id
            return await ProjectDao.create_project(db, project)
        except ValueError as e:
            logger.warning(f"Validation error creating project: {e}")
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            logger.error(f"Error creating project: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    @staticmethod
    async def update_project(
        db: AsyncSession,
        project_id: str,
        project: ProjectUpdate,
        current_admin: Admin,
    ) -> ProjectResponse:
        try:
            project.updated_by = current_admin.id
            updated = await ProjectDao.update_project(db, project_id, project)
            if not updated:
                raise HTTPException(status_code=404, detail="Project not found")
            return updated
        except ValueError as e:
            logger.warning(f"Validation error updating project {project_id}: {e}")
            raise HTTPException(status_code=400, detail=str(e))
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating project {project_id}: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    @staticmethod
    async def delete_project(db: AsyncSession, project_id: str) -> None:
        try:
            success = await ProjectDao.delete_project(db, project_id)
            if not success:
                raise HTTPException(status_code=404, detail="Project not found")
        except ValueError as e:
            logger.warning(f"Validation error deleting project {project_id}: {e}")
            raise HTTPException(status_code=400, detail=str(e))
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting project {project_id}: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")