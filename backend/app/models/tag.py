from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, String, Table, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# Association table for many-to-many relationship between Post and Tag
post_tags = Table(
    "post_tags",
    Base.metadata,
    Column("post_id", String(36), primary_key=True),
    Column("tag_id", String(36), primary_key=True),
)


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    posts: Mapped[list["Post"]] = relationship(
        "Post",
        secondary=post_tags,
        primaryjoin="Tag.id == post_tags.c.tag_id",
        secondaryjoin="Post.id == post_tags.c.post_id",
        back_populates="tags",
    )
