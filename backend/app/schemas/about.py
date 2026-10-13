from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class TechStackItem(BaseModel):
    name: str
    summary: Optional[str] = None
    sort_order: Optional[int] = None
    background_image_url: Optional[str] = None


class CareerTimelineItem(BaseModel):
    period: str
    title: str
    description: str
    tag: Optional[str] = None
    short_tag: Optional[str] = None


class AboutResponse(BaseModel):
    """Public about page data:博主信息 + 站点设置"""
    username: str
    avatar_url: Optional[str] = None
    avatar_thumb_url: Optional[str] = None
    bio: Optional[str] = None
    tech_stack: Optional[List[str]] = []
    tech_stack_items: List[TechStackItem] = []
    career_timeline: List[CareerTimelineItem] = []
    github_url: Optional[str] = None
    zhihu_url: Optional[str] = None
    twitter_url: Optional[str] = None
    wechat_id: Optional[str] = None
    # Site settings (wechat QR复用)
    wechat_qr_url: Optional[str] = None
    wechat_guide_text: str = "扫码关注公众号，获取更多精彩内容"

    class Config:
        from_attributes = True


class AboutUpdate(BaseModel):
    """Update about data (admin only)"""
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    avatar_thumb_url: Optional[str] = None
    bio: Optional[str] = None
    tech_stack: Optional[List[str]] = None
    tech_stack_items: Optional[List[TechStackItem]] = None
    career_timeline: Optional[List[CareerTimelineItem]] = None
    github_url: Optional[str] = None
    zhihu_url: Optional[str] = None
    twitter_url: Optional[str] = None
    wechat_id: Optional[str] = None
