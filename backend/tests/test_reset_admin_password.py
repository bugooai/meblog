"""Tests for the ops-side one-shot reset script (`backend/reset_admin_password.py`).

口径来源：口令只能从 stdin / 环境变量 / 终端进来，打印必须打码，非本地库要显式 `--yes`。
"""
import asyncio
import io
import os

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import reset_admin_password as script
from app.database import Base
from app.models import Admin
from app.utils.security import get_password_hash, verify_password


def _make_db(tmp_path, name="admin", password="admin123"):
    """建一个带数据的临时 SQLite 库，返回 (库地址, session 工厂)。"""
    path = tmp_path / "reset.db"
    url = f"sqlite:///{path}"
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    sync_engine = create_engine(url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(sync_engine)
    Session = sessionmaker(bind=sync_engine)
    with Session() as row_session:
        row_session.add(
            Admin(
                username=name,
                email=f"{name}@test.com",
                password_hash=get_password_hash(password),
                is_admin=True,
            )
        )
        row_session.commit()
    sync_engine.dispose()

    async_url = url.replace("sqlite://", "sqlite+aiosqlite://", 1)
    engine = create_async_engine(async_url, poolclass=NullPool)
    return url, async_sessionmaker(bind=engine, expire_on_commit=False)


def _stored_hash(session_factory, username="admin"):
    async def fetch():
        async with session_factory() as db:
            row = (
                await db.execute(select(Admin).where(Admin.username == username))
            ).scalar_one()
            return row.password_hash

    return asyncio.run(fetch())


class TestReadNewPassword:
    """口令来源：只接受 stdin / 环境变量 / 终端，不接受命令行参数。"""

    def test_reads_from_env(self, monkeypatch):
        monkeypatch.setenv(script.ENV_PASSWORD_VAR, "envpass1234")
        password, source = script.read_new_password(
            use_stdin=False, stdin=io.StringIO(""), stdout=io.StringIO()
        )
        assert password == "envpass1234"
        assert source == f"env:{script.ENV_PASSWORD_VAR}"

    def test_stdin_flag_wins_over_env(self, monkeypatch):
        monkeypatch.setenv(script.ENV_PASSWORD_VAR, "envpass1234")
        password, source = script.read_new_password(
            use_stdin=True, stdin=io.StringIO("stdinpass1234\n"), stdout=io.StringIO()
        )
        assert password == "stdinpass1234"
        assert source == "stdin"

    def test_only_drops_line_endings(self):
        """首尾空格可能是口令的一部分，不能 strip 掉。"""
        password, _ = script.read_new_password(
            use_stdin=True, stdin=io.StringIO("  pass1234 \r\n"), stdout=io.StringIO()
        )
        assert password == "  pass1234 "

    def test_no_source_returns_none(self, monkeypatch):
        monkeypatch.delenv(script.ENV_PASSWORD_VAR, raising=False)
        stdin = io.StringIO("whatever\n")  # 不是 tty
        password, source = script.read_new_password(
            use_stdin=False, stdin=stdin, stdout=io.StringIO()
        )
        assert password is None
        assert source == "none"


class TestDescribeHash:
    """能贴进工单的只有前缀和长度，完整哈希和口令都不行。"""

    def test_valid_bcrypt_hash(self):
        described = script._describe_hash(get_password_hash("whatever12345"))
        assert described.startswith("$2b$12$")
        assert "len=60" in described

    def test_placeholder_hash_is_obvious(self):
        """种子值这类坏哈希要一眼看得出来（它和「输错口令」在页面上长得一样）。"""
        described = script._describe_hash("seed-not-for-login")
        assert described == "seed… len=18"


class TestLocalDatabaseGate:
    """非本地库必须显式 --yes，且打印出来的地址口令打码。"""

    def test_refuses_remote_without_yes(self, monkeypatch, capsys):
        monkeypatch.setattr(
            script, "DATABASE_URL", "postgresql+asyncpg://bob:topsecret@db.example.com:5432/meblog"
        )
        assert script.main(["--stdin"]) == script.EXIT_USAGE
        captured = capsys.readouterr()
        assert "Refusing to write to non-local database" in captured.err
        assert "topsecret" not in captured.out + captured.err
        assert "********" in captured.err

    def test_accepts_sqlite_without_yes(self, tmp_path, monkeypatch, capsys):
        url, session_factory = _make_db(tmp_path)
        monkeypatch.setattr(script, "DATABASE_URL", url)
        monkeypatch.setattr(script, "SessionLocal", session_factory)
        monkeypatch.setattr(script.sys, "stdin", io.StringIO("freshpass123\n"))

        assert script.main(["--stdin"]) == script.EXIT_OK
        assert verify_password("freshpass123", _stored_hash(session_factory))
        captured = capsys.readouterr()
        assert "freshpass123" not in captured.out + captured.err


class TestMainPasswordValidation:
    def test_too_short_is_rejected_before_touching_db(self, tmp_path, monkeypatch, capsys):
        url, session_factory = _make_db(tmp_path)
        monkeypatch.setattr(script, "DATABASE_URL", url)
        monkeypatch.setattr(script, "SessionLocal", session_factory)
        monkeypatch.setattr(script.sys, "stdin", io.StringIO("short12\n"))

        before = _stored_hash(session_factory)
        assert script.main(["--stdin"]) == script.EXIT_USAGE
        assert _stored_hash(session_factory) == before
        assert str(script.MIN_PASSWORD_LENGTH) in capsys.readouterr().err

    def test_missing_password_source_is_rejected(self, tmp_path, monkeypatch, capsys):
        url, session_factory = _make_db(tmp_path)
        monkeypatch.setattr(script, "DATABASE_URL", url)
        monkeypatch.setattr(script, "SessionLocal", session_factory)
        monkeypatch.delenv(script.ENV_PASSWORD_VAR, raising=False)
        monkeypatch.delenv(script.ENV_PASSWORD_VAR, raising=False)

        assert script.main([]) == script.EXIT_USAGE
        assert "读不到新口令" in capsys.readouterr().err


class TestResetPassword:
    def test_updates_the_row(self, tmp_path):
        _, session_factory = _make_db(tmp_path)
        before = _stored_hash(session_factory)

        code = asyncio.run(script.reset_password(session_factory, "admin", "freshpass123"))

        assert code == script.EXIT_OK
        after = _stored_hash(session_factory)
        assert after != before
        assert verify_password("freshpass123", after)
        assert not verify_password("admin123", after)

    def test_reports_only_fingerprint(self, tmp_path, capsys):
        _, session_factory = _make_db(tmp_path)
        asyncio.run(script.reset_password(session_factory, "admin", "freshpass123"))
        out = capsys.readouterr().out
        assert "freshpass123" not in out
        assert "admin123" not in out
        assert "len=60" in out
        assert "已更新 1 行" in out

    def test_unknown_account_is_not_created(self, tmp_path, capsys):
        _, session_factory = _make_db(tmp_path)

        code = asyncio.run(script.reset_password(session_factory, "ghost", "freshpass123"))

        assert code == script.EXIT_NO_ACCOUNT
        assert "没有 username=ghost" in capsys.readouterr().err

        async def count():
            async with session_factory() as db:
                return len((await db.execute(select(Admin))).scalars().all())

        assert asyncio.run(count()) == 1

    def test_same_password_leaves_hash_untouched(self, tmp_path, capsys):
        _, session_factory = _make_db(tmp_path)
        before = _stored_hash(session_factory)

        code = asyncio.run(script.reset_password(session_factory, "admin", "admin123"))

        assert code == script.EXIT_OK
        assert _stored_hash(session_factory) == before
        assert "新旧口令相同" in capsys.readouterr().out
