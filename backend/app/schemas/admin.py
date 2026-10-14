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
    is_admin: bool = False
    last_login_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    admin_id: Optional[str] = None


class AdminAccountCreate(BaseModel):
    """管理员建号用的载荷（只有管理员能调，见 /admins）。

    和公开的 AdminCreate 分开：注册接口永远不能把 is_admin 交给调用方，
    否则「谁能进后台」就变成注册时自己填的字段。
    """

    username: str = Field(..., min_length=3, max_length=20, pattern=r"^\w+$")
    email: EmailStr
    password: str = Field(..., min_length=8)
    is_admin: bool = True


class AdminAccountUpdate(BaseModel):
    is_admin: bool
