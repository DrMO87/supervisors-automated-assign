'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, RefreshCw, Play, RotateCcw, AlertTriangle, Layers, Sun, CheckCircle2, Package } from 'lucide-react';
import { SemesterType, ScoreMode } from '@/types/database.types';
import { useExamPeriod } from '@/lib/hooks/exam-period-context';
import { useToast } from '@/components/ui/toast';

interface ExamPeriodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ExamPeriodModal({ isOpen, onClose, onSuccess }: ExamPeriodModalProps) {
  const { refetchPeriod } = useExamPeriod();
  const toast = useToast();

  const [mode, setMode] = useState<'standard' | 'bundle'>('standard');
  const [existingDataInfo, setExistingDataInfo] = useState<{
    hasExistingExams: boolean;
    count: number;
    minDate: string | null;
    maxDate: string | null;
  } | null>(null);

  // Standard creation state
  const [name, setName] = useState('');
  const [semesterType, setSemesterType] = useState<SemesterType>('Summer');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [scoreMode, setScoreMode] = useState<ScoreMode>('fresh');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bundle mode state
  const [historicalName, setHistoricalName] = useState('Spring 2026 Final Exams');
  const [summerName, setSummerName] = useState('Summer 2026 Exams');
  const [summerStart, setSummerStart] = useState('');
  const [summerEnd, setSummerEnd] = useState('');
  const [summerScoreMode, setSummerScoreMode] = useState<ScoreMode>('fresh');

