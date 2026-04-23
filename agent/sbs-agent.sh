#!/bin/bash
# VERSION: 1.0.3
# Detroit SBS — Agent Bootstrap / Self-Contained Installer
# This file is the authoritative versioned agent.
# Clients update by running:  sudo bash sbs-update.sh

set -e

# ── Detect mode ───────────────────────────────────────────────
# If called with --install, performs a first-time install.
# Otherwise it just replaces the agent binary and restarts the service.

INSTALL_DIR="/opt/sbs-agent"
SERVICE_NAME="sbs-agent"
AGENT_BIN="$INSTALL_DIR/agent.js"
ENV_FILE="$INSTALL_DIR/.env"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[✗] Please run as root.${RESET}"
  exit 1
fi

echo -e "${CYAN}${BOLD}[SBS] Detroit SBS Agent — version $(grep '^# VERSION:' "$0" | awk '{print $3}')${RESET}"

# ── Write latest agent.js ─────────────────────────────────────
mkdir -p "$INSTALL_DIR"
mkdir -p /var/log/sbs
touch /var/log/sbs/attacks.log /var/log/sbs/agent.log

cat > "$AGENT_BIN" << 'AGENT_EOF'
const fs   = require('fs');
const os   = require('os');
const http = require('http');
const https = require('https');
const { exec } = require('child_process');

// ── Helpers ───────────────────────────────────────────────────
function getCpuUsage() {
  const cpus = os.cpus();
  let user=0,nice=0,sys=0,idle=0,irq=0;
  for (let c of cpus) {
    user+=c.times.user; nice+=c.times.nice;
    sys+=c.times.sys;   idle+=c.times.idle; irq+=c.times.irq;
  }
  return { total:user+nice+sys+idle+irq, active:user+nice+sys+irq };
}

let lastCpu = getCpuUsage();

const config = {
  server:  process.env.SBS_SERVER,
  agentId: process.env.SBS_AGENT_ID,
  apiKey:  process.env.SBS_API_KEY,
  enableTunnel: process.env.SBS_ENABLE_TUNNEL === '1'
};

function log(msg) {
  const line = '[' + new Date().toISOString() + '] ' + msg;
  try { fs.appendFileSync('/var/log/sbs/agent.log', line + '\n'); } catch(e){}
  console.log(line);
}

function request(path, method, data, cb, hops=0) {
  const url = new URL(path, config.server);
  const mod = url.protocol==='https:' ? https : http;
  const req = mod.request(url, {
    method,
    headers:{ 'Content-Type':'application/json','User-Agent':'sbs-agent/1.0.1' }
  }, res => {
    let body='';
    res.on('data', d => body+=d);
    res.on('end', () => {
      if (res.statusCode>=300&&res.statusCode<400&&res.headers.location&&hops<3) {
        const redir = new URL(res.headers.location, url);
        config.server = redir.origin;
        return request(redir.pathname+redir.search, method, data, cb, hops+1);
      }
      cb && cb(res.statusCode<200||res.statusCode>=300 ? new Error('HTTP '+res.statusCode) : null, body);
    });
  });
  req.on('error', e => cb && cb(e));
  if (data) req.write(JSON.stringify(data));
  req.end();
}

// ── Register ──────────────────────────────────────────────────
function register() {
  request('/api/agent/register','POST',{
    agentId:  config.agentId,
    apiKey:   config.apiKey,
    hostname: fs.readFileSync('/proc/sys/kernel/hostname','utf-8').trim(),
    ip:       'auto',
    os:       'Ubuntu',
    arch:     process.arch
  }, err => { if(err) log('[register] '+err.message); else log('[register] connected'); });
}

// ── Network bytes ─────────────────────────────────────────────
let lastNet = { rx:0, tx:0, ts:Date.now() };
function readNetBytes(cb) {
  exec("cat /proc/net/dev | awk 'NR>2 && !/lo/ {print $1,$2,$10; exit}'", (e,out)=>{
    if(e||!out.trim()) return cb(null,{rx:0,tx:0,iface:'unknown'});
    const p=out.trim().split(/\s+/);
    cb(null,{iface:(p[0]||'').replace(':',''),rx:parseInt(p[1])||0,tx:parseInt(p[2])||0});
  });
}

