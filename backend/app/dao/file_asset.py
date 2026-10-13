from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import FileAsset


class FileAssetDao:
    @staticmethod
    async def get_by_bucket_and_object_key(
        db: AsyncSession,
        *,
        bucket: str,
        object_key: str,
    ) -> FileAsset | None:
        return (
            await db.execute(
                select(FileAsset).where(
                    FileAsset.bucket == bucket,
                    FileAsset.object_key == object_key,
                )
            )
        ).scalar_one_or_none()

    @staticmethod
    async def create_file_asset(
        db: AsyncSession,
        *,
        provider: str,
        bucket: str,
        object_key: str,
        original_filename: str,
        content_type: str | None,
        size_bytes: int,
        url: str,
        created_by: str | None = None,
    ) -> FileAsset:
        asset = FileAsset(
            provider=provider,
            bucket=bucket,
            object_key=object_key,
            original_filename=original_filename,
            content_type=content_type,
            size_bytes=size_bytes,
            url=url,
            created_by=created_by,
        )
        db.add(asset)
        await db.commit()
        await db.refresh(asset)
        return asset
