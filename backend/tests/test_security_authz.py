"""Authorization regression tests for signup and admin-only writes."""
import pytest

from app.models import Admin
from app.utils.security import get_password_hash


REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"


@pytest.fixture
def editor_token(client, db):
    """A logged-in account without the admin flag."""
    editor = Admin(
        username="editor",
        email="editor@test.com",
        password_hash=get_password_hash("editor123"),
        is_admin=False,
    )
    db.add(editor)
    db.commit()
    response = client.post(LOGIN_URL, data={"username": "editor", "password": "editor123"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


class TestSignupGate:
    def test_first_account_can_bootstrap(self, client):
        """Empty database still allows the owner to create the first account."""
        response = client.post(
            REGISTER_URL,
            json={"username": "owner", "email": "owner@test.com", "password": "password123"},
        )
        assert response.status_code == 201

    def test_signup_closed_once_an_account_exists(self, client, admin_user):
        """Strangers cannot create extra admin accounts when signup is closed."""
        response = client.post(
            REGISTER_URL,
            json={"username": "stranger", "email": "stranger@test.com", "password": "password123"},
        )
        assert response.status_code == 403
        assert response.json()["detail"] == "Registration is closed"


class TestAdminOnlyWrites:
    def test_non_admin_cannot_create_tag(self, client, editor_token):
        response = client.post("/api/v1/tags", json={"name": "Go"}, headers=editor_token)
        assert response.status_code == 403

    def test_non_admin_cannot_delete_project(self, client, editor_token, test_project):
        response = client.delete(f"/api/v1/projects/{test_project.id}", headers=editor_token)
        assert response.status_code == 403

    def test_non_admin_cannot_read_admin_dashboard(self, client, editor_token):
        response = client.get("/api/v1/stats/admin-dashboard", headers=editor_token)
        assert response.status_code == 403

    def test_admin_can_create_tag(self, client, admin_headers):
        response = client.post("/api/v1/tags", json={"name": "Go"}, headers=admin_headers)
        assert response.status_code == 201
