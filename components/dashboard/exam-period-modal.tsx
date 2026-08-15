'use client';

import React, { useState } from 'react';
import { X, Calendar, RefreshCw, Play, RotateCcw, AlertTriangle, Layers, BookOpen } from 'lucide-react';
import { SemesterType, ScoreMode, ExamPeriod } from '@/types/database.types';
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

  const [name, setName] = useState('');
  const [semesterType, setSemesterType] = useState<SemesterType>('Final');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [scoreMode, setScoreMode] = useState<ScoreMode>('fresh');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
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
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create exam period');
      }

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


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-[#00122e] via-[#001f4d] to-[#1527a0] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gold-400/20 rounded-xl border border-gold-400/30 text-gold-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold">Create Exam Period & Semester</h2>
              <p className="text-xs text-white/70">Set up a new examination cycle and scope app metrics & scores</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Period Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Period Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Final Written Exams - Fall 2026"
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
                <option value="Final">Final Exams</option>
                <option value="Midterm">Midterm Exams</option>
                <option value="Fall">Fall Semester</option>
                <option value="Spring">Spring Semester</option>
                <option value="Summer">Summer Semester</option>
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
              {/* Option 1: Start Fresh */}
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

              {/* Option 2: Continue Scores */}
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
              placeholder="e.g. Covers all departments for semester 1 written final exams..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-gold-400 text-sm font-medium"
            />
          </div>

          {/* Warning Banner */}
          <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              Activating this period will scope all app views, exam sessions, assignments, and workload stats to the selected date range (<span className="font-semibold">{startDate || 'Start'} to {endDate || 'End'}</span>).
            </p>
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
      </div>
    </div>
  );
}
