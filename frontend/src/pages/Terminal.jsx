import { useState, useRef, useEffect } from 'react';

export default function Terminal({ token }) {
  const [logs, setLogs] = useState([
    { text: 'SBS Secure Terminal Interface v1.0', level: 'info' },
    { text: 'Connection established. Type a command or use quick actions below.', level: 'default' }
  ]);
  const [input, setInput] = useState('');
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const sendCmd = async (cmd) => {
    try {
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd })
      });
      const data = await res.json();
      if (!res.ok) {
        setLogs(prev => [...prev, { text: data.error, level: 'error' }]);
        return;
      }
      setLogs(prev => [...prev, { text: `> ${cmd}`, level: 'info' }]);
      // The WebSocket in App could handle the response, but for simplicity we will just assume
      // the websocket pushes command_result. But since Dashboard handles WS, we should pull WS handling to a shared context if needed.
      // Wait, let's just make Terminal connect to WS just for commands.
    } catch (e) {
      setLogs(prev => [...prev, { text: 'Network Error', level: 'error' }]);
    }
  };

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}?token=${token}`);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'command_result') {
        setLogs(prev => [...prev, { text: msg.output, level: msg.exitCode === 0 ? 'default' : 'error' }]);
      }
    };
    return () => ws.close();
  }, [token]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) {
      sendCmd(input.trim());
      setInput('');
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: '20px', color: 'var(--accent-cyan)' }}>Remote Terminal</h2>
      <div className="glass-panel">
        <div style={{ background: '#05070a', border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '16px', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', height: '400px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {logs.map((log, idx) => (
            <div key={idx} style={{ marginBottom: '4px', lineHeight: '1.4', color: log.level === 'info' ? 'var(--accent-cyan)' : log.level === 'error' ? 'var(--danger-red)' : 'var(--text-main)', whiteSpace: 'pre-wrap' }}>
              {log.text}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', marginTop: '16px', borderTop: '1px solid var(--panel-border)', paddingTop: '16px', alignItems: 'center' }}>
          <span style={{ color: 'var(--success-green)', marginRight: '10px', fontFamily: 'var(--font-mono)' }}>root@server:~$</span>
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', boxShadow: 'none', padding: 0 }} 
            autoFocus 
            autoComplete="off" 
          />
          <button type="submit" style={{ padding: '6px 16px', marginLeft: '10px' }}>EXEC</button>
        </form>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '20px' }}>
          {['uptime', 'free -h', 'df -h', 'ss -ant | wc -l', 'nft list ruleset', 'tail -n 20 /var/log/syslog'].map(cmd => (
            <button key={cmd} onClick={() => sendCmd(cmd)} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>{cmd}</button>
          ))}
          <button onClick={() => setLogs([])} style={{ fontSize: '0.75rem', padding: '6px 12px', background: 'transparent', borderColor: 'var(--text-muted)', color: 'var(--text-muted)' }}>Clear</button>
        </div>
      </div>
    </div>
  );
}
