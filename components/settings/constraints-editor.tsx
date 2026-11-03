'use client';

import React, { useState } from 'react';
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
  AvailabilityPolicyVisual, 
  ConsecutiveShiftsVisual, 
  FloorRoamerVisual, 
  StandbyReservesVisual, 
  WorkloadFairnessVisual 
} from './settings-visuals';

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
      <div className="border border-slate-200 rounded-2xl p-6 bg-white shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-display font-bold text-slate-900 text-lg flex items-center gap-2.5">
              <span className="p-1.5 rounded-xl bg-primary-100 text-primary-800">
                <CalendarDays className="w-5 h-5 text-primary-600" />
              </span>
              Staff Availability &amp; Weekly Off-Days Policy
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Select how the automated assignment engine treats staff contract working days, regular days off, and approved personal leave.
            </p>
          </div>
          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-primary-50 text-primary-800 border border-primary-200 self-start sm:self-auto">
            Algorithm Core
          </span>
        </div>

        {/* 3 Policy Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Mode 1: Respect All Off-Days */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => handlePolicyChange('respect_all_off_days')}
            className={`p-4 rounded-xl border-2 text-left transition-all relative flex flex-col justify-between ${
              activePolicy === 'respect_all_off_days'
                ? 'border-primary-600 bg-primary-50/40 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-slate-900">1. Strict Off-Days</span>
                {activePolicy === 'respect_all_off_days' && (
                  <span className="w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs shadow-xs">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Adheres strictly to staff registered weekly off-days and individual approved leaves. Zero schedule surprises.
              </p>
            </div>
            <div className="mt-4 pt-2.5 border-t border-slate-200/80 text-[11px] text-emerald-800 flex items-center gap-1.5 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Full off-day contract protection</span>
            </div>
          </button>

          {/* Mode 2: Flexible Availability (Cap Days/Week) */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => handlePolicyChange('cap_days_per_week')}
            className={`p-4 rounded-xl border-2 text-left transition-all relative flex flex-col justify-between ${
              activePolicy === 'cap_days_per_week'
                ? 'border-amber-500 bg-amber-50/40 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-slate-900">2. Flexible (Capped Days/Wk)</span>
                {activePolicy === 'cap_days_per_week' && (
                  <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs shadow-xs">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Bypasses weekly off-days to guarantee full hall coverage, but caps each staff member to N active days/week. Approved leaves remain locked.
              </p>
            </div>
            <div className="mt-4 pt-2.5 border-t border-slate-200/80 text-[11px] text-amber-800 flex items-center gap-1.5 font-semibold">
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>Capped at {config.custom_days_per_week || 5} days / week</span>
            </div>
          </button>

          {/* Mode 3: Smart Dates Priority */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => handlePolicyChange('smart_dates_priority')}
            className={`p-4 rounded-xl border-2 text-left transition-all relative flex flex-col justify-between ${
              activePolicy === 'smart_dates_priority'
                ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-slate-900">3. Smart Dates Priority</span>
                {activePolicy === 'smart_dates_priority' && (
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs shadow-xs">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                If staff have explicit specific leaves recorded, only those exact dates are blocked. Generic weekly patterns yield dynamically to exam sessions.
              </p>
            </div>
            <div className="mt-4 pt-2.5 border-t border-slate-200/80 text-[11px] text-indigo-800 flex items-center gap-1.5 font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Leave dates take precedence</span>
            </div>
          </button>
        </div>

        {/* Sub-control when Mode 2 is active */}
        {activePolicy === 'cap_days_per_week' && (
          <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-xs font-bold text-amber-950 block">
                Maximum Active Days Per Week Per Staff Member
              </label>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Restricts the maximum number of unique calendar days any individual can be scheduled across the week.
              </p>
            </div>
            <select
              value={config.custom_days_per_week || 5}
              onChange={(e) => updateConstraint('custom_days_per_week', parseInt(e.target.value, 10))}
              disabled={disabled}
              className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
            >
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <option key={num} value={num}>
                  {num} {num === 1 ? 'day' : 'days'} / week {num === 5 ? '(Recommended)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Visual Simulation Matrix */}
        <AvailabilityPolicyVisual policy={activePolicy} customDaysPerWeek={config.custom_days_per_week || 5} />
      </div>

      {/* ── 2. Consecutive Shifts Policy & Daily Shifts Cap ── */}
      <div className="border border-slate-200 rounded-2xl p-6 bg-white shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-display font-bold text-slate-900 text-lg flex items-center gap-2.5">
              <span className="p-1.5 rounded-xl bg-indigo-100 text-indigo-800">
                <Clock className="w-5 h-5 text-indigo-600" />
              </span>
              Consecutive Shifts Policy (Period 1 &amp; Period 2 on Same Day)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Control whether the scheduler can assign staff back-to-back periods on the same day and set maximum daily shifts.
            </p>
          </div>
        </div>

        {/* 3 Policy Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Avoid */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleConsecutivePolicyChange('avoid')}
            className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
              consecutivePolicy === 'avoid'
                ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-slate-900">Avoid (Soft Constraint)</span>
                {consecutivePolicy === 'avoid' && (
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Separates shifts whenever possible. Staff will only receive back-to-back periods if no other eligible colleague is available.
              </p>
            </div>
            <span className="text-[11px] font-bold text-indigo-700 mt-3 pt-2 border-t border-slate-200/80">
              Recommended Default
            </span>
          </button>

          {/* Strictly Prevent */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleConsecutivePolicyChange('strictly_prevent')}
            className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
              consecutivePolicy === 'strictly_prevent'
                ? 'border-red-500 bg-red-50/40 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-slate-900">Strictly Prevent (Hard Lock)</span>
                {consecutivePolicy === 'strictly_prevent' && (
                  <span className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-xs">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Absolute lockout: Never assigns a staff member to both Period 1 and Period 2 on the same day under any circumstances.
              </p>
            </div>
            <span className="text-[11px] font-bold text-red-700 mt-3 pt-2 border-t border-slate-200/80">
              Strict Rest Protection
            </span>
          </button>

          {/* Allow Freely */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleConsecutivePolicyChange('allow')}
            className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
              consecutivePolicy === 'allow'
                ? 'border-emerald-500 bg-emerald-50/40 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-slate-900">Allow Freely</span>
                {consecutivePolicy === 'allow' && (
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Staff can take both morning and afternoon periods without penalty. Useful for compact midterm weeks.
              </p>
            </div>
            <span className="text-[11px] font-bold text-slate-600 mt-3 pt-2 border-t border-slate-200/80">
              Unrestricted Capacity
            </span>
          </button>
        </div>

        {/* Max Daily Shifts Input */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-900">
              Max Daily Shifts per Staff Member
            </label>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Limits total room invigilations on the same calendar date (Default: 2 shifts). Prevents assigning a 3rd shift to someone while peers have fewer.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={config.max_daily_shifts ?? 2}
              onChange={(e) => updateConstraint('max_daily_shifts', parseInt(e.target.value, 10) || 1)}
              className="input w-24 bg-white text-center font-bold text-xs"
              min={1}
              max={5}
              disabled={disabled}
            />
            <span className="text-xs text-slate-600 font-medium whitespace-nowrap">shifts / day</span>
          </div>
        </div>

        {/* Visual Timeline Diagram */}
        <ConsecutiveShiftsVisual policy={consecutivePolicy} maxDailyShifts={config.max_daily_shifts ?? 2} />
      </div>

      {/* ── 3. Standby Reserve Staff (Period Free Staff) Configuration ── */}
      <div className="border border-slate-200 rounded-2xl p-6 bg-white shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-display font-bold text-slate-900 text-lg flex items-center gap-2.5">
              <span className="p-1.5 rounded-xl bg-emerald-100 text-emerald-800">
                <Users className="w-5 h-5 text-emerald-600" />
              </span>
              Standby Reserve Staff (Period Free Staff) Roster
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Configure standby backup invigilators who remain on call to replace absent staff during examination periods.
            </p>
          </div>
          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 self-start sm:self-auto">
            Reserves Engine
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="block text-xs font-bold text-slate-900 mb-1">
              Standby Head Supervisors (per slot)
            </label>
            <p className="text-[11px] text-slate-500 mb-2.5">
              Backup Head Supervisors kept on standby for written exams in each period.
            </p>
            <input
              type="number"
              value={config.reserve_supervisors_target ?? 3}
              onChange={(e) => updateConstraint('reserve_supervisors_target', parseInt(e.target.value, 10) || 0)}
              className="input w-full bg-white text-xs font-bold"
              min={0}
              max={10}
              disabled={disabled}
            />
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="block text-xs font-bold text-slate-900 mb-1">
              Standby Invigilators / Assistants (per slot)
            </label>
            <p className="text-[11px] text-slate-500 mb-2.5">
              Backup Demonstrators kept on standby for written exams in each period.
            </p>
            <input
              type="number"
              value={config.reserve_assistants_target ?? 3}
              onChange={(e) => updateConstraint('reserve_assistants_target', parseInt(e.target.value, 10) || 0)}
              className="input w-full bg-white text-xs font-bold"
              min={0}
              max={10}
              disabled={disabled}
            />
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="block text-xs font-bold text-slate-900 mb-1">
              Max Weekly Reserve Duties (per staff)
            </label>
            <p className="text-[11px] text-slate-500 mb-2.5">
              Maximum standby shifts allowed per staff member per week (Default: 2).
            </p>
            <input
              type="number"
              value={config.max_weekly_reserves ?? 2}
              onChange={(e) => updateConstraint('max_weekly_reserves', parseInt(e.target.value, 10) || 1)}
              className="input w-full bg-white text-xs font-bold"
              min={1}
              max={10}
              disabled={disabled}
            />
          </div>
        </div>

        {/* Chemist Afternoon Shield Toggle */}
        <label
          className={`flex items-start p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl cursor-pointer transition-colors ${
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
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center mr-3 mt-0.5 flex-shrink-0 ${
              config.reserve_deprioritize_chemists_p2 !== false
                ? 'bg-emerald-600 border-emerald-600'
                : 'border-slate-300 bg-white'
            }`}
          >
            {config.reserve_deprioritize_chemists_p2 !== false && <Check className="w-3.5 h-3.5 text-white" />}
          </div>
          <div className="flex-1">
            <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <Beaker className="w-4 h-4 text-emerald-700" />
              <span>Deprioritize Chemists in Period 2 (Afternoon) Reserves</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
              Shields laboratory Chemists from late afternoon standby duties so they remain ready and rested for wet-lab practical exams and laboratory setup.
            </p>
          </div>
        </label>

        {/* Visual Reserves Bench Diagram */}
        <StandbyReservesVisual
          supervisorsTarget={config.reserve_supervisors_target ?? 3}
          assistantsTarget={config.reserve_assistants_target ?? 3}
          deprioritizeChemistsP2={config.reserve_deprioritize_chemists_p2 !== false}
          maxWeeklyReserves={config.max_weekly_reserves ?? 2}
        />
      </div>

      {/* ── 4. Committees Supervisor (Roving Floor Roamer) Controls ── */}
      <div className="border border-slate-200 rounded-2xl p-6 bg-white shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-display font-bold text-slate-900 text-lg flex items-center gap-2.5">
              <span className="p-1.5 rounded-xl bg-amber-100 text-amber-800">
                <Building2 className="w-5 h-5 text-amber-600" />
              </span>
              Committees Supervisor (Floor / Building Roving Supervisor)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Configure roving supervision capacity, room clustering limits, and maximum physical floor coverage.
            </p>
          </div>
        </div>

        {/* Enable / Disable Toggle */}
        <label
          className={`flex items-start p-4 bg-amber-50/50 border border-amber-200 rounded-xl cursor-pointer transition-colors ${
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
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center mr-3 mt-0.5 flex-shrink-0 ${
              config.require_committees_supervisors !== false
                ? 'bg-amber-600 border-amber-600'
                : 'border-slate-300 bg-white'
            }`}
          >
            {config.require_committees_supervisors !== false && <Check className="w-3.5 h-3.5 text-white" />}
          </div>
          <div className="flex-1">
            <div className="font-bold text-xs text-slate-900">
              Require Committees Supervisors for Exam Blocks
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
              When checked, the engine assigns dedicated senior supervisors to oversee active halls across floors, manage incidents, and coordinate relief.
            </p>
          </div>
        </label>

        {config.require_committees_supervisors !== false && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <label className="block text-xs font-bold text-slate-900 mb-1">
                Max Rooms per Roving Supervisor
              </label>
              <p className="text-[11px] text-slate-500 mb-2">
                Clustering limit: Prevents assigning too many active halls to a single floor supervisor (Recommended: 3–4 rooms).
              </p>
              <input
                type="number"
                value={config.max_rooms_per_lecturer || 3}
                onChange={(e) => updateConstraint('max_rooms_per_lecturer', parseInt(e.target.value, 10) || 1)}
                className="input w-full bg-white text-xs font-bold"
                min={1}
                max={8}
                disabled={disabled}
              />
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <label className="block text-xs font-bold text-slate-900 mb-1">
                Max Floors per Roving Supervisor
              </label>
              <p className="text-[11px] text-slate-500 mb-2">
                Vertical travel limit: Restricts vertical roaming so supervisors are not running up and down 4 floors (Recommended: 1–2 floors).
              </p>
              <input
                type="number"
                value={config.max_floors_per_supervisor || 2}
                onChange={(e) => updateConstraint('max_floors_per_supervisor', parseInt(e.target.value, 10) || 1)}
                className="input w-full bg-white text-xs font-bold"
                min={1}
                max={5}
                disabled={disabled}
              />
            </div>
          </div>
        )}

        {/* Visual Building Diagram */}
        <FloorRoamerVisual
          enabled={config.require_committees_supervisors !== false}
          maxRooms={config.max_rooms_per_lecturer || 3}
          maxFloors={config.max_floors_per_supervisor || 2}
        />
      </div>

      {/* ── 5. Oral Exam Assignment Strategy ── */}
      <div className="border border-slate-200 rounded-2xl p-6 bg-white shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-display font-bold text-slate-900 text-lg flex items-center gap-2.5">
              <span className="p-1.5 rounded-xl bg-blue-100 text-blue-800">
                <FileText className="w-5 h-5 text-blue-600" />
              </span>
              Oral Exam Assignment Pipeline
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Select how oral examinations are integrated into the automated scheduling execution.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Combined */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateConstraint('oral_exam_assignment_mode', 'combined')}
            className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
              oralMode === 'combined'
                ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-slate-900">1. Combined (Default)</span>
                {oralMode === 'combined' && (
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Auto-assigns both written and oral exam sessions in the same automated execution pass.
              </p>
            </div>
            <span className="text-[11px] font-bold text-blue-700 mt-3 pt-2 border-t border-slate-200/80">
              Unified Single Pipeline
            </span>
          </button>

          {/* Separate */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateConstraint('oral_exam_assignment_mode', 'separate')}
            className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
              oralMode === 'separate'
                ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-slate-900">2. Dedicated Oral Runs</span>
                {oralMode === 'separate' && (
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Oral exams are skipped during standard passes and only resolved when explicitly launching an Oral pass.
              </p>
            </div>
            <span className="text-[11px] font-bold text-slate-600 mt-3 pt-2 border-t border-slate-200/80">
              Two-Phase Execution
            </span>
          </button>

          {/* Skip */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateConstraint('oral_exam_assignment_mode', 'skip')}
            className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
              oralMode === 'skip'
                ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-slate-900">3. Skip Oral Exams</span>
                {oralMode === 'skip' && (
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Completely ignores oral exams in auto-assignment (leaves oral invigilation to department coordinators).
              </p>
            </div>
            <span className="text-[11px] font-bold text-slate-600 mt-3 pt-2 border-t border-slate-200/80">
              Manual Departmental Only
            </span>
          </button>
        </div>
      </div>

      {/* ── 6. Role Matching & Workload Fairness ── */}
      <div className="border border-slate-200 rounded-2xl p-6 bg-white shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-display font-bold text-slate-900 text-lg flex items-center gap-2.5">
              <span className="p-1.5 rounded-xl bg-primary-100 text-primary-800">
                <Scale className="w-5 h-5 text-primary-600" />
              </span>
              Role Strictness &amp; Workload Balancing Fairness
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Prevent staff burnout and ensure equitable duty distribution across all faculty members.
            </p>
          </div>
        </div>

        {/* Strict Role Enforcement */}
        <label
          className={`flex items-start p-4 border rounded-xl cursor-pointer transition-colors ${
            config.enforce_strict_roles !== false
              ? 'border-primary-300 bg-primary-50/50'
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
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center mr-3 mt-0.5 flex-shrink-0 ${
              config.enforce_strict_roles !== false
                ? 'bg-primary-600 border-primary-600'
                : 'border-slate-300 bg-white'
            }`}
          >
            {config.enforce_strict_roles !== false && <Check className="w-3.5 h-3.5 text-white" />}
          </div>
          <div className="flex-1">
            <div className="font-bold text-xs text-slate-900">
              Enforce Strict Role Matching
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
              When enabled, only Teaching Assistants can be appointed as Exam Head Supervisors, and only Demonstrators/Chemists can be assigned as Hall Invigilators.
            </p>
          </div>
        </label>

        {/* Workload Cap Constraint */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <label className="text-xs font-bold text-slate-900">
                Peer Workload Spread Cap (Max Gap Between Highest &amp; Lowest Peer)
              </label>
            </div>
            <span className="text-xs font-bold text-primary-700 bg-white px-2.5 py-1 rounded-md border border-slate-200">
              Max {config.max_score_delta_from_average ?? 3} points spread
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Limits the maximum score gap between the highest and lowest colleague within the same peer group (e.g. Chemists, Teaching Assistants, Demonstrators, Lecturers). If a staff member reaches their lowest peer&apos;s score + this cap, they are locked out from further assignments until lower peers catch up.
          </p>
          <div className="flex items-center gap-3 pt-1">
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={config.max_score_delta_from_average ?? 3}
              onChange={(e) => updateConstraint('max_score_delta_from_average', parseInt(e.target.value, 10) || 1)}
              className="w-full accent-primary-600 cursor-pointer"
              disabled={disabled}
            />
            <input
              type="number"
              value={config.max_score_delta_from_average ?? 3}
              onChange={(e) => updateConstraint('max_score_delta_from_average', parseInt(e.target.value, 10) || 1)}
              className="input w-20 text-center text-xs font-bold bg-white"
              min={1}
              max={15}
              disabled={disabled}
            />
          </div>
        </div>

        {/* Visual Workload Gauge */}
        <WorkloadFairnessVisual maxDelta={config.max_score_delta_from_average ?? 3} />

        {/* Weekly Hours Caps */}
        <div>
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
            Maximum Weekly Hours by Staff Contract Type
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-900">Full-Time Staff</span>
                <span className="text-[10px] bg-primary-100 text-primary-800 font-bold px-1.5 py-0.5 rounded">FT</span>
              </div>
              <p className="text-[10px] text-slate-500 mb-2">Standard weekly cap</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={config.max_hours_per_week_ft || 16}
                  onChange={(e) => updateConstraint('max_hours_per_week_ft', parseInt(e.target.value, 10) || 0)}
                  className="input w-full bg-white text-xs font-bold"
                  min={1}
                  max={60}
                  disabled={disabled}
                />
                <span className="text-xs text-slate-500 font-medium">hrs/wk</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-900">Part-Time Staff</span>
                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">PT</span>
              </div>
              <p className="text-[10px] text-slate-500 mb-2">Pro-rated contract cap</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={config.max_hours_per_week_pt || 8}
                  onChange={(e) => updateConstraint('max_hours_per_week_pt', parseInt(e.target.value, 10) || 0)}
                  className="input w-full bg-white text-xs font-bold"
                  min={1}
                  max={40}
                  disabled={disabled}
                />
                <span className="text-xs text-slate-500 font-medium">hrs/wk</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-900">Chemists</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">Lab</span>
              </div>
              <p className="text-[10px] text-slate-500 mb-2">Dedicated laboratory staff</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={config.max_hours_per_week_chemist || 20}
                  onChange={(e) => updateConstraint('max_hours_per_week_chemist', parseInt(e.target.value, 10) || 0)}
                  className="input w-full bg-white text-xs font-bold"
                  min={1}
                  max={60}
                  disabled={disabled}
                />
                <span className="text-xs text-slate-500 font-medium">hrs/wk</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 7. Unified Policy & Operating Architecture Summary ── */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-md">
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </span>
            <span className="font-semibold text-xs tracking-wider uppercase text-slate-300">
              Active Operating Profile Architecture
            </span>
          </div>
          <span className="text-[10px] font-mono text-gold-300">Deterministic Engine v2.4</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <div className="bg-white/5 p-3 rounded-xl border border-white/5">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Availability Policy</div>
            <div className="font-bold text-white mt-0.5">
              {activePolicy === 'respect_all_off_days'
                ? 'Strict Off-Days'
                : activePolicy === 'cap_days_per_week'
                ? `Flexible (Max ${config.custom_days_per_week || 5} d/wk)`
                : 'Smart Dates Priority'}
            </div>
          </div>

          <div className="bg-white/5 p-3 rounded-xl border border-white/5">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Consecutive Shifts</div>
            <div className="font-bold text-white mt-0.5">
              {consecutivePolicy === 'avoid'
                ? 'Avoided (Soft Constraint)'
                : consecutivePolicy === 'strictly_prevent'
                ? 'Strictly Prevented (Hard Lock)'
                : 'Allowed Freely'}
            </div>
          </div>

          <div className="bg-white/5 p-3 rounded-xl border border-white/5">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Standby Reserves</div>
            <div className="font-bold text-white mt-0.5">
              {config.reserve_supervisors_target ?? 3} Sup + {config.reserve_assistants_target ?? 3} Inv per slot
            </div>
          </div>

          <div className="bg-white/5 p-3 rounded-xl border border-white/5">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Floor Roamers</div>
            <div className="font-bold text-white mt-0.5">
              {config.require_committees_supervisors !== false
                ? `Max ${config.max_rooms_per_lecturer || 3} rms • Max ${config.max_floors_per_supervisor || 2} flrs`
                : 'Disabled'}
            </div>
          </div>

          <div className="bg-white/5 p-3 rounded-xl border border-white/5">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Oral Exam Mode</div>
            <div className="font-bold text-white mt-0.5 capitalize">
              {oralMode === 'combined' ? 'Combined Pipeline' : oralMode === 'separate' ? 'Separate Run' : 'Skipped'}
            </div>
          </div>

          <div className="bg-white/5 p-3 rounded-xl border border-white/5">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Peer Spread Cap</div>
            <div className="font-bold text-white mt-0.5">
              max {config.max_score_delta_from_average ?? 3} pts peer gap
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
