from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class TagCreate(BaseModel):
    name: str = Field(..., max_length=50)
    created_by: Optional[str] = None


class TagUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=50)
    updated_by: Optional[str] = None


class TagResponse(BaseModel):
    id: str
    name: str
    slug: str
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime
    post_count: Optional[int] = 0

    class Config:
        from_attributes = True
