#!/bin/bash
# Update an existing Hardwave deployment (pull latest code, rebuild, restart)
# Usage: sudo bash deploy/scripts/update.sh <scope>
# Scopes: static-pages | admin-panel | analyser | wettboi
#
# Build context is the monorepo root. Each app has its own Dockerfile
# under apps/<name>/Dockerfile which uses turbo prune for efficient builds.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

source "$SCRIPT_DIR/common.sh"

require_root

SCOPE="${1:-}"

if [[ -z "$SCOPE" ]]; then
  echo -e "${BOLD}Usage:${NC} sudo bash deploy/scripts/update.sh <scope>"
  echo ""
  echo "  Scopes:"
  echo "    static-pages   — hardwavestudios.com"
  echo "    admin-panel    — erp.hardwavestudios.com"
  echo "    analyser       — analyser.hardwavestudios.com"
  echo "    wettboi        — wettboi.hardwavestudios.com"
  echo ""
  exit 1
fi

COMPOSE_FILE="$REPO_ROOT/deploy/$SCOPE/docker-compose.yml"

[[ -f "$COMPOSE_FILE" ]] || die "Unknown scope '$SCOPE' — no compose file at $COMPOSE_FILE"

echo ""
echo -e "${BOLD}Updating: ${CYAN}$SCOPE${NC}"
echo "──────────────────────────────────────"

# Pull latest code
info "Pulling latest code..."
git -C "$REPO_ROOT" pull --ff-only
success "Code up to date"

# Rebuild image
info "Rebuilding Docker image..."
docker compose -f "$COMPOSE_FILE" build --no-cache
success "Image built"

# Restart container (zero-downtime swap)
info "Restarting container..."
docker compose -f "$COMPOSE_FILE" up -d --force-recreate
success "Container restarted"

echo ""
echo -e "${GREEN}${BOLD}✓ $SCOPE updated successfully${NC}"
echo ""
