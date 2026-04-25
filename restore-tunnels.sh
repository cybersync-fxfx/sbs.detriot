#!/bin/bash
set -euo pipefail

STATE_PATH="${SBS_TUNNEL_STATE_PATH:-/opt/detroit-sbs/tunnels.json}"
MANAGER_PATH="${SBS_TUNNEL_MANAGER:-/opt/detroit-sbs/tunnel-manager.sh}"

if [ ! -f "$STATE_PATH" ]; then
  echo "[restore-tunnels] No tunnel state file found at $STATE_PATH"
  exit 0
fi

if [ ! -x "$MANAGER_PATH" ]; then
  echo "[restore-tunnels] Tunnel manager missing or not executable: $MANAGER_PATH" >&2
  exit 1
fi

# Extract and run restoration for each allocation
node - "$STATE_PATH" <<'NODE' | while IFS=$'\t' read -r agentId clientPublicIp guardPublicIp guardTunnelIp clientTunnelIp listenPort guardPriv clientPub; do
const fs = require('fs');
const statePath = process.argv[2];
const raw = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const allocations = raw.allocations || {};
for (const [agentId, cfg] of Object.entries(allocations)) {
  if (!cfg || !cfg.clientPublicIp || !cfg.guardPublicIp || !cfg.guardTunnelIp || !cfg.clientTunnelIp) continue;
  process.stdout.write(
    `${agentId}\t${cfg.clientPublicIp}\t${cfg.guardPublicIp}\t${cfg.guardTunnelIp}\t${cfg.clientTunnelIp}\t${cfg.listenPort || 51820}\t${cfg.guardPrivateKey || ''}\t${cfg.clientPublicKey || ''}\n`
  );
}
NODE
  if [ -z "${agentId:-}" ]; then
    continue
  fi
  echo "[restore-tunnels] Restoring WireGuard tunnel for ${agentId} (${clientPublicIp})"
  
  export SBS_GUARD_PRIVATE_KEY="$guardPriv"
  export SBS_CLIENT_PUBLIC_KEY="$clientPub"
  
  if [ -z "$guardPriv" ] || [ -z "$clientPub" ]; then
    echo "[restore-tunnels] Skip ${agentId}: WireGuard keys missing in state file."
    continue
  fi

  bash "$MANAGER_PATH" add "$agentId" "$clientPublicIp" "$guardPublicIp" "$guardTunnelIp" "$clientTunnelIp" "$listenPort"
done
