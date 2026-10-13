"""
Service layer for Auth - business logic.
"""
from fastapi import HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
from typing import Optional
from app.schemas import AdminCreate, AdminResponse, Token
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
            result = await AdminDao.create_admin(db, admin)
            logger.info(f"Admin registered: {admin.username}")
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