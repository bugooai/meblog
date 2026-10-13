"""API layer for Settings - HTTP handling."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas import (
    SiteSettingsResponse,
    SiteSettingsUpdate,
    SeoSettingsResponse,
    SeoSettingsUpdate,
)
from app.services import SettingsService
from app.utils.security import get_current_admin_user
from app.models import Admin


router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("/site", response_model=SiteSettingsResponse)
async def get_site_settings(db: AsyncSession = Depends(get_db)):
    return await SettingsService.get_site_settings_service(db)


@router.put("/site", response_model=SiteSettingsResponse)
async def update_site_settings(
    payload: SiteSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_user),
):
    return await SettingsService.update_site_settings_service(db, payload, current_admin)


@router.get("/seo", response_model=SeoSettingsResponse)
async def get_seo_settings(db: AsyncSession = Depends(get_db)):
    return await SettingsService.get_seo_settings_service(db)


@router.put("/seo", response_model=SeoSettingsResponse)
async def update_seo_settings(
    payload: SeoSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_user),
):
    return await SettingsService.update_seo_settings_service(db, payload, current_admin)