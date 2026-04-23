#!/bin/bash
# SBS Terminal CLI — Guard Server Tool
# Usage:
#   bash sbs-cli.sh              → show connected agents
#   bash sbs-cli.sh --blocklist  → show currently blocked IPs
#   bash sbs-cli.sh --ban <ip>   → ban an IP via nftables
#   bash sbs-cli.sh --unban <ip> → unban an IP via nftables
#   bash sbs-cli.sh --help       → show this help

clear

CYAN="\e[1;36m"
GREEN="\e[1;32m"
YELLOW="\e[1;33m"
RED="\e[1;31m"
WHITE="\e[1;37m"
DIM="\e[0;90m"
RESET="\e[0m"

NFT_TABLE="inet sbs_filter"
NFT_SET="blacklist"

echo -e "${CYAN}=================================================${RESET}"
echo -e "${CYAN}          DETROIT SBS - TERMINAL CLI             ${RESET}"
echo -e "${CYAN}=================================================${RESET}"
echo ""

# ── help ──────────────────────────────────────────────────────
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  echo -e "${WHITE}Available commands:${RESET}"
  echo ""
  echo -e "  ${GREEN}bash sbs-cli.sh${RESET}              — List connected agents"
  echo -e "  ${GREEN}bash sbs-cli.sh --blocklist${RESET}  — Show all blocked IPs on the firewall"
  echo -e "  ${GREEN}bash sbs-cli.sh --ban <ip>${RESET}   — Block an IP address"
  echo -e "  ${GREEN}bash sbs-cli.sh --unban <ip>${RESET} — Unblock an IP address"
  echo -e "  ${GREEN}bash sbs-cli.sh --help${RESET}       — Show this help"
  echo ""
  exit 0
fi

# ── blocklist ─────────────────────────────────────────────────
if [ "$1" = "--blocklist" ] || [ "$1" = "-b" ]; then
  echo -e "${WHITE}[🔒] Fetching blocked IPs from nftables...${RESET}"
  echo ""

  if ! command -v nft &>/dev/null; then
    echo -e "${RED}[✗] nft command not found. Is nftables installed?${RESET}"
    exit 1
  fi

  RAW=$(nft list set $NFT_TABLE $NFT_SET 2>&1)
  EXIT=$?

  if [ $EXIT -ne 0 ]; then
    echo -e "${RED}[✗] Failed to read nftables set:${RESET}"
    echo -e "${DIM}$RAW${RESET}"
    echo ""
    echo -e "${YELLOW}[!] Make sure nftables is running: systemctl status nftables${RESET}"
    exit 1
  fi

  # Extract all IPs — each entry looks like: 1.2.3.4 timeout 1h expires ...
  BLOCKED_IPS=$(echo "$RAW" | grep -oE '\b([0-9]{1,3}\.){3}[0-9]{1,3}\b' | sort -u)

  if [ -z "$BLOCKED_IPS" ]; then
    echo -e "${GREEN}[✓] No IPs are currently blocked.${RESET}"
    echo ""
    echo -e "${DIM}Firewall set output:${RESET}"
    echo -e "${DIM}$RAW${RESET}"
    echo ""
    echo -e "${CYAN}=================================================${RESET}"
    exit 0
  fi

  COUNT=$(echo "$BLOCKED_IPS" | wc -l | tr -d ' ')
  echo -e "${RED}[!] $COUNT blocked IP(s) found:${RESET}"
  echo ""

  printf "${WHITE}%-5s | %-20s${RESET}\n" "#" "IP ADDRESS"
  printf "%-5s | %-20s\n" "-----" "--------------------"

  I=1
  while IFS= read -r IP; do
    printf "${RED}%-5s${RESET} | ${WHITE}%-20s${RESET}\n" "$I" "$IP"
    I=$((I+1))
  done <<< "$BLOCKED_IPS"

  echo ""
  echo -e "${DIM}Source: nft list set $NFT_TABLE $NFT_SET${RESET}"
  echo -e "${CYAN}=================================================${RESET}"
  echo ""
  exit 0
fi

