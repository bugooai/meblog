from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SiteSettings(Base):
    """Site-wide settings for public configuration."""
    __tablename__ = "site_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    site_name: Mapped[str] = mapped_column(String(120), default="技术博客")
    site_logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    site_favicon_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    site_description: Mapped[str] = mapped_column(String(300), default="分享技术与生活的个人博客")
    site_keywords: Mapped[str | None] = mapped_column(String(500), nullable=True)
    default_og_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    wechat_qr_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    wechat_guide_text: Mapped[str] = mapped_column(String(200), default="扫码关注公众号，获取更多精彩内容")
    wechat_show_on_article: Mapped[bool] = mapped_column(Boolean, default=True)
    wechat_show_in_sidebar: Mapped[bool] = mapped_column(Boolean, default=True)
    footer_github_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    beian_icp: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AuthorProfile(Base):
    """Single-row table storing author profile for About page."""
    __tablename__ = "author_profile"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    username: Mapped[str] = mapped_column(String(50), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_thumb_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    tech_stack_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    career_timeline_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    github_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    zhihu_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    twitter_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    wechat_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )