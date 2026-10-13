"""Service layer for Stats - business logic."""
from fastapi import HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.models import Admin
from app.dao import StatsDao
from app.services.visitor import VisitorService


class StatsService:
    @staticmethod
    async def log_access_service(
        db: AsyncSession,
        post_id: str,
        request: Request,
    ) -> dict:
        visitor_id = await VisitorService.resolve_visitor_id(db, request)
        user_agent = request.headers.get("user-agent", "")[:500] if request.headers.get("user-agent") else None
        referrer = request.headers.get("referer", "")[:500] if request.headers.get("referer") else None

        await StatsDao.log_access(db, post_id, visitor_id, user_agent, referrer)
        return {"success": True}

    @staticmethod
    async def get_unique_visitors_service(
        db: AsyncSession,
        post_id: str,
        days: int = 7,
    ) -> dict:
        result = await StatsDao.get_unique_visitors_count(db, post_id, days)
        return {"post_id": post_id, "unique_visitors": result, "days": days}

    @staticmethod
    async def get_trends_service(
        db: AsyncSession,
        days: int = 30,
    ) -> dict:
        return await StatsDao.get_trends_data(db, days)

    @staticmethod
    async def get_popular_posts_service(
        db: AsyncSession,
        days: int = 30,
        limit: int = 10,
    ) -> dict:
        return await StatsDao.get_popular_posts_data(db, days, limit)

    @staticmethod
    async def get_summary_service(
        db: AsyncSession,
        current_user: Optional[Admin] = None,
    ) -> dict:
        if current_user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
            )
        return await StatsDao.get_summary_data(db)