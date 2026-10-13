"""API layer for Auth - HTTP handling."""
from fastapi import APIRouter, Depends, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.database import get_db
from app.schemas import AdminCreate, AdminResponse, Token
from app.services import AuthService
from app.utils.security import get_current_user
from app.models import Admin

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=AdminResponse, status_code=status.HTTP_201_CREATED)
async def register(admin: AdminCreate, db: AsyncSession = Depends(get_db)):
    return await AuthService.register(db, admin)


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
    request: Request = None
):
    return await AuthService.login(db, form_data, request)


@router.get("/me", response_model=AdminResponse)
async def get_me(current_user: Optional[Admin] = Depends(get_current_user)):
    return await AuthService.get_me(current_user)
