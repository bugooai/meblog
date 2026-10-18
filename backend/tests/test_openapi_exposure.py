"""OpenAPI 文档的暴露开关：默认关、只有本地开，而且开关确实接到了 FastAPI 上。

2026-10-18 线上实测：`GET /api/v1/openapi.json` 不用登录就返回 42 KB 的完整路由
清单，而 `/docs` 是 404 —— 因为 nginx 只把 `/api/*` 转给后端。等于门面关了、图纸
还挂在门口。下面几条锁住「默认不出图纸」和「开关真的接线了」这两件事。
"""

import pytest

from app.main import app, build_openapi_url
from configs import settings
from configs.base import BaseSettingsConfig
from configs.local import LocalSettings
from configs.production import ProductionSettings
# 别名导入：pytest 会采集模块里名字以 Test 开头的类，直接叫 TestSettings 会多出
# 一条 PytestCollectionWarning（它是 pydantic 配置类，不是测试）。
from configs.test import TestSettings as TestEnvSettings


def test_build_openapi_url_switch():
    assert build_openapi_url(True, "/api/v1") == "/api/v1/openapi.json"
    assert build_openapi_url(False, "/api/v1") is None


def test_only_local_exposes_schema_by_default():
    # 读字段默认值而不是实例化：实例化会去读对应环境的 .env 文件，
    # 那会把「代码里的默认口径」和「某台机上碰巧配了什么」混在一起。
    assert BaseSettingsConfig.model_fields["EXPOSE_OPENAPI"].default is False
    assert ProductionSettings.model_fields["EXPOSE_OPENAPI"].default is False
    assert TestEnvSettings.model_fields["EXPOSE_OPENAPI"].default is False
    assert LocalSettings.model_fields["EXPOSE_OPENAPI"].default is True


def test_app_wiring_follows_the_setting():
    # 不管当前 APP_ENV 是什么，app 上的值必须等于开关算出来的那个 ——
    # 否则就是「配了不生效」，正是这次要防的漂移。
    assert app.openapi_url == build_openapi_url(
        settings.EXPOSE_OPENAPI, settings.API_V1_STR
    )


@pytest.mark.skipif(
    settings.EXPOSE_OPENAPI,
    reason="当前环境显式开了 OpenAPI，跳过「默认不可达」这组断言",
)
def test_schema_and_docs_are_not_reachable(client):
    assert client.get("/api/v1/openapi.json").status_code == 404
    assert client.get("/openapi.json").status_code == 404
    assert client.get("/docs").status_code == 404
    # 关掉的只是文档，服务本身照常
    assert client.get("/health").status_code == 200
