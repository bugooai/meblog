"""Service layer for Visitor identity resolution."""
import hashlib
from datetime import datetime
from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Visitor
from configs import settings


class VisitorService:
    @staticmethod
    def _normalize_ip(ip: str) -> str:
        value = (ip or "").strip().lower()
        if not value:
            return "unknown"
        if value == "::1":
            return "127.0.0.1"
        if value.startswith("::ffff:"):
            mapped = value.split("::ffff:", 1)[1]
            if mapped:
                return mapped
        return value

    @staticmethod
    def _get_client_ip(request: Request) -> str:
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            first_ip = forwarded_for.split(",")[0].strip()
            return VisitorService._normalize_ip(first_ip)
        raw_ip = request.client.host if request.client else "unknown"
        return VisitorService._normalize_ip(raw_ip)

    @staticmethod
    def _normalize_ua(request: Request) -> str:
        return request.headers.get("user-agent", "").strip().lower()[:300]

    @staticmethod
    def _build_hash(value: str) -> str:
        return hashlib.sha256(value.encode("utf-8")).hexdigest()

    @staticmethod
    def build_visitor_key(request: Request) -> tuple[str, str, str]:
        ip = VisitorService._get_client_ip(request)
        ua = VisitorService._normalize_ua(request)
        salt = settings.SECRET_KEY
        visitor_key = VisitorService._build_hash(f"{salt}|{ip}|{ua}")
        ip_hash = VisitorService._build_hash(f"{salt}|ip|{ip}")
        ua_hash = VisitorService._build_hash(f"{salt}|ua|{ua}")
        return visitor_key, ip_hash, ua_hash

    @staticmethod
    async def resolve_visitor_id(db: AsyncSession, request: Request) -> str:
        visitor_key, ip_hash, ua_hash = VisitorService.build_visitor_key(request)
        now = datetime.utcnow()
        visitor = (
            await db.execute(select(Visitor).where(Visitor.visitor_key == visitor_key))
        ).scalar_one_or_none()
        if visitor:
            visitor.last_seen_at = now
            visitor.updated_at = now
            await db.commit()
            await db.refresh(visitor)
            return visitor.id

        visitor = Visitor(
            visitor_key=visitor_key,
            ip_hash=ip_hash,
            ua_hash=ua_hash,
            first_seen_at=now,
            last_seen_at=now,
        )
        db.add(visitor)
        await db.commit()
        await db.refresh(visitor)
        return visitor.id
