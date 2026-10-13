import os
from datetime import datetime
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from configs import settings
from app.dao import FileAssetDao
from app.models import Admin
from app.schemas import FileAssetResponse
from app.services.storage import build_storage_key, get_storage_provider


class FileAssetService:
    @staticmethod
    def _sign_expires_seconds() -> int:
        value = getattr(settings, "OSS_SIGN_EXPIRE_SECONDS", 3600)
        try:
            return int(value)
        except (TypeError, ValueError):
            return 3600

    @staticmethod
    def _build_object_key(filename: str, folder: str | None = None) -> str:
        name = (filename or "file").strip()
        _, ext = os.path.splitext(name)
        ext = ext[:16] if ext else ""
        safe_folder = (folder or "uploads").strip().strip("/")
        date_prefix = datetime.utcnow().strftime("%Y/%m/%d")
        return f"{safe_folder}/{date_prefix}/{uuid4().hex}{ext}"

    @staticmethod
    async def upload_file_service(
        db: AsyncSession,
        file: UploadFile,
        folder: str | None,
        current_admin: Admin,
    ) -> FileAssetResponse:
        payload = await file.read()
        if not payload:
            raise HTTPException(status_code=400, detail="Empty file is not allowed")

        object_key = FileAssetService._build_object_key(file.filename or "file.bin", folder)

        try:
            provider = get_storage_provider()
            uploaded = provider.upload_bytes(
                object_key=object_key,
                payload=payload,
                content_type=file.content_type,
            )
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Upload failed: {exc}") from exc

        asset = await FileAssetDao.create_file_asset(
            db,
            provider=uploaded.provider,
            bucket=uploaded.bucket,
            object_key=uploaded.object_key,
            original_filename=file.filename or "file",
            content_type=file.content_type,
            size_bytes=len(payload),
            url=uploaded.url,
            created_by=current_admin.id,
        )
        storage_key = build_storage_key(uploaded.bucket, uploaded.object_key)
        signed_url = provider.sign_get_url(
            uploaded.object_key,
            expires_seconds=FileAssetService._sign_expires_seconds(),
        )
        return FileAssetResponse(
            id=asset.id,
            provider=asset.provider,
            bucket=asset.bucket,
            object_key=asset.object_key,
            original_filename=asset.original_filename,
            content_type=asset.content_type,
            size_bytes=asset.size_bytes,
            url=asset.url,
            storage_key=storage_key,
            signed_url=signed_url,
            created_at=asset.created_at,
        )
