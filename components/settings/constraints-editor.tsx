'use client';

import React from 'react';
import { 
  AlertTriangle, Check, Clock, CalendarDays, ShieldCheck, 
  Sparkles, Users, Building2, FileText, Scale, Lock, Unlock, 
  Ban, Shield, HelpCircle, ChevronRight, Zap, Beaker, CheckCircle2,
  Sliders, UserCheck, Layers, Info
} from 'lucide-react';
import type { 
  SchedulingConstraintsConfig, 
  StaffAvailabilityPolicy, 
  OralAssignmentMode, 
  ConsecutiveShiftPolicy 
} from '@/types/database.types';
import { 
  StrictOffDaysSvg, 
  FlexibleCapDaysSvg, 
  SmartDatesPrioritySvg,
  ConsecutiveAvoidSvg,
  ConsecutiveStrictSvg,
  ConsecutiveAllowSvg,
  BuildingFloorRoamerSvg,
  StandbyReservesSvg,
  WorkloadFairnessSvg,
  OralPipelineSvg,
  RoleMatchingGateSvg,
  WeeklyHoursBarComparisonSvg
} from './settings-svg-illustrations';

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
    <div className="space-y-8">
      {/* ── 1. Unified Staff Availability & Off-Days Policy ── */}
      <div className="border border-slate-200 rounded-3xl p-6 sm:p-8 bg-white shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="p-2.5 rounded-xl bg-primary-100 text-primary-900 shadow-2xs">
                <CalendarDays className="w-5 h-5 text-primary-600" />
              </span>
              <h3 className="font-display font-extrabold text-slate-900 text-xl tracking-tight">
                Staff Availability &amp; Weekly Off-Days Policy
              </h3>
            </div>
            <p className="text-sm text-slate-500 font-medium">
              Select how the automated assignment engine evaluates staff contract days, weekly off-days, and personal leaves.
            </p>
          </div>
          <span className="text-xs font-extrabold px-3.5 py-1.5 rounded-full bg-primary-50 text-primary-800 border border-primary-200 self-start sm:self-auto">
            Algorithm Core
          </span>
        </div>

        {/* 3 Interactive Cards with Embedded SVGs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Mode 1: Strict Off-Days */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => handlePolicyChange('respect_all_off_days')}
            className={`p-5 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between group ${
              activePolicy === 'respect_all_off_days'
                ? 'border-primary-600 bg-primary-50/25 shadow-md ring-2 ring-primary-500/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <span className="font-display font-extrabold text-base text-slate-900 group-hover:text-primary-700">
                  1. Strict Off-Days
                </span>
                {activePolicy === 'respect_all_off_days' && (
                  <span className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm shadow-xs">
                    <Check className="w-4 h-4" />
                  </span>
                )}
              </div>

              {/* Bespoke SVG Simulation of Strict Off-Days */}
              <div className="mb-4 rounded-xl overflow-hidden border border-slate-200/90 shadow-2xs">
                <StrictOffDaysSvg active={activePolicy === 'respect_all_off_days'} />
              </div>

              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Adheres strictly to staff registered weekly off-days and individual approved leaves. Zero schedule surprises.
              </p>
            </div>

            <div className="mt-5 pt-3.5 border-t border-slate-100 text-xs text-emerald-800 flex items-center gap-2 font-extrabold">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Full Contract Off-Day Protection</span>
            </div>
          </button>

          {/* Mode 2: Flexible (Capped Days/Wk) */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => handlePolicyChange('cap_days_per_week')}
            className={`p-5 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between group ${
              activePolicy === 'cap_days_per_week'
                ? 'border-amber-500 bg-amber-50/25 shadow-md ring-2 ring-amber-500/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <span className="font-display font-extrabold text-base text-slate-900 group-hover:text-amber-800">
                  2. Flexible (Cap Days/Wk)
                </span>
                {activePolicy === 'cap_days_per_week' && (
                  <span className="w-7 h-7 rounded-full bg-amber-600 text-white flex items-center justify-center text-sm shadow-xs">
                    <Check className="w-4 h-4" />
                  </span>
                )}
              </div>

              {/* Bespoke SVG Simulation of Flexible Capped Days */}
              <div className="mb-4 rounded-xl overflow-hidden border border-slate-200/90 shadow-2xs">
                <FlexibleCapDaysSvg active={activePolicy === 'cap_days_per_week'} customDays={config.custom_days_per_week || 5} />
              </div>

              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Bypasses weekly off-days to guarantee full hall coverage, but caps each staff member to N active days/week.
              </p>
            </div>

            <div className="mt-5 pt-3.5 border-t border-slate-100 text-xs text-amber-800 flex items-center gap-2 font-extrabold">
              <Zap className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Capped at {config.custom_days_per_week || 5} days / week</span>
            </div>
          </button>

          {/* Mode 3: Smart Dates Priority */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => handlePolicyChange('smart_dates_priority')}
            className={`p-5 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between group ${
              activePolicy === 'smart_dates_priority'
                ? 'border-indigo-600 bg-indigo-50/25 shadow-md ring-2 ring-indigo-500/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <span className="font-display font-extrabold text-base text-slate-900 group-hover:text-indigo-800">
                  3. Smart Dates Priority
                </span>
                {activePolicy === 'smart_dates_priority' && (
                  <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm shadow-xs">
                    <Check className="w-4 h-4" />
                  </span>
                )}
              </div>

              {/* Bespoke SVG Simulation of Smart Dates Priority */}
              <div className="mb-4 rounded-xl overflow-hidden border border-slate-200/90 shadow-2xs">
                <SmartDatesPrioritySvg active={activePolicy === 'smart_dates_priority'} />
              </div>

              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                If staff have explicit specific leaves recorded, only those exact dates are blocked. Generic patterns yield to exam sessions.
              </p>
            </div>

            <div className="mt-5 pt-3.5 border-t border-slate-100 text-xs text-indigo-800 flex items-center gap-2 font-extrabold">
              <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <span>Explicit Leaves Take Precedence</span>
            </div>
          </button>
        </div>

        {/* Dynamic Days Sub-control: Authoritative Weekly Days Limits */}
        <div className="p-5 bg-amber-50/90 border border-amber-200 rounded-2xl flex flex-col gap-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="max-w-xl">
              <label className="text-sm font-extrabold text-amber-950 block">
                Maximum Active Days Per Week (Full-time Staff)
              </label>
              <p className="text-xs text-amber-800 mt-1 font-medium">
                Strict weekly ceiling for full-time staff. If set to 5 days, the 6th day is strictly prohibited. If set to 4 days, the 5th day is prohibited, and so on.
              </p>
            </div>
            <select
              value={config.custom_days_per_week || 5}
              onChange={(e) => updateConstraint('custom_days_per_week', parseInt(e.target.value, 10))}
              disabled={disabled}
              className="px-4 py-2.5 bg-white border border-amber-300 rounded-xl text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
            >
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <option key={num} value={num}>
                  {num} {num === 1 ? 'day' : 'days'} / week {num === 5 ? '(Recommended)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Part-time Weekly Days Ceiling */}
          <div className="pt-4 border-t border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="max-w-xl">
              <label className="text-sm font-extrabold text-amber-950 block">
                Maximum Working Days Per Week (Part-time Staff)
              </label>
              <p className="text-xs text-amber-800 mt-1 font-medium">
                Strict contractual ceiling for part-time personnel (never relaxed). Standard faculty policy is 2 or 3 days.
              </p>
            </div>
            <select
              value={config.max_days_per_week_pt || 3}
              onChange={(e) => updateConstraint('max_days_per_week_pt', parseInt(e.target.value, 10))}
              disabled={disabled}
              className="px-4 py-2.5 bg-white border border-amber-300 rounded-xl text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
            >
              {[1, 2, 3].map((num) => (
                <option key={num} value={num}>
                  {num} {num === 1 ? 'day' : 'days'} / week {num === 3 ? '(Recommended)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Designated Off-Days Notice */}
          <div className="pt-3 border-t border-amber-200/60 flex items-center gap-2 text-xs text-amber-900 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>
              <strong>Mandatory Designated Off-Days:</strong> Any specific weekday toggled off in the Staff directory (e.g. Tuesday unchecked) is treated as an obligatory, non-negotiable off-day for that staff member.
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. Consecutive Shifts Policy & Daily Cap ── */}
      <div className="border border-slate-200 rounded-3xl p-6 sm:p-8 bg-white shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="p-2.5 rounded-xl bg-indigo-100 text-indigo-900 shadow-2xs">
                <Clock className="w-5 h-5 text-indigo-600" />
              </span>
              <h3 className="font-display font-extrabold text-slate-900 text-xl tracking-tight">
                Consecutive Shifts Policy (Period 1 &amp; Period 2 on Same Day)
              </h3>
            </div>
            <p className="text-sm text-slate-500 font-medium">
              Control whether the scheduler can assign staff back-to-back periods on the same day and set maximum daily shifts.
            </p>
          </div>
        </div>

        {/* 3 Interactive Cards with Embedded SVGs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Avoid */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleConsecutivePolicyChange('avoid')}
            className={`p-5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between group ${
              consecutivePolicy === 'avoid'
                ? 'border-indigo-600 bg-indigo-50/25 shadow-md ring-2 ring-indigo-500/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <span className="font-display font-extrabold text-base text-slate-900 group-hover:text-indigo-800">
                  Avoid (Soft Constraint)
                </span>
                {consecutivePolicy === 'avoid' && (
                  <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm shadow-xs">
                    <Check className="w-4 h-4" />
                  </span>
                )}
              </div>

              {/* Bespoke SVG Simulation */}
              <div className="mb-4 rounded-xl overflow-hidden border border-slate-200/90 shadow-2xs">
                <ConsecutiveAvoidSvg active={consecutivePolicy === 'avoid'} />
              </div>

              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Minimizes consecutive shifts. Algorithm only overrides if necessary to ensure all exam rooms have supervisors.
              </p>
            </div>
            <span className="text-xs font-extrabold text-indigo-700 mt-5 pt-3.5 border-t border-slate-100">
              Recommended Default
            </span>
          </button>

          {/* Strictly Prevent */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleConsecutivePolicyChange('strictly_prevent')}
            className={`p-5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between group ${
              consecutivePolicy === 'strictly_prevent'
                ? 'border-red-500 bg-red-50/25 shadow-md ring-2 ring-red-500/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <span className="font-display font-extrabold text-base text-slate-900 group-hover:text-red-700">
                  Strictly Prevent (Hard Lock)
                </span>
                {consecutivePolicy === 'strictly_prevent' && (
                  <span className="w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center text-sm shadow-xs">
                    <Check className="w-4 h-4" />
                  </span>
                )}
              </div>

              {/* Bespoke SVG Simulation */}
              <div className="mb-4 rounded-xl overflow-hidden border border-slate-200/90 shadow-2xs">
                <ConsecutiveStrictSvg active={consecutivePolicy === 'strictly_prevent'} />
              </div>

              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Never schedules a staff member to both Period 1 and Period 2 on the same day under any circumstances.
              </p>
            </div>
            <span className="text-xs font-extrabold text-red-700 mt-5 pt-3.5 border-t border-slate-100">
              Strict Rest Protection
            </span>
          </button>

          {/* Allow Freely */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleConsecutivePolicyChange('allow')}
            className={`p-5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between group ${
              consecutivePolicy === 'allow'
                ? 'border-emerald-500 bg-emerald-50/25 shadow-md ring-2 ring-emerald-500/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <span className="font-display font-extrabold text-base text-slate-900 group-hover:text-emerald-800">
                  Allow Freely (Unrestricted)
                </span>
                {consecutivePolicy === 'allow' && (
                  <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm shadow-xs">
                    <Check className="w-4 h-4" />
                  </span>
                )}
              </div>

              {/* Bespoke SVG Simulation */}
              <div className="mb-4 rounded-xl overflow-hidden border border-slate-200/90 shadow-2xs">
                <ConsecutiveAllowSvg active={consecutivePolicy === 'allow'} />
              </div>

              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Staff can take both Period 1 and Period 2 whenever needed without penalty. Maximizes exam room throughput.
              </p>
            </div>
            <span className="text-xs font-extrabold text-slate-600 mt-5 pt-3.5 border-t border-slate-100">
              Unrestricted Capacity
            </span>
          </button>
        </div>

        {/* Max Daily Shifts Limit Input */}
        <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div>
            <label className="block text-sm font-extrabold text-slate-900">
              Max Daily Shifts per Staff Member
            </label>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Limits total room invigilations on the same calendar date (Default: 2 shifts). Prevents assigning a 3rd shift to someone while peers have fewer.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={config.max_daily_shifts ?? 2}
              onChange={(e) => updateConstraint('max_daily_shifts', parseInt(e.target.value, 10) || 1)}
              className="input w-28 h-11 bg-white text-center font-extrabold text-base border-slate-300 rounded-xl"
              min={1}
              max={5}
              disabled={disabled}
            />
            <span className="text-sm text-slate-700 font-extrabold whitespace-nowrap">shifts / day</span>
          </div>
        </div>

        {/* Room & Building Proximity for Contiguous Periods */}
        <div className="p-5 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <label className="text-sm font-extrabold text-slate-900">
                Prioritize Same Room & Building for Contiguous Periods (No Cross-Campus Transit)
              </label>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                Zero-Gap Smart Affinity
              </span>
            </div>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              When examination periods start immediately after previous ones (zero or tight gap ≤ 15 min), the engine prioritizes keeping supervisors in the <strong>exact same room</strong> or within the <strong>same building</strong>. Eliminates cross-campus sprinting between distant buildings and removes alphabetical bias.
            </p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.prioritize_room_continuity !== false}
                onChange={(e) => updateConstraint('prioritize_room_continuity', e.target.checked)}
                className="sr-only peer"
                disabled={disabled}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* ── 3. Standby Reserve Staff (Period Free Staff) Roster ── */}
      <div className="border border-slate-200 rounded-3xl p-6 sm:p-8 bg-white shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="p-2.5 rounded-xl bg-emerald-100 text-emerald-900 shadow-2xs">
                <Users className="w-5 h-5 text-emerald-600" />
              </span>
              <h3 className="font-display font-extrabold text-slate-900 text-xl tracking-tight">
                Standby Reserve Staff (Period Free Staff) Architecture
              </h3>
            </div>
            <p className="text-sm text-slate-500 font-medium">
              Configure standby backup invigilators who remain on call to replace absent staff during examination periods.
            </p>
          </div>
          <span className="text-xs font-extrabold px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 self-start sm:self-auto">
            Reserves Engine
          </span>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl">
            <label className="block text-sm font-extrabold text-slate-900 mb-1">
              Standby Head Supervisors (per slot)
            </label>
            <p className="text-xs text-slate-500 mb-3 font-medium">
              Backup Head Supervisors kept on standby for written exams in each period.
            </p>
            <input
              type="number"
              value={config.reserve_supervisors_target ?? 3}
              onChange={(e) => updateConstraint('reserve_supervisors_target', parseInt(e.target.value, 10) || 0)}
              className="input w-full h-11 bg-white text-base font-extrabold rounded-xl border-slate-300"
              min={0}
              max={10}
              disabled={disabled}
            />
          </div>

          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl">
            <label className="block text-sm font-extrabold text-slate-900 mb-1">
              Standby Invigilators / Assistants (per slot)
            </label>
            <p className="text-xs text-slate-500 mb-3 font-medium">
              Backup Demonstrators kept on standby for written exams in each period.
            </p>
            <input
              type="number"
              value={config.reserve_assistants_target ?? 3}
              onChange={(e) => updateConstraint('reserve_assistants_target', parseInt(e.target.value, 10) || 0)}
              className="input w-full h-11 bg-white text-base font-extrabold rounded-xl border-slate-300"
              min={0}
              max={10}
              disabled={disabled}
            />
          </div>

          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl">
            <label className="block text-sm font-extrabold text-slate-900 mb-1">
              Max Weekly Reserve Duties (per staff)
            </label>
            <p className="text-xs text-slate-500 mb-3 font-medium">
              Maximum standby shifts allowed per staff member per week (Default: 2).
            </p>
            <input
              type="number"
              value={config.max_weekly_reserves ?? 2}
              onChange={(e) => updateConstraint('max_weekly_reserves', parseInt(e.target.value, 10) || 1)}
              className="input w-full h-11 bg-white text-base font-extrabold rounded-xl border-slate-300"
              min={1}
              max={10}
              disabled={disabled}
            />
          </div>
        </div>

        {/* Chemist Afternoon Shield Toggle */}
        <label
          className={`flex items-start p-5 bg-emerald-50/60 border border-emerald-200 rounded-2xl cursor-pointer transition-colors ${
            disabled ? 'opacity-60 cursor-not-allowed' : ''
          }`}
        >
          <input
            type="checkbox"
            checked={config.reserve_deprioritize_chemists_p2 !== false}
            onChange={(e) => updateConstraint('reserve_deprioritize_chemists_p2', e.target.checked)}
            className="sr-only"
            disabled={disabled}
          />
          <div
            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center mr-3.5 mt-0.5 flex-shrink-0 ${
              config.reserve_deprioritize_chemists_p2 !== false
                ? 'bg-emerald-600 border-emerald-600'
                : 'border-slate-300 bg-white'
            }`}
          >
            {config.reserve_deprioritize_chemists_p2 !== false && <Check className="w-4 h-4 text-white" />}
          </div>
          <div className="flex-1">
            <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <Beaker className="w-4 h-4 text-emerald-700" />
              <span>Deprioritize Chemists in Period 2 (Afternoon) Reserves</span>
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed font-medium">
              Shields laboratory Chemists from late afternoon standby duties so they remain ready and rested for wet-lab practical exams and laboratory setup.
            </p>
          </div>
        </label>

        {/* Bespoke Architectural SVG Simulation */}
        <StandbyReservesSvg
          supervisorsTarget={config.reserve_supervisors_target ?? 3}
          assistantsTarget={config.reserve_assistants_target ?? 3}
          deprioritizeChemistsP2={config.reserve_deprioritize_chemists_p2 !== false}
          maxWeeklyReserves={config.max_weekly_reserves ?? 2}
        />
      </div>

      {/* ── 4. Committees Supervisor (Roving Floor Roamer) Controls ── */}
      <div className="border border-slate-200 rounded-3xl p-6 sm:p-8 bg-white shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="p-2.5 rounded-xl bg-amber-100 text-amber-900 shadow-2xs">
                <Building2 className="w-5 h-5 text-amber-600" />
              </span>
              <h3 className="font-display font-extrabold text-slate-900 text-xl tracking-tight">
                Committees Supervisor (Floor / Building Roving Supervisor)
              </h3>
            </div>
            <p className="text-sm text-slate-500 font-medium">
              Configure roving supervision capacity, room clustering limits, and maximum physical floor coverage.
            </p>
          </div>
        </div>

        {/* Toggle */}
        <label
          className={`flex items-start p-5 bg-amber-50/60 border border-amber-200 rounded-2xl cursor-pointer transition-colors ${
            disabled ? 'opacity-60 cursor-not-allowed' : ''
          }`}
        >
          <input
            type="checkbox"
            checked={config.require_committees_supervisors !== false}
            onChange={(e) => updateConstraint('require_committees_supervisors', e.target.checked)}
            className="sr-only"
            disabled={disabled}
          />
          <div
            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center mr-3.5 mt-0.5 flex-shrink-0 ${
              config.require_committees_supervisors !== false
                ? 'bg-amber-600 border-amber-600'
                : 'border-slate-300 bg-white'
            }`}
          >
            {config.require_committees_supervisors !== false && <Check className="w-4 h-4 text-white" />}
          </div>
          <div className="flex-1">
            <div className="font-extrabold text-sm text-slate-900">
              Require Committees Supervisors for Exam Blocks
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed font-medium">
              When checked, the engine assigns dedicated senior supervisors to oversee active halls across floors, manage incidents, and coordinate relief.
            </p>
          </div>
        </label>

        {config.require_committees_supervisors !== false && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl">
              <label className="block text-sm font-extrabold text-slate-900 mb-1">
                Max Rooms per Roving Supervisor
              </label>
              <p className="text-xs text-slate-500 mb-3 font-medium">
                Clustering limit: Prevents assigning too many active halls to a single floor supervisor (Recommended: 3–4 rooms).
              </p>
              <input
                type="number"
                value={config.max_rooms_per_lecturer || 3}
                onChange={(e) => updateConstraint('max_rooms_per_lecturer', parseInt(e.target.value, 10) || 1)}
                className="input w-full h-11 bg-white text-base font-extrabold rounded-xl border-slate-300"
                min={1}
                max={8}
                disabled={disabled}
              />
            </div>

            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl">
              <label className="block text-sm font-extrabold text-slate-900 mb-1">
                Max Floors per Roving Supervisor
              </label>
              <p className="text-xs text-slate-500 mb-3 font-medium">
                Vertical travel limit: Restricts vertical roaming so supervisors are not running up and down 4 floors (Recommended: 1–2 floors).
              </p>
              <input
                type="number"
                value={config.max_floors_per_supervisor || 2}
                onChange={(e) => updateConstraint('max_floors_per_supervisor', parseInt(e.target.value, 10) || 1)}
                className="input w-full h-11 bg-white text-base font-extrabold rounded-xl border-slate-300"
                min={1}
                max={5}
                disabled={disabled}
              />
            </div>
          </div>
        )}

        {/* Bespoke Building Cross-Section SVG */}
        <BuildingFloorRoamerSvg
          enabled={config.require_committees_supervisors !== false}
          maxRooms={config.max_rooms_per_lecturer || 3}
          maxFloors={config.max_floors_per_supervisor || 2}
        />
      </div>

      {/* ── 5. Oral Exam Assignment Strategy ── */}
      <div className="border border-slate-200 rounded-3xl p-6 sm:p-8 bg-white shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="p-2.5 rounded-xl bg-blue-100 text-blue-900 shadow-2xs">
                <FileText className="w-5 h-5 text-blue-600" />
              </span>
              <h3 className="font-display font-extrabold text-slate-900 text-xl tracking-tight">
                Oral Exam Assignment Intake Pipeline
              </h3>
            </div>
            <p className="text-sm text-slate-500 font-medium">
              Select how oral examinations are integrated into the automated scheduling execution.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Combined */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateConstraint('oral_exam_assignment_mode', 'combined')}
            className={`p-5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
              oralMode === 'combined'
                ? 'border-blue-600 bg-blue-50/25 shadow-md ring-2 ring-blue-500/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-display font-extrabold text-base text-slate-900">1. Combined (Default)</span>
                {oralMode === 'combined' && (
                  <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm shadow-xs">
                    <Check className="w-4 h-4" />
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Auto-assigns both written and oral exam sessions in the same automated execution pass.
              </p>
            </div>
            <span className="text-xs font-extrabold text-blue-700 mt-4 pt-3 border-t border-slate-100">
              Unified Single Pipeline
            </span>
          </button>

          {/* Separate */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateConstraint('oral_exam_assignment_mode', 'separate')}
            className={`p-5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
              oralMode === 'separate'
                ? 'border-blue-600 bg-blue-50/25 shadow-md ring-2 ring-blue-500/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-display font-extrabold text-base text-slate-900">2. Dedicated Oral Runs</span>
                {oralMode === 'separate' && (
                  <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm shadow-xs">
                    <Check className="w-4 h-4" />
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Oral exams are skipped during standard passes and only resolved when explicitly launching an Oral pass.
              </p>
            </div>
            <span className="text-xs font-extrabold text-slate-600 mt-4 pt-3 border-t border-slate-100">
              Two-Phase Execution
            </span>
          </button>

          {/* Skip */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateConstraint('oral_exam_assignment_mode', 'skip')}
            className={`p-5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
              oralMode === 'skip'
                ? 'border-blue-600 bg-blue-50/25 shadow-md ring-2 ring-blue-500/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-display font-extrabold text-base text-slate-900">3. Skip Oral Exams</span>
                {oralMode === 'skip' && (
                  <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm shadow-xs">
                    <Check className="w-4 h-4" />
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Completely ignores oral exams in auto-assignment (leaves oral invigilation to department coordinators).
              </p>
            </div>
            <span className="text-xs font-extrabold text-slate-600 mt-4 pt-3 border-t border-slate-100">
              Manual Departmental Only
            </span>
          </button>
        </div>

        {/* Bespoke SVG Oral Pipeline */}
        <OralPipelineSvg mode={oralMode} />
      </div>

      {/* ── 6. Role Matching & Workload Fairness ── */}
      <div className="border border-slate-200 rounded-3xl p-6 sm:p-8 bg-white shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="p-2.5 rounded-xl bg-primary-100 text-primary-900 shadow-2xs">
                <Scale className="w-5 h-5 text-primary-600" />
              </span>
              <h3 className="font-display font-extrabold text-slate-900 text-xl tracking-tight">
                Role Strictness &amp; Workload Balancing Fairness
              </h3>
            </div>
            <p className="text-sm text-slate-500 font-medium">
              Prevent staff burnout and ensure equitable duty distribution across all faculty members.
            </p>
          </div>
        </div>

        {/* Strict Role Enforcement */}
        <div className="space-y-4">
          <label
            className={`flex items-start p-5 border rounded-2xl cursor-pointer transition-colors ${
              config.enforce_strict_roles !== false
                ? 'border-primary-300 bg-primary-50/40'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <input
              type="checkbox"
              checked={config.enforce_strict_roles !== false}
              onChange={(e) => updateConstraint('enforce_strict_roles', e.target.checked)}
              className="sr-only"
              disabled={disabled}
            />
            <div
              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center mr-3.5 mt-0.5 flex-shrink-0 ${
                config.enforce_strict_roles !== false
                  ? 'bg-primary-600 border-primary-600'
                  : 'border-slate-300 bg-white'
              }`}
            >
              {config.enforce_strict_roles !== false && <Check className="w-4 h-4 text-white" />}
            </div>
            <div className="flex-1">
              <div className="font-extrabold text-sm text-slate-900">
                Enforce Strict Role Matching
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed font-medium">
                When enabled, only Teaching Assistants can be appointed as Exam Head Supervisors, and only Demonstrators/Chemists can be assigned as Hall Invigilators.
              </p>
            </div>
          </label>

          {/* Role Matching SVG Gate */}
          <RoleMatchingGateSvg enabled={config.enforce_strict_roles !== false} />
        </div>

        {/* Workload Cap Constraint */}
        <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-extrabold text-slate-900">
              Workload Fairness Ceiling (Max Score Delta from Average)
            </label>
            <span className="text-xs font-extrabold text-primary-800 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
              +{config.max_score_delta_from_average ?? 3} points above average
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            If an individual’s assigned shifts exceed the group average by this delta, the algorithm locks them from further assignments until peers receive comparable shifts.
          </p>
          <div className="flex items-center gap-4 pt-1">
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={config.max_score_delta_from_average ?? 3}
              onChange={(e) => updateConstraint('max_score_delta_from_average', parseInt(e.target.value, 10) || 1)}
              className="w-full accent-primary-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
              disabled={disabled}
            />
            <input
              type="number"
              value={config.max_score_delta_from_average ?? 3}
              onChange={(e) => updateConstraint('max_score_delta_from_average', parseInt(e.target.value, 10) || 1)}
              className="input w-24 h-11 text-center text-base font-extrabold bg-white rounded-xl border-slate-300"
              min={1}
              max={15}
              disabled={disabled}
            />
          </div>
        </div>

        {/* Bespoke Workload Balance Scale SVG */}
        <WorkloadFairnessSvg maxDelta={config.max_score_delta_from_average ?? 3} />

        {/* Weekly Hours Caps */}
        <div className="space-y-4 pt-2">
          <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
            Maximum Weekly Hours by Staff Contract Type
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-extrabold text-slate-900">Full-Time Staff</span>
                <span className="text-xs bg-primary-100 text-primary-800 font-extrabold px-2.5 py-0.5 rounded-full">FT</span>
              </div>
              <p className="text-xs text-slate-500 mb-3 font-medium">Standard weekly cap</p>
              <div className="flex items-center gap-2.5">
                <input
                  type="number"
                  value={config.max_hours_per_week_ft || 16}
                  onChange={(e) => updateConstraint('max_hours_per_week_ft', parseInt(e.target.value, 10) || 0)}
                  className="input w-full h-11 bg-white text-base font-extrabold rounded-xl border-slate-300"
                  min={1}
                  max={60}
                  disabled={disabled}
                />
                <span className="text-sm text-slate-700 font-extrabold whitespace-nowrap">hrs/wk</span>
              </div>
            </div>

            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-extrabold text-slate-900">Part-Time Staff</span>
                <span className="text-xs bg-amber-100 text-amber-800 font-extrabold px-2.5 py-0.5 rounded-full">PT</span>
              </div>
              <p className="text-xs text-slate-500 mb-3 font-medium">Pro-rated contract cap</p>
              <div className="flex items-center gap-2.5">
                <input
                  type="number"
                  value={config.max_hours_per_week_pt || 8}
                  onChange={(e) => updateConstraint('max_hours_per_week_pt', parseInt(e.target.value, 10) || 0)}
                  className="input w-full h-11 bg-white text-base font-extrabold rounded-xl border-slate-300"
                  min={1}
                  max={40}
                  disabled={disabled}
                />
                <span className="text-sm text-slate-700 font-extrabold whitespace-nowrap">hrs/wk</span>
              </div>
            </div>

            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-extrabold text-slate-900">Chemists</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full">Lab</span>
              </div>
              <p className="text-xs text-slate-500 mb-3 font-medium">Dedicated laboratory staff</p>
              <div className="flex items-center gap-2.5">
                <input
                  type="number"
                  value={config.max_hours_per_week_chemist || 20}
                  onChange={(e) => updateConstraint('max_hours_per_week_chemist', parseInt(e.target.value, 10) || 0)}
                  className="input w-full h-11 bg-white text-base font-extrabold rounded-xl border-slate-300"
                  min={1}
                  max={60}
                  disabled={disabled}
                />
                <span className="text-sm text-slate-700 font-extrabold whitespace-nowrap">hrs/wk</span>
              </div>
            </div>
          </div>

          {/* Bespoke Weekly Hours SVG Fuel Gauge */}
          <WeeklyHoursBarComparisonSvg
            ftHours={config.max_hours_per_week_ft || 16}
            ptHours={config.max_hours_per_week_pt || 8}
            chemistHours={config.max_hours_per_week_chemist || 20}
          />
        </div>
      </div>
    </div>
  );
}
