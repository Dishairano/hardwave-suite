#!/bin/bash
# Apply pending database migrations against the running MySQL container.
# Run on the static-pages server (46.225.219.184) where MySQL runs.
# Usage: sudo bash deploy/scripts/run-migrations.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

source "$SCRIPT_DIR/common.sh"

require_root

echo ""
echo -e "${BOLD}Hardwave Studios — Database Migrations${NC}"
echo "──────────────────────────────────────"
echo ""

# Load credentials from .env.local
load_env "$REPO_ROOT/.env.local"
[[ -n "${DATABASE_ROOT_PASSWORD:-}" ]] || die "DATABASE_ROOT_PASSWORD not set in .env.local"
[[ -n "${DATABASE_NAME:-}" ]]          || die "DATABASE_NAME not set in .env.local"

docker ps --format '{{.Names}}' | grep -q "^hardwave-database$" \
  || die "hardwave-database container is not running — is this the static-pages server?"

run_migrations "hardwave-database" "$DATABASE_ROOT_PASSWORD" "$DATABASE_NAME" "$REPO_ROOT/migrations"

echo ""
