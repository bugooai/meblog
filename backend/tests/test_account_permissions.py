"""谁能进后台：公开注册不再送权限，加管理员只能由管理员来做。

根因是 AdminDao.create_admin 里写死的 is_admin=True —— 它是唯一建号入口，所以
只要把 ALLOW_REGISTRATION 设成 true，每个注册账号都是管理员。之前只是用注册开关
把门关上，门后面的逻辑没变。这里锁住修好的行为。
"""
import pytest

from configs import settings

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
ADMINS_URL = "/api/v1/admins"


def _register(client, username, password="password123"):
    return client.post(
        REGISTER_URL,
        json={"username": username, "email": f"{username}@test.com", "password": password},
    )


def _login(client, username, password="password123"):
    response = client.post(LOGIN_URL, data={"username": username, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


class TestRegistrationGrantsNoPrivilege:
    def test_empty_db_first_account_is_admin(self, client):
        """空库 bootstrap：第一个账号必须是管理员，否则没人能进后台。"""
        response = _register(client, "owner")
        assert response.status_code == 201, response.text
        assert response.json()["is_admin"] is True

    def test_open_registration_does_not_grant_admin(self, client, admin_user, monkeypatch):
        """这条就是原来那个洞：开注册之后每个账号都是管理员。"""
        monkeypatch.setattr(settings, "ALLOW_REGISTRATION", True)
        response = _register(client, "reader")
        assert response.status_code == 201, response.text
        assert response.json()["is_admin"] is False

    def test_register_ignores_admin_field_from_payload(self, client, admin_user, monkeypatch):
        """注册载荷里没有 is_admin，多传也不能提权。"""
        monkeypatch.setattr(settings, "ALLOW_REGISTRATION", True)
        response = client.post(
            REGISTER_URL,
            json={"username": "sneaky", "email": "sneaky@test.com", "password": "password123", "is_admin": True},
        )
        assert response.status_code == 201, response.text
        assert response.json()["is_admin"] is False

    def test_registered_account_cannot_reach_admin_apis(self, client, admin_user, monkeypatch):
        monkeypatch.setattr(settings, "ALLOW_REGISTRATION", True)
        assert _register(client, "reader2").status_code == 201
        headers = _login(client, "reader2")

        assert client.get(ADMINS_URL, headers=headers).status_code == 403

        for method, url, payload in (
            ("post", "/api/v1/tags", {"name": "随便建个标签"}),
            ("post", "/api/v1/projects", {"name": "随便建个项目"}),
            ("post", "/api/v1/files/upload", None),
        ):
            if payload is None:
                response = client.post(url, headers=headers)
            else:
                response = client.post(url, json=payload, headers=headers)
            assert response.status_code == 403, f"{method.upper()} {url} -> {response.status_code}"

    def test_closed_registration_still_rejects_second_account(self, client, admin_user):
        """默认关注册的行为没变（这仍然是现在的推荐配置）。"""
        assert _register(client, "late").status_code == 403


class TestAdminAccountEndpoints:
    def test_anonymous_cannot_list_accounts(self, client):
        assert client.get(ADMINS_URL).status_code == 401

    def test_list_includes_flag(self, client, admin_user):
        response = client.get(ADMINS_URL, headers={"Authorization": "Bearer " + client.post(LOGIN_URL, data={"username": "admin", "password": "admin123"}).json()["access_token"]})
        assert response.status_code == 200, response.text
        rows = response.json()
        assert [row["is_admin"] for row in rows] == [True]

    def test_admin_creates_admin(self, client, admin_user, admin_headers):
        response = client.post(
            ADMINS_URL,
            json={"username": "editor", "email": "editor@test.com", "password": "password123", "is_admin": True},
            headers=admin_headers,
        )
        assert response.status_code == 201, response.text
        assert response.json()["is_admin"] is True
        assert _login(client, "editor")[ "Authorization"].startswith("Bearer ")

    def test_admin_creates_plain_account(self, client, admin_user, admin_headers):
        response = client.post(
            ADMINS_URL,
            json={"username": "intern", "email": "intern@test.com", "password": "password123", "is_admin": False},
            headers=admin_headers,
        )
        assert response.status_code == 201, response.text
        assert response.json()["is_admin"] is False

    def test_duplicate_username_rejected(self, client, admin_user, admin_headers):
        response = client.post(
            ADMINS_URL,
            json={"username": "admin", "email": "other@test.com", "password": "password123"},
            headers=admin_headers,
        )
        assert response.status_code == 400

    def test_weak_password_rejected(self, client, admin_user, admin_headers):
        response = client.post(
            ADMINS_URL,
            json={"username": "weak", "email": "weak@test.com", "password": "123"},
            headers=admin_headers,
        )
        assert response.status_code == 422


class TestPromoteAndDemote:
    def _make_account(self, client, admin_headers, username, is_admin):
        response = client.post(
            ADMINS_URL,
            json={
                "username": username,
                "email": f"{username}@test.com",
                "password": "password123",
                "is_admin": is_admin,
            },
            headers=admin_headers,
        )
        assert response.status_code == 201, response.text
        return response.json()["id"]

    def test_promote_then_demote(self, client, admin_user, admin_headers):
        account_id = self._make_account(client, admin_headers, "willbe", False)
        promoted = client.patch(ADMINS_URL + f"/{account_id}", json={"is_admin": True}, headers=admin_headers)
        assert promoted.status_code == 200, promoted.text
        assert promoted.json()["is_admin"] is True

        demoted = client.patch(ADMINS_URL + f"/{account_id}", json={"is_admin": False}, headers=admin_headers)
        assert demoted.status_code == 200, demoted.text
        assert demoted.json()["is_admin"] is False

        # 降下去之后立刻进不了后台
        assert client.get(ADMINS_URL, headers=_login(client, "willbe")).status_code == 403

    def test_cannot_demote_self(self, client, admin_user, admin_headers):
        """把自己降权就再没人能把自己提回来 —— 这是唯一的锁门风险。"""
        response = client.patch(ADMINS_URL + f"/{admin_user.id}", json={"is_admin": False}, headers=admin_headers)
        assert response.status_code == 400, response.text
        assert "自己" in response.json()["detail"]
        assert client.get(ADMINS_URL, headers=admin_headers).status_code == 200

    def test_unknown_account_is_404(self, client, admin_user, admin_headers):
        response = client.patch(ADMINS_URL + "/does-not-exist", json={"is_admin": True}, headers=admin_headers)
        assert response.status_code == 404

    def test_second_admin_can_demote_the_first(self, client, admin_user, admin_headers):
        """两个管理员时互相降权是允许的：操作者自己还在，站不会没人能管。"""
        other_id = self._make_account(client, admin_headers, "otheradmin", True)
        other_headers = _login(client, "otheradmin")
        response = client.patch(ADMINS_URL + f"/{admin_user.id}", json={"is_admin": False}, headers=other_headers)
        assert response.status_code == 200, response.text
        assert client.get(ADMINS_URL, headers=admin_headers).status_code == 403
