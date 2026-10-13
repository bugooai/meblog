"""API layer for Comments - HTTP handling."""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.comment import CommentCreate, CommentResponse, CommentListResponse
from app.services import CommentService

router = APIRouter(prefix="/comments", tags=["Comments"])


@router.get("/{post_slug}", response_model=CommentListResponse)
async def get_comments(
    post_slug: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Get comments for a post by slug.
    Email field is only visible to admin users.
    """
    return await CommentService.get_comments_service(db, post_slug, request)


@router.post("", response_model=CommentResponse, status_code=201)
async def add_comment(
    comment_data: CommentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Submit a new comment. No login required.
    """
    return await CommentService.add_comment_service(db, comment_data, request)


@router.delete("/{comment_id}", status_code=204)
async def remove_comment(
    comment_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a comment. Only admin users can delete comments.
    """
    await CommentService.remove_comment_service(db, comment_id, request)
    return None
