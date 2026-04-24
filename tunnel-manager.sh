#!/bin/bash
set -euo pipefail

ACTION="${1:-}"
AGENT_ID="${2:-}"
CLIENT_IP="${3:-}"
GUARD_IP="${4:-${GUARD_PUBLIC_IP:-}}"
GUARD_INTERNAL_IP="${5:-}"
CLIENT_INTERNAL_IP="${6:-}"
LISTEN_PORT="${7:-51820}"

TUNNEL_NAME="sbs_${AGENT_ID:0:8}"
CONFIG_DIR="/etc/wireguard"
CONFIG_FILE="${CONFIG_DIR}/${TUNNEL_NAME}.conf"

# Ensure wireguard is installed
if ! command -v wg &>/dev/null; then
  echo "WireGuard not found. Installing..." >&2
  apt-get update -qq && apt-get install -y wireguard wireguard-tools >/dev/null
fi

resolve_guard_ip() {
  if [ -n "$GUARD_IP" ]; then
    echo "$GUARD_IP"
    return
  fi
  curl -4 -fsS https://api.ipify.org
}

case $ACTION in
  add)
    GUARD_IP="$(resolve_guard_ip)"
    if [ -z "$CLIENT_IP" ] || [ -z "$GUARD_INTERNAL_IP" ] || [ -z "$CLIENT_INTERNAL_IP" ]; then
      echo "Usage: $0 add <agent_id> <client_public_ip> <guard_public_ip> <guard_tunnel_ip> <client_tunnel_ip> [listen_port]" >&2
      exit 1
    fi

    # Retrieve keys from env or generate if missing (Panel usually passes them, but we provide fallback)
    GUARD_PRIVATE_KEY="${SBS_GUARD_PRIVATE_KEY:-}"
    CLIENT_PUBLIC_KEY="${SBS_CLIENT_PUBLIC_KEY:-}"

    if [ -z "$GUARD_PRIVATE_KEY" ] || [ -z "$CLIENT_PUBLIC_KEY" ]; then
      echo "Error: WireGuard keys (SBS_GUARD_PRIVATE_KEY, SBS_CLIENT_PUBLIC_KEY) must be provided in environment." >&2
      exit 1
    fi

    echo "Creating WireGuard tunnel ${TUNNEL_NAME} for client ${CLIENT_IP}..."
    
    # 1. Enable IP Forwarding
    sysctl -w net.ipv4.ip_forward=1 > /dev/null

    # 2. Create WG Config
    mkdir -p "$CONFIG_DIR"
    chmod 700 "$CONFIG_DIR"

    cat <<EOF > "$CONFIG_FILE"
[Interface]
PrivateKey = ${GUARD_PRIVATE_KEY}
ListenPort = ${LISTEN_PORT}

[Peer]
PublicKey = ${CLIENT_PUBLIC_KEY}
AllowedIPs = ${CLIENT_INTERNAL_IP}/32
Endpoint = ${CLIENT_IP}:$(echo ${CLIENT_IP} | awk -F: '{print ($2?$2:51820)}')
PersistentKeepalive = 25
EOF
    chmod 600 "$CONFIG_FILE"

    # 3. Bring interface up
    wg-quick down "$TUNNEL_NAME" 2>/dev/null || true
    wg-quick up "$TUNNEL_NAME"

    # 4. NAT/Forwarding rules (using iptables for robustness alongside nftables)
    iptables -t nat -C POSTROUTING -s ${CLIENT_INTERNAL_IP}/32 -j MASQUERADE 2>/dev/null || \
      iptables -t nat -A POSTROUTING -s ${CLIENT_INTERNAL_IP}/32 -j MASQUERADE
    iptables -C FORWARD -i ${TUNNEL_NAME} -j ACCEPT 2>/dev/null || \
      iptables -A FORWARD -i ${TUNNEL_NAME} -j ACCEPT
    iptables -C FORWARD -o ${TUNNEL_NAME} -m state --state ESTABLISHED,RELATED -j ACCEPT 2>/dev/null || \
      iptables -A FORWARD -o ${TUNNEL_NAME} -m state --state ESTABLISHED,RELATED -j ACCEPT

    echo "{ \"status\": \"ok\", \"tunnel\": \"${TUNNEL_NAME}\", \"guard_public_ip\": \"${GUARD_IP}\", \"guard_tunnel_ip\": \"${GUARD_INTERNAL_IP}\", \"client_tunnel_ip\": \"${CLIENT_INTERNAL_IP}\", \"listen_port\": ${LISTEN_PORT} }"
    ;;

  remove)
    if [ -n "$CLIENT_INTERNAL_IP" ]; then
      iptables -t nat -D POSTROUTING -s ${CLIENT_INTERNAL_IP}/32 -j MASQUERADE 2>/dev/null || true
    fi
    wg-quick down "$TUNNEL_NAME" 2>/dev/null || true
    rm -f "$CONFIG_FILE"
    echo "{ \"status\": \"ok\", \"tunnel\": \"removed\" }"
    ;;

  list)
    wg show
    ;;
  *)
    echo "Usage: $0 <add|remove|list> <agent_id> [client_public_ip] [guard_public_ip] [guard_tunnel_ip] [client_tunnel_ip]" >&2
    exit 1
    ;;
esac
