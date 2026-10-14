"""Object-storage upload path: key sanitizing, size cap, signed-url containment.

These tests run without any OSS credentials — the provider is faked — so the
upload contract stays verifiable on a clean checkout.
"""
import re

import pytest

from app.models import Admin, FileAsset
from app.services.file_asset import FileAssetService
from app.services.storage import (
    build_storage_key,
    normalize_media_value,
    parse_storage_key,
    resolve_media_url,
)
from app.utils.security import get_password_hash
from configs import settings

UPLOAD_URL = "/api/v1/files/upload"


class FakeProvider:
    provider_name = "aliyun_oss"

    def __init__(self, bucket: str = "test-bucket") -> None:
        self.bucket = bucket
        self.uploaded_keys: list[str] = []

    def upload_bytes(self, object_key, payload, content_type=None):
        self.uploaded_keys.append(object_key)
        return _result(object_key, payload, self.bucket)

    def sign_get_url(self, object_key, expires_seconds):
        return f"https://signed.test/{object_key}?expires={expires_seconds}"


def _result(object_key, payload, bucket):
    from app.services.storage import ObjectStorageResult

    return ObjectStorageResult(
        provider="aliyun_oss",
        bucket=bucket,
        object_key=object_key,
        url=f"https://{bucket}.oss-cn-hangzhou.aliyuncs.com/{object_key}",
    )


@pytest.fixture
def fake_provider(monkeypatch):
    provider = FakeProvider()
    monkeypatch.setattr("app.services.file_asset.get_storage_provider", lambda: provider)
    monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE_MB", 20)
    return provider


@pytest.fixture
def editor_headers(client, db):
    db.add(
        Admin(
            username="editor",
            email="editor@test.com",
            password_hash=get_password_hash("editor123"),
            is_admin=False,
        )
    )
    db.commit()
    response = client.post("/api/v1/auth/login", data={"username": "editor", "password": "editor123"})
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


class TestSanitizeFolder:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            (None, "uploads"),
            ("", "uploads"),
            ("covers", "covers"),
            ("blog/covers", "blog/covers"),
            ("../../etc/passwd", "etc/passwd"),
            ("/../weird/../", "weird"),
            # 越界段直接被丢掉（不是按文件系统语义回退），结果仍落在预期前缀内
            ("a/../b", "a/b"),
            ("a\\b", "a/b"),  # 反斜杠按分隔符处理，塞不进 Windows 风格路径
            ("post.cover", "postcover"),
            ("   ", "uploads"),
            ("1/2/3/4/5/6", "1/2/3/4"),
        ],
    )
    def test_folder_is_constrained(self, raw, expected):
        assert FileAssetService._sanitize_folder(raw) == expected


class TestBuildObjectKey:
    def test_traversal_never_reaches_the_key(self):
        key = FileAssetService._build_object_key("x.png", "../../etc/ssh")
        assert ".." not in key
        assert key.startswith("etc/ssh/")

    def test_key_shape_and_extension(self):
        key = FileAssetService._build_object_key("My.Photo.PNG", "covers")
        assert re.fullmatch(r"covers/\d{4}/\d{2}/\d{2}/[0-9a-f]{32}\.png", key), key

    def test_windows_path_filename_keeps_only_extension(self):
        key = FileAssetService._build_object_key(r"C:\pics\a.tar.gz", "uploads")
        assert key.endswith(".gz")
        assert "\\" not in key and ":" not in key

    def test_odd_extension_is_stripped(self):
        key = FileAssetService._build_object_key("a.png?x=1", "uploads")
        assert re.fullmatch(r"uploads/\d{4}/\d{2}/\d{2}/[0-9a-f]{32}\.pngx1", key), key


