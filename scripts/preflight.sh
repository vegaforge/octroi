#!/usr/bin/env bash
# Governance preflight: the five gates every change must pass before review.
# CI runs the same gates. Usage:
#   ./scripts/preflight.sh          all five gates
#   ./scripts/preflight.sh --fast   skip gate 5 (build); used by the pre-push hook
set -euo pipefail

# Git hooks run with a minimal PATH. Load nvm or mise if present so node, pnpm
# and go resolve the same way they do in an interactive shell.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
if command -v mise >/dev/null 2>&1; then eval "$(mise activate bash --shims)"; fi

ROOT="$(git rev-parse --show-toplevel)"
GATEWAY="$ROOT/apps/api-gateway"
cd "$ROOT"

BLUE='\033[0;34m'; GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'

# Print each line of $1 as an indented bullet.
bullets() {
  local line
  while IFS= read -r line; do
    if [ -n "$line" ]; then echo "  - $line"; fi
  done <<< "$1"
}

SKIP_BUILD="${SKIP_BUILD:-false}"
case "${1:-}" in
  "") ;;
  --fast) SKIP_BUILD="true" ;;
  *) echo -e "${RED}Unknown argument: $1 (expected --fast or nothing)${NC}" >&2; exit 2 ;;
esac

# The race detector roughly doubles test time, so it is on in CI and opt-in
# locally with GO_RACE=true.
GO_TEST_FLAGS=()
if [ "${CI:-false}" = "true" ] || [ "${GO_RACE:-false}" = "true" ]; then
  GO_TEST_FLAGS+=(-race)
fi

for tool in pnpm go gofmt; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo -e "${RED}$tool is not on PATH. Install it before running the preflight.${NC}" >&2
    exit 1
  fi
done

echo -e "${BLUE}=== Governance Preflight ===${NC}"

echo -e "\n${BLUE}[1/5] Format check (Prettier, gofmt)...${NC}"
pnpm format:check
UNFORMATTED="$(cd "$GATEWAY" && gofmt -l .)"
if [ -n "$UNFORMATTED" ]; then
  echo -e "${RED}gofmt found unformatted Go files in apps/api-gateway:${NC}"
  bullets "$UNFORMATTED"
  echo "Run: (cd apps/api-gateway && gofmt -w .)"
  exit 1
fi

# pnpm lint is a no-op in every package until issue #38 adds ESLint. It runs
# here anyway so the gate turns real the moment the scripts do.
echo -e "\n${BLUE}[2/5] Lint (pnpm lint, go vet)...${NC}"
pnpm lint
(cd "$GATEWAY" && go vet ./...)

echo -e "\n${BLUE}[3/5] Typecheck...${NC}"
pnpm turbo run typecheck

echo -e "\n${BLUE}[4/5] Tests (Vitest, go test)...${NC}"
pnpm test
(cd "$GATEWAY" && go test "${GO_TEST_FLAGS[@]+"${GO_TEST_FLAGS[@]}"}" ./...)

if [ "$SKIP_BUILD" = "true" ]; then
  echo -e "\n${BLUE}[5/5] Build (skipped in --fast mode)${NC}"
else
  echo -e "\n${BLUE}[5/5] Production build (pnpm build, go build)...${NC}"
  pnpm build
  (cd "$GATEWAY" && go build ./...)
fi

echo -e "\n${GREEN}All preflight gates passed.${NC}"
