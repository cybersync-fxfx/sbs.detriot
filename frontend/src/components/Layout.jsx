import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Activity, Terminal, Shield, ListX, Download, Key, Settings, Users, LogOut } from 'lucide-react';

export default function Layout({ user, setToken }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('sbs_token');
    navigate('/');
  };

  const navItems = [
    { section: 'Monitor' },
    { path: '/', name: 'Dashboard', icon: <Activity size={18} /> },
    { path: '/terminal', name: 'Terminal', icon: <Terminal size={18} /> },
    { section: 'Security' },
    { path: '/firewall', name: 'Firewall Rules', icon: <Shield size={18} /> },
    { path: '/blocklist', name: 'Block List', icon: <ListX size={18} /> },
    { section: 'Setup' },
    { path: '/install', name: 'Install Agent', icon: <Download size={18} /> },
    { path: '/apikeys', name: 'API & Keys', icon: <Key size={18} /> },
    { path: '/settings', name: 'Settings', icon: <Settings size={18} /> },
  ];


  return (
    <div className="app-layout">
      {/* Top Bar */}
      <header style={{ height: '60px', borderBottom: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', background: 'var(--bg-dark)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <img src="/logo.png" alt="SBS Logo" style={{ height: '32px' }} />
          <div className="glow-text text-cyan" style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 'bold' }}>
            SBS <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 'normal', textShadow: 'none' }}>Server Based Security</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', border: `1px solid ${user?.agentStatus === 'CONNECTED' ? 'var(--success-green)' : 'var(--text-muted)'}`, color: user?.agentStatus === 'CONNECTED' ? 'var(--success-green)' : 'var(--text-muted)', boxShadow: user?.agentStatus === 'CONNECTED' ? '0 0 10px rgba(0,255,136,0.2)' : 'none' }}>
            {user?.agentStatus || 'NO AGENT'}
          </div>
          <div className="font-mono">{time}</div>
          <div className="text-cyan font-mono">@{user?.username}</div>
          <button style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--danger-red)', color: 'var(--danger-red)' }} onClick={handleLogout}>
            <LogOut size={14} />
          </button>
        </div>
      </header>

      <div className="main-area">
        {/* Sidebar */}
        <nav style={{ width: '250px', borderRight: '1px solid var(--panel-border)', background: 'rgba(10, 12, 16, 0.8)', padding: '24px 0', overflowY: 'auto' }}>
          {navItems.map((item, idx) => {
            if (item.section) {
              return <div key={idx} style={{ padding: '0 24px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', marginTop: idx === 0 ? '0' : '20px', letterSpacing: '1px' }}>{item.section}</div>;
            }
            const isActive = location.pathname === item.path;
            return (
              <NavLink 
                key={idx} 
                to={item.path} 
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 24px', textDecoration: 'none', color: isActive ? 'var(--accent-cyan)' : 'var(--text-main)', 
                  background: isActive ? 'rgba(0, 240, 255, 0.1)' : 'transparent',
                  borderLeft: `3px solid ${isActive ? 'var(--accent-cyan)' : 'transparent'}`,
                  transition: 'all 0.2s'
                }}
              >
                {item.icon} {item.name}
              </NavLink>
            );
          })}
        </nav>

        {/* Content */}
        <main className="content-area">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
