import { useEffect, useRef, useState, useCallback } from 'react';
import { API_BASE_URL } from '../config';
import type { LeaderboardEntry } from '../services/api';

type WsStatus = 'connecting' | 'connected' | 'disconnected';

/**
 * Custom hook that maintains a live WebSocket connection to the contest
 * leaderboard endpoint. It automatically reconnects with exponential
 * back-off when the connection drops.
 *
 * @param contestId  The contest to subscribe to (null = don't connect)
 * @param initial    Seed data fetched via REST before the WS connects
 * @returns          { entries, status, lastUpdated }
 */
export function useContestLeaderboard(
  contestId: number | null,
  initial: LeaderboardEntry[],
) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(initial);
  const [status, setStatus] = useState<WsStatus>('disconnected');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Sync seed data when the parent fetches a new contest via REST
  useEffect(() => {
    setEntries(initial);
  }, [initial]);

  const cleanup = useCallback(() => {
    if (pingRef.current) {
      clearInterval(pingRef.current);
      pingRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (contestId === null || !mountedRef.current) return;
    cleanup();

    // Derive ws:// or wss:// from the API base URL
    const wsBase = API_BASE_URL.replace(/^http/, 'ws');
    const url = `${wsBase}/ws/contests/${contestId}/leaderboard`;

    setStatus('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      retryRef.current = 0;
      setStatus('connected');

      // Send periodic pings to keep the connection alive
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('ping');
        }
      }, 25_000);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'leaderboard_update' && Array.isArray(msg.data)) {
          setEntries(msg.data as LeaderboardEntry[]);
          setLastUpdated(new Date());
        }
      } catch {
        // Ignore non-JSON or malformed messages
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus('disconnected');
      // Exponential back-off: 1s, 2s, 4s, 8s … max 30s
      const delay = Math.min(1000 * 2 ** retryRef.current, 30_000);
      retryRef.current += 1;
      timerRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, delay);
    };

    ws.onerror = () => {
      // onclose will fire after onerror, so reconnection is handled there
    };
  }, [contestId, cleanup]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      cleanup();
      setStatus('disconnected');
    };
  }, [connect, cleanup]);

  return { entries, status, lastUpdated };
}
