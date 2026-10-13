# Hidden Visibility Regression Scripts

This folder contains two shell scripts for validating hidden visibility rules.

## 1) Write-mode (creates test data)

File: `hidden_visibility_regression.sh`

Use this when you want a full end-to-end check with fresh generated test data.

### What it does

- Logs in as admin
- Creates visible/hidden projects
- Creates visible/hidden posts (including post under hidden project)
- Verifies public APIs only expose visible resources
- Verifies admin include flags can access hidden resources

### Run

```bash
API_BASE_URL=http://127.0.0.1:8000/api/v1 \
ADMIN_USERNAME=your-admin-username \
ADMIN_PASSWORD=your-admin-password \
bash backend/tests/hidden_visibility_regression.sh
```

## 2) Read-only mode (does not modify data)

File: `hidden_visibility_readonly_check.sh`

Use this when you only want to validate behavior against existing data.

### What it does

- Logs in as admin
- Compares public vs unauthenticated include flags (should be identical)
- Compares public vs admin include flags (public should be subset)
- Optionally validates specific hidden slugs

### Run

```bash
API_BASE_URL=http://127.0.0.1:8000/api/v1 \
ADMIN_USERNAME=your-admin-username \
ADMIN_PASSWORD=your-admin-password \
bash backend/tests/hidden_visibility_readonly_check.sh
```

### Optional strict checks

```bash
API_BASE_URL=http://127.0.0.1:8000/api/v1 \
ADMIN_USERNAME=your-admin-username \
ADMIN_PASSWORD=your-admin-password \
HIDDEN_POST_SLUG=known-hidden-post-slug \
HIDDEN_PROJECT_SLUG=known-hidden-project-slug \
bash backend/tests/hidden_visibility_readonly_check.sh
```

## Notes

- Both scripts require `curl`, `bash`, and `python`.
- Keep `API_BASE_URL` pointing to the target environment (`local` / `test`).
- If a check fails, script exits with non-zero status and prints the failed assertion.
