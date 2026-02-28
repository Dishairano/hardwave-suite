#!/bin/bash
# Setup script for Static-Pages server (hardwavestudios.com)
# Server: 46.225.219.184
# This server also hosts the shared MySQL database used by all 4 apps.
# Run from repo root: sudo bash deploy/scripts/setup-static-pages.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

source "$SCRIPT_DIR/common.sh"

require_root

echo ""
echo -e "${BOLD}Hardwave Studios — Static Pages + Database Setup${NC}"
echo -e "Domain:   ${CYAN}hardwavestudios.com${NC}"
echo -e "Database: ${CYAN}MySQL 8.0 (shared by all servers)${NC}"
echo "──────────────────────────────────────────────────"
echo ""

# ── 1. System deps ────────────────────────────────────────────────────────────
install_deps

# ── 2. Directories ────────────────────────────────────────────────────────────
info "Creating directories..."
mkdir -p /opt/hardwave/public-downloads
mkdir -p /opt/hardwave/mysql-data
success "Directories ready  (/opt/hardwave/mysql-data — MySQL data persists here)"

# ── 3. .env.local ─────────────────────────────────────────────────────────────
APP_DIR="$REPO_ROOT"
require_env "$APP_DIR"

# Load env vars so we can pass DB credentials to migration helpers
load_env "$APP_DIR/.env.local"

# Validate required DB vars
[[ -n "${DATABASE_ROOT_PASSWORD:-}" ]] || die "DATABASE_ROOT_PASSWORD is not set in .env.local"
[[ -n "${DATABASE_USER:-}" ]]          || die "DATABASE_USER is not set in .env.local"
[[ -n "${DATABASE_PASSWORD:-}" ]]      || die "DATABASE_PASSWORD is not set in .env.local"
[[ -n "${DATABASE_NAME:-}" ]]          || die "DATABASE_NAME is not set in .env.local"

# ── 4. Firewall — allow MySQL from other Hardwave servers ─────────────────────
info "Configuring firewall rules for MySQL (port 3306)..."
if command -v ufw &>/dev/null; then
  ufw allow from 178.104.1.104 to any port 3306 comment "hardwave-erp"
  ufw allow from 46.225.236.124 to any port 3306 comment "hardwave-analyser"
  ufw allow from 178.104.0.201 to any port 3306 comment "hardwave-wettboi"
  success "ufw rules added for all Hardwave server IPs"
else
  warn "ufw not found — add firewall rules manually to allow port 3306 from:"
  warn "  178.104.1.104   (erp.hardwavestudios.com)"
  warn "  46.225.236.124  (analyser.hardwavestudios.com)"
  warn "  178.104.0.201   (wettboi.hardwavestudios.com)"
fi

# ── 5. Caddyfile ──────────────────────────────────────────────────────────────
apply_caddyfile "$REPO_ROOT/deploy/static-pages/Caddyfile"

# ── 6. Docker — bring up MySQL + website ─────────────────────────────────────
docker_up "$REPO_ROOT/deploy/static-pages/docker-compose.yml"

# ── 7. Migrations ─────────────────────────────────────────────────────────────
wait_for_mysql "hardwave-database" "$DATABASE_ROOT_PASSWORD"
run_migrations "hardwave-database" "$DATABASE_ROOT_PASSWORD" "$DATABASE_NAME" "$REPO_ROOT/migrations"

echo ""
echo -e "${GREEN}${BOLD}✓ Static Pages + Database server is live!${NC}"
echo -e "  Site:       ${CYAN}https://hardwavestudios.com${NC}"
echo -e "  MySQL:      ${CYAN}46.225.219.184:3306${NC}  (accessible to all Hardwave servers)"
echo ""
echo -e "  ${BOLD}To run migrations manually:${NC}"
echo -e "  ${DIM}sudo bash deploy/scripts/run-migrations.sh${NC}"
echo ""
