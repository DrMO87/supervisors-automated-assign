'use client';

import React, { useState } from 'react';
import { 
  Users, UserCheck, Shield, ShieldCheck, AlertCircle, Clock, 
  Calendar, Check, Building, Building2, Flame, Sparkles, Scale, 
  Layers, Lock, Unlock, Eye, ArrowRight, Ban, CheckCircle2,
  Sliders, Beaker, HelpCircle, ChevronRight, Zap, Coffee, Info
} from 'lucide-react';
import type { 
  StaffAvailabilityPolicy, 
  ConsecutiveShiftPolicy, 
  OralAssignmentMode,
  StaffingRatioRange,
  SchedulingConstraintsConfig 
} from '@/types/database.types';
import { 
  ClassroomBlueprintSvg, 
  StrictOffDaysSvg, 
  FlexibleCapDaysSvg, 
  SmartDatesPrioritySvg,
  ConsecutiveAvoidSvg,
  ConsecutiveStrictSvg,
  ConsecutiveAllowSvg,
  BuildingFloorRoamerSvg,
  StandbyReservesSvg,
  WorkloadFairnessSvg,
  OralPipelineSvg
} from './settings-svg-illustrations';

// ============================================================================
// 1. LIVE CLASSROOM SIMULATOR VISUAL
// ============================================================================
interface ClassroomSimulatorVisualProps {
  ranges: StaffingRatioRange[];
}

export function ClassroomSimulatorVisual({ ranges }: ClassroomSimulatorVisualProps) {
  const [testStudentCount, setTestStudentCount] = useState<number>(45);

  // Find matching range
  const sortedRanges = [...ranges].sort((a, b) => a.min - b.min);
  const matchedRange = sortedRanges.find(
    (r) => testStudentCount >= r.min && testStudentCount <= r.max
  ) || sortedRanges[sortedRanges.length - 1] || { min: 1, max: 9999, head_supervisors: 1, assistants: 1 };

  return (
    <div className="space-y-4">
      {/* Slider Control Bar */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3.5">
          <span className="p-2.5 rounded-xl bg-gold-400 text-slate-950 font-bold shadow-glow-gold flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </span>
          <div>
            <h4 className="font-display font-extrabold text-white text-lg">
              Interactive Classroom Architectural Blueprint
            </h4>
            <p className="text-sm text-slate-300 font-medium mt-0.5">
              Move the slider to simulate room layout, student seating, and assigned staff in real-time.
            </p>
          </div>
        </div>

        {/* Interactive Slider */}
        <div className="flex items-center gap-3.5 bg-white/10 px-4 py-2.5 rounded-xl border border-white/15 backdrop-blur-md self-start sm:self-auto">
          <label className="text-sm text-slate-200 font-bold whitespace-nowrap">Test Students:</label>
          <input
            type="range"
            min="5"
            max="120"
            step="5"
            value={testStudentCount}
            onChange={(e) => setTestStudentCount(parseInt(e.target.value, 10))}
            className="w-32 sm:w-44 accent-gold-400 cursor-pointer h-2 bg-slate-700 rounded-lg"
          />
          <div className="bg-gold-400 text-slate-950 px-3.5 py-1.5 rounded-xl font-extrabold text-sm font-mono shadow-xs">
            {testStudentCount} seats
          </div>
        </div>
      </div>

      {/* Bespoke Interactive Classroom SVG */}
      <ClassroomBlueprintSvg
        studentCount={testStudentCount}
        headSupervisors={matchedRange.head_supervisors}
        invigilators={matchedRange.assistants}
        tierName={`Tier (${matchedRange.min}-${matchedRange.max >= 9999 ? '∞' : matchedRange.max})`}
      />
    </div>
  );
}

// ============================================================================
// 2. AVAILABILITY POLICY COMPARISON & VISUAL TIMELINE
// ============================================================================
interface AvailabilityPolicyVisualProps {
  policy: StaffAvailabilityPolicy;
  customDaysPerWeek?: number;
}

export function AvailabilityPolicyVisual({ policy, customDaysPerWeek = 5 }: AvailabilityPolicyVisualProps) {
  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-primary-600" />
          Live Policy Simulation:
        </span>
        <span className="text-[11px] font-mono text-slate-500">
          Engine Evaluation Mode: <strong>{policy}</strong>
        </span>
      </div>

      {policy === 'respect_all_off_days' && <StrictOffDaysSvg active={true} />}
      {policy === 'cap_days_per_week' && <FlexibleCapDaysSvg active={true} customDays={customDaysPerWeek} />}
      {policy === 'smart_dates_priority' && <SmartDatesPrioritySvg active={true} />}
    </div>
  );
}

// ============================================================================
// 3. CONSECUTIVE SHIFTS VISUAL TIMELINE
// ============================================================================
interface ConsecutiveShiftsVisualProps {
  policy: ConsecutiveShiftPolicy;
  maxDailyShifts?: number;
}

export function ConsecutiveShiftsVisual({ policy, maxDailyShifts = 2 }: ConsecutiveShiftsVisualProps) {
  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-indigo-600" />
          Shift Transition Diagram:
        </span>
        <span className="text-[11px] font-mono text-slate-500">
          Max Daily Limit: <strong>{maxDailyShifts} shifts/day</strong>
        </span>
      </div>

      {policy === 'avoid' && <ConsecutiveAvoidSvg active={true} />}
      {policy === 'strictly_prevent' && <ConsecutiveStrictSvg active={true} />}
      {policy === 'allow' && <ConsecutiveAllowSvg active={true} />}
    </div>
  );
}

