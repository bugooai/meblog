import os
import re
from datetime import datetime
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from configs import settings
from app.dao import FileAssetDao
from app.models import Admin
from app.schemas import FileAssetResponse
from app.services.storage import build_storage_key, get_storage_provider

_UNSAFE_FOLDER_CHAR = re.compile(r"[^A-Za-z0-9_-]")
_UNSAFE_EXT_CHAR = re.compile(r"[^A-Za-z0-9]")
_MAX_FOLDER_DEPTH = 4
_DEFAULT_MAX_UPLOAD_MB = 20
_CHUNK_BYTES = 1024 * 1024


class FileAssetService:
    @staticmethod
    def _sign_expires_seconds() -> int:
        value = getattr(settings, "OSS_SIGN_EXPIRE_SECONDS", 3600)
        try:
            return int(value)
        except (TypeError, ValueError):
            return 3600

    @staticmethod
    def _sanitize_folder(folder: str | None) -> str:
        """`folder` 是调用方自由文本，原来直接拼进对象 key。

        `../../x` 这类值会让对象落到预期前缀之外（覆盖别的对象、写到 bucket
        的任何位置），所以只保留安全字符，丢掉 `.` / `..`，并限制层级。
        """
        raw = (folder or "uploads").strip().replace("\\", "/")
        parts: list[str] = []
        for segment in raw.split("/"):
            cleaned = _UNSAFE_FOLDER_CHAR.sub("", segment.strip())
            if cleaned:
                parts.append(cleaned)
        return "/".join(parts[:_MAX_FOLDER_DEPTH]) or "uploads"

    @staticmethod
    def _build_object_key(filename: str, folder: str | None = None) -> str:
        name = os.path.basename((filename or "file").strip())
        raw_ext = os.path.splitext(name)[1]
        ext = _UNSAFE_EXT_CHAR.sub("", raw_ext.lstrip(".")).lower()[:12]
        ext = f".{ext}" if ext else ""
        date_prefix = datetime.utcnow().strftime("%Y/%m/%d")
        return f"{FileAssetService._sanitize_folder(folder)}/{date_prefix}/{uuid4().hex}{ext}"

    @staticmethod
    def _max_upload_bytes() -> int:
        value = getattr(settings, "MAX_UPLOAD_SIZE_MB", _DEFAULT_MAX_UPLOAD_MB)
        try:
            limit_mb = int(value)
        except (TypeError, ValueError):
            limit_mb = _DEFAULT_MAX_UPLOAD_MB
        return max(limit_mb, 1) * 1024 * 1024

    @staticmethod
    async def _read_limited(file: UploadFile) -> bytes:
        """分块读并卡上限；原来是一次 file.read()，大文件直接把内存吃穿。"""
        limit = FileAssetService._max_upload_bytes()
        chunks: list[bytes] = []
        total = 0
        while True:
            chunk = await file.read(min(_CHUNK_BYTES, limit - total + 1))
            if not chunk:
                break
            total += len(chunk)
            if total > limit:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File too large: limit is {limit // (1024 * 1024)} MB",
                )
            chunks.append(chunk)
        return b"".join(chunks)

    @staticmethod
    async def upload_file_service(
        db: AsyncSession,
        file: UploadFile,
        folder: str | None,
        current_admin: Admin,
    ) -> FileAssetResponse:
        payload = await FileAssetService._read_limited(file)
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
