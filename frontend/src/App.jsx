import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Terminal from './pages/Terminal';
import Firewall from './pages/Firewall';
import Blocklist from './pages/Blocklist';
import Install from './pages/Install';
import ApiKeys from './pages/ApiKeys';
import Settings from './pages/Settings';

// Main application router and state management
function App() {
  const [token, setToken] = useState(localStorage.getItem('sbs_token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('Invalid token');
        })
        .then(data => {
          setUser(data);
          setLoading(false);
        })
        .catch(() => {
          localStorage.removeItem('sbs_token');
          setToken(null);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token || !user) return undefined;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}?token=${token}`);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === 'agent_connected' || msg.type === 'stats_update') {
        setUser(prev => prev ? { ...prev, agentStatus: 'CONNECTED' } : prev);
      }

      if (msg.type === 'agent_disconnected') {
        setUser(prev => prev ? { ...prev, agentStatus: 'NO AGENT' } : prev);
      }
    };

    return () => ws.close();
  }, [token, user?.id, user?.agentId]);

  if (loading) return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>Loading...</div>;

  return (
    <BrowserRouter>
      <Routes>
        {!token ? (
          <>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Auth setToken={(t) => { setToken(t); localStorage.setItem('sbs_token', t); }} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </>
        ) : (
          <Route element={<Layout user={user} setToken={setToken} />}>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/terminal" element={<Terminal token={token} user={user} />} />
            <Route path="/firewall" element={<Firewall token={token} user={user} />} />
            <Route path="/blocklist" element={<Blocklist token={token} user={user} />} />
            <Route path="/install" element={<Install token={token} user={user} />} />
            <Route path="/apikeys" element={<ApiKeys token={token} user={user} setUser={setUser} />} />
            <Route path="/settings" element={<Settings token={token} user={user} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