// ============================================================================
// 4. FLOOR ROAMING & COMMITTEES SUPERVISORS VISUAL
// ============================================================================
interface FloorRoamerVisualProps {
  enabled: boolean;
  maxRooms: number;
  maxFloors: number;
}

export function FloorRoamerVisual({ enabled, maxRooms, maxFloors }: FloorRoamerVisualProps) {
  if (!enabled) {
    return (
      <div className="p-4 bg-slate-100 rounded-xl border border-slate-200 text-xs text-slate-500 italic mt-3 text-center">
        Committees Supervisor allocation disabled. Individual room supervisors operate independently.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <BuildingFloorRoamerSvg enabled={enabled} maxRooms={maxRooms} maxFloors={maxFloors} />
    </div>
  );
}

// ============================================================================
// 5. STANDBY RESERVES & CHEMIST PROTECTION VISUAL
// ============================================================================
interface StandbyReservesVisualProps {
  supervisorsTarget: number;
  assistantsTarget: number;
  deprioritizeChemistsP2: boolean;
  maxWeeklyReserves?: number;
}

export function StandbyReservesVisual({
  supervisorsTarget,
  assistantsTarget,
  deprioritizeChemistsP2,
  maxWeeklyReserves = 2,
}: StandbyReservesVisualProps) {
  return (
    <div className="mt-4 space-y-3">
      <StandbyReservesSvg
        supervisorsTarget={supervisorsTarget}
        assistantsTarget={assistantsTarget}
        deprioritizeChemistsP2={deprioritizeChemistsP2}
        maxWeeklyReserves={maxWeeklyReserves}
      />
    </div>
  );
}

// ============================================================================
// 6. WORKLOAD FAIRNESS & SCORE DELTA VISUAL GAUGE
// ============================================================================
interface WorkloadFairnessVisualProps {
  maxDelta: number;
}

export function WorkloadFairnessVisual({ maxDelta }: WorkloadFairnessVisualProps) {
  return (
    <div className="mt-4 space-y-3">
      <WorkloadFairnessSvg maxDelta={maxDelta} />
    </div>
  );
}

// ============================================================================
// 7. PRESET PROFILES SELECTOR
// ============================================================================
interface PresetProfilesSelectorProps {
  onApplyPreset: (presetKey: string) => void;
  disabled?: boolean;
}

export function PresetProfilesSelector({ onApplyPreset, disabled }: PresetProfilesSelectorProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-sm mb-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-gold-100 text-gold-900 shadow-2xs">
            <Zap className="w-5 h-5 text-gold-600" />
          </span>
          <div>
            <h4 className="font-display font-extrabold text-base text-slate-900">
              One-Click Operational Presets
            </h4>
            <p className="text-sm text-slate-500 font-medium mt-0.5">
              Apply verified engine configurations tailored for university exam cycles.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Preset 1: Standard Semester */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onApplyPreset('standard')}
          className="p-5 sm:p-6 rounded-2xl border-2 border-slate-200 hover:border-primary-500 hover:bg-primary-50/25 text-left transition-all group flex flex-col justify-between shadow-xs hover:shadow-md"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-display font-extrabold text-base text-slate-900 group-hover:text-primary-700">
                1. Standard Semester
              </span>
              <span className="text-xs bg-primary-100 text-primary-800 px-3 py-1 rounded-full font-extrabold">
                Balanced
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal mt-2">
              Strict weekly off-days, soft consecutive shift avoidance, standard reserve bench (3+3), 3-point delta cap.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 text-xs sm:text-sm font-extrabold text-primary-700 flex items-center justify-between">
            <span>Apply Balanced Preset</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* Preset 2: Midterm / Peak Crunch */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onApplyPreset('midterm_crunch')}
          className="p-5 sm:p-6 rounded-2xl border-2 border-slate-200 hover:border-amber-500 hover:bg-amber-50/25 text-left transition-all group flex flex-col justify-between shadow-xs hover:shadow-md"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-display font-extrabold text-base text-slate-900 group-hover:text-amber-800">
                2. Midterm / Peak Rush
              </span>
              <span className="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-extrabold">
                High Capacity
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal mt-2">
              Flexible 5-day availability to fill compressed schedules, allow back-to-back periods, max backup reserves (4+4).
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 text-xs sm:text-sm font-extrabold text-amber-700 flex items-center justify-between">
            <span>Apply Midterm Preset</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* Preset 3: Maximum Staff Welfare */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onApplyPreset('welfare_focus')}
          className="p-5 sm:p-6 rounded-2xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/25 text-left transition-all group flex flex-col justify-between shadow-xs hover:shadow-md"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-display font-extrabold text-base text-slate-900 group-hover:text-emerald-800">
                3. Staff Rest &amp; Equity
              </span>
              <span className="text-xs bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-extrabold">
                Protective
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal mt-2">
              Hard lockout on consecutive shifts (P1 &amp; P2 forbidden), strict 2-point delta fairness cap, max 1 daily shift.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 text-xs sm:text-sm font-extrabold text-emerald-700 flex items-center justify-between">
            <span>Apply Rest &amp; Equity Preset</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
      </div>
    </div>
  );
}
