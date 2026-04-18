import { useState, useEffect } from 'react';

export default function Admin({ token }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadPendingUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.filter(u => u.status === 'pending'));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingUsers();
  }, [token]);

  const approveUser = async (id) => {
    if (!confirm('Approve this user?')) return;
    await fetch('/api/admin/approve', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    loadPendingUsers();
  };

  const rejectUser = async (id) => {
    if (!confirm('Reject this user?')) return;
    await fetch('/api/admin/reject', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    loadPendingUsers();
  };

  return (
    <div>
      <h2 style={{ marginBottom: '20px', color: 'var(--accent-cyan)' }}>Admin Panel - Pending Approvals</h2>
      <div className="glass-panel">
        <table>
          <thead>
            <tr>
              <th>USERNAME</th>
              <th>USER ID (UUID)</th>
              <th>AGENT ID</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No pending requests.</td></tr>
            ) : (
              users.map(u => (
                <tr key={u.id}>
                  <td className="font-mono">{u.username}</td>
                  <td>{u.id.substring(0, 8)}...</td>
                  <td className="font-mono">{u.agent_id}</td>
                  <td style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => approveUser(u.id)} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Approve</button>
                    <button className="danger" onClick={() => rejectUser(u.id)} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Reject</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
