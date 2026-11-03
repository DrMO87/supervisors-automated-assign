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
    <div className="bg-gradient-to-br from-slate-900 via-primary-950 to-slate-900 text-white rounded-2xl p-5 border border-primary-800/40 shadow-xl overflow-hidden relative">
      {/* Background ambient glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header & Interactive Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10 relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-gold-400/20 text-gold-300 border border-gold-400/30">
              <Sparkles className="w-4 h-4" />
            </span>
            <h4 className="font-display font-semibold text-white text-base">
              Live Classroom Staffing Simulator
            </h4>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Test any student count to see the exact invigilation staffing allocated to the room.
          </p>
        </div>

        {/* Quick Slider & Number Input */}
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl backdrop-blur-sm">
          <label className="text-xs text-slate-300 whitespace-nowrap font-medium">Test Students:</label>
          <input
            type="range"
            min="5"
            max="120"
            step="5"
            value={testStudentCount}
            onChange={(e) => setTestStudentCount(parseInt(e.target.value, 10))}
            className="w-24 sm:w-32 accent-gold-400 cursor-pointer"
          />
          <div className="flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-lg border border-white/15 min-w-[56px] justify-center">
            <span className="text-sm font-bold text-gold-300">{testStudentCount}</span>
            <span className="text-[10px] text-slate-400">seats</span>
          </div>
        </div>
      </div>

      {/* Visual Classroom Blueprint */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center relative z-10">
        {/* Left: The Room Blueprint */}
        <div className="lg:col-span-7 bg-slate-950/70 border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-3 px-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Room Simulation: Exam Hall A ({testStudentCount} Students)
            </span>
            <span className="text-gold-300/80 font-mono text-[11px]">
              Matched Tier: {matchedRange.min} - {matchedRange.max >= 9999 ? '∞' : matchedRange.max}
            </span>
          </div>

          {/* Lecturer Podium / Head Supervisor Station */}
          <div className="bg-primary-900/60 border border-primary-500/40 rounded-lg p-3 mb-4 text-center relative overflow-hidden">
            <div className="text-[10px] uppercase font-semibold text-primary-200 tracking-wider mb-1">
              Front Board &amp; Main Podium
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="flex items-center gap-1.5 bg-primary-800 text-white px-3 py-1 rounded-md text-xs font-semibold shadow-md border border-primary-400/30">
                <ShieldCheck className="w-3.5 h-3.5 text-gold-300" />
                <span>Head Exam Supervisor</span>
                <span className="bg-gold-400 text-primary-950 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  ×{matchedRange.head_supervisors}
                </span>
              </div>
            </div>
          </div>

          {/* Student Desks Grid Visual */}
          <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5 py-2 px-1 bg-white/[0.02] rounded-lg border border-white/5 mb-4">
            {Array.from({ length: Math.min(testStudentCount, 40) }).map((_, i) => (
              <div
                key={i}
                className="h-4 bg-slate-800/80 rounded border border-slate-700/60 flex items-center justify-center text-[8px] text-slate-400 hover:border-gold-400/60 transition-colors"
                title={`Student Desk #${i + 1}`}
              >
                {i + 1}
              </div>
            ))}
            {testStudentCount > 40 && (
              <div className="col-span-8 sm:col-span-10 text-center text-[10px] text-slate-400 italic py-0.5">
                + {testStudentCount - 40} additional seated students...
              </div>
            )}
          </div>

          {/* Floor Invigilators Station */}
          <div className="bg-amber-950/40 border border-amber-500/30 rounded-lg p-3 text-center">
            <div className="text-[10px] uppercase font-semibold text-amber-300 tracking-wider mb-1.5">
              Floor Aisles &amp; Hall Supervision
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {matchedRange.assistants === 0 ? (
                <span className="text-xs text-slate-400 italic">No invigilators required for this small student count.</span>
              ) : (
                Array.from({ length: matchedRange.assistants }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 bg-amber-900/70 text-amber-100 px-2.5 py-1 rounded-md text-xs font-medium border border-amber-500/40"
                  >
                    <UserCheck className="w-3 h-3 text-amber-300" />
                    <span>Invigilator #{i + 1}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Allocation Card & Ratio Summary */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-2">
              Calculated Staff for this Session:
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-primary-900/40 border border-primary-500/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold font-display text-white">
                  {matchedRange.head_supervisors}
                </div>
                <div className="text-xs text-primary-200 font-medium mt-0.5">
                  Exam Supervisor{matchedRange.head_supervisors > 1 ? 's' : ''}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Teaching Assistants</div>
              </div>

              <div className="bg-amber-950/40 border border-amber-500/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold font-display text-gold-300">
                  {matchedRange.assistants}
                </div>
                <div className="text-xs text-amber-200 font-medium mt-0.5">
                  Invigilator{matchedRange.assistants !== 1 ? 's' : ''}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Demonstrators / Chemists</div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-slate-300">Total Assigned Staff:</span>
              <span className="font-bold text-white bg-white/10 px-2 py-0.5 rounded text-sm">
                {matchedRange.head_supervisors + matchedRange.assistants} Staff
              </span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 leading-relaxed flex items-start gap-2.5">
            <Info className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Smart Auto-Scale:</strong> When exam sessions are generated from course registrations, this table deterministically dictates the exact supervisory roster for every hall.
            </span>
          </div>
        </div>
      </div>
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
  // Weekly simulation days: Sun, Mon, Tue, Wed, Thu, Fri, Sat
  const days = [
    { name: 'Sun', full: 'Sunday', type: 'work' },
    { name: 'Mon', full: 'Monday', type: 'work' },
    { name: 'Tue', full: 'Tuesday', type: 'work' },
    { name: 'Wed', full: 'Wednesday', type: 'work' },
    { name: 'Thu', full: 'Thursday', type: 'off' }, // typical staff off day
    { name: 'Fri', full: 'Friday', type: 'leave' }, // requested individual leave
    { name: 'Sat', full: 'Saturday', type: 'weekend' },
  ];

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-primary-600" />
          Visual Week Simulation: How the engine handles a sample staff member (Off on Thu, Leave on Fri)
        </span>
        <span className="text-[11px] font-medium text-slate-500">
          Active Mode:{' '}
          <span className="text-primary-700 font-bold">
            {policy === 'respect_all_off_days'
              ? 'Strict Off-Days'
              : policy === 'cap_days_per_week'
              ? `Flexible (Max ${customDaysPerWeek} Days)`
              : 'Smart Dates Priority'}
          </span>
        </span>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((d, index) => {
          let status = 'available';
          let label = 'Scheduled';
          let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
          let icon = <Check className="w-3 h-3 text-emerald-600" />;

          if (d.type === 'weekend') {
            status = 'weekend';
            label = 'Weekend';
            badgeColor = 'bg-slate-100 text-slate-500 border-slate-200';
            icon = <Clock className="w-3 h-3 text-slate-400" />;
          } else if (d.type === 'leave') {
            // Requested explicit leave date: protected in ALL modes
            status = 'blocked_leave';
            label = 'Approved Leave';
            badgeColor = 'bg-red-50 text-red-700 border-red-200';
            icon = <Ban className="w-3 h-3 text-red-500" />;
          } else if (d.type === 'off') {
            if (policy === 'respect_all_off_days') {
              status = 'blocked_offday';
              label = 'Contract Off-Day';
              badgeColor = 'bg-slate-100 text-slate-600 border-slate-300';
              icon = <Lock className="w-3 h-3 text-slate-500" />;
            } else if (policy === 'cap_days_per_week') {
              status = 'unlocked_flex';
              label = `Unlocked (Max ${customDaysPerWeek}/wk)`;
              badgeColor = 'bg-amber-50 text-amber-700 border-amber-300';
              icon = <Zap className="w-3 h-3 text-amber-600" />;
            } else {
              // smart dates priority: staff has specific leave on Fri, so regular Thu off-day is opened for exams
              status = 'unlocked_priority';
              label = 'Smart Override';
              badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
              icon = <Sparkles className="w-3 h-3 text-indigo-600" />;
            }
          }

          return (
            <div
              key={index}
              className={`p-2.5 rounded-lg border text-center flex flex-col justify-between transition-all ${
                status === 'available'
                  ? 'bg-white border-slate-200 shadow-xs'
                  : status === 'unlocked_flex' || status === 'unlocked_priority'
                  ? 'bg-amber-50/70 border-amber-200 shadow-xs'
                  : status === 'blocked_leave'
                  ? 'bg-red-50/70 border-red-200'
                  : 'bg-slate-100/80 border-slate-200 text-slate-400'
              }`}
            >
              <div>
                <div className="text-[11px] font-bold text-slate-800">{d.name}</div>
                <div className="text-[10px] text-slate-400">{d.full}</div>
              </div>

              <div className="mt-2 pt-1 border-t border-slate-200/60 flex flex-col items-center gap-1">
                <span className="flex items-center justify-center">{icon}</span>
                <span className="text-[9px] font-semibold leading-tight line-clamp-1">
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-[11px] text-slate-600 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <strong>Engine Guarantee:</strong> Individual approved leave dates are 100% safeguarded under all 3 policies.
        </span>
        <span className="text-slate-400 font-mono text-[10px]">
          {policy === 'respect_all_off_days'
            ? 'Protected contract days'
            : policy === 'cap_days_per_week'
            ? 'Bypasses weekly grid, limits active days'
            : 'Specific leave dates supersede regular day-off'}
        </span>
      </div>
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
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-indigo-600" />
          Timeline Simulation: Dr. Sarah on Exam Day (Period 1 &amp; Period 2)
        </span>
        <span className="text-[11px] font-medium text-slate-500">
          Max Daily Limit: <strong className="text-slate-900">{maxDailyShifts} shifts/day</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
        {/* Period 1 */}
        <div className="md:col-span-4 bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-900">Period 1 (Morning)</span>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded">
              09:00 - 11:30
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-800 font-bold text-xs flex items-center justify-center">
              DS
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-800">Dr. Sarah (Supervisor)</div>
              <div className="text-[10px] text-emerald-600 font-medium">Assigned to Hall B</div>
            </div>
          </div>
        </div>

        {/* Transition / Rest Gap */}
        <div className="md:col-span-3 flex flex-col items-center justify-center px-1 text-center">
          <div className="text-[10px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
            <Coffee className="w-3 h-3 text-amber-500" /> 1 Hour Rest Gap
          </div>
          <div className="w-full flex items-center">
            <div className="flex-1 h-0.5 bg-slate-300" />
            <ArrowRight className="w-4 h-4 text-slate-400 mx-1 flex-shrink-0" />
            <div className="flex-1 h-0.5 bg-slate-300" />
          </div>
          <div className="text-[10px] font-bold mt-1">
            {policy === 'avoid' ? (
              <span className="text-indigo-600">Avoid Second Shift</span>
            ) : policy === 'strictly_prevent' ? (
              <span className="text-red-600">⛔ Locked Out</span>
            ) : (
              <span className="text-emerald-600">⚡ Freely Re-assignable</span>
            )}
          </div>
        </div>

        {/* Period 2 */}
        <div className={`md:col-span-4 rounded-lg p-3 border transition-all ${
          policy === 'strictly_prevent'
            ? 'bg-red-50/60 border-red-200'
            : policy === 'avoid'
            ? 'bg-indigo-50/40 border-indigo-200'
            : 'bg-emerald-50/50 border-emerald-200'
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-900">Period 2 (Afternoon)</span>
            <span className="text-[10px] bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded">
              12:30 - 15:00
            </span>
          </div>

          {policy === 'strictly_prevent' ? (
            <div className="flex items-center gap-2 mt-2 text-red-700">
              <div className="w-7 h-7 rounded-full bg-red-100 text-red-700 flex items-center justify-center">
                <Ban className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-red-800">Hard Lock: Colleague B Takes Slot</div>
                <div className="text-[10px] text-red-600">Dr. Sarah cannot be assigned here under any circumstance.</div>
              </div>
            </div>
          ) : policy === 'avoid' ? (
            <div className="flex items-center gap-2 mt-2">
              <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                MA
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-800">Colleague Takes Shift (Soft)</div>
                <div className="text-[10px] text-slate-500">Dr. Sarah only used as emergency fallback if no one else exists.</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-2">
              <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                DS
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-800">Dr. Sarah Re-assigned</div>
                <div className="text-[10px] text-emerald-700">Double shift allowed without penalty.</div>
              </div>
            </div>
          )}
        </div>
      </div>
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
      <div className="p-3 bg-slate-100 rounded-lg border border-slate-200 text-xs text-slate-500 italic mt-2">
        Committees Supervisor allocation disabled. Individual room supervisors will operate independently without floor roamer coordination.
      </div>
    );
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-amber-600" />
          Architectural Roaming Simulation: Building A (Floors &amp; Room Clustering)
        </span>
        <span className="text-[11px] font-medium text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded border border-amber-200">
          Max {maxFloors} Floors • Max {maxRooms} Rooms
        </span>
      </div>

      <div className="space-y-2">
        {/* Floor 3 */}
        <div className="bg-white border border-slate-200 rounded-lg p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 w-16">Floor 3</span>
            <div className="flex gap-1.5">
              <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-mono">
                Hall 301
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-mono">
                Hall 302
              </span>
            </div>
          </div>
          <span className="text-[10px] text-slate-400">Assigned to Floor Roamer #2</span>
        </div>

        {/* Floor 2 (Active Roaming Radius) */}
        <div className="bg-amber-50/70 border-2 border-amber-400 rounded-lg p-2.5 flex items-center justify-between relative shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-900 w-16">Floor 2</span>
            <div className="flex gap-1.5">
              <span className="text-[10px] bg-white text-amber-900 font-semibold px-2 py-0.5 rounded border border-amber-300 font-mono shadow-xs">
                Hall 201
              </span>
              <span className="text-[10px] bg-white text-amber-900 font-semibold px-2 py-0.5 rounded border border-amber-300 font-mono shadow-xs">
                Hall 202
              </span>
              <span className="text-[10px] bg-white text-amber-900 font-semibold px-2 py-0.5 rounded border border-amber-300 font-mono shadow-xs">
                Hall 203
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-amber-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-xs">
            <UserCheck className="w-3 h-3" />
            <span>Roamer #1 (Dr. Ahmed) Active Zone</span>
          </div>
        </div>

        {/* Floor 1 */}
        <div className="bg-amber-50/40 border border-dashed border-amber-300 rounded-lg p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 w-16">Floor 1</span>
            <div className="flex gap-1.5">
              <span className="text-[10px] bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-mono">
                Hall 101
              </span>
            </div>
          </div>
          <span className="text-[10px] text-amber-700 font-medium">
            Included in Roamer #1 territory ({maxFloors >= 2 ? 'Covered' : 'Separate Roamer'})
          </span>
        </div>
      </div>

      <div className="mt-3 text-[11px] text-slate-600 flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
        <span>
          <strong>Why this matters:</strong> Prevents spreading a floor supervisor across disparate buildings or beyond {maxFloors} physical floors, ensuring immediate response when emergencies arise in halls.
        </span>
      </div>
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
  maxWeeklyReserves = 2
}: StandbyReservesVisualProps) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-emerald-600" />
          Reserve Staffing Bench: Standby Invigilators Ready for Urgent Replacements
        </span>
        <span className="text-[11px] font-medium text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded border border-emerald-200">
          Max {maxWeeklyReserves} Standby Shifts / Staff / Week
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Left: Active Exam Hall */}
        <div className="md:col-span-5 bg-white border border-slate-200 rounded-lg p-3">
          <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
            <span>Inside Exam Rooms</span>
            <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">Active</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs p-1.5 bg-slate-50 rounded border border-slate-100">
              <span className="font-medium text-slate-800">Room 101 (60 Students)</span>
              <span className="text-slate-500 text-[10px]">1 Sup + 3 Inv</span>
            </div>
            <div className="flex items-center justify-between text-xs p-1.5 bg-slate-50 rounded border border-slate-100">
              <span className="font-medium text-slate-800">Room 201 (40 Students)</span>
              <span className="text-slate-500 text-[10px]">1 Sup + 2 Inv</span>
            </div>
          </div>
        </div>

        {/* Center: Backup Bridge */}
        <div className="md:col-span-2 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
            Backup Pool
          </span>
          <ArrowRight className="w-4 h-4 text-emerald-600 my-1" />
          <span className="text-[9px] text-slate-400">Instant dispatch on emergency absence</span>
        </div>

        {/* Right: Standby Reserve Lounge */}
        <div className="md:col-span-5 bg-emerald-50/70 border border-emerald-200 rounded-lg p-3">
          <div className="text-xs font-bold text-emerald-950 mb-2 flex items-center justify-between">
            <span>Standby Reserve Lounge</span>
            <span className="text-[10px] bg-emerald-200 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
              Ready
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white p-2 rounded border border-emerald-200 text-center">
              <div className="text-lg font-bold text-emerald-800">{supervisorsTarget}</div>
              <div className="text-[10px] text-slate-600 font-semibold">Head Supervisors</div>
            </div>
            <div className="bg-white p-2 rounded border border-emerald-200 text-center">
              <div className="text-lg font-bold text-emerald-800">{assistantsTarget}</div>
              <div className="text-[10px] text-slate-600 font-semibold">Invigilators</div>
            </div>
          </div>
        </div>
      </div>

      {/* Chemist Protection Indicator */}
      <div className={`mt-3 p-2.5 rounded-lg border flex items-center justify-between ${
        deprioritizeChemistsP2
          ? 'bg-emerald-100/50 border-emerald-300 text-emerald-900'
          : 'bg-slate-100 border-slate-200 text-slate-600'
      }`}>
        <div className="flex items-center gap-2">
          <Beaker className="w-4 h-4 text-emerald-700" />
          <span className="text-xs font-semibold">
            {deprioritizeChemistsP2
              ? 'Chemist Afternoon Shield Active: Chemists protected from Period 2 Reserves'
              : 'Chemists treated equally in afternoon reserves'}
          </span>
        </div>
        <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded shadow-xs">
          {deprioritizeChemistsP2 ? 'Shielded for Labs' : 'Unrestricted'}
        </span>
      </div>
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
  const lowestPeerWorkload = 8;
  const lockoutCeiling = lowestPeerWorkload + maxDelta;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
          <Scale className="w-3.5 h-3.5 text-primary-600" />
          Peer Workload Balancing &amp; Cohort Spread Scale
        </span>
        <span className="text-[11px] font-semibold text-primary-800 bg-primary-100/70 px-2 py-0.5 rounded border border-primary-200">
          Max Peer Gap: {maxDelta} Points
        </span>
      </div>

      <p className="text-xs text-slate-500 mb-3">
        The auto-scheduler tracks every colleague&apos;s accumulated duties within their peer cohort. If an individual reaches{' '}
        <strong>Lowest Peer ({lowestPeerWorkload}) + {maxDelta} = {lockoutCeiling}</strong> shifts, they are locked out until lower peers catch up.
      </p>

      {/* Visual Progress / Spectrum Bar */}
      <div className="relative pt-6 pb-2">
        <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden flex">
          <div className="w-1/3 bg-emerald-400" title="Cohort Floor (Lowest Peer)" />
          <div className="w-1/3 bg-blue-400" title="Active Peer Range" />
          <div className="w-1/3 bg-amber-400" title="Spread Ceiling" />
        </div>

        {/* Lowest Peer Pin */}
        <div className="absolute top-0 left-1/3 -translate-x-1/2 flex flex-col items-center">
          <span className="text-[10px] font-bold text-primary-900 bg-primary-100 px-1.5 py-0.5 rounded border border-primary-300">
            Lowest Peer ({lowestPeerWorkload})
          </span>
          <div className="w-0.5 h-4 bg-primary-600 mt-0.5" />
        </div>

        {/* Lockout Barrier */}
        <div
          className="absolute top-0 flex flex-col items-center"
          style={{ left: `${Math.min(95, 33.3 + (maxDelta / 10) * 55)}%` }}
        >
          <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-300 flex items-center gap-0.5">
            <Ban className="w-2.5 h-2.5" /> Peer Cap ({lockoutCeiling})
          </span>
          <div className="w-0.5 h-4 bg-red-500 mt-0.5" />
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 font-mono">
        <span>Lowest Active Peer</span>
        <span>Equitable Cohort Spread</span>
        <span>Locked (Spread &gt; {maxDelta})</span>
      </div>
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
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm mb-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-md bg-gold-100 text-gold-800">
            <Zap className="w-4 h-4 text-gold-600" />
          </span>
          <h4 className="font-semibold text-sm text-slate-900">
            Quick Operational Presets
          </h4>
        </div>
        <span className="text-xs text-slate-500">
          One-click configurations tailored for university operational cycles
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Preset 1: Standard Semester */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onApplyPreset('standard')}
          className="p-3.5 rounded-xl border border-slate-200 hover:border-primary-400 hover:bg-primary-50/30 text-left transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-xs text-slate-900 group-hover:text-primary-700">
                1. Standard Semester
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                Balanced
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Strict weekly off-days, soft consecutive shift avoidance, standard reserve bench (3+3), 3-point delta cap.
            </p>
          </div>
          <div className="mt-3 text-[10px] font-bold text-primary-600 flex items-center gap-1">
            <span>Apply Standard Setup</span>
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </button>

        {/* Preset 2: Midterm / Peak Crunch */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onApplyPreset('midterm_crunch')}
          className="p-3.5 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/30 text-left transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-xs text-slate-900 group-hover:text-amber-800">
                2. Midterm / Peak Rush
              </span>
              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                High Capacity
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Flexible 5-day availability to fill compressed schedules, allow back-to-back periods, max backup reserves (4+4).
            </p>
          </div>
          <div className="mt-3 text-[10px] font-bold text-amber-700 flex items-center gap-1">
            <span>Apply Midterm Setup</span>
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </button>

        {/* Preset 3: Maximum Staff Welfare */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onApplyPreset('welfare_focus')}
          className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30 text-left transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-xs text-slate-900 group-hover:text-emerald-800">
                3. Staff Rest &amp; Equity
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-medium">
                Strict Protection
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Hard lockout on consecutive shifts (P1 &amp; P2 forbidden), strict 2-point delta fairness cap, max 1 daily shift.
            </p>
          </div>
          <div className="mt-3 text-[10px] font-bold text-emerald-700 flex items-center gap-1">
            <span>Apply Rest &amp; Equity Setup</span>
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </button>
      </div>
    </div>
  );
}
