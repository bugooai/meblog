"""
Service layer for Auth - business logic.
"""
from fastapi import HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
from typing import Optional
from app.models import Admin
from app.schemas import AdminAccountCreate, AdminCreate, AdminResponse, Token
from app.dao import AdminDao
from app.utils.security import verify_password, create_access_token
from app.utils.logger import logger
from configs import settings


class AuthService:
    """Service class for authentication business logic."""
    
    @staticmethod
    async def register(db: AsyncSession, admin: AdminCreate) -> AdminResponse:
        try:
            if await AdminDao.get_admin_by_username(db, admin.username):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already registered"
                )
            if await AdminDao.get_admin_by_email(db, admin.email):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered"
                )
            account_count = await AdminDao.count_accounts(db)
            if not settings.ALLOW_REGISTRATION and account_count > 0:
                logger.warning(f"Registration rejected for {admin.username}: signup is closed")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Registration is closed"
                )
            # 只有空库的第一个账号（bootstrap）才是管理员，之后注册的都是一般账号。
            # 一般账号能登录、点赞、评论，但进不了后台：所有写接口都要
            # get_current_admin_user。想加管理员走 /admins（仅管理员可用）。
            result = await AdminDao.create_admin(db, admin, is_admin=account_count == 0)
            logger.info(f"Account registered: {admin.username}")
            return result
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error registering admin {admin.username}: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    @staticmethod
    async def login(
        db: AsyncSession,
        form_data: OAuth2PasswordRequestForm,
        request: Request = None
    ) -> Token:
        try:
            admin = await AdminDao.get_admin_by_username(db, form_data.username)
            if not admin:
                admin = await AdminDao.get_admin_by_email(db, form_data.username)
            
            ip = request.client.host if request and request.client else "unknown"
            if not admin or not verify_password(form_data.password, admin.password_hash):
                logger.warning(f"Failed login attempt for {form_data.username} from {ip}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect username or password",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
            access_token = create_access_token(
                data={"sub": str(admin.id)}, expires_delta=access_token_expires
            )
            admin.last_login_at = datetime.utcnow()
            await db.commit()
            logger.info(f"Admin {admin.username} logged in successfully from {ip}")
            return {"access_token": access_token, "token_type": "bearer"}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error during login for {form_data.username}: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    @staticmethod
    async def get_me(current_user: Optional[AdminResponse]) -> AdminResponse:
        try:
            if current_user is None:
                raise HTTPException(status_code=401, detail="Not authenticated")
            return current_user
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting current admin: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    @staticmethod
    async def list_accounts(db: AsyncSession) -> list[AdminResponse]:
        return await AdminDao.list_accounts(db)

    @staticmethod
    async def create_account(
        db: AsyncSession, payload: AdminAccountCreate, actor: Admin
    ) -> AdminResponse:
        """管理员直接建号（含授权成管理员）。这是公开注册之外唯一的加号入口。"""
        try:
            if await AdminDao.get_admin_by_username(db, payload.username):
                raise HTTPException(status_code=400, detail="Username already registered")
            if await AdminDao.get_admin_by_email(db, payload.email):
                raise HTTPException(status_code=400, detail="Email already registered")
            return await AdminDao.create_admin(
                db, payload, is_admin=payload.is_admin, created_by=actor.id
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error creating account {payload.username}: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    @staticmethod
    async def set_account_admin(
        db: AsyncSession, account_id: str, is_admin: bool, actor: Admin
    ) -> AdminResponse:
        """提权 / 降权。

        降权只有一条锁：不能自己降自己。别的降权操作者必须本身就是管理员，
        所以他降完别人之后自己还在，不可能把管理员清零。
        """
        target = await AdminDao.get_admin_by_id(db, account_id)
        if not target:
            raise HTTPException(status_code=404, detail="Account not found")

        if not is_admin:
            if target.id == actor.id:
                raise HTTPException(
                    status_code=400,
                    detail="不能给自己降权：降下去就再没有管理员能把你提回来",
                )

        updated = await AdminDao.set_admin_flag(db, account_id, is_admin, actor.id)
        if not updated:
            raise HTTPException(status_code=404, detail="Account not found")
        return updated
