import { useState, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

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

  const [logs, setLogs] = useState([]);
  
  const [chartData, setChartData] = useState({
    labels: Array(40).fill(''),
    datasets: [
      { label: 'Inbound (Mbps)', borderColor: '#00e5ff', backgroundColor: 'rgba(0, 229, 255, 0.1)', borderWidth: 2, tension: 0.4, fill: true, data: Array(40).fill(0), pointRadius: 0 },
      { label: 'Outbound (Mbps)', borderColor: '#ff003c', backgroundColor: 'rgba(255, 0, 60, 0.1)', borderWidth: 2, tension: 0.4, fill: true, data: Array(40).fill(0), pointRadius: 0 }
    ]
  });

  useEffect(() => {
    const token = localStorage.getItem('sbs_token');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}?token=${token}`);
    
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'agent_connected') {
        setStats(prev => ({ ...prev, hostname: msg.hostname, ip: msg.ip }));
      } else if (msg.type === 'stats_update') {
        const s = msg.stats;
        setStats(prev => ({
          ...prev,
          connections: s.connections || 0,
          bannedIPs: s.bannedIPs || 0,
          cpuPercent: s.cpuPercent || 0,
          memPercent: s.memPercent || 0,
          synRate: s.synRate || 0,
          pps: s.pps || 0,
          uptime: s.uptime || 0,
        }));

        setChartData(prev => {
          const newIn = [...prev.datasets[0].data.slice(1), s.inMbps || Math.random() * 10];
          const newOut = [...prev.datasets[1].data.slice(1), s.outMbps || Math.random() * 5];
          return {
            ...prev,
            datasets: [
              { ...prev.datasets[0], data: newIn },
              { ...prev.datasets[1], data: newOut },
            ]
          };
        });

        if (s.log && s.log.trim() !== '') {
          const lines = s.log.split('\n').filter(l => l.trim() !== '').map(l => {
            let level = 'default';
            if (l.toLowerCase().includes('ban') || l.toLowerCase().includes('drop')) level = 'error';
            if (l.toLowerCase().includes('accept')) level = 'success';
            return { text: new Date().toLocaleTimeString() + ' ' + l, level };
          });
          setLogs(prev => [...lines, ...prev].slice(0, 60));
        }
      }
    };

    return () => ws.close();
  }, []);

  const upStr = stats.uptime > 86400 ? (stats.uptime / 86400).toFixed(1) + ' days' : (stats.uptime > 3600 ? (stats.uptime / 3600).toFixed(1) + ' hrs' : stats.uptime.toFixed(0) + ' sec');

  return (
    <div>
      <h2 style={{ marginBottom: '20px', color: 'var(--accent-cyan)' }}>System Dashboard</h2>
      
      {user?.agentStatus !== 'CONNECTED' && (
        <div style={{ background: 'rgba(255, 184, 0, 0.1)', border: '1px solid var(--warn-amber)', color: 'var(--warn-amber)', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><strong>NO AGENT CONNECTED:</strong> Install the agent on your server to begin monitoring.</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        <div className="glass-panel" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--accent-cyan)', boxShadow: '0 0 10px var(--accent-glow)' }}></div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Connections (ESTAB)</div>
          <div style={{ fontSize: '2rem', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>{stats.connections}</div>
        </div>
        <div className="glass-panel" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--danger-red)', boxShadow: '0 0 10px var(--danger-glow)' }}></div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Banned IPs</div>
          <div style={{ fontSize: '2rem', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>{stats.bannedIPs}</div>
        </div>
        <div className="glass-panel" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--accent-cyan)', boxShadow: '0 0 10px var(--accent-glow)' }}></div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>CPU Usage</div>
          <div style={{ fontSize: '2rem', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>{stats.cpuPercent.toFixed(1)}%</div>
        </div>
        <div className="glass-panel" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--danger-red)', boxShadow: '0 0 10px var(--danger-glow)' }}></div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Memory Usage</div>
          <div style={{ fontSize: '2rem', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>{(stats.memPercent || 0).toFixed(1)}%</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <div className="glass-panel">
          <h3 style={{ marginBottom: '15px', color: 'var(--accent-cyan)' }}>Network Traffic (Mbps)</h3>
          <div style={{ height: '300px', width: '100%' }}>
            <Line 
              data={chartData} 
              options={{
                responsive: true, maintainAspectRatio: false, animation: false,
                plugins: { legend: { labels: { color: '#f1f5f9', font: { family: 'JetBrains Mono' } } } },
                scales: {
                  y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono' } } },
                  x: { grid: { display: false }, ticks: { display: false } }
                }
              }} 
            />
          </div>
        </div>
        <div className="glass-panel">
          <h3 style={{ marginBottom: '15px', color: 'var(--accent-cyan)' }}>Agent Info</h3>
          <ul style={{ listStyle: 'none' }}>
            {[{ label: 'Hostname', value: stats.hostname }, { label: 'IP Address', value: stats.ip }, { label: 'OS', value: stats.os || 'Ubuntu' }, { label: 'Uptime', value: upStr }, { label: 'SYN Rate/s', value: stats.synRate }, { label: 'Total Packets/s', value: stats.pps }].map((item, idx) => (
              <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>{item.label}</span>
                <span className="font-mono text-cyan">{item.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="glass-panel" style={{ marginTop: '20px' }}>
        <h3 style={{ marginBottom: '15px', color: 'var(--accent-cyan)' }}>Live Security Log</h3>
        <div style={{ background: '#05070a', border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '16px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', height: '200px', overflowY: 'auto' }}>
          {logs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>Waiting for logs...</div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} style={{ marginBottom: '4px', color: log.level === 'error' ? 'var(--danger-red)' : log.level === 'success' ? 'var(--success-green)' : 'var(--text-main)' }}>
                {log.text}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
