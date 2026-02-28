#!/bin/bash
# Setup script for Hardwave-Analyser server
# Server: 46.225.236.124
# Run from repo root: sudo bash deploy/scripts/setup-analyser.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

source "$SCRIPT_DIR/common.sh"

require_root

echo ""
echo -e "${BOLD}Hardwave Studios — Analyser Server Setup${NC}"
echo -e "Domains: ${CYAN}analyser.hardwavestudios.com${NC} + ${CYAN}dl.hardwavestudios.com${NC}"
echo "──────────────────────────────────────────────────────"
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
apply_caddyfile "$REPO_ROOT/deploy/analyser/Caddyfile"

# ── 5. Docker ─────────────────────────────────────────────────────────────────
docker_up "$REPO_ROOT/deploy/analyser/docker-compose.yml"

echo ""
echo -e "${GREEN}${BOLD}✓ Analyser server is live!${NC}"
echo -e "  VST webview: ${CYAN}https://analyser.hardwavestudios.com/vst/analyser${NC}"
echo -e "  Downloads:   ${CYAN}https://dl.hardwavestudios.com/<filename>${NC}"
echo ""
echo -e "  Drop compiled VST3/CLAP builds into ${BOLD}/opt/hardwave/releases/${NC}"
echo ""
