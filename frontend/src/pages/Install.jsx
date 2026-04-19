import { useState } from 'react';

export default function Install({ token, user }) {
  const [osType, setOsType] = useState('ubuntu');
  const [panelUrl, setPanelUrl] = useState(window.location.origin);

  const handleDownload = () => {
    fetch(`/api/agent/download?os=${osType}&serverUrl=${encodeURIComponent(panelUrl)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sbs-agent-${user.agentId}.sh`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
  };

  return (
    <div className="page-shell">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">Deployment</p>
          <h1 className="page-title">Install Agent</h1>
          <p className="page-copy">
            Generate a per-user installer, ship it to the target Linux server, and bring that server into the dashboard with one command.
          </p>
        </div>
        <div className="hero-status-stack">
          <div className={`status-pill ${user?.agentStatus === 'CONNECTED' ? 'connected' : 'disconnected'}`}>
            {user?.agentStatus || 'NO AGENT'}
          </div>
          <div className="meta-chip">{user?.agentId}</div>
        </div>
      </section>

      <section className="content-grid two-up">
        <article className="glass-panel elevated-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Generator</p>
              <h3>Create Installer</h3>
            </div>
          </div>

          <div className="form-stack">
            <label>
              <span className="credential-label">Target OS</span>
              <select value={osType} onChange={e => setOsType(e.target.value)}>
                <option value="ubuntu">Ubuntu (20.04, 22.04, 24.04)</option>
                <option value="debian">Debian (11, 12)</option>
              </select>
            </label>

            <label>
              <span className="credential-label">Panel Public URL</span>
              <input
                type="text"
                value={panelUrl}
                onChange={e => setPanelUrl(e.target.value)}
                placeholder="https://your-panel-domain"
              />
            </label>

            <div className="callout-inline warning">
              Download a fresh installer whenever you change the API key or panel domain. This build connects the agent to the dashboard first; GRE routing stays deferred.
            </div>

            <div className="button-row">
              <button type="button" onClick={handleDownload}>Download Installer</button>
            </div>
          </div>
        </article>

        <article className="glass-panel elevated-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Runbook</p>
              <h3>Operator Steps</h3>
            </div>
          </div>

          <div className="stack-list">
            <div className="action-card">
              <span className="action-card-title">1. Upload the installer</span>
              <span className="action-card-copy command-output">scp sbs-agent-{user?.agentId}.sh root@YOUR_SERVER_IP:/root/</span>
            </div>
            <div className="action-card">
              <span className="action-card-title">2. Run it as root</span>
              <span className="action-card-copy command-output">sudo bash /root/sbs-agent-{user?.agentId}.sh</span>
            </div>
            <div className="action-card">
              <span className="action-card-title">3. Watch the dashboard</span>
              <span className="action-card-copy">Keep this tab open. The status badge should flip to connected when the agent registers and starts sending telemetry.</span>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
