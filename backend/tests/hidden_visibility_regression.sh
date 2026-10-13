#!/usr/bin/env bash
set -euo pipefail

# Minimal API regression checks for hidden visibility rules.
# Usage:
#   API_BASE_URL=http://127.0.0.1:8000/api/v1 \
#   ADMIN_USERNAME=admin \
#   ADMIN_PASSWORD=your-password \
#   bash backend/tests/hidden_visibility_regression.sh

API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:8000/api/v1}"
ADMIN_USERNAME="${ADMIN_USERNAME:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

if [[ -z "${ADMIN_USERNAME}" || -z "${ADMIN_PASSWORD}" ]]; then
  echo "ERROR: ADMIN_USERNAME and ADMIN_PASSWORD are required."
  exit 1
fi

TEST_SUFFIX="$(date +%s)"
VISIBLE_PROJECT_NAME="reg-visible-project-${TEST_SUFFIX}"
HIDDEN_PROJECT_NAME="reg-hidden-project-${TEST_SUFFIX}"
VISIBLE_POST_TITLE="reg-visible-post-${TEST_SUFFIX}"
HIDDEN_POST_TITLE="reg-hidden-post-${TEST_SUFFIX}"
HIDDEN_PROJECT_POST_TITLE="reg-hidden-project-post-${TEST_SUFFIX}"

tmpdir="$(mktemp -d)"
cleanup() {
  rm -rf "${tmpdir}"
}
trap cleanup EXIT

log() { echo "[hidden-regression] $*"; }

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

assert_json_bool() {
  local file="$1"
  local expr="$2"
  local expected="$3"
  local message="$4"
  local actual
  actual="$(python - <<'PY' "${file}" "${expr}"
import json, sys
path, expr = sys.argv[1], sys.argv[2]
data = json.load(open(path, "r", encoding="utf-8"))
print("true" if eval(expr, {"__builtins__": {}}, {"d": data}) else "false")
PY
)"
  assert_eq "${actual}" "${expected}" "${message}"
}

json_get() {
  local file="$1"
  local expr="$2"
  python - <<'PY' "${file}" "${expr}"
import json, sys
path, expr = sys.argv[1], sys.argv[2]
data = json.load(open(path, "r", encoding="utf-8"))
value = eval(expr, {"__builtins__": {}}, {"d": data})
if value is None:
    print("")
else:
    print(value)
PY
}

log "1) Login admin user"
LOGIN_FILE="${tmpdir}/login.json"
LOGIN_STATUS="$(curl -sS -o "${LOGIN_FILE}" -w "%{http_code}" \
  -X POST "${API_BASE_URL}/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=${ADMIN_USERNAME}&password=${ADMIN_PASSWORD}")"
assert_eq "${LOGIN_STATUS}" "200" "admin login"
TOKEN="$(json_get "${LOGIN_FILE}" "d['access_token']")"
if [[ -z "${TOKEN}" ]]; then
  echo "ASSERT FAIL: access_token missing in login response"
  exit 1
fi
AUTH_HEADER="Authorization: Bearer ${TOKEN}"

log "2) Create visible/hidden projects"
VISIBLE_PROJECT_FILE="${tmpdir}/visible_project.json"
VISIBLE_PROJECT_STATUS="$(request_json POST "${API_BASE_URL}/projects" \
  "{\"name\":\"${VISIBLE_PROJECT_NAME}\",\"is_hidden\":false}" "${AUTH_HEADER}" "${VISIBLE_PROJECT_FILE}")"
assert_eq "${VISIBLE_PROJECT_STATUS}" "201" "create visible project"
VISIBLE_PROJECT_SLUG="$(json_get "${VISIBLE_PROJECT_FILE}" "d['slug']")"
VISIBLE_PROJECT_ID="$(json_get "${VISIBLE_PROJECT_FILE}" "d['id']")"

HIDDEN_PROJECT_FILE="${tmpdir}/hidden_project.json"
HIDDEN_PROJECT_STATUS="$(request_json POST "${API_BASE_URL}/projects" \
  "{\"name\":\"${HIDDEN_PROJECT_NAME}\",\"is_hidden\":true}" "${AUTH_HEADER}" "${HIDDEN_PROJECT_FILE}")"
assert_eq "${HIDDEN_PROJECT_STATUS}" "201" "create hidden project"
HIDDEN_PROJECT_SLUG="$(json_get "${HIDDEN_PROJECT_FILE}" "d['slug']")"
HIDDEN_PROJECT_ID="$(json_get "${HIDDEN_PROJECT_FILE}" "d['id']")"

log "3) Create published posts for visibility checks"
VISIBLE_POST_FILE="${tmpdir}/visible_post.json"
VISIBLE_POST_STATUS="$(request_json POST "${API_BASE_URL}/posts" \
  "{\"title\":\"${VISIBLE_POST_TITLE}\",\"content\":\"visible post content\",\"status\":\"published\",\"is_hidden\":false,\"project_id\":\"${VISIBLE_PROJECT_ID}\"}" \
  "${AUTH_HEADER}" "${VISIBLE_POST_FILE}")"
assert_eq "${VISIBLE_POST_STATUS}" "201" "create visible post"
VISIBLE_POST_SLUG="$(json_get "${VISIBLE_POST_FILE}" "d['slug']")"

