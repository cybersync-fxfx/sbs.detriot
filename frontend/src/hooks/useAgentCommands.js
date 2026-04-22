import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useAgentCommands
 * - Manages a dedicated WebSocket connection per page that needs it.
 * - Auto-reconnects with exponential back-off on disconnect.
 * - Tracks agent status in real time from agent_connected / stats_update / agent_disconnected messages.
 * - Resolves command results by cmdId, with timeout protection.
 */
export function useAgentCommands(token) {
  const pendingRef   = useRef(new Map());
  const socketRef    = useRef(null);
  const retryTimer   = useRef(null);
  const retryCount   = useRef(0);
  const unmounted    = useRef(false);

  const [socketState,  setSocketState]  = useState('idle');
  const [agentStatus,  setAgentStatus]  = useState('unknown');
  const [lastEvent,    setLastEvent]    = useState(null);

  const connect = useCallback(() => {
    if (!token || unmounted.current) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}?token=${token}`);
    socketRef.current = ws;
    setSocketState('connecting');

    ws.onopen = () => {
      retryCount.current = 0;
      setSocketState('open');
    };

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
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

    ws.onerror = () => {
      if (!unmounted.current) setSocketState('error');
    };

    ws.onclose = () => {
      if (unmounted.current) return;
      setSocketState('reconnecting');
      // Reject all pending commands on close
      pendingRef.current.forEach(({ reject, timeoutId }) => {
        clearTimeout(timeoutId);
        reject(new Error('Connection lost — reconnecting…'));
      });
      pendingRef.current.clear();

      // Exponential back-off: 1s, 2s, 4s, max 10s
      const delay = Math.min(1000 * Math.pow(2, retryCount.current), 10000);
      retryCount.current += 1;
      retryTimer.current = setTimeout(connect, delay);
    };
  }, [token]);

  useEffect(() => {
    unmounted.current = false;
    connect();
    return () => {
      unmounted.current = true;
      clearTimeout(retryTimer.current);
      if (socketRef.current) {
        socketRef.current.onclose = null; // prevent reconnect on intentional close
        socketRef.current.close();
        socketRef.current = null;
      }
      pendingRef.current.forEach(({ reject, timeoutId }) => {
        clearTimeout(timeoutId);
        reject(new Error('Component unmounted.'));
      });
      pendingRef.current.clear();
    };
  }, [connect]);

  const sendCommand = useCallback(async (cmd, { timeoutMs = 45000 } = {}) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      throw new Error('Command channel not ready. Wait a moment and try again.');
    }

    const res = await fetch('/api/command', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ cmd })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to queue command.');

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        pendingRef.current.delete(data.cmdId);
        reject(new Error('Agent did not respond within the timeout window.'));
      }, timeoutMs);
      pendingRef.current.set(data.cmdId, { resolve, reject, timeoutId });
    });
  }, [token]);

  return { sendCommand, socketState, agentStatus, lastEvent };
}
