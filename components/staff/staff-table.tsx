'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Staff } from '@/types/database.types';
import { classifyOffDays } from '@/lib/algorithms/auto-assignment';
import { useMobileView } from '@/lib/hooks/use-mobile-view';
import { Loader2, Edit, Trash2, Baby, HeartPulse, ShieldCheck, ChevronDown, ChevronRight, CalendarDays, ArrowUpDown, ArrowUp, ArrowDown, MessageCircle, LayoutGrid, List } from 'lucide-react';

interface StaffTableProps {
  staff: Staff[];
  examDates?: string[];
  isLoading: boolean;
  onUpdate: () => void;
  onEdit: (staff: Staff) => void;
  onDelete: (staff: Staff) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const FULL_DAYS  = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'] as const;
const SHORT_DAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'] as const;

const supervisionRoleBadge: Record<string, string> = {
  'Invigilator':                   'bg-blue-100 text-blue-700',
  'Committees Supervisor':         'bg-purple-100 text-purple-700',
  'Exam Supervisor':               'bg-indigo-100 text-indigo-700',
  'Invigilator / Exam Supervisor': 'bg-teal-100 text-teal-700',
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Parse ISO YYYY-MM-DD at noon UTC to avoid timezone day-shifts */
function parseISODate(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

/** Format a Date as "3 Jun" */
function fmtShort(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** Get the weekday name (en-US) from an ISO date string */
function weekdayOf(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}

/**
 * Group exam period weeks using ALL known dates (not just off-dates),
 * so every week of the exam period appears as a row — including weeks
 * where a recurring off-day has no specific_off_date entry.
 */
function groupByAcademicWeek(
  specificOffDates: string[],
  specificStandardOffDates: string[],
  allExamDates: string[]
): { weekStart: string; weekEnd: string; offDates: string[]; standardOffDates: string[] }[] {
  if (!allExamDates.length) return [];

  // Collect unique week-starts from ALL exam dates
  const weekStartSet = new Set<string>();
  for (const ed of allExamDates) {
    if (!ed) continue;
    const d = parseISODate(ed);
    const jsDay = d.getUTCDay();
    const daysSinceSat = (jsDay + 1) % 7;
    const satISO = new Date(d.getTime() - daysSinceSat * 86_400_000).toISOString().split('T')[0];
    weekStartSet.add(satISO);
  }

  const offDateSet = new Set(specificOffDates);
  const standardOffSet = new Set(specificStandardOffDates);

  return Array.from(weekStartSet)
    .sort()
    .map((satISO) => {
      const satD = parseISODate(satISO);
      const thuD = new Date(satD.getTime() + 5 * 86_400_000);
      // Collect specific off-dates that fall in this Sat-Thu week
      const weekOffDates: string[] = [];
      const weekStandardOffDates: string[] = [];
      for (let i = 0; i < 6; i++) {
        const dayISO = new Date(satD.getTime() + i * 86_400_000).toISOString().split('T')[0];
        if (offDateSet.has(dayISO)) weekOffDates.push(dayISO);
        if (standardOffSet.has(dayISO)) weekStandardOffDates.push(dayISO);
      }
      return {
        weekStart: satISO,
        weekEnd:   thuD.toISOString().split('T')[0],
        offDates:  weekOffDates.sort(),
        standardOffDates: weekStandardOffDates.sort(),
      };
    });
}

// ─── Per-week availability row ────────────────────────────────────────────────

function WeekAvailabilityRow({
  weekStart,
  weekEnd,
  offDatesInWeek,
  standardOffDatesInWeek,
  workingDays,
  recurringOffDays,
  colSpanLeft,
  staffId,
  onToggleSpecificDate,
}: {
  weekStart: string;
  weekEnd: string;
  offDatesInWeek: string[];
  standardOffDatesInWeek: string[];
  workingDays: string[];
  /** Weekdays auto-classified as recurring non-working (off every week of exam period) */
  recurringOffDays: string[];
  colSpanLeft: number;
  staffId: string;
  onToggleSpecificDate?: (staffId: string, dateIso: string) => void;
}) {
  const weekDates: Record<string, string> = {};
  const satD = parseISODate(weekStart);
  FULL_DAYS.forEach((day, i) => {
    const d = new Date(satD.getTime() + i * 86_400_000);
    weekDates[day] = d.toISOString().split('T')[0];
  });

  const startLabel = fmtShort(parseISODate(weekStart));
  const endLabel   = fmtShort(parseISODate(weekEnd));

  return (
    <tr className="bg-indigo-50/40 border-b border-indigo-100">
      <td colSpan={colSpanLeft} className="px-4 py-1.5">
        <div className="flex items-center gap-1.5 pl-6">
          <CalendarDays className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="text-xs font-medium text-indigo-700 whitespace-nowrap">
            {startLabel} – {endLabel}
          </span>
        </div>
      </td>

      {FULL_DAYS.map((day) => {
        const isoForDay      = weekDates[day];
        const isRecurringOff = recurringOffDays.includes(day);
        const isWorkDay      = workingDays.includes(day);

        // It's a "strict specific off date" (red X) if it's explicitly in the offDatesInWeek array
        const isStrictOff  = offDatesInWeek.includes(isoForDay);
        
        // It's a "standard specific off date" (orange O) if it's explicitly in the standardOffDatesInWeek array
        const isStandardOff = standardOffDatesInWeek.includes(isoForDay);

        // Non-working = manual pattern says no (i.e. not in working_days database field)
        // BUT if it's explicitly a specific off date, we'll let that visual take precedence
        const isNonWorking   = !isWorkDay && !isStrictOff && !isStandardOff;
        
        const available      = !isNonWorking && !isStrictOff && !isStandardOff;

        const title = isStrictOff
          ? `${day} ${isoForDay} — strict day off (cannot be overridden)`
          : isStandardOff
            ? `${day} ${isoForDay} — standard day off (can be overridden by Universal Working Day)`
            : available
              ? `${day} — available`
              : isRecurringOff
                ? `${day} — non-working day (off every week of exam period)`
                : `${day} — non-working day`;

        return (
          <td key={day} className="px-1 py-1.5 text-center">
            <span
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleSpecificDate) onToggleSpecificDate(staffId, isoForDay);
              }}
              title={title}
              className={`
                inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold cursor-pointer hover:ring-2 hover:ring-primary-500 transition-all
                ${isStrictOff
                  ? 'bg-red-100 text-red-500 ring-1 ring-red-300'
                  : isStandardOff
                    ? 'bg-orange-100 text-orange-500 ring-1 ring-orange-300'
                    : available
                      ? 'bg-green-100 text-green-700 ring-1 ring-green-300'
                      : 'bg-gray-100 text-gray-300'
                }
              `}
            >
              {isStrictOff ? 'x' : isStandardOff ? 'o' : available ? '✓' : ''}
            </span>
          </td>
        );
      })}

      <td />
    </tr>
  );
}

// ─── Static weekday checkboxes (no specific off-dates) ────────────────────────

function StaticDayCells({ workingDays, staffId, onToggleWorkingDay }: { workingDays: string[], staffId: string, onToggleWorkingDay?: (staffId: string, day: string) => void }) {
  return (
    <>
      {FULL_DAYS.map((day) => {
        const isWorking = workingDays?.includes(day);
        return (
          <td key={day} className="px-1 py-3 whitespace-nowrap text-center">
            <div 
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleWorkingDay) onToggleWorkingDay(staffId, day);
              }}
              className={`w-4 h-4 mx-auto rounded border flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary-500 transition-all ${isWorking ? 'bg-primary-600 border-primary-600' : 'bg-red-100 border-red-300'}`}
            >
              {isWorking ? (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <span className="text-[10px] font-bold text-red-500 leading-none">✕</span>
              )}
            </div>
          </td>
        );
      })}
    </>
  );
}

