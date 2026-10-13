"""Lightweight API contract tests for list endpoints."""


def test_posts_list_contract(client):
    response = client.get("/api/v1/posts?page=1&size=5")
    assert response.status_code == 200
    payload = response.json()
    assert {"items", "total", "page", "size", "pages"}.issubset(payload.keys())
    assert isinstance(payload["items"], list)
    assert isinstance(payload["total"], int)


def test_tags_list_contract(client):
    response = client.get("/api/v1/tags")
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    if payload:
        assert {"id", "name", "slug"}.issubset(payload[0].keys())


def test_projects_list_contract(client):
    response = client.get("/api/v1/projects")
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    if payload:
        assert {"id", "name", "slug"}.issubset(payload[0].keys())
