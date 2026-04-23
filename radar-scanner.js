const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const BAN_THRESHOLD = 75;
const INTEL_DIR = path.join(__dirname, 'intel');

// Ensure intel directory exists
if (!fs.existsSync(INTEL_DIR)) {
  fs.mkdirSync(INTEL_DIR, { recursive: true });
}
if (!fs.existsSync(path.join(INTEL_DIR, 'logs'))) {
  fs.mkdirSync(path.join(INTEL_DIR, 'logs'), { recursive: true });
}

/**
 * Detroit SBS - Real Time Threat Radar
 * Watches incoming traffic on the guard server, scores IPs, and auto-bans threats.
 */
class RadarScanner {
  constructor(supabaseAdmin, broadcastToUser) {
    this.supabaseAdmin = supabaseAdmin;
    this.broadcastToUser = broadcastToUser;
    this.isScanning = false;
  }

  async start() {
    console.log('[Radar] Scanner started...');
    setInterval(() => this.scan(), 30000); // Every 30 seconds
    this.scan(); 
  }

  async scan() {
    if (this.isScanning) return;
    this.isScanning = true;
    console.log('[Radar] Running scan cycle...');

    try {
      // 1. Get currently connecting IPs and their connection counts
      // ss -ant | awk '{print $5}' | cut -d: -f1 | sort | uniq -c | sort -rn
      const rawConnections = execSync("ss -ant | awk 'NR>1 {print $5}' | cut -d: -f1 | grep -E '^[0-9]' | sort | uniq -c | sort -rn").toString();
      const lines = rawConnections.split('\n').filter(l => l.trim());

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const count = parseInt(parts[0]);
        const ip = parts[1];

        if (!ip || ip === '127.0.0.1' || ip === '0.0.0.0') continue;

        // 2. Score the IP
        const { score, reasons, abuseScore } = await this.scoreIP(ip, count);

        // 3. Take action
        const action = score >= BAN_THRESHOLD ? 'banned' : (score > 40 ? 'watched' : 'clean');
        
        // Log to DB
        await this.logThreat(ip, score, reasons.join(', '), action, abuseScore);

        if (action === 'banned') {
          await this.banIP(ip, `Radar: ${reasons.join(', ')} (Score: ${score})`);
        }
      }
    } catch (err) {
      console.error('[Radar] Scan error:', err.message);
    } finally {
      this.isScanning = false;
    }
  }

  async scoreIP(ip, connCount) {
    let score = 0;
    let reasons = [];

    // A. Connection count scoring
    if (connCount > 100) {
      score += 30;
      reasons.push(`${connCount} connections`);
    }
    if (connCount > 500) {
      score += 50;
      reasons.push('Extreme connection count');
    }

    // B. Check SYN-only (no established)
    try {
      const synCount = parseInt(execSync(`ss -ant | grep SYN-RECV | grep ${ip} | wc -l`).toString());
      if (synCount > 50) {
        score += 40;
        reasons.push('High SYN-RECV rate');
      }
    } catch (e) {}

    // C. Check our own history
    try {
      const { data } = await this.supabaseAdmin
        .from('threat_radar')
        .select('ip')
        .eq('ip', ip)
        .eq('action', 'banned')
        .limit(1);
      
      if (data && data.length > 0) {
        score += 35;
        reasons.push('Repeat offender');
      }
    } catch (e) {}

    return { score, reasons, abuseScore: 0 };
  }

  async logThreat(ip, score, reason, action, abuseScore) {
    try {
      // 1. Save to Supabase
      await this.supabaseAdmin.from('threat_radar').insert({
        ip, score, reason, action, abuseipdb_score: 0
      });

      // 2. Save to Local Intelligence Database (Full behavior history)
      this.saveToLocalIntel(ip, score, reason, action);
    } catch (e) {
      console.error('[Radar] DB Log error:', e.message);
    }
  }

  saveToLocalIntel(ip, score, reason, action) {
    try {
      const date = new Date().toISOString().split('T')[0];
      const time = new Date().toISOString();
      const logFile = path.join(INTEL_DIR, 'logs', `${date}.jsonl`);
      const ipFile = path.join(INTEL_DIR, `${ip}.json`);

      const entry = {
        timestamp: time,
        ip,
        score,
        reason,
        action,
        // Include raw connection data if possible (placeholder for future expansion)
        behavior: reason.split(', ')
      };

      // Append to daily log file
      fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');

      // Update per-IP historical database
      let ipHistory = { ip, first_seen: time, last_seen: time, events: [] };
      if (fs.existsSync(ipFile)) {
        ipHistory = JSON.parse(fs.readFileSync(ipFile, 'utf-8'));
      }
      
      ipHistory.last_seen = time;
      // Keep only last 100 events per IP to save space
      ipHistory.events.unshift(entry);
      ipHistory.events = ipHistory.events.slice(0, 100);
      
      fs.writeFileSync(ipFile, JSON.stringify(ipHistory, null, 2));

    } catch (e) {
      console.error('[Radar] Intel save error:', e.message);
    }
  }

  async banIP(ip, reason) {
    try {
      console.log(`[Radar] BANNING IP: ${ip} | Reason: ${reason}`);
      
      // 1. Ban locally on Guard
      execSync(`sudo nft add element inet sbs_filter blacklist { ${ip} } 2>/dev/null || sudo nft add element inet detroit_guard blacklist { ${ip} }`);

      // 2. Save to global blocklist
      // (This should be picked up by agents or broadcast via WS)
      
      // 3. Broadcast to all users via WS
      // We'll need to pass the broadcast function from server.js
    } catch (e) {
      console.error('[Radar] Ban error:', e.message);
    }
  }
}

module.exports = RadarScanner;
