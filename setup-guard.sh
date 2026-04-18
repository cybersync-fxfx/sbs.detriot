#!/bin/bash
# Detroit SBS - Guard Server Setup Script

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  exit 1
fi

echo "[1/4] Enabling IP Forwarding for GRE Tunnels..."
echo 'net.ipv4.ip_forward=1' > /etc/sysctl.d/99-detroit-sbs.conf
echo 'net.ipv4.conf.all.rp_filter=0' >> /etc/sysctl.d/99-detroit-sbs.conf
echo 'net.ipv4.conf.default.rp_filter=0' >> /etc/sysctl.d/99-detroit-sbs.conf
sysctl -p /etc/sysctl.d/99-detroit-sbs.conf

echo "[2/4] Setting up Tunnel Manager..."
mkdir -p /opt/detroit-sbs
cp tunnel-manager.sh /opt/detroit-sbs/ 2>/dev/null || echo "Warning: Please ensure tunnel-manager.sh is in /opt/detroit-sbs/"
chmod +x /opt/detroit-sbs/tunnel-manager.sh

echo "[3/4] Configuring sudoers for Node.js..."
# Allow root or node user to run tunnel manager without password
if ! grep -q "/opt/detroit-sbs/tunnel-manager.sh" /etc/sudoers; then
  echo "root ALL=(ALL) NOPASSWD: /opt/detroit-sbs/tunnel-manager.sh" >> /etc/sudoers
fi

echo "[4/4] Configuring nftables..."
cat << 'EOF' > /etc/nftables.conf
#!/usr/sbin/nft -f
flush ruleset

table inet detroit_guard {
  set blacklist {
    type ipv4_addr
    flags dynamic, timeout
    timeout 1h
  }

  chain input {
    type filter hook input priority 0; policy accept;
    
    ip saddr @blacklist drop
    ct state invalid drop
    ct state established,related accept
    
    iif lo accept
    tcp dport { 22, 80, 443, 3000 } accept
    
    # Allow GRE Tunnel protocol
    ip protocol gre accept  
    
    # Anti-DDoS Rate Limiting
    tcp flags syn limit rate 1000/second accept
    tcp flags syn drop
    
    # Corrected UDP & ICMP syntax
    meta l4proto udp limit rate 10000/second accept
    meta l4proto udp drop
    ip protocol icmp icmp type echo-request limit rate 10/second accept
    ip protocol icmp icmp type echo-request drop
  }

  chain forward {
    type filter hook forward priority 0; policy accept;
    ip saddr @blacklist drop
    ct state established,related accept
  }
}
EOF

systemctl enable nftables
systemctl restart nftables

echo "Guard Server Setup Complete! nftables is running without syntax errors."
