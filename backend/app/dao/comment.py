"""DAO layer for Comment - database CRUD operations."""
from typing import List, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Comment, Post
from app.schemas.comment import CommentCreate


class CommentDao:
    @staticmethod
    async def get_comments_by_post_slug(db: AsyncSession, post_slug: str) -> Tuple[List[Comment], dict[str, list[Comment]], int]:
        post = (
            await db.execute(
                select(Post).where(Post.slug == post_slug, Post.is_deleted.is_(False))
            )
        ).scalar_one_or_none()
        if not post:
            return [], 0

        top_comments = (
            await db.execute(
                select(Comment)
                .where(Comment.post_id == post.id, Comment.parent_id.is_(None))
                .order_by(Comment.created_at.desc())
            )
        ).scalars().all()
        top_ids = [c.id for c in top_comments]
        replies_by_parent: dict[str, list[Comment]] = {}
        if top_ids:
            replies = (
                await db.execute(
                    select(Comment)
                    .where(Comment.parent_id.in_(top_ids))
                    .order_by(Comment.created_at.asc())
                )
            ).scalars().all()
            for reply in replies:
                replies_by_parent.setdefault(reply.parent_id, []).append(reply)

        total = len(top_comments) + sum(len(items) for items in replies_by_parent.values())
        return top_comments, replies_by_parent, total

    @staticmethod
    async def create_comment(db: AsyncSession, comment_data: CommentCreate, visitor_id: str) -> Comment:
        comment = Comment(
            post_id=comment_data.post_id,
            parent_id=comment_data.parent_id,
            nickname=comment_data.nickname,
            email=comment_data.email,
            website=comment_data.website,
            content=comment_data.content,
            visitor_id=visitor_id,
        )
        db.add(comment)
        await db.commit()
        await db.refresh(comment)
        return comment

    @staticmethod
    async def delete_comment(db: AsyncSession, comment_id: str) -> bool:
        comment = (await db.execute(select(Comment).where(Comment.id == comment_id))).scalar_one_or_none()
        if not comment:
            return False
        await db.delete(comment)
        await db.commit()
        return True

    @staticmethod
    async def get_comment_by_id(db: AsyncSession, comment_id: str) -> Comment | None:
        return (await db.execute(select(Comment).where(Comment.id == comment_id))).scalar_one_or_none()