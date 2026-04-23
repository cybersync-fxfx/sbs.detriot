#!/bin/bash
# SBS Detroit - Client Tunnel Setup Script
# Usage: sudo bash setup-tunnel-client.sh <guard_public_ip> <client_internal_ip> <guard_internal_ip>

GUARD_PUB_IP=$1
CLIENT_INT_IP=$2
GUARD_INT_IP=$3

if [ -z "$GUARD_PUB_IP" ] || [ -z "$CLIENT_INT_IP" ] || [ -z "$GUARD_INT_IP" ]; then
  echo "Usage: $0 <guard_public_ip> <client_internal_ip> <guard_internal_ip>"
  exit 1
fi

TUNNEL_NAME="gre_sbs"

echo "[1/4] Creating GRE tunnel to ${GUARD_PUB_IP}..."
ip tunnel del ${TUNNEL_NAME} 2>/dev/null || true
ip tunnel add ${TUNNEL_NAME} mode gre remote ${GUARD_PUB_IP} local $(curl -s ifconfig.me) ttl 255
ip addr add ${CLIENT_INT_IP}/30 dev ${TUNNEL_NAME}
ip link set ${TUNNEL_NAME} up

echo "[2/4] Configuring Routing..."
# Create a new routing table for the tunnel
echo "100 sbs_route" >> /etc/iproute2/rt_tables 2>/dev/null || true

# Flush the table
ip route flush table sbs_route

# Add default route through the tunnel
ip route add default via ${GUARD_INT_IP} dev ${TUNNEL_NAME} table sbs_route

# Add a rule to use this table for all traffic (except what we exclude)
# We need to make sure the connection to the panel doesn't go through the tunnel if the tunnel is what carries it.
# Actually, the panel IS the guard. So traffic to GUARD_PUB_IP must go through the default gateway.
DEFAULT_GW=$(ip route | grep default | awk '{print $3}')
ip route add ${GUARD_PUB_IP} via ${DEFAULT_GW} table sbs_route

# Use the table
ip rule add from ${CLIENT_INT_IP} table sbs_route
ip rule add to ${GUARD_INT_IP} table sbs_route

# Optionally, route ALL traffic through the tunnel (DANGER: can lock you out)
# ip rule add from all table sbs_route priority 100

echo "[3/4] Blocking Direct Access..."
# Update nftables to only allow traffic from the guard IP on public ports
cat << EOF > /etc/nftables.conf
#!/usr/sbin/nft -f
flush ruleset

table inet sbs_filter {
  chain input {
    type filter hook input priority 0; policy accept;
    
    # Allow loopback
    iif lo accept

    # Allow established connections
    ct state established,related accept

    # Allow GRE for the tunnel
    ip saddr ${GUARD_PUB_IP} ip protocol gre accept

    # Allow SSH from everywhere (safeguard)
    tcp dport 22 accept

    # ONLY allow traffic through the GRE tunnel for other ports
    iifname "${TUNNEL_NAME}" accept
    
    # Drop everything else on public interfaces (optional, be careful)
    # iifname != "${TUNNEL_NAME}" tcp dport { 80, 443 } drop
  }
}
EOF
nft -f /etc/nftables.conf

echo "[4/4] Testing Connectivity..."
ping -c 3 ${GUARD_INT_IP}

echo "Tunnel setup complete! Internal IP: ${CLIENT_INT_IP}"
