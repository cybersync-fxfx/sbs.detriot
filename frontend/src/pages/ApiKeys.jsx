import { useState } from 'react';

const CopyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

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
            title="Copy Agent ID"
            style={{
              padding: '8px 12px',
              background: copiedId ? 'var(--accent-cyan)' : 'transparent',
              color: copiedId ? '#000' : 'var(--accent-cyan)',
              border: `1px solid var(--accent-cyan)`,
              boxShadow: copiedId ? '0 0 15px var(--accent-cyan)' : '0 0 5px rgba(0, 51, 255, 0.2)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              borderRadius: '4px'
            }}
          >
            {copiedId ? <CheckIcon /> : <CopyIcon />}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', alignItems: 'center' }}>
          <label style={{ flex: 1, color: 'var(--text-muted)' }}>API Key (Secret token)</label>
          <input type="text" value={user?.apiKey || ''} readOnly style={{ flex: 2 }} />
          <button 
            onClick={() => handleCopy(user?.apiKey, 'key')}
            title="Copy API Key"
            style={{
              padding: '8px 12px',
              background: copiedKey ? 'var(--accent-cyan)' : 'transparent',
              color: copiedKey ? '#000' : 'var(--accent-cyan)',
              border: `1px solid var(--accent-cyan)`,
              boxShadow: copiedKey ? '0 0 15px var(--accent-cyan)' : '0 0 5px rgba(0, 51, 255, 0.2)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              borderRadius: '4px'
            }}
          >
            {copiedKey ? <CheckIcon /> : <CopyIcon />}
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
