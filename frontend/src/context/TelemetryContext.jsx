import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const CHART_POINTS = 60;
const emptyArr = () => Array(CHART_POINTS).fill(0);

const TelemetryContext = createContext(null);

export function useTelemetry() {
  return useContext(TelemetryContext);
}

export function TelemetryProvider({ token, children }) {
  // ── Persistent state (survives page navigation) ──────────────────────────
  const [wsState,     setWsState]     = useState('connecting');
  const [agentStatus, setAgentStatus] = useState('unknown');
  const [lastEvent,   setLastEvent]   = useState(null);

  const [stats, setStats] = useState({
    connections: 0, bannedIPs: 0, cpuPercent: 0,
    memPercent: 0, synRate: 0, pps: 0, uptime: 0,
    inMbps: 0, outMbps: 0,
    hostname: '-', ip: '-', os: '-', iface: '-',
  });

  const [cpuHistory, setCpuHistory] = useState({ cpu: emptyArr(), mem: emptyArr() });
  const [netHistory, setNetHistory] = useState({ inb: emptyArr(), out: emptyArr() });
  const [logs,       setLogs]       = useState([]);
  const [lastUpdateMs, setLastUpdateMs] = useState(null);

  // ── WebSocket management ─────────────────────────────────────────────────
  const wsRef       = useRef(null);
  const retryTimer  = useRef(null);
  const retryCount  = useRef(0);
  const unmounted   = useRef(false);
  const pendingCmds = useRef(new Map());

  const connect = useCallback(() => {
    if (!token || unmounted.current) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}?token=${token}`);
    wsRef.current = ws;
    setWsState('connecting');

    ws.onopen = () => {
      retryCount.current = 0;
      setWsState('open');
    };

    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      setLastEvent(msg);

      if (msg.type === 'agent_connected') {
        setAgentStatus('CONNECTED');
        setStats(prev => ({
          ...prev,
          hostname: msg.hostname || prev.hostname,
          ip:       msg.ip       || prev.ip,
          os:       msg.os       || prev.os,
        }));
        setLastUpdateMs(Date.now());
      }

      if (msg.type === 'agent_disconnected') {
        setAgentStatus('NO AGENT');
        setStats(prev => ({ ...prev, hostname: '-', ip: '-', os: '-' }));
        setLastUpdateMs(null);
      }

      if (msg.type === 'stats_update') {
        setAgentStatus('CONNECTED');
        const s     = msg.stats  || {};
        const agent = msg.agent  || {};
        setLastUpdateMs(Date.now());

        setStats(prev => ({
          ...prev,
          connections: s.connections  ?? prev.connections,
          bannedIPs:   s.bannedIPs    ?? prev.bannedIPs,
          cpuPercent:  s.cpuPercent   ?? prev.cpuPercent,
          memPercent:  s.memPercent   ?? prev.memPercent,
          synRate:     s.synRate      ?? prev.synRate,
          pps:         s.pps          ?? prev.pps,
          uptime:      s.uptime       ?? prev.uptime,
          inMbps:      s.inMbps       ?? prev.inMbps,
          outMbps:     s.outMbps      ?? prev.outMbps,
          hostname:    agent.hostname || prev.hostname,
          ip:          agent.ip       || prev.ip,
          os:          agent.os       || prev.os,
          iface:       s.iface        || prev.iface,
        }));

        // Rolling chart data
        setCpuHistory(prev => ({
          cpu: [...prev.cpu.slice(1), Number((s.cpuPercent || 0).toFixed(1))],
          mem: [...prev.mem.slice(1), Number((s.memPercent || 0).toFixed(1))],
        }));

        setNetHistory(prev => ({
          inb: [...prev.inb.slice(1), Number((s.inMbps  || 0).toFixed(3))],
          out: [...prev.out.slice(1), Number((s.outMbps || 0).toFixed(3))],
        }));

        // Logs
        if (s.log && s.log.trim()) {
          const lines = s.log.split('\n').filter(l => l.trim()).map(l => {
            let level = 'default';
            if (/\[FW\].*ban|drop|block/i.test(l))            level = 'error';
            if (/\[FW\].*accept/i.test(l))                    level = 'success';
            if (/\[SSH\].*Failed|Invalid|error/i.test(l))     level = 'error';
            if (/\[SSH\].*Accepted/i.test(l))                 level = 'success';
            if (/\[SSH\].*Disconnected/i.test(l))             level = 'info';
            return { text: `[${new Date().toLocaleTimeString()}] ${l}`, level };
          });
          setLogs(prev => [...lines, ...prev].slice(0, 200));
        }
      }

      // Command results
      if (msg.type === 'command_result') {
        const pending = pendingCmds.current.get(msg.cmdId);
        if (pending) {
          clearTimeout(pending.timeoutId);
          pending.resolve(msg);
          pendingCmds.current.delete(msg.cmdId);
        }
      }
    };

    ws.onerror = () => {
      if (!unmounted.current) setWsState('error');
    };

    ws.onclose = () => {
      if (unmounted.current) return;
      setWsState('reconnecting');
      // Reject pending commands
      pendingCmds.current.forEach(({ reject, timeoutId }) => {
        clearTimeout(timeoutId);
        reject(new Error('Connection lost — reconnecting…'));
      });
      pendingCmds.current.clear();
      // Exponential back-off
      const delay = Math.min(1000 * Math.pow(2, retryCount.current), 10000);
      retryCount.current += 1;
      retryTimer.current = setTimeout(connect, delay);
    };
  }, [token]);

  useEffect(() => {
    unmounted.current = false;
    if (token) connect();
    return () => {
      unmounted.current = true;
      clearTimeout(retryTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      pendingCmds.current.forEach(({ reject, timeoutId }) => {
        clearTimeout(timeoutId);
        reject(new Error('Provider unmounted.'));
      });
      pendingCmds.current.clear();
    };
  }, [connect, token]);

  // ── sendCommand — shared by Terminal, Firewall, Blocklist ─────────────────
  const sendCommand = useCallback(async (cmd, { timeoutMs = 45000 } = {}) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      throw new Error('Connection not ready — waiting for the secure channel to open.');
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
        pendingCmds.current.delete(data.cmdId);
        reject(new Error('Agent did not respond within the timeout window.'));
      }, timeoutMs);
      pendingCmds.current.set(data.cmdId, { resolve, reject, timeoutId });
    });
  }, [token]);

  const value = {
    wsState,
    agentStatus,
    lastEvent,
    stats,
    cpuHistory,
    netHistory,
    logs,
    lastUpdateMs,
    sendCommand,
    isConnected: agentStatus === 'CONNECTED',
    commandReady: agentStatus === 'CONNECTED' && wsState === 'open',
  };

  return (
    <TelemetryContext.Provider value={value}>
      {children}
    </TelemetryContext.Provider>
  );
}
