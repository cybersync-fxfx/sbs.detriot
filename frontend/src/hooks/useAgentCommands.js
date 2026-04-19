import { useEffect, useRef, useState } from 'react';

export function useAgentCommands(token) {
  const pendingRef = useRef(new Map());
  const [socketState, setSocketState] = useState('idle');
  const [agentStatus, setAgentStatus] = useState('unknown');
  const [lastEvent, setLastEvent] = useState(null);

  useEffect(() => {
    if (!token) return undefined;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}?token=${token}`);

    setSocketState('connecting');

    ws.onopen = () => setSocketState('open');

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      setLastEvent(msg);

      if (msg.type === 'agent_connected' || msg.type === 'stats_update') {
        setAgentStatus('CONNECTED');
      }

      if (msg.type === 'agent_disconnected') {
        setAgentStatus('NO AGENT');
      }

      if (msg.type === 'command_result') {
        const pending = pendingRef.current.get(msg.cmdId);
        if (!pending) return;

        clearTimeout(pending.timeoutId);
        pending.resolve(msg);
        pendingRef.current.delete(msg.cmdId);
      }
    };

    ws.onerror = () => setSocketState('error');
    ws.onclose = () => setSocketState('closed');

    return () => {
      pendingRef.current.forEach(({ reject, timeoutId }) => {
        clearTimeout(timeoutId);
        reject(new Error('Command socket closed before a response was received.'));
      });
      pendingRef.current.clear();
      ws.close();
    };
  }, [token]);

  const sendCommand = async (cmd, { timeoutMs = 45000 } = {}) => {
    const res = await fetch('/api/command', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ cmd })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to send command');
    }

    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        pendingRef.current.delete(data.cmdId);
        reject(new Error('Timed out waiting for the agent response.'));
      }, timeoutMs);

      pendingRef.current.set(data.cmdId, { resolve, reject, timeoutId });
    });
  };

  return {
    sendCommand,
    socketState,
    agentStatus,
    lastEvent,
  };
}