class TestUploadEndpoint:
    def test_admin_upload_returns_storage_key_and_persists(self, client, db, admin_headers, fake_provider):
        response = client.post(
            UPLOAD_URL,
            files={"file": ("cover.png", b"\x89PNG-fake-bytes", "image/png")},
            data={"folder": "covers"},
            headers=admin_headers,
        )
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["storage_key"] == f"oss://test-bucket/{body['object_key']}"
        assert body["signed_url"].startswith("https://signed.test/")
        assert body["size_bytes"] == len(b"\x89PNG-fake-bytes")
        assert db.query(FileAsset).filter(FileAsset.object_key == body["object_key"]).count() == 1
        assert fake_provider.uploaded_keys == [body["object_key"]]

    def test_oversize_file_is_rejected_before_hitting_storage(self, client, admin_headers, fake_provider, monkeypatch):
        monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE_MB", 1)
        response = client.post(
            UPLOAD_URL,
            files={"file": ("big.png", b"x" * (1024 * 1024 + 10), "image/png")},
            headers=admin_headers,
        )
        assert response.status_code == 413
        assert "limit is 1 MB" in response.json()["detail"]
        assert fake_provider.uploaded_keys == []

    def test_file_exactly_at_the_limit_is_allowed(self, client, admin_headers, fake_provider, monkeypatch):
        monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE_MB", 1)
        response = client.post(
            UPLOAD_URL,
            files={"file": ("edge.png", b"y" * (1024 * 1024), "image/png")},
            headers=admin_headers,
        )
        assert response.status_code == 201, response.text

    def test_empty_file_rejected(self, client, admin_headers, fake_provider):
        response = client.post(UPLOAD_URL, files={"file": ("e.png", b"", "image/png")}, headers=admin_headers)
        assert response.status_code == 400
        assert fake_provider.uploaded_keys == []

    def test_anonymous_cannot_upload(self, client, fake_provider):
        response = client.post(UPLOAD_URL, files={"file": ("a.png", b"data", "image/png")})
        assert response.status_code in (401, 403)
        assert fake_provider.uploaded_keys == []

    def test_non_admin_cannot_upload(self, client, editor_headers, fake_provider):
        response = client.post(
            UPLOAD_URL, files={"file": ("a.png", b"data", "image/png")}, headers=editor_headers
        )
        assert response.status_code == 403
        assert fake_provider.uploaded_keys == []

    def test_upload_failure_surfaces_as_500_not_a_partial_row(self, client, db, admin_headers, monkeypatch):
        def boom():
            raise RuntimeError("OSS config missing: OSS_ENDPOINT")

        monkeypatch.setattr("app.services.file_asset.get_storage_provider", boom)
        response = client.post(UPLOAD_URL, files={"file": ("a.png", b"data", "image/png")}, headers=admin_headers)
        assert response.status_code == 500
        assert "OSS config missing" in response.json()["detail"]
        assert db.query(FileAsset).count() == 0


class TestSignedUrlEndpoint:
    @pytest.fixture
    def configured(self, monkeypatch):
        monkeypatch.setattr(settings, "OSS_BUCKET", "test-bucket")
        monkeypatch.setattr("app.api.files.get_storage_provider", lambda: FakeProvider())

    def test_own_bucket_key_is_signed(self, client, configured):
        response = client.get("/api/v1/files/signed-url", params={"key": "oss://test-bucket/covers/a.png"})
        assert response.status_code == 200
        assert response.json()["signed_url"] == "https://signed.test/covers/a.png?expires=3600"

    def test_foreign_bucket_is_refused(self, client, configured):
        response = client.get("/api/v1/files/signed-url", params={"key": "oss://victim-bucket/secret.pdf"})
        assert response.status_code == 400
        assert response.json()["detail"] == "Storage bucket mismatch"

    def test_plain_path_is_refused(self, client, configured):
        response = client.get("/api/v1/files/signed-url", params={"key": "/etc/passwd"})
        assert response.status_code == 400

    def test_missing_bucket_config_is_refused(self, client, monkeypatch):
        monkeypatch.setattr(settings, "OSS_BUCKET", "")
        response = client.get("/api/v1/files/signed-url", params={"key": "oss://test-bucket/a.png"})
        assert response.status_code == 400


class TestStorageKeyHelpers:
    def test_build_strips_leading_slash(self):
        assert build_storage_key("b", "/a/b.png") == "oss://b/a/b.png"

    def test_parse_roundtrip(self):
        assert parse_storage_key("oss://b/a/b.png") == ("b", "a/b.png")
        assert parse_storage_key("https://example.com/a.png") is None
        assert parse_storage_key("oss://b") is None
        assert parse_storage_key("oss:///a.png") is None

    def test_public_url_normalizes_back_to_storage_key(self, monkeypatch):
        monkeypatch.setattr(settings, "OSS_BUCKET", "test-bucket")
        value = normalize_media_value("https://test-bucket.oss-cn-hangzhou.aliyuncs.com/covers/a.png")
        assert value == "oss://test-bucket/covers/a.png"

    def test_unrelated_url_is_left_alone(self, monkeypatch):
        monkeypatch.setattr(settings, "OSS_BUCKET", "test-bucket")
        assert normalize_media_value("https://gitee.com/x/y.png") == "https://gitee.com/x/y.png"

    def test_resolve_signs_bucket_keys(self, monkeypatch):
        monkeypatch.setattr(settings, "OSS_BUCKET", "test-bucket")
        monkeypatch.setattr("app.services.storage.get_storage_provider", lambda: FakeProvider())
        assert resolve_media_url("oss://test-bucket/a.png") == "https://signed.test/a.png?expires=3600"

    def test_resolve_falls_back_when_storage_is_unconfigured(self, monkeypatch):
        """没配 OSS 时前台不能因此 500 —— 原值直接返回，页面上只是图裂。"""
        monkeypatch.setattr(settings, "OSS_BUCKET", "test-bucket")

        def boom():
            raise RuntimeError("OSS config missing")

        monkeypatch.setattr("app.services.storage.get_storage_provider", boom)
        assert resolve_media_url("oss://test-bucket/a.png") == "oss://test-bucket/a.png"

    def test_resolve_passes_through_non_storage_values(self):
        assert resolve_media_url("/bugoo-logo.png") == "/bugoo-logo.png"
        assert resolve_media_url(None) is None
