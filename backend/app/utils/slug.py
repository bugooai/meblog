import re
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from slugify import slugify as python_slugify
from app.models import Post


def generate_slug(text: str, max_length: int = 200) -> str:
    """Generate a URL-friendly slug from text."""
    slug = python_slugify(text, lowercase=True, max_length=max_length)
    return slug


async def generate_unique_slug(db: AsyncSession, title: str, exclude_id: str | None = None) -> str:
    """
    Generate a unique slug for a post.
    If the slug already exists, appends a counter suffix.
    """
    slug = generate_slug(title, max_length=200)
    original_slug = slug
    counter = 1

    while True:
        query = select(Post.slug).where(Post.slug == slug)
        if exclude_id is not None:
            query = query.where(Post.id != exclude_id)

        existing = (await db.execute(query)).first()
        if not existing:
            break
        slug = f"{original_slug}-{counter}"
        counter += 1

    return slug
