from datetime import datetime, timedelta
from typing import Optional
import bcrypt
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from configs import settings
from app.database import get_db
from app.models import Admin

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except (ValueError, TypeError):
        # Invalid/legacy hashes should be treated as non-matching credentials
        # instead of bubbling up a 500 from auth login flow.
        return False


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(
        password.encode('utf-8'),
        bcrypt.gensalt()
    ).decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt


async def _decode_admin_id_from_token(token: str) -> Optional[str]:
    """Decode and validate admin ID from a JWT token. Returns admin_id or None."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        admin_id: str | None = payload.get("sub")
        if admin_id is None:
            return None
        return admin_id
    except JWTError:
        return None


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Optional[Admin]:
    """Get current admin from JWT token. Returns None if not authenticated."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ")[1]
    admin_id = await _decode_admin_id_from_token(token)
    if admin_id is None:
        return None

    return (await db.execute(select(Admin).where(Admin.id == admin_id))).scalar_one_or_none()


async def get_current_user_from_request(request: Request, db: AsyncSession) -> Optional[Admin]:
    """Get current admin from JWT token without Depends. Returns None if not authenticated."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ")[1]
    admin_id = await _decode_admin_id_from_token(token)
    if admin_id is None:
        return None

    return (await db.execute(select(Admin).where(Admin.id == admin_id))).scalar_one_or_none()


async def get_current_admin_user(
    current_user: Optional[Admin] = Depends(get_current_user),
) -> Admin:
    """Get current admin and verify admin permissions."""
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin permission required",
        )
    return current_user
