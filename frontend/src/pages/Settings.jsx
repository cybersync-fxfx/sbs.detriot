import { useState } from 'react';

export default function Settings({ user }) {
  const handleRemoveTunnel = async () => {
    if (confirm("WARNING: your server will be exposed directly to the internet. Continue?")) {
      try {
        await fetch('/api/agent/tunnel/remove', {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('sbs_token')}` }
        });
        alert("Protection disconnected successfully.");
      } catch (err) {
        alert("Failed to disconnect protection.");
      }
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: '20px', color: 'var(--accent-cyan)' }}>Platform Settings</h2>
      <div className="glass-panel" style={{ maxWidth: '600px' }}>
        <h3 style={{ marginBottom: '20px' }}>Account</h3>
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'center' }}>
          <label style={{ flex: 1, color: 'var(--text-muted)' }}>Username</label>
          <input type="text" value={user?.username || ''} readOnly style={{ flex: 2 }} />
        </div>
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'center' }}>
          <label style={{ flex: 1, color: 'var(--text-muted)' }}>Email</label>
          <input type="text" defaultValue={user?.email || ''} style={{ flex: 2 }} />
        </div>
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'center' }}>
          <label style={{ flex: 1, color: 'var(--text-muted)' }}>New Password</label>
          <input type="password" placeholder="Leave blank to keep current" style={{ flex: 2 }} />
        </div>
        <button style={{ marginTop: '10px' }}>Update Profile</button>
        
        <h3 style={{ marginBottom: '20px', marginTop: '40px' }}>Network Protection</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
          By disconnecting, you will remove the GRE tunnel. All traffic will route directly to your server, exposing your real IP.
        </p>
        <button onClick={handleRemoveTunnel} style={{ background: 'var(--danger-red)', color: '#fff', border: '1px solid #ff4444' }}>
          Disconnect Protection
        </button>
      </div>
    </div>
  );
}
