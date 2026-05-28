'use client';

import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Staff } from '@/types/database.types';
import { GripVertical, ChevronDown, ChevronRight } from 'lucide-react';
import { useSchedulingStore } from '@/lib/stores/scheduling-store';

// Helper functions for calendar/availability grouping
function parseISODate(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function groupByAcademicWeek(
  specificOffDates: string[],
  allExamDates: string[]
): { weekStart: string; weekEnd: string; offDates: string[] }[] {
  if (!allExamDates.length) return [];

  // Collect unique week-starts from ALL exam dates
  const weekStartSet = new Set<string>();
  for (const iso of allExamDates) {
    const d = parseISODate(iso);
    const jsDay = d.getUTCDay();
    const daysSinceSat = (jsDay + 1) % 7;
    const satISO = new Date(d.getTime() - daysSinceSat * 86_400_000).toISOString().split('T')[0];
    weekStartSet.add(satISO);
  }

  const offDateSet = new Set(specificOffDates);

  return Array.from(weekStartSet)
    .sort()
    .map((satISO) => {
      const satD = parseISODate(satISO);
      const thuD = new Date(satD.getTime() + 5 * 86_400_000);
      // Collect specific off-dates that fall in this Sat-Thu week
      const weekOffDates: string[] = [];
      for (let i = 0; i < 6; i++) {
        const dayISO = new Date(satD.getTime() + i * 86_400_000).toISOString().split('T')[0];
        if (offDateSet.has(dayISO)) weekOffDates.push(dayISO);
      }
      return {
        weekStart: satISO,
        weekEnd:   thuD.toISOString().split('T')[0],
        offDates:  weekOffDates.sort(),
      };
    });
}

import { ExchangeOffDayModal } from './exchange-off-day-modal';

export function StaffItemUI({ staff, weeklyAssignmentsCount = 0, historicalScore = 0, isDragging = false, setNodeRef, listeners, attributes, style, examSessions }: any) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [exchangeModalData, setExchangeModalData] = useState<{ oldDate: string, weekDates: string[] } | null>(null);

  const examDates = Array.from(new Set((examSessions || []).map((e: any) => e.exam_date as string))) as string[];
  const weekGroups = groupByAcademicWeek((staff.specific_off_dates || []) as string[], examDates);

  return (
    <>
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col p-2 bg-white border rounded shadow-sm ${
        isDragging ? 'shadow-lg border-primary-500 ring-2 ring-primary-200 opacity-50' : 'hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-2 w-full cursor-grab" {...listeners} {...attributes}>
        <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <div className="flex-1 min-w-0 pr-1">
          <div className="text-sm font-medium text-gray-900 truncate">{staff.name}</div>
          <div className="text-xs text-gray-500 truncate">{staff.job_title}</div>
        </div>
        
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="bg-primary-100 text-primary-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full" title={`Workload score: ${historicalScore} (Assignments) + ${staff.free_staff_score || 0} (Reserves)`}>
            Score: {historicalScore}+{staff.free_staff_score || 0}
          </div>
          {weekGroups.length > 0 && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700 transition-colors"
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>
      
      {isExpanded && weekGroups.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-600 space-y-1.5 w-full overflow-x-auto">
          {/* Header row with short day initials */}
          <div className="flex items-center justify-between text-[8px] font-bold text-gray-400 px-1 uppercase tracking-wider">
            <span className="w-20 text-left">Week</span>
            <div className="flex gap-1.5">
              {['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'].map((day, idx) => (
                <span key={idx} className="w-5 text-center">{day}</span>
              ))}
            </div>
          </div>
          
          {/* Rows for each academic week */}
          {weekGroups.map((wk: any) => {
            const weekDates: Record<string, string> = {};
            const satD = parseISODate(wk.weekStart);
            const FULL_DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
            
            FULL_DAYS.forEach((day, i) => {
              const d = new Date(satD.getTime() + i * 86_400_000);
              weekDates[day] = d.toISOString().split('T')[0];
            });

            const startLabel = fmtShort(parseISODate(wk.weekStart));
            const endLabel = fmtShort(parseISODate(wk.weekEnd));

            return (
              <div key={wk.weekStart} className="flex items-center justify-between hover:bg-gray-50 py-0.5 rounded px-1">
                <span className="text-[9px] font-medium text-gray-500 w-20 truncate">{startLabel} – {endLabel}</span>
                <div className="flex gap-1.5">
                  {FULL_DAYS.map((day) => {
                    const isoForDay = weekDates[day];
                    const isWorkDay = staff.working_days?.includes(day);
                    const isSpecificOff = wk.offDates.includes(isoForDay);
                    const isNonWorking = !isWorkDay && !isSpecificOff;
                    const available = !isNonWorking && !isSpecificOff;

                    return (
                      <span
                        key={day}
                        onClick={isSpecificOff ? (e) => {
                          e.stopPropagation();
                          setExchangeModalData({ oldDate: isoForDay, weekDates: Object.values(weekDates) });
                        } : undefined}
                        title={isSpecificOff ? `Click to exchange off-day (${isoForDay})` : `${day}${isoForDay ? ` (${isoForDay})` : ''}: ${available ? 'Available' : 'Non-Working'}`}
                        className={`
                          inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold shrink-0
                          ${available
                            ? 'bg-green-100 text-green-700 ring-1 ring-green-300'
                            : isSpecificOff
                              ? 'bg-red-100 text-red-500 ring-1 ring-red-300 hover:bg-red-200 cursor-pointer transition-colors shadow-sm'
                              : 'bg-gray-100 text-gray-300'
                          }
                        `}
                      >
                        {available ? '✓' : isSpecificOff ? '✕' : '·'}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    {exchangeModalData && (
      <ExchangeOffDayModal
        staff={staff}
        oldDate={exchangeModalData.oldDate}
        weekDates={exchangeModalData.weekDates}
        examSessions={examSessions}
        onClose={() => setExchangeModalData(null)}
      />
    )}
    </>
  );
}

export function DraggableStaffItem({ staff, weeklyAssignmentsCount = 0, historicalScore = 0 }: { staff: Staff; weeklyAssignmentsCount?: number; historicalScore?: number }) {
  const { examSessions } = useSchedulingStore();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `staff-${staff.id}`,
    data: { type: 'staff', staff },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: isDragging ? 50 : 1,
  } : undefined;

  return (
    <StaffItemUI
      staff={staff}
      weeklyAssignmentsCount={weeklyAssignmentsCount}
      historicalScore={historicalScore}
      isDragging={isDragging}
      setNodeRef={setNodeRef}
      listeners={listeners}
      attributes={attributes}
      style={style}
      examSessions={examSessions}
    />
  );
}
