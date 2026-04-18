import { useState } from 'react';
import { ShieldAlert, LogIn, UserPlus } from 'lucide-react';

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
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <img src="/logo.png" alt="SBS Logo" style={{ height: '80px', margin: '0 auto 10px', display: 'block' }} />
          <h1 className="glow-text text-cyan">SBS SECURE</h1>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--panel-border)', marginBottom: '20px' }}>
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

        {error && <div style={{ color: 'var(--danger-red)', background: 'rgba(255, 51, 102, 0.1)', padding: '10px', borderRadius: '4px', marginBottom: '15px', fontSize: '0.9rem', border: '1px solid var(--danger-red)' }}>{error}</div>}
        {msg && <div style={{ color: 'var(--success-green)', background: 'rgba(0, 255, 136, 0.1)', padding: '10px', borderRadius: '4px', marginBottom: '15px', fontSize: '0.9rem', border: '1px solid var(--success-green)' }}>{msg}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>{tab === 'login' ? 'EMAIL / USERNAME' : 'USERNAME'}</label>
            <input type="text" required value={user} onChange={(e) => setUser(e.target.value)} />
          </div>
          
          {tab === 'register' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>EMAIL</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>PASSWORD</label>
            <input type="password" required value={pass} onChange={(e) => setPass(e.target.value)} />
          </div>

          <button type="submit" style={{ marginTop: '10px' }}>
            {tab === 'login' ? 'ACCESS SYSTEM' : 'CREATE ACCOUNT'}
          </button>
        </form>
      </div>
    </div>
  );
}
