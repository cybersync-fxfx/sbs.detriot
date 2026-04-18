export default function Settings({ user }) {
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
      </div>
    </div>
  );
}
