'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { ActiveUserSession, PresenceSummary } from '@/types/presence.types';

interface PresenceContextType {
  onlineCount: number;
  uniqueAddressesCount: number;
  uniqueUsersCount: number;
  sessions: ActiveUserSession[];
  isLoading: boolean;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  refetch: () => Promise<void>;
}

const PresenceContext = createContext<PresenceContextType>({
  onlineCount: 0,
  uniqueAddressesCount: 0,
  uniqueUsersCount: 0,
  sessions: [],
  isLoading: true,
  isModalOpen: false,
  setIsModalOpen: () => {},
  refetch: async () => {},
});

const HEARTBEAT_INTERVAL_MS = 25 * 1000; // 25 seconds

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const [onlineCount, setOnlineCount] = useState(0);
  const [uniqueAddressesCount, setUniqueAddressesCount] = useState(0);
  const [uniqueUsersCount, setUniqueUsersCount] = useState(0);
  const [sessions, setSessions] = useState<ActiveUserSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const pathname = usePathname();
  const sessionIdRef = useRef<string>('');

  // Initialize or retrieve persistent sessionId for this tab
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let sid = sessionStorage.getItem('sm_presence_session_id');
    if (!sid) {
      sid = 'sid_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      sessionStorage.setItem('sm_presence_session_id', sid);
    }
    sessionIdRef.current = sid;
  }, []);

  const sendHeartbeat = useCallback(async () => {
    if (!sessionIdRef.current) return;
    try {
      const res = await fetch('/api/presence/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          page: pathname || window.location.pathname,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const summary: PresenceSummary = data.summary;
        if (summary) {
          setOnlineCount(summary.onlineCount);
          setUniqueAddressesCount(summary.uniqueAddressesCount);
          setUniqueUsersCount(summary.uniqueUsersCount);
          setSessions(summary.sessions || []);
        }
      }
    } catch (err) {
      console.warn('Presence heartbeat ping failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [pathname]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/presence/heartbeat');
      if (res.ok) {
        const summary: PresenceSummary = await res.json();
        setOnlineCount(summary.onlineCount);
        setUniqueAddressesCount(summary.uniqueAddressesCount);
        setUniqueUsersCount(summary.uniqueUsersCount);
        setSessions(summary.sessions || []);
      }
    } catch (err) {
      console.warn('Failed to fetch presence summary:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Heartbeat loop & initial fetch
  useEffect(() => {
    if (!sessionIdRef.current && typeof window !== 'undefined') {
      let sid = sessionStorage.getItem('sm_presence_session_id');
      if (!sid) {
        sid = 'sid_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
        sessionStorage.setItem('sm_presence_session_id', sid);
      }
      sessionIdRef.current = sid;
    }

    sendHeartbeat();

    const interval = setInterval(() => {
      sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    // Disconnect beacon on tab close / unload
    const handleUnload = () => {
      if (sessionIdRef.current && navigator.sendBeacon) {
        navigator.sendBeacon(`/api/presence/heartbeat?action=disconnect&sessionId=${sessionIdRef.current}`);
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [sendHeartbeat]);

  // Ping immediately when route changes
  useEffect(() => {
    if (sessionIdRef.current) {
      sendHeartbeat();
    }
  }, [pathname, sendHeartbeat]);

  return (
    <PresenceContext.Provider
      value={{
        onlineCount,
        uniqueAddressesCount,
        uniqueUsersCount,
        sessions,
        isLoading,
        isModalOpen,
        setIsModalOpen,
        refetch: fetchSummary,
      }}
    >
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresence must be used within a PresenceProvider');
  }
  return context;
}
