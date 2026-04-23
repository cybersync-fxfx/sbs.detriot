import { useEffect, useMemo, useState } from 'react';
import { useTelemetry } from '../context/TelemetryContext';

const ipv4Pattern = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

// Shell snippet that detects whichever nftables table this server uses
// Supports: inet sbs_filter (agent installer) and inet detroit_guard (setup-guard.sh)
const NFT_DETECT = `NFT_TABLE=$(nft list table inet sbs_filter 2>/dev/null && echo "inet sbs_filter" || echo "inet detroit_guard")`;

function extractBlockedIps(output) {
  const matches = output.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g);
  return [...new Set(matches || [])];
}

export default function Blocklist({ token, user }) {
  const { sendCommand, isConnected, commandReady } = useTelemetry();

  const [banInput,   setBanInput]   = useState('');
  const [unbanInput, setUnbanInput] = useState('');
  const [ips,        setIps]        = useState([]);
  const [rawOutput,  setRawOutput]  = useState('');
  const [banFeedback,   setBanFeedback]   = useState({ msg: '', type: '' });
  const [unbanFeedback, setUnbanFeedback] = useState({ msg: '', type: '' });
  const [isBusy, setIsBusy] = useState(false);

  // ── helpers ──────────────────────────────────────────────────────────────
  const applyResult = (result, onSuccess) => {
    const output = result.output || '';
    setRawOutput(output);
    if (result.exitCode !== 0 && result.exitCode != null) {
      return { ok: false, msg: `nft failed (exit ${result.exitCode}). See Firewall Output below.` };
    }
    const newIps = extractBlockedIps(output);
    setIps(newIps);
    if (onSuccess) onSuccess(newIps);
    return { ok: true };
  };

  // ── refresh ───────────────────────────────────────────────────────────────
  const refreshBlocklist = async () => {
    setBanFeedback({ msg: '', type: '' });
    setUnbanFeedback({ msg: '', type: '' });
    setIsBusy(true);
    try {
      const result = await sendCommand(`${NFT_DETECT}; nft list set $NFT_TABLE blacklist`);
      const { ok, msg } = applyResult(result);
      if (!ok) {
        setBanFeedback({ msg, type: 'danger' });
        setIps([]);
      }
    } catch (err) {
      setBanFeedback({ msg: err.message, type: 'danger' });
      setIps([]);
      setRawOutput('');
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    if (commandReady) refreshBlocklist();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commandReady]);

  // ── ban ───────────────────────────────────────────────────────────────────
  const banIp = async () => {
    const ip = banInput.trim();
    if (!ipv4Pattern.test(ip)) {
      setBanFeedback({ msg: 'Enter a valid IPv4 address.', type: 'danger' });
      return;
    }
    setBanFeedback({ msg: '', type: '' });
    setIsBusy(true);
    try {
      const result = await sendCommand(
        `${NFT_DETECT}; nft add element $NFT_TABLE blacklist { ${ip} } && nft list set $NFT_TABLE blacklist`
      );
      const { ok, msg } = applyResult(result);
      if (!ok) {
        setBanFeedback({ msg, type: 'danger' });
      } else {
        setBanFeedback({ msg: `${ip} has been banned.`, type: 'success' });
        setBanInput('');
      }
    } catch (err) {
      setBanFeedback({ msg: err.message, type: 'danger' });
    } finally {
      setIsBusy(false);
    }
  };

  // ── unban (manual input) ──────────────────────────────────────────────────
  const unbanIp = async (ip = unbanInput.trim()) => {
    if (!ipv4Pattern.test(ip)) {
      setUnbanFeedback({ msg: 'Enter a valid IPv4 address to unban.', type: 'danger' });
      return;
    }
    setUnbanFeedback({ msg: '', type: '' });
    setIsBusy(true);
    try {
      const result = await sendCommand(
        `${NFT_DETECT}; nft delete element $NFT_TABLE blacklist { ${ip} } && nft list set $NFT_TABLE blacklist`
      );
      const { ok, msg } = applyResult(result);
      if (!ok) {
        setUnbanFeedback({ msg, type: 'danger' });
      } else {
        setUnbanFeedback({ msg: `${ip} has been unbanned.`, type: 'success' });
        setUnbanInput('');
      }
    } catch (err) {
      setUnbanFeedback({ msg: err.message, type: 'danger' });
    } finally {
      setIsBusy(false);
    }
  };

  // ── Enter-key support ────────────────────────────────────────────────────
  const onBanKey   = (e) => e.key === 'Enter' && !isBusy && commandReady && banIp();
  const onUnbanKey = (e) => e.key === 'Enter' && !isBusy && commandReady && unbanIp();

  // ── summary ───────────────────────────────────────────────────────────────
  const summaryLabel = useMemo(() => {
    if (!ips.length) return 'No blocked IPs reported by the agent';
    return `${ips.length} blocked ${ips.length === 1 ? 'IP' : 'IPs'} active on the firewall`;
  }, [ips]);

  return (
    <div className="page-shell">
      {/* ── Hero ── */}
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">Security</p>
          <h1 className="page-title">Block List</h1>
          <p className="page-copy">
            Push real blocklist changes to the protected server and keep the visible list in sync with the live firewall rules.
          </p>
        </div>
        <div className="hero-status-stack">
          <div className={`status-pill ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? 'Agent Reachable' : 'Agent Not Reachable'}
          </div>
          <div className="meta-chip">{summaryLabel}</div>
        </div>
      </section>

      {/* ── Ban / Unban panels ── */}
      <section className="content-grid two-up">

        {/* Ban */}
        <article className="glass-panel elevated-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Block</p>
              <h3>Ban IP Address</h3>
            </div>
          </div>
          <div className="form-stack">
            <input
              id="ban-ip-input"
              type="text"
              placeholder="e.g. 203.0.113.24"
              value={banInput}
              onChange={e => setBanInput(e.target.value)}
              onKeyDown={onBanKey}
              disabled={isBusy || !commandReady}
            />
            <div className="button-row">
              <button
                id="ban-ip-btn"
                className="danger"
                type="button"
                onClick={banIp}
                disabled={isBusy || !commandReady}
              >
                Ban IP
              </button>
              <button
                id="refresh-blocklist-btn"
                type="button"
                onClick={refreshBlocklist}
                disabled={isBusy || !commandReady}
              >
                Refresh From Server
              </button>
            </div>
            {banFeedback.msg && (
              <div className={`callout-inline ${banFeedback.type}`}>{banFeedback.msg}</div>
            )}
          </div>
        </article>

        {/* Unban */}
        <article className="glass-panel elevated-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Unblock</p>
              <h3>Unban IP Address</h3>
            </div>
          </div>
          <div className="form-stack">
            <input
              id="unban-ip-input"
              type="text"
              placeholder="e.g. 203.0.113.24"
              value={unbanInput}
              onChange={e => setUnbanInput(e.target.value)}
              onKeyDown={onUnbanKey}
              disabled={isBusy || !commandReady}
            />
            <div className="button-row">
              <button
                id="unban-ip-btn"
                className="secondary-button"
                type="button"
                onClick={() => unbanIp()}
                disabled={isBusy || !commandReady}
              >
                Unban IP
              </button>
            </div>
            {unbanFeedback.msg && (
              <div className={`callout-inline ${unbanFeedback.type}`}>{unbanFeedback.msg}</div>
            )}
          </div>
        </article>
      </section>

      {/* ── Live IP table ── */}
      <section className="glass-panel elevated-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Live Set</p>
            <h3>Blocked Addresses</h3>
          </div>
        </div>

        {ips.length === 0 ? (
          <div className="empty-state">No blocked IPv4 addresses are currently listed by the server firewall.</div>
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
                        onClick={() => unbanIp(ip)}
                        disabled={isBusy || !commandReady}
                      >
                        Unban
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Raw output ── */}
      <section className="glass-panel elevated-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Raw Response</p>
            <h3>Firewall Output</h3>
          </div>
        </div>
        <div className="terminal-log medium">
          {rawOutput
            ? <pre className="command-output">{rawOutput}</pre>
            : <div className="empty-state">Run a refresh to capture the current firewall blacklist output.</div>
          }
        </div>
      </section>
    </div>
  );
}