HIDDEN_POST_FILE="${tmpdir}/hidden_post.json"
HIDDEN_POST_STATUS="$(request_json POST "${API_BASE_URL}/posts" \
  "{\"title\":\"${HIDDEN_POST_TITLE}\",\"content\":\"hidden post content\",\"status\":\"published\",\"is_hidden\":true,\"project_id\":\"${VISIBLE_PROJECT_ID}\"}" \
  "${AUTH_HEADER}" "${HIDDEN_POST_FILE}")"
assert_eq "${HIDDEN_POST_STATUS}" "201" "create hidden post"
HIDDEN_POST_SLUG="$(json_get "${HIDDEN_POST_FILE}" "d['slug']")"

HIDDEN_PROJECT_POST_FILE="${tmpdir}/hidden_project_post.json"
HIDDEN_PROJECT_POST_STATUS="$(request_json POST "${API_BASE_URL}/posts" \
  "{\"title\":\"${HIDDEN_PROJECT_POST_TITLE}\",\"content\":\"post in hidden project\",\"status\":\"published\",\"is_hidden\":false,\"project_id\":\"${HIDDEN_PROJECT_ID}\"}" \
  "${AUTH_HEADER}" "${HIDDEN_PROJECT_POST_FILE}")"
assert_eq "${HIDDEN_PROJECT_POST_STATUS}" "201" "create visible post under hidden project"
HIDDEN_PROJECT_POST_SLUG="$(json_get "${HIDDEN_PROJECT_POST_FILE}" "d['slug']")"

log "4) Public API should hide hidden resources"
PUBLIC_POSTS_FILE="${tmpdir}/public_posts.json"
PUBLIC_POSTS_STATUS="$(request_json GET "${API_BASE_URL}/posts?page=1&size=200&q=reg-" "" "" "${PUBLIC_POSTS_FILE}")"
assert_eq "${PUBLIC_POSTS_STATUS}" "200" "public posts list"
assert_json_bool "${PUBLIC_POSTS_FILE}" "any(i['slug'] == '${VISIBLE_POST_SLUG}' for i in d['items'])" "true" "visible post appears in public list"
assert_json_bool "${PUBLIC_POSTS_FILE}" "any(i['slug'] == '${HIDDEN_POST_SLUG}' for i in d['items'])" "false" "hidden post excluded from public list"
assert_json_bool "${PUBLIC_POSTS_FILE}" "any(i['slug'] == '${HIDDEN_PROJECT_POST_SLUG}' for i in d['items'])" "false" "posts under hidden project excluded from public list"

PUBLIC_PROJECTS_FILE="${tmpdir}/public_projects.json"
PUBLIC_PROJECTS_STATUS="$(request_json GET "${API_BASE_URL}/projects" "" "" "${PUBLIC_PROJECTS_FILE}")"
assert_eq "${PUBLIC_PROJECTS_STATUS}" "200" "public projects list"
assert_json_bool "${PUBLIC_PROJECTS_FILE}" "any(i['slug'] == '${VISIBLE_PROJECT_SLUG}' for i in d)" "true" "visible project appears in public list"
assert_json_bool "${PUBLIC_PROJECTS_FILE}" "any(i['slug'] == '${HIDDEN_PROJECT_SLUG}' for i in d)" "false" "hidden project excluded from public list"

HIDDEN_POST_GET_FILE="${tmpdir}/hidden_post_get.json"
HIDDEN_POST_GET_STATUS="$(request_json GET "${API_BASE_URL}/posts/${HIDDEN_POST_SLUG}" "" "" "${HIDDEN_POST_GET_FILE}")"
assert_eq "${HIDDEN_POST_GET_STATUS}" "404" "hidden post detail is not public"

HIDDEN_PROJECT_GET_FILE="${tmpdir}/hidden_project_get.json"
HIDDEN_PROJECT_GET_STATUS="$(request_json GET "${API_BASE_URL}/projects/${HIDDEN_PROJECT_SLUG}" "" "" "${HIDDEN_PROJECT_GET_FILE}")"
assert_eq "${HIDDEN_PROJECT_GET_STATUS}" "404" "hidden project detail is not public"

log "5) Admin include_hidden should expose hidden resources"
ADMIN_POSTS_FILE="${tmpdir}/admin_posts.json"
ADMIN_POSTS_STATUS="$(request_json GET "${API_BASE_URL}/posts?page=1&size=200&q=reg-&include_unpublished=true&include_hidden=true" "" "${AUTH_HEADER}" "${ADMIN_POSTS_FILE}")"
assert_eq "${ADMIN_POSTS_STATUS}" "200" "admin posts list with include flags"
assert_json_bool "${ADMIN_POSTS_FILE}" "any(i['slug'] == '${HIDDEN_POST_SLUG}' for i in d['items'])" "true" "hidden post appears for admin include_hidden"

ADMIN_PROJECTS_FILE="${tmpdir}/admin_projects.json"
ADMIN_PROJECTS_STATUS="$(request_json GET "${API_BASE_URL}/projects?include_hidden=true" "" "${AUTH_HEADER}" "${ADMIN_PROJECTS_FILE}")"
assert_eq "${ADMIN_PROJECTS_STATUS}" "200" "admin projects list include_hidden"
assert_json_bool "${ADMIN_PROJECTS_FILE}" "any(i['slug'] == '${HIDDEN_PROJECT_SLUG}' for i in d)" "true" "hidden project appears for admin include_hidden"

log "All hidden visibility regression checks passed."
