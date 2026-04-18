import { useState } from 'react';

export default function Firewall({ token }) {
  const [rulesOutput, setRulesOutput] = useState('');

  const sendCmd = async (cmd) => {
    try {
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd })
      });
      if (res.ok) {
        alert('Command sent. Check Terminal or Dashboard for output.');
      } else {
        alert('Failed to send command');
      }
    } catch (e) {
      alert('Network error');
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: '20px', color: 'var(--accent-cyan)' }}>Firewall Configuration</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        <div className="glass-panel">
          <h3 style={{ marginBottom: '20px', color: 'var(--accent-cyan)' }}>Rate Limits (nftables)</h3>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>SYN Limit (packets/sec)</label>
            <input type="number" defaultValue={1000} />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>UDP Limit (packets/sec)</label>
            <input type="number" defaultValue={10000} />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>ICMP Limit (packets/sec)</label>
            <input type="number" defaultValue={10} />
          </div>
          <button onClick={() => alert('Applying rules via agent...')} style={{ marginTop: '10px' }}>Apply to Server</button>
        </div>
        
        <div className="glass-panel">
          <h3 style={{ marginBottom: '20px', color: 'var(--accent-cyan)' }}>Auto-Ban Triggers</h3>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Trigger Mbps</label>
            <input type="number" defaultValue={500} />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Trigger PPS</label>
            <input type="number" defaultValue={50000} />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Ban Duration (seconds)</label>
            <input type="number" defaultValue={3600} />
          </div>
          <button style={{ marginTop: '10px' }}>Save Config</button>
        </div>
      </div>
      
      <div className="glass-panel">
        <h3 style={{ marginBottom: '15px', color: 'var(--accent-cyan)' }}>Active Ruleset</h3>
        <button onClick={() => sendCmd('nft list ruleset')}>Fetch from server</button>
        <div style={{ background: '#05070a', padding: '15px', borderRadius: '4px', border: '1px solid var(--panel-border)', fontFamily: 'var(--font-mono)', color: 'var(--text-main)', marginTop: '15px', minHeight: '100px', whiteSpace: 'pre-wrap' }}>
          {rulesOutput || 'Click fetch to run command...'}
        </div>
      </div>
    </div>
  );
}
