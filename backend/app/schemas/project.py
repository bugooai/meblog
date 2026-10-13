from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    cover: Optional[str] = None
    is_hidden: bool = False
    is_pinned: bool = False
    sort_order: int = 0
    created_by: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    cover: Optional[str] = None
    is_hidden: Optional[bool] = None
    is_pinned: Optional[bool] = None
    sort_order: Optional[int] = None
    updated_by: Optional[str] = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    slug: str
    cover: Optional[str] = None
    post_count: int = 0
    is_hidden: bool = False
    is_pinned: bool = False
    sort_order: int = 0
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True