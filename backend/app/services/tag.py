"""Service layer for Tag - business logic."""
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.models import Admin
from app.schemas import TagCreate, TagUpdate, TagResponse
from app.dao import TagDao


class TagService:
    @staticmethod
    async def list_tags_service(
        db: AsyncSession,
        current_user: Admin | None = None,
        include_hidden: bool = False,
    ) -> List[TagResponse]:
        can_view_hidden = current_user is not None and current_user.is_admin and include_hidden
        return await TagDao.get_tags(
            db,
            include_hidden_posts=can_view_hidden,
            include_unpublished_posts=can_view_hidden,
            include_hidden_projects=can_view_hidden,
        )

    @staticmethod
    async def create_tag_service(
        db: AsyncSession,
        tag: TagCreate,
        current_admin: Admin,
    ) -> TagResponse:
        try:
            tag.created_by = current_admin.id
            return await TagDao.create_tag(db, tag)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    @staticmethod
    async def update_tag_service(
        db: AsyncSession,
        tag_id: str,
        tag: TagUpdate,
        current_admin: Admin,
    ) -> TagResponse:
        try:
            tag.updated_by = current_admin.id
            updated = await TagDao.update_tag(db, tag_id, tag)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        if not updated:
            raise HTTPException(status_code=404, detail="Tag not found")
        return updated

    @staticmethod
    async def delete_tag_service(db: AsyncSession, tag_id: str) -> None:
        success = await TagDao.delete_tag(db, tag_id)
        if not success:
            raise HTTPException(status_code=404, detail="Tag not found")