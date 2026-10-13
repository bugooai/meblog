"""Tests for tags endpoints."""
import pytest


class TestListTags:
    """Test GET /api/v1/tags endpoint."""

    def test_list_tags_empty(self, client):
        """Test listing tags when none exist."""
        response = client.get("/api/v1/tags")
        assert response.status_code == 200
        assert response.json() == []

    def test_list_tags_with_data(self, client, test_tag):
        """Test listing tags with existing data."""
        response = client.get("/api/v1/tags")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Python"
        assert data[0]["slug"] == "python"


class TestCreateTag:
    """Test POST /api/v1/tags endpoint."""

    def test_create_tag_success(self, client, admin_headers):
        """Test creating a tag."""
        response = client.post(
            "/api/v1/tags",
            json={"name": "JavaScript"},
            headers=admin_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "JavaScript"
        assert data["slug"] == "javascript"

    def test_create_tag_unauthorized(self, client):
        """Test creating a tag without authentication."""
        response = client.post(
            "/api/v1/tags",
            json={"name": "JavaScript"}
        )
        assert response.status_code == 401

    def test_create_tag_duplicate_name(self, client, admin_headers, test_tag):
        """Test creating a tag with duplicate name."""
        response = client.post(
            "/api/v1/tags",
            json={"name": "Python"},  # Already exists
            headers=admin_headers
        )
        assert response.status_code == 400


class TestUpdateTag:
    """Test PUT /api/v1/tags/{id} endpoint."""

    def test_update_tag_success(self, client, admin_headers, test_tag):
        """Test updating a tag."""
        response = client.put(
            f"/api/v1/tags/{test_tag.id}",
            json={"name": "Updated Python"},
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Python"
        assert data["slug"] == "updated-python"  # Slug should also update

    def test_update_tag_not_found(self, client, admin_headers):
        """Test updating a non-existent tag."""
        response = client.put(
            "/api/v1/tags/99999",
            json={"name": "Updated"},
            headers=admin_headers
        )
        assert response.status_code == 404

    def test_update_tag_unauthorized(self, client, test_tag):
        """Test updating a tag without authentication."""
        response = client.put(
            f"/api/v1/tags/{test_tag.id}",
            json={"name": "Updated"}
        )
        assert response.status_code == 401


class TestDeleteTag:
    """Test DELETE /api/v1/tags/{id} endpoint."""

    def test_delete_tag_success(self, client, admin_headers, test_tag):
        """Test deleting a tag."""
        response = client.delete(
            f"/api/v1/tags/{test_tag.id}",
            headers=admin_headers
        )
        assert response.status_code == 204

        # Verify deleted
        response = client.get("/api/v1/tags")
        assert len(response.json()) == 0

    def test_delete_tag_not_found(self, client, admin_headers):
        """Test deleting a non-existent tag."""
        response = client.delete(
            "/api/v1/tags/99999",
            headers=admin_headers
        )
        assert response.status_code == 404

    def test_delete_tag_unauthorized(self, client, test_tag):
        """Test deleting a tag without authentication."""
        response = client.delete(f"/api/v1/tags/{test_tag.id}")
        assert response.status_code == 401
