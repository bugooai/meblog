from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class AdminCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=20, pattern=r"^\w+$")
    email: EmailStr
    password: str = Field(..., min_length=8)


class AdminLogin(BaseModel):
    username: str
    password: str


class AdminResponse(BaseModel):
    id: str
    username: str
    email: str
    last_login_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    admin_id: Optional[str] = None
