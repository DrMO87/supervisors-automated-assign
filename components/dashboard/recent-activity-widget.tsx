'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { History, User, Clock, Calendar, RefreshCw, ChevronRight, X, Info, ShieldAlert, Layers } from 'lucide-react';
import { AuditLog } from '@/types/database.types';

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
        return { label: 'PERIOD', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'BACKUP_RESTORE':
        return { label: 'RESTORE', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      default:
        return { label: action || 'ACTION', bg: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return { full: 'N/A', relative: 'N/A' };
    const d = new Date(dateStr);

    // Exact formatted date and time
    const dateFormatted = d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timeFormatted = d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Relative time
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);

    let relative = `${diffMins}m ago`;
    if (diffMins < 1) relative = 'Just now';
    else if (diffMins >= 60 && diffHours < 24) relative = `${diffHours}h ago`;
    else if (diffHours >= 24) relative = dateFormatted;

    return { full: `${dateFormatted} at ${timeFormatted}`, relative };
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
            <p className="text-xs text-slate-400">Live audit log of changes by user & timestamp</p>
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
            const userEmail = log.changed_by_email || 'System Engine';
            const userRole = log.user_role || (userEmail.includes('melkhodary') ? 'Super Admin' : 'User');

            return (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className="group p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-150 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                {/* Left: User & Summary */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.bg}`}>
                      {badge.label}
                    </span>
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" />
                      {userEmail}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {userRole}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 font-medium group-hover:text-slate-900 transition-colors">
                    {log.summary || `Modified ${log.table_name} record (${log.record_id?.substring(0, 8)}...)`}
                  </p>
                </div>

                {/* Right: Date & Time */}
                <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0 self-end md:self-auto">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span className="font-semibold text-slate-600">{dt.relative}</span>
                  <span className="hidden lg:inline text-slate-400">({dt.full})</span>
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
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-gold-400" />
                <h3 className="font-bold text-sm">Audit Log Details</h3>
              </div>
              <button onClick={() => setSelectedLog(null)} className="p-1 text-white/60 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 font-medium block">User Email:</span>
                  <span className="font-bold text-slate-800">{selectedLog.changed_by_email || 'System Engine'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Role:</span>
                  <span className="font-bold text-slate-800">{selectedLog.user_role || 'User'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Table Name:</span>
                  <span className="font-mono text-slate-800">{selectedLog.table_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Date & Time:</span>
                  <span className="font-mono text-slate-800">{new Date(selectedLog.changed_at).toLocaleString()}</span>
                </div>
              </div>

              {selectedLog.summary && (
                <div>
                  <span className="text-slate-400 font-medium block mb-1">Activity Summary:</span>
                  <p className="p-3 bg-gold-50 border border-gold-200 text-gold-900 rounded-xl font-semibold">
                    {selectedLog.summary}
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
      )}

      {/* Full Audit Log Modal */}
      {isFullLogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-gold-400" />
                <h3 className="font-bold text-base font-display">System Audit Log History</h3>
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
                  return (
                    <div
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-between gap-4 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.bg}`}>
                          {badge.label}
                        </span>
                        <div>
                          <p className="font-bold text-slate-800">
                            {log.summary || `Modified ${log.table_name}`}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            User: <span className="font-semibold text-slate-700">{log.changed_by_email || 'System Engine'}</span> ({log.user_role || 'User'})
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-slate-400 font-mono">
                        {dt.full}
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
