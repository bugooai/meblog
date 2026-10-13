"""DAO layer for Admin - database CRUD operations."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Admin
from app.schemas import AdminCreate
from app.utils.logger import logger
from app.utils.security import get_password_hash


class AdminDao:
    """Data Access Object for Admin operations."""

    @staticmethod
    async def get_admin_by_username(db: AsyncSession, username: str):
        try:
            return (await db.execute(select(Admin).where(Admin.username == username))).scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error getting admin by username {username}: {e}")
            raise

    @staticmethod
    async def get_admin_by_email(db: AsyncSession, email: str):
        try:
            return (await db.execute(select(Admin).where(Admin.email == email))).scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error getting admin by email {email}: {e}")
            raise

    @staticmethod
    async def get_admin_by_id(db: AsyncSession, admin_id: str):
        try:
            return (await db.execute(select(Admin).where(Admin.id == admin_id))).scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error getting admin by ID {admin_id}: {e}")
            raise

    @staticmethod
    async def create_admin(db: AsyncSession, admin: AdminCreate):
        try:
            hashed_password = get_password_hash(admin.password)
            db_admin = Admin(
                username=admin.username,
                email=admin.email,
                password_hash=hashed_password,
                is_admin=True,
            )
            db.add(db_admin)
            await db.commit()
            await db.refresh(db_admin)
            logger.info(f"Created admin: {db_admin.username} (ID: {db_admin.id})")
            return db_admin
        except Exception as e:
            await db.rollback()
            logger.error(f"Error creating admin {admin.username}: {e}")
            raise
