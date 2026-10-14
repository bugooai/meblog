"""DAO layer for Admin - database CRUD operations."""
from sqlalchemy import func, select
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
    async def count_accounts(db: AsyncSession) -> int:
        try:
            return (await db.execute(select(func.count()).select_from(Admin))).scalar_one()
        except Exception as e:
            logger.error(f"Error counting accounts: {e}")
            raise

    @staticmethod
    async def get_admin_by_id(db: AsyncSession, admin_id: str):
        try:
            return (await db.execute(select(Admin).where(Admin.id == admin_id))).scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error getting admin by ID {admin_id}: {e}")
            raise

    @staticmethod
    async def create_admin(
        db: AsyncSession,
        admin: AdminCreate,
        *,
        is_admin: bool,
        created_by: str | None = None,
    ):
        """建号。is_admin 必须由调用方显式决定，这里不再有默认「就是管理员」。

        原来这里写死 is_admin=True，而公开注册是唯一建号入口 —— 一旦放开注册，
        每个进来的账号都是管理员。权限不该由 DAO 顺手决定，所以改成必填参数。
        """
        try:
            hashed_password = get_password_hash(admin.password)
            db_admin = Admin(
                username=admin.username,
                email=admin.email,
                password_hash=hashed_password,
                is_admin=is_admin,
                created_by=created_by,
                updated_by=created_by,
            )
            db.add(db_admin)
            await db.commit()
            await db.refresh(db_admin)
            logger.info(f"Created account: {db_admin.username} (ID: {db_admin.id}, admin={is_admin})")
            return db_admin
        except Exception as e:
            await db.rollback()
            logger.error(f"Error creating account {admin.username}: {e}")
            raise

    @staticmethod
    async def list_accounts(db: AsyncSession):
        try:
            return list((await db.execute(select(Admin).order_by(Admin.created_at))).scalars().all())
        except Exception as e:
            logger.error(f"Error listing accounts: {e}")
            raise

    @staticmethod
    async def set_admin_flag(db: AsyncSession, admin_id: str, is_admin: bool, actor_id: str):
        try:
            db_admin = await AdminDao.get_admin_by_id(db, admin_id)
            if not db_admin:
                return None
            db_admin.is_admin = is_admin
            db_admin.updated_by = actor_id
            await db.commit()
            await db.refresh(db_admin)
            logger.info(f"Account {db_admin.username} admin flag -> {is_admin} (by {actor_id})")
            return db_admin
        except Exception as e:
            await db.rollback()
            logger.error(f"Error updating admin flag for {admin_id}: {e}")
            raise
