'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Shield, RefreshCw, Calendar, RotateCcw, Plus, Trash2, CheckCircle2, Clock, Zap, Download } from 'lucide-react';
import { ExamPeriodBackup } from '@/types/database.types';
import { useExamPeriod } from '@/lib/hooks/exam-period-context';
import { useToast } from '@/components/ui/toast';

interface WeeklyBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreSuccess?: () => void;
}

export function WeeklyBackupModal({ isOpen, onClose, onRestoreSuccess }: WeeklyBackupModalProps) {
  const { activePeriod } = useExamPeriod();
  const toast = useToast();

  const [backups, setBackups] = useState<ExamPeriodBackup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);

  const fetchBackups = useCallback(async () => {
    if (!activePeriod) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch(`/api/backup/weekly?period_id=${activePeriod.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setBackups(data.backups || []);
    } catch (err: any) {
      console.error('Error fetching backups:', err);
      toast.error('Failed to load period backups', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [activePeriod, toast]);

  useEffect(() => {
    if (isOpen) {
      fetchBackups();
    }
  }, [isOpen, fetchBackups]);

  const handleCreateBackup = async () => {
    try {
      setIsCreating(true);
      const res = await fetch('/api/backup/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger_type: 'manual',
          backup_name: `Manual Snapshot - ${activePeriod?.name || 'Period'} (${new Date().toLocaleDateString()})`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success('Backup Created', 'Current exam period details saved successfully');
      await fetchBackups();
    } catch (err: any) {
      toast.error('Failed to create backup', err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestore = async (backup: ExamPeriodBackup) => {
    const confirmMessage = `Are you sure you want to restore "${backup.backup_name}"?\n\nThis will restore staff availability, workload scores, exam assignments, and period reserve staff to their state when this snapshot was created.`;

    if (!window.confirm(confirmMessage)) return;

    try {
      setIsRestoring(backup.id);
      const res = await fetch('/api/backup/weekly/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup_id: backup.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success('Backup Restored', data.message);
      if (onRestoreSuccess) onRestoreSuccess();
      onClose();
    } catch (err: any) {
      toast.error('Failed to restore backup', err.message);
    } finally {
      setIsRestoring(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-[#00122e] via-[#001f4d] to-[#1527a0] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gold-400/20 rounded-xl border border-gold-400/30 text-gold-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold">End-of-Week Period Backups</h2>
              <p className="text-xs text-white/70">
                {activePeriod ? `Active Period: ${activePeriod.name}` : 'Manage period snapshots and backups'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Create Instant Backup CTA */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between gap-4 shadow-md">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2 text-gold-300">
                <Clock className="w-4 h-4" /> Automatic End-of-Week Backups Enabled
              </h3>
              <p className="text-xs text-white/70 mt-1">
                The system automatically creates a weekly backup snapshot at the end of each week. You can also create a manual backup anytime.
              </p>
            </div>
            <button
              onClick={handleCreateBackup}
              disabled={isCreating}
              className="btn btn-gold btn-sm px-4 py-2 text-xs font-bold shrink-0 flex items-center gap-1.5 shadow-md"
            >
              {isCreating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" /> Create Snapshot Now
                </>
              )}
            </button>
          </div>

          {/* Backup List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                Available Snapshots ({backups.length})
              </h3>
              <button
                onClick={fetchBackups}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 text-gold-500 animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-400">Loading period backups...</p>
              </div>
            ) : backups.length > 0 ? (
              <div className="space-y-3">
                {backups.map((b) => {
                  const snap = b.snapshot_data;
                  const isRestoringThis = isRestoring === b.id;

                  return (
                    <div
                      key={b.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">{b.backup_name}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              b.trigger_type === 'automatic'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {b.trigger_type === 'automatic' ? '🤖 Auto End-of-Week' : '👤 Manual'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1 font-mono text-[11px]">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {new Date(b.created_at).toLocaleString()}
                          </span>
                          <span>•</span>
                          <span className="font-medium text-slate-700">
                            {snap?.staff?.length || 0} Staff
                          </span>
                          <span>•</span>
                          <span className="font-medium text-slate-700">
                            {snap?.exams?.length || 0} Exams
                          </span>
                          <span>•</span>
                          <span className="font-medium text-slate-700">
                            {snap?.assignments?.length || 0} Assignments
                          </span>
                          <span>•</span>
                          <span className="font-medium text-slate-700">
                            {snap?.period_free_staff?.length || 0} Reserves
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-auto">
                        <button
                          onClick={() => handleRestore(b)}
                          disabled={isRestoringThis}
                          className="btn btn-gold btn-sm px-4 py-2 text-xs font-bold flex items-center gap-1.5 shadow-sm"
                        >
                          {isRestoringThis ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Restoring...
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3.5 h-3.5" /> Restore This Backup
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                <Shield className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No Weekly Backups Saved Yet</p>
                <p className="text-xs text-slate-400 mb-4 max-w-sm mx-auto">
                  Automatic end-of-week backups will appear here as each week completes. You can also create one manually now.
                </p>
                <button
                  onClick={handleCreateBackup}
                  disabled={isCreating}
                  className="btn btn-gold btn-sm px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Create First Backup
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
