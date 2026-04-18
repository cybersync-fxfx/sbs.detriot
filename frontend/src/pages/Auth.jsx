import { useState } from 'react';
import { LogIn, UserPlus, Shield, Terminal, Activity, Lock } from 'lucide-react';

export default function Auth({ setToken }) {
  const [tab, setTab] = useState('login');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    
    const url = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
    const payload = tab === 'login' 
      ? { username: user, password: pass }
      : { username: user, email, password: pass };
      
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (res.ok) {
        if (tab === 'login') {
          setToken(data.token);
        } else {
          setMsg('Registration successful! Please wait for admin approval.');
          setTab('login');
          setPass('');
        }
      } else {
        if (data.isPending) {
          setError('Your account is still pending approval by an administrator.');
        } else {
          setError(data.error || 'Authentication failed');
        }
      }
    } catch (err) {
      setError('Network error');
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'row', flexWrap: 'wrap' }}>
      {/* Left Side - Description */}
      <div style={{ 
        flex: '1 1 50%', 
        minWidth: '300px',
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        padding: '60px', 
        background: 'radial-gradient(circle at 30% 50%, rgba(0,240,255,0.08), transparent 70%)',
        borderRight: '1px solid var(--panel-border)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative Grid Background */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'linear-gradient(var(--panel-border) 1px, transparent 1px), linear-gradient(90deg, var(--panel-border) 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.3, zIndex: -1 }}></div>
        
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          <img src="/logo.png" alt="SBS Logo" style={{ height: '80px', marginBottom: '20px', display: 'block' }} />
          <h1 className="glow-text text-cyan" style={{ fontSize: '3rem', marginBottom: '10px' }}>SBS PLATFORM</h1>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--text-main)', marginBottom: '30px', fontWeight: '500', opacity: 0.9 }}>
            Next-Generation Server Based Security
          </h2>
          
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '40px', fontSize: '1.05rem' }}>
            Deploy autonomous security agents to monitor traffic, enforce automated rate limiting, and stop DDoS attacks in real-time across your entire Linux fleet.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px' }}>
              <div style={{ background: 'rgba(0, 240, 255, 0.1)', padding: '12px', borderRadius: '12px', color: 'var(--accent-cyan)' }}>
                <Activity size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '4px' }}>Real-time Analytics</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Monitor active connections, CPU/Memory metrics, and live packet rates.</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px' }}>
              <div style={{ background: 'rgba(0, 255, 136, 0.1)', padding: '12px', borderRadius: '12px', color: 'var(--success-green)' }}>
                <Shield size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '4px' }}>Automated Threat Mitigation</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Dynamically blacklist attacking IPs via nftables triggers.</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px' }}>
              <div style={{ background: 'rgba(255, 184, 0, 0.1)', padding: '12px', borderRadius: '12px', color: 'var(--warn-amber)' }}>
                <Lock size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '4px' }}>Secure Remote Execution</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Execute terminal commands securely via authenticated WebSockets.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div style={{ 
        flex: '1 1 50%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '40px',
        position: 'relative'
      }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 10 }}>
          
          <div style={{ display: 'flex', borderBottom: '1px solid var(--panel-border)', marginBottom: '30px' }}>
            <button 
              style={{ flex: 1, background: 'none', border: 'none', color: tab === 'login' ? 'var(--accent-cyan)' : 'var(--text-muted)', borderBottom: tab === 'login' ? '2px solid var(--accent-cyan)' : '2px solid transparent', borderRadius: 0, boxShadow: 'none' }}
              onClick={() => { setTab('login'); setError(''); setMsg(''); }}
            >
              <LogIn size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }}/> SIGN IN
            </button>
            <button 
              style={{ flex: 1, background: 'none', border: 'none', color: tab === 'register' ? 'var(--accent-cyan)' : 'var(--text-muted)', borderBottom: tab === 'register' ? '2px solid var(--accent-cyan)' : '2px solid transparent', borderRadius: 0, boxShadow: 'none' }}
              onClick={() => { setTab('register'); setError(''); setMsg(''); }}
            >
              <UserPlus size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }}/> REGISTER
            </button>
          </div>

          <h2 style={{ marginBottom: '25px', textAlign: 'center', color: 'var(--text-main)' }}>
            {tab === 'login' ? 'Welcome Back' : 'Request Access'}
          </h2>

          {error && <div style={{ color: 'var(--danger-red)', background: 'rgba(255, 51, 102, 0.1)', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem', border: '1px solid var(--danger-red)', display: 'flex', alignItems: 'center', gap: '10px' }}><Shield size={18}/> {error}</div>}
          {msg && <div style={{ color: 'var(--success-green)', background: 'rgba(0, 255, 136, 0.1)', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem', border: '1px solid var(--success-green)' }}>{msg}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', letterSpacing: '1px' }}>{tab === 'login' ? 'EMAIL OR USERNAME' : 'USERNAME'}</label>
              <input type="text" required value={user} onChange={(e) => setUser(e.target.value)} style={{ padding: '14px 16px' }} />
            </div>
            
            {tab === 'register' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', letterSpacing: '1px' }}>EMAIL ADDRESS</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: '14px 16px' }} />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', letterSpacing: '1px' }}>PASSWORD</label>
              <input type="password" required value={pass} onChange={(e) => setPass(e.target.value)} style={{ padding: '14px 16px' }} />
            </div>

            <button type="submit" style={{ marginTop: '15px', padding: '14px', fontSize: '1rem', letterSpacing: '1px' }}>
              {tab === 'login' ? 'AUTHORIZE ACCESS' : 'SUBMIT REGISTRATION'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
