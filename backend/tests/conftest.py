import pytest
import sys
import os

# Add the backend directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from configs import settings
from app.main import app
from app.database import Base, get_db
from app.models import Admin
from app.utils.security import get_password_hash


# Create test database from centralized settings
SQLALCHEMY_DATABASE_URL = settings.TEST_DATABASE_URL

engine_kwargs = {}
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    engine_kwargs["poolclass"] = StaticPool

engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_kwargs)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class AsyncSessionAdapter:
    """Adapt sync SQLAlchemy Session to async-like API used by app code."""

    def __init__(self, session):
        self._session = session

    def __getattr__(self, item):
        return getattr(self._session, item)

    async def execute(self, *args, **kwargs):
        return self._session.execute(*args, **kwargs)

    async def commit(self):
        self._session.commit()

    async def rollback(self):
        self._session.rollback()

    async def refresh(self, *args, **kwargs):
        self._session.refresh(*args, **kwargs)

    async def delete(self, *args, **kwargs):
        self._session.delete(*args, **kwargs)

    async def flush(self):
        self._session.flush()


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield AsyncSessionAdapter(db)
    finally:
        db.close()


@pytest.fixture(scope="function")
def db():
    """Create a fresh database for each test."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    """Create a test client with database override."""
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def admin_user(db):
    """Create an admin account for testing."""
    admin = Admin(
        username="admin",
        email="admin@test.com",
        password_hash=get_password_hash("admin123"),
        is_admin=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


@pytest.fixture(scope="function")
def admin_token(client, admin_user):
    """Get admin access token."""
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "admin123"}
    )
    return response.json()["access_token"]


@pytest.fixture(scope="function")
def admin_headers(admin_token):
    """Get admin authorization headers."""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="function")
def test_project(db):
    """Create a test project."""
    from app.models import Project
    project = Project(name="测试项目", slug="test-project", cover="https://example.com/cover.jpg")
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@pytest.fixture(scope="function")
def test_tag(db):
    """Create a test tag."""
    from app.models import Tag
    tag = Tag(name="Python", slug="python")
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag
