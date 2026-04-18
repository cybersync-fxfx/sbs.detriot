import { useState } from 'react';

export default function ApiKeys({ token, user, setUser }) {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };
  const regenerateKey = async () => {
    if (!confirm('Regenerating API Key will disconnect your current agent. Proceed?')) return;
    try {
      const res = await fetch('/api/me/regenerate-key', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.apiKey) {
        setUser(prev => ({ ...prev, apiKey: data.apiKey }));
        alert('Key regenerated successfully.');
      }
    } catch (e) {
      alert('Error regenerating key');
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: '20px', color: 'var(--accent-cyan)' }}>API & Credentials</h2>
      <div className="glass-panel" style={{ marginBottom: '20px', borderTop: '2px solid var(--danger-red)' }}>
        <h3 style={{ marginBottom: '20px' }}>Your Credentials</h3>
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', alignItems: 'center' }}>
          <label style={{ flex: 1, color: 'var(--text-muted)' }}>Agent ID (Public identifier)</label>
          <input type="text" value={user?.agentId || ''} readOnly style={{ flex: 2 }} />
          <button 
            onClick={() => handleCopy(user?.agentId, 'id')}
            style={{
              padding: '8px 15px',
              background: copiedId ? 'var(--accent-cyan)' : 'transparent',
              color: copiedId ? '#000' : 'var(--accent-cyan)',
              border: `1px solid var(--accent-cyan)`,
              boxShadow: copiedId ? '0 0 15px var(--accent-cyan)' : '0 0 5px rgba(0, 229, 255, 0.2)',
              cursor: 'pointer',
              minWidth: '90px',
              transition: 'all 0.2s'
            }}
          >
            {copiedId ? 'Copied!' : 'Copy ID'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', alignItems: 'center' }}>
          <label style={{ flex: 1, color: 'var(--text-muted)' }}>API Key (Secret token)</label>
          <input type="text" value={user?.apiKey || ''} readOnly style={{ flex: 2 }} />
          <button 
            onClick={() => handleCopy(user?.apiKey, 'key')}
            style={{
              padding: '8px 15px',
              background: copiedKey ? 'var(--accent-cyan)' : 'transparent',
              color: copiedKey ? '#000' : 'var(--accent-cyan)',
              border: `1px solid var(--accent-cyan)`,
              boxShadow: copiedKey ? '0 0 15px var(--accent-cyan)' : '0 0 5px rgba(0, 229, 255, 0.2)',
              cursor: 'pointer',
              minWidth: '90px',
              transition: 'all 0.2s'
            }}
          >
            {copiedKey ? 'Copied!' : 'Copy Key'}
          </button>
        </div>
        <div style={{ marginTop: '30px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button className="danger" onClick={regenerateKey} style={{ background: 'transparent', color: 'var(--danger-red)', border: '1px solid var(--danger-red)', boxShadow: '0 0 8px rgba(255, 0, 60, 0.3)' }}>Regenerate API Key</button>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Warning: This will disconnect existing agents.</span>
        </div>
      </div>

      <div className="glass-panel">
        <h3 style={{ marginBottom: '15px' }}>REST API Access</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>You can trigger commands programmatically.</p>
        <div style={{ background: '#05070a', padding: '15px', borderRadius: '4px', border: '1px solid var(--panel-border)', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', wordBreak: 'break-all' }}>
          curl -X POST http://YOUR_PANEL/api/command \<br/>
          -H "Authorization: Bearer YOUR_JWT_TOKEN" \<br/>
          -H "Content-Type: application/json" \<br/>
          -d '{`"cmd": "iptables -L"`}'
        </div>
      </div>
    </div>
  );
}
