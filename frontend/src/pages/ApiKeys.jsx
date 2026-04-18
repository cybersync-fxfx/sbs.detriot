export default function ApiKeys({ token, user, setUser }) {
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
      <div className="glass-panel" style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '20px' }}>Your Credentials</h3>
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'center' }}>
          <label style={{ flex: 1, color: 'var(--text-muted)' }}>Agent ID (Public identifier)</label>
          <input type="text" value={user?.agentId || ''} readOnly style={{ flex: 2 }} />
        </div>
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'center' }}>
          <label style={{ flex: 1, color: 'var(--text-muted)' }}>API Key (Secret token)</label>
          <input type="text" value={user?.apiKey || ''} readOnly style={{ flex: 2 }} />
        </div>
        <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button className="danger" onClick={regenerateKey}>Regenerate API Key</button>
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
