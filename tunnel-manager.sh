#!/bin/bash
ACTION=$1
AGENT_ID=$2
CLIENT_IP=$3
GUARD_IP=$(curl -s ifconfig.me)

case $ACTION in
  add)
    # Create GRE tunnel to client
    ip tunnel add gre_${AGENT_ID} mode gre \
      remote ${CLIENT_IP} \
      local ${GUARD_IP} \
      ttl 255 2>/dev/null || true
    ip link set gre_${AGENT_ID} up 2>/dev/null || true

    # Enable NAT masquerade through tunnel
    iptables -t nat -A POSTROUTING \
      -o gre_${AGENT_ID} -j MASQUERADE 2>/dev/null || true

    # Forward traffic through tunnel
    iptables -A FORWARD \
      -i gre_${AGENT_ID} -j ACCEPT 2>/dev/null || true
    iptables -A FORWARD \
      -o gre_${AGENT_ID} -j ACCEPT 2>/dev/null || true

    echo "{ \"status\": \"ok\", \"tunnel\": \"gre_${AGENT_ID}\" }"
    ;;

  remove)
    ip link set gre_${AGENT_ID} down 2>/dev/null || true
    ip tunnel del gre_${AGENT_ID} 2>/dev/null || true
    iptables -t nat -D POSTROUTING \
      -o gre_${AGENT_ID} -j MASQUERADE 2>/dev/null || true
    echo "{ \"status\": \"ok\", \"tunnel\": \"removed\" }"
    ;;

  list)
    ip tunnel show | grep gre_
    ;;
esac
