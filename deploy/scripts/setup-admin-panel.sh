#!/bin/bash
# Setup script for Admin-Panel server (erp.hardwavestudios.com)
# Server: 178.104.1.104
# Run from repo root: sudo bash deploy/scripts/setup-admin-panel.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

source "$SCRIPT_DIR/common.sh"

require_root

echo ""
echo -e "${BOLD}Hardwave Studios — Admin Panel (ERP) Setup${NC}"
echo -e "Domain: ${CYAN}erp.hardwavestudios.com${NC}"
echo "────────────────────────────────────────────"
echo ""

# ── 1. System deps ────────────────────────────────────────────────────────────
install_deps

# ── 2. .env.local ─────────────────────────────────────────────────────────────
APP_DIR="$REPO_ROOT"
require_env "$APP_DIR"

# ── 3. Caddyfile ──────────────────────────────────────────────────────────────
apply_caddyfile "$REPO_ROOT/deploy/admin-panel/Caddyfile"

# ── 4. Docker ─────────────────────────────────────────────────────────────────
docker_up "$REPO_ROOT/deploy/admin-panel/docker-compose.yml"

echo ""
echo -e "${GREEN}${BOLD}✓ Admin Panel server is live!${NC}"
echo -e "  ERP:  ${CYAN}https://erp.hardwavestudios.com/erp${NC}"
echo ""
