'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Users,
  Globe,
  Activity,
  Laptop,
  Smartphone,
  Tablet,
  RefreshCw,
  Search,
  Shield,
  Clock,
  Compass,
  Check,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { usePresence } from '@/lib/hooks/use-presence';
import { ActiveUserSession } from '@/types/presence.types';

interface OnlineUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OnlineUsersModal({ isOpen, onClose }: OnlineUsersModalProps) {
  const { onlineCount, uniqueAddressesCount, uniqueUsersCount, sessions, refetch, isLoading } = usePresence();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const handleCopyIp = (ip: string) => {
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 1500);
  };

  const roles = useMemo(() => {
    const list = new Set(sessions.map((s) => s.role));
    return ['all', ...Array.from(list)];
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (selectedRole !== 'all' && s.role !== selectedRole) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        s.role.toLowerCase().includes(q) ||
        s.ipAddress.includes(q) ||
        s.currentPage.toLowerCase().includes(q)
      );
    });
  }, [sessions, searchQuery, selectedRole]);

  if (!isOpen) return null;

  const getRoleBadgeClass = (role: string) => {
    const r = role.toLowerCase();
    if (r.includes('super admin')) {
      return 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    }
    if (r.includes('control')) {
      return 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800';
    }
    if (r.includes('head') || r.includes('hod')) {
      return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800';
    }
    if (r.includes('staff') || r.includes('faculty') || r.includes('lecturer')) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    }
    if (r.includes('audit') || r.includes('report')) {
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  };

  const getDeviceIcon = (device: string) => {
    if (device === 'Mobile') return <Smartphone className="w-3.5 h-3.5 text-slate-500" />;
    if (device === 'Tablet') return <Tablet className="w-3.5 h-3.5 text-slate-500" />;
    return <Laptop className="w-3.5 h-3.5 text-slate-500" />;
  };

  const formatLastSeen = (isoStr: string) => {
    try {
      const diffSec = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
      if (diffSec < 5) return 'Active now';
      if (diffSec < 60) return `${diffSec}s ago`;
      const diffMin = Math.floor(diffSec / 60);
      return `${diffMin}m ago`;
    } catch {
      return 'Active';
    }
  };

  const formatPageName = (page: string) => {
    if (!page || page === '/') return 'Home Overview';
    if (page.startsWith('/dashboard')) return 'Weekly Schedule';
    if (page.startsWith('/exams')) return 'Exam Sessions';
    if (page.startsWith('/staff')) return 'Staff Roster';
    if (page.startsWith('/rooms')) return 'Rooms Directory';
    if (page.startsWith('/assignments')) return 'Auto-Assignment';
    if (page.startsWith('/reports')) return 'Reports Center';
    if (page.startsWith('/swaps')) return 'Smart Swaps';
    if (page.startsWith('/settings')) return 'System Settings';
    if (page.startsWith('/analytics')) return 'Analytics';
    if (page.startsWith('/staff-portal')) return 'Staff Portal';
    if (page.startsWith('/hod-portal')) return 'HOD Portal';
    if (page.startsWith('/control-portal')) return 'Control Portal';
    if (page.startsWith('/login')) return 'Login Page';
    return page;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="relative flex h-3.5 w-3.5 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Active Users &amp; Online Network Addresses
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live monitoring of all connected client IP addresses and user roles
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh online status"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-6 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
          {/* Unique Addresses */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Unique IP Addresses</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {uniqueAddressesCount}
              </p>
            </div>
          </div>

          {/* Unique Users */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Accounts</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {uniqueUsersCount}
              </p>
            </div>
          </div>

          {/* Total Active Sessions */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Open Browser Tabs</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {onlineCount}
              </p>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, email, role, or IP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">Role:</span>
            {roles.map((r) => (
              <button
                key={r}
                onClick={() => setSelectedRole(r)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                  selectedRole === r
                    ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {r === 'all' ? 'All Roles' : r}
              </button>
            ))}
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 divide-y divide-slate-100 dark:divide-slate-800">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No active sessions match your filter</p>
              <p className="text-xs text-slate-400 mt-1">Users appear online as soon as they open the app.</p>
            </div>
          ) : (
            filteredSessions.map((session, idx) => {
              const roleBadge = getRoleBadgeClass(session.role);
              const isLocal = session.ipAddress === '127.0.0.1' || session.ipAddress === 'localhost';

              return (
                <div
                  key={session.sessionId || idx}
                  className="pt-3 first:pt-0 flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {/* Left: User Identity & Avatar */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold text-sm flex items-center justify-center shadow-xs uppercase">
                        {(session.name || session.email || 'U').substring(0, 2)}
                      </div>
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {session.name || (session.email ? session.email.split('@')[0] : 'Guest Visitor')}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${roleBadge}`}
                        >
                          <Shield className="w-3 h-3 mr-1 opacity-70" />
                          {session.role}
                        </span>
                      </div>
                      {session.email && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{session.email}</p>
                      )}
                    </div>
                  </div>

                  {/* Middle: IP Address & Page Location */}
                  <div className="flex items-center gap-4 flex-wrap text-xs text-slate-600 dark:text-slate-300">
                    {/* IP Address Pill */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                      <Globe className="w-3 h-3 text-indigo-500" />
                      <span>{session.ipAddress}</span>
                      {isLocal && (
                        <span className="text-[10px] text-indigo-500 font-sans font-medium">(Local)</span>
                      )}
                      <button
                        onClick={() => handleCopyIp(session.ipAddress)}
                        title="Copy IP Address"
                        className="ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {copiedIp === session.ipAddress ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    {/* Current Page */}
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/50">
                      <Compass className="w-3 h-3" />
                      <span className="font-medium">{formatPageName(session.currentPage)}</span>
                    </div>
                  </div>

                  {/* Right: Device & Last Seen */}
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 self-end md:self-center">
                    <div className="flex items-center gap-1 text-[11px]" title={`${session.os} · ${session.browser}`}>
                      {getDeviceIcon(session.device)}
                      <span>
                        {session.os} · {session.browser}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      <Clock className="w-3 h-3" />
                      <span>{formatLastSeen(session.lastSeenAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <strong>{filteredSessions.length}</strong> of {sessions.length} active sessions across{' '}
            <strong>{uniqueAddressesCount}</strong> unique IP {uniqueAddressesCount === 1 ? 'address' : 'addresses'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
