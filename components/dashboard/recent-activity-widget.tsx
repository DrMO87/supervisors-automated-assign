'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { History, User, Clock, Calendar, RefreshCw, ChevronRight, X, Info, ShieldAlert, Layers, ShieldCheck } from 'lucide-react';
import { AuditLog } from '@/types/database.types';
import { HOD_EMAILS } from '@/lib/config/hod-accounts';

interface RecentActivityWidgetProps {
  initialLogs?: AuditLog[];
  limit?: number;
}

export function RecentActivityWidget({ initialLogs = [], limit = 6 }: RecentActivityWidgetProps) {
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs);
  const [isLoading, setIsLoading] = useState(!initialLogs || initialLogs.length === 0);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isFullLogOpen, setIsFullLogOpen] = useState(false);
  const [allLogs, setAllLogs] = useState<AuditLog[]>([]);
  const [isFetchingAll, setIsFetchingAll] = useState(false);

  // Sync state when initialLogs prop changes from parent (e.g. app/page.tsx async load)
  useEffect(() => {
    if (initialLogs && initialLogs.length > 0) {
      setLogs(initialLogs);
      setIsLoading(false);
    }
  }, [initialLogs]);

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/audit-logs?limit=${limit}`);
      const data = await res.json();
      if (res.ok && data.logs) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error('Failed to fetch recent audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleOpenFullLog = async () => {
    setIsFullLogOpen(true);
    try {
      setIsFetchingAll(true);
      const res = await fetch('/api/audit-logs?limit=50');
      const data = await res.json();
      if (res.ok && data.logs) {
        setAllLogs(data.logs);
      }
    } catch (err) {
      console.error('Failed to fetch full audit log:', err);
    } finally {
      setIsFetchingAll(false);
    }
  };

  const getActionBadge = (action: string) => {
    switch (action?.toUpperCase()) {
      case 'INSERT':
        return { label: 'INSERT', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'UPDATE':
        return { label: 'UPDATE', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'DELETE':
        return { label: 'DELETE', bg: 'bg-red-50 text-red-700 border-red-200' };
      case 'AUTO_ASSIGN':
        return { label: 'AUTO ASSIGN', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'PERIOD_CHANGE':
        return { label: 'EXAM PERIOD', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'SWAP_APPROVED':
        return { label: 'SWAP APPROVED', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
      case 'BACKUP_RESTORE':
        return { label: 'RESTORE', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      default:
        return { label: action || 'ACTION', bg: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  /**
   * Format dates cleanly in Cairo / Egypt timezone (UTC+2)
   */
  const formatDate = (dateStr: string) => {
    if (!dateStr) return { full: 'N/A', relative: 'N/A', dateFormatted: 'N/A', timeFormatted: '' };
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { full: 'N/A', relative: 'N/A', dateFormatted: 'N/A', timeFormatted: '' };

    // Format date in Egypt Cairo timezone
    const dateFormatted = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Africa/Cairo',
    });

    // Format time in Egypt Cairo timezone with AM/PM
    const timeFormatted = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Africa/Cairo',
    });

    // Relative elapsed time
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relative = `${diffMins}m ago`;
    if (diffMins < 1) relative = 'Just now';
    else if (diffMins >= 60 && diffHours < 24) relative = `${diffHours}h ago`;
    else if (diffHours >= 24 && diffDays === 1) relative = 'Yesterday';
    else if (diffDays > 1 && diffDays < 7) relative = `${diffDays}d ago`;
    else if (diffDays >= 7) relative = dateFormatted;

    return {
      full: `${dateFormatted} at ${timeFormatted} (Cairo)`,
      relative,
      dateFormatted,
      timeFormatted,
    };
  };

  /**
   * Cleans raw ISO strings in activity summaries
   * e.g. "Auto-assigned 1411 supervisors for week starting 2026-11-06T22:00:00.000Z"
   * becomes "Auto-assigned 1411 supervisors for week of Sat, 7 Nov 2026"
   */
  const formatSummary = (summaryText?: string | null): string => {
    if (!summaryText) return '';
    return summaryText.replace(
      /(?:for week starting |for week of |week starting )?(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)/gi,
      (match, isoStr) => {
        try {
          const d = new Date(isoStr);
          if (isNaN(d.getTime())) return match;
          const formatted = d.toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: 'Africa/Cairo',
          });
          return `for week of ${formatted}`;
        } catch {
          return match;
        }
      }
    );
  };

  /**
   * Resolves raw email / System Engine into human-friendly user names and role badges
   */
  const getUserInfo = (email?: string | null, role?: string | null) => {
    const raw = (email || '').trim().toLowerCase();

    // Super Admin identity (Prof. Mahmoud Elkhoudary)
    if (!raw || raw === 'system engine' || raw.includes('melkhodary')) {
      return {
        name: 'Prof. Mahmoud Elkhoudary',
        email: 'melkhodary@horus.edu.eg',
        role: 'Super Admin',
        roleBadgeBg: 'bg-amber-50 text-amber-800 border-amber-200/80',
        avatarBg: 'bg-[#002147] text-gold-400 font-bold border border-gold-400/30',
        initials: 'ME',
      };
    }

    // Reports Administrator
    if (raw.includes('admin')) {
      return {
        name: 'Reports Administrator',
        email: raw,
        role: 'Administrator',
        roleBadgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
        avatarBg: 'bg-blue-700 text-white font-bold',
        initials: 'RA',
      };
    }

    // Head of Department
    if (HOD_EMAILS.includes(raw) || raw.includes('hod')) {
      const username = raw.split('@')[0].toUpperCase();
      return {
        name: `HOD (${username})`,
        email: raw,
        role: 'Head of Department',
        roleBadgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
        avatarBg: 'bg-purple-700 text-white font-bold',
        initials: username.substring(0, 2),
      };
    }

    // Control account
    if (raw.includes('control')) {
      return {
        name: 'Control Unit',
        email: raw,
        role: 'Control Team',
        roleBadgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        avatarBg: 'bg-emerald-700 text-white font-bold',
        initials: 'CU',
      };
    }

    // Default faculty/staff member
    const username = raw.split('@')[0];
    const formattedName = username.charAt(0).toUpperCase() + username.slice(1);
    return {
      name: formattedName,
      email: raw,
      role: role || 'Coordinator',
      roleBadgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
      avatarBg: 'bg-slate-600 text-white font-bold',
      initials: username.substring(0, 2).toUpperCase(),
    };
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gold-400/10 text-gold-600 rounded-lg">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">
              Recent System Activity
            </h3>
            <p className="text-xs text-slate-400">Live audit log of changes by user &amp; timestamp (Cairo Time · UTC+2)</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenFullLog}
            className="text-xs font-bold text-gold-600 hover:text-gold-700 hover:underline flex items-center gap-1"
          >
            View All Audit Logs <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Logs List */}
      {isLoading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-6 h-6 text-gold-500 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-400">Loading system activity...</p>
        </div>
      ) : logs.length > 0 ? (
        <div className="space-y-3">
          {logs.map((log) => {
            const badge = getActionBadge(log.action);
            const dt = formatDate(log.changed_at);
            const user = getUserInfo(log.changed_by_email, log.user_role);
            const cleanSummaryText = formatSummary(log.summary) || `Modified ${log.table_name} record (${log.record_id?.substring(0, 8)}...)`;

            return (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className="group p-3.5 rounded-xl bg-slate-50/80 hover:bg-slate-100/90 border border-slate-200/80 hover:border-gold-300 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs"
              >
                {/* Left: User Avatar, Name, Role & Summary */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.bg}`}>
                      {badge.label}
                    </span>
                    <div className="flex items-center gap-1.5 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                      <div className={`w-4 h-4 rounded-full ${user.avatarBg} flex items-center justify-center text-[8px]`}>
                        {user.initials}
                      </div>
                      <span className="text-xs font-bold text-slate-800">
                        {user.name}
                      </span>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${user.roleBadgeBg}`}>
                      {user.role}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 font-medium group-hover:text-slate-900 transition-colors leading-relaxed">
                    {cleanSummaryText}
                  </p>
                </div>

                {/* Right: Date & Time in Egypt / Cairo timezone */}
                <div className="flex flex-col md:items-end text-left md:text-right shrink-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                    <Clock className="w-3.5 h-3.5 text-gold-600" />
                    <span>{dt.timeFormatted}</span>
                    <span className="text-slate-400 font-normal">({dt.relative})</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium mt-0.5">
                    {dt.dateFormatted}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400 text-xs">
          No system activity logged yet.
        </div>
      )}

      {/* Detail Inspection Modal */}
      {selectedLog && (() => {
        const modalUser = getUserInfo(selectedLog.changed_by_email, selectedLog.user_role);
        const modalDt = formatDate(selectedLog.changed_at);
        const modalBadge = getActionBadge(selectedLog.action);
        const modalSummary = formatSummary(selectedLog.summary);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh]">
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-gold-400" />
                  <h3 className="font-bold text-sm">Audit Log Details</h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ml-2 ${modalBadge.bg}`}>
                    {modalBadge.label}
                  </span>
                </div>
                <button onClick={() => setSelectedLog(null)} className="p-1 text-white/60 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-slate-400 font-medium block">User Name:</span>
                    <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5 mt-0.5">
                      <div className={`w-4 h-4 rounded-full ${modalUser.avatarBg} flex items-center justify-center text-[8px]`}>
                        {modalUser.initials}
                      </div>
                      {modalUser.name}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono block mt-0.5">{modalUser.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block">Assigned Role:</span>
                    <span className={`inline-block mt-1 text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${modalUser.roleBadgeBg}`}>
                      {modalUser.role}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block">Target Database Table:</span>
                    <span className="font-mono text-slate-800 font-semibold">{selectedLog.table_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block">Timestamp (Cairo Time):</span>
                    <span className="font-mono text-slate-800 font-semibold">{modalDt.full}</span>
                  </div>
                </div>

                {modalSummary && (
                  <div>
                    <span className="text-slate-400 font-medium block mb-1">Activity Summary:</span>
                    <p className="p-3 bg-gold-50 border border-gold-200 text-gold-900 rounded-xl font-semibold leading-relaxed">
                      {modalSummary}
                    </p>
                  </div>
                )}

                {selectedLog.old_values && (
                  <div>
                    <span className="text-slate-400 font-medium block mb-1">Previous Values (Before):</span>
                    <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto">
                      {JSON.stringify(selectedLog.old_values, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.new_values && (
                  <div>
                    <span className="text-slate-400 font-medium block mb-1">New Values (After):</span>
                    <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto">
                      {JSON.stringify(selectedLog.new_values, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Full Audit Log Modal */}
      {isFullLogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-gold-400" />
                <h3 className="font-bold text-base font-display">System Audit Log History</h3>
                <span className="text-xs text-white/60 ml-2">({allLogs.length} entries)</span>
              </div>
              <button onClick={() => setIsFullLogOpen(false)} className="p-1 text-white/60 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {isFetchingAll ? (
                <div className="text-center py-12">
                  <RefreshCw className="w-8 h-8 text-gold-500 animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Loading audit history...</p>
                </div>
              ) : allLogs.length > 0 ? (
                allLogs.map((log) => {
                  const badge = getActionBadge(log.action);
                  const dt = formatDate(log.changed_at);
                  const user = getUserInfo(log.changed_by_email, log.user_role);
                  const summaryText = formatSummary(log.summary) || `Modified ${log.table_name}`;

                  return (
                    <div
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start sm:items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${badge.bg}`}>
                          {badge.label}
                        </span>
                        <div>
                          <p className="font-bold text-slate-800 leading-snug">
                            {summaryText}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                            <span className="font-semibold text-slate-700 flex items-center gap-1">
                              <div className={`w-3.5 h-3.5 rounded-full ${user.avatarBg} flex items-center justify-center text-[7px]`}>
                                {user.initials}
                              </div>
                              {user.name}
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${user.roleBadgeBg}`}>
                              {user.role}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-left sm:text-right shrink-0">
                        <div className="font-semibold text-slate-700 font-mono text-[11px]">{dt.timeFormatted}</div>
                        <div className="text-[10px] text-slate-400">{dt.dateFormatted} ({dt.relative})</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-center py-8 text-slate-400 text-xs">No activity logged yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
