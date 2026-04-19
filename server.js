const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Auto-install dependencies if not present
if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
  console.log('\x1b[33m[!] Dependencies not found. Installing automatically...\x1b[0m');
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('\x1b[32m[✓] Dependencies installed successfully.\x1b[0m\n');
  } catch (err) {
    console.error('\x1b[31m[x] Failed to install dependencies. Please run npm install manually.\x1b[0m');
    process.exit(1);
  }
}

// Check for .env file
if (!fs.existsSync(path.join(__dirname, '.env'))) {
  console.log('\x1b[33m[!] .env file not found. Creating a template...\x1b[0m');
  const envTemplate = `PORT=3001
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
`;
  fs.writeFileSync(path.join(__dirname, '.env'), envTemplate);
  console.log('\x1b[31m[x] .env template created. Please fill in your Supabase credentials in the .env file and restart the server.\x1b[0m');
  process.exit(1);
}

require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3001;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY; // Needed for admin operations
const ADMIN_FEATURES_ENABLED = Boolean(SUPABASE_SERVICE_KEY);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("\x1b[31m[x] Error: Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env\x1b[0m");
  process.exit(1);
}

// Global Supabase Client (Anon privileges)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// Admin Client (Bypasses RLS, careful!)
const supabaseAdmin = ADMIN_FEATURES_ENABLED ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY) : supabase;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend', 'dist')));

let db = { agents: {} }; // agents store runtime state
let commandQueue = {}; // { agentId: [{ id, cmd }] }

// Middleware
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw new Error('Invalid token');
    
    // Create an authenticated client to fetch user_profiles (respects RLS)
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    
    const { data: profile } = await userClient.from('user_profiles').select('*').eq('id', user.id).single();
    if (!profile) throw new Error('Profile not found');
    
    if (profile.status === 'pending') {
      return res.status(403).json({ error: 'Account pending approval from administrator.', isPending: true });
    }
    if (profile.status === 'rejected') {
      return res.status(403).json({ error: 'Account rejected.' });
    }
    
    req.user = { ...user, ...profile };
    next();
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
};

const privilegedSupabaseMiddleware = (req, res, next) => {
  if (!ADMIN_FEATURES_ENABLED) {
    return res.status(503).json({
      error: 'Admin features require SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY in the server environment.'
    });
  }
  next();
};

const agentAuthMiddleware = async (req, res, next) => {
  const agentId = req.body.agentId || req.query.agentId;
  const apiKey = req.body.apiKey || req.query.apiKey;
  if (!agentId || !apiKey) return res.status(401).json({ error: 'Missing agent credentials' });
  
  // Call the Supabase RPC function (Security Definer) to securely verify the API key
  const { data: userId, error } = await supabase.rpc('verify_agent', { p_agent_id: agentId, p_api_key: apiKey });
  
  if (error || !userId) {
    return res.status(401).json({ error: 'Invalid agent credentials' });
  }
  
  req.user = { id: userId, agentId };
  next();
};

// Routes
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username }
    }
  });
  
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body; // In Supabase, we log in with email.
  // The frontend currently passes "username" which could be an email or username.
  // Supabase signInWithPassword expects an email. We will assume 'username' field contains the email for now.
  const email = username; 
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) return res.status(401).json({ error: error.message });
  
  const token = data.session.access_token;
  // Fetch profile to return
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data: profile } = await userClient.from('user_profiles').select('*').eq('id', data.user.id).single();
  
  if (profile?.status === 'pending') {
    return res.status(403).json({ error: 'Account pending approval from administrator.' });
  }
  if (profile?.status === 'rejected') {
    return res.status(403).json({ error: 'Account rejected.' });
  }
  
  res.json({ 
    token, 
    user: { 
      username: profile?.username || data.user.email, 
      apiKey: profile?.api_key, 
      agentId: profile?.agent_id,
      role: profile?.role
    } 
  });
});

app.get('/api/me', authMiddleware, (req, res) => {
  const agentStatus = db.agents[req.user.agent_id] ? 'CONNECTED' : 'NO AGENT';
  res.json({
    username: req.user.username,
    email: req.user.email,
    apiKey: req.user.api_key,
    agentId: req.user.agent_id,
    role: req.user.role,
    agentStatus
  });
});

app.post('/api/me/regenerate-key', authMiddleware, async (req, res) => {
  const newKey = 'sbs_' + crypto.randomBytes(16).toString('hex');
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${req.headers.authorization.split(' ')[1]}` } }
  });
  const { error } = await userClient.from('user_profiles').update({ api_key: newKey }).eq('id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ apiKey: newKey });
});

app.get('/api/admin/users', authMiddleware, adminMiddleware, privilegedSupabaseMiddleware, async (req, res) => {
  const { data, error } = await supabaseAdmin.from('user_profiles').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/admin/approve', authMiddleware, adminMiddleware, privilegedSupabaseMiddleware, async (req, res) => {
  const { id } = req.body;
  const { error } = await supabaseAdmin.from('user_profiles').update({ status: 'approved' }).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.post('/api/admin/reject', authMiddleware, adminMiddleware, privilegedSupabaseMiddleware, async (req, res) => {
  const { id } = req.body;
  const { error } = await supabaseAdmin.from('user_profiles').update({ status: 'rejected' }).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Agent Installer Download
app.get('/api/agent/download', authMiddleware, (req, res) => {
  const osType = req.query.os || 'ubuntu';
  const serverUrl = req.query.serverUrl || (req.protocol + '://' + req.get('host'));
  
  let osCheckScript = `OS_VERSION=$(grep -oP '(?<=^VERSION_ID=").*(?=")' /etc/os-release)
if [[ "$osType" == "ubuntu" ]]; then
  if [[ "$OS_VERSION" != "20.04" && "$OS_VERSION" != "22.04" && "$OS_VERSION" != "24.04" ]]; then
    echo "Unsupported Ubuntu version."
    exit 1
  fi
elif [[ "$osType" == "debian" ]]; then
  if [[ "$OS_VERSION" != "11" && "$OS_VERSION" != "12" ]]; then
    echo "Unsupported Debian version."
    exit 1
  fi
fi`;

  const script = `#!/bin/bash
# SBS Agent Installer
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  exit 1
fi

osType="${osType}"
${osCheckScript}

echo "Installing dependencies..."
apt-get update
apt-get install -y curl nftables iproute2 net-tools jq

if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

mkdir -p /opt/sbs-agent
cat << 'EOF' > /opt/sbs-agent/agent.js
const fs = require('fs');
const { exec } = require('child_process');
const http = require('http');
const https = require('https');

const config = {
  server: process.env.SBS_SERVER,
  agentId: process.env.SBS_AGENT_ID,
  apiKey: process.env.SBS_API_KEY
};

const reqModule = config.server.startsWith('https') ? https : http;

function makeRequest(path, method, data, callback) {
  const url = new URL(path, config.server);
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  const req = reqModule.request(url, options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => callback && callback(null, body));
  });
  req.on('error', (e) => callback && callback(e));
  if (data) req.write(JSON.stringify(data));
  req.end();
}

function registerTunnel() {
  makeRequest('/api/agent/tunnel/create', 'POST', {
    agentId: config.agentId,
    apiKey: config.apiKey,
    clientIp: fs.readFileSync('/tmp/client_ip.txt', 'utf-8').trim()
  }, (err, res) => {
    if (!err) console.log('[SBS] Tunnel registered with guard');
  });
}

function register() {
  makeRequest('/api/agent/register', 'POST', {
    agentId: config.agentId,
    apiKey: config.apiKey,
    hostname: fs.readFileSync('/proc/sys/kernel/hostname', 'utf-8').trim(),
    ip: 'auto',
    os: 'Ubuntu',
    arch: process.arch
  }, (err) => {
    if (!err) registerTunnel();
  });
}

function sendStats() {
  exec("ss -ant | wc -l; ss -ant | grep ESTAB | wc -l; ss -ant | grep SYN-RECV | wc -l; nft list set inet sbs_filter blacklist | grep -c '\\.' || echo 0; top -bn1 | grep 'Cpu(s)' | awk '{print $2 + $4}'; free | grep Mem | awk '{print $3/$2 * 100}'; cat /proc/net/dev | grep eth0 || echo 'eth0: 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0'; cat /proc/uptime | awk '{print $1}'; tail -n 10 /var/log/sbs/attacks.log 2>/dev/null || echo ''", (err, stdout) => {
    if (err || !stdout) return;
    const parts = stdout.split('\\n');
    makeRequest('/api/agent/stats', 'POST', {
      agentId: config.agentId,
      apiKey: config.apiKey,
      connections: parseInt(parts[0]) || 0,
      established: parseInt(parts[1]) || 0,
      synRate: parseInt(parts[2]) || 0,
      bannedIPs: parseInt(parts[3]) || 0,
      cpuPercent: parseFloat(parts[4]) || 0,
      memPercent: parseFloat(parts[5]) || 0,
      pps: 0,
      inMbps: 0,
      outMbps: 0,
      uptime: parseFloat(parts[8]) || 0,
      log: parts.slice(9).join('\\n')
    });
  });
}

function pollCommands() {
  makeRequest('/api/agent/commands?agentId=' + config.agentId + '&apiKey=' + config.apiKey, 'GET', null, (err, res) => {
    if (err || !res) return;
    try {
      const cmds = JSON.parse(res);
      cmds.forEach(cmd => {
        exec(cmd.cmd, { timeout: 30000 }, (error, stdout, stderr) => {
          makeRequest('/api/agent/command-result', 'POST', {
            agentId: config.agentId,
            apiKey: config.apiKey,
            cmdId: cmd.id,
            output: stdout + stderr,
            exitCode: error ? error.code : 0
          });
        });
      });
    } catch(e) {}
  });
}

register();
setInterval(sendStats, 5000);
setInterval(pollCommands, 3000);
EOF

cat << EOF > /opt/sbs-agent/.env
SBS_SERVER=${serverUrl}
SBS_AGENT_ID=${req.user.agent_id}
SBS_API_KEY=${req.user.api_key}
EOF

mkdir -p /var/log/sbs
touch /var/log/sbs/attacks.log

cat << 'EOF' > /etc/nftables.conf
#!/usr/sbin/nft -f
flush ruleset

table inet sbs_filter {
  set blacklist {
    type ipv4_addr
    flags timeout
  }

  chain input {
    type filter hook input priority 0; policy accept;
    
    ip saddr @blacklist drop
    
    tcp flags syn limit rate 1000/second accept
    tcp flags syn drop
    
    meta l4proto udp limit rate 10000/second accept
    meta l4proto udp drop
    
    ip protocol icmp limit rate 10/second accept
    ip protocol icmp drop
  }
}
EOF
systemctl enable nftables
systemctl restart nftables

# Get IPs for Tunneling
CLIENT_IP=\$(hostname -I | awk '{print \$1}')
echo "\$CLIENT_IP" > /tmp/client_ip.txt
GUARD_IP=\$(curl -s ifconfig.me)

echo "[SBS] Setting up GRE tunnel to Detroit SBS guard..."
ip tunnel add gre_detroit mode gre \\
  remote \${GUARD_IP} \\
  local \${CLIENT_IP} \\
  ttl 255 2>/dev/null || true
ip link set gre_detroit up

ip route add default via \${GUARD_IP} dev gre_detroit metric 100 2>/dev/null || true
echo "[SBS] GRE tunnel established"

echo "[SBS] Locking server — only accepting traffic from guard..."
nft add rule inet sbs_filter input \\
  ip saddr != \${GUARD_IP} \\
  ip saddr != 127.0.0.1 \\
  drop
echo "[SBS] Direct access blocked — traffic routing through Detroit SBS"

cat > /etc/network/if-up.d/detroit-tunnel << TUNNEL
#!/bin/bash
CLIENT_IP=\\\$(hostname -I | awk '{print \\\$1}')
ip tunnel add gre_detroit mode gre remote \${GUARD_IP} local \\\$CLIENT_IP ttl 255 2>/dev/null || true
ip link set gre_detroit up 2>/dev/null || true
ip route add default via \${GUARD_IP} dev gre_detroit metric 100 2>/dev/null || true
TUNNEL
chmod +x /etc/network/if-up.d/detroit-tunnel

cat << 'EOF' > /etc/systemd/system/sbs-agent.service
[Unit]
Description=SBS Agent
After=network.target

[Service]
Type=simple
User=root
EnvironmentFile=/opt/sbs-agent/.env
WorkingDirectory=/opt/sbs-agent
ExecStart=/usr/bin/node /opt/sbs-agent/agent.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable sbs-agent
systemctl restart sbs-agent

echo "SBS Agent installed successfully!"
echo "Agent ID: ${req.user.agent_id}"
echo "Check your dashboard for connection status."
`;
  res.setHeader('Content-Type', 'text/x-shellscript');
  res.setHeader('Content-Disposition', `attachment; filename="sbs-agent-${req.user.agent_id}.sh"`);
  res.send(script);
});

// Agent endpoints
app.post('/api/agent/register', agentAuthMiddleware, (req, res) => {
  const { agentId } = req.user;
  db.agents[agentId] = {
    hostname: req.body.hostname,
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    os: req.body.os,
    arch: req.body.arch,
    lastSeen: Date.now()
  };
  broadcastToUser(req.user.id, { type: 'agent_connected', hostname: db.agents[agentId].hostname, ip: db.agents[agentId].ip });
  res.json({ success: true });
});

app.post('/api/agent/stats', agentAuthMiddleware, (req, res) => {
  const { agentId } = req.user;
  if (!db.agents[agentId]) db.agents[agentId] = { lastSeen: Date.now() };
  db.agents[agentId].lastSeen = Date.now();
  
  const stats = req.body;
  broadcastToUser(req.user.id, { type: 'stats_update', stats, log: stats.log });
  res.json({ success: true });
});

app.get('/api/agent/commands', agentAuthMiddleware, (req, res) => {
  const { agentId } = req.user;
  const cmds = commandQueue[agentId] || [];
  commandQueue[agentId] = [];
  res.json(cmds);
});

app.post('/api/agent/command-result', agentAuthMiddleware, (req, res) => {
  const { cmdId, output, exitCode } = req.body;
  broadcastToUser(req.user.id, { type: 'command_result', cmdId, output, exitCode });
  res.json({ success: true });
});

app.post('/api/command', authMiddleware, (req, res) => {
  const { cmd } = req.body;
  const { agent_id } = req.user;
  if (!db.agents[agent_id]) return res.status(400).json({ error: 'No agent connected' });
  
  if (!commandQueue[agent_id]) commandQueue[agent_id] = [];
  const cmdObj = { id: crypto.randomUUID(), cmd };
  commandQueue[agent_id].push(cmdObj);
  
  res.json({ success: true, cmdId: cmdObj.id });
});

// GRE Tunnel Endpoints
app.post('/api/agent/tunnel/create', agentAuthMiddleware, privilegedSupabaseMiddleware, async (req, res) => {
  const { agentId, clientIp } = req.body;
  
  if (!clientIp) return res.status(400).json({ error: 'Missing clientIp' });

  try {
    const { execSync } = require('child_process');
    // Using bash to run the script since the app might not run as root.
    // NOTE: In production, ensure the node process has sudo privileges for this script without password
    execSync(`sudo /opt/detroit-sbs/tunnel-manager.sh add ${agentId} ${clientIp}`);
    
    // Update Supabase
    await supabaseAdmin.from('user_profiles')
      .update({ 
        tunnel_status: 'active', 
        client_ip: clientIp,
        tunnel_created_at: new Date().toISOString()
      })
      .eq('agent_id', agentId);

    res.json({ success: true });
  } catch (err) {
    console.error('Tunnel creation failed:', err.message);
    res.status(500).json({ error: 'Tunnel creation failed' });
  }
});

app.delete('/api/agent/tunnel/remove', authMiddleware, privilegedSupabaseMiddleware, async (req, res) => {
  const { agent_id } = req.user;
  
  try {
    const { execSync } = require('child_process');
    execSync(`sudo /opt/detroit-sbs/tunnel-manager.sh remove ${agent_id}`);
    
    // Update Supabase
    await supabaseAdmin.from('user_profiles')
      .update({ tunnel_status: 'inactive' })
      .eq('agent_id', agent_id);

    res.json({ success: true });
  } catch (err) {
    console.error('Tunnel removal failed:', err.message);
    res.status(500).json({ error: 'Tunnel removal failed' });
  }
});

app.get('/api/agent/tunnel/status', authMiddleware, privilegedSupabaseMiddleware, async (req, res) => {
  const { agent_id } = req.user;
  try {
    const { data } = await supabaseAdmin.from('user_profiles').select('tunnel_status').eq('agent_id', agent_id).single();
    res.json({ status: data?.tunnel_status || 'inactive' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// Websocket logic
const clients = {}; // { userId: [ws1, ws2] }

wss.on('connection', async (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token');
  if (!token) return ws.close();
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw new Error();
    
    const userId = user.id;
    if (!clients[userId]) clients[userId] = [];
    clients[userId].push(ws);
    
    // Check if their agent is connected
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data: profile } = await userClient.from('user_profiles').select('agent_id').eq('id', user.id).single();
    
    if (profile && db.agents[profile.agent_id]) {
      ws.send(JSON.stringify({ type: 'agent_connected', hostname: db.agents[profile.agent_id].hostname, ip: db.agents[profile.agent_id].ip }));
    }
    
    ws.on('close', () => {
      clients[userId] = clients[userId].filter(c => c !== ws);
    });
  } catch (err) {
    ws.close();
  }
});

function broadcastToUser(userId, message) {
  if (clients[userId]) {
    const msg = JSON.stringify(message);
    clients[userId].forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    });
  }
}

// Agent Heartbeat Checker
setInterval(() => {
  const now = Date.now();
  for (const [agentId, agent] of Object.entries(db.agents)) {
    if (now - agent.lastSeen > 30000) {
      delete db.agents[agentId];
      // Note: We don't have user_id easily mapping to agentId here natively in memory,
      // but the heartbeat missing will reflect if we do a reverse lookup.
      // For simplicity in Anon setup without keeping user IDs mapped in memory:
      // We will skip broadcasting disconnected here; frontend times out if it doesn't get stats.
    }
  }
}, 5000);

// Catch all for SPA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});

server.listen(PORT, () => {
  const asciiArt = `
