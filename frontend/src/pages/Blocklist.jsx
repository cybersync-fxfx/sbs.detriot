import { useCallback, useEffect, useRef, useState } from 'react';
import { useTelemetry } from '../context/TelemetryContext';

const ipv4Pattern = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

// Standardized nftables table for Detroit SBS
const NFT_DETECT = `NFT_TABLE='inet detroit_guard'`;

function extractBlockedIps(output) {
  const matches = output.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g);
  return [...new Set(matches || [])];
}

export default function Blocklist() {
  const { sendCommand, isConnected, commandReady } = useTelemetry();

  const [banInput,    setBanInput]    = useState('');
  const [ips,         setIps]         = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [lastSync,    setLastSync]    = useState(null);
  const [feedback,    setFeedback]    = useState({ msg: '', type: '' });
  const [unbanning,   setUnbanning]   = useState(null); // ip currently being unbanned
  const intervalRef = useRef(null);

  // ── core refresh ──────────────────────────────────────────────────────────
  const refresh = useCallback(async (silent = false) => {
    if (!commandReady) return;
    if (!silent) setLoading(true);
    console.log('[Blocklist] Refreshing... silent:', silent);
    try {
      const cmd = `
        NFT_TABLE='inet detroit_guard';
        if ! nft list set $NFT_TABLE blacklist >/dev/null 2>&1; then
          nft add table $NFT_TABLE 2>/dev/null || true;
          nft add set $NFT_TABLE blacklist { type ipv4_addr; flags dynamic,timeout; timeout 24h; } 2>/dev/null || true;
        fi;
        nft list set $NFT_TABLE blacklist
      `.replace(/\n/g, ' ').trim();

      const result = await sendCommand(cmd);
      console.log('[Blocklist] Refresh result:', result);
      const output = result.output || '';
      if (result.exitCode !== 0 && result.exitCode != null) {
        setFeedback({ 
          msg: `nft error (exit ${result.exitCode}): ${output.split('\n')[0] || 'Unknown error'}`, 
          type: 'danger' 
        });
        return;
      }
      setIps(extractBlockedIps(output));
      setLastSync(new Date());
      if (!silent) setFeedback({ msg: '', type: '' });
    } catch (err) {
      console.error('[Blocklist] Refresh error:', err);
      if (!silent) setFeedback({ msg: err.message, type: 'danger' });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [commandReady, sendCommand]);

  // auto-refresh on mount + every 15s
  useEffect(() => {
    if (!commandReady) return;
    refresh();
    intervalRef.current = setInterval(() => refresh(true), 15000);
    return () => clearInterval(intervalRef.current);
  }, [commandReady, refresh]);

  // ── ban ───────────────────────────────────────────────────────────────────
  const banIp = async () => {
    const ip = banInput.trim();
    if (!ipv4Pattern.test(ip)) {
      setFeedback({ msg: 'Enter a valid IPv4 address.', type: 'danger' });
      return;
    }
    setFeedback({ msg: '', type: '' });
    setLoading(true);
    try {
      console.log('[Blocklist] Banning IP:', ip);
      const result = await sendCommand(
        `${NFT_DETECT}; nft add element $NFT_TABLE blacklist { ${ip} } && nft list set $NFT_TABLE blacklist`
      );
      console.log('[Blocklist] Ban result:', result);
      const output = result.output || '';
      if (result.exitCode !== 0 && result.exitCode != null) {
        setFeedback({ msg: `Failed to ban ${ip}. Check if nftables is running.`, type: 'danger' });
        return;
      }
      setIps(extractBlockedIps(output));
      setLastSync(new Date());
      setBanInput('');
      setFeedback({ msg: `✓ ${ip} banned successfully.`, type: 'success' });
    } catch (err) {
      console.error('[Blocklist] Ban error:', err);
      setFeedback({ msg: err.message, type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  // ── unban ─────────────────────────────────────────────────────────────────
  const unbanIp = async (ip) => {
    setUnbanning(ip);
    setFeedback({ msg: '', type: '' });
    try {
      console.log('[Blocklist] Unbanning IP:', ip);
      const result = await sendCommand(
        `${NFT_DETECT}; nft delete element $NFT_TABLE blacklist { ${ip} } && nft list set $NFT_TABLE blacklist`
      );
      console.log('[Blocklist] Unban result:', result);
      const output = result.output || '';
      if (result.exitCode !== 0 && result.exitCode != null) {
        setFeedback({ msg: `Failed to unban ${ip}.`, type: 'danger' });
        return;
      }
      setIps(extractBlockedIps(output));
      setLastSync(new Date());
      setFeedback({ msg: `✓ ${ip} unbanned successfully.`, type: 'success' });
    } catch (err) {
      console.error('[Blocklist] Unban error:', err);
      setFeedback({ msg: err.message, type: 'danger' });
    } finally {
      setUnbanning(null);
    }
  };

  const onKeyDown = (e) => e.key === 'Enter' && !loading && commandReady && banIp();

  const syncLabel = lastSync
    ? `Last synced ${lastSync.toLocaleTimeString()} · auto-refreshes every 15s`
    : 'Fetching from firewall…';

  return (
    <div className="page-shell">

      {/* ── Header ── */}
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">Security</p>
          <h1 className="page-title">Block List</h1>
          <p className="page-copy">
            Live view of the firewall blacklist. Ban or unban IPs instantly — changes apply to the guard server in real time.
          </p>
        </div>
        <div className="hero-status-stack">
          <div className={`status-pill ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '● Agent Reachable' : '○ Agent Not Reachable'}
          </div>
          <div className="meta-chip">
            {ips.length > 0 ? `${ips.length} IP${ips.length > 1 ? 's' : ''} blocked` : 'No IPs blocked'}
          </div>
        </div>
      </section>

      {/* ── Ban input bar ── */}
      <section className="glass-panel elevated-panel" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <input
              id="ban-ip-input"
              type="text"
              placeholder="Enter IP to ban  e.g. 203.0.113.24"
              value={banInput}
              onChange={e => setBanInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={loading || !commandReady}
              style={{ width: '100%', margin: 0 }}
            />
          </div>
          <button
            id="ban-ip-btn"
            className="danger"
            type="button"
            onClick={banIp}
            disabled={loading || !commandReady}
            style={{ whiteSpace: 'nowrap' }}
          >
            🚫 Ban IP
          </button>
          <button
            id="refresh-blocklist-btn"
            type="button"
            onClick={() => refresh(false)}
            disabled={loading || !commandReady}
            style={{ whiteSpace: 'nowrap' }}
          >
            {loading ? '⟳ Loading…' : '↻ Refresh'}
          </button>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
            {syncLabel}
          </span>
        </div>

        {feedback.msg && (
          <div className={`callout-inline ${feedback.type}`} style={{ marginTop: '0.75rem' }}>
            {feedback.msg}
          </div>
        )}
      </section>

      {/* ── Blocked IP table (main focus) ── */}
      <section className="glass-panel elevated-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Live Firewall Set</p>
            <h3>Blocked IP Addresses</h3>
          </div>
          {ips.length > 0 && (
            <div className="meta-chip" style={{ color: 'var(--danger)' }}>
              {ips.length} active block{ips.length > 1 ? 's' : ''}
            </div>
          )}
        </div>

        {!commandReady ? (
          <div className="empty-state">Waiting for agent connection…</div>
        ) : loading && ips.length === 0 ? (
          <div className="empty-state">Fetching blocked IPs from firewall…</div>
        ) : ips.length === 0 ? (
          <div className="empty-state" style={{ padding: '2.5rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✓</div>
            <div>No IPs are currently blocked on the firewall.</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.4rem' }}>
              Auto-ban activates when a DDoS attack is detected.
            </div>
          </div>
        ) : (
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '2rem' }}>#</th>
                  <th>IP Address</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {ips.map((ip, i) => (
                  <tr key={ip}>
                    <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{i + 1}</td>
                    <td className="font-mono" style={{ fontSize: '1rem', letterSpacing: '0.04em' }}>
                      {ip}
                    </td>
                    <td>
                      <span style={{
                        background: 'rgba(239,68,68,0.15)',
                        color: '#f87171',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}>
                        BLOCKED
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="secondary-button small"
                        onClick={() => unbanIp(ip)}
                        disabled={!!unbanning || loading || !commandReady}
                      >
                        {unbanning === ip ? 'Removing…' : 'Unban'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  );
}
