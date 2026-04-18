import { useState } from 'react';

export default function Blocklist({ token }) {
  const [ipInput, setIpInput] = useState('');

  const sendCmd = async (cmd) => {
    try {
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd })
      });
      if (res.ok) {
        alert('Command sent. Check Terminal or Dashboard for output.');
      }
    } catch (e) {
      alert('Network error');
    }
  };

  const banIp = () => {
    if (ipInput.trim()) {
      sendCmd(`nft add element inet sbs_filter blacklist { ${ipInput} }`);
      setIpInput('');
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: '20px', color: 'var(--accent-cyan)' }}>IP Block List</h2>
      <div className="glass-panel">
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
          <input 
            type="text" 
            placeholder="Enter IP address to ban..." 
            value={ipInput} 
            onChange={e => setIpInput(e.target.value)} 
            style={{ flex: 1 }} 
          />
          <button className="danger" onClick={banIp}>BAN IP</button>
          <button onClick={() => sendCmd('nft list set inet sbs_filter blacklist')}>Sync from server</button>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>IP ADDRESS</th>
              <th>REASON</th>
              <th>TIME</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Use the sync button to list banned IPs (Check Terminal for raw output).</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
