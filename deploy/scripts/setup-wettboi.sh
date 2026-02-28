#!/bin/bash
# Setup script for Hardwave-WettBoi server
# Server: 178.104.0.201
# Run from repo root: sudo bash deploy/scripts/setup-wettboi.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

source "$SCRIPT_DIR/common.sh"

require_root

echo ""
echo -e "${BOLD}Hardwave Studios — WettBoi Server Setup${NC}"
echo -e "Domains: ${CYAN}wettboi.hardwavestudios.com${NC} + ${CYAN}dl.wettboi.hardwavestudios.com${NC}"
echo "────────────────────────────────────────────────────────────"
echo ""

# ── 1. System deps ────────────────────────────────────────────────────────────
install_deps

# ── 2. Directories ────────────────────────────────────────────────────────────
info "Creating directories..."
mkdir -p /opt/hardwave/releases
success "Directories ready  (/opt/hardwave/releases — drop .vst3/.clap builds here)"

# ── 3. .env.local ─────────────────────────────────────────────────────────────
APP_DIR="$REPO_ROOT"
require_env "$APP_DIR"

# ── 4. Caddyfile ──────────────────────────────────────────────────────────────
apply_caddyfile "$REPO_ROOT/deploy/wettboi/Caddyfile"

# ── 5. Docker ─────────────────────────────────────────────────────────────────
docker_up "$REPO_ROOT/deploy/wettboi/docker-compose.yml"

echo ""
echo -e "${GREEN}${BOLD}✓ WettBoi server is live!${NC}"
echo -e "  VST webview: ${CYAN}https://wettboi.hardwavestudios.com/vst/wettboi${NC}"
echo -e "  Downloads:   ${CYAN}https://dl.wettboi.hardwavestudios.com/<filename>${NC}"
echo ""
echo -e "  Drop compiled VST3/CLAP builds into ${BOLD}/opt/hardwave/releases/${NC}"
echo ""
