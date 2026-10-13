#!/usr/bin/env bash
set -euo pipefail

# Read-only regression checks for hidden visibility rules.
# This script does NOT create or modify data.
#
# Usage:
#   API_BASE_URL=http://127.0.0.1:8000/api/v1 \
#   ADMIN_USERNAME=admin \
#   ADMIN_PASSWORD=your-password \
#   bash backend/tests/hidden_visibility_readonly_check.sh
#
# Optional stronger checks (if you already know hidden slugs):
#   HIDDEN_POST_SLUG=xxx
#   HIDDEN_PROJECT_SLUG=yyy

API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:8000/api/v1}"
ADMIN_USERNAME="${ADMIN_USERNAME:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
HIDDEN_POST_SLUG="${HIDDEN_POST_SLUG:-}"
HIDDEN_PROJECT_SLUG="${HIDDEN_PROJECT_SLUG:-}"

if [[ -z "${ADMIN_USERNAME}" || -z "${ADMIN_PASSWORD}" ]]; then
  echo "ERROR: ADMIN_USERNAME and ADMIN_PASSWORD are required."
  exit 1
fi

PYTHON_BIN="${PYTHON_BIN:-}"
if [[ -z "${PYTHON_BIN}" ]]; then
  if command -v python >/dev/null 2>&1; then
    PYTHON_BIN="python"
  elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
  else
    echo "ERROR: python/python3 is required."
    exit 1
  fi
fi

tmpdir="$(mktemp -d)"
cleanup() {
  rm -rf "${tmpdir}"
}
trap cleanup EXIT

log() { echo "[hidden-readonly] $*"; }

request_json() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local auth_header="${4:-}"
  local out_file="$5"

  local status
  if [[ -n "${body}" ]]; then
    if [[ -n "${auth_header}" ]]; then
      status="$(curl -sS -o "${out_file}" -w "%{http_code}" -X "${method}" "${url}" \
        -H "Content-Type: application/json" \
        -H "${auth_header}" \
        -d "${body}")"
    else
      status="$(curl -sS -o "${out_file}" -w "%{http_code}" -X "${method}" "${url}" \
        -H "Content-Type: application/json" \
        -d "${body}")"
    fi
  else
    if [[ -n "${auth_header}" ]]; then
      status="$(curl -sS -o "${out_file}" -w "%{http_code}" -X "${method}" "${url}" -H "${auth_header}")"
    else
      status="$(curl -sS -o "${out_file}" -w "%{http_code}" -X "${method}" "${url}")"
    fi
  fi
  echo "${status}"
}

assert_eq() {
  local actual="$1"
  local expected="$2"
  local message="$3"
  if [[ "${actual}" != "${expected}" ]]; then
    echo "ASSERT FAIL: ${message}. expected=${expected}, actual=${actual}"
    exit 1
  fi
  log "PASS: ${message}"
}

assert_subset_posts() {
  local subset_file="$1"
  local superset_file="$2"
  local message="$3"
  local result
  result="$("${PYTHON_BIN}" - <<'PY' "${subset_file}" "${superset_file}"
import json, sys
subset = json.load(open(sys.argv[1], "r", encoding="utf-8"))
superset = json.load(open(sys.argv[2], "r", encoding="utf-8"))
subset_slugs = {i["slug"] for i in subset.get("items", [])}
superset_slugs = {i["slug"] for i in superset.get("items", [])}
print("true" if subset_slugs.issubset(superset_slugs) else "false")
PY
)"
  assert_eq "${result}" "true" "${message}"
}

assert_subset_projects() {
  local subset_file="$1"
  local superset_file="$2"
  local message="$3"
  local result
  result="$("${PYTHON_BIN}" - <<'PY' "${subset_file}" "${superset_file}"
import json, sys
subset = json.load(open(sys.argv[1], "r", encoding="utf-8"))
superset = json.load(open(sys.argv[2], "r", encoding="utf-8"))
subset_slugs = {i["slug"] for i in subset}
superset_slugs = {i["slug"] for i in superset}
print("true" if subset_slugs.issubset(superset_slugs) else "false")
PY
)"
  assert_eq "${result}" "true" "${message}"
}

