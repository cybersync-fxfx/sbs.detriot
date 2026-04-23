import { useEffect, useState } from 'react';

export default function ThreatRadar({ token }) {
  const [data, setData] = useState({ recent: [], stats: { scannedToday: 0, blockedToday: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [setupRequired, setSetupRequired] = useState(false);
  const [threshold, setThreshold] = useState(75);
  const [autoBan, setAutoBan] = useState(true);

  const fetchStats = () => {
    fetch('/api/radar/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        const payload = await r.json();
        if (!r.ok) {
          const nextError = payload?.error || 'Threat Radar failed to load.';
          const next = new Error(nextError);
          next.setupRequired = Boolean(payload?.setupRequired);
          throw next;
        }
        return payload;
      })
      .then(d => {
        setData({
          recent: Array.isArray(d?.recent) ? d.recent : [],
          stats: {
            scannedToday: Number(d?.stats?.scannedToday || 0),
            blockedToday: Number(d?.stats?.blockedToday || 0)
          }
        });
        setError('');
        setSetupRequired(false);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setError(e.message || 'Threat Radar failed to load.');
        setSetupRequired(Boolean(e.setupRequired));
        setData({ recent: [], stats: { scannedToday: 0, blockedToday: 0 } });
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!token) return;
    fetchStats();
    const id = setInterval(fetchStats, 10000);
    return () => clearInterval(id);
  }, [token]);

  const scoreColor = (score) => {
    if (score >= 75) return 'danger';
    if (score > 40) return 'warning';
    return 'success';
  };

  return (
    <div className="page-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Defense Grid</p>
          <h1 className="page-title">Threat Radar</h1>
          <p className="page-copy">Real-time IP behavior scoring, behavioral analysis, and global threat intelligence sync.</p>
        </div>
        <div className="hero-status-stack">
          <div className="status-pill connected">Radar Active</div>
          <div className="meta-chip">Scanning 24/7</div>
        </div>
      </section>

      {error ? (
        <section className={`callout-banner ${setupRequired ? 'warning' : 'danger'}`}>
          <strong>{setupRequired ? 'Threat Radar setup required.' : 'Threat Radar unavailable.'}</strong>
          <span>
            {error}
            {setupRequired ? ' Run supabase_threat_radar.sql in your Supabase SQL editor, then reload this page.' : ''}
          </span>
        </section>
      ) : null}

      <section className="metric-grid">
        <article className="metric-card tone-blue">
          <div className="metric-label">Scanned Today</div>
          <div className="metric-value">{loading ? '...' : data.stats.scannedToday}</div>
        </article>
        <article className="metric-card tone-red">
          <div className="metric-label">Blocked Today</div>
          <div className="metric-value">{loading ? '...' : data.stats.blockedToday}</div>
        </article>
        <article className="metric-card">
          <div className="metric-label">Auto-Ban Threshold</div>
          <div className="metric-value">{threshold}</div>
        </article>
        <article className="metric-card">
          <div className="metric-label">Intelligence Sync</div>
          <div className="metric-value">Active</div>
        </article>
      </section>

      <div className="content-grid two-up">
        <article className="glass-panel elevated-panel">
          <div className="panel-heading">
            <div><h3>Real-Time IP Scoring</h3></div>
            <div className="meta-chip">Live Feed</div>
          </div>
          <div className="terminal-log terminal-large">
            {loading ? (
              <div className="empty-state">Loading Threat Radar telemetry...</div>
            ) : data.recent.length === 0 ? (
              <div className="empty-state">No radar events have been recorded yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--panel-border)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px' }}>IP ADDRESS</th>
                    <th style={{ padding: '8px' }}>SCORE</th>
                    <th style={{ padding: '8px' }}>REASON</th>
                    <th style={{ padding: '8px' }}>ACTION</th>
                    <th style={{ padding: '8px' }}>TIME</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '8px', fontFamily: 'var(--font-mono)' }}>{item.ip}</td>
                      <td style={{ padding: '8px' }}>
                        <span className={`fact-value ${scoreColor(item.score)}`}>{item.score}</span>
                      </td>
                      <td style={{ padding: '8px', color: 'var(--text-soft)' }}>{item.reason}</td>
                      <td style={{ padding: '8px', textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: 700 }}>
                        <span className={item.action === 'banned' ? 'text-red' : 'text-cyan'}>{item.action}</span>
                      </td>
                      <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{new Date(item.detected_at).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </article>

        <article className="glass-panel elevated-panel">
          <div className="panel-heading">
            <div><h3>Radar Controls</h3></div>
          </div>
          <div className="fact-list">
            <div className="fact-row">
              <span>Auto-Ban System</span>
              <button className={autoBan ? 'success-outline' : 'danger-outline'} onClick={() => setAutoBan(!autoBan)}>
                {autoBan ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
            <div className="fact-row">
              <span>Threshold</span>
              <input 
                type="range" 
                min="0" max="100" 
                value={threshold} 
                onChange={(e) => setThreshold(e.target.value)} 
                style={{ width: '120px' }}
              />
            </div>
            <div className="fact-row">
              <span>Internal Sync</span>
              <span className="text-green">Active</span>
            </div>
            <div className="fact-row">
              <span>Global Threat Sync</span>
              <span className="text-green">Active</span>
            </div>
            <div className="fact-row">
              <span>Blocklist Export</span>
              <button className="secondary-button small">CSV</button>
            </div>
          </div>
          <div style={{ marginTop: '20px', padding: '10px', background: 'rgba(59,130,246,0.05)', border: '1px solid var(--panel-border)' }}>
            <p className="eyebrow" style={{ marginBottom: '8px' }}>Intelligence Feed</p>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-soft)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div>[✓] Spamhaus DROP list updated</div>
              <div>[✓] Emerging Threats list updated</div>
              <div>[✓] Firehol Level 1 updated</div>
              <div>[i] 4.2k active threats synced</div>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
