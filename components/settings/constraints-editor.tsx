'use client';

import { AlertTriangle, Check, Clock, CalendarDays, ShieldCheck, Sparkles, Users, Building, FileText } from 'lucide-react';
import type { SchedulingConstraintsConfig, StaffAvailabilityPolicy, OralAssignmentMode, ConsecutiveShiftPolicy } from '@/types/database.types';

interface ConstraintsEditorProps {
  config: SchedulingConstraintsConfig;
  onChange: (config: SchedulingConstraintsConfig) => void;
  disabled?: boolean;
}

export function ConstraintsEditor({ config, onChange, disabled }: ConstraintsEditorProps) {
  // Derive active policy seamlessly with fallback to legacy flags
  const activePolicy: StaffAvailabilityPolicy =
    config.availability_policy ||
    (config.ignore_staff_working_days
      ? 'cap_days_per_week'
      : config.ignore_working_days_if_specific_dates
      ? 'smart_dates_priority'
      : 'respect_all_off_days');

  const consecutivePolicy: ConsecutiveShiftPolicy =
    config.consecutive_shifts_policy ||
    (!config.allow_consecutive_shifts ? 'avoid' : 'allow');

  const oralMode: OralAssignmentMode =
    config.oral_exam_assignment_mode || 'combined';

  const updateConstraint = (key: keyof SchedulingConstraintsConfig, value: any) => {
    onChange({
      ...config,
      [key]: value,
    });
  };

  const handlePolicyChange = (policy: StaffAvailabilityPolicy) => {
    onChange({
      ...config,
      availability_policy: policy,
      ignore_staff_working_days: policy === 'cap_days_per_week',
      ignore_working_days_if_specific_dates: policy === 'smart_dates_priority',
      custom_days_per_week: config.custom_days_per_week || 5,
    });
  };

  const handleConsecutivePolicyChange = (policy: ConsecutiveShiftPolicy) => {
    onChange({
      ...config,
      consecutive_shifts_policy: policy,
      allow_consecutive_shifts: policy === 'allow',
    });
  };

  return (
    <div className="space-y-6">
      {/* ── 1. Unified Staff Availability & Off-Days Policy ── */}
      <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm space-y-4">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-semibold text-gray-900 text-base flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary-600" />
              Staff Availability & Off-Days Policy
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Choose how the assignment engine evaluates staff working days, days-off, and individual leave dates.
            </p>
          </div>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-200">
            Unified Policy
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Mode 1: Respect All Off-Days */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => handlePolicyChange('respect_all_off_days')}
            className={`p-4 rounded-lg border-2 text-left transition-all relative flex flex-col justify-between ${
              activePolicy === 'respect_all_off_days'
                ? 'border-primary-600 bg-primary-50/50 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-sm text-gray-900">1. Strict Off-Days</span>
                {activePolicy === 'respect_all_off_days' && (
                  <span className="w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Adheres strictly to staff registered weekly off-days and individual approved leaves. Best for standard semesters with full staff presence.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200/60 text-[11px] text-gray-500 flex items-center gap-1 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Full off-day protection</span>
            </div>
          </button>

          {/* Mode 2: Flexible Availability (Cap Days/Week) */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => handlePolicyChange('cap_days_per_week')}
            className={`p-4 rounded-lg border-2 text-left transition-all relative flex flex-col justify-between ${
              activePolicy === 'cap_days_per_week'
                ? 'border-primary-600 bg-primary-50/50 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-sm text-gray-900">2. Flexible (Cap Days/Wk)</span>
                {activePolicy === 'cap_days_per_week' && (
                  <span className="w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Bypasses weekly off-days to guarantee coverage (e.g. Summer/Midterm), but caps weekly assigned days. Approved leave dates remain strictly protected.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200/60 text-[11px] text-amber-700 flex items-center gap-1 font-medium">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Capped at {config.custom_days_per_week || 5} days / week</span>
            </div>
          </button>

          {/* Mode 3: Smart Dates Priority */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => handlePolicyChange('smart_dates_priority')}
            className={`p-4 rounded-lg border-2 text-left transition-all relative flex flex-col justify-between ${
              activePolicy === 'smart_dates_priority'
                ? 'border-primary-600 bg-primary-50/50 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-sm text-gray-900">3. Smart Dates Priority</span>
                {activePolicy === 'smart_dates_priority' && (
                  <span className="w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                If staff have explicit specific leaves recorded, only those exact dates are blocked (weekly pattern bypassed). Staff without specific leaves follow their weekly grid.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200/60 text-[11px] text-indigo-700 flex items-center gap-1 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Leave dates take precedence</span>
            </div>
          </button>
        </div>

        {/* Dynamic Days-per-week Sub-control for Mode 2 */}
        {activePolicy === 'cap_days_per_week' && (
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg flex items-center justify-between mt-2">
            <div>
              <label className="text-sm font-semibold text-amber-950 block">
                Maximum Days Per Week Per Staff Member
              </label>
              <p className="text-xs text-amber-800">
                Limits the number of unique calendar days a staff member can be scheduled during any exam week.
              </p>
            </div>
            <select
              value={config.custom_days_per_week || 5}
              onChange={(e) => updateConstraint('custom_days_per_week', parseInt(e.target.value, 10))}
              disabled={disabled}
              className="px-3 py-1.5 bg-white border border-amber-300 rounded-md text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
            >
              {[1, 2, 3, 4, 5, 6].map(num => (
                <option key={num} value={num}>
                  {num} {num === 1 ? 'day' : 'days'} / week {num === 5 ? '(Default)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── 2. Consecutive Shifts Policy ── */}
      <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm space-y-4">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-semibold text-gray-900 text-base flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              Consecutive Shifts Policy (Period 1 &amp; Period 2 on Same Day)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Control whether staff can be scheduled for back-to-back exam periods on the same calendar day.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Avoid (Soft) */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleConsecutivePolicyChange('avoid')}
            className={`p-3.5 rounded-lg border-2 text-left transition-all flex flex-col justify-between ${
              consecutivePolicy === 'avoid'
                ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-gray-900">Avoid (Soft Constraint)</span>
                {consecutivePolicy === 'avoid' && (
                  <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600">
                Minimizes consecutive shifts. Algorithm only overrides if necessary to ensure all exam rooms have supervisors.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-indigo-700 mt-2">Recommended</span>
          </button>

          {/* Strictly Prevent (Hard) */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleConsecutivePolicyChange('strictly_prevent')}
            className={`p-3.5 rounded-lg border-2 text-left transition-all flex flex-col justify-between ${
              consecutivePolicy === 'strictly_prevent'
                ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-gray-900">Strictly Prevent (Hard)</span>
                {consecutivePolicy === 'strictly_prevent' && (
                  <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600">
                Never schedules a staff member to both Period 1 and Period 2 on the same day under any circumstances.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-red-600 mt-2">Strict Hard Lock</span>
          </button>

          {/* Allow Freely */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleConsecutivePolicyChange('allow')}
            className={`p-3.5 rounded-lg border-2 text-left transition-all flex flex-col justify-between ${
              consecutivePolicy === 'allow'
                ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-gray-900">Allow Freely</span>
                {consecutivePolicy === 'allow' && (
                  <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600">
                Staff can take both Period 1 and Period 2 whenever needed without penalty.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-gray-500 mt-2">Unrestricted</span>
          </button>
        </div>

        {/* Max Daily Shifts per staff member */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
          <div>
            <label className="block text-sm font-semibold text-gray-900">
              Max Daily Shifts per Staff Member
            </label>
            <p className="text-xs text-gray-500 mt-0.5">
              Limits room invigilation shifts on the same day (default 2). Prevents assigning a 3rd shift to someone while other colleagues have 0 or 1 shift today.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={config.max_daily_shifts ?? 2}
              onChange={(e) => updateConstraint('max_daily_shifts', parseInt(e.target.value, 10) || 1)}
              className="input w-24 bg-white text-center font-bold"
              min={1}
              max={5}
              disabled={disabled}
            />
            <span className="text-xs text-gray-500 font-medium whitespace-nowrap">shifts / day</span>
          </div>
        </div>
      </div>

      {/* ── 3. Standby Reserve Staff (Period Free Staff) Configuration ── */}
      <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm space-y-4">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-semibold text-gray-900 text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              Standby Reserve Staff (Period Free Staff) Configuration
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Set standby quotas for backup invigilators allocated per exam slot.
            </p>
          </div>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Reserves Engine
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Target Standby Exam Supervisors (per slot)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Number of backup Head Supervisors to keep on standby for written exams in each period.
            </p>
            <input
              type="number"
              value={config.reserve_supervisors_target ?? 3}
              onChange={(e) => updateConstraint('reserve_supervisors_target', parseInt(e.target.value, 10) || 0)}
              className="input w-full bg-white"
              min={0}
              max={10}
              disabled={disabled}
            />
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Target Standby Invigilators / Assistants (per slot)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Number of backup Invigilators/Demonstrators to keep on standby for written exams in each period.
            </p>
            <input
              type="number"
              value={config.reserve_assistants_target ?? 3}
              onChange={(e) => updateConstraint('reserve_assistants_target', parseInt(e.target.value, 10) || 0)}
              className="input w-full bg-white"
              min={0}
              max={10}
              disabled={disabled}
            />
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Max Weekly Reserve Duties (per staff)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Maximum standby reserve duties allowed per staff member per week (default: 2). Guarantees equitable rotation.
            </p>
            <input
              type="number"
              value={config.max_weekly_reserves ?? 2}
              onChange={(e) => updateConstraint('max_weekly_reserves', parseInt(e.target.value, 10) || 1)}
              className="input w-full bg-white"
              min={1}
              max={10}
              disabled={disabled}
            />
          </div>
        </div>

        <label className={`flex items-start p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg cursor-pointer ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
          <input
            type="checkbox"
            checked={config.reserve_deprioritize_chemists_p2 !== false}
            onChange={(e) => updateConstraint('reserve_deprioritize_chemists_p2', e.target.checked)}
            className="sr-only"
            disabled={disabled}
          />
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-3 mt-0.5 ${config.reserve_deprioritize_chemists_p2 !== false ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300 bg-white'}`}>
            {config.reserve_deprioritize_chemists_p2 !== false && <Check className="w-3 h-3 text-white" />}
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm text-gray-900">Deprioritize Chemists in Period 2 Reserves</div>
            <p className="text-xs text-gray-600 mt-0.5">
              Shields Chemists from late afternoon standby duties during Final exam weeks so they remain available for laboratory exams.
            </p>
          </div>
        </label>
      </div>

      {/* ── 4. Committees Supervisor (Roving Floor Roamer) Controls ── */}
      <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm space-y-4">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-semibold text-gray-900 text-base flex items-center gap-2">
              <Building className="w-5 h-5 text-amber-600" />
              Committees Supervisor (Floor / Building Roving Supervisor)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Configure roving supervision capacity, room clustering, and floor roaming limits.
            </p>
          </div>
        </div>

        <label className={`flex items-start p-3 bg-amber-50/50 border border-amber-200 rounded-lg cursor-pointer ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
          <input
            type="checkbox"
            checked={config.require_committees_supervisors !== false}
            onChange={(e) => updateConstraint('require_committees_supervisors', e.target.checked)}
            className="sr-only"
            disabled={disabled}
          />
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-3 mt-0.5 ${config.require_committees_supervisors !== false ? 'bg-amber-600 border-amber-600' : 'border-gray-300 bg-white'}`}>
            {config.require_committees_supervisors !== false && <Check className="w-3 h-3 text-white" />}
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm text-gray-900">Require Committees Supervisors for Exam Blocks</div>
            <p className="text-xs text-gray-600 mt-0.5">
              When checked, the scheduler assigns dedicated roving Committees Supervisors across buildings and floors during written exams.
            </p>
          </div>
        </label>

        {config.require_committees_supervisors !== false && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Max Rooms per Supervisor</label>
              <input
                type="number"
                value={config.max_rooms_per_lecturer || 3}
                onChange={(e) => updateConstraint('max_rooms_per_lecturer', parseInt(e.target.value, 10) || 1)}
                className="input w-full"
                min={1}
                max={8}
                disabled={disabled}
              />
              <p className="text-xs text-gray-500 mt-1">Recommended: 3-4 rooms</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Max Floors per Supervisor</label>
              <input
                type="number"
                value={config.max_floors_per_supervisor || 2}
                onChange={(e) => updateConstraint('max_floors_per_supervisor', parseInt(e.target.value, 10) || 1)}
                className="input w-full"
                min={1}
                max={5}
                disabled={disabled}
              />
              <p className="text-xs text-gray-500 mt-1">Recommended: 1-2 floors</p>
            </div>
          </div>
        )}
      </div>

      {/* ── 5. Oral Exam Assignment Strategy ── */}
      <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm space-y-4">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-semibold text-gray-900 text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Oral Exam Assignment Integration
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Choose how oral exams are treated during auto-assignment runs.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Combined */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateConstraint('oral_exam_assignment_mode', 'combined')}
            className={`p-3.5 rounded-lg border-2 text-left transition-all flex flex-col justify-between ${
              oralMode === 'combined'
                ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-gray-900">Combined (Default)</span>
                {oralMode === 'combined' && (
                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600">
                Auto-assigns both written and oral exam sessions in the same automated execution pass.
              </p>
            </div>
          </button>

          {/* Separate */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateConstraint('oral_exam_assignment_mode', 'separate')}
            className={`p-3.5 rounded-lg border-2 text-left transition-all flex flex-col justify-between ${
              oralMode === 'separate'
                ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-gray-900">Dedicated Oral Runs</span>
                {oralMode === 'separate' && (
                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600">
                Oral exams are skipped during standard runs and only scheduled when running an Oral Exam pass.
              </p>
            </div>
          </button>

          {/* Skip */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateConstraint('oral_exam_assignment_mode', 'skip')}
            className={`p-3.5 rounded-lg border-2 text-left transition-all flex flex-col justify-between ${
              oralMode === 'skip'
                ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-gray-900">Skip Oral Exams</span>
                {oralMode === 'skip' && (
                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600">
                Completely excludes oral exams from auto-assignment (leaves them for manual or departmental assignment).
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* ── 6. Role Matching & Workload Fairness ── */}
      <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm space-y-4">
        <h3 className="font-semibold text-gray-900 text-base border-b border-slate-100 pb-3 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary-600" />
          Role Matching &amp; Workload Balancing Limits
        </h3>

        {/* Strict Role Enforcement */}
        <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${config.enforce_strict_roles !== false ? 'border-primary-300 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
          <input
            type="checkbox"
            checked={config.enforce_strict_roles !== false}
            onChange={(e) => updateConstraint('enforce_strict_roles', e.target.checked)}
            className="sr-only"
            disabled={disabled}
          />
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-3 mt-0.5 ${config.enforce_strict_roles !== false ? 'bg-primary-600 border-primary-600' : 'border-gray-300 bg-white'
            }`}>
            {config.enforce_strict_roles !== false && <Check className="w-3 h-3 text-white" />}
          </div>
          <div className="flex-1">
            <div className="font-medium text-gray-900">Enforce Strict Role Matching</div>
            <p className="text-xs text-gray-600 mt-0.5">
              If enabled, only Teaching Assistants can be Exam Supervisors, and only Chemists/Demonstrators can be Invigilators.
            </p>
          </div>
        </label>

        {/* Hard Workload Cap Constraint (Fairness) */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="w-4 h-4 text-indigo-500" />
            <h4 className="font-semibold text-sm text-gray-900">Hard Workload Cap (Fairness)</h4>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            Prevents staff from exceeding a maximum score difference from the average. If staff reaches average + delta, they are locked out until peers catch up.
          </p>
          <div className="w-full md:w-1/3">
            <input
              type="number"
              value={config.max_score_delta_from_average ?? 3}
              onChange={(e) => updateConstraint('max_score_delta_from_average', parseInt(e.target.value, 10) || 3)}
              className="input w-full bg-white"
              min={1}
              max={15}
              disabled={disabled}
            />
          </div>
        </div>

        {/* Weekly Hours */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Full-time Cap (Hours/Wk)</label>
            <input
              type="number"
              value={config.max_hours_per_week_ft || 16}
              onChange={(e) => updateConstraint('max_hours_per_week_ft', parseInt(e.target.value, 10) || 0)}
              className="input w-full bg-white"
              min={1}
              max={60}
              disabled={disabled}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Part-time Cap (Hours/Wk)</label>
            <input
              type="number"
              value={config.max_hours_per_week_pt || 8}
              onChange={(e) => updateConstraint('max_hours_per_week_pt', parseInt(e.target.value, 10) || 0)}
              className="input w-full bg-white"
              min={1}
              max={40}
              disabled={disabled}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Chemists Cap (Hours/Wk)</label>
            <input
              type="number"
              value={config.max_hours_per_week_chemist || 20}
              onChange={(e) => updateConstraint('max_hours_per_week_chemist', parseInt(e.target.value, 10) || 0)}
              className="input w-full bg-white"
              min={1}
              max={60}
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      {/* ── 7. Policy Summary ── */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
          Live Rules &amp; Policy Summary:
        </div>
        <ul className="text-xs text-gray-700 space-y-1.5">
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-primary-600" />
            <span>
              Availability: <strong>
                {activePolicy === 'respect_all_off_days'
                  ? 'Strict Off-Days (Registered off-days & leaves respected)'
                  : activePolicy === 'cap_days_per_week'
                  ? `Flexible Availability (Weekly off-days bypassed, max ${config.custom_days_per_week || 5} days/wk)`
                  : 'Smart Dates Priority (Leave dates override weekly schedule)'}
              </strong>
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-primary-600" />
            <span>
              Consecutive Shifts:{' '}
              <strong>
                {consecutivePolicy === 'avoid'
                  ? 'Avoided (Soft Constraint)'
                  : consecutivePolicy === 'strictly_prevent'
                  ? 'Strictly Prevented (Hard Lockout)'
                  : 'Allowed Freely'}
              </strong>
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-primary-600" />
            <span>
              Standby Reserves Target: <strong>{config.reserve_supervisors_target ?? 3} Supervisors</strong>, <strong>{config.reserve_assistants_target ?? 3} Invigilators</strong> per slot
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-primary-600" />
            <span>
              Committees Supervisors:{' '}
              <strong>
                {config.require_committees_supervisors !== false
                  ? `Enabled (Max ${config.max_rooms_per_lecturer || 3} rooms, Max ${config.max_floors_per_supervisor || 2} floors)`
                  : 'Disabled'}
              </strong>
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-primary-600" />
            <span>
              Oral Exams Mode: <strong>{oralMode === 'combined' ? 'Combined with written' : oralMode === 'separate' ? 'Separate pass only' : 'Skipped'}</strong>
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-primary-600" />
            <span>
              Workload Delta Cap: <strong>{config.max_score_delta_from_average ?? 3} points</strong> above group average
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