contains_slug_posts() {
  local file="$1"
  local slug="$2"
  "${PYTHON_BIN}" - <<'PY' "${file}" "${slug}"
import json, sys
data = json.load(open(sys.argv[1], "r", encoding="utf-8"))
slug = sys.argv[2]
print("true" if any(i.get("slug") == slug for i in data.get("items", [])) else "false")
PY
}

contains_slug_projects() {
  local file="$1"
  local slug="$2"
  "${PYTHON_BIN}" - <<'PY' "${file}" "${slug}"
import json, sys
data = json.load(open(sys.argv[1], "r", encoding="utf-8"))
slug = sys.argv[2]
print("true" if any(i.get("slug") == slug for i in data) else "false")
PY
}

log "1) Login admin user"
LOGIN_FILE="${tmpdir}/login.json"
LOGIN_STATUS="$(curl -sS -o "${LOGIN_FILE}" -w "%{http_code}" \
  -X POST "${API_BASE_URL}/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=${ADMIN_USERNAME}&password=${ADMIN_PASSWORD}")"
assert_eq "${LOGIN_STATUS}" "200" "admin login"

TOKEN="$("${PYTHON_BIN}" - <<'PY' "${LOGIN_FILE}"
import json, sys
data = json.load(open(sys.argv[1], "r", encoding="utf-8"))
print(data.get("access_token", ""))
PY
)"
if [[ -z "${TOKEN}" ]]; then
  echo "ASSERT FAIL: access_token missing in login response"
  exit 1
fi
AUTH_HEADER="Authorization: Bearer ${TOKEN}"

log "2) Compare public posts and admin include_hidden posts"
PUBLIC_POSTS_FILE="${tmpdir}/public_posts.json"
PUBLIC_POSTS_STATUS="$(request_json GET "${API_BASE_URL}/posts?page=1&size=100" "" "" "${PUBLIC_POSTS_FILE}")"
assert_eq "${PUBLIC_POSTS_STATUS}" "200" "public posts list"

UNAUTH_INCLUDE_POSTS_FILE="${tmpdir}/unauth_include_posts.json"
UNAUTH_INCLUDE_POSTS_STATUS="$(request_json GET "${API_BASE_URL}/posts?page=1&size=100&include_hidden=true&include_unpublished=true" "" "" "${UNAUTH_INCLUDE_POSTS_FILE}")"
assert_eq "${UNAUTH_INCLUDE_POSTS_STATUS}" "200" "unauth include flags posts list"
assert_subset_posts "${UNAUTH_INCLUDE_POSTS_FILE}" "${PUBLIC_POSTS_FILE}" "unauth include flags do not expand visible posts"
assert_subset_posts "${PUBLIC_POSTS_FILE}" "${UNAUTH_INCLUDE_POSTS_FILE}" "public posts equal unauth include flags posts"

ADMIN_INCLUDE_POSTS_FILE="${tmpdir}/admin_include_posts.json"
ADMIN_INCLUDE_POSTS_STATUS="$(request_json GET "${API_BASE_URL}/posts?page=1&size=100&include_hidden=true&include_unpublished=true" "" "${AUTH_HEADER}" "${ADMIN_INCLUDE_POSTS_FILE}")"
assert_eq "${ADMIN_INCLUDE_POSTS_STATUS}" "200" "admin include flags posts list"
assert_subset_posts "${PUBLIC_POSTS_FILE}" "${ADMIN_INCLUDE_POSTS_FILE}" "public posts are subset of admin include_hidden posts"

log "3) Compare public projects and admin include_hidden projects"
PUBLIC_PROJECTS_FILE="${tmpdir}/public_projects.json"
PUBLIC_PROJECTS_STATUS="$(request_json GET "${API_BASE_URL}/projects" "" "" "${PUBLIC_PROJECTS_FILE}")"
assert_eq "${PUBLIC_PROJECTS_STATUS}" "200" "public projects list"