// ─── Main Table ───────────────────────────────────────────────────────────────

type SortField = 'name' | 'job_title' | 'supervision_role' | 'current_score' | 'free_staff_score' | 'total_score' | 'availability_status' | 'conditions' | 'Saturday' | 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday';

export function StaffTable({ staff, examDates, isLoading, onUpdate, onEdit, onDelete, onSelectionChange }: StaffTableProps) {
  const [localStaff, setLocalStaff] = useState<Staff[]>(staff);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const { viewMode, toggleViewMode } = useMobileView();

  useEffect(() => {
    setLocalStaff(staff);
  }, [staff]);

  const handleToggleWorkingDay = async (staffId: string, day: string) => {
    if (!supabase) return;
    const currentDays = localStaff.find(s => s.id === staffId)?.working_days || [];
    const newDays = currentDays.includes(day) 
      ? currentDays.filter(d => d !== day) 
      : [...currentDays, day];
    
    setLocalStaff(prev => prev.map(s => s.id === staffId ? { ...s, working_days: newDays } : s));
    
    try {
      const { error } = await supabase.from('staff').update({ working_days: newDays }).eq('id', staffId);
      if (error) throw error;
      onUpdate();
    } catch (err) {
      console.error(err);
      setLocalStaff(staff); // revert
    }
  };

  const handleToggleSpecificDate = async (staffId: string, dateIso: string) => {
    if (!supabase) return;
    const staffMember = localStaff.find(s => s.id === staffId);
    if (!staffMember) return;
    
    const strictOff = staffMember.specific_off_dates || [];
    const standardOff = staffMember.specific_standard_off_dates || [];
    
    let newStrictOff = [...strictOff];
    let newStandardOff = [...standardOff];

    // State machine: Default -> Standard Off -> Strict Non-Working -> Default
    if (strictOff.includes(dateIso)) {
      // Transition: Strict Non-Working -> Default
      newStrictOff = newStrictOff.filter(d => d !== dateIso);
    } else if (standardOff.includes(dateIso)) {
      // Transition: Standard Off -> Strict Non-Working
      newStandardOff = newStandardOff.filter(d => d !== dateIso);
      newStrictOff.push(dateIso);
    } else {
      // Transition: Default -> Standard Off
      newStandardOff.push(dateIso);
    }
      
    setLocalStaff(prev => prev.map(s => s.id === staffId ? { 
      ...s, 
      specific_off_dates: newStrictOff,
      specific_standard_off_dates: newStandardOff
    } : s));
    
    try {
      const { error } = await supabase.from('staff').update({ 
        specific_off_dates: newStrictOff,
        specific_standard_off_dates: newStandardOff
      }).eq('id', staffId);
      if (error) throw error;
      onUpdate();
    } catch (err) {
      console.error(err);
      setLocalStaff(staff); // revert
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (staff.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No staff members found. Add your first staff member to get started.</p>
      </div>
    );
  }

  const getAvailabilityBadge = (status: string) => {
    const styles: Record<string, string> = {
      Available:   'bg-green-100 text-green-700',
      'On-Leave':  'bg-yellow-100 text-yellow-700',
      Unavailable: 'bg-red-100 text-red-700',
    };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };

  const toggleExpanded = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (onSelectionChange) onSelectionChange(Array.from(next));
      return next;
    });
  };

  const toggleAllSelection = () => {
    if (selectedIds.size === localStaff.length && localStaff.length > 0) {
      setSelectedIds(new Set());
      if (onSelectionChange) onSelectionChange([]);
    } else {
      const allIds = new Set(localStaff.map(s => s.id));
      setSelectedIds(allIds);
      if (onSelectionChange) onSelectionChange(Array.from(allIds));
    }
  };

  const getSortedStaff = () => {
    const arr = [...localStaff];
    if (!sortField) return arr;

    return arr.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortField) {
        case 'name':
          valA = (a.name || '').toLowerCase();
          valB = (b.name || '').toLowerCase();
          break;
        case 'job_title':
          valA = `${a.job_title || ''} ${a.employment_status || ''}`.toLowerCase();
          valB = `${b.job_title || ''} ${b.employment_status || ''}`.toLowerCase();
          break;
        case 'supervision_role':
          valA = (a.supervision_role || '').toLowerCase();
          valB = (b.supervision_role || '').toLowerCase();
          break;
        case 'current_score':
          valA = a.current_score || 0;
          valB = b.current_score || 0;
          break;
        case 'free_staff_score':
          valA = a.free_staff_score || 0;
          valB = b.free_staff_score || 0;
          break;
        case 'total_score':
          valA = (a.current_score || 0) + ((a.free_staff_score || 0) * 0.25);
          valB = (b.current_score || 0) + ((b.free_staff_score || 0) * 0.25);
          break;
        case 'availability_status':
          valA = (a.availability_status || '').toLowerCase();
          valB = (b.availability_status || '').toLowerCase();
          break;
        case 'conditions':
          valA = (a.is_overloaded ? 4 + (a.overload_percentage / 100) : 0) + (a.is_feeding_mother ? 2 : 0) + (a.has_health_issue ? 1 : 0) + (a.can_supervise_oral ? 0.5 : 0);
          valB = (b.is_overloaded ? 4 + (b.overload_percentage / 100) : 0) + (b.is_feeding_mother ? 2 : 0) + (b.has_health_issue ? 1 : 0) + (b.can_supervise_oral ? 0.5 : 0);
          break;
        case 'Saturday':
        case 'Sunday':
        case 'Monday':
        case 'Tuesday':
        case 'Wednesday':
        case 'Thursday':
          valA = a.working_days?.includes(sortField) ? 1 : 0;
          valB = b.working_days?.includes(sortField) ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const renderHeader = (field: SortField, label: string, align: 'left' | 'center' = 'left', tooltip?: string, padding: string = 'px-4 py-3') => {
    const isSorted = sortField === field;
    const isCenter = align === 'center';
      return (
        <th 
          key={field}
          onClick={() => handleSort(field)}
          className={`${padding} text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100 hover:text-gray-700 transition-colors bg-gray-50 ${isCenter ? 'text-center' : 'text-left'}`}
          title={tooltip}
        >
        <div className={`flex items-center gap-1.5 ${isCenter ? 'justify-center' : ''}`}>
          <span>{label}</span>
          <span className="shrink-0 text-gray-400">
            {isSorted ? (
              sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary-600" /> : <ArrowDown className="w-3.5 h-3.5 text-primary-600" />
            ) : (
              <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
            )}
          </span>
        </div>
      </th>
    );
  };

  const sortedStaff = getSortedStaff();

  // Number of columns before the day matrix (Name, Job, Role, Score, Free, Total, Status, Conditions)
  const LEFT_COLS = 9;

    return (
      <div className="flex flex-col w-full">
        {/* Mobile View Toggle */}
        <div className="md:hidden flex justify-end mb-3">
          <button onClick={toggleViewMode} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
            {viewMode === 'standard' ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
            {viewMode === 'standard' ? 'Compact View' : 'Standard View'}
          </button>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden flex flex-col gap-4 pb-4">
          {sortedStaff.map((member) => {
            const hasOffDates = (member.specific_off_dates?.length ?? 0) > 0;
            const canExpand = examDates && examDates.length > 0;
            const isExpanded  = expanded.has(member.id);

            const allKnownDates = examDates && examDates.length > 0
              ? examDates
              : Array.from(new Set(localStaff.flatMap((s) => s.specific_off_dates ?? [])));

            const { recurringOffDays } = hasOffDates
              ? classifyOffDays(member.specific_off_dates, allKnownDates)
              : { recurringOffDays: [] as string[] };

            const weekGroups = canExpand
              ? groupByAcademicWeek(member.specific_off_dates || [], member.specific_standard_off_dates || [], allKnownDates)
              : [];

            if (viewMode === 'compact') {
              return (
                <div key={member.id} className={`bg-white rounded-lg border ${selectedIds.has(member.id) ? 'border-primary-400 ring-1 ring-primary-400' : 'border-gray-200'} shadow-sm flex items-center p-3 gap-3 transition-all`} onClick={canExpand ? () => toggleExpanded(member.id) : undefined}>
                  <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-4 h-4" checked={selectedIds.has(member.id)} onChange={() => toggleSelection(member.id)} onClick={e => e.stopPropagation()} />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-bold text-gray-900 text-sm truncate">{member.name}</span>
                    <span className="text-xs text-gray-500 truncate">{member.job_title} • {member.supervision_role}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{member.current_score || 0}</span>
                    <span className={`w-2 h-2 rounded-full ${member.availability_status === 'Available' ? 'bg-green-500' : member.availability_status === 'On-Leave' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                  </div>
                </div>
              );
            }

            return (
              <div key={member.id} className={`bg-white rounded-xl border ${selectedIds.has(member.id) ? 'border-primary-400 ring-1 ring-primary-400' : 'border-gray-200'} shadow-sm flex flex-col overflow-hidden transition-all`}>
                <div className="p-4 flex flex-col gap-3">
                  <div className="flex items-start gap-3 border-b border-gray-100 pb-3">
                    <div className="pt-1">
                      <input type="checkbox" checked={selectedIds.has(member.id)} onChange={() => toggleSelection(member.id)} className="w-5 h-5 text-primary-600 rounded border-gray-300 focus:ring-primary-500" />
                    </div>
                    <div className="flex-1 min-w-0" onClick={canExpand ? () => toggleExpanded(member.id) : undefined}>
                      <div className="flex justify-between items-start gap-2">
                        <div className="font-bold text-gray-900 truncate">{member.name}</div>
                        <span className={`shrink-0 inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${getAvailabilityBadge(member.availability_status)}`}>
                          {member.availability_status === 'Available' ? 'Avail' : member.availability_status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 truncate mt-0.5" title={`${member.job_title} - ${member.employment_status}`}>{member.job_title} • {member.employment_status}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-2 bg-gray-50 rounded-lg border border-gray-100 px-3">
                    <div className="text-center">
                      <div className="text-[10px] text-gray-500 uppercase font-semibold">Score</div>
                      <div className="font-bold text-gray-900">{member.current_score}</div>
                    </div>
                    <div className="text-center border-l border-gray-200">
                      <div className="text-[10px] text-gray-500 uppercase font-semibold">Resv</div>
                      <div className="font-bold text-gray-600">{member.free_staff_score || 0}</div>
                    </div>
                    <div className="text-center border-l border-gray-200">
                      <div className="text-[10px] text-primary-600 uppercase font-semibold">Total</div>
                      <div className="font-bold text-primary-700">{(member.current_score || 0) + ((member.free_staff_score || 0) * 0.25)}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded ${supervisionRoleBadge[member.supervision_role] ?? 'bg-gray-100 text-gray-700'}`}>
                      <ShieldCheck className="w-3 h-3" />
                      {member.supervision_role?.replace('Supervisor', 'Sprv')}
                    </span>
                    {member.is_overloaded && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-medium">OL·{member.overload_percentage}%</span>}
                    {member.is_feeding_mother && <span className="bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded text-[10px] font-medium">FM·{member.feeding_mother_days}d</span>}
                    {member.has_health_issue && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-medium">M/P</span>}
                    {member.can_supervise_oral && <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-[10px] font-medium">Oral</span>}
                  </div>

                  {/* Day Pills Matrix */}
                  <div className="mt-1 pt-3 border-t border-gray-100 flex items-center justify-between px-1">
                    {FULL_DAYS.map((day, idx) => {
                      const isWorking = member.working_days?.includes(day);
                      return (
                        <div key={day} className="flex flex-col items-center gap-1">
                          <span className="text-[10px] font-semibold text-gray-400">{SHORT_DAYS[idx]}</span>
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleWorkingDay(member.id, day);
                            }}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${isWorking ? 'bg-primary-100 border-primary-500' : 'bg-red-50 border-red-200'}`}
                          >
                            {isWorking ? (
                              <svg className="w-3.5 h-3.5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <span className="text-xs font-bold text-red-400 leading-none">✕</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-2 pt-3 border-t border-gray-100 flex justify-between items-center">
                    {canExpand ? (
                      <button onClick={() => toggleExpanded(member.id)} className="text-indigo-600 text-xs font-semibold flex items-center gap-1 bg-indigo-50 px-2 py-1.5 rounded hover:bg-indigo-100">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        {isExpanded ? 'Hide Weeks' : 'Show Weeks'}
                      </button>
                    ) : (
                      <div />
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => onEdit(member)} className="p-1.5 text-primary-600 hover:text-primary-900 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onDelete(member)} className="p-1.5 text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Weeks */}
                {canExpand && isExpanded && (
                  <div className="bg-gray-50 border-t border-gray-200 divide-y divide-gray-200">
                    {weekGroups.map((wg) => (
                      <div key={wg.weekStart} className="p-3 px-4">
                        <div className="flex items-center gap-1.5 mb-2 text-indigo-700 font-medium text-[11px] uppercase tracking-wider">
                          <CalendarDays className="w-3 h-3" />
                          {fmtShort(parseISODate(wg.weekStart))} – {fmtShort(parseISODate(wg.weekEnd))}
                        </div>
                        <div className="flex justify-between items-center px-1">
                          {FULL_DAYS.map((day) => {
                            const satD = parseISODate(wg.weekStart);
                            const i = FULL_DAYS.indexOf(day);
                            const d = new Date(satD.getTime() + i * 86_400_000);
                            const isoForDay = d.toISOString().split('T')[0];

                            const isRecurringOff = recurringOffDays.includes(day);
                            const isWorkDay = member.working_days?.includes(day);
                            const isStrictOff = wg.offDates.includes(isoForDay);
                            const isStandardOff = wg.standardOffDates.includes(isoForDay);
                            const isNonWorking = !isWorkDay && !isStrictOff && !isStandardOff;
                            const available = !isNonWorking && !isStrictOff && !isStandardOff;

                            return (
                              <div
                                key={day}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleSpecificDate(member.id, isoForDay);
                                }}
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer transition-all ${
                                  isStrictOff ? 'bg-red-100 text-red-500 ring-1 ring-red-300' :
                                  isStandardOff ? 'bg-orange-100 text-orange-500 ring-1 ring-orange-300' :
                                  available ? 'bg-green-100 text-green-700 ring-1 ring-green-300' :
                                  'bg-gray-200 text-gray-400'
                                }`}
                              >
                                {isStrictOff ? 'x' : isStandardOff ? 'o' : available ? '✓' : ''}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block w-full overflow-x-auto border-b border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 sticky top-0 z-20 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]">
            <tr>
              <th className="px-4 py-3 text-left w-10">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-4 h-4 cursor-pointer"
                  checked={localStaff.length > 0 && selectedIds.size === localStaff.length}
                  onChange={toggleAllSelection}
                />
              </th>
              {renderHeader('name', 'Name', 'left', undefined, 'px-2 py-2')}
            {renderHeader('job_title', 'Job', 'left', undefined, 'px-2 py-2')}
            {renderHeader('supervision_role', 'Role', 'left', undefined, 'px-2 py-2')}
            {renderHeader('current_score', 'Score', 'center', 'Workload score', 'px-1 py-2')}
            {renderHeader('free_staff_score', 'Resv', 'center', 'Reserve score', 'px-1 py-2')}
            {renderHeader('total_score', 'Tot', 'center', 'Total score', 'px-1 py-2')}
            {renderHeader('availability_status', 'Status', 'left', undefined, 'px-2 py-2')}
            {renderHeader('conditions', 'Conds', 'left', undefined, 'px-2 py-2')}
              {SHORT_DAYS.map((d, index) => {
                const fullDay = FULL_DAYS[index];
                return renderHeader(fullDay, d, 'center', undefined, 'px-1 py-2');
              })}
              <th className="px-2 py-2 text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider select-none bg-gray-50">Actions</th>
            </tr>
          </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedStaff.map((member) => {
            const hasOffDates = (member.specific_off_dates?.length ?? 0) > 0;
            const canExpand = examDates && examDates.length > 0;
            const isExpanded  = expanded.has(member.id);

            // Use the real exam-session dates if available; fallback to the union of all off-dates
            const allKnownDates = examDates && examDates.length > 0
              ? examDates
              : Array.from(new Set(localStaff.flatMap((s) => s.specific_off_dates ?? [])));

            const { recurringOffDays } = hasOffDates
              ? classifyOffDays(member.specific_off_dates, allKnownDates)
              : { recurringOffDays: [] as string[] };

            const weekGroups = canExpand
              ? groupByAcademicWeek(member.specific_off_dates || [], member.specific_standard_off_dates || [], allKnownDates)
              : [];

            return (
              <Fragment key={member.id}>
                {/* ── Main staff row ── */}
                <tr
                  className={`hover:bg-gray-50 ${canExpand ? 'cursor-pointer' : ''} ${selectedIds.has(member.id) ? 'bg-primary-50/30' : ''}`}
                  onClick={canExpand ? () => toggleExpanded(member.id) : undefined}
                >
                  <td className="px-2 py-2 w-10" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-4 h-4 cursor-pointer"
                      checked={selectedIds.has(member.id)}
                      onChange={() => toggleSelection(member.id)}
                    />
                  </td>
                  {/* Name + email */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {canExpand && (
                        <span className="text-indigo-400 flex-shrink-0">
                          {isExpanded
                            ? <ChevronDown className="w-3.5 h-3.5" />
                            : <ChevronRight className="w-3.5 h-3.5" />}
                        </span>
                      )}
                      <div>
                        <div className="font-medium text-gray-900">{member.name}</div>
                        <div className="text-xs text-gray-400">{member.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* Job Title + Employment */}
                  <td className="px-2 py-2">
                    <div className="text-gray-900 text-xs leading-tight line-clamp-2" title={`${member.job_title} - ${member.employment_status}`}>
                      {member.job_title}
                      <span className="block text-[10px] text-gray-400">{member.employment_status}</span>
                    </div>
                  </td>

                  {/* Supervision Role */}
                  <td className="px-2 py-2 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full ${supervisionRoleBadge[member.supervision_role] ?? 'bg-gray-100 text-gray-700'}`}>
                      <ShieldCheck className="w-3 h-3" />
                      {member.supervision_role?.replace('Supervisor', 'Sprv')}
                    </span>
                  </td>

                  {/* Score */}
                  <td className="px-1 py-2 whitespace-nowrap text-center">
                    <span className="font-semibold text-gray-900">{member.current_score}</span>
                  </td>

                  {/* Free Score */}
                  <td className="px-1 py-2 whitespace-nowrap text-center">
                    <span className="text-gray-600">{member.free_staff_score || 0}</span>
                  </td>

                  {/* Total Score */}
                  <td className="px-1 py-2 whitespace-nowrap text-center">
                    <span className="font-bold text-primary-600">{(member.current_score || 0) + ((member.free_staff_score || 0) * 0.25)}</span>
                  </td>

                  {/* Availability Status */}
                  <td className="px-2 py-2 whitespace-nowrap">
                    <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${getAvailabilityBadge(member.availability_status)}`}>
                      {member.availability_status === 'Available' ? 'Avail' : member.availability_status}
                    </span>
                  </td>

                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {member.is_overloaded && (
                        <span title={`Overloaded — decrease workload score priority by ${member.overload_percentage}%`}
                          className="flex items-center gap-0.5 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-xs font-medium">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          OL{member.overload_percentage > 0 ? `·${member.overload_percentage}%` : ''}
                        </span>
                      )}
                      {member.is_feeding_mother && (
                        <span title={`Feeding mother — ${member.feeding_mother_days} days/week early leave`}
                          className="flex items-center gap-0.5 bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded text-xs font-medium">
                          <Baby className="w-3 h-3" />
                          FM{member.feeding_mother_days > 0 ? `·${member.feeding_mother_days}d` : ''}
                        </span>
                      )}
                      {member.has_health_issue && (
                        <span title="Health issue — prefers M/P buildings (near pharmacy)"
                          className="flex items-center gap-0.5 bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-medium">
                          <HeartPulse className="w-3 h-3" />
                          M/P
                        </span>
                      )}
                      {member.can_supervise_oral && (
                        <span title="Can supervise Oral Exams"
                          className="flex items-center gap-0.5 bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-[10px] font-medium border border-orange-200">
                          <MessageCircle className="w-3 h-3" />
                          Oral
                        </span>
                      )}
                      {!member.is_feeding_mother && !member.has_health_issue && !member.is_overloaded && !member.can_supervise_oral && (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </div>
                  </td>

                  {/* Weekday matrix — static if no off-dates, summary if has off-dates */}
                  {canExpand ? (
                    FULL_DAYS.map((day) => {
                      const isWorking = member.working_days?.includes(day);
                      return (
                        <td key={day} className="px-1 py-3 whitespace-nowrap text-center">
                          <div
                            title={`${day}: ${isWorking ? 'working day (may have specific off-dates — click to expand)' : 'non-working day'}`}
                            className={`w-4 h-4 mx-auto rounded border flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary-500 transition-all ${isWorking ? 'bg-primary-200 border-primary-300' : 'bg-red-50 border-red-200'}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleWorkingDay(member.id, day);
                            }}
                          >
                            {isWorking ? (
                              <svg className="w-3 h-3 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <span className="text-[10px] font-bold text-red-400 leading-none">✕</span>
                            )}
                          </div>
                        </td>
                      );
                    })
                  ) : (
                    <StaticDayCells workingDays={member.working_days || []} staffId={member.id} onToggleWorkingDay={handleToggleWorkingDay} />
                  )}

                  {/* Actions */}
                  <td className="px-2 py-2 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <button onClick={() => onEdit(member)} className="p-1.5 text-primary-600 hover:text-primary-900 hover:bg-primary-50 rounded transition-colors" title="Edit staff member">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => onDelete(member)} className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors" title="Delete staff member">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>

                {/* ── Per-week availability rows (expanded) ── */}
                {canExpand && isExpanded && weekGroups.map((wg) => (
                  <WeekAvailabilityRow
                    key={wg.weekStart}
                    weekStart={wg.weekStart}
                    weekEnd={wg.weekEnd}
                    offDatesInWeek={wg.offDates}
                    standardOffDatesInWeek={wg.standardOffDates}
                    workingDays={member.working_days || []}
                    recurringOffDays={recurringOffDays}
                    colSpanLeft={LEFT_COLS}
                    staffId={member.id}
                    onToggleSpecificDate={handleToggleSpecificDate}
                  />
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 px-2 pb-1 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-primary-600 border border-primary-600 inline-flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </span>
          Working day
        </span>
        <span className="flex items-center gap-1">
          <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 ring-1 ring-green-300 inline-flex items-center justify-center text-[10px] font-bold">✓</span>
          Available this week
        </span>
        <span className="flex items-center gap-1">
          <span className="w-5 h-5 rounded-full bg-red-100 text-red-500 ring-1 ring-red-300 inline-flex items-center justify-center text-[10px] font-bold">✕</span>
          Specific day off
        </span>
        <span className="flex items-center gap-1">
          <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-300 inline-flex items-center justify-center text-[10px] font-bold">·</span>
          Non-working day
        </span>
        <span className="ml-auto flex items-center gap-1 italic">
          <ChevronRight className="w-3 h-3" /> Click staff with week-based schedules to expand
        </span>
      </div>
    </div>
    </div>
  );
}
