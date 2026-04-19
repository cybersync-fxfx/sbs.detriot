import { useMemo, useState } from 'react';

const CopyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

function CredentialRow({ label, value, copied, onCopy }) {
  return (
    <div className="credential-row">
      <div className="credential-meta">
        <span className="credential-label">{label}</span>
        <span className="credential-value">{value || '-'}</span>
      </div>
      <button type="button" className="icon-button" onClick={onCopy} aria-label={`Copy ${label}`}>
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  );
}

export default function ApiKeys({ token, user, setUser }) {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [feedback, setFeedback] = useState('');
  const panelOrigin = useMemo(() => window.location.origin, []);

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const regenerateKey = async () => {
    if (!confirm('Regenerating the API key will require the agent to use a fresh installer or updated environment file. Continue?')) return;

    setFeedback('');

    try {
      const res = await fetch('/api/me/regenerate-key', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to regenerate API key.');
      }

      if (data.apiKey) {
        setUser(prev => ({ ...prev, apiKey: data.apiKey }));
        setFeedback('API key regenerated. Download a fresh installer before reconnecting the agent.');
      }
    } catch (error) {
      setFeedback(error.message);
    }
  };

  return (
    <div className="page-shell">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">Credentials</p>
          <h1 className="page-title">API & Keys</h1>
          <p className="page-copy">
            These credentials bind a server to your account. Keep the API key private and treat the agent ID as the server’s public handle.
          </p>
        </div>
        <div className="hero-status-stack">
          <div className={`status-pill ${user?.agentStatus === 'CONNECTED' ? 'connected' : 'disconnected'}`}>
            {user?.agentStatus || 'NO AGENT'}
          </div>
          <div className="meta-chip">{user?.agentId || 'No agent ID'}</div>
        </div>
      </section>

      <section className="content-grid two-up">
        <article className="glass-panel elevated-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Secrets</p>
              <h3>Linked Credentials</h3>
            </div>
          </div>

          <div className="credential-stack">
            <CredentialRow
              label="Agent ID"
              value={user?.agentId}
              copied={copiedId}
              onCopy={() => handleCopy(user?.agentId, 'id')}
            />
            <CredentialRow
              label="API Key"
              value={user?.apiKey}
              copied={copiedKey}
              onCopy={() => handleCopy(user?.apiKey, 'key')}
            />
          </div>

          <div className="callout-inline warning">
            Regenerating the API key immediately invalidates the old key for future agent authentication.
          </div>

          {feedback ? <div className="callout-inline success">{feedback}</div> : null}

          <div className="button-row">
            <button type="button" className="danger" onClick={regenerateKey}>
              Regenerate API Key
            </button>
          </div>
        </article>

        <article className="glass-panel elevated-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Example</p>
              <h3>REST Command Request</h3>
            </div>
          </div>

          <pre className="command-output">
{`curl -X POST ${panelOrigin}/api/command \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"cmd":"nft list ruleset"}'`}
          </pre>
        </article>
      </section>
    </div>
  );
}
