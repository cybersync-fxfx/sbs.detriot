import { useEffect, useMemo, useState } from 'react';
import { useAgentCommands } from '../hooks/useAgentCommands';

const ipv4Pattern = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

function extractBlockedIps(output) {
  const matches = output.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g);
  return [...new Set(matches || [])];
}

export default function Blocklist({ token, user }) {
  const [ipInput, setIpInput] = useState('');
  const [ips, setIps] = useState([]);
  const [rawOutput, setRawOutput] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const { sendCommand, agentStatus } = useAgentCommands(token);
  const liveAgentStatus = agentStatus === 'unknown' ? user?.agentStatus : agentStatus;

  const refreshBlocklist = async () => {
    setFeedback('');
    setIsBusy(true);
    try {
      const result = await sendCommand('nft list set inet sbs_filter blacklist');
      const output = result.output || '';
      setRawOutput(output);
      setIps(extractBlockedIps(output));
    } catch (error) {
      setFeedback(error.message);
      setIps([]);
      setRawOutput('');
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    if (liveAgentStatus === 'CONNECTED') {
      refreshBlocklist();
    }
  }, [liveAgentStatus]);

  const banIp = async () => {
    const nextIp = ipInput.trim();
    if (!ipv4Pattern.test(nextIp)) {
      setFeedback('Enter a valid IPv4 address before sending a block command.');
      return;
    }

    setIsBusy(true);
    setFeedback('');
    try {
      const result = await sendCommand(`nft add element inet sbs_filter blacklist { ${nextIp} } && nft list set inet sbs_filter blacklist`);
      const output = result.output || '';
      setRawOutput(output);
      setIps(extractBlockedIps(output));
      setIpInput('');
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setIsBusy(false);
    }
  };

  const removeIp = async (ip) => {
    setIsBusy(true);
    setFeedback('');
    try {
      const result = await sendCommand(`nft delete element inet sbs_filter blacklist { ${ip} } && nft list set inet sbs_filter blacklist`);
      const output = result.output || '';
      setRawOutput(output);
      setIps(extractBlockedIps(output));
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setIsBusy(false);
    }
  };

  const summaryLabel = useMemo(() => {
    if (!ips.length) return 'No blocked IPs reported by the agent';
    return `${ips.length} blocked ${ips.length === 1 ? 'IP' : 'IPs'} reported by nftables`;
  }, [ips]);

  return (
    <div className="page-shell">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">Security</p>
          <h1 className="page-title">Block List</h1>
          <p className="page-copy">
            Push real blocklist changes to the protected server and keep the visible list in sync with the live nftables set.
          </p>
        </div>
        <div className="hero-status-stack">
          <div className={`status-pill ${liveAgentStatus === 'CONNECTED' ? 'connected' : 'disconnected'}`}>
            {liveAgentStatus === 'CONNECTED' ? 'Agent Reachable' : 'Agent Not Reachable'}
          </div>
          <div className="meta-chip">{summaryLabel}</div>
        </div>
      </section>

      <section className="content-grid two-up">
        <article className="glass-panel elevated-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Manage</p>
              <h3>Ban or Refresh</h3>
            </div>
          </div>

          <div className="form-stack">
            <input
              type="text"
              placeholder="203.0.113.24"
              value={ipInput}
              onChange={e => setIpInput(e.target.value)}
              disabled={isBusy || liveAgentStatus !== 'CONNECTED'}
            />
            <div className="button-row">
              <button className="danger" type="button" onClick={banIp} disabled={isBusy || liveAgentStatus !== 'CONNECTED'}>
                Ban IP
              </button>
              <button type="button" onClick={refreshBlocklist} disabled={isBusy || liveAgentStatus !== 'CONNECTED'}>
                Refresh From Server
              </button>
            </div>
            {feedback ? <div className="callout-inline danger">{feedback}</div> : null}
          </div>
        </article>

        <article className="glass-panel elevated-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Live Set</p>
              <h3>Blocked Addresses</h3>
            </div>
          </div>

          {ips.length === 0 ? (
            <div className="empty-state">No blocked IPv4 addresses are currently listed by the agent firewall.</div>
          ) : (
            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>IP Address</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ips.map(ip => (
                    <tr key={ip}>
                      <td className="font-mono">{ip}</td>
                      <td>
                        <button
                          type="button"
                          className="secondary-button small"
                          onClick={() => removeIp(ip)}
                          disabled={isBusy || liveAgentStatus !== 'CONNECTED'}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>

      <section className="glass-panel elevated-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Raw Response</p>
            <h3>nftables Output</h3>
          </div>
        </div>
        <div className="terminal-log medium">
          {rawOutput ? <pre className="command-output">{rawOutput}</pre> : <div className="empty-state">Run a refresh to capture the current nftables blacklist output.</div>}
        </div>
      </section>
    </div>
  );
}