UNAUTH_INCLUDE_PROJECTS_FILE="${tmpdir}/unauth_include_projects.json"
UNAUTH_INCLUDE_PROJECTS_STATUS="$(request_json GET "${API_BASE_URL}/projects?include_hidden=true" "" "" "${UNAUTH_INCLUDE_PROJECTS_FILE}")"
assert_eq "${UNAUTH_INCLUDE_PROJECTS_STATUS}" "200" "unauth include_hidden projects list"
assert_subset_projects "${UNAUTH_INCLUDE_PROJECTS_FILE}" "${PUBLIC_PROJECTS_FILE}" "unauth include_hidden does not expand visible projects"
assert_subset_projects "${PUBLIC_PROJECTS_FILE}" "${UNAUTH_INCLUDE_PROJECTS_FILE}" "public projects equal unauth include_hidden projects"

ADMIN_INCLUDE_PROJECTS_FILE="${tmpdir}/admin_include_projects.json"
ADMIN_INCLUDE_PROJECTS_STATUS="$(request_json GET "${API_BASE_URL}/projects?include_hidden=true" "" "${AUTH_HEADER}" "${ADMIN_INCLUDE_PROJECTS_FILE}")"
assert_eq "${ADMIN_INCLUDE_PROJECTS_STATUS}" "200" "admin include_hidden projects list"
assert_subset_projects "${PUBLIC_PROJECTS_FILE}" "${ADMIN_INCLUDE_PROJECTS_FILE}" "public projects are subset of admin include_hidden projects"

log "4) Optional strict checks with known hidden slugs"
if [[ -n "${HIDDEN_POST_SLUG}" ]]; then
  POST_PUBLIC_DETAIL_FILE="${tmpdir}/hidden_post_public.json"
  POST_PUBLIC_DETAIL_STATUS="$(request_json GET "${API_BASE_URL}/posts/${HIDDEN_POST_SLUG}" "" "" "${POST_PUBLIC_DETAIL_FILE}")"
  assert_eq "${POST_PUBLIC_DETAIL_STATUS}" "404" "known hidden post is not public"
  POST_ADMIN_DETAIL_FILE="${tmpdir}/hidden_post_admin.json"
  POST_ADMIN_DETAIL_STATUS="$(request_json GET "${API_BASE_URL}/posts/${HIDDEN_POST_SLUG}?include_hidden=true&include_unpublished=true" "" "${AUTH_HEADER}" "${POST_ADMIN_DETAIL_FILE}")"
  assert_eq "${POST_ADMIN_DETAIL_STATUS}" "200" "known hidden post is visible to admin include_hidden"

  IN_PUBLIC="$(contains_slug_posts "${PUBLIC_POSTS_FILE}" "${HIDDEN_POST_SLUG}")"
  assert_eq "${IN_PUBLIC}" "false" "known hidden post excluded from public list"
fi

if [[ -n "${HIDDEN_PROJECT_SLUG}" ]]; then
  PROJECT_PUBLIC_DETAIL_FILE="${tmpdir}/hidden_project_public.json"
  PROJECT_PUBLIC_DETAIL_STATUS="$(request_json GET "${API_BASE_URL}/projects/${HIDDEN_PROJECT_SLUG}" "" "" "${PROJECT_PUBLIC_DETAIL_FILE}")"
  assert_eq "${PROJECT_PUBLIC_DETAIL_STATUS}" "404" "known hidden project is not public"
  PROJECT_ADMIN_DETAIL_FILE="${tmpdir}/hidden_project_admin.json"
  PROJECT_ADMIN_DETAIL_STATUS="$(request_json GET "${API_BASE_URL}/projects/${HIDDEN_PROJECT_SLUG}?include_hidden=true" "" "${AUTH_HEADER}" "${PROJECT_ADMIN_DETAIL_FILE}")"
  assert_eq "${PROJECT_ADMIN_DETAIL_STATUS}" "200" "known hidden project is visible to admin include_hidden"

  IN_PUBLIC="$(contains_slug_projects "${PUBLIC_PROJECTS_FILE}" "${HIDDEN_PROJECT_SLUG}")"
  assert_eq "${IN_PUBLIC}" "false" "known hidden project excluded from public list"
fi

log "Read-only hidden visibility checks passed."
