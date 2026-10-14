"""写库的媒体引用必须指向真实存在的对象。

封面/头像存成一个不存在的 oss:// key 时，接口不会报错，前台只是图裂；但爬虫取的
og:image 会 404，分享卡片变白板 —— 坏数据落库后几乎没人会发现。这里锁住保存时的
校验，以及签名地址的可读路径形态。都不需要真实 OSS 密钥。
"""
import pytest
from fastapi import HTTPException

from app.services.storage import AliyunOSSProvider, prepare_media_value
from configs import settings

BUCKET = "test-bucket"


class StubProvider:
    provider_name = "aliyun_oss"

    def __init__(self, existing=("covers/real.png",), sign_ok=True):
        self.existing = set(existing)
        self.sign_ok = sign_ok

    def object_exists(self, object_key):
        return object_key in self.existing

    def sign_get_url(self, object_key, expires_seconds):
        return f"https://signed.test/{object_key}?expires={expires_seconds}"

    def upload_bytes(self, object_key, payload, content_type=None):
        raise AssertionError("not used here")


@pytest.fixture
def bucket_configured(monkeypatch):
    monkeypatch.setattr(settings, "OSS_BUCKET", BUCKET)


class TestPrepareMediaValue:
    def test_existing_object_is_kept_as_storage_key(self, bucket_configured, monkeypatch):
        monkeypatch.setattr("app.services.storage.get_storage_provider", lambda: StubProvider())
        value = prepare_media_value(f"oss://{BUCKET}/covers/real.png")
        assert value == f"oss://{BUCKET}/covers/real.png"

    def test_missing_object_is_rejected(self, bucket_configured, monkeypatch):
        monkeypatch.setattr("app.services.storage.get_storage_provider", lambda: StubProvider())
        with pytest.raises(HTTPException) as exc:
            prepare_media_value(f"oss://{BUCKET}/covers/gone.png")
        assert exc.value.status_code == 400
        assert "covers/gone.png" in exc.value.detail

    def test_public_bucket_url_is_validated_after_normalizing(self, bucket_configured, monkeypatch):
        """后台粘贴直链也会被归一化成 key 再校验，不给坏引用开门。"""
        monkeypatch.setattr("app.services.storage.get_storage_provider", lambda: StubProvider())
        with pytest.raises(HTTPException):
            prepare_media_value(f"https://{BUCKET}.oss-cn-hangzhou.aliyuncs.com/covers/gone.png")

    def test_empty_and_non_storage_values_pass_through(self, bucket_configured, monkeypatch):
        def boom():
            raise AssertionError("should not touch storage for non-oss values")

        monkeypatch.setattr("app.services.storage.get_storage_provider", boom)
        assert prepare_media_value(None) is None
        assert prepare_media_value("") == ""
        assert prepare_media_value("/bugoo-logo.png") == "/bugoo-logo.png"
        assert prepare_media_value("https://example.com/a.png") == "https://example.com/a.png"

    def test_other_bucket_is_left_untouched(self, bucket_configured, monkeypatch):
        monkeypatch.setattr("app.services.storage.get_storage_provider", lambda: StubProvider())
        assert prepare_media_value("oss://another-bucket/covers/real.png") == "oss://another-bucket/covers/real.png"

    def test_storage_outage_does_not_block_saving(self, bucket_configured, monkeypatch):
        """OSS 连不上时不能把文章保存一起打死，读路径本来就有兜底。"""

        def boom():
            raise RuntimeError("OSS config missing")

        monkeypatch.setattr("app.services.storage.get_storage_provider", boom)
        assert prepare_media_value(f"oss://{BUCKET}/covers/whatever.png") == f"oss://{BUCKET}/covers/whatever.png"


class TestSignedUrlShape:
    def test_directory_separators_are_not_percent_encoded(self):
        calls = {}

        class StubBucket:
            def sign_url(self, method, key, expires, slash_safe=False):
                calls.update(method=method, key=key, expires=expires, slash_safe=slash_safe)
                return f"https://stub.test/{key}"

        provider = AliyunOSSProvider.__new__(AliyunOSSProvider)
        provider._bucket = StubBucket()
        provider.sign_get_url("covers/2026-10-14/a.png", 600)
        assert calls["method"] == "GET"
        assert calls["expires"] == 600
        assert calls["slash_safe"] is True

    def test_object_exists_asks_the_bucket(self):
        seen = {}

        class StubBucket:
            def object_exists(self, key):
                seen["key"] = key
                return True

        provider = AliyunOSSProvider.__new__(AliyunOSSProvider)
        provider._bucket = StubBucket()
        assert provider.object_exists("covers/a.png") is True
        assert seen["key"] == "covers/a.png"


class TestPostsApiRejectsBrokenCover:
    def test_create_with_missing_object_returns_400(self, client, admin_headers, bucket_configured, monkeypatch):
        monkeypatch.setattr("app.services.storage.get_storage_provider", lambda: StubProvider())
        response = client.post(
            "/api/v1/posts",
            json={
                "title": "Broken cover",
                "content": "Body",
                "cover": f"oss://{BUCKET}/covers/gone.png",
                "status": "published",
            },
            headers=admin_headers,
        )
        assert response.status_code == 400, response.text

    def test_create_with_existing_object_succeeds(self, client, admin_headers, bucket_configured, monkeypatch):
        monkeypatch.setattr("app.services.storage.get_storage_provider", lambda: StubProvider())
        response = client.post(
            "/api/v1/posts",
            json={
                "title": "Good cover",
                "content": "Body",
                "cover": f"https://{BUCKET}.oss-cn-hangzhou.aliyuncs.com/covers/real.png",
                "status": "published",
            },
            headers=admin_headers,
        )
        assert response.status_code == 201, response.text
        assert response.json()["cover"] == f"oss://{BUCKET}/covers/real.png"

    def test_update_with_missing_object_returns_400(self, client, db, admin_headers, bucket_configured, monkeypatch):
        monkeypatch.setattr("app.services.storage.get_storage_provider", lambda: StubProvider(existing=("covers/real.png",)))
        created = client.post(
            "/api/v1/posts",
            json={"title": "Update me", "content": "Body", "cover": f"oss://{BUCKET}/covers/real.png"},
            headers=admin_headers,
        )
        assert created.status_code == 201, created.text
        post_id = created.json()["id"]

        monkeypatch.setattr("app.services.storage.get_storage_provider", lambda: StubProvider(existing=()))
        response = client.put(
            f"/api/v1/posts/{post_id}",
            json={"cover": f"oss://{BUCKET}/covers/gone.png"},
            headers=admin_headers,
        )
        assert response.status_code == 400, response.text

        from app.models import Post

        db.expire_all()
        kept = db.query(Post).filter(Post.id == post_id).one()
        assert kept.cover == f"oss://{BUCKET}/covers/real.png"
