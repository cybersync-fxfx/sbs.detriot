import { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

export default function Dashboard({ user }) {
  const [stats, setStats] = useState({
    connections: 0,
    bannedIPs: 0,
    cpuPercent: 0,
    memPercent: 0,
    synRate: 0,
    pps: 0,
    uptime: 0,
    hostname: '-',
    ip: '-',
    os: '-',
  });
  const [tunnelStatus, setTunnelStatus] = useState('inactive');
  const [logs, setLogs] = useState([]);
  const [lastUpdateLabel, setLastUpdateLabel] = useState('Waiting for telemetry');

  const [chartData, setChartData] = useState({
    labels: Array(40).fill(''),
    datasets: [
      {
        label: 'Inbound (Mbps)',
        borderColor: '#4b7cff',
        backgroundColor: 'rgba(75, 124, 255, 0.18)',
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        data: Array(40).fill(0),
        pointRadius: 0
      },
      {
        label: 'Outbound (Mbps)',
        borderColor: '#ff6a5b',
        backgroundColor: 'rgba(255, 106, 91, 0.14)',
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        data: Array(40).fill(0),
        pointRadius: 0
      }
    ]
  });

  useEffect(() => {
    const token = localStorage.getItem('sbs_token');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}?token=${token}`);

    fetch('/api/agent/tunnel/status', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setTunnelStatus(data.status))
      .catch(() => {});

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'agent_connected') {
        setStats(prev => ({
          ...prev,
          hostname: msg.hostname || prev.hostname,
          ip: msg.ip || prev.ip,
          os: msg.os || prev.os
        }));
        setLastUpdateLabel(`Agent connected at ${new Date().toLocaleTimeString()}`);
      } else if (msg.type === 'agent_disconnected') {
        setLastUpdateLabel('Agent heartbeat expired');
        setStats(prev => ({
          ...prev,
          hostname: '-',
          ip: '-',
          os: '-'
        }));
      } else if (msg.type === 'stats_update') {
        const s = msg.stats;
        const agent = msg.agent || {};

        setStats(prev => ({
          ...prev,
          connections: s.connections || 0,
          bannedIPs: s.bannedIPs || 0,
          cpuPercent: s.cpuPercent || 0,
          memPercent: s.memPercent || 0,
          synRate: s.synRate || 0,
          pps: s.pps || 0,
          uptime: s.uptime || 0,
          hostname: agent.hostname || prev.hostname,
          ip: agent.ip || prev.ip,
          os: agent.os || prev.os,
        }));

        setChartData(prev => {
          const newIn = [...prev.datasets[0].data.slice(1), s.inMbps || 0];
          const newOut = [...prev.datasets[1].data.slice(1), s.outMbps || 0];
          return {
            ...prev,
            datasets: [
              { ...prev.datasets[0], data: newIn },
              { ...prev.datasets[1], data: newOut },
            ]
          };
        });

        setLastUpdateLabel(`Last telemetry ${new Date().toLocaleTimeString()}`);

        if (s.log && s.log.trim() !== '') {
          const lines = s.log
            .split('\n')
            .filter(l => l.trim() !== '')
            .map(l => {
              let level = 'default';
              if (l.toLowerCase().includes('ban') || l.toLowerCase().includes('drop')) level = 'error';
              if (l.toLowerCase().includes('accept')) level = 'success';
              return { text: `${new Date().toLocaleTimeString()} ${l}`, level };
            });
          setLogs(prev => [...lines, ...prev].slice(0, 60));
        }
      }
    };

    return () => ws.close();
  }, []);

  const isConnected = user?.agentStatus === 'CONNECTED';
  const uptimeLabel = useMemo(() => {
    if (stats.uptime > 86400) return `${(stats.uptime / 86400).toFixed(1)} days`;
    if (stats.uptime > 3600) return `${(stats.uptime / 3600).toFixed(1)} hrs`;
    return `${stats.uptime.toFixed(0)} sec`;
  }, [stats.uptime]);

  const statCards = [
    { label: 'Active Sessions', value: stats.connections, tone: 'blue' },
    { label: 'Blocked IPs', value: stats.bannedIPs, tone: 'red' },
    { label: 'CPU Usage', value: `${stats.cpuPercent.toFixed(1)}%`, tone: 'blue' },
    { label: 'Memory Usage', value: `${(stats.memPercent || 0).toFixed(1)}%`, tone: 'red' },
  ];

  const agentFacts = [
    { label: 'Hostname', value: stats.hostname },
    { label: 'IP Address', value: stats.ip },
    { label: 'OS', value: stats.os || 'Ubuntu' },
    { label: 'Uptime', value: uptimeLabel },
    { label: 'Tunnel', value: tunnelStatus === 'active' ? 'Active' : 'Inactive' },
    { label: 'Guard Host', value: window.location.hostname },
    { label: 'Telemetry', value: lastUpdateLabel },
  ];

  return (
    <div className="page-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 className="page-title">System Dashboard</h1>
          <p className="page-copy">
            Live control surface for telemetry, agent reachability, firewall behavior, and the current protection posture.
          </p>
        </div>
        <div className="hero-status-stack">
          <div className={`status-pill ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? 'Agent Online' : 'Awaiting Agent'}
          </div>
          <div className="meta-chip">{lastUpdateLabel}</div>
        </div>
      </section>

      {!isConnected && (
        <section className="callout-banner warning">
          <strong>No agent is streaming yet.</strong>
          <span>Download a fresh installer from the Install Agent page, run it on the target server, then keep this dashboard open to watch the live connection appear.</span>
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
            <div>
              <p className="eyebrow">Traffic</p>
              <h3>Network Throughput</h3>
            </div>
            <div className="meta-chip">40-sample rolling window</div>
          </div>
          <div className="chart-frame">
            <Line
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                  legend: {
                    labels: {
                      color: '#d7e2ff',
                      font: { family: 'JetBrains Mono' }
                    }
                  }
                },
                scales: {
                  y: {
                    grid: { color: 'rgba(255,255,255,0.06)' },
                    ticks: { color: '#8da5d3', font: { family: 'JetBrains Mono' } }
                  },
                  x: {
                    grid: { display: false },
                    ticks: { display: false }
                  }
                }
              }}
            />
          </div>
        </article>

        <article className="glass-panel elevated-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Identity</p>
              <h3>Agent Facts</h3>
            </div>
            <div className="meta-chip">{isConnected ? 'Live' : 'Idle'}</div>
          </div>
          <div className="fact-list">
            {agentFacts.map(item => (
              <div key={item.label} className="fact-row">
                <span>{item.label}</span>
                <span className={`fact-value ${item.label === 'Tunnel' && tunnelStatus !== 'active' ? 'danger' : ''}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="content-grid two-up">
        <article className="glass-panel elevated-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Signals</p>
              <h3>Threat Markers</h3>
            </div>
          </div>
          <div className="fact-list compact">
            <div className="fact-row">
              <span>SYN Rate</span>
              <span className="fact-value">{stats.synRate}</span>
            </div>
            <div className="fact-row">
              <span>Packets / Sec</span>
              <span className="fact-value">{stats.pps}</span>
            </div>
            <div className="fact-row">
              <span>Blocked IP Count</span>
              <span className="fact-value">{stats.bannedIPs}</span>
            </div>
          </div>
        </article>

        <article className="glass-panel elevated-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Protection</p>
              <h3>Current Posture</h3>
            </div>
          </div>
          <div className="fact-list compact">
            <div className="fact-row">
              <span>Agent Presence</span>
              <span className={`fact-value ${isConnected ? '' : 'danger'}`}>{isConnected ? 'Connected' : 'Not connected'}</span>
            </div>
            <div className="fact-row">
              <span>Tunnel Routing</span>
              <span className={`fact-value ${tunnelStatus === 'active' ? '' : 'danger'}`}>{tunnelStatus === 'active' ? 'Active' : 'Disabled in current build'}</span>
            </div>
            <div className="fact-row">
              <span>Remote Command Channel</span>
              <span className="fact-value">{isConnected ? 'Ready' : 'Waiting for agent'}</span>
            </div>
          </div>
        </article>
      </section>

      <section className="glass-panel elevated-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Events</p>
            <h3>Live Security Log</h3>
          </div>
          <div className="meta-chip">{logs.length} recent lines</div>
        </div>

        <div className="terminal-log">
          {logs.length === 0 ? (
            <div className="empty-state">Waiting for the agent to stream logs and telemetry.</div>
          ) : (
            logs.map((log, idx) => (
              <div key={`${log.text}-${idx}`} className={`log-line ${log.level}`}>
                {log.text}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