# ── ban ───────────────────────────────────────────────────────
if [ "$1" = "--ban" ]; then
  IP="$2"

  if [ -z "$IP" ]; then
    echo -e "${RED}[✗] Usage: bash sbs-cli.sh --ban <ip>${RESET}"
    exit 1
  fi

  # Validate IPv4
  if ! echo "$IP" | grep -qE '^([0-9]{1,3}\.){3}[0-9]{1,3}$'; then
    echo -e "${RED}[✗] Invalid IP address: $IP${RESET}"
    exit 1
  fi

  echo -e "${YELLOW}[→] Banning $IP ...${RESET}"
  OUTPUT=$(nft add element $NFT_TABLE $NFT_SET { $IP } 2>&1)
  EXIT=$?

  if [ $EXIT -ne 0 ]; then
    echo -e "${RED}[✗] Failed to ban $IP:${RESET}"
    echo -e "${DIM}$OUTPUT${RESET}"
    exit 1
  fi

  echo -e "${GREEN}[✓] $IP has been banned on the firewall.${RESET}"
  echo ""
  echo -e "${DIM}Verify with: bash sbs-cli.sh --blocklist${RESET}"
  echo ""
  exit 0
fi

# ── unban ─────────────────────────────────────────────────────
if [ "$1" = "--unban" ]; then
  IP="$2"

  if [ -z "$IP" ]; then
    echo -e "${RED}[✗] Usage: bash sbs-cli.sh --unban <ip>${RESET}"
    exit 1
  fi

  if ! echo "$IP" | grep -qE '^([0-9]{1,3}\.){3}[0-9]{1,3}$'; then
    echo -e "${RED}[✗] Invalid IP address: $IP${RESET}"
    exit 1
  fi

  echo -e "${YELLOW}[→] Unbanning $IP ...${RESET}"
  OUTPUT=$(nft delete element $NFT_TABLE $NFT_SET { $IP } 2>&1)
  EXIT=$?

  if [ $EXIT -ne 0 ]; then
    echo -e "${RED}[✗] Failed to unban $IP (may not be in the set):${RESET}"
    echo -e "${DIM}$OUTPUT${RESET}"
    exit 1
  fi

  echo -e "${GREEN}[✓] $IP has been unbanned.${RESET}"
  echo ""
  exit 0
fi

# ── default: show connected agents ────────────────────────────
AGENTS_JSON=$(curl -s http://127.0.0.1:3001/api/internal/agents)

if [ -z "$AGENTS_JSON" ] || [ "$AGENTS_JSON" = "{}" ]; then
  echo -e "${YELLOW}[!] No agents currently connected to this Guard Server.${RESET}"
  echo ""
  echo -e "${DIM}Tip: Run 'bash sbs-cli.sh --help' to see all commands.${RESET}"
  echo ""
  exit 0
fi

AGENT_COUNT=$(echo "$AGENTS_JSON" | node -e "
const data = require('fs').readFileSync(0, 'utf-8');
if(data) {
  try {
    const obj = JSON.parse(data);
    console.log(Object.keys(obj).length);
  } catch(e) { console.log('0'); }
} else { console.log('0'); }
")

echo -e "${GREEN}[+] Found $AGENT_COUNT connected agent(s):${RESET}"
echo ""

printf "${WHITE}%-38s | %-16s | %-15s | %-15s${RESET}\n" "AGENT ID" "IP ADDRESS" "HOSTNAME" "OS"
printf "%-38s | %-16s | %-15s | %-15s\n" "--------------------------------------" "----------------" "---------------" "---------------"

echo "$AGENTS_JSON" | node -e "
const fs = require('fs');
const data = fs.readFileSync(0, 'utf-8');
if (!data) process.exit(0);
try {
  const agents = JSON.parse(data);
  if (agents.error) { console.error('Error:', agents.error); process.exit(1); }
  Object.entries(agents).forEach(([id, a]) => {
    const ip   = (a.ip       || 'N/A');
    const host = (a.hostname || 'N/A').substring(0, 15);
    const os   = (a.os       || 'N/A').substring(0, 15);
    let displayId = id;
    if (displayId.length > 38) displayId = displayId.substring(0, 35) + '...';
    console.log(displayId.padEnd(38) + ' | ' + ip.padEnd(16) + ' | ' + host.padEnd(15) + ' | ' + os.padEnd(15));
  });
} catch(e) { console.error('Failed to parse agent data.'); }
"

echo ""
echo -e "${DIM}Tip: Run 'bash sbs-cli.sh --help' to see all commands.${RESET}"
echo -e "${CYAN}=================================================${RESET}"
echo ""
