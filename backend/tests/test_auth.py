"""Tests for authentication endpoints."""
import pytest

from app.models import Admin
from app.utils.security import get_password_hash, verify_password


class TestAuthRegister:
    """Test /api/v1/auth/register endpoint."""

    def test_register_success(self, client):
        """Test successful user registration."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": "newuser",
                "email": "newuser@test.com",
                "password": "password123"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["username"] == "newuser"
        assert data["email"] == "newuser@test.com"
        assert "id" in data

    def test_register_duplicate_username(self, client, admin_user):
        """Test registration with existing username."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": "admin",  # Already exists
                "email": "another@test.com",
                "password": "password123"
            }
        )
        assert response.status_code == 400
        assert "Username already registered" in response.json()["detail"]

    def test_register_duplicate_email(self, client, admin_user):
        """Test registration with existing email."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": "anotheruser",
                "email": "admin@test.com",  # Already exists
                "password": "password123"
            }
        )
        assert response.status_code == 400
        assert "Email already registered" in response.json()["detail"]

    def test_register_missing_fields(self, client):
        """Test registration with missing fields."""
        response = client.post(
            "/api/v1/auth/register",
            json={"username": "newuser"}
        )
        assert response.status_code == 422  # Validation error


class TestAuthLogin:
    """Test /api/v1/auth/login endpoint."""

    def test_login_success(self, client, admin_user):
        """Test successful login."""
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "admin", "password": "admin123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client, admin_user):
        """Test login with wrong password."""
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "admin", "password": "wrongpassword"}
        )
        assert response.status_code == 401
        assert "Incorrect username or password" in response.json()["detail"]

    def test_login_nonexistent_user(self, client):
        """Test login with non-existent user."""
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "nonexistent", "password": "password123"}
        )
        assert response.status_code == 401
        assert "Incorrect username or password" in response.json()["detail"]

    def test_login_with_email(self, client, admin_user):
        """Test login using email as username."""
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "admin@test.com", "password": "admin123"}
        )
        assert response.status_code == 200
        assert "access_token" in response.json()


class TestAuthChangePassword:
    """Test /api/v1/auth/change-password endpoint."""

    NEW_PASSWORD = "newpass12345"

    def test_change_password_success(self, client, admin_headers, db):
        """改成功后新口令能登录，旧口令不能。"""
        response = client.post(
            "/api/v1/auth/change-password",
            json={"old_password": "admin123", "new_password": self.NEW_PASSWORD},
            headers=admin_headers,
        )
        assert response.status_code == 200

        assert client.post(
            "/api/v1/auth/login",
            data={"username": "admin", "password": self.NEW_PASSWORD},
        ).status_code == 200
        assert client.post(
            "/api/v1/auth/login",
            data={"username": "admin", "password": "admin123"},
        ).status_code == 401

    def test_change_password_stores_verifiable_hash(self, client, admin_headers, admin_user, db):
        """库里写的是 bcrypt 哈希，不是明文。"""
        client.post(
            "/api/v1/auth/change-password",
            json={"old_password": "admin123", "new_password": self.NEW_PASSWORD},
            headers=admin_headers,
        )
        stored = db.query(Admin).filter(Admin.username == "admin").one().password_hash
        assert stored.startswith("$2b$")
        assert len(stored) == 60
        assert self.NEW_PASSWORD not in stored

    def test_change_password_never_echoes_credentials(self, client, admin_headers):
        """响应里不能出现口令（工单和浏览器历史都会留下响应体）。"""
        response = client.post(
            "/api/v1/auth/change-password",
            json={"old_password": "admin123", "new_password": self.NEW_PASSWORD},
            headers=admin_headers,
        )
        assert self.NEW_PASSWORD not in response.text
        assert "admin123" not in response.text

    def test_change_password_wrong_old_password(self, client, admin_headers, admin_user, db):
        """旧口令不对 → 401，且那一行没被改动。"""
        response = client.post(
            "/api/v1/auth/change-password",
            json={"old_password": "wrongpass", "new_password": self.NEW_PASSWORD},
            headers=admin_headers,
        )
        assert response.status_code == 401
        stored = db.query(Admin).filter(Admin.username == "admin").one().password_hash
        assert verify_password("admin123", stored)

    def test_change_password_new_too_short(self, client, admin_headers, admin_user, db):
        """新口令位数沿用建号口径（min_length=8），太短 → 422 且不改动。"""
        response = client.post(
            "/api/v1/auth/change-password",
            json={"old_password": "admin123", "new_password": "short12"},
            headers=admin_headers,
        )
        assert response.status_code == 422
        stored = db.query(Admin).filter(Admin.username == "admin").one().password_hash
        assert verify_password("admin123", stored)

    def test_change_password_same_as_old(self, client, admin_headers, admin_user, db):
        """新旧同口令 → 400，避免「改了个假的」。"""
        response = client.post(
            "/api/v1/auth/change-password",
            json={"old_password": "admin123", "new_password": "admin123"},
            headers=admin_headers,
        )
        assert response.status_code == 400
        stored = db.query(Admin).filter(Admin.username == "admin").one().password_hash
        assert verify_password("admin123", stored)

    def test_change_password_requires_login(self, client):
        """没有 token → 401（这是写接口，不能匿名改别人的口令）。"""
        response = client.post(
            "/api/v1/auth/change-password",
            json={"old_password": "admin123", "new_password": self.NEW_PASSWORD},
        )
        assert response.status_code == 401

    def test_change_password_works_for_non_admin_account(self, client, db):
        """一般账号也能改自己的口令（改的是自己这一行，不涉及提权）。"""
        db.add(
            Admin(
                username="author",
                email="author@test.com",
                password_hash=get_password_hash("author123"),
                is_admin=False,
            )
        )
        db.commit()
        token = client.post(
            "/api/v1/auth/login", data={"username": "author", "password": "author123"}
        ).json()["access_token"]

        response = client.post(
            "/api/v1/auth/change-password",
            json={"old_password": "author123", "new_password": self.NEW_PASSWORD},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        stored = db.query(Admin).filter(Admin.username == "author").one().password_hash
        assert verify_password(self.NEW_PASSWORD, stored)


class TestAuthMe:
    """Test /api/v1/auth/me endpoint."""

    def test_get_me_success(self, client, admin_user, admin_headers):
        """Test getting current user info."""
        response = client.get("/api/v1/auth/me", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "admin"
        assert data["email"] == "admin@test.com"

    def test_get_me_no_token(self, client):
        """Test getting current user without token."""
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401

    def test_get_me_invalid_token(self, client):
        """Test getting current user with invalid token."""
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid_token"}
        )
        assert response.status_code == 401
