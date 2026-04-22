import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement,
  LineElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const CHART_POINTS = 60;

export default function Dashboard({ user, token }) {
  const [stats, setStats] = useState({
    connections: 0, bannedIPs: 0, cpuPercent: 0,
    memPercent: 0, synRate: 0, pps: 0, uptime: 0,
    hostname: '-', ip: '-', os: '-',
  });
  const [tunnelStatus,    setTunnelStatus]    = useState('loading');
  const [logs,            setLogs]            = useState([]);
  const [lastUpdateMs,    setLastUpdateMs]    = useState(null);
  const [ageSec,          setAgeSec]          = useState(null);
  const [wsState,         setWsState]         = useState('connecting');

  const wsRef       = useRef(null);
  const retryTimer  = useRef(null);
  const retryCount  = useRef(0);
  const unmounted   = useRef(false);

  const [chartData, setChartData] = useState({
    labels: Array(CHART_POINTS).fill(''),
    datasets: [
      {
        label: 'CPU %',
        borderColor: '#00ff41',
        backgroundColor: 'rgba(0,255,65,0.08)',
        borderWidth: 1.5, tension: 0.4, fill: true,
        data: Array(CHART_POINTS).fill(0), pointRadius: 0,
      },
      {
        label: 'MEM %',
        borderColor: '#ff003c',
        backgroundColor: 'rgba(255,0,60,0.08)',
        borderWidth: 1.5, tension: 0.4, fill: true,
        data: Array(CHART_POINTS).fill(0), pointRadius: 0,
      },
    ],
  });

  // ── Live "age of telemetry" ticker ───────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setAgeSec(lastUpdateMs ? Math.floor((Date.now() - lastUpdateMs) / 1000) : null);
    }, 1000);
    return () => clearInterval(id);
  }, [lastUpdateMs]);

  // ── Fetch tunnel status once ──────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    fetch('/api/agent/tunnel/status', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setTunnelStatus(d.status || 'inactive'))
      .catch(() => setTunnelStatus('inactive'));
  }, [token]);

  // ── Dedicated WebSocket for the dashboard (auto-reconnects) ───────────────
  const connectWs = () => {
    if (!token || unmounted.current) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}?token=${token}`);
    wsRef.current = ws;
    setWsState('connecting');

    ws.onopen = () => {
      retryCount.current = 0;
      setWsState('connected');
    };

    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }

      if (msg.type === 'agent_connected') {
        setStats(prev => ({
          ...prev,
          hostname: msg.hostname || prev.hostname,
          ip:       msg.ip       || prev.ip,
          os:       msg.os       || prev.os,
        }));
        setLastUpdateMs(Date.now());
      }

      if (msg.type === 'agent_disconnected') {
        setStats(prev => ({ ...prev, hostname: '-', ip: '-', os: '-' }));
        setLastUpdateMs(null);
      }

      if (msg.type === 'stats_update') {
        const s     = msg.stats  || {};
        const agent = msg.agent  || {};
        setLastUpdateMs(Date.now());

        setStats(prev => ({
          ...prev,
          connections: s.connections  ?? prev.connections,
          bannedIPs:   s.bannedIPs    ?? prev.bannedIPs,
          cpuPercent:  s.cpuPercent   ?? prev.cpuPercent,
          memPercent:  s.memPercent   ?? prev.memPercent,
          synRate:     s.synRate      ?? prev.synRate,
          pps:         s.pps          ?? prev.pps,
          uptime:      s.uptime       ?? prev.uptime,
          hostname:    agent.hostname || prev.hostname,
          ip:          agent.ip       || prev.ip,
          os:          agent.os       || prev.os,
        }));

        setChartData(prev => {
          const cpu = [...prev.datasets[0].data.slice(1), Number((s.cpuPercent || 0).toFixed(1))];
          const mem = [...prev.datasets[1].data.slice(1), Number((s.memPercent || 0).toFixed(1))];
          return {
            ...prev,
            datasets: [
              { ...prev.datasets[0], data: cpu },
              { ...prev.datasets[1], data: mem },
            ],
          };
        });

        if (s.log && s.log.trim()) {
          const lines = s.log
            .split('\n')
            .filter(l => l.trim())
            .map(l => {
              let level = 'default';
              if (/ban|drop|block/i.test(l)) level = 'error';
              if (/accept|allow/i.test(l))   level = 'success';
              return { text: `[${new Date().toLocaleTimeString()}] ${l}`, level };
            });
          setLogs(prev => [...lines, ...prev].slice(0, 100));
        }
      }
    };

    ws.onerror = () => {
      if (!unmounted.current) setWsState('error');
    };

    ws.onclose = () => {
      if (unmounted.current) return;
      setWsState('reconnecting');
      const delay = Math.min(1000 * Math.pow(2, retryCount.current), 8000);
      retryCount.current += 1;
      retryTimer.current = setTimeout(connectWs, delay);
    };
  };

  useEffect(() => {
    unmounted.current = false;
    connectWs();
    return () => {
      unmounted.current = true;
      clearTimeout(retryTimer.current);
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Derived values ────────────────────────────────────────────────────────
  const isConnected = user?.agentStatus === 'CONNECTED';

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

  const wsLabel = {
    connected:    'WS OK',
    connecting:   'WS Connecting',
    reconnecting: 'WS Reconnecting',
    error:        'WS Error',
  }[wsState] || wsState;

  const statCards = [
    { label: 'Active Connections', value: stats.connections,             tone: 'blue' },
    { label: 'Blocked IPs',        value: stats.bannedIPs,               tone: 'red'  },
    { label: 'CPU Usage',          value: `${stats.cpuPercent.toFixed(1)}%`, tone: 'blue' },
    { label: 'Memory',             value: `${(stats.memPercent || 0).toFixed(1)}%`, tone: 'red' },
  ];

  const agentFacts = [
    { label: 'Hostname',    value: stats.hostname },
    { label: 'IP Address',  value: stats.ip },
    { label: 'OS',          value: stats.os || '—' },
    { label: 'Uptime',      value: uptimeLabel },
    { label: 'SYN Rate',    value: stats.synRate },
    { label: 'Tunnel',      value: tunnelStatus === 'loading' ? '...' : tunnelStatus },
    { label: 'Guard Host',  value: window.location.hostname },
    { label: 'Telemetry',   value: telemetryLabel },
    { label: 'WebSocket',   value: wsLabel },
  ];

  return (
    <div className="page-shell">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Operations Center</p>
          <h1 className="page-title">System Dashboard</h1>
          <p className="page-copy">
            Live telemetry · firewall metrics · agent reachability
          </p>
        </div>
        <div className="hero-status-stack">
          <div className={`status-pill ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '● Agent Online' : '○ No Agent'}
          </div>
          <div className="meta-chip" style={{
            color: ageSec !== null && ageSec < 3 ? 'var(--accent-cyan)' : undefined,
          }}>
            {telemetryLabel}
          </div>
          <div className="meta-chip" style={{
            color: wsState === 'connected' ? 'var(--accent-cyan)' : 'var(--warn-amber)'
          }}>
            {wsLabel}
          </div>
        </div>
      </section>

      {/* ── Warning banner ───────────────────────────────────────────── */}
      {!isConnected && (
        <section className="callout-banner warning">
          <strong>[!]</strong>
          <span>No agent connected. Go to Install Agent, download a fresh script, and run it as root on your target server.</span>
        </section>
      )}

      {/* ── Metric cards ─────────────────────────────────────────────── */}
      <section className="metric-grid">
        {statCards.map(card => (
          <article key={card.label} className={`metric-card tone-${card.tone}`}>
            <div className="metric-label">{card.label}</div>
            <div className="metric-value">{card.value}</div>
          </article>
        ))}
      </section>

      {/* ── Chart + Facts ────────────────────────────────────────────── */}
      <section className="content-grid two-up">
        <article className="glass-panel elevated-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Telemetry</p>
              <h3>CPU &amp; Memory — Live</h3>
            </div>
            <div className="meta-chip">{CHART_POINTS}s window</div>
          </div>
          <div className="chart-frame">
            <Line
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 400, easing: 'linear' },
                plugins: {
                  legend: {
                    labels: { color: '#00aa2b', font: { family: 'JetBrains Mono', size: 11 } }
                  }
                },
                scales: {
                  y: {
                    min: 0, max: 100,
                    grid: { color: 'rgba(0,255,65,0.08)' },
                    ticks: { color: '#00aa2b', font: { family: 'JetBrains Mono', size: 10 }, callback: v => `${v}%` }
                  },
                  x: { grid: { display: false }, ticks: { display: false } }
                }
              }}
            />
          </div>
        </article>

        <article className="glass-panel elevated-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Agent</p>
              <h3>Live Facts</h3>
            </div>
            <div className="meta-chip">{isConnected ? 'LIVE' : 'idle'}</div>
          </div>
          <div className="fact-list">
            {agentFacts.map(item => (
              <div key={item.label} className="fact-row">
                <span>{item.label}</span>
                <span className={`fact-value ${
                  (item.label === 'Tunnel'    && tunnelStatus !== 'active')  ? 'danger' :
                  (item.label === 'WebSocket' && wsState !== 'connected')   ? 'danger' : ''
                }`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      {/* ── Threat signals ───────────────────────────────────────────── */}
      <section className="content-grid two-up">
        <article className="glass-panel elevated-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Signals</p><h3>Threat Markers</h3></div>
          </div>
          <div className="fact-list compact">
            <div className="fact-row"><span>SYN Rate</span>
              <span className={`fact-value ${stats.synRate > 500 ? 'danger' : ''}`}>{stats.synRate}/s</span>
            </div>
            <div className="fact-row"><span>Packets / Sec</span>
              <span className="fact-value">{stats.pps}</span>
            </div>
            <div className="fact-row"><span>Blocked IPs</span>
              <span className={`fact-value ${stats.bannedIPs > 0 ? 'danger' : ''}`}>{stats.bannedIPs}</span>
            </div>
            <div className="fact-row"><span>Established TCP</span>
              <span className="fact-value">{stats.connections}</span>
            </div>
          </div>
        </article>

        <article className="glass-panel elevated-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Protection</p><h3>Current Posture</h3></div>
          </div>
          <div className="fact-list compact">
            <div className="fact-row"><span>Agent Presence</span>
              <span className={`fact-value ${isConnected ? '' : 'danger'}`}>
                {isConnected ? 'Connected' : 'Offline'}
              </span>
            </div>
            <div className="fact-row"><span>Tunnel Routing</span>
              <span className={`fact-value ${tunnelStatus === 'active' ? '' : 'danger'}`}>
                {tunnelStatus === 'loading' ? '...' : tunnelStatus === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="fact-row"><span>Command Channel</span>
              <span className={`fact-value ${isConnected ? '' : 'danger'}`}>
                {isConnected ? 'Ready' : 'Waiting for agent'}
              </span>
            </div>
            <div className="fact-row"><span>Firewall (nftables)</span>
              <span className={`fact-value ${isConnected ? '' : 'danger'}`}>
                {isConnected ? 'Active' : 'Unknown'}
              </span>
            </div>
          </div>
        </article>
      </section>

      {/* ── Live Security Log ────────────────────────────────────────── */}
      <section className="glass-panel elevated-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Events</p><h3>Live Security Log</h3></div>
          <div className="meta-chip">{logs.length} lines</div>
        </div>
        <div className="terminal-log terminal-large">
          {logs.length === 0
            ? <div className="empty-state">Waiting for agent log stream…</div>
            : logs.map((log, idx) => (
                <div key={idx} className={`log-line ${log.level}`}>{log.text}</div>
              ))
          }
        </div>
      </section>

    </div>
  );
}
