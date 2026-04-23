#!/bin/bash
# Detroit SBS - Guard Server Setup Script

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  exit 1
fi

echo "[1/5] Enabling IP Forwarding for GRE Tunnels..."
echo 'net.ipv4.ip_forward=1' > /etc/sysctl.d/99-detroit-sbs.conf
echo 'net.ipv4.conf.all.rp_filter=0' >> /etc/sysctl.d/99-detroit-sbs.conf
echo 'net.ipv4.conf.default.rp_filter=0' >> /etc/sysctl.d/99-detroit-sbs.conf
sysctl -p /etc/sysctl.d/99-detroit-sbs.conf

echo "[2/5] Setting up Tunnel Manager..."
mkdir -p /opt/detroit-sbs
cp tunnel-manager.sh /opt/detroit-sbs/ 2>/dev/null || echo "Warning: Please ensure tunnel-manager.sh is in /opt/detroit-sbs/"
chmod +x /opt/detroit-sbs/tunnel-manager.sh

echo "[3/5] Configuring sudoers for Node.js..."
if ! grep -q "/opt/detroit-sbs/tunnel-manager.sh" /etc/sudoers; then
  echo "root ALL=(ALL) NOPASSWD: /opt/detroit-sbs/tunnel-manager.sh" >> /etc/sudoers
fi

echo "[4/5] Configuring nftables with auto-ban..."
mkdir -p /var/log/sbs
touch /var/log/sbs/attacks.log

cat << 'NFTEOF' > /etc/nftables.conf
#!/usr/sbin/nft -f
flush ruleset

table inet detroit_guard {

  # Persistent blacklist — 24h ban, visible in dashboard and CLI
  set blacklist {
    type ipv4_addr
    flags dynamic,timeout
    timeout 24h
  }

  # SYN flood meter — tracks per-IP SYN rate
  set syn_meter {
    type ipv4_addr
    flags dynamic,timeout
    timeout 10s
  }

  # UDP flood meter — tracks per-IP UDP rate
  set udp_meter {
    type ipv4_addr
    flags dynamic,timeout
    timeout 10s
  }

  chain input {
    type filter hook input priority 0; policy accept;

    # Drop already-banned IPs immediately
    ip saddr @blacklist drop

    # Drop invalid connections
    ct state invalid drop

    # Allow established/related and loopback
    ct state established,related accept
    iif lo accept

    # Allow allowed ports
    tcp dport { 22, 80, 443, 3000 } accept

    # Allow GRE for tunnels
    ip protocol gre accept

    # Auto-ban SYN floods: >100 SYN/s from same IP = 24h ban
    tcp flags syn \
      add @syn_meter { ip saddr limit rate over 100/second } \
      add @blacklist { ip saddr timeout 24h } \
      log prefix "[SBS-BAN-SYN] " \
      drop

    # Allow normal SYN traffic under the threshold
    tcp flags syn accept

    # Auto-ban UDP floods: >5000 pps from same IP = 24h ban
    meta l4proto udp \
      add @udp_meter { ip saddr limit rate over 5000/second } \
      add @blacklist { ip saddr timeout 24h } \
      log prefix "[SBS-BAN-UDP] " \
      drop

    # Allow normal UDP traffic under the threshold
    meta l4proto udp accept

    # ICMP rate limit (no auto-ban, just throttle)
    ip protocol icmp limit rate 10/second accept
    ip protocol icmp drop
  }

  chain forward {
    type filter hook forward priority 0; policy accept;
    ip saddr @blacklist drop
    ct state established,related accept
  }
}
NFTEOF

systemctl enable nftables
systemctl restart nftables
echo "[✓] nftables loaded with auto-ban rules."

echo "[5/5] Setting up attack log writer (sbs-ban-logger)..."

cat << 'LOGGEREOF' > /opt/detroit-sbs/ban-logger.sh
#!/bin/bash
# Watches kernel logs for SBS auto-ban events and writes them to
# /var/log/sbs/attacks.log so the SBS dashboard can display them.
touch /var/log/sbs/attacks.log

journalctl -kf --no-hostname 2>/dev/null | grep --line-buffered '\[SBS-BAN-' | while IFS= read -r line; do
  SRC=$(echo "$line" | grep -oP 'SRC=\K[\d.]+')
  PROTO=$(echo "$line" | grep -oP '\[SBS-BAN-\K[A-Z]+(?=\])')
  TS=$(date '+%Y-%m-%d %H:%M:%S')
  if [ -n "$SRC" ]; then
    echo "[$TS] AUTO-BAN ${PROTO:-UNKNOWN} flood from ${SRC} — blacklisted for 24h" >> /var/log/sbs/attacks.log
  fi
done
LOGGEREOF

chmod +x /opt/detroit-sbs/ban-logger.sh

cat << 'SVCEOF' > /etc/systemd/system/sbs-ban-logger.service
[Unit]
Description=SBS Auto-Ban Event Logger
After=network.target nftables.service

[Service]
Type=simple
ExecStart=/opt/detroit-sbs/ban-logger.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable sbs-ban-logger
systemctl restart sbs-ban-logger

echo ""
echo "=============================================="
echo "  Guard Server Setup Complete!"
echo "=============================================="
echo ""
echo "  Auto-ban is now ACTIVE:"
echo "  SYN flood > 100/s   -> IP banned for 24h"
echo "  UDP flood > 5000/s  -> IP banned for 24h"
echo "  All bans logged to /var/log/sbs/attacks.log"
echo "  Dashboard security feed will show events live"
echo ""
echo "  Check active bans anytime:"
echo "  bash /opt/sbs/sbs-cli.sh --blocklist"
echo ""
