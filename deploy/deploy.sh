#!/usr/bin/env bash
#
# Idempotent production deployment for /opt/sim-map.
#
# Usage:
#   sudo /opt/sim-map/deploy.sh --tag <40-character-git-sha>
#   sudo /opt/sim-map/deploy.sh --rollback
#   sudo /opt/sim-map/deploy.sh --rollback --tag <40-character-git-sha>
#
# The script only replaces the application container. It never removes
# /srv/chess/data, never runs `docker compose down`, and never prunes images.
set -Eeuo pipefail

ROOT="/opt/sim-map"
COMPOSE_FILE="${ROOT}/docker-compose.prod.yml"
STATE_DIR="${ROOT}/state"
DATA_DIR="/srv/chess/data"
CADDY_DATA="/srv/chess/caddy/data"
CADDY_CONFIG="/srv/chess/caddy/config"
CADDYFILE_DIR="${ROOT}/caddy"

STAGING=""
CONFIG_CONTAINER=""
cleanup() {
  if [[ -n "${CONFIG_CONTAINER}" ]]; then
    docker rm -f -v "${CONFIG_CONTAINER}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${STAGING}" ]]; then
    rm -rf "${STAGING}"
  fi
  if [[ -n "${GHCR_TOKEN:-}" ]]; then
    docker logout ghcr.io >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

die() {
  printf 'deploy: ERROR: %s\n' "$*" >&2
  exit 1
}

log() {
  printf 'deploy: %s\n' "$*"
}

usage() {
  cat <<'USAGE'
Usage: deploy.sh --tag <40-char-git-sha>
       deploy.sh --rollback
       deploy.sh --rollback --tag <40-char-git-sha>

  --tag SHA    Deploy the immutable image tag for this commit.
  --rollback   Deploy the recorded previous tag (or the SHA given by --tag).
USAGE
}

[[ "${EUID}" -eq 0 ]] || die "run this script as root (sudo /opt/sim-map/deploy.sh ...)"

MODE="deploy"
TAG=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      [[ $# -ge 2 ]] || die "--tag requires a value"
      TAG="$2"
      shift 2
      ;;
    --rollback)
      MODE="rollback"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown argument: $1"
      ;;
  esac
done

[[ -f "${COMPOSE_FILE}" ]] || die "missing ${COMPOSE_FILE}"
[[ -f "${CADDYFILE_DIR}/Caddyfile" ]] || die "missing ${CADDYFILE_DIR}/Caddyfile"
[[ -f "${ROOT}/validate_compose.py" ]] \
  || die "missing ${ROOT}/validate_compose.py"

install -d -m 0755 "${STATE_DIR}" "${CADDYFILE_DIR}"

# Only create missing directories. Never chown, recreate or clean the data
# directory: it contains the authoritative WAL and snapshots.
[[ -d "${DATA_DIR}" ]] || install -d -o 10001 -g 10001 -m 0750 "${DATA_DIR}"
[[ -d "${CADDY_DATA}" ]] || install -d -m 0750 "${CADDY_DATA}"
[[ -d "${CADDY_CONFIG}" ]] || install -d -m 0750 "${CADDY_CONFIG}"

# Refuse to race another deploy. The systemd pull agent and manual
# invocations share this lock.
exec 9>"${STATE_DIR}/deploy.lock"
flock -n 9 || die "another deployment is already running"

if [[ "${MODE}" == "rollback" && -z "${TAG}" ]]; then
  TAG="$(cat "${STATE_DIR}/previous-tag" 2>/dev/null || true)"
  [[ -n "${TAG}" ]] || die "no previous image tag is recorded; pass --tag <sha>"
fi

[[ -n "${TAG}" ]] || die "missing --tag <40-char-git-sha>"
[[ "${TAG}" =~ ^[0-9a-f]{40}$ ]] \
  || die "tag must be the full lowercase 40-character Git commit SHA"

COMPOSE=(docker compose --project-directory "${ROOT}" -f "${COMPOSE_FILE}")
if [[ -f "${ROOT}/.env" ]]; then
  COMPOSE+=(--env-file "${ROOT}/.env")
fi

compose() {
  IMAGE_TAG="${TAG}" "${COMPOSE[@]}" "$@"
}

guard_compose() {
  local project_dir="$1"
  local compose_file="$2"
  local -a args=(docker compose --project-directory "${project_dir}" -f "${compose_file}")
  if [[ -f "${ROOT}/.env" ]]; then
    args+=(--env-file "${ROOT}/.env")
  fi
  IMAGE_TAG="${TAG}" "${args[@]}" config --format json \
    | python3 "${ROOT}/validate_compose.py" "${project_dir}" "${TAG}" \
        "ghcr.io/ja927cam/sim-map"
}

extract_config() {
  local image="$1"
  STAGING="$(mktemp -d "${ROOT}/.config.XXXXXX")"
  CONFIG_CONTAINER="sim-map-config-$$"
  if ! docker create --name "${CONFIG_CONTAINER}" "${image}" >/dev/null; then
    rm -rf "${STAGING}"
    STAGING=""
    return 1
  fi
  local file
  for file in docker-compose.prod.yml Caddyfile deploy.sh pull_agent.py validate_compose.py; do
    if ! docker cp "${CONFIG_CONTAINER}:/opt/sim-map/deploy/${file}" \
        "${STAGING}/${file}" >/dev/null 2>&1; then
      docker rm -f -v "${CONFIG_CONTAINER}" >/dev/null 2>&1 || true
      CONFIG_CONTAINER=""
      rm -rf "${STAGING}"
      STAGING=""
      return 1
    fi
  done
  docker rm -f -v "${CONFIG_CONTAINER}" >/dev/null 2>&1 || true
  CONFIG_CONTAINER=""
  return 0
}

# Optional GHCR credentials for a private package. Keep this file root-only.
if [[ -f /etc/sim-map/ghcr.env ]]; then
  # shellcheck disable=SC1091
  set -a
  . /etc/sim-map/ghcr.env
  set +a
  if [[ -n "${GHCR_TOKEN:-}" ]]; then
    [[ -n "${GHCR_USERNAME:-}" ]] \
      || die "GHCR_USERNAME is required when GHCR_TOKEN is set"
    printf '%s' "${GHCR_TOKEN}" \
      | docker login ghcr.io -u "${GHCR_USERNAME}" --password-stdin >/dev/null
  fi
fi

compose config -q
guard_compose "${ROOT}" "${COMPOSE_FILE}"

current="$(cat "${STATE_DIR}/current-tag" 2>/dev/null || true)"
running="$(compose ps --status running --quiet app | wc -l | tr -d ' ')"
[[ "${running}" -le 1 ]] \
  || die "more than one app container is running; refusing to touch the service"

if [[ "${TAG}" == "${current}" && "${running}" -eq 1 ]]; then
  if compose exec -T app curl -fsS http://127.0.0.1:8080/readyz >/dev/null 2>&1; then
    log "image ${TAG} is already deployed and ready"
    exit 0
  fi
  log "image ${TAG} is current but not ready; recreating it"
fi

log "pulling image tag ${TAG}"
if ! compose pull app; then
  die "image pull failed; the running service was left untouched"
fi

image="$(compose config --format json \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["services"]["app"]["image"])')"

# The image carries the deploy/ directory from its commit. Extract and
# validate the production compose/Caddyfile so configuration changes deploy
# with the image, without trusting files supplied out of band.
config_installed=0
if extract_config "${image}"; then
  if guard_compose "${STAGING}" "${STAGING}/docker-compose.prod.yml"; then
    cp -p "${COMPOSE_FILE}" "${STATE_DIR}/docker-compose.prod.yml.prev"
    cp -p "${CADDYFILE_DIR}/Caddyfile" "${STATE_DIR}/Caddyfile.prev"
    install -m 0644 "${STAGING}/docker-compose.prod.yml" "${COMPOSE_FILE}.new"
    mv "${COMPOSE_FILE}.new" "${COMPOSE_FILE}"
    install -m 0644 "${STAGING}/Caddyfile" "${CADDYFILE_DIR}/Caddyfile.new"
    mv "${CADDYFILE_DIR}/Caddyfile.new" "${CADDYFILE_DIR}/Caddyfile"
    config_installed=1
    if ! cmp -s "${STAGING}/deploy.sh" "${ROOT}/deploy.sh"; then
      install -m 0755 "${STAGING}/deploy.sh" "${ROOT}/deploy.sh.next"
      log "new deploy.sh staged at ${ROOT}/deploy.sh.next; install it manually"
    fi
    if ! cmp -s "${STAGING}/pull_agent.py" "${ROOT}/pull_agent.py"; then
      install -m 0755 "${STAGING}/pull_agent.py" "${ROOT}/pull_agent.py.next"
      log "new pull_agent.py staged at ${ROOT}/pull_agent.py.next; install it manually"
    fi
    if ! cmp -s "${STAGING}/validate_compose.py" "${ROOT}/validate_compose.py"; then
      install -m 0755 "${STAGING}/validate_compose.py" "${ROOT}/validate_compose.py.next"
      log "new validate_compose.py staged at ${ROOT}/validate_compose.py.next; install it manually"
    fi
    compose config -q
    guard_compose "${ROOT}" "${COMPOSE_FILE}"
  else
    die "staged production config failed validation; keeping the current config"
  fi
else
  log "image has no embedded deploy config; using the existing files"
fi

previous=""
if [[ -n "${current}" && "${current}" != "${TAG}" ]]; then
  previous="${current}"
  printf '%s\n' "${previous}" > "${STATE_DIR}/previous-tag.tmp"
  mv "${STATE_DIR}/previous-tag.tmp" "${STATE_DIR}/previous-tag"
fi

caddy_was_running="$(compose ps --status running --quiet caddy | wc -l | tr -d ' ')"

wait_ready() {
  local attempt
  for attempt in $(seq 1 60); do
    if compose exec -T app curl -fsS http://127.0.0.1:8080/readyz >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

reload_caddy() {
  local attempt
  for attempt in $(seq 1 20); do
    if compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  log "Caddy reload did not succeed; restarting Caddy"
  compose restart caddy
}

restore_previous_config() {
  local compose_backup="${STATE_DIR}/docker-compose.prod.yml.prev"
  local caddy_backup="${STATE_DIR}/Caddyfile.prev"
  if [[ ! -f "${compose_backup}" || ! -f "${caddy_backup}" ]]; then
    log "no previous config backup is available"
    return 1
  fi
  install -m 0644 "${compose_backup}" "${COMPOSE_FILE}.restore"
  install -m 0644 "${caddy_backup}" "${CADDYFILE_DIR}/Caddyfile.restore"
  mv "${COMPOSE_FILE}.restore" "${COMPOSE_FILE}"
  mv "${CADDYFILE_DIR}/Caddyfile.restore" "${CADDYFILE_DIR}/Caddyfile"
  if ! compose config -q || ! guard_compose "${ROOT}" "${COMPOSE_FILE}"; then
    log "previous config backup failed validation"
    return 1
  fi
  log "restored the previous compose/Caddyfile"
  return 0
}

apply_tag() {
  local tag="$1"
  TAG="${tag}"

  log "starting app image ${TAG}"
  if ! compose up -d --no-deps app; then
    return 1
  fi
  if ! wait_ready; then
    return 1
  fi

  # Apply any Caddy service changes, then reload so DNS for the recreated
  # app container is re-resolved. `up` is a no-op when Caddy is unchanged.
  if ! compose up -d --no-deps caddy; then
    return 1
  fi
  sleep 2
  if ! compose ps --status running --quiet caddy | grep -q .; then
    return 1
  fi
  if [[ "${caddy_was_running}" -eq 1 ]]; then
    if ! reload_caddy; then
      return 1
    fi
  else
    caddy_was_running=1
  fi
  return 0
}

failed_tag="${TAG}"
if apply_tag "${failed_tag}"; then
  printf '%s\n' "${failed_tag}" > "${STATE_DIR}/current-tag.tmp"
  mv "${STATE_DIR}/current-tag.tmp" "${STATE_DIR}/current-tag"
  log "deployed ${failed_tag} successfully"
  printf 'deploy: current=%s previous=%s\n' "${failed_tag}" "${previous:-none}"
  exit 0
fi

log "deployment of ${failed_tag} failed health checks"
compose logs --tail=120 app >&2 || true

if [[ -n "${previous}" && "${previous}" != "${failed_tag}" ]]; then
  log "rolling back to ${previous}"
  if [[ "${config_installed}" -eq 1 ]]; then
    restore_previous_config || log "continuing rollback with the current config"
  fi
  if apply_tag "${previous}"; then
    printf '%s\n' "${previous}" > "${STATE_DIR}/current-tag.tmp"
    mv "${STATE_DIR}/current-tag.tmp" "${STATE_DIR}/current-tag"
    printf '%s\n' "${failed_tag}" > "${STATE_DIR}/previous-tag.tmp"
    mv "${STATE_DIR}/previous-tag.tmp" "${STATE_DIR}/previous-tag"
    log "rollback to ${previous} succeeded"
  else
    log "ROLLBACK FAILED; the service needs manual inspection"
    compose ps >&2 || true
  fi
else
  log "no previous image is recorded; leaving the failed container for inspection"
fi

exit 1
