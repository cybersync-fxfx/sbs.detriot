import { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement,
  LineElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useTelemetry } from '../context/TelemetryContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const CHART_POINTS = 60;

export default function Dashboard({ token }) {
  const {
    stats, cpuHistory, netHistory, logs,
    isConnected, wsState, lastUpdateMs, agentStatus,
  } = useTelemetry();

  const [tunnelStatus, setTunnelStatus] = useState('loading');
  const [ageSec,       setAgeSec]       = useState(null);

  // ── Live telemetry age ticker ────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setAgeSec(lastUpdateMs ? Math.floor((Date.now() - lastUpdateMs) / 1000) : null);
    }, 1000);
    return () => clearInterval(id);
  }, [lastUpdateMs]);

  // ── Tunnel status ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    fetch('/api/agent/tunnel/status', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setTunnelStatus(d.status || 'inactive'))
      .catch(() => setTunnelStatus('inactive'));
  }, [token]);

  // ── Build chart data objects from context history ─────────────────────────
  const cpuChartData = useMemo(() => ({
    labels: Array(CHART_POINTS).fill(''),
    datasets: [
      {
        label: 'CPU %', borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)',
        borderWidth: 1.5, tension: 0.4, fill: true, data: cpuHistory.cpu, pointRadius: 0,
      },
      {
        label: 'MEM %', borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)',
        borderWidth: 1.5, tension: 0.4, fill: true, data: cpuHistory.mem, pointRadius: 0,
      },
    ],
  }), [cpuHistory]);

  const netChartData = useMemo(() => ({
    labels: Array(CHART_POINTS).fill(''),
    datasets: [
      {
        label: 'In (Mbps)', borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)',
        borderWidth: 1.5, tension: 0.4, fill: true, data: netHistory.inb, pointRadius: 0,
      },
      {
        label: 'Out (Mbps)', borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.08)',
        borderWidth: 1.5, tension: 0.4, fill: true, data: netHistory.out, pointRadius: 0,
      },
    ],
  }), [netHistory]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const uptimeLabel = useMemo(() => {
    if (!stats.uptime) return '—';
    if (stats.uptime > 86400) return `${(stats.uptime / 86400).toFixed(1)}d`;
    if (stats.uptime > 3600)  return `${(stats.uptime / 3600).toFixed(1)}h`;
    return `${stats.uptime.toFixed(0)}s`;
  }, [stats.uptime]);

  const telemetryLabel = useMemo(() => {
    if (!isConnected)    return 'No agent';
    if (ageSec === null) return 'Waiting...';
    if (ageSec < 3)      return 'LIVE';
    return `${ageSec}s ago`;
  }, [isConnected, ageSec]);

  const wsLabel = { open: 'WS OK', connecting: 'WS Connecting', reconnecting: 'WS Reconnecting', error: 'WS Error' }[wsState] || wsState;

  const statCards = [
    { label: 'Active Connections', value: stats.connections,                tone: 'blue' },
    { label: 'Blocked IPs',       value: stats.bannedIPs,                  tone: 'red'  },
    { label: 'CPU Usage',         value: `${stats.cpuPercent.toFixed(1)}%`, tone: 'blue' },
    { label: 'Memory',            value: `${(stats.memPercent || 0).toFixed(1)}%`, tone: 'red' },
  ];

  const agentFacts = [
    { label: 'Hostname',   value: stats.hostname },
    { label: 'IP Address', value: stats.ip },
    { label: 'OS',         value: stats.os || '—' },
    { label: 'Interface',  value: stats.iface },
    { label: 'Uptime',     value: uptimeLabel },
    { label: 'In (Mbps)',  value: stats.inMbps.toFixed(3) },
    { label: 'Out (Mbps)', value: stats.outMbps.toFixed(3) },
    { label: 'SYN Rate',   value: stats.synRate },
    { label: 'Tunnel',     value: tunnelStatus === 'loading' ? '...' : tunnelStatus },
    { label: 'Guard Host', value: window.location.hostname },
    { label: 'Telemetry',  value: telemetryLabel },
    { label: 'WebSocket',  value: wsLabel },
  ];

  const chartOptions = (yLabel, maxY) => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400, easing: 'linear' },
    plugins: {
      legend: { labels: { color: '#64748b', font: { family: 'JetBrains Mono', size: 11 } } }
    },
    scales: {
      y: {
        min: 0, ...(maxY ? { max: maxY } : {}),
        grid: { color: 'rgba(59,130,246,0.08)' },
        ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 }, callback: v => `${v}${yLabel}` }
      },
      x: { grid: { display: false }, ticks: { display: false } }
    }
  });

  return (
    <div className="page-shell">

      <section className="hero-panel">
        <div>
          <p className="eyebrow">Operations Center</p>
          <h1 className="page-title">System Dashboard</h1>
          <p className="page-copy">Live telemetry · network traffic · SSH events · firewall metrics</p>
        </div>
        <div className="hero-status-stack">
          <div className={`status-pill ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '● Agent Online' : '○ No Agent'}
          </div>
          <div className="meta-chip" style={{ color: ageSec !== null && ageSec < 3 ? 'var(--accent-cyan)' : undefined }}>
            {telemetryLabel}
          </div>
          <div className="meta-chip" style={{ color: wsState === 'open' ? 'var(--accent-cyan)' : 'var(--warn-amber)' }}>
            {wsLabel}
          </div>
        </div>
      </section>

      {!isConnected && (
        <section className="callout-banner warning">
          <strong>[!]</strong>
          <span>No agent connected. Go to Install Agent, download a fresh script, and run it as root on your target server.</span>
        </section>
      )}

      <section className="metric-grid">
        {statCards.map(card => (
          <article key={card.label} className={`metric-card tone-${card.tone}`}>
            <div className="metric-label">{card.label}</div>
            <div className="metric-value">{card.value}</div>
          </article>
        ))}
      </section>

      <section className="content-grid two-up">
        <article className="glass-panel elevated-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Telemetry</p><h3>CPU &amp; Memory — Live</h3></div>
            <div className="meta-chip">{CHART_POINTS}s window</div>
          </div>
          <div className="chart-frame">
            <Line data={cpuChartData} options={chartOptions('%', 100)} />
          </div>
        </article>

        <article className="glass-panel elevated-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Agent</p><h3>Live Facts</h3></div>
            <div className="meta-chip">{isConnected ? 'LIVE' : 'idle'}</div>
          </div>
          <div className="fact-list">
            {agentFacts.map(item => (
              <div key={item.label} className="fact-row">
                <span>{item.label}</span>
                <span className={`fact-value ${
                  (item.label === 'Tunnel' && tunnelStatus !== 'active') ? 'danger' :
                  (item.label === 'WebSocket' && wsState !== 'open') ? 'danger' : ''
                }`}>{item.value}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="glass-panel elevated-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Network</p><h3>Live Bandwidth — {stats.iface !== '-' ? stats.iface : 'Primary Interface'}</h3></div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div className="meta-chip" style={{ color: 'var(--accent-cyan)' }}>↓ {stats.inMbps.toFixed(3)} Mbps</div>
            <div className="meta-chip" style={{ color: 'var(--warn-amber)' }}>↑ {stats.outMbps.toFixed(3)} Mbps</div>
          </div>
        </div>
        <div className="chart-frame">
          <Line data={netChartData} options={chartOptions(' Mbps', undefined)} />
        </div>
      </section>

      <section className="content-grid two-up">
        <article className="glass-panel elevated-panel">
          <div className="panel-heading"><div><p className="eyebrow">Signals</p><h3>Threat Markers</h3></div></div>
          <div className="fact-list compact">
            <div className="fact-row"><span>SYN Rate</span><span className={`fact-value ${stats.synRate > 500 ? 'danger' : ''}`}>{stats.synRate}/s</span></div>
            <div className="fact-row"><span>Packets / Sec</span><span className="fact-value">{stats.pps}</span></div>
            <div className="fact-row"><span>Blocked IPs</span><span className={`fact-value ${stats.bannedIPs > 0 ? 'danger' : ''}`}>{stats.bannedIPs}</span></div>
            <div className="fact-row"><span>Established TCP</span><span className="fact-value">{stats.connections}</span></div>
          </div>
        </article>
        <article className="glass-panel elevated-panel">
          <div className="panel-heading"><div><p className="eyebrow">Protection</p><h3>Current Posture</h3></div></div>
          <div className="fact-list compact">
            <div className="fact-row"><span>Agent Presence</span><span className={`fact-value ${isConnected ? '' : 'danger'}`}>{isConnected ? 'Connected' : 'Offline'}</span></div>
            <div className="fact-row"><span>Tunnel Routing</span><span className={`fact-value ${tunnelStatus === 'active' ? '' : 'danger'}`}>{tunnelStatus === 'loading' ? '...' : tunnelStatus === 'active' ? 'Active' : 'Inactive'}</span></div>
            <div className="fact-row"><span>Command Channel</span><span className={`fact-value ${isConnected ? '' : 'danger'}`}>{isConnected ? 'Ready' : 'Waiting for agent'}</span></div>
            <div className="fact-row"><span>Firewall Status</span><span className={`fact-value ${isConnected ? '' : 'danger'}`}>{isConnected ? 'Active' : 'Unknown'}</span></div>
          </div>
        </article>
      </section>

      <section className="glass-panel elevated-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Events</p><h3>Live Security Log — SSH + Firewall</h3></div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <div className="meta-chip" style={{ color: 'var(--success-green)' }}>SSH</div>
            <div className="meta-chip" style={{ color: 'var(--danger-red)' }}>FW</div>
            <div className="meta-chip">{logs.length} lines</div>
          </div>
        </div>
        <div className="terminal-log terminal-large">
          {logs.length === 0
            ? <div className="empty-state">Waiting for agent log stream — SSH &amp; firewall events will appear here…</div>
            : logs.map((log, idx) => (
                <div key={idx} className={`log-line ${log.level}`}>{log.text}</div>
              ))
          }
        </div>
      </section>
    </div>
  );
}
