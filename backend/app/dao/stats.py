"""DAO layer for Stats - database CRUD operations."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models import Comment, Post, PostViewEvent, Visitor


class StatsDao:
    @staticmethod
    async def _get_top_visitor(
        db: AsyncSession,
        since: datetime | None = None,
    ) -> dict | None:
        stmt = (
            select(
                PostViewEvent.visitor_id.label("visitor_id"),
                func.count(PostViewEvent.id).label("access_count"),
                func.max(PostViewEvent.accessed_at).label("last_access_at"),
            )
            .group_by(PostViewEvent.visitor_id)
            .order_by(desc("access_count"), desc("last_access_at"))
            .limit(1)
        )
        if since is not None:
            stmt = stmt.where(PostViewEvent.accessed_at >= since)

        row = (await db.execute(stmt)).first()
        if not row:
            return None

        visitor = (
            await db.execute(select(Visitor).where(Visitor.id == row.visitor_id))
        ).scalar_one_or_none()

        latest_event_stmt = (
            select(PostViewEvent.user_agent, PostViewEvent.referrer)
            .where(PostViewEvent.visitor_id == row.visitor_id)
            .order_by(PostViewEvent.accessed_at.desc())
            .limit(1)
        )
        if since is not None:
            latest_event_stmt = latest_event_stmt.where(PostViewEvent.accessed_at >= since)
        latest_event = (await db.execute(latest_event_stmt)).first()

        return {
            "visitor_id": row.visitor_id,
            "access_count": int(row.access_count or 0),
            "last_access_at": row.last_access_at,
            "visitor_key": visitor.visitor_key if visitor else None,
            "first_seen_at": visitor.first_seen_at if visitor else None,
            "visitor_last_seen_at": visitor.last_seen_at if visitor else None,
            "user_agent": latest_event.user_agent if latest_event else None,
            "referrer": latest_event.referrer if latest_event else None,
        }

    @staticmethod
    async def _get_top_post(
        db: AsyncSession,
        since: datetime | None = None,
    ) -> dict | None:
        stmt = (
            select(
                PostViewEvent.post_id.label("post_id"),
                func.count(PostViewEvent.id).label("access_count"),
            )
            .where(PostViewEvent.post_id.is_not(None))
            .group_by(PostViewEvent.post_id)
            .order_by(desc("access_count"))
            .limit(1)
        )
        if since is not None:
            stmt = stmt.where(PostViewEvent.accessed_at >= since)

        row = (await db.execute(stmt)).first()
        if not row or not row.post_id:
            return None

        post = (
            await db.execute(select(Post).where(Post.id == row.post_id))
        ).scalar_one_or_none()
        if not post:
            return None

        return {
            "post_id": post.id,
            "slug": post.slug,
            "title": post.title,
            "access_count": int(row.access_count or 0),
        }

    @staticmethod
    async def log_access(db: AsyncSession, post_id: str, visitor_id: str, user_agent: str = None, referrer: str = None):
        log = PostViewEvent(
            post_id=post_id,
            visitor_id=visitor_id,
            user_agent=user_agent,
            referrer=referrer,
        )
        db.add(log)
        # Keep aggregate counter and event log in sync.
        post = (await db.execute(select(Post).where(Post.id == post_id))).scalar_one_or_none()
        if post is not None:
            post.view_count = (post.view_count or 0) + 1
        await db.commit()

    @staticmethod
    async def get_unique_visitors_count(db: AsyncSession, post_id: str, days: int = 7) -> int:
        since = datetime.now() - timedelta(days=days)
        result = (
            await db.execute(
                select(func.count(func.distinct(PostViewEvent.visitor_id))).where(
                    PostViewEvent.post_id == post_id,
                    PostViewEvent.accessed_at >= since,
                )
            )
        ).scalar_one()
        return result or 0

    @staticmethod
    async def get_trends_data(db: AsyncSession, days: int = 30):
        since = datetime.now() - timedelta(days=days)

        daily = (
            await db.execute(
                select(
                    func.date(PostViewEvent.accessed_at).label("date"),
                    func.count(func.distinct(PostViewEvent.visitor_id)).label("visitors"),
                    func.count(PostViewEvent.id).label("views"),
                )
                .where(PostViewEvent.accessed_at >= since)
                .group_by(func.date(PostViewEvent.accessed_at))
                .order_by(func.date(PostViewEvent.accessed_at))
            )
        ).all()

        return {
            "days": days,
            "total_visitors": sum(d.visitors for d in daily),
            "total_views": sum(d.views for d in daily),
            "daily": [{"date": str(d.date), "visitors": d.visitors, "views": d.views} for d in daily]
        }

    @staticmethod
    async def get_popular_posts_data(db: AsyncSession, days: int = 30, limit: int = 10):
        since = datetime.now() - timedelta(days=days)

        results = (
            await db.execute(
                select(
                    PostViewEvent.post_id,
                    func.count(func.distinct(PostViewEvent.visitor_id)).label("visitors"),
                    func.count(PostViewEvent.id).label("views"),
                )
                .where(PostViewEvent.accessed_at >= since)
                .group_by(PostViewEvent.post_id)
                .order_by(func.count(func.distinct(PostViewEvent.visitor_id)).desc())
                .limit(limit)
            )
        ).all()

        posts_data = []
        for r in results:
            if r.post_id is None:
                continue
            post = (await db.execute(select(Post).where(Post.id == r.post_id))).scalar_one_or_none()
            if post:
                posts_data.append({
                    "id": post.id,
                    "title": post.title,
                    "slug": post.slug,
                    "visitors": r.visitors,
                    "views": r.views
                })
        
        return {"days": days, "posts": posts_data}

    @staticmethod
    async def get_summary_data(db: AsyncSession):
        total_posts = (
            await db.execute(
                select(func.count(Post.id)).where(Post.is_deleted.is_(False), Post.status == "published")
            )
        ).scalar_one()
        total_views = (await db.execute(select(func.sum(Post.view_count)))).scalar_one() or 0

        return {
            "total_posts": total_posts,
            "total_views": total_views,
        }

    @staticmethod
    async def get_public_summary_data(db: AsyncSession):
        total_posts = (
            await db.execute(
                select(func.count(Post.id)).where(
                    Post.is_deleted.is_(False),
                    Post.status == "published",
                    Post.is_hidden.is_(False),
                )
            )
        ).scalar_one() or 0

        total_comments = (
            await db.execute(
                select(func.count(Comment.id))
                .join(Post, Post.id == Comment.post_id)
                .where(
                    Post.is_deleted.is_(False),
                    Post.status == "published",
                    Post.is_hidden.is_(False),
                )
            )
        ).scalar_one() or 0

        total_visits = (
            await db.execute(
                select(func.coalesce(func.sum(Post.view_count), 0)).where(
                    Post.is_deleted.is_(False),
                    Post.status == "published",
                    Post.is_hidden.is_(False),
                )
            )
        ).scalar_one() or 0

        return {
            "total_posts": total_posts,
            "total_comments": total_comments,
            "total_visits": total_visits,
        }

    @staticmethod
    async def get_admin_dashboard_data(db: AsyncSession):
        # Use China Standard Time (UTC+8) as the day boundary for "today_*" metrics.
        cst_tz = timezone(timedelta(hours=8))
        today_start = (
            datetime.now(cst_tz)
            .replace(hour=0, minute=0, second=0, microsecond=0)
            .astimezone(timezone.utc)
        )
        parent_comment = aliased(Comment)

        total_posts = (
            await db.execute(
                select(func.count(Post.id)).where(Post.is_deleted.is_(False))
            )
        ).scalar_one() or 0

        total_visits = (await db.execute(select(func.coalesce(func.sum(Post.view_count), 0)))).scalar_one() or 0
        total_comments = (await db.execute(select(func.count(Comment.id)))).scalar_one() or 0

        today_new_visits = (
            await db.execute(
                select(func.count(PostViewEvent.id)).where(PostViewEvent.accessed_at >= today_start)
            )
        ).scalar_one() or 0

        today_new_comments = (
            await db.execute(
                select(func.count(Comment.id)).where(Comment.created_at >= today_start)
            )
        ).scalar_one() or 0

        today_top_visitor = await StatsDao._get_top_visitor(db, since=today_start)
        all_time_top_visitor = await StatsDao._get_top_visitor(db, since=None)

        today_comments_rows = (
            await db.execute(
                select(
                    Comment.id.label("comment_id"),
                    Comment.nickname,
                    Comment.email,
                    Comment.website,
                    Comment.content,
                    Comment.created_at,
                    Comment.visitor_id,
                    Comment.parent_id,
                    Post.id.label("post_id"),
                    Post.slug.label("post_slug"),
                    Post.title.label("post_title"),
                    parent_comment.id.label("reply_to_comment_id"),
                    parent_comment.nickname.label("reply_to_nickname"),
                    parent_comment.content.label("reply_to_content"),
                )
                .join(Post, Post.id == Comment.post_id)
                .outerjoin(parent_comment, parent_comment.id == Comment.parent_id)
                .where(Comment.created_at >= today_start)
                .order_by(Comment.created_at.desc())
                .limit(20)
            )
        ).all()

        today_new_comment_items = [
            {
                "comment_id": row.comment_id,
                "nickname": row.nickname,
                "email": row.email,
                "website": row.website,
                "content": row.content,
                "created_at": row.created_at,
                "visitor_id": row.visitor_id,
                "parent_id": row.parent_id,
                "post_id": row.post_id,
                "post_slug": row.post_slug,
                "post_title": row.post_title,
                "reply_to_comment_id": row.reply_to_comment_id,
                "reply_to_nickname": row.reply_to_nickname,
                "reply_to_content": row.reply_to_content,
            }
            for row in today_comments_rows
        ]

        top_post_today = await StatsDao._get_top_post(db, since=today_start)
        top_post_all_time = await StatsDao._get_top_post(db, since=None)

        top_posts_rows = (
            await db.execute(
                select(
                    PostViewEvent.post_id,
                    func.count(PostViewEvent.id).label("access_count"),
                )
                .where(PostViewEvent.post_id.is_not(None))
                .group_by(PostViewEvent.post_id)
                .order_by(desc("access_count"))
                .limit(10)
            )
        ).all()

        top_posts = []
        for row in top_posts_rows:
            if not row.post_id:
                continue
            post = (
                await db.execute(select(Post).where(Post.id == row.post_id))
            ).scalar_one_or_none()
            if not post:
                continue
            top_posts.append(
                {
                    "post_id": post.id,
                    "slug": post.slug,
                    "title": post.title,
                    "access_count": int(row.access_count or 0),
                }
            )

        return {
            "total_posts": int(total_posts),
            "total_visits": int(total_visits),
            "total_comments": int(total_comments),
            "today_new_visits": int(today_new_visits),
            "today_new_comments": int(today_new_comments),
            "today_top_visitor": today_top_visitor,
            "all_time_top_visitor": all_time_top_visitor,
            "today_new_comment_items": today_new_comment_items,
            "top_post_today": top_post_today,
            "top_post_all_time": top_post_all_time,
            "top_posts": top_posts,
        }