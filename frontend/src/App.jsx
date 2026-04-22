import { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing  from './pages/Landing';
import Auth     from './pages/Auth';
import Layout   from './components/Layout';
import Dashboard from './pages/Dashboard';
import Terminal  from './pages/Terminal';
import Firewall  from './pages/Firewall';
import Blocklist from './pages/Blocklist';
import Install   from './pages/Install';
import ApiKeys   from './pages/ApiKeys';
import Settings  from './pages/Settings';

function App() {
  const [token,   setToken]   = useState(localStorage.getItem('sbs_token'));
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Fetch /api/me and keep user + agentStatus fresh ──────────────────────
  const fetchMe = useCallback((tk) => {
    fetch('/api/me', { headers: { Authorization: `Bearer ${tk}` } })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('session expired');
      })
      .then(data => setUser(data))
      .catch(() => {
        localStorage.removeItem('sbs_token');
        setToken(null);
        setUser(null);
      });
  }, []);

  // Initial load
  useEffect(() => {
    if (token) {
      fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('session expired');
        })
        .then(data => { setUser(data); setLoading(false); })
        .catch(() => {
          localStorage.removeItem('sbs_token');
          setToken(null);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [token]);

  // ── App-level WebSocket — keeps agentStatus live across all pages ─────────
  const wsRef        = useRef(null);
  const retryTimer   = useRef(null);
  const retryCount   = useRef(0);
  const wsActive     = useRef(false);

  const connectWs = useCallback(() => {
    if (!token || !wsActive.current) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}?token=${token}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }

      if (msg.type === 'agent_connected' || msg.type === 'stats_update') {
        setUser(prev => prev ? { ...prev, agentStatus: 'CONNECTED' } : prev);
      }
      if (msg.type === 'agent_disconnected') {
        setUser(prev => prev ? { ...prev, agentStatus: 'NO AGENT' } : prev);
      }
    };

    ws.onclose = () => {
      if (!wsActive.current) return;
      const delay = Math.min(1000 * Math.pow(2, retryCount.current), 10000);
      retryCount.current += 1;
      retryTimer.current = setTimeout(connectWs, delay);
    };

    ws.onerror = () => ws.close();
  }, [token]);

  useEffect(() => {
    if (!token || !user) return;
    wsActive.current = true;
    retryCount.current = 0;
    connectWs();
    return () => {
      wsActive.current = false;
      clearTimeout(retryTimer.current);
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
    };
  }, [token, user?.id, connectWs]);

  // ── Poll /api/me every 10 s to ensure agentStatus stays accurate ──────────
  useEffect(() => {
    if (!token || !user) return;
    const id = setInterval(() => fetchMe(token), 10000);
    return () => clearInterval(id);
  }, [token, user?.id, fetchMe]);

  const handleSetToken = (t) => {
    setToken(t);
    localStorage.setItem('sbs_token', t);
  };

  // ── Loading screen ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: '100vh', justifyContent: 'center', alignItems: 'center',
        background: '#000', color: '#00ff41',
        fontFamily: "'JetBrains Mono', monospace", gap: '16px'
      }}>
        <div style={{
          width: '40px', height: '40px',
          border: '2px solid rgba(0,255,65,0.2)',
          borderTop: '2px solid #00ff41',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <span style={{ fontSize: '0.8rem', letterSpacing: '3px', textTransform: 'uppercase' }}>
          Authenticating...
        </span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {!token ? (
          <>
            <Route path="/"      element={<Landing />} />
            <Route path="/login" element={<Auth setToken={handleSetToken} />} />
            <Route path="*"      element={<Navigate to="/" />} />
          </>
        ) : (
          <Route element={<Layout user={user} setToken={setToken} />}>
            <Route path="/"          element={<Dashboard user={user} token={token} />} />
            <Route path="/terminal"  element={<Terminal  token={token} user={user} />} />
            <Route path="/firewall"  element={<Firewall  token={token} user={user} />} />
            <Route path="/blocklist" element={<Blocklist token={token} user={user} />} />
            <Route path="/install"   element={<Install   token={token} user={user} />} />
            <Route path="/apikeys"   element={<ApiKeys   token={token} user={user} setUser={setUser} />} />
            <Route path="/settings"  element={<Settings  token={token} user={user} />} />
            <Route path="*"          element={<Navigate to="/" />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
