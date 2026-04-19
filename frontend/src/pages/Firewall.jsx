import { useState } from 'react';
import { useAgentCommands } from '../hooks/useAgentCommands';

const inspectionActions = [
  {
    title: 'Full nftables ruleset',
    description: 'Inspect every active nftables table, chain, and set on the protected server.',
    command: 'nft list ruleset'
  },
  {
    title: 'Firewall service health',
    description: 'Check whether nftables is enabled and currently running.',
    command: 'systemctl status nftables --no-pager'
  },
  {
    title: 'Recent attack log',
    description: 'Review the latest attack-related entries written by the agent host.',
    command: 'tail -n 40 /var/log/sbs/attacks.log'
  },
  {
    title: 'Reload firewall service',
    description: 'Restart nftables cleanly and return the service status.',
    command: 'systemctl restart nftables && systemctl status nftables --no-pager'
  }
];

export default function Firewall({ token, user }) {
  const [activeCommand, setActiveCommand] = useState('');
  const [output, setOutput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const { sendCommand, agentStatus } = useAgentCommands(token);
  const liveAgentStatus = agentStatus === 'unknown' ? user?.agentStatus : agentStatus;

  const runInspection = async (action) => {
    setActiveCommand(action.title);
    setErrorMessage('');
    setIsBusy(true);

    try {
      const result = await sendCommand(action.command);
      setOutput(result.output || '(no output returned)');
    } catch (error) {
      setErrorMessage(error.message);
      setOutput('');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="page-shell">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">Security</p>
          <h1 className="page-title">Firewall Control</h1>
          <p className="page-copy">
            Use audited command presets to inspect the live nftables state and verify protection services without relying on placeholder controls.
          </p>
        </div>
        <div className="hero-status-stack">
          <div className={`status-pill ${liveAgentStatus === 'CONNECTED' ? 'connected' : 'disconnected'}`}>
            {liveAgentStatus === 'CONNECTED' ? 'Agent Reachable' : 'Agent Not Reachable'}
          </div>
          <div className="meta-chip">{isBusy ? 'Command running' : 'Ready'}</div>
        </div>
      </section>

      <section className="content-grid two-up">
        <article className="glass-panel elevated-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Tools</p>
              <h3>Live Firewall Actions</h3>
            </div>
          </div>

          <div className="stack-list">
            {inspectionActions.map(action => (
              <button
                key={action.title}
                type="button"
                className="action-card"
                onClick={() => runInspection(action)}
                disabled={isBusy || liveAgentStatus !== 'CONNECTED'}
              >
                <span className="action-card-title">{action.title}</span>
                <span className="action-card-copy">{action.description}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="glass-panel elevated-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Output</p>
              <h3>{activeCommand || 'Waiting for a firewall command'}</h3>
            </div>
          </div>

          {errorMessage ? <div className="callout-inline danger">{errorMessage}</div> : null}

          <div className="terminal-log medium">
            {output ? <pre className="command-output">{output}</pre> : <div className="empty-state">Run one of the live firewall actions to inspect the protected server.</div>}
          </div>
        </article>
      </section>
    </div>
  );
}
