'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, RefreshCw, Play, RotateCcw, AlertTriangle, Layers, Sun, CheckCircle2, Package, Pencil, Check } from 'lucide-react';
import { SemesterType, ScoreMode, StaffAvailabilityPolicy, OralAssignmentMode } from '@/types/database.types';
import { useExamPeriod } from '@/lib/hooks/exam-period-context';
import { useToast } from '@/components/ui/toast';

interface ExamPeriodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: 'standard' | 'bundle' | 'manage';
  initialEditPeriodId?: string | null;
}

interface EditPeriodForm {
  id: string;
  name: string;
  semester_type: SemesterType;
  academic_year: string;
  start_date: string;
  end_date: string;
  availability_policy: StaffAvailabilityPolicy;
  oral_exam_assignment_mode: OralAssignmentMode;
  reserve_supervisors_target: number;
  reserve_assistants_target: number;
  ignore_staff_working_days: boolean;
  custom_days_per_week: number;
}

export function ExamPeriodModal({
  isOpen,
  onClose,
  onSuccess,
  initialMode,
  initialEditPeriodId,
}: ExamPeriodModalProps) {
  const { refetchPeriod, allPeriods, activePeriod, activatePeriod } = useExamPeriod();
  const toast = useToast();

  const [mode, setMode] = useState<'standard' | 'bundle' | 'manage'>(initialMode || 'standard');
  const [existingDataInfo, setExistingDataInfo] = useState<{
    hasExistingExams: boolean;
    count: number;
    minDate: string | null;
    maxDate: string | null;
  } | null>(null);

  // Edit / Rename state
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(initialEditPeriodId || null);
  const [editForm, setEditForm] = useState<EditPeriodForm | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Standard creation state
  const [name, setName] = useState('');
  const [semesterType, setSemesterType] = useState<SemesterType>('Summer');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [scoreMode, setScoreMode] = useState<ScoreMode>('fresh');
  const [notes, setNotes] = useState('');
  const [availabilityPolicy, setAvailabilityPolicy] = useState<StaffAvailabilityPolicy>('respect_all_off_days');
  const [oralExamAssignmentMode, setOralExamAssignmentMode] = useState<OralAssignmentMode>('combined');
  const [reserveSupervisorsTarget, setReserveSupervisorsTarget] = useState(3);
  const [reserveAssistantsTarget, setReserveAssistantsTarget] = useState(3);
  const [ignoreStaffWorkingDays, setIgnoreStaffWorkingDays] = useState(false);
  const [customDaysPerWeek, setCustomDaysPerWeek] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bundle mode state
  const [historicalName, setHistoricalName] = useState('Spring 2026 Final Exams');
  const [summerName, setSummerName] = useState('Summer 2026 Exams');
  const [summerStart, setSummerStart] = useState('');
  const [summerEnd, setSummerEnd] = useState('');
  const [summerScoreMode, setSummerScoreMode] = useState<ScoreMode>('fresh');

  const startEditing = (period: any) => {
    const policy: StaffAvailabilityPolicy =
      period.availability_policy ||
      (period.ignore_staff_working_days ? 'cap_days_per_week' : 'respect_all_off_days');

    setEditingPeriodId(period.id);
    setEditForm({
      id: period.id,
      name: period.name || '',
      semester_type: period.semester_type || 'Summer',
      academic_year: period.academic_year || '2025-2026',
      start_date: period.start_date || '',
      end_date: period.end_date || '',
      availability_policy: policy,
      oral_exam_assignment_mode: period.oral_exam_assignment_mode || 'combined',
      reserve_supervisors_target: period.reserve_supervisors_target ?? 3,
      reserve_assistants_target: period.reserve_assistants_target ?? 3,
      ignore_staff_working_days: policy === 'cap_days_per_week',
      custom_days_per_week: Number(period.custom_days_per_week) || 5,
    });
  };

  useEffect(() => {
    if (isOpen) {
      if (initialMode) {
        setMode(initialMode);
      }
      if (initialEditPeriodId) {
        const target = allPeriods.find(p => p.id === initialEditPeriodId);
        if (target) {
          startEditing(target);
        }
      }
      // Check if existing exams exist in DB without periods
      fetch('/api/exam-periods/bundle-existing')
        .then(res => res.json())
        .then(data => {
          if (data.hasExistingExams) {
            setExistingDataInfo(data);
            if (data.periodsCount === 0 && !initialMode) {
              setMode('bundle'); // Suggest bundle mode if no periods created yet
            }
          }
        })
        .catch(err => console.error('Error checking existing exams:', err));
    } else {
      setEditingPeriodId(null);
      setEditForm(null);
    }
  }, [isOpen, initialMode, initialEditPeriodId, allPeriods]);

  if (!isOpen) return null;

  const handleSavePeriodEdit = async (periodId: string) => {
    if (!editForm) return;

    if (!editForm.name.trim()) {
      toast.error('Period name cannot be empty');
      return;
    }
    if (!editForm.start_date || !editForm.end_date) {
      toast.error('Please select both start and end dates');
      return;
    }
    if (editForm.end_date < editForm.start_date) {
      toast.error('End date must be after or equal to start date');
      return;
    }

    try {
      setIsSavingEdit(true);
      const res = await fetch('/api/exam-periods', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: periodId,
          name: editForm.name.trim(),
          semester_type: editForm.semester_type,
          academic_year: editForm.academic_year?.trim() || null,
          start_date: editForm.start_date,
          end_date: editForm.end_date,
          availability_policy: editForm.availability_policy,
          oral_exam_assignment_mode: editForm.oral_exam_assignment_mode,
          reserve_supervisors_target: editForm.reserve_supervisors_target,
          reserve_assistants_target: editForm.reserve_assistants_target,
          ignore_staff_working_days: editForm.availability_policy === 'cap_days_per_week',
          custom_days_per_week: editForm.custom_days_per_week,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update exam period details');

      toast.success(
        `Updated "${editForm.name.trim()}"`,
        editForm.availability_policy === 'cap_days_per_week'
          ? `Flexible mode (Max ${editForm.custom_days_per_week} days/week)`
          : editForm.availability_policy === 'smart_dates_priority'
          ? 'Smart dates priority'
          : 'Strict off-days'
      );
      setEditingPeriodId(null);
      setEditForm(null);
      await refetchPeriod();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error('Failed to update period', err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

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
          availability_policy: availabilityPolicy,
          oral_exam_assignment_mode: oralExamAssignmentMode,
          reserve_supervisors_target: reserveSupervisorsTarget,
          reserve_assistants_target: reserveAssistantsTarget,
          ignore_staff_working_days: availabilityPolicy === 'cap_days_per_week',
          custom_days_per_week: customDaysPerWeek,
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setMode('standard')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              mode === 'standard'
                ? 'border-gold-500 text-slate-900 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" /> Create New Period
          </button>
          
          <button
            type="button"
            onClick={() => setMode('manage')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              mode === 'manage'
                ? 'border-gold-500 text-slate-900 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Pencil className="w-3.5 h-3.5" /> Manage &amp; Edit Periods ({allPeriods.length})
          </button>

          {existingDataInfo?.hasExistingExams && (
            <button
              type="button"
              onClick={() => setMode('bundle')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                mode === 'bundle'
                  ? 'border-gold-500 text-slate-900 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Package className="w-3.5 h-3.5" /> Bundle Database Exams
            </button>
          )}
        </div>

        {/* Existing Exams Notification Banner */}
        {existingDataInfo?.hasExistingExams && mode !== 'bundle' && (
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
                onClick={() => setMode('bundle')}
                className="px-2.5 py-1 rounded bg-amber-600 text-white font-bold hover:bg-amber-700 transition-colors"
              >
                Bundle Existing Exams
              </button>
            </div>
          </div>
        )}

        {/* Form Body */}
        {mode === 'manage' ? (
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">All Created Exam Periods</h3>
                <p className="text-xs text-slate-500">Edit period details, date ranges, and off-days rules, or switch the active period</p>
              </div>
              <button
                type="button"
                onClick={() => setMode('standard')}
                className="btn btn-gold px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm cursor-pointer"
              >
                + New Period
              </button>
            </div>

            {allPeriods.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200">
                <Calendar className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No exam periods created yet</p>
                <p className="text-xs text-slate-500 mt-1">Click &quot;Create New Period&quot; above to create one.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allPeriods.map((period) => {
                  const isEditingThis = editingPeriodId === period.id;

                  return (
                    <div
                      key={period.id}
                      className={`p-4 rounded-xl border transition-all ${
                        period.is_active
                          ? 'border-gold-400/80 bg-gold-50/20 shadow-sm ring-1 ring-gold-400/30'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {isEditingThis && editForm ? (
                        <div className="space-y-4 animate-fadeIn">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                              <span className="p-1.5 bg-gold-100 text-gold-700 rounded-lg">
                                <Pencil className="w-4 h-4" />
                              </span>
                              <h4 className="text-sm font-bold text-slate-900">
                                Edit Period Details &amp; Working Days Rule
                              </h4>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              period.is_active
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {period.is_active ? 'Active Period' : 'Inactive'}
                            </span>
                          </div>

                          {/* Row 1: Name and Semester Type */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Period Name <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-gold-500 text-xs font-bold text-slate-900 bg-white shadow-xs"
                                placeholder="e.g. Summer 2026 Exams"
                                autoFocus
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Semester / Exam Type <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={editForm.semester_type}
                                onChange={(e) => setEditForm({ ...editForm, semester_type: e.target.value as SemesterType })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-gold-500 text-xs font-medium text-slate-900 bg-white"
                              >
                                <option value="Summer">Summer Semester</option>
                                <option value="Final">Final Exams</option>
                                <option value="Midterm">Midterm Exams</option>
                                <option value="Fall">Fall Semester</option>
                                <option value="Spring">Spring Semester</option>
                                <option value="Custom">Custom Period</option>
                              </select>
                            </div>
                          </div>

                          {/* Row 2: Academic Year & Dates */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Academic Year
                              </label>
                              <input
                                type="text"
                                value={editForm.academic_year}
                                onChange={(e) => setEditForm({ ...editForm, academic_year: e.target.value })}
                                placeholder="e.g. 2025-2026"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-gold-500 text-xs font-medium text-slate-900 bg-white"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Start Date <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="date"
                                value={editForm.start_date}
                                onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-gold-500 text-xs font-medium text-slate-900 bg-white"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                End Date <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="date"
                                value={editForm.end_date}
                                onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-gold-500 text-xs font-medium text-slate-900 bg-white"
                              />
                            </div>
                          </div>

                          {/* Row 3: Staff Working Days Policy */}
                          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                              Staff Availability Policy for this Period
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <button
                                type="button"
                                onClick={() => setEditForm({
                                  ...editForm,
                                  availability_policy: 'respect_all_off_days',
                                  ignore_staff_working_days: false,
                                })}
                                className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                                  editForm.availability_policy === 'respect_all_off_days'
                                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                                }`}
                              >
                                <div className="font-bold flex items-center justify-between">
                                  <span>Strict Off-Days</span>
                                  {editForm.availability_policy === 'respect_all_off_days' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                                </div>
                                <div className="text-[10px] text-slate-500 mt-0.5">Adhere to weekly off-days</div>
                              </button>

                              <button
                                type="button"
                                onClick={() => setEditForm({
                                  ...editForm,
                                  availability_policy: 'cap_days_per_week',
                                  ignore_staff_working_days: true,
                                })}
                                className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                                  editForm.availability_policy === 'cap_days_per_week'
                                    ? 'border-amber-600 bg-amber-50 text-amber-900 font-semibold'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                                }`}
                              >
                                <div className="font-bold flex items-center justify-between">
                                  <span>Flexible (Cap Days/Wk)</span>
                                  {editForm.availability_policy === 'cap_days_per_week' && <Check className="w-3.5 h-3.5 text-amber-600" />}
                                </div>
                                <div className="text-[10px] text-slate-500 mt-0.5">Bypass weekly off-days</div>
                              </button>

                              <button
                                type="button"
                                onClick={() => setEditForm({
                                  ...editForm,
                                  availability_policy: 'smart_dates_priority',
                                  ignore_staff_working_days: false,
                                })}
                                className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                                  editForm.availability_policy === 'smart_dates_priority'
                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                                }`}
                              >
                                <div className="font-bold flex items-center justify-between">
                                  <span>Leave Dates Priority</span>
                                  {editForm.availability_policy === 'smart_dates_priority' && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                                </div>
                                <div className="text-[10px] text-slate-500 mt-0.5">Specific leaves override</div>
                              </button>
                            </div>

                            {editForm.availability_policy === 'cap_days_per_week' && (
                              <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between">
                                <div>
                                  <label className="text-xs font-bold text-slate-700 block">
                                    Max Days Per Week Per Staff
                                  </label>
                                  <span className="text-[10px] text-slate-500">
                                    Auto-assignment will not schedule any staff more than this number of days per week.
                                  </span>
                                </div>
                                <select
                                  value={editForm.custom_days_per_week}
                                  onChange={(e) => setEditForm({ ...editForm, custom_days_per_week: parseInt(e.target.value, 10) })}
                                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-gold-500"
                                >
                                  {[1, 2, 3, 4, 5, 6].map(num => (
                                    <option key={num} value={num}>
                                      {num} {num === 1 ? 'day' : 'days'} / week {num === 3 ? '(Recommended)' : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          {/* Row 4: Oral Exams & Standby Reserves */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                            <div>
                              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1">
                                Oral Exams Integration
                              </label>
                              <select
                                value={editForm.oral_exam_assignment_mode || 'combined'}
                                onChange={(e) => setEditForm({ ...editForm, oral_exam_assignment_mode: e.target.value as OralAssignmentMode })}
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-gold-500"
                              >
                                <option value="combined">Combined with written exams</option>
                                <option value="separate">Dedicated oral runs only</option>
                                <option value="skip">Skip oral auto-assignment</option>
                              </select>
                            </div>

                            <div className="flex gap-2">
                              <div className="flex-1">
                                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1">
                                  Standby Supervisors
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  max={10}
                                  value={editForm.reserve_supervisors_target ?? 3}
                                  onChange={(e) => setEditForm({ ...editForm, reserve_supervisors_target: parseInt(e.target.value, 10) || 0 })}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-gold-500"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1">
                                  Standby Assistants
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  max={10}
                                  value={editForm.reserve_assistants_target ?? 3}
                                  onChange={(e) => setEditForm({ ...editForm, reserve_assistants_target: parseInt(e.target.value, 10) || 0 })}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-gold-500"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Footer Actions */}
                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPeriodId(null);
                                setEditForm(null);
                              }}
                              disabled={isSavingEdit}
                              className="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={isSavingEdit}
                              onClick={() => handleSavePeriodEdit(period.id)}
                              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {isSavingEdit ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving Changes...
                                </>
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5" /> Save Changes
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-900 text-base truncate">
                                {period.name}
                              </h4>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-500">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                period.is_active
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {period.is_active ? 'Active Period' : 'Inactive'}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                {period.semester_type === 'Midterm' ? 'Midterm (Written Only)' : `${period.semester_type} Semester`}
                              </span>
                              {period.academic_year && (
                                <span className="text-slate-400">({period.academic_year})</span>
                              )}
                              <span className="font-mono text-slate-600 ml-1">
                                📅 {period.start_date} → {period.end_date}
                              </span>
                              {period.availability_policy === 'cap_days_per_week' || period.ignore_staff_working_days ? (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-semibold flex items-center gap-1">
                                  ⚡ Flexible (Max {period.custom_days_per_week || 5}d/wk)
                                </span>
                              ) : period.availability_policy === 'smart_dates_priority' ? (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold flex items-center gap-1">
                                  ✨ Leave Dates Priority
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold flex items-center gap-1">
                                  🛡️ Strict Off-Days
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                            <button
                              type="button"
                              onClick={() => startEditing(period)}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5 text-slate-500" />
                              Edit Details &amp; Rules
                            </button>
                            {!period.is_active && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await activatePeriod(period.id);
                                  toast.success(`Activated period: "${period.name}"`);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-sm cursor-pointer"
                              >
                                Activate
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : mode === 'bundle' ? (
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

            {/* Midterm Specific Rules Callout */}
            {semesterType === 'Midterm' && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold mb-0.5">Midterm Mode Rules: Written Exams Only (No Oral)</strong>
                  Oral exam sessions are strictly excluded from assignments. Written ratios (Head Supervisor + Assistants) and Committees Supervisors are applied.
                </div>
              </div>
            )}

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

            {/* Staff Working Days Rule */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Staff Availability Policy for this Period
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAvailabilityPolicy('respect_all_off_days');
                    setIgnoreStaffWorkingDays(false);
                  }}
                  className={`p-3 rounded-lg border text-left text-xs transition-colors ${
                    availabilityPolicy === 'respect_all_off_days'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>1. Strict Off-Days</span>
                    {availabilityPolicy === 'respect_all_off_days' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Full adherence to weekly off-days</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAvailabilityPolicy('cap_days_per_week');
                    setIgnoreStaffWorkingDays(true);
                  }}
                  className={`p-3 rounded-lg border text-left text-xs transition-colors ${
                    availabilityPolicy === 'cap_days_per_week'
                      ? 'border-amber-600 bg-amber-50 text-amber-900 font-semibold'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>2. Flexible (Cap Days/Wk)</span>
                    {availabilityPolicy === 'cap_days_per_week' && <Check className="w-3.5 h-3.5 text-amber-600" />}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Bypass weekly off-days, cap days/wk</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAvailabilityPolicy('smart_dates_priority');
                    setIgnoreStaffWorkingDays(false);
                  }}
                  className={`p-3 rounded-lg border text-left text-xs transition-colors ${
                    availabilityPolicy === 'smart_dates_priority'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>3. Leave Dates Priority</span>
                    {availabilityPolicy === 'smart_dates_priority' && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Specific leave dates override</div>
                </button>
              </div>

              {availabilityPolicy === 'cap_days_per_week' && (
                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block">
                      Max Days Per Week Per Staff
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Enforce a weekly assignment day cap per person
                    </span>
                  </div>
                  <select
                    value={customDaysPerWeek}
                    onChange={e => setCustomDaysPerWeek(parseInt(e.target.value, 10))}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-gold-500"
                  >
                    {[1, 2, 3, 4, 5, 6].map(num => (
                      <option key={num} value={num}>
                        {num} {num === 1 ? 'day' : 'days'} / week {num === 3 ? '(Recommended)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Oral Exams & Standby Reserves Rule */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1">
                  Oral Exams Integration
                </label>
                <select
                  value={oralExamAssignmentMode}
                  onChange={(e) => setOralExamAssignmentMode(e.target.value as OralAssignmentMode)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-gold-500"
                >
                  <option value="combined">Combined with written exams</option>
                  <option value="separate">Dedicated oral runs only</option>
                  <option value="skip">Skip oral auto-assignment</option>
                </select>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1">
                    Standby Supervisors
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={reserveSupervisorsTarget}
                    onChange={(e) => setReserveSupervisorsTarget(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1">
                    Standby Assistants
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={reserveAssistantsTarget}
                    onChange={(e) => setReserveAssistantsTarget(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>
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
