#!/usr/bin/env bash
# Release-note gate: if a change touches application code, the same diff must
# add or edit a note under docs/release-notes/. Warns locally; fails in CI,
# where STRICT_RELEASE_NOTES=true.
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
BASE="${RELEASE_NOTES_BASE:-origin/main}"

# Print each line of $1 as an indented bullet.
bullets() {
  local line
  while IFS= read -r line; do
    if [ -n "$line" ]; then echo "  - $line"; fi
  done <<< "$1"
}

# Paths that count as application code: TypeScript sources and the dashboard's
# public assets, the Go gateway, package sources and SQL migrations, and
# Soroban contract sources once contracts/ has crates. Tests under src/ count
# too; a test-only change still changes what ships. Manifests and lockfiles
# (package.json, go.mod, go.sum) do not count, so Dependabot bumps pass.
APP_PATHS='^(apps/(facilitator|web-dashboard)/(src|public)/|apps/api-gateway/.+\.go$|packages/[^/]+/(src|migrations)/|contracts/[^/]+/src/)'

# CI checks out with fetch-depth 0, so the base is normally present. Fetch it
# when it is not, and fail loudly if that does not work: a diff against a
# missing base would silently report "no changes".
if ! git rev-parse --verify --quiet "$BASE" >/dev/null; then
  git fetch origin "${BASE#origin/}" >/dev/null
fi
if ! MERGE_BASE="$(git merge-base "$BASE" HEAD)"; then
  echo -e "${RED}Could not find a merge base between $BASE and HEAD.${NC}" >&2
  exit 1
fi

CHANGED="$(git diff --name-only "$MERGE_BASE" HEAD)"
CHANGED_APP_FILES="$(echo "$CHANGED" | grep -E "$APP_PATHS" || true)"
RELEASE_NOTES="$(echo "$CHANGED" | grep -E '^docs/release-notes/.+\.md$' | grep -v '/TEMPLATE\.md$' || true)"

if [ -z "$CHANGED_APP_FILES" ]; then
  echo -e "${GREEN}No application code changed. Release note not required.${NC}"
  exit 0
fi

if [ -z "$RELEASE_NOTES" ]; then
  echo -e "${YELLOW}Application code changed but no release note was added under docs/release-notes/:${NC}"
  bullets "$CHANGED_APP_FILES"
  echo -e "${YELLOW}Add docs/release-notes/<YYYY-MM-DD>-<feature>.md (see docs/release-notes/TEMPLATE.md).${NC}"
  if [ "${STRICT_RELEASE_NOTES:-false}" = "true" ]; then
    echo -e "${RED}Release-note gate failed in strict mode.${NC}"
    exit 1
  fi
  exit 0
fi

echo -e "${GREEN}Release note found:${NC}"
bullets "$RELEASE_NOTES"
echo -e "${GREEN}Gate passed.${NC}"
