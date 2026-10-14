"""Guard: no credentials baked into tracked source.

历史上 `create_tables.py` / `test_connection.py` 把一台公网测试库的地址和口令写死在
源码里，仓库公开后就是凭据泄露。这个测试把同类问题挡在提交前。
"""

from __future__ import annotations

import os
import re

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

PRUNED_DIRS = {
    ".git",
    "node_modules",
    ".next",
    ".venv",
    "dist",
    "build",
    "__pycache__",
    ".pytest_cache",
    ".turbo",
}

# scheme://<user>:<password>@<host>
CREDENTIAL_URL = re.compile(
    r"[a-zA-Z][a-zA-Z0-9+.\-]*://(?P<credentials>[^\s/:@]+):(?P<secret>[^\s/@]+)@(?P<host>[^\s/'\"?&#]+)"
)

# 本地/容器服务名/占位符，不算泄露
ALLOWED_HOSTS = {
    "localhost",
    "127.0.0.1",
    "::1",
    "db",
    "redis",
    "postgres",
    "common-postgres",
    "common-redis",
    "meblog-backend",
    "meblog-frontend",
}


def _iter_text_files():
    for dirpath, dirnames, filenames in os.walk(REPO_ROOT):
        dirnames[:] = [d for d in dirnames if d not in PRUNED_DIRS]
        for name in filenames:
            path = os.path.join(dirpath, name)
            try:
                if os.path.getsize(path) > 1_000_000:
                    continue
                with open(path, encoding="utf-8") as handle:
                    yield os.path.relpath(path, REPO_ROOT), handle.read()
            except (OSError, UnicodeDecodeError, ValueError):
                continue


def _is_placeholder(value: str) -> bool:
    return value.startswith("<") or "$" in value or "example.com" in value


def test_no_credentials_embedded_in_urls():
    offenders = []
    for relpath, content in _iter_text_files():
        for match in CREDENTIAL_URL.finditer(content):
            if _is_placeholder(match.group("credentials")):
                continue
            host = match.group("host").split(":")[0]
            if host in ALLOWED_HOSTS or _is_placeholder(host):
                continue
            offenders.append(f"{relpath}: {match.group(0)}")

    assert not offenders, (
        "源码里出现了带口令的连接串，改成环境变量 / .env.<APP_ENV> 注入：\n" + "\n".join(offenders)
    )
