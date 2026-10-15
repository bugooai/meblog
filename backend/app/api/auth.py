"""API layer for Auth - HTTP handling."""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.database import get_db
from app.schemas import (
    AdminCreate,
    AdminResponse,
    AuthStatusResponse,
    PasswordChangeRequest,
    Token,
)
from app.services import AuthService
from app.utils.security import get_current_user
from app.models import Admin

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=AdminResponse, status_code=status.HTTP_201_CREATED)
async def register(admin: AdminCreate, db: AsyncSession = Depends(get_db)):
    return await AuthService.register(db, admin)


@router.get("/status", response_model=AuthStatusResponse)
async def auth_status(db: AsyncSession = Depends(get_db)):
    """公开：站里还没有任何账号时，登录页需要给出初始化入口。"""
    return await AuthService.get_status(db)


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


@router.post("/change-password")
async def change_password(
    payload: PasswordChangeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[Admin] = Depends(get_current_user),
):
    """登录状态下改自己的口令（一般账号和管理账号都可以）。

    口令不出现在 URL、query 或返回值里；旧的 access token 改完仍然有效到过期，
    原因见 `AuthService.change_password` 的注释。
    """
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return await AuthService.change_password(db, current_user, payload)
