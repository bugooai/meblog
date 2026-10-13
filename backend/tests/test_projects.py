"""Tests for projects endpoints."""
import pytest


class TestListProjects:
    """Test GET /api/v1/projects endpoint."""

    def test_list_projects_empty(self, client):
        """Test listing projects when none exist."""
        response = client.get("/api/v1/projects")
        assert response.status_code == 200
        assert response.json() == []

    def test_list_projects_with_data(self, client, test_project):
        """Test listing projects with existing data."""
        response = client.get("/api/v1/projects")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "测试项目"
        assert data[0]["slug"] == "test-project"
        assert "post_count" in data[0]


class TestGetProject:
    """Test GET /api/v1/projects/{slug} endpoint."""

    def test_get_project_success(self, client, test_project):
        """Test getting a project by slug."""
        response = client.get("/api/v1/projects/test-project")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "测试项目"
        assert data["slug"] == "test-project"
        assert data["cover"] == "https://example.com/cover.jpg"

    def test_get_project_not_found(self, client):
        """Test getting a non-existent project."""
        response = client.get("/api/v1/projects/nonexistent")
        assert response.status_code == 404
        assert "Project not found" in response.json()["detail"]


class TestCreateProject:
    """Test POST /api/v1/projects endpoint."""

    def test_create_project_success(self, client, admin_headers):
        """Test creating a project."""
        response = client.post(
            "/api/v1/projects",
            json={"name": "新项目", "cover": "https://example.com/new.jpg"},
            headers=admin_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "新项目"
        assert data["slug"] == "xin-xiang-mu"
        assert data["cover"] == "https://example.com/new.jpg"

    def test_create_project_without_cover(self, client, admin_headers):
        """Test creating a project without cover."""
        response = client.post(
            "/api/v1/projects",
            json={"name": "无封面项目"},
            headers=admin_headers
        )
        assert response.status_code == 201
        assert response.json()["cover"] is None

    def test_create_project_unauthorized(self, client):
        """Test creating a project without authentication."""
        response = client.post(
            "/api/v1/projects",
            json={"name": "新项目"}
        )
        assert response.status_code == 401

    def test_create_project_duplicate_name(self, client, admin_headers, test_project):
        """Test creating a project with duplicate name."""
        response = client.post(
            "/api/v1/projects",
            json={"name": "测试项目"},  # Already exists
            headers=admin_headers
        )
        assert response.status_code == 400


class TestUpdateProject:
    """Test PUT /api/v1/projects/{id} endpoint."""

    def test_update_project_success(self, client, admin_headers, test_project):
        """Test updating a project."""
        response = client.put(
            f"/api/v1/projects/{test_project.id}",
            json={"name": "更新后的项目", "cover": "https://example.com/updated.jpg"},
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "更新后的项目"
        assert data["cover"] == "https://example.com/updated.jpg"

    def test_update_project_not_found(self, client, admin_headers):
        """Test updating a non-existent project."""
        response = client.put(
            "/api/v1/projects/99999",
            json={"name": "更新后的项目"},
            headers=admin_headers
        )
        assert response.status_code == 404

    def test_update_project_unauthorized(self, client, test_project):
        """Test updating a project without authentication."""
        response = client.put(
            f"/api/v1/projects/{test_project.id}",
            json={"name": "更新后的项目"}
        )
        assert response.status_code == 401


class TestDeleteProject:
    """Test DELETE /api/v1/projects/{id} endpoint."""

    def test_delete_project_success(self, client, admin_headers, test_project):
        """Test deleting a project."""
        response = client.delete(
            f"/api/v1/projects/{test_project.id}",
            headers=admin_headers
        )
        assert response.status_code == 204

        # Verify it's deleted
        response = client.get(f"/api/v1/projects/{test_project.slug}")
        assert response.status_code == 404

    def test_delete_project_not_found(self, client, admin_headers):
        """Test deleting a non-existent project."""
        response = client.delete(
            "/api/v1/projects/99999",
            headers=admin_headers
        )
        assert response.status_code == 404

    def test_delete_project_unauthorized(self, client, test_project):
        """Test deleting a project without authentication."""
        response = client.delete(f"/api/v1/projects/{test_project.id}")
        assert response.status_code == 401
