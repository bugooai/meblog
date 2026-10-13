"""
Service layer for Post - business logic.
"""
from fastapi import HTTPException
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from datetime import datetime, timezone
from app.models import Post, Admin, PostLike, Project, Tag
from app.models.tag import post_tags
from app.schemas import PostCreate, PostUpdate, PostResponse, PostListResponse, LikeStatusResponse
from app.schemas.post import AuthorInfo
from app.dao import PostDao, StatsDao
from app.dao.about import AboutDao
from app.utils.logger import logger
from app.utils.revalidate import notify_frontend_revalidate
from app.services.visitor import VisitorService


class PostService:
    """Service class for Post business logic."""

    @staticmethod
    async def _notify_frontend_for_post(post: Post | None) -> None:
        if post is None:
            return
        await notify_frontend_revalidate(
            post_slug=post.slug,
            project_slug=post.project.slug if post.project else None,
            tag_slugs=[tag.slug for tag in (post.tags or [])],
        )

    @staticmethod
    async def _build_author_info(db: AsyncSession) -> AuthorInfo | None:
        author_profile = await AboutDao.get_author_settings(db)
        if not author_profile:
            author_profile = await AboutDao.create_author_settings(db)
        if not author_profile:
            return None
        return AuthorInfo(id=author_profile.id, username=author_profile.username)

    @staticmethod
    async def _to_post_response(db: AsyncSession, post: Post) -> PostResponse:
        author_info = await PostService._build_author_info(db)
        # Keep legacy rows renderable when audit timestamps are missing.
        safe_created_at = post.created_at or datetime.now(timezone.utc)
        safe_updated_at = post.updated_at or safe_created_at
        # Resolve relation data explicitly to avoid async lazy-load greenlet errors.
        safe_project = None
        if post.project_id:
            safe_project = (
                await db.execute(select(Project).where(Project.id == post.project_id))
            ).scalar_one_or_none()
        safe_tags = (
            await db.execute(
                select(Tag)
                .join(post_tags, post_tags.c.tag_id == Tag.id)
                .where(post_tags.c.post_id == post.id)
            )
        ).scalars().all()
        return PostResponse(
            id=post.id,
            title=post.title,
            slug=post.slug,
            cover=post.cover,
            content=post.content,
            summary=post.summary,
            view_count=post.view_count,
            like_count=post.like_count,
            status=post.status,
            created_by=post.created_by,
            updated_by=post.updated_by,
            created_at=safe_created_at,
            updated_at=safe_updated_at,
            project=safe_project,
            tags=safe_tags,
            author=author_info,
        )
    
    @staticmethod
    async def list_posts(
        db: AsyncSession,
        page: int = 1,
        size: int = 10,
        project: Optional[str] = None,
        tag: Optional[str] = None,
        q: Optional[str] = None,
        include_unpublished: bool = False,
        include_hidden: bool = False,
        current_user: Optional[Admin] = None,
    ) -> PostListResponse:
        try:
            can_view_all = current_user is not None and current_user.is_admin
            posts, total = await PostDao.get_posts(
                db, page=page, size=size,
                project_slug=project, tag_slug=tag, q=q,
                include_unpublished=can_view_all and include_unpublished,
                include_hidden=can_view_all and include_hidden,
            )
            pages = (total + size - 1) // size if total > 0 else 1
            return PostListResponse(
                items=posts,
                total=total,
                page=page,
                size=size,
                pages=pages
            )
        except Exception as e:
            logger.error(f"Error listing posts: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    @staticmethod
    async def get_post(
        db: AsyncSession,
        id_or_slug: str,
        request,
        include_unpublished: bool = False,
        include_hidden: bool = False,
        current_user: Optional[Admin] = None
    ) -> PostResponse:
        try:
            can_view_all = current_user is not None and current_user.is_admin
            effective_include_unpublished = can_view_all and include_unpublished
            effective_include_hidden = can_view_all and include_hidden
            post = await PostDao.get_post_by_id(
                db,
                id_or_slug,
                include_unpublished=effective_include_unpublished,
                include_hidden=effective_include_hidden,
            )
            if not post:
                post = await PostDao.get_post_by_slug(
                    db,
                    id_or_slug,
                    include_unpublished=effective_include_unpublished,
                    include_hidden=effective_include_hidden,
                )

            if not post:
                raise HTTPException(status_code=404, detail="Post not found")

            if not effective_include_unpublished and not effective_include_hidden:
                try:
                    visitor_id = await VisitorService.resolve_visitor_id(db, request)
                    await StatsDao.log_access(
                        db=db,
                        post_id=post.id,
                        visitor_id=visitor_id,
                        user_agent=request.headers.get("user-agent", "")[:500] or None,
                        referrer=request.headers.get("referer", "")[:500] or None,
                    )
                except Exception as access_error:
                    # Access analytics should never block article rendering.
                    await db.rollback()
                    logger.warning(f"Skip access logging for post {id_or_slug}: {access_error}")

            refreshed_post = await PostDao.get_post_by_id(
                db,
                post.id,
                include_unpublished=True,
                include_hidden=True,
            )
            return await PostService._to_post_response(db, refreshed_post or post)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting post {id_or_slug}: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    @staticmethod
    async def create_post(
        db: AsyncSession,
        post: PostCreate,
        current_user: Admin,
    ) -> PostResponse:
        """Create a new post. Requires authentication (caller must verify)."""
        try:
            result = await PostDao.create_post(db, post, creator_id=current_user.id)
            await PostService._notify_frontend_for_post(result)
            logger.info(f"Admin {current_user.id} created post {result.id}")
            return await PostService._to_post_response(db, result)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error creating post: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    @staticmethod
    async def update_post(
        db: AsyncSession,
        post_id: str,
        post: PostUpdate,
        current_user: Admin,
    ) -> PostResponse:
        """Update an existing post. Requires authentication and ownership (caller must verify)."""
        try:
            existing = await PostDao.get_post_by_id(
                db,
                post_id,
                include_unpublished=True,
                include_hidden=True,
            )
            if not existing:
                raise HTTPException(status_code=404, detail="Post not found")
            creator_id = existing.created_by or existing.user_id
            if creator_id != current_user.id:
                raise HTTPException(status_code=403, detail="Not authorized to update this post")
            result = await PostDao.update_post(
                db,
                post_id,
                post,
                updater_id=current_user.id,
                include_unpublished=True,
                include_hidden=True,
            )
            await PostService._notify_frontend_for_post(result)
            logger.info(f"Admin {current_user.id} updated post {post_id}")
            return await PostService._to_post_response(db, result)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating post {post_id}: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    @staticmethod
    async def delete_post(
        db: AsyncSession,
        post_id: str,
        current_user: Admin,
    ) -> None:
        """Delete a post. Requires authentication and ownership (caller must verify)."""
        try:
            existing = await PostDao.get_post_by_id(
                db,
                post_id,
                include_unpublished=True,
                include_hidden=True,
            )
            if not existing:
                raise HTTPException(status_code=404, detail="Post not found")
            creator_id = existing.created_by or existing.user_id
            if creator_id != current_user.id:
                raise HTTPException(status_code=403, detail="Not authorized to delete this post")
            await PostService._notify_frontend_for_post(existing)
            await PostDao.delete_post(db, post_id)
            logger.info(f"Admin {current_user.id} deleted post {post_id}")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting post {post_id}: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    @staticmethod
    async def get_like_status(
        db: AsyncSession,
        slug: str,
        request,
    ) -> LikeStatusResponse:
        """Get like status and count for a post."""
        try:
            post = await PostDao.get_post_by_slug(db, slug, include_unpublished=False)
            if not post:
                raise HTTPException(status_code=404, detail="Post not found")

            visitor_id = await VisitorService.resolve_visitor_id(db, request)
            liked = (
                await db.execute(
                    select(PostLike).where(and_(PostLike.post_id == post.id, PostLike.visitor_id == visitor_id))
                )
            ).scalar_one_or_none() is not None

            return LikeStatusResponse(liked=liked, like_count=post.like_count)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting like status for post {slug}: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    @staticmethod
    async def toggle_like(
        db: AsyncSession,
        slug: str,
        request,
    ) -> LikeStatusResponse:
        """Toggle like status for a post. Liking increments like_count, unliking decrements."""
        try:
            post = await PostDao.get_post_by_slug(db, slug, include_unpublished=False)
            if not post:
                raise HTTPException(status_code=404, detail="Post not found")

            visitor_id = await VisitorService.resolve_visitor_id(db, request)
            existing = (
                await db.execute(
                    select(PostLike).where(and_(PostLike.post_id == post.id, PostLike.visitor_id == visitor_id))
                )
            ).scalar_one_or_none()

            if existing:
                await db.delete(existing)
                post.like_count = max(0, post.like_count - 1)
                liked = False
            else:
                new_like = PostLike(post_id=post.id, visitor_id=visitor_id)
                db.add(new_like)
                post.like_count = post.like_count + 1
                liked = True

            await db.commit()
            await db.refresh(post)
            logger.info(f"Visitor {visitor_id} {'unliked' if not liked else 'liked'} post {post.id}")
            return LikeStatusResponse(liked=liked, like_count=post.like_count)
        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"Error toggling like for post {slug}: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")