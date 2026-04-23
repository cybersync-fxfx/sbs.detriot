#!/bin/bash
set -euo pipefail

ENV_FILE="${SBS_TUNNEL_ENV_FILE:-/opt/sbs-agent/tunnel.env}"
LOG_FILE="${SBS_TUNNEL_LOG_FILE:-/var/log/sbs/agent.log}"

log() {
  local message="$1"
  mkdir -p "$(dirname "$LOG_FILE")"
  touch "$LOG_FILE"
  printf '[%s] [tunnel] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$message" | tee -a "$LOG_FILE" >/dev/null
}

load_env() {
  if [ ! -f "$ENV_FILE" ]; then
    log "missing tunnel env file at $ENV_FILE"
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a

  : "${SBS_TUNNEL_NAME:?Missing SBS_TUNNEL_NAME}"
  : "${SBS_GUARD_PUBLIC_IP:?Missing SBS_GUARD_PUBLIC_IP}"
  : "${SBS_GUARD_TUNNEL_IP:?Missing SBS_GUARD_TUNNEL_IP}"
  : "${SBS_CLIENT_TUNNEL_IP:?Missing SBS_CLIENT_TUNNEL_IP}"
  SBS_TUNNEL_CIDR="${SBS_TUNNEL_CIDR:-30}"
}

detect_local_ip() {
  ip route get "$SBS_GUARD_PUBLIC_IP" | awk '/src/ {for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit }}'
}

apply_tunnel() {
  load_env
  local local_ip
  local_ip="$(detect_local_ip)"

  if [ -z "$local_ip" ]; then
    log "unable to determine local public IP for guard $SBS_GUARD_PUBLIC_IP"
    exit 1
  fi

  log "applying ${SBS_TUNNEL_NAME} via ${local_ip} -> ${SBS_GUARD_PUBLIC_IP}"
  ip tunnel del "$SBS_TUNNEL_NAME" 2>/dev/null || true
  ip tunnel add "$SBS_TUNNEL_NAME" mode gre remote "$SBS_GUARD_PUBLIC_IP" local "$local_ip" ttl 255
  ip addr replace "${SBS_CLIENT_TUNNEL_IP}/${SBS_TUNNEL_CIDR}" dev "$SBS_TUNNEL_NAME"
  ip link set "$SBS_TUNNEL_NAME" up
  ip route replace "${SBS_GUARD_TUNNEL_IP}/32" dev "$SBS_TUNNEL_NAME"

  if [ -n "${SBS_PROTECTED_CIDRS:-}" ]; then
    OLD_IFS="$IFS"
    IFS=','
    for subnet in $SBS_PROTECTED_CIDRS; do
      subnet="$(echo "$subnet" | xargs)"
      if [ -n "$subnet" ]; then
        ip route replace "$subnet" via "$SBS_GUARD_TUNNEL_IP" dev "$SBS_TUNNEL_NAME"
      fi
    done
    IFS="$OLD_IFS"
  fi

  log "interface ${SBS_TUNNEL_NAME} is ready with ${SBS_CLIENT_TUNNEL_IP}/${SBS_TUNNEL_CIDR}"
}

remove_tunnel() {
  if [ -f "$ENV_FILE" ]; then
    load_env
    log "removing ${SBS_TUNNEL_NAME}"
    ip link set "$SBS_TUNNEL_NAME" down 2>/dev/null || true
    ip tunnel del "$SBS_TUNNEL_NAME" 2>/dev/null || true
  fi
}

case "${1:---apply}" in
  --apply|apply)
    apply_tunnel
    ;;
  --remove|remove)
    remove_tunnel
    ;;
  *)
    echo "Usage: $0 [--apply|--remove]" >&2
    exit 1
    ;;
esac
