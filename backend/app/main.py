# Copyright 2026 布谷布谷科技
# Licensed under the Apache License, Version 2.0

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from configs import settings
from app.database import engine, Base
from app.api import admins_router, auth_router, posts_router, projects_router, tags_router, settings_router, stats_router, about_router, comments_router, files_router
from app.api.seo import router as seo_router


def build_openapi_url(expose: bool, api_prefix: str) -> str | None:
    """按开关决定要不要出 OpenAPI 文档；返回 None 时 FastAPI 连带不挂 /docs、/redoc。

    这份文档不需要登录就能拿到全部路由、参数和响应结构（`/api/v1/admins`、
    `/api/v1/files/upload` 都在里面），所以默认只在本地开（`configs/local.py`）。
    """
    return f"{api_prefix}/openapi.json" if expose else None


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=build_openapi_url(settings.EXPOSE_OPENAPI, settings.API_V1_STR),
)

# CORS middleware
raw_origins = (settings.BACKEND_CORS_ORIGINS or "").strip()
cors_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
allow_all_origins = "*" in cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all_origins else cors_origins,
    # Browsers reject wildcard origin when credentials are enabled.
    allow_credentials=not allow_all_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(admins_router, prefix=settings.API_V1_STR)
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(posts_router, prefix=settings.API_V1_STR)
app.include_router(projects_router, prefix=settings.API_V1_STR)
app.include_router(tags_router, prefix=settings.API_V1_STR)
app.include_router(settings_router, prefix=settings.API_V1_STR)
app.include_router(stats_router, prefix=settings.API_V1_STR)
app.include_router(about_router, prefix=settings.API_V1_STR)
app.include_router(comments_router, prefix=settings.API_V1_STR)
app.include_router(files_router, prefix=settings.API_V1_STR)

# SEO endpoints at root level (not under /api/v1)
app.include_router(seo_router)


@app.on_event("startup")
async def on_startup() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@app.get("/")
async def root():
    return {"message": "Meblog API", "version": settings.VERSION}


@app.get("/health")
async def health():
    return {"status": "ok"}
