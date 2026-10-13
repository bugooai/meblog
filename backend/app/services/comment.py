"""Service layer for Comment - business logic."""
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.models import Comment, Post, Admin
from app.schemas.comment import CommentCreate, CommentResponse, CommentListResponse
from app.dao import CommentDao
from app.services.visitor import VisitorService


class CommentService:
    @staticmethod
    def is_admin(user: Optional[Admin]) -> bool:
        if user is None:
            return False
        return getattr(user, "is_admin", False)

    @staticmethod
    def build_comment_response(
        comment: Comment,
        include_email: bool = False,
        replies_by_parent: dict[str, list[Comment]] | None = None,
    ) -> CommentResponse:
        """Build CommentResponse, optionally including email for admin."""
        raw_replies = replies_by_parent.get(comment.id, []) if replies_by_parent else []
        replies = [
            CommentService.build_comment_response(
                reply,
                include_email=include_email,
                replies_by_parent=replies_by_parent,
            )
            for reply in raw_replies
        ]
        return CommentResponse(
            id=comment.id,
            post_id=comment.post_id,
            parent_id=comment.parent_id,
            nickname=comment.nickname,
            email=comment.email if include_email else None,
            website=comment.website,
            content=comment.content,
            created_at=comment.created_at,
            replies=replies,
        )

    @staticmethod
    async def get_comments_service(
        db: AsyncSession,
        post_slug: str,
        request,
    ) -> CommentListResponse:
        from ..utils.security import get_current_user_from_request
        user = await get_current_user_from_request(request, db)

        comments, replies_by_parent, total = await CommentDao.get_comments_by_post_slug(db, post_slug)
        include_email = CommentService.is_admin(user)
        items = [
            CommentService.build_comment_response(c, include_email, replies_by_parent)
            for c in comments
        ]
        return CommentListResponse(items=items, total=total)

    @staticmethod
    async def add_comment_service(
        db: AsyncSession,
        comment_data: CommentCreate,
        request,
    ) -> CommentResponse:
        post = (
            await db.execute(
                select(Post).where(Post.id == comment_data.post_id, Post.is_deleted.is_(False))
            )
        ).scalar_one_or_none()
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")

        if comment_data.parent_id is not None:
            parent_comment = (
                await db.execute(select(Comment).where(Comment.id == comment_data.parent_id))
            ).scalar_one_or_none()
            if not parent_comment:
                raise HTTPException(status_code=404, detail="Parent comment not found")
            if parent_comment.post_id != comment_data.post_id:
                raise HTTPException(status_code=400, detail="Parent comment belongs to a different post")

        visitor_id = await VisitorService.resolve_visitor_id(db, request)
        comment = await CommentDao.create_comment(db, comment_data, visitor_id)
        # Avoid touching relationship attributes here to prevent async lazy-load in response building.
        return CommentResponse(
            id=comment.id,
            post_id=comment.post_id,
            parent_id=comment.parent_id,
            nickname=comment.nickname,
            email=None,
            website=comment.website,
            content=comment.content,
            created_at=comment.created_at,
            replies=[],
        )

    @staticmethod
    async def remove_comment_service(
        db: AsyncSession,
        comment_id: str,
        request,
    ) -> None:
        from ..utils.security import get_current_user_from_request
        user = await get_current_user_from_request(request, db)
        if not CommentService.is_admin(user):
            raise HTTPException(status_code=403, detail="Not authorized")

        success = await CommentDao.delete_comment(db, comment_id)
        if not success:
            raise HTTPException(status_code=404, detail="Comment not found")