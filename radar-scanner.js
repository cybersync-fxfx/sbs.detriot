const { execSync } = require('child_process');
const axios = require('axios');
require('dotenv').config();

const ABUSEIPDB_KEY = process.env.ABUSEIPDB_KEY;
const BAN_THRESHOLD = 75;

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
    let abuseScore = 0;

    // A. Connection count scoring
    if (connCount > 100) {
      score += 30;
      reasons.push(`${connCount} connections`);
    }
    if (connCount > 500) {
      score += 40;
      reasons.push('Extreme connection count');
    }

    // B. Check SYN-only (no established)
    try {
      const synCount = parseInt(execSync(`ss -ant | grep SYN-RECV | grep ${ip} | wc -l`).toString());
      if (synCount > 50) {
        score += 35;
        reasons.push('High SYN-RECV rate');
      }
    } catch (e) {}

    // C. AbuseIPDB check (if key available)
    if (ABUSEIPDB_KEY) {
      try {
        const response = await axios.get('https://api.abuseipdb.com/api/v2/check', {
          params: { ipAddress: ip, maxAgeInDays: 90 },
          headers: { Key: ABUSEIPDB_KEY, Accept: 'application/json' }
        });
        abuseScore = response.data.data.abuseConfidenceScore;
        if (abuseScore > 50) {
          score += 20;
          reasons.push(`AbuseIPDB Score: ${abuseScore}`);
        }
        if (abuseScore > 80) {
          score += 30; // Push to auto-ban
          reasons.push('Confirmed high-threat IP');
        }
      } catch (e) {
        // console.error('[Radar] AbuseIPDB error for', ip, e.message);
      }
    }

    // D. Check our own history
    try {
      const { data } = await this.supabaseAdmin
        .from('threat_radar')
        .select('ip')
        .eq('ip', ip)
        .eq('action', 'banned')
        .limit(1);
      
      if (data && data.length > 0) {
        score += 30;
        reasons.push('Repeat offender');
      }
    } catch (e) {}

    return { score, reasons, abuseScore };
  }

  async logThreat(ip, score, reason, action, abuseScore) {
    try {
      await this.supabaseAdmin.from('threat_radar').insert({
        ip, score, reason, action, abuseipdb_score: abuseScore
      });
      
      // Broadcast live to all users
      // Note: We need a way to find all connected users. 
      // For now we'll assume we can broadcast globally or it will be picked up by the next dashboard poll.
    } catch (e) {
      console.error('[Radar] DB Log error:', e.message);
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
