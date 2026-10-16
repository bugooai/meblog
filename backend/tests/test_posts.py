"""Tests for posts endpoints."""
import pytest


class TestListPosts:
    """Test GET /api/v1/posts endpoint."""

    def test_list_posts_empty(self, client):
        """Test listing posts when none exist."""
        response = client.get("/api/v1/posts")
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0

    def test_list_posts_pagination(self, client, admin_user, admin_headers, test_project, db):
        """Test posts pagination."""
        from app.models import Post
        # Create 15 posts
        for i in range(15):
            post = Post(
                title=f"Post {i}",
                slug=f"post-{i}",
                content=f"Content {i}",
                status="published",
                user_id=admin_user.id,
                project_id=test_project.id
            )
            db.add(post)
        db.commit()

        # First page
        response = client.get("/api/v1/posts?page=1&size=10")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 10
        assert data["total"] == 15
        assert data["page"] == 1
        assert data["size"] == 10
        assert data["pages"] == 2

        # Second page
        response = client.get("/api/v1/posts?page=2&size=10")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 5

    def test_list_posts_only_published_for_anonymous(self, client, admin_user, admin_headers, db):
        """Unpublished posts need include_unpublished, and the flag needs an admin token."""
        from app.models import Post
        # Create published and draft posts with unique slugs
        for i, status in enumerate(["published", "draft", "published"]):
            post = Post(
                title=f"Post {status} {i}",
                slug=f"post-{status}-{i}",
                content="Content",
                status=status,
                user_id=admin_user.id
            )
            db.add(post)
        db.commit()

        # Anonymous user
        response = client.get("/api/v1/posts")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2  # Only published

        # A token alone does not widen visibility: drafts stay out of the default list.
        response = client.get("/api/v1/posts", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert "post-draft-1" not in [item["slug"] for item in data["items"]]

        # Admin + include_unpublished is the only combination that returns the draft.
        response = client.get("/api/v1/posts?include_unpublished=true", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3
        assert "post-draft-1" in [item["slug"] for item in data["items"]]

        # The flag must not leak drafts to anonymous callers.
        response = client.get("/api/v1/posts?include_unpublished=true")
        assert response.status_code == 200
        assert response.json()["total"] == 2

    def test_list_posts_filter_by_project(self, client, admin_user, admin_headers, db, test_project):
        """Test filtering posts by project."""
        from app.models import Post
        # Create posts with different projects
        p1 = Post(title="P1", slug="p1", content="C1", status="published", user_id=admin_user.id, project_id=test_project.id)
        p2 = Post(title="P2", slug="p2", content="C2", status="published", user_id=admin_user.id, project_id=None)
        db.add_all([p1, p2])
        db.commit()

        response = client.get(f"/api/v1/posts?project={test_project.slug}")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["title"] == "P1"

    def test_list_posts_filter_by_tag(self, client, admin_user, admin_headers, db, test_tag):
        """Test filtering posts by tag."""
        from app.models import Post
        from app.models.tag import post_tags
        post = Post(
            title="Tagged Post",
            slug="tagged-post",
            content="Content",
            status="published",
            user_id=admin_user.id
        )
        db.add(post)
        db.flush()
        db.execute(post_tags.insert().values(post_id=post.id, tag_id=test_tag.id))
        db.commit()

        response = client.get(f"/api/v1/posts?tag={test_tag.slug}")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["title"] == "Tagged Post"


class TestGetPost:
    """Test GET /api/v1/posts/{id_or_slug} endpoint."""

    def test_get_post_by_id(self, client, admin_user, admin_headers, db, test_project):
        """Test getting a post by ID."""
        from app.models import Post
        post = Post(
            title="Test Post",
            slug="test-post",
            content="Test Content",
            summary="Summary",
            status="published",
            user_id=admin_user.id,
            project_id=test_project.id
        )
        db.add(post)
        db.commit()

        response = client.get(f"/api/v1/posts/{post.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Test Post"
        assert data["content"] == "Test Content"
        assert data["summary"] == "Summary"

    def test_get_post_by_slug(self, client, admin_user, admin_headers, db):
        """Test getting a post by slug."""
        from app.models import Post
        post = Post(
            title="Slug Post",
            slug="slug-post",
            content="Content",
            status="published",
            user_id=admin_user.id
        )
        db.add(post)
        db.commit()

        response = client.get("/api/v1/posts/slug-post")
        assert response.status_code == 200
        assert response.json()["title"] == "Slug Post"

    def test_updated_at_falls_back_to_created_at(self, admin_user, db):
        """A row whose updated_at is missing still renders, dated by created_at.

        The HTTP version of this case is no longer constructible: migration 013
        (backend/migrations/sql/013_enforce_posts_timestamps_not_null.sql) backfilled
        NULL updated_at with created_at and then set NOT NULL, so
        `UPDATE posts SET updated_at = NULL` now fails on the constraint itself.
        The same rule lives on in the response builder
        (backend/app/services/post.py:45-47) and still covers an app running ahead
        of an unmigrated schema, so it is asserted against that builder directly,
        with the legacy row kept detached so nothing can flush it back to the table.
        """
        import asyncio
        from app.models import Post
        from app.services.post import PostService
        from tests.conftest import AsyncSessionAdapter

        post = Post(
            title="Legacy Timestamp Post",
            slug="legacy-null-updated-at",
            content="Content",
            status="published",
            user_id=admin_user.id,
        )
        db.add(post)
        db.commit()
        db.refresh(post)
        created_at = post.created_at

        legacy_row = Post(
            id=post.id,
            title=post.title,
            slug=post.slug,
            content=post.content,
            status=post.status,
            user_id=post.user_id,
            project_id=post.project_id,
            created_by=post.created_by,
            updated_by=post.updated_by,
            view_count=post.view_count,
            like_count=post.like_count,
            created_at=created_at,
            updated_at=None,
        )

        data = asyncio.run(PostService._to_post_response(AsyncSessionAdapter(db), legacy_row))

        assert data.slug == "legacy-null-updated-at"
        assert data.updated_at is not None
        assert data.updated_at == created_at
        assert data.created_at == created_at

    def test_get_post_not_found(self, client):
        """Test getting a non-existent post."""
        response = client.get("/api/v1/posts/99999")
        assert response.status_code == 404

    def test_get_draft_post_anonymous(self, client, admin_user, db):
        """Test that anonymous users cannot see draft posts."""
        from app.models import Post
        post = Post(
            title="Draft Post",
            slug="draft-post",
            content="Content",
            status="draft",
            user_id=admin_user.id
        )
        db.add(post)
        db.commit()

        response = client.get("/api/v1/posts/draft-post")
        assert response.status_code == 404

    def test_get_draft_post_needs_include_unpublished(self, client, admin_user, admin_headers, db):
        """Draft detail needs include_unpublished; the token alone, or the flag alone, is a 404."""
        from app.models import Post
        post = Post(
            title="Draft Post",
            slug="draft-post",
            content="Content",
            status="draft",
            user_id=admin_user.id
        )
        db.add(post)
        db.commit()

        response = client.get("/api/v1/posts/draft-post", headers=admin_headers)
        assert response.status_code == 404

        # Admin token + the explicit flag is what the admin UI sends (see
        # frontend/app/admin/posts/[id]/edit/page.tsx), and it returns the draft.
        response = client.get(
            "/api/v1/posts/draft-post?include_unpublished=true", headers=admin_headers
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Draft Post"

        # The flag on its own must not expose the draft to the public.
        response = client.get("/api/v1/posts/draft-post?include_unpublished=true")
        assert response.status_code == 404


class TestCreatePost:
    """Test POST /api/v1/posts endpoint."""

    def test_create_post_success(self, client, admin_headers, test_project, test_tag):
        """Test creating a post."""
        response = client.post(
            "/api/v1/posts",
            json={
                "title": "New Post",
                "content": "New Content",
                "summary": "New Summary",
                "project_id": test_project.id,
                "tag_ids": [test_tag.id],
                "status": "published"
            },
            headers=admin_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "New Post"
        assert data["content"] == "New Content"
        assert data["project"]["id"] == test_project.id
        assert len(data["tags"]) == 1

    def test_create_post_without_project(self, client, admin_headers):
        """Test creating a post without a project."""
        response = client.post(
            "/api/v1/posts",
            json={
                "title": "No Project Post",
                "content": "Content",
                "status": "draft"
            },
            headers=admin_headers
        )
        assert response.status_code == 201
        assert response.json()["project"] is None

    def test_create_post_unauthorized(self, client):
        """Test creating a post without authentication."""
        response = client.post(
            "/api/v1/posts",
            json={"title": "Post", "content": "Content"}
        )
        assert response.status_code == 401


class TestUpdatePost:
    """Test PUT /api/v1/posts/{id} endpoint."""

    def test_update_post_success(self, client, admin_headers, db, admin_user):
        """Test updating a post."""
        from app.models import Post
        post = Post(
            title="Original Title",
            slug="original-slug",
            content="Original Content",
            status="draft",
            user_id=admin_user.id
        )
        db.add(post)
        db.commit()

        response = client.put(
            f"/api/v1/posts/{post.id}",
            json={"title": "Updated Title", "status": "published"},
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Title"
        assert data["status"] == "published"
        assert data["content"] == "Original Content"  # Unchanged

    def test_update_post_set_project_to_null(self, client, admin_headers, db, admin_user, test_project):
        """Test setting a post's project to null."""
        from app.models import Post
        post = Post(
            title="Post",
            slug="post-to-null",
            content="Content",
            status="draft",
            user_id=admin_user.id,
            project_id=test_project.id
        )
        db.add(post)
        db.commit()

        response = client.put(
            f"/api/v1/posts/{post.id}",
            json={"project_id": None},
            headers=admin_headers
        )
        assert response.status_code == 200
        assert response.json()["project"] is None

    def test_update_post_not_found(self, client, admin_headers):
        """Test updating a non-existent post."""
        response = client.put(
            "/api/v1/posts/99999",
            json={"title": "Updated"},
            headers=admin_headers
        )
        assert response.status_code == 404

    def test_update_post_unauthorized(self, client, admin_user, db):
        """Test updating a post without authentication."""
        from app.models import Post
        post = Post(
            title="Post",
            slug="post-unauth",
            content="Content",
            status="draft",
            user_id=admin_user.id
        )
        db.add(post)
        db.commit()

        response = client.put(
            f"/api/v1/posts/{post.id}",
            json={"title": "Updated"}
        )
        assert response.status_code == 401


class TestDeletePost:
    """Test DELETE /api/v1/posts/{id} endpoint."""

    def test_delete_post_success(self, client, admin_headers, db, admin_user):
        """Test deleting a post."""
        from app.models import Post
        post = Post(
            title="Post to Delete",
            slug="post-to-delete",
            content="Content",
            status="published",
            user_id=admin_user.id
        )
        db.add(post)
        db.commit()
        post_id = post.id

        response = client.delete(f"/api/v1/posts/{post_id}", headers=admin_headers)
        assert response.status_code == 204

        # Verify deleted
        response = client.get(f"/api/v1/posts/{post_id}")
        assert response.status_code == 404

    def test_delete_post_not_found(self, client, admin_headers):
        """Test deleting a non-existent post."""
        response = client.delete("/api/v1/posts/99999", headers=admin_headers)
        assert response.status_code == 404

    def test_delete_post_unauthorized(self, client, admin_user, db):
        """Test deleting a post without authentication."""
        from app.models import Post
        post = Post(
            title="Post",
            slug="post-del-unauth",
            content="Content",
            status="published",
            user_id=admin_user.id
        )
        db.add(post)
        db.commit()

        response = client.delete(f"/api/v1/posts/{post.id}")
        assert response.status_code == 401