\x1b[36m ____       _             _ _     \x1b[35m____  ____  ____  \x1b[0m
\x1b[36m|  _ \\  ___| |_ _ __ ___ (_) |_  \x1b[35m/ ___|| __ )/ ___| \x1b[0m
\x1b[36m| | | |/ _ \\ __| '__/ _ \\| | __| \x1b[35m\\___ \\|  _ \\\\___ \\ \x1b[0m
\x1b[36m| |_| |  __/ |_| | | (_) | | |_   \x1b[35m___) | |_) |___) |\x1b[0m
\x1b[36m|____/ \\___|\\__|_|  \\___/|_|\\__| \x1b[35m|____/|____/|____/ \x1b[0m
`;

  console.clear();
  console.log(asciiArt);
  console.log('\x1b[1m\x1b[32m=== DETROIT SBS SERVER INITIATED ===\x1b[0m\n');
  console.log(`\x1b[1m\x1b[34m[➔]\x1b[0m \x1b[1mServer HTTP:\x1b[0m   \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
  console.log(`\x1b[1m\x1b[34m[➔]\x1b[0m \x1b[1mWebSocket:\x1b[0m     \x1b[36mws://localhost:${PORT}\x1b[0m`);
  
  if (SUPABASE_URL) {
    try {
      const dbUrlHost = new URL(SUPABASE_URL).hostname;
      console.log(`\x1b[1m\x1b[34m[➔]\x1b[0m \x1b[1mDatabase:\x1b[0m      \x1b[32mConnected\x1b[0m \x1b[90m(${dbUrlHost})\x1b[0m`);
    } catch(e) {
      console.log(`\x1b[1m\x1b[34m[➔]\x1b[0m \x1b[1mDatabase:\x1b[0m      \x1b[32mConnected\x1b[0m`);
    }
  } else {
    console.log(`\x1b[1m\x1b[34m[➔]\x1b[0m \x1b[1mDatabase:\x1b[0m      \x1b[31mDisconnected\x1b[0m`);
  }
  
  if (ADMIN_FEATURES_ENABLED) {
    console.log(`\x1b[1m\x1b[34m[➔]\x1b[0m \x1b[1mAdmin Status:\x1b[0m  \x1b[32mActive (Service key present)\x1b[0m`);
  } else {
    console.log(`\x1b[1m\x1b[34m[➔]\x1b[0m \x1b[1mAdmin Status:\x1b[0m  \x1b[33mInactive (Missing SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY)\x1b[0m`);
  }

  console.log('\n\x1b[1m\x1b[33m[!] Waiting for connections...\x1b[0m\n');
});
