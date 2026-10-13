"""API layer for About - HTTP handling."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas import AboutResponse, AboutUpdate
from app.services import AboutService
from app.utils.security import get_current_admin_user

router = APIRouter(prefix="/about", tags=["About"])


@router.get("", response_model=AboutResponse)
async def get_about(db: AsyncSession = Depends(get_db)):
    return await AboutService.get_about_service(db)


@router.put("", response_model=AboutResponse)
async def update_about(
    update_data: AboutUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(get_current_admin_user),
):
    return await AboutService.update_about_service(db, update_data, current_admin)
