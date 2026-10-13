from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from configs import settings
from app.database import get_db
from app.models import Admin
from app.schemas import FileAssetResponse
from app.services import FileAssetService
from app.services.storage import get_storage_provider, normalize_media_value, parse_storage_key
from app.utils.security import get_current_admin_user

router = APIRouter(prefix="/files", tags=["Files"])


def _setting_str(name: str, default: str = "") -> str:
    value = getattr(settings, name, default)
    if value is None:
        return default
    return str(value).strip()


def _setting_int(name: str, default: int) -> int:
    value = getattr(settings, name, default)
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


@router.post("/upload", response_model=FileAssetResponse, status_code=201)
async def upload_file(
    file: UploadFile = File(...),
    folder: str | None = Form(default="uploads"),
    db: AsyncSession = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_user),
):
    return await FileAssetService.upload_file_service(db, file, folder, current_admin)


@router.get("/signed-url")
async def get_signed_url(
    key: str = Query(..., description="Storage key like oss://bucket/path/to/file.png"),
):
    normalized_key = normalize_media_value(key) or key
    parsed = parse_storage_key(normalized_key)
    if not parsed:
        raise HTTPException(status_code=400, detail="Invalid storage key")

    bucket, object_key = parsed
    expected_bucket = _setting_str("OSS_BUCKET")
    if not expected_bucket:
        raise HTTPException(status_code=400, detail="OSS bucket not configured")
    if bucket != expected_bucket:
        raise HTTPException(status_code=400, detail="Storage bucket mismatch")

    try:
        provider = get_storage_provider()
        expires_in = _setting_int("OSS_SIGN_EXPIRE_SECONDS", 3600)
        signed_url = provider.sign_get_url(object_key, expires_in)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Sign url failed: {exc}") from exc

    return {"key": normalized_key, "signed_url": signed_url, "expires_in": expires_in}
