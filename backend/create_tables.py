#!/usr/bin/env python3
"""Create all tables for the database selected by the current APP_ENV.

本地一般不需要跑这个脚本：`app/main.py` 的 startup 钩子已经会建表。
需要手工建表时（例如第一次给 PostgreSQL 初始化），显式指定库地址：

    cd backend
    APP_ENV=local DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<db> \
      uv run python create_tables.py --yes

数据库地址只从配置读（环境变量 + `.env.<APP_ENV>`），脚本里不再有硬编码连接串。
非 SQLite 目标必须显式加 `--yes`，避免误连到别人的库。
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from sqlalchemy import text

from app.database import Base, DATABASE_URL, engine


def _mask(url: str) -> str:
    """Hide the password so it never lands in terminal or CI logs."""
    if "://" not in url or "@" not in url:
        return url
    scheme, rest = url.split("://", 1)
    credentials, host = rest.rsplit("@", 1)
    if ":" in credentials:
        user = credentials.split(":", 1)[0]
        credentials = f"{user}:{'*' * 8}"
    return f"{scheme}://{credentials}@{host}"


def _is_local(url: str) -> bool:
    return url.startswith("sqlite") or "localhost" in url or "127.0.0.1" in url


async def create_tables() -> list[str]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if DATABASE_URL.startswith("sqlite"):
            rows = await conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            )
        else:
            rows = await conn.execute(
                text(
                    "SELECT table_name FROM information_schema.tables "
                    "WHERE table_schema='public' ORDER BY table_name"
                )
            )
        return [row[0] for row in rows]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--yes",
        action="store_true",
        help="确认要写入非本地数据库（不加此参数会拒绝执行）",
    )
    args = parser.parse_args(argv)

    if not _is_local(DATABASE_URL) and not args.yes:
        print(f"Refusing to write to non-local database: {_mask(DATABASE_URL)}", file=sys.stderr)
        print("Add --yes if that really is the intended target.", file=sys.stderr)
        return 2

    print(f"Creating tables in: {_mask(DATABASE_URL)}")
    tables = asyncio.run(create_tables())
    print(f"Done. {len(tables)} tables present: {', '.join(tables)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
