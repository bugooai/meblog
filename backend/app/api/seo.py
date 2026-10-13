"""API layer for SEO - HTTP handling."""
from fastapi import APIRouter, Depends
from starlette.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from typing import List
from app.database import get_db
from app.models import AuthorProfile, Post, Project, Tag
from configs import settings

router = APIRouter(tags=["SEO"])


def escape_xml(text: str) -> str:
    """Escape special XML characters."""
    if not text:
        return ""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def format_iso_date(dt: datetime) -> str:
    """Format datetime as ISO 8601 for sitemap."""
    return dt.strftime("%Y-%m-%dT%H:%M:%S+08:00") if dt else ""


@router.get("/sitemap.xml")
async def get_sitemap(db: AsyncSession = Depends(get_db)):
    site_url = settings.SITE_URL.rstrip("/")

    urls: List[str] = []

    # Static pages
    static_pages = [
        ("", "1.0", "daily"),
        ("/tags", "0.6", "weekly"),
    ]
    for path, priority, changefreq in static_pages:
        urls.append(
            f"  <url>\n"
            f"    <loc>{escape_xml(site_url + path)}</loc>\n"
            f"    <changefreq>{changefreq}</changefreq>\n"
            f"    <priority>{priority}</priority>\n"
            f"  </url>"
        )

    # Published posts
    posts = (
        await db.execute(
            select(Post)
            .where(Post.status == "published", Post.is_deleted.is_(False))
            .order_by(Post.updated_at.desc())
        )
    ).scalars().all()
    for post in posts:
        lastmod = format_iso_date(post.updated_at) if post.updated_at else ""
        urls.append(
            f"  <url>\n"
            f"    <loc>{escape_xml(site_url + '/post/' + post.slug)}</loc>\n"
            f"    <lastmod>{escape_xml(lastmod)}</lastmod>\n"
            f"    <changefreq>monthly</changefreq>\n"
            f"    <priority>0.8</priority>\n"
            f"  </url>"
        )

    # Projects (categories)
    projects = (await db.execute(select(Project))).scalars().all()
    for project in projects:
        urls.append(
            f"  <url>\n"
            f"    <loc>{escape_xml(site_url + '/project/' + project.slug)}</loc>\n"
            f"    <changefreq>weekly</changefreq>\n"
            f"    <priority>0.5</priority>\n"
            f"  </url>"
        )

    # Tags
    tags = (await db.execute(select(Tag))).scalars().all()
    for tag in tags:
        urls.append(
            f"  <url>\n"
            f"    <loc>{escape_xml(site_url + '/tag/' + tag.slug)}</loc>\n"
            f"    <changefreq>weekly</changefreq>\n"
            f"    <priority>0.4</priority>\n"
            f"  </url>"
        )

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>"
    )
    return Response(content=xml.encode("utf-8"), media_type="application/xml")


@router.get("/feed.xml")
async def get_feed(db: AsyncSession = Depends(get_db)):
    site_url = settings.SITE_URL.rstrip("/")
    author_profile = (await db.execute(select(AuthorProfile))).scalar_one_or_none()
    author_name = author_profile.username if author_profile else settings.PROJECT_NAME

    # Get latest 20 published posts
    posts = (
        await db.execute(
            select(Post)
            .where(Post.status == "published", Post.is_deleted.is_(False))
            .order_by(Post.created_at.desc())
            .limit(20)
        )
    ).scalars().all()

    items: List[str] = []
    for post in posts:
        post_url = escape_xml(site_url + "/post/" + post.slug)
        title = escape_xml(post.title)
        # Use summary as description; fall back to first 200 chars of content
        description = escape_xml(
            post.summary
            or (post.content[:200] + "..." if len(post.content) > 200 else post.content)
        )
        pub_date = (
            post.created_at.strftime("%a, %d %b %Y %H:%M:%S +0800")
            if post.created_at
            else ""
        )
        author = escape_xml(author_name)

        items.append(
            f"    <item>\n"
            f"      <title>{title}</title>\n"
            f"      <link>{post_url}</link>\n"
            f"      <guid>{post_url}</guid>\n"
            f"      <description>{description}</description>\n"
            f"      <author>{author}</author>\n"
            f"      <pubDate>{pub_date}</pubDate>\n"
            f"    </item>"
        )

    channel_description = escape_xml(
        f"{settings.PROJECT_NAME} - 最新文章"
    )

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f"<rss version=\"2.0\" "
        f"xmlns:atom=\"http://www.w3.org/2005/Atom\" "
        f"xmlns:content=\"http://purl.org/rss/1.0/modules/content/\">\n"
        "  <channel>\n"
        f"    <title>{escape_xml(settings.PROJECT_NAME)}</title>\n"
        f"    <link>{escape_xml(site_url)}</link>\n"
        f"    <description>{channel_description}</description>\n"
        f"    <language>zh-cn</language>\n"
        f"    <atom:link href=\"{escape_xml(site_url + '/feed.xml')}\" rel=\"self\" type=\"application/rss+xml\"/>\n"
        + "\n".join(items)
        + "\n  </channel>\n</rss>"
    )
    return Response(content=xml.encode("utf-8"), media_type="application/xml")
