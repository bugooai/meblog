from dataclasses import dataclass
from typing import Protocol
from urllib.parse import unquote, urlparse

import oss2
from fastapi import HTTPException

from configs import settings


@dataclass
class ObjectStorageResult:
    provider: str
    bucket: str
    object_key: str
    url: str


class ObjectStorageProvider(Protocol):
    provider_name: str

    def upload_bytes(self, object_key: str, payload: bytes, content_type: str | None = None) -> ObjectStorageResult:
        ...

    def sign_get_url(self, object_key: str, expires_seconds: int) -> str:
        ...

    def object_exists(self, object_key: str) -> bool:
        ...


class AliyunOSSProvider:
    provider_name = "aliyun_oss"

    def __init__(self) -> None:
        endpoint = _setting_str("OSS_ENDPOINT")
        access_key_id = _setting_str("OSS_ACCESS_KEY_ID")
        access_key_secret = _setting_str("OSS_ACCESS_KEY_SECRET")
        bucket_name = _setting_str("OSS_BUCKET")
        public_base_url = _setting_str("OSS_PUBLIC_BASE_URL").rstrip("/")
        if endpoint and not endpoint.startswith(("http://", "https://")):
            endpoint = f"https://{endpoint}"

        if not endpoint or not access_key_id or not access_key_secret or not bucket_name:
            raise RuntimeError("OSS config missing: OSS_ENDPOINT/OSS_ACCESS_KEY_ID/OSS_ACCESS_KEY_SECRET/OSS_BUCKET")

        self._bucket_name = bucket_name
        self._public_base_url = public_base_url
        auth = oss2.Auth(access_key_id, access_key_secret)
        self._bucket = oss2.Bucket(auth, endpoint, bucket_name)

    def upload_bytes(self, object_key: str, payload: bytes, content_type: str | None = None) -> ObjectStorageResult:
        headers = {}
        if content_type:
            headers["Content-Type"] = content_type

        self._bucket.put_object(object_key, payload, headers=headers)

        if self._public_base_url:
            url = f"{self._public_base_url}/{object_key}"
        else:
            endpoint_host = _normalize_endpoint(_setting_str("OSS_ENDPOINT"))
            url = f"https://{self._bucket_name}.{endpoint_host}/{object_key}"

        return ObjectStorageResult(
            provider=self.provider_name,
            bucket=self._bucket_name,
            object_key=object_key,
            url=url,
        )

    def sign_get_url(self, object_key: str, expires_seconds: int) -> str:
        # slash_safe=True 让对象 key 里的目录分隔符保持成 `/`，而不是被转义成 `%2F`。
        # og:image / RSS 里的地址要经过微信、Twitter 等各种抓取器和中间层，它们对
        # `%2F` 的处理不一致，规范化成 `/` 才是标准形态。
        return self._bucket.sign_url("GET", object_key, expires_seconds, slash_safe=True)

    def object_exists(self, object_key: str) -> bool:
        return self._bucket.object_exists(object_key)


def build_storage_key(bucket: str, object_key: str) -> str:
    return f"oss://{bucket}/{object_key.lstrip('/')}"


def parse_storage_key(value: str) -> tuple[str, str] | None:
    if not value or not value.startswith("oss://"):
        return None
    raw = value[len("oss://") :]
    parts = raw.split("/", 1)
    if len(parts) != 2:
        return None
    bucket, object_key = parts[0].strip(), parts[1].strip()
    if not bucket or not object_key:
        return None
    return bucket, object_key


def _normalize_endpoint(endpoint: str) -> str:
    normalized = (endpoint or "").strip().lower()
    if normalized.startswith("https://"):
        normalized = normalized[len("https://") :]
    elif normalized.startswith("http://"):
        normalized = normalized[len("http://") :]
    return normalized.strip("/")


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


def _extract_oss_object_key_from_url(value: str) -> str | None:
    parsed = urlparse(value)
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.netloc:
        return None

    host = parsed.netloc.lower()
    decoded_path = unquote((parsed.path or "").lstrip("/"))
    if not decoded_path:
        return None

    bucket = _setting_str("OSS_BUCKET")
    endpoint = _normalize_endpoint(_setting_str("OSS_ENDPOINT"))
    if bucket and host.startswith(f"{bucket}.".lower()):
        return decoded_path
    if bucket and endpoint and host == f"{bucket}.{endpoint}".lower():
        return decoded_path

    public_base_url = _setting_str("OSS_PUBLIC_BASE_URL")
    if public_base_url:
        public = urlparse(public_base_url if "://" in public_base_url else f"https://{public_base_url}")
        if public.netloc and host == public.netloc.lower():
            prefix = (public.path or "").strip("/")
            candidate = decoded_path
            if prefix:
                if candidate == prefix:
                    return None
                if not candidate.startswith(f"{prefix}/"):
                    return None
                candidate = candidate[len(prefix) + 1 :]
            return candidate or None

    return None


def normalize_media_value(value: str | None) -> str | None:
    if not value:
        return value

    parsed = parse_storage_key(value)
    if parsed:
        return value

    object_key = _extract_oss_object_key_from_url(value)
    bucket = _setting_str("OSS_BUCKET")
    if object_key and bucket:
        return build_storage_key(bucket, object_key)
    return value


def ensure_media_exists(value: str | None) -> None:
    """存进库的媒体引用必须指向 bucket 里真实存在的对象。

    key 写错时接口不会报错，页面也只是图裂，但爬虫拿到的 og:image 会 404 ——
    分享卡片直接变白板，而且坏数据一旦落库就很难发现。与其事后查，不如保存时就拒绝。
    """
    parsed = parse_storage_key(value or "")
    if not parsed:
        return

    bucket, object_key = parsed
    if bucket != _setting_str("OSS_BUCKET"):
        return

    try:
        exists = get_storage_provider().object_exists(object_key)
    except Exception:
        # 存储后端本身不可用时不该把保存也一起打死，交给读路径的兜底逻辑。
        return

    if not exists:
        raise HTTPException(status_code=400, detail=f"Storage object not found: {object_key}")


def prepare_media_value(value: str | None) -> str | None:
    """写库前统一处理媒体字段：归一化成 oss://bucket/key，再确认对象存在。"""
    normalized = normalize_media_value(value)
    ensure_media_exists(normalized)
    return normalized


def resolve_media_url(value: str | None) -> str | None:
    if not value:
        return value

    normalized_value = normalize_media_value(value)
    parsed = parse_storage_key(normalized_value or "")
    if not parsed:
        return value

    bucket, object_key = parsed
    expected_bucket = _setting_str("OSS_BUCKET")
    if not expected_bucket or bucket != expected_bucket:
        return value

    try:
        provider = get_storage_provider()
        return provider.sign_get_url(object_key, _setting_int("OSS_SIGN_EXPIRE_SECONDS", 3600))
    except Exception:
        return value


def get_storage_provider() -> ObjectStorageProvider:
    provider = _setting_str("OSS_PROVIDER", "aliyun_oss").lower()
    if provider in {"aliyun", "aliyun_oss"}:
        return AliyunOSSProvider()
    raise RuntimeError(f"Unsupported OSS provider: {provider}")
