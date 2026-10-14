#!/usr/bin/env python3
"""Check that the configured database is reachable.

地址只从配置读（环境变量 + `.env.<APP_ENV>`），脚本里不再有硬编码连接串。

    cd backend
    APP_ENV=local uv run python test_connection.py
"""

from __future__ import annotations

import asyncio
import sys

from sqlalchemy import text

from app.database import DATABASE_URL, engine


def _mask(url: str) -> str:
    if "://" not in url or "@" not in url:
        return url
    scheme, rest = url.split("://", 1)
    credentials, host = rest.rsplit("@", 1)
    if ":" in credentials:
        user = credentials.split(":", 1)[0]
        credentials = f"{user}:{'*' * 8}"
    return f"{scheme}://{credentials}@{host}"


async def probe() -> tuple[str, str, str]:
    async with engine.connect() as conn:
        if DATABASE_URL.startswith("sqlite"):
            row = (
                await conn.execute(text("SELECT sqlite_version(), 'sqlite', 'main'"))
            ).fetchone()
        else:
            row = (
                await conn.execute(text("SELECT version(), current_user, current_database()"))
            ).fetchone()
    return str(row[0]), str(row[1]), str(row[2])


def main() -> int:
    print(f"Connecting to: {_mask(DATABASE_URL)}")
    try:
        version, user, database = asyncio.run(probe())
    except Exception as exc:  # noqa: BLE001 - a connectivity probe reports any failure
        print(f"FAILED: {exc}", file=sys.stderr)
        return 1
    print(f"OK. server version: {version}")
    print(f"     current user: {user}")
    print(f"     current database: {database}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
