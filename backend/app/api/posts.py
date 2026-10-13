"""API layer for Posts - HTTP handling."""
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.database import get_db
from app.schemas import PostCreate, PostUpdate, PostResponse, PostListResponse, LikeStatusResponse
from app.services import PostService
from app.utils.security import get_current_user, get_current_admin_user
from app.models import Admin


router = APIRouter(prefix="/posts", tags=["Posts"])


@router.get("", response_model=PostListResponse)
async def list_posts(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    project: Optional[str] = None,
    tag: Optional[str] = None,
    q: Optional[str] = None,
    include_unpublished: bool = Query(False),
    include_hidden: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[Admin] = Depends(get_current_user),
):
    return await PostService.list_posts(
        db,
        page=page,
        size=size,
        project=project,
        tag=tag,
        q=q,
        include_unpublished=include_unpublished,
        include_hidden=include_hidden,
        current_user=current_user,
    )


@router.get("/{id_or_slug}", response_model=PostResponse)
async def get_post(
    id_or_slug: str,
    request: Request,
    include_unpublished: bool = Query(False),
    include_hidden: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[Admin] = Depends(get_current_user)
):
    return await PostService.get_post(
        db,
        id_or_slug,
        request,
        include_unpublished=include_unpublished,
        include_hidden=include_hidden,
        current_user=current_user,
    )


@router.post("", response_model=PostResponse, status_code=201)
async def create_new_post(
    post: PostCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Admin = Depends(get_current_admin_user),
):
    return await PostService.create_post(db, post, current_user)


@router.put("/{post_id}", response_model=PostResponse)
async def update_existing_post(
    post_id: str,
    post: PostUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Admin = Depends(get_current_admin_user),
):
    return await PostService.update_post(db, post_id, post, current_user)


@router.delete("/{post_id}", status_code=204)
async def delete_existing_post(
    post_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Admin = Depends(get_current_admin_user),
):
    await PostService.delete_post(db, post_id, current_user)
    return None


@router.get("/{slug}/like", response_model=LikeStatusResponse)
async def get_like_status(
    slug: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    return await PostService.get_like_status(db, slug, request)


@router.post("/{slug}/like", response_model=LikeStatusResponse)
async def toggle_like(
    slug: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    return await PostService.toggle_like(db, slug, request)