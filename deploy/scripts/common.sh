#!/bin/bash
# Shared helpers — sourced by per-server setup scripts

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${CYAN}▶ $*${NC}"; }
success() { echo -e "${GREEN}✓ $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠ $*${NC}"; }
die()     { echo -e "${RED}✗ $*${NC}" >&2; exit 1; }

require_root() {
  [[ $EUID -eq 0 ]] || die "Run as root: sudo bash $0"
}

install_docker() {
  if command -v docker &>/dev/null; then
    success "Docker already installed ($(docker --version | cut -d' ' -f3 | tr -d ','))"
    return
  fi
  info "Installing Docker..."
  apt-get update -qq
  apt-get install -y ca-certificates curl gnupg
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
  success "Docker installed"
}

install_docker_compose() {
  if docker compose version &>/dev/null 2>&1; then
    success "Docker Compose already installed"
    return
  fi
  info "Installing Docker Compose plugin..."
  apt-get install -y docker-compose-plugin
  success "Docker Compose installed"
}

install_caddy() {
  if command -v caddy &>/dev/null; then
    success "Caddy already installed ($(caddy version | cut -d' ' -f1))"
    return
  fi
  info "Installing Caddy..."
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y caddy
  systemctl enable caddy
  success "Caddy installed"
}

install_deps() {
  apt-get update -qq
  install_docker
  install_docker_compose
  install_caddy
}

# Wait for user to drop .env.local into the app dir
require_env() {
  local app_dir="$1"
  if [[ -f "$app_dir/.env.local" ]]; then
    success ".env.local found"
    return
  fi
  warn ".env.local not found at $app_dir/.env.local"
  echo ""
  echo -e "  Create it from the template:"
  echo -e "  ${BOLD}cp ${app_dir}/website/.env.example ${app_dir}/.env.local${NC}"
  echo -e "  then fill in the real values."
  echo ""
  read -rp "Press Enter once .env.local is in place (Ctrl+C to abort)..."
  [[ -f "$app_dir/.env.local" ]] || die ".env.local still not found — aborting"
  success ".env.local found"
}

# Parse .env.local into shell variables (exported so child processes see them)
load_env() {
  local env_file="$1"
  [[ -f "$env_file" ]] || die ".env.local not found at $env_file"
  while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip comments and blank lines
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// }" ]] && continue
    # Split on first = only
    local key="${line%%=*}"
    local value="${line#*=}"
    # Strip surrounding quotes
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    export "$key"="$value"
  done < "$env_file"
}

# Block until the MySQL container accepts connections (max 60s)
wait_for_mysql() {
  local container="$1"
  local root_pass="$2"
  info "Waiting for MySQL to be ready..."
  local attempts=0
  until docker exec "$container" mysql -u root -p"$root_pass" -e "SELECT 1" &>/dev/null 2>&1; do
    attempts=$((attempts + 1))
    [[ $attempts -ge 30 ]] && die "MySQL did not become ready after 60 seconds"
    sleep 2
  done
  success "MySQL is ready"
}

# Apply pending SQL migrations via docker exec into the database container
run_migrations() {
  local container="$1"
  local root_pass="$2"
  local db_name="$3"
  local migrations_dir="$4"

  # Ensure tracking table exists
  docker exec "$container" mysql -u root -p"$root_pass" "$db_name" -e "
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
    );" 2>/dev/null

  local pending=0
  for migration_file in "$migrations_dir"/*.sql; do
    [[ -f "$migration_file" ]] || continue
    local filename
    filename="$(basename "$migration_file")"

    local already_applied
    already_applied=$(docker exec "$container" mysql -u root -p"$root_pass" "$db_name" -sNe \
      "SELECT COUNT(*) FROM schema_migrations WHERE filename='$filename';" 2>/dev/null || echo "0")

    if [[ "${already_applied:-0}" -eq "0" ]]; then
      info "Applying migration: $filename"
      docker exec -i "$container" mysql -u root -p"$root_pass" "$db_name" \
        < "$migration_file" 2>&1 || die "Migration failed: $filename"
      docker exec "$container" mysql -u root -p"$root_pass" "$db_name" -e \
        "INSERT INTO schema_migrations (filename) VALUES ('$filename');" 2>/dev/null
      success "$filename"
      pending=$((pending + 1))
    fi
  done

  if [[ $pending -eq 0 ]]; then
    success "All migrations already applied"
  else
    success "$pending migration(s) applied"
  fi
}

apply_caddyfile() {
  local src="$1"
  info "Writing Caddyfile..."
  cp "$src" /etc/caddy/Caddyfile
  caddy fmt --overwrite /etc/caddy/Caddyfile
  systemctl reload caddy || systemctl restart caddy
  success "Caddy reloaded"
}

docker_up() {
  local compose_file="$1"
  local app_dir
  app_dir="$(dirname "$compose_file")"
  info "Building & starting container..."
  docker compose -f "$compose_file" build --no-cache
  docker compose -f "$compose_file" up -d
  success "Container running"
}