  useEffect(() => {
    if (isOpen) {
      // Check if existing exams exist in DB without periods
      fetch('/api/exam-periods/bundle-existing')
        .then(res => res.json())
        .then(data => {
          if (data.hasExistingExams) {
            setExistingDataInfo(data);
            if (data.periodsCount === 0) {
              setMode('bundle'); // Suggest bundle mode if no periods created yet
            }
          }
        })
        .catch(err => console.error('Error checking existing exams:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmitStandard = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please enter a period name');
      return;
    }
    if (!startDate || !endDate) {
      toast.error('Please select start and end dates');
      return;
    }
    if (endDate < startDate) {
      toast.error('End date must be after or equal to start date');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/exam-periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          semester_type: semesterType,
          academic_year: academicYear.trim() || null,
          start_date: startDate,
          end_date: endDate,
          score_mode: scoreMode,
          notes: notes.trim() || null,
          set_active: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create exam period');

      toast.success(
        `Created active period: "${name}"`,
        scoreMode === 'fresh' ? 'Fresh Scores initialized' : 'Continued Scores initialized'
      );
      await refetchPeriod();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error('Failed to create exam period', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitBundle = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!historicalName.trim() || !summerName.trim()) {
      toast.error('Please fill in names for both periods');
      return;
    }
    if (!summerStart || !summerEnd) {
      toast.error('Please select Summer start and end dates');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/exam-periods/bundle-existing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          historical_name: historicalName.trim(),
          historical_start_date: existingDataInfo?.minDate,
          historical_end_date: existingDataInfo?.maxDate,
          summer_name: summerName.trim(),
          summer_start_date: summerStart,
          summer_end_date: summerEnd,
          summer_score_mode: summerScoreMode,
          academic_year: academicYear.trim(),
          notes: 'Bundled existing exams & initialized Summer period',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to bundle and create summer period');

      toast.success('Summer Period Active!', data.message);
      await refetchPeriod();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error('Failed to bundle exams', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-[#00122e] via-[#001f4d] to-[#1527a0] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gold-400/20 rounded-xl border border-gold-400/30 text-gold-400">
              <Sun className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold">Exam Period & Semester Setup</h2>
              <p className="text-xs text-white/70">Create a new period or bundle existing database exams</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Existing Exams Notification Banner */}
        {existingDataInfo?.hasExistingExams && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-900 font-medium">
              <Package className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Found <strong className="font-bold">{existingDataInfo.count} existing exams</strong> ({existingDataInfo.minDate} → {existingDataInfo.maxDate})
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode(mode === 'bundle' ? 'standard' : 'bundle')}
                className="px-2.5 py-1 rounded bg-amber-600 text-white font-bold hover:bg-amber-700 transition-colors"
              >
                {mode === 'bundle' ? 'Use Standard Form' : 'Bundle & Create Summer Period'}
              </button>
            </div>
          </div>
        )}

        {/* Form Body */}
        {mode === 'bundle' ? (
          <form onSubmit={handleSubmitBundle} className="p-6 overflow-y-auto space-y-5 flex-1">
            <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white space-y-2">
              <h3 className="text-sm font-bold flex items-center gap-2 text-gold-300">
                <Package className="w-4 h-4" /> 1. Bundle Existing Database Exams
              </h3>
              <p className="text-xs text-white/70 leading-relaxed">
                Groups all {existingDataInfo?.count || 0} exams currently in the database ({existingDataInfo?.minDate} to {existingDataInfo?.maxDate}) into a historical period so their room assignments and staff scores are preserved.
              </p>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-white/60 mb-1">
                  Historical Period Name
                </label>
                <input
                  type="text"
                  value={historicalName}
                  onChange={e => setHistoricalName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-white/20 bg-white/10 text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-gold-400"
                  required
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-slate-800">
                <Sun className="w-4 h-4 text-gold-500" /> 2. Initialize Summer Exam Period
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Summer Period Name
                  </label>
                  <input
                    type="text"
                    value={summerName}
                    onChange={e => setSummerName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-gold-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    value={academicYear}
                    onChange={e => setAcademicYear(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-gold-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Summer Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={summerStart}
                    onChange={e => setSummerStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-gold-400 bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Summer End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={summerEnd}
                    onChange={e => setSummerEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-gold-400 bg-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Summer Staff Scoring
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`p-3 rounded-lg border cursor-pointer text-xs ${
                      summerScoreMode === 'fresh'
                        ? 'border-gold-500 bg-gold-50/40 font-bold'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="summerScoreMode"
                      checked={summerScoreMode === 'fresh'}
                      onChange={() => setSummerScoreMode('fresh')}
                      className="mr-1.5"
                    />
                    🆕 Start Fresh (0 Scores)
                  </label>
                  <label
                    className={`p-3 rounded-lg border cursor-pointer text-xs ${
                      summerScoreMode === 'continue'
                        ? 'border-blue-500 bg-blue-50/40 font-bold'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="summerScoreMode"
                      checked={summerScoreMode === 'continue'}
                      onChange={() => setSummerScoreMode('continue')}
                      className="mr-1.5"
                    />
                    🔄 Carry Forward Scores
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-gold px-6 py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Bundling & Creating...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" /> Bundle & Activate Summer Period
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmitStandard} className="p-6 overflow-y-auto space-y-5 flex-1">
            {/* Period Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Period Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Summer 2026 Exams"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-gold-400 text-sm font-medium"
                required
              />
            </div>

            {/* Semester Type & Academic Year */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Semester / Exam Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={semesterType}
                  onChange={e => setSemesterType(e.target.value as SemesterType)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-gold-400 text-sm font-medium bg-white"
                >
                  <option value="Summer">Summer Semester</option>
                  <option value="Final">Final Exams</option>
                  <option value="Midterm">Midterm Exams</option>
                  <option value="Fall">Fall Semester</option>
                  <option value="Spring">Spring Semester</option>
                  <option value="Custom">Custom Period</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Academic Year
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2025-2026"
                  value={academicYear}
                  onChange={e => setAcademicYear(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-gold-400 text-sm font-medium"
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-gold-400 text-sm font-medium bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  End Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-gold-400 text-sm font-medium bg-white"
                  required
                />
              </div>
            </div>

            {/* Score Management Strategy */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Staff Scoring Strategy <span className="text-red-500">*</span>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label
                  className={`relative flex flex-col p-4 rounded-xl border cursor-pointer transition-all ${
                    scoreMode === 'fresh'
                      ? 'border-gold-500 bg-gold-50/30 ring-2 ring-gold-400/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <input
                      type="radio"
                      name="scoreMode"
                      value="fresh"
                      checked={scoreMode === 'fresh'}
                      onChange={() => setScoreMode('fresh')}
                      className="text-gold-600 focus:ring-gold-400"
                    />
                    <RotateCcw className="w-4 h-4 text-gold-600" />
                    <span className="text-sm font-bold text-slate-800">Start Fresh Scores</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed pl-6">
                    Reset all staff scores to 0 for this new exam period. Previous scores will be saved in history.
                  </p>
                </label>

                <label
                  className={`relative flex flex-col p-4 rounded-xl border cursor-pointer transition-all ${
                    scoreMode === 'continue'
                      ? 'border-blue-500 bg-blue-50/30 ring-2 ring-blue-400/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <input
                      type="radio"
                      name="scoreMode"
                      value="continue"
                      checked={scoreMode === 'continue'}
                      onChange={() => setScoreMode('continue')}
                      className="text-blue-600 focus:ring-blue-400"
                    />
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-bold text-slate-800">Continue Previous Scores</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed pl-6">
                    Carry forward existing staff workload scores into this new period for continuous fairness tracking.
                  </p>
                </label>
              </div>
            </div>

            {/* Optional Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Notes / Description (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Covers summer term final written and oral exams..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-gold-400 text-sm font-medium"
              />
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-gold px-6 py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Creating Period...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    Create & Activate Period
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
