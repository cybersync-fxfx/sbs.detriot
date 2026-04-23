#!/bin/bash
set -euo pipefail

ACTION="${1:-}"
AGENT_ID="${2:-}"
CLIENT_IP="${3:-}"
GUARD_IP="${4:-${GUARD_PUBLIC_IP:-}}"
GUARD_INTERNAL_IP="${5:-}"
CLIENT_INTERNAL_IP="${6:-}"

TUNNEL_NAME="gre_${AGENT_ID:0:8}"

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
      echo "Usage: $0 add <agent_id> <client_public_ip> <guard_public_ip> <guard_tunnel_ip> <client_tunnel_ip>" >&2
      exit 1
    fi

    echo "Creating GRE tunnel to client ${CLIENT_IP}..."
    
    # 1. Enable IP Forwarding
    sysctl -w net.ipv4.ip_forward=1 > /dev/null

    # 2. Create GRE tunnel
    ip tunnel del ${TUNNEL_NAME} 2>/dev/null || true
    ip tunnel add ${TUNNEL_NAME} mode gre \
      remote ${CLIENT_IP} \
      local ${GUARD_IP} \
      ttl 255
    
    ip addr replace ${GUARD_INTERNAL_IP}/30 dev ${TUNNEL_NAME}
    ip link set ${TUNNEL_NAME} up

    # 3. NAT/Forwarding rules
    # Allow traffic to be forwarded from the tunnel to the internet
    iptables -t nat -C POSTROUTING -s ${CLIENT_INTERNAL_IP}/32 -j MASQUERADE 2>/dev/null || \
      iptables -t nat -A POSTROUTING -s ${CLIENT_INTERNAL_IP}/32 -j MASQUERADE
    iptables -C FORWARD -i ${TUNNEL_NAME} -j ACCEPT 2>/dev/null || \
      iptables -A FORWARD -i ${TUNNEL_NAME} -j ACCEPT
    iptables -C FORWARD -o ${TUNNEL_NAME} -m state --state ESTABLISHED,RELATED -j ACCEPT 2>/dev/null || \
      iptables -A FORWARD -o ${TUNNEL_NAME} -m state --state ESTABLISHED,RELATED -j ACCEPT

    ip -o link show ${TUNNEL_NAME} > /dev/null

    echo "{ \"status\": \"ok\", \"tunnel\": \"${TUNNEL_NAME}\", \"guard_public_ip\": \"${GUARD_IP}\", \"guard_tunnel_ip\": \"${GUARD_INTERNAL_IP}\", \"client_tunnel_ip\": \"${CLIENT_INTERNAL_IP}\" }"
    ;;

  remove)
    if [ -n "$CLIENT_INTERNAL_IP" ]; then
      iptables -t nat -D POSTROUTING -s ${CLIENT_INTERNAL_IP}/32 -j MASQUERADE 2>/dev/null || true
    fi
    ip link set ${TUNNEL_NAME} down 2>/dev/null || true
    ip tunnel del ${TUNNEL_NAME} 2>/dev/null || true
    echo "{ \"status\": \"ok\", \"tunnel\": \"removed\" }"
    ;;

  list)
    ip tunnel show | grep gre_
    ;;
  *)
    echo "Usage: $0 <add|remove|list> <agent_id> [client_public_ip] [guard_public_ip] [guard_tunnel_ip] [client_tunnel_ip]" >&2
    exit 1
    ;;
esac
