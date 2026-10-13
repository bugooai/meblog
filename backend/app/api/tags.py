"""API layer for Tags - HTTP handling."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from app.database import get_db
from app.schemas import TagCreate, TagUpdate, TagResponse
from app.services import TagService
from app.utils.security import get_current_user
from app.models import Admin

router = APIRouter(prefix="/tags", tags=["Tags"])


@router.get("", response_model=List[TagResponse])
async def list_tags(
    include_hidden: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[Admin] = Depends(get_current_user),
):
    return await TagService.list_tags_service(db, current_user=current_user, include_hidden=include_hidden)


@router.post("", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_new_tag(
    tag: TagCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[Admin] = Depends(get_current_user)
):
    if current_user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await TagService.create_tag_service(db, tag, current_user)


@router.put("/{tag_id}", response_model=TagResponse)
async def update_existing_tag(
    tag_id: str,
    tag: TagUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[Admin] = Depends(get_current_user)
):
    if current_user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await TagService.update_tag_service(db, tag_id, tag, current_user)


@router.delete("/{tag_id}", status_code=204)
async def delete_existing_tag(
    tag_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[Admin] = Depends(get_current_user)
):
    if current_user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    await TagService.delete_tag_service(db, tag_id)
    return None
