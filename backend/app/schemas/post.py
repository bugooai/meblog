from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ProjectInfo(BaseModel):
    id: str
    name: str
    slug: str
    cover: Optional[str] = None
    is_hidden: bool = False

    class Config:
        from_attributes = True


# Alias for backwards compatibility
CategoryInfo = ProjectInfo


class TagInfo(BaseModel):
    id: str
    name: str
    slug: str

    class Config:
        from_attributes = True


class AuthorInfo(BaseModel):
    id: str
    username: str

    class Config:
        from_attributes = True


class PostListItem(BaseModel):
    id: str
    title: str
    slug: str
    cover: Optional[str] = None
    summary: Optional[str]
    view_count: int
    like_count: int
    status: str
    is_hidden: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime
    project: Optional[ProjectInfo] = Field(None, validation_alias="project")
    tags: List[TagInfo] = []

    class Config:
        from_attributes = True


class PostResponse(BaseModel):
    id: str
    title: str
    slug: str
    cover: Optional[str] = None
    content: str
    summary: Optional[str]
    view_count: int
    like_count: int
    status: str
    is_hidden: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    project: Optional[ProjectInfo] = Field(None, validation_alias="project")
    tags: List[TagInfo] = []
    author: Optional[AuthorInfo] = None

    class Config:
        from_attributes = True


class PostListResponse(BaseModel):
    items: List[PostListItem]
    total: int
    page: int
    size: int
    pages: int


class PostCreate(BaseModel):
    title: str = Field(..., max_length=200)
    cover: Optional[str] = None
    content: str
    summary: Optional[str] = Field(None, max_length=500)
    project_id: Optional[str] = None
    tag_ids: List[str] = []
    status: str = "draft"
    is_hidden: bool = False


class PostUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    cover: Optional[str] = None
    content: Optional[str] = None
    summary: Optional[str] = Field(None, max_length=500)
    project_id: Optional[str] = None
    tag_ids: Optional[List[str]] = None
    status: Optional[str] = None
    is_hidden: Optional[bool] = None


class LikeStatusResponse(BaseModel):
    liked: bool  # 当前 visitor 是否点过赞
    like_count: int  # 总点赞数
