#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# smoke-test.sh — Non-destructive health-check for all ZYRA services
#
# Usage:
#   bash scripts/smoke-test.sh
# ──────────────────────────────────────────────────────────────────────────────
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZYRA_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Helpers (matching setup-ollama.sh style) ─────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*"; }

PASS_COUNT=0
FAIL_COUNT=0

check() {
  local name="$1"; shift
  if "$@" &>/dev/null; then
    echo -e "  ${GREEN}PASS${NC}  $name"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}FAIL${NC}  $name"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

# ── Check: API health ────────────────────────────────────────────────────────
info "=== ZYRA Smoke Test ==="
echo ""
echo "Services:"
check "API health (localhost:4020)" curl -sf localhost:4020/health
check "AI health (localhost:8020)" curl -sf localhost:8020/health
check "Web (localhost:3020)" curl -sf -o /dev/null localhost:3020/
check "Admin (localhost:3024)" curl -sf -o /dev/null localhost:3024/

# ── Check: Redis ─────────────────────────────────────────────────────────────
echo ""
echo "Infrastructure:"
if command -v redis-cli &>/dev/null; then
  if redis-cli ping 2>/dev/null | grep -q PONG; then
    echo -e "  ${GREEN}PASS${NC}  Redis (PONG)"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}FAIL${NC}  Redis (no PONG)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
else
  echo -e "  ${YELLOW}SKIP${NC}  Redis (redis-cli not found)"
fi

# ── Check: Database ──────────────────────────────────────────────────────────
if command -v psql &>/dev/null && [ -f "$ZYRA_ROOT/.env" ]; then
  DB_URL=$(grep -E '^DATABASE_URL=' "$ZYRA_ROOT/.env" | head -1 | cut -d'=' -f2-)
  # Strip surrounding quotes if present
  DB_URL=$(echo "$DB_URL" | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/")
  if [ -n "$DB_URL" ]; then
    # Extract components from postgresql://user:pass@host:port/dbname
    DB_USER=$(echo "$DB_URL" | sed -n 's|postgresql://\([^:]*\):.*|\1|p')
    DB_PASS=$(echo "$DB_URL" | sed -n 's|postgresql://[^:]*:\([^@]*\)@.*|\1|p')
    DB_HOST=$(echo "$DB_URL" | sed -n 's|postgresql://[^@]*@\([^:]*\):.*|\1|p')
    DB_PORT=$(echo "$DB_URL" | sed -n 's|postgresql://[^@]*@[^:]*:\([^/]*\)/.*|\1|p')
    DB_NAME=$(echo "$DB_URL" | sed -n 's|postgresql://[^@]*@[^:]*:[^/]*/\([^?]*\).*|\1|p')

    if PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT 1" 2>/dev/null | grep -q 1; then
      echo -e "  ${GREEN}PASS${NC}  Database ($DB_NAME @ $DB_HOST:$DB_PORT)"
      PASS_COUNT=$((PASS_COUNT + 1))
    else
      echo -e "  ${RED}FAIL${NC}  Database ($DB_NAME @ $DB_HOST:$DB_PORT — SELECT 1 failed)"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  else
    echo -e "  ${YELLOW}SKIP${NC}  Database (DATABASE_URL empty in .env)"
  fi
elif ! command -v psql &>/dev/null; then
  echo -e "  ${YELLOW}SKIP${NC}  Database (psql not found)"
else
  echo -e "  ${YELLOW}SKIP${NC}  Database (.env not found)"
fi

# ── Check: Ollama ────────────────────────────────────────────────────────────
if command -v ollama &>/dev/null; then
  check "Ollama (localhost:11434)" curl -sf localhost:11434/api/tags
else
  echo -e "  ${YELLOW}SKIP${NC}  Ollama (not installed)"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
TOTAL=$((PASS_COUNT + FAIL_COUNT))
if [ "$FAIL_COUNT" -eq 0 ]; then
  info "All $TOTAL checks passed."
else
  fail "$FAIL_COUNT/$TOTAL checks failed."
fi

echo ""
[ "$FAIL_COUNT" -eq 0 ]
exit $?
