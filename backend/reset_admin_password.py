#!/usr/bin/env python3
"""一次性重置某个账号的登录口令（运维侧，绕过「忘了旧口令」这件事）。

正常路径不是它：登录后走 `POST /api/v1/auth/change-password` 自助改（需要知道旧口令）。
只有在人已经进不去、又必须恢复登录时才用它，而且**要先留档再改**（见 docs/DEPLOY.md
「重置的两条路」A 段的 `COPY ... TO STDOUT`）。

口令只从 stdin 或环境变量进来，绝不进 argv —— `ps` 的输出和别人家的 shell history
都会原样收下 argv。口径照 `create_tables.py`：地址只从配置读（环境变量 +
`.env.<APP_ENV>`）、打印一律打码、目标不是本地库时必须显式 `--yes`。

    cd backend
    # 本地 SQLite：直接跑，终端会提示输入（不回显）
    APP_ENV=local uv run python reset_admin_password.py

    # 非本地库：先确认连的是哪个库，再加 --yes
    printf '%s' "$NEW_PASSWORD" | APP_ENV=production uv run python reset_admin_password.py --stdin --yes
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from getpass import getpass
from typing import Callable, TextIO

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import DATABASE_URL, SessionLocal
from app.models import Admin
from app.utils.security import get_password_hash, verify_password

# 和 app/schemas/admin.py 的 AdminCreate.password / PasswordChangeRequest.new_password
# 同口径（min_length=8）。这里漏成更短的位数，等于绕过了接口那道闸。
MIN_PASSWORD_LENGTH = 8
ENV_PASSWORD_VAR = "NEW_PASSWORD"

EXIT_OK = 0
EXIT_USAGE = 2
EXIT_NO_ACCOUNT = 3


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


def _describe_hash(password_hash: str) -> str:
    """可以贴进工单的那部分：算法/代价前缀 + 总长度，不含口令也不含完整哈希。

    bcrypt 的前 7 个字符（`$2b$12$`）只有版本和 cost，看不到口令；坏哈希（例如
    种子脚本留下的 `seed-not-for-login`）在这里会一眼露出来，这正是只读诊断要分的
    那两种情况。
    """
    prefix = password_hash[:7] if password_hash.startswith("$2") else password_hash[:4]
    return f"{prefix}… len={len(password_hash)}"


def read_new_password(
    *, use_stdin: bool, stdin: TextIO, stdout: TextIO
) -> tuple[str | None, str]:
    """按 --stdin → 环境变量 → 终端交互 的顺序取口令，返回 (口令, 来源)。

    只去掉行尾换行，不 strip 空格：首尾空格可能是口令的一部分。
    """
    raw: str | None = None
    source = ""
    if use_stdin:
        raw, source = stdin.readline(), "stdin"
    elif ENV_PASSWORD_VAR in os.environ:
        raw, source = os.environ[ENV_PASSWORD_VAR], f"env:{ENV_PASSWORD_VAR}"
    elif getattr(stdin, "isatty", lambda: False)():
        raw, source = getpass("New password: ", stream=stdout), "tty"
    if raw is None:
        return None, "none"
    return raw.rstrip("\r\n"), source


async def reset_password(
    session_factory: Callable[[], AsyncSession], username: str, new_password: str
) -> int:
    """把 `username` 这一行的 `password_hash` 换成新哈希；找不到账号就停手。

    刻意不建号：空库/缺行时该走登录页的初始化面板，而不是让运维脚本随手造一个
    管理员（`app/services/auth.py` 里空库第一个账号一定是管理员）。
    """
    async with session_factory() as db:
        row = (
            await db.execute(select(Admin).where(Admin.username == username))
        ).scalar_one_or_none()
        if row is None:
            print(
                f"没有 username={username} 这一行，未做任何改动。"
                "站里一个账号都没有时用登录页的初始化面板，不要在这里建号。",
                file=sys.stderr,
            )
            return EXIT_NO_ACCOUNT

        print(f"账号: {username}")
        print(f"口令指纹（改前）: {_describe_hash(row.password_hash)}")
        if verify_password(new_password, row.password_hash):
            print("新旧口令相同，未做任何改动。")
            return EXIT_OK

        row.password_hash = get_password_hash(new_password)
        await db.commit()
        print(f"口令指纹（改后）: {_describe_hash(row.password_hash)}")
        print("已更新 1 行；口令和完整哈希都没有打印。")
        return EXIT_OK


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--username", default="admin", help="要重置的账号用户名（默认 admin）")
    parser.add_argument("--stdin", action="store_true", help=f"从标准输入第一行读新口令（优先于 {ENV_PASSWORD_VAR}）")
    parser.add_argument(
        "--yes",
        action="store_true",
        help="确认要写入非本地数据库（不加此参数会拒绝执行）",
    )
    args = parser.parse_args(argv)

    if not _is_local(DATABASE_URL) and not args.yes:
        print(f"Refusing to write to non-local database: {_mask(DATABASE_URL)}", file=sys.stderr)
        print("Add --yes if that really is the intended target.", file=sys.stderr)
        return EXIT_USAGE

    new_password, source = read_new_password(
        use_stdin=args.stdin, stdin=sys.stdin, stdout=sys.stdout
    )
    if new_password is None:
        print(
            f"读不到新口令：用 --stdin、设环境变量 {ENV_PASSWORD_VAR}，或在终端里输入。",
            file=sys.stderr,
        )
        print("不要把口令写成命令行参数 —— argv 会进 ps 输出和 shell history。", file=sys.stderr)
        return EXIT_USAGE
    if len(new_password) < MIN_PASSWORD_LENGTH:
        print(
            f"新口令太短（来源 {source}）：至少 {MIN_PASSWORD_LENGTH} 位，和建号/改密接口同口径。",
            file=sys.stderr,
        )
        return EXIT_USAGE

    print(f"目标库: {_mask(DATABASE_URL)}（口令来源：{source}）")
    return asyncio.run(reset_password(SessionLocal, args.username, new_password))


if __name__ == "__main__":
    raise SystemExit(main())
