import { useEffect, useRef, useState } from 'react';
import { useAgentCommands } from '../hooks/useAgentCommands';

const quickActions = [
  'uptime',
  'free -h',
  'df -h',
  'ss -ant | wc -l',
  'systemctl status sbs-agent --no-pager',
  'tail -n 40 /var/log/sbs/agent.log',
];

export default function Terminal({ token, user }) {
  const [logs, setLogs] = useState([
    { text: 'SBS Secure Terminal Interface', level: 'info' },
    { text: 'Run commands through the connected agent. Responses stream back when the agent completes the command.', level: 'default' }
  ]);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const logEndRef = useRef(null);
  const { sendCommand, agentStatus, lastEvent, socketState } = useAgentCommands(token);
  const commandReady = user?.agentStatus === 'CONNECTED' && socketState === 'open';

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (lastEvent?.type === 'agent_connected') {
      setLogs(prev => [...prev, { text: `Agent connected from ${lastEvent.ip || 'unknown ip'} (${lastEvent.hostname || 'server'})`, level: 'success' }]);
    }
    if (lastEvent?.type === 'agent_disconnected') {
      setLogs(prev => [...prev, { text: 'Agent disconnected or heartbeat expired.', level: 'error' }]);
    }
  }, [lastEvent]);

  const runCommand = async (cmd) => {
    if (!cmd.trim()) return;

    setLogs(prev => [...prev, { text: `> ${cmd}`, level: 'info' }]);
    setIsRunning(true);

    try {
      const result = await sendCommand(cmd.trim());
      setLogs(prev => [...prev, { text: result.output || '(no output returned)', level: result.exitCode === 0 ? 'default' : 'error' }]);
    } catch (error) {
      setLogs(prev => [...prev, { text: error.message, level: 'error' }]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const nextCommand = input;
    setInput('');
    await runCommand(nextCommand);
  };

  return (
    <div className="page-shell">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 className="page-title">Remote Terminal</h1>
          <p className="page-copy">
            Execute diagnostics and server maintenance through the installed agent without opening a second control surface.
          </p>
        </div>
        <div className="hero-status-stack">
          <div className={`status-pill ${user?.agentStatus === 'CONNECTED' ? 'connected' : 'disconnected'}`}>
            {user?.agentStatus === 'CONNECTED' ? 'Agent Ready' : 'Awaiting Agent'}
          </div>
          <div className="meta-chip">Socket {socketState}</div>
          <div className="meta-chip">Agent {agentStatus}</div>
        </div>
      </section>

      <section className="glass-panel elevated-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Session</p>
            <h3>Live Command Console</h3>
          </div>
          <div className="meta-chip">{isRunning ? 'Command in progress' : 'Idle'}</div>
        </div>

        <div className="terminal-log terminal-large">
          {logs.map((log, idx) => (
            <div key={`${idx}-${log.text}`} className={`log-line ${log.level}`}>
              {log.text}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="terminal-form">
          <label className="terminal-prompt">root@server:~$</label>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="terminal-input"
            autoComplete="off"
            disabled={isRunning || !commandReady}
            placeholder="Enter a Linux command"
          />
          <button type="submit" disabled={isRunning || !commandReady}>
            {isRunning ? 'Running...' : 'Execute'}
          </button>
        </form>

        <div className="action-grid">
          {quickActions.map(cmd => (
            <button
              key={cmd}
              type="button"
              className="secondary-button"
              onClick={() => runCommand(cmd)}
              disabled={isRunning || !commandReady}
            >
              {cmd}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
