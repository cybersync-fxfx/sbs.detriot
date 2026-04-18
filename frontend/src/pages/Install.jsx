import { useState } from 'react';

export default function Install({ token, user }) {
  const [osType, setOsType] = useState('ubuntu');

  const handleDownload = () => {
    fetch(`/api/agent/download?os=${osType}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.blob()).then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sbs-agent-${user.agentId}.sh`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  };

  return (
    <div>
      <h2 style={{ marginBottom: '20px', color: 'var(--accent-cyan)' }}>Install Agent</h2>
      
      <div className="glass-panel">
        <h3 style={{ marginBottom: '15px' }}>Installation Steps</h3>
        
        <div style={{ background: '#05070a', border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
          <h4 style={{ marginBottom: '15px', color: 'var(--success-green)' }}>System Status</h4>
          <ul style={{ listStyle: 'none', lineHeight: '2' }}>
            <li>✅ Agent Connected</li>
            <li>✅ GRE Tunnel Active</li>
            <li>✅ Traffic Routing Through Guard</li>
            <li>✅ Real IP Hidden</li>
          </ul>
        </div>
        
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Follow these steps to deploy the SBS agent on your target server. You must have root access.</p>
        
        <div style={{ padding: '20px', borderLeft: '2px solid var(--accent-cyan)', background: 'rgba(0, 240, 255, 0.05)', marginBottom: '20px', borderRadius: '4px' }}>
          <strong style={{ display: 'block', marginBottom: '15px' }}>Step 1: Select OS and Download Installer</strong>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <select value={osType} onChange={e => setOsType(e.target.value)} style={{ width: 'auto' }}>
              <option value="ubuntu">Ubuntu (20.04, 22.04, 24.04)</option>
              <option value="debian">Debian (11, 12)</option>
            </select>
            <button onClick={handleDownload}>Download .sh</button>
          </div>
        </div>

        <div style={{ padding: '20px', borderLeft: '2px solid var(--accent-cyan)', background: 'rgba(0, 240, 255, 0.05)', marginBottom: '20px', borderRadius: '4px' }}>
          <strong style={{ display: 'block', marginBottom: '15px' }}>Step 2: Upload to your server</strong>
          <div style={{ background: '#05070a', padding: '15px', borderRadius: '4px', border: '1px solid var(--panel-border)', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
            scp sbs-agent-{user?.agentId}.sh root@YOUR_SERVER_IP:/root/
          </div>
        </div>

        <div style={{ padding: '20px', borderLeft: '2px solid var(--accent-cyan)', background: 'rgba(0, 240, 255, 0.05)', borderRadius: '4px' }}>
          <strong style={{ display: 'block', marginBottom: '15px' }}>Step 3: Run the installer</strong>
          <div style={{ background: '#05070a', padding: '15px', borderRadius: '4px', border: '1px solid var(--panel-border)', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
            sudo bash /root/sbs-agent-{user?.agentId}.sh
          </div>
        </div>
      </div>
    </div>
  );
}
