#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# setup-ollama.sh — Idempotent Ollama install and model pull script
#
# Usage:
#   sudo bash scripts/setup-ollama.sh          # install + pull default models
#   sudo bash scripts/setup-ollama.sh --models llama3.2,llama3.2:70b  # custom
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZYRA_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OLLAMA_HOST="${OLLAMA_HOST:-0.0.0.0}"
OLLAMA_PORT="${OLLAMA_PORT:-11434}"
OLLAMA_MODELS="${1:-llama3.2,llama3.2:70b}"
OLLAMA_EMBEDDING_MODEL="${OLLAMA_EMBEDDING_MODEL:-nomic-embed-text}"

# ── Helpers ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }

# ── OS Detection ─────────────────────────────────────────────────────────────
detect_os() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo "${ID:-unknown}"
  else
    echo "unknown"
  fi
}

# ── Install Ollama ────────────────────────────────────────────────────────────
install_ollama() {
  if command -v ollama &>/dev/null; then
    info "Ollama already installed ($(ollama --version 2>/dev/null | head -1))"
    return 0
  fi

  info "Installing Ollama..."
  OS=$(detect_os)
  case "$OS" in
    ubuntu|debian)
      curl -fsSL https://ollama.com/install.sh | sh
      ;;
    centos|rhel|fedora)
      curl -fsSL https://ollama.com/install.sh | sh
      ;;
    *)
      warn "Unknown OS ($OS). Install Ollama manually from https://ollama.com"
      return 1
      ;;
  esac

  # Wait for service to be ready
  for i in $(seq 1 30); do
    if curl -sf "http://localhost:${OLLAMA_PORT}/api/tags" &>/dev/null; then
      info "Ollama is running on port ${OLLAMA_PORT}"
      return 0
    fi
    sleep 2
  done
  warn "Ollama installed but service not responding yet"
}

# ── Configure Ollama environment ─────────────────────────────────────────────
configure_ollama() {
  local env_file="/etc/default/ollama"
  if [ -f "$env_file" ]; then
    if grep -q "^OLLAMA_HOST=" "$env_file"; then
      sed -i "s/^OLLAMA_HOST=.*/OLLAMA_HOST=\"${OLLAMA_HOST}\"/" "$env_file"
    else
      echo "OLLAMA_HOST=\"${OLLAMA_HOST}\"" >> "$env_file"
    fi
    info "OLLAMA_HOST set to ${OLLAMA_HOST} in $env_file"
  else
    warn "$env_file not found. Set OLLAMA_HOST via systemd or environment."
  fi
}

# ── Pull Models ──────────────────────────────────────────────────────────────
pull_model() {
  local model="$1"
  info "Pulling model: $model"
  if ollama pull "$model" 2>&1; then
    info "  ✓ $model pulled successfully"
  else
    warn "  ✗ Failed to pull $model — check disk space and network"
  fi
}

pull_models() {
  info "Pulling AI models (this may take several minutes)..."
  IFS=',' read -ra MODELS <<< "$OLLAMA_MODELS"
  for model in "${MODELS[@]}"; do
    model=$(echo "$model" | xargs)  # trim whitespace
    pull_model "$model"
  done

  info "Pulling embedding model: $OLLAMA_EMBEDDING_MODEL"
  pull_model "$OLLAMA_EMBEDDING_MODEL"
}

# ── Verify Setup ─────────────────────────────────────────────────────────────
verify_setup() {
  info "Verifying Ollama setup..."
  local tags
  tags=$(curl -sf "http://localhost:${OLLAMA_PORT}/api/tags" || echo "{}")
  echo "$tags" | python3 -m json.tool 2>/dev/null | grep '"name"' | head -10 || true

  info "Ollama API: http://${OLLAMA_HOST}:${OLLAMA_PORT}"
  info "Ollama Web UI: http://localhost:${OLLAMA_PORT}"
}

# ── Update .env.production ────────────────────────────────────────────────────
update_env() {
  local env_file="${ZYRA_ROOT}/.env.production"
  if [ ! -f "$env_file" ]; then
    warn "$env_file not found — skipping env update"
    return
  fi

  info "Updating $env_file with AI configuration..."

  # Set or append OLLAMA_HOST (remove old value first)
  if grep -q "^OLLAMA_HOST=" "$env_file"; then
    sed -i "s|^OLLAMA_HOST=.*|OLLAMA_HOST=\"http://localhost:${OLLAMA_PORT}\"|" "$env_file"
  else
    echo "" >> "$env_file"
    echo "# ── AI / Ollama ─────────────────────────────────────────────────────" >> "$env_file"
    echo "OLLAMA_HOST=\"http://localhost:${OLLAMA_PORT}\"" >> "$env_file"
  fi

  # Set or append OLLAMA_URL
  if grep -q "^OLLAMA_URL=" "$env_file"; then
    sed -i "s|^OLLAMA_URL=.*|OLLAMA_URL=\"http://localhost:${OLLAMA_PORT}\"|" "$env_file"
  else
    echo "OLLAMA_URL=\"http://localhost:${OLLAMA_PORT}\"" >> "$env_file"
  fi

  # Set or append OLLAMA_MODEL
  local default_model="${OLLAMA_MODELS%%,*}"
  if grep -q "^OLLAMA_MODEL=" "$env_file"; then
    sed -i "s|^OLLAMA_MODEL=.*|OLLAMA_MODEL=\"${default_model}\"|" "$env_file"
  else
    echo "OLLAMA_MODEL=\"${default_model}\"" >> "$env_file"
  fi

  # Set or append OLLAMA_EMBEDDING_MODEL
  if grep -q "^OLLAMA_EMBEDDING_MODEL=" "$env_file"; then
    sed -i "s|^OLLAMA_EMBEDDING_MODEL=.*|OLLAMA_EMBEDDING_MODEL=\"${OLLAMA_EMBEDDING_MODEL}\"|" "$env_file"
  else
    echo "OLLAMA_EMBEDDING_MODEL=\"${OLLAMA_EMBEDDING_MODEL}\"" >> "$env_file"
  fi

  info ".env.production updated with AI variables"
}

# ── Main ─────────────────────────────────────────────────────────────────────
main() {
  info "=== ZYRA Ollama Setup ==="

  install_ollama || warn "Ollama install skipped or failed"
  configure_ollama
  pull_models
  verify_setup
  update_env

  echo ""
  info "=== Setup Complete ==="
  info "Next steps:"
  info "  1. Restart Ollama:   sudo systemctl restart ollama"
  info "  2. Start AI service: cd /var/www/zyra/apps/ai && source .venv/bin/activate && uvicorn src.main:app --host 0.0.0.0 --port 8000"
  info "  3. Test endpoint:    curl http://localhost:8000/health"
  info "  4. API docs:         http://localhost:8000/docs"
}

main "$@"
