from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime


class CommentCreate(BaseModel):
    post_id: str
    parent_id: Optional[str] = None
    nickname: str = Field(..., max_length=50)
    email: str = Field(..., max_length=100)
    website: Optional[str] = Field(None, max_length=200)
    content: str


class CommentResponse(BaseModel):
    id: str
    post_id: str
    parent_id: Optional[str] = None
    nickname: str
    email: Optional[str] = None  # 仅管理员可见，非管理员为 None
    website: Optional[str] = None  # 个人网站
    content: str
    created_at: datetime
    replies: List["CommentResponse"] = []

    class Config:
        from_attributes = True


class CommentListResponse(BaseModel):
    items: List[CommentResponse]
    total: int
