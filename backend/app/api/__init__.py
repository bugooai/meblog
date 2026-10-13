# Copyright 2026 布谷布谷科技
# Licensed under the Apache License, Version 2.0

from app.api.auth import router as auth_router
from app.api.posts import router as posts_router
from app.api.project import router as projects_router
from app.api.tags import router as tags_router
from app.api.settings import router as settings_router
from app.api.stats import router as stats_router
from app.api.about import router as about_router
from app.api.comments import router as comments_router
from app.api.files import router as files_router

__all__ = [
    "auth_router",
    "posts_router",
    "projects_router",
    "tags_router",
    "settings_router",
    "stats_router",
    "about_router",
    "comments_router",
    "files_router",
]