// ── Stats ─────────────────────────────────────────────────────
function sendStats() {
  readNetBytes((_,netNow)=>{
    const elapsed=(Date.now()-lastNet.ts)/1000||1;
    const rxDiff=Math.max(0,netNow.rx-lastNet.rx);
    const txDiff=Math.max(0,netNow.tx-lastNet.tx);
    const inMbps=parseFloat(((rxDiff*8)/elapsed/1e6).toFixed(3));
    const outMbps=parseFloat(((txDiff*8)/elapsed/1e6).toFixed(3));
    lastNet={rx:netNow.rx,tx:netNow.tx,ts:Date.now()};

    exec(
      "ss -ant | wc -l; " +
      "ss -ant | grep ESTAB | wc -l; " +
      "ss -ant | grep SYN-RECV | wc -l; " +
      "NFT_TABLE=$(nft list table inet sbs_filter 2>/dev/null && echo 'inet sbs_filter' || echo 'inet detroit_guard'); " +
      "nft list set $NFT_TABLE blacklist 2>/dev/null | grep -oE '([0-9]{1,3}\\.){3}[0-9]{1,3}' | wc -l; " +
      "free | grep Mem | awk '{print $3/$2 * 100}'; " +
      "cat /proc/uptime | awk '{print $1}'; " +
      "grep -E 'Accepted|Failed|Invalid|Disconnected' /var/log/auth.log 2>/dev/null | tail -n 20 || " +
      "grep -E 'Accepted|Failed|Invalid|Disconnected' /var/log/secure 2>/dev/null | tail -n 20 || echo ''; " +
      "echo '---ATTACKS---'; " +
      "tail -n 10 /var/log/sbs/attacks.log 2>/dev/null || echo ''",
      (err, stdout) => {
        if(err||!stdout) return;
        const lines=stdout.split('\n');
        const curCpu=getCpuUsage();
        const td=curCpu.total-lastCpu.total;
        const ad=curCpu.active-lastCpu.active;
        const cpuPct=td===0?0:(ad/td)*100;
        lastCpu=curCpu;

        const sep=lines.findIndex(l=>l.includes('---ATTACKS---'));
        const sshLines=lines.slice(7,sep>=0?sep:lines.length);
        const atkLines=sep>=0?lines.slice(sep+1):[];

        const logOutput=[
          ...sshLines.filter(l=>l.trim()).map(l=>'[SSH] '+l.trim()),
          ...atkLines.filter(l=>l.trim()).map(l=>'[FW]  '+l.trim()),
        ].join('\n');

        request('/api/agent/stats','POST',{
          agentId:     config.agentId,
          apiKey:      config.apiKey,
          connections: parseInt(lines[0])||0,
          established: parseInt(lines[1])||0,
          synRate:     parseInt(lines[2])||0,
          bannedIPs:   parseInt(lines[3])||0,
          cpuPercent:  parseFloat(cpuPct.toFixed(1))||0,
          memPercent:  parseFloat(lines[4])||0,
          inMbps, outMbps, pps:0,
          uptime:      parseFloat(lines[5])||0,
          udpConns:    parseInt(lines[6])||0,
          log:         logOutput,
          iface:       netNow.iface,
        });
      }
    );
  });
}

// ── Command poll ──────────────────────────────────────────────
function pollCommands() {
  request('/api/agent/commands?agentId='+config.agentId+'&apiKey='+config.apiKey,'GET',null,(err,res)=>{
    if(err||!res) return;
    try {
      const cmds=JSON.parse(res);
      cmds.forEach(cmd=>{
        exec(cmd.cmd,{timeout:30000},(error,stdout,stderr)=>{
          request('/api/agent/command-result','POST',{
            agentId:  config.agentId,
            apiKey:   config.apiKey,
            cmdId:    cmd.id,
            output:   stdout+stderr,
            exitCode: error?error.code:0
          });
        });
      });
    } catch(e){}
  });
}

// ── Boot ──────────────────────────────────────────────────────
register();
setInterval(register,     15000);
setInterval(sendStats,     1000);
setInterval(pollCommands,  1000);
AGENT_EOF

chmod 600 "$AGENT_BIN"

echo -e "${GREEN}[✓] agent.js updated.${RESET}"

# ── First-time install mode ───────────────────────────────────
if [ "$1" = "--install" ]; then
  echo -e "${CYAN}[SBS] First-time install mode...${RESET}"

  # Prompt for required values
  read -rp "SBS Server URL (e.g. https://your-server.com): " SBS_SERVER
  read -rp "Agent ID: " SBS_AGENT_ID
  read -rp "API Key: " SBS_API_KEY

  cat > "$ENV_FILE" << EOF
SBS_SERVER=$SBS_SERVER
SBS_AGENT_ID=$SBS_AGENT_ID
SBS_API_KEY=$SBS_API_KEY
SBS_ENABLE_TUNNEL=0
EOF
  chmod 600 "$ENV_FILE"
  echo -e "${GREEN}[✓] .env written to $ENV_FILE${RESET}"

  # Install node if missing
  if ! command -v node &>/dev/null; then
    echo -e "${CYAN}[SBS] Installing Node.js 20.x...${RESET}"
    apt-get update -qq
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - &>/dev/null
    apt-get install -y nodejs &>/dev/null
    echo -e "${GREEN}[✓] Node.js installed.${RESET}"
  fi

  # Write systemd unit
  cat > /etc/systemd/system/sbs-agent.service << EOF
[Unit]
Description=Detroit SBS Agent
After=network.target

[Service]
Type=simple
User=root
EnvironmentFile=$ENV_FILE
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node $AGENT_BIN
Restart=always
RestartSec=5
StandardOutput=append:/var/log/sbs/agent.log
StandardError=append:/var/log/sbs/agent.log

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable sbs-agent
  echo -e "${GREEN}[✓] Systemd service registered.${RESET}"
fi

# ── Always: restart service ───────────────────────────────────
if systemctl list-units --type=service | grep -q "$SERVICE_NAME"; then
  systemctl restart "$SERVICE_NAME"
  sleep 2
  if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo -e "${GREEN}[✓] $SERVICE_NAME is running.${RESET}"
  else
    echo -e "${RED}[✗] $SERVICE_NAME failed to start. Check: journalctl -u $SERVICE_NAME -n 30 --no-pager${RESET}"
    exit 1
  fi
else
  echo -e "${YELLOW}[!] Service not registered. Run: sudo bash $0 --install${RESET}"
fi

echo -e "${GREEN}${BOLD}[SBS] Agent ready. ✓${RESET}"
