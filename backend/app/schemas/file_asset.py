from datetime import datetime

from pydantic import BaseModel


class FileAssetResponse(BaseModel):
    id: str
    provider: str
    bucket: str
    object_key: str
    original_filename: str
    content_type: str | None = None
    size_bytes: int
    url: str
    storage_key: str
    signed_url: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True
