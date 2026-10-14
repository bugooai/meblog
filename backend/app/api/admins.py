"""账号与权限管理（仅管理员可用）。

公开注册只会得到一般账号；要加管理员或改权限，走这里的接口。
"""
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Admin
from app.schemas import AdminAccountCreate, AdminAccountUpdate, AdminResponse
from app.services import AuthService
from app.utils.security import get_current_admin_user

router = APIRouter(prefix="/admins", tags=["Accounts"])


@router.get("", response_model=List[AdminResponse])
async def list_accounts(
    db: AsyncSession = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_user),
):
    return await AuthService.list_accounts(db)


@router.post("", response_model=AdminResponse, status_code=201)
async def create_account(
    payload: AdminAccountCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_user),
):
    return await AuthService.create_account(db, payload, current_admin)


@router.patch("/{account_id}", response_model=AdminResponse)
async def set_account_admin(
    account_id: str,
    payload: AdminAccountUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_user),
):
    return await AuthService.set_account_admin(db, account_id, payload.is_admin, current_admin)
