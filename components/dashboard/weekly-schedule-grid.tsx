'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { format, addDays } from 'date-fns';
import { ExamSessionWithRelations, Staff, getPeriodFromTime } from '@/types/database.types';
import { SessionDetailModal } from './session-detail-modal';
import { PeriodReservesModal } from './period-reserves-modal';
import { supabase, isSupabaseConfigured, getSupabaseConfigStatus } from '@/lib/supabase/client';
import {
  Loader2, AlertCircle, AlertTriangle, Filter, ChevronDown,
  ChevronRight, Users, BookOpen, Clock, Building2, CheckCircle2,
  XCircle, Search, X
} from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SetupRequired } from '@/components/setup-required';
import { useSchedulingStore } from '@/lib/stores/scheduling-store';
import { cn } from '@/lib/utils/cn';
import { calculateRequiredStaff } from '@/lib/algorithms/auto-assignment';

import type { CalendarRule } from '@/types/database.types';

const isOffDay = (dateStr: string, staff?: Staff, calendarRules: CalendarRule[] = []) => {
  if (!staff) return false;
  
  // 1. Strict specific off dates ALWAYS trigger the warning
  if (staff.specific_off_dates?.includes(dateStr)) return true;

  // 2. Check if it's a Universal Working Day
  const isUniversalRaw = calendarRules.some(r => r.is_universal_working_day && r.start_date <= dateStr && r.end_date >= dateStr);
  const isUniversal = isUniversalRaw && staff.supervision_role !== 'Committees Supervisor';

  // If it's legally overridden by Universal Working Day, DO NOT flag it as an off day (violation)
  if (isUniversal) return false;

  // 3. If not overridden, check standard off dates
  if (staff.specific_standard_off_dates?.includes(dateStr)) return true;

  // 4. If not overridden, check normal weekday pattern
  const dayOfWeek = new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  if (staff.working_days && !staff.working_days.includes(dayOfWeek)) return true;

  return false;
};

/** Returns true when a Universal Working Day legally overrode a standard off-day — flag orange for tracking */
const isOverriddenDay = (dateStr: string, staff?: Staff, calendarRules: CalendarRule[] = []) => {
  if (!staff) return false;
  // Only applies when there IS a Universal Working Day
  const isUniversalRaw = calendarRules.some(r => r.is_universal_working_day && r.start_date <= dateStr && r.end_date >= dateStr);
  if (!isUniversalRaw) return false;
  // Does not apply to Committees Supervisors (they are exempt from Universal Working Days)
  if (staff.supervision_role === 'Committees Supervisor') return false;
  // Check if this day would have been a standard off-day
  if (staff.specific_standard_off_dates?.includes(dateStr)) return true;
  const dayOfWeek = new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  if (staff.working_days && !staff.working_days.includes(dayOfWeek)) return true;
  return false;
};

interface WeeklyScheduleGridProps {
  weekStart: Date;
}

const PERIOD_LABELS: Record<number, { label: string; time: string; color: string; bg: string; border: string }> = {
  1: { label: 'Period 1', time: '09:00 – 11:00', color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-300' },
  2: { label: 'Period 2', time: '13:00 – 15:00', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-300' },
  3: { label: 'Period 3', time: '15:45 – 17:45', color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-300' },
};

export function WeeklyScheduleGrid({ weekStart }: WeeklyScheduleGridProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<ExamSessionWithRelations | null>(null);
  const [selectedPeriodForReserves, setSelectedPeriodForReserves] = useState<{ dateStr: string; period: number; startTime: string } | null>(null);
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const [collapsedPeriods, setCollapsedPeriods] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unassigned' | 'conflicts'>('all');
  const [selectedBuilding, setSelectedBuilding] = useState<string>('all');

  const {
    examSessions,
    setExamSessions,
    setStaff,
    setRooms,
    systemSettings,
    setSystemSettings,
    staffingRatios,
    setStaffingRatios,
    getSessionConflicts,
    conflicts,
    getAvailableStaff,
    periodFreeStaff,
    setPeriodFreeStaff,
  } = useSchedulingStore();

  const activeSession = useMemo(() => {
    if (!selectedSession) return null;
    return examSessions.find(s => s.id === selectedSession.id) || selectedSession;
  }, [examSessions, selectedSession]);

  const availableStaff = useMemo(() => {
    if (!activeSession) return [];
    return getAvailableStaff(activeSession.exam_date, getPeriodFromTime(activeSession.start_time));
  }, [activeSession, getAvailableStaff]);

  const configStatus = getSupabaseConfigStatus();

  const loadData = useCallback(async () => {
    if (!supabase) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    try {
      const weekEnd = addDays(weekStart, 6);
      const startStr = format(weekStart, 'yyyy-MM-dd');
      const endStr = format(weekEnd, 'yyyy-MM-dd');

      const [sessionsRes, staffRes, settingsRes, roomsRes, freeStaffRes] = await Promise.all([
        supabase.from('exam_sessions')
          .select('*, room:rooms(*), assignments(*, staff:staff(*))')
          .gte('exam_date', startStr).lt('exam_date', endStr)
          .order('exam_date').order('start_time').order('subject_name'),
        supabase.from('staff').select('*').order('name'),
        supabase.from('system_settings').select('*').not('setting_key', 'like', 'backup_%'),
        supabase.from('rooms').select('*').order('room_name'),
        supabase.from('period_free_staff')
          .select('*, staff:staff(*)')
          .gte('exam_date', startStr).lt('exam_date', endStr)
          .order('exam_date').order('period'),
      ]);

      if (sessionsRes.error) throw sessionsRes.error;
      if (staffRes.error) throw staffRes.error;
      if (roomsRes.error) throw roomsRes.error;
      if (freeStaffRes.error) throw freeStaffRes.error;

      setSystemSettings(settingsRes.data || []);
      setExamSessions(sessionsRes.data || []);
      setStaff(staffRes.data || []);
      setRooms(roomsRes.data || []);
      setPeriodFreeStaff(freeStaffRes.data || []);
      
      const staffingRatiosSetting = settingsRes.data?.find(s => s.setting_key === 'staffing_ratios');
      if (staffingRatiosSetting?.setting_value?.ranges) {
        setStaffingRatios(staffingRatiosSetting.setting_value.ranges);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [weekStart, setExamSessions, setStaff, setRooms, setSystemSettings, setStaffingRatios, setPeriodFreeStaff]);

  useEffect(() => {
    if (isSupabaseConfigured()) loadData();
    else setIsLoading(false);
  }, [loadData]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = examSessions.length;
    
    const ratiosSetting = systemSettings.find(s => s.setting_key === 'staffing_ratios');
    const fullStaffingRatiosConfig = ratiosSetting?.setting_value || { ranges: staffingRatios };
    const calendarRulesSetting = systemSettings.find(s => s.setting_key === 'calendar_rules');
    const calendarRules = calendarRulesSetting?.setting_value || [];

    let fullyStaffed = 0;
    examSessions.forEach(s => {
      const assignedCount = s.assignments?.length ?? 0;
      const isOral = !!s.exam_type?.toLowerCase().includes('oral');
      const req = calculateRequiredStaff(s.student_count || 0, fullStaffingRatiosConfig, isOral, s.exam_date, calendarRules);
      const required = isOral ? 1 : (req.headSupervisors + req.assistants + 1);
      if (assignedCount >= required) fullyStaffed++;
    });

    const needsStaff = total - fullyStaffed;

    const totalConflicts = Array.from(conflicts.values()).filter(c => c.length > 0).length;
    const errorConflicts = Array.from(conflicts.values()).filter(c => c.some(err => err.severity === 'error')).length;
    const buildings = [...new Set(examSessions.map(s => s.room?.building_code || s.room?.building || '?'))].sort();
    return { total, fullyStaffed, needsStaff, totalConflicts, errorConflicts, buildings };
  }, [examSessions, conflicts, staffingRatios, systemSettings]);

  // ── Filtered sessions ─────────────────────────────────────────────────────
  const filteredSessions = useMemo(() => {
    return examSessions.filter(s => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!s.subject_name.toLowerCase().includes(q) &&
            !s.room?.room_name?.toLowerCase().includes(q)) return false;
      }
      if (filterStatus === 'unassigned' && (s.assignments?.length ?? 0) > 0) return false;
      if (filterStatus === 'conflicts' && getSessionConflicts(s.id).length === 0) return false;
      if (selectedBuilding !== 'all') {
        const bld = s.room?.building_code || s.room?.building || '?';
        if (bld !== selectedBuilding) return false;
      }
      return true;
    });
  }, [examSessions, searchQuery, filterStatus, selectedBuilding, getSessionConflicts]);

  const calendarRulesSetting = systemSettings?.find((s: any) => s.setting_key === 'calendar_rules');
  const calendarRules = calendarRulesSetting?.setting_value || [];

  // ── Group by date → period → sessions ────────────────────────────────────
  const groupedByDate = useMemo(() => {
    const days = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i));
    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const daySessions = filteredSessions.filter(s => s.exam_date === dateStr);
      const periods = [1, 2, 3].map(p => ({
        period: p,
        sessions: daySessions.filter(s => getPeriodFromTime(s.start_time) === p),
      })).filter(g => g.sessions.length > 0);
      return { day, dateStr, periods, totalSessions: daySessions.length };
    }).filter(d => d.totalSessions > 0);
  }, [filteredSessions, weekStart]);

  const toggleDay = (dateStr: string) => {
    setCollapsedDays(prev => {
      const next = new Set(prev);
      next.has(dateStr) ? next.delete(dateStr) : next.add(dateStr);
      return next;
    });
  };

  const togglePeriod = (key: string) => {
    setCollapsedPeriods(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleSessionClick = (session: ExamSessionWithRelations) => {
    setSelectedSession(session);
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  if (!configStatus.configured) return <SetupRequired configStatus={configStatus} />;

  if (isLoading) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-96 text-center">
      <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Data</h3>
      <p className="text-gray-600 mb-4">{error}</p>
      <button onClick={loadData} className="btn btn-primary px-4 py-2">Try Again</button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* ── Stats Bar ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg"><BookOpen className="w-4 h-4 text-blue-600" /></div>
          <div><p className="text-xs text-gray-500">Total Exams</p><p className="text-lg font-bold text-gray-900">{stats.total}</p></div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3">
          <div className="p-2 bg-green-50 rounded-lg"><CheckCircle2 className="w-4 h-4 text-green-600" /></div>
          <div><p className="text-xs text-gray-500">Fully Staffed</p><p className="text-lg font-bold text-green-700">{stats.fullyStaffed}</p></div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3">
          <div className="p-2 bg-orange-50 rounded-lg"><XCircle className="w-4 h-4 text-orange-500" /></div>
          <div><p className="text-xs text-gray-500">Needs Staff</p><p className="text-lg font-bold text-orange-600">{stats.needsStaff}</p></div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3">
          <div className="p-2 bg-red-50 rounded-lg"><AlertTriangle className="w-4 h-4 text-red-500" /></div>
          <div><p className="text-xs text-gray-500">Conflicts</p><p className="text-lg font-bold text-red-600">{stats.totalConflicts}</p></div>
        </div>
      </div>

      {/* ── Filter Bar ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search subject, code, room…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input pl-9 pr-8 w-full text-sm"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {(['all', 'unassigned', 'conflicts'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={`px-3 py-1.5 capitalize ${filterStatus === f ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Building filter */}
        {stats.buildings.length > 1 && (
          <select
            value={selectedBuilding}
            onChange={e => setSelectedBuilding(e.target.value)}
            className="input text-sm py-1.5"
          >
            <option value="all">All Buildings</option>
            {stats.buildings.map(b => <option key={b} value={b}>Building {b}</option>)}
          </select>
        )}

        <span className="text-sm text-gray-500 ml-auto">
          Showing <strong>{filteredSessions.length}</strong> / {stats.total} exams
        </span>
      </div>

      {/* ── Empty State ─────────────────────────────────────────────────────── */}
      {groupedByDate.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 py-20 text-center">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No exam sessions this week</p>
          <p className="text-sm text-gray-400 mt-1">Navigate to another week or adjust your filters</p>
        </div>
      )}

      {/* ── Schedule List ────────────────────────────────────────────────────── */}
      {groupedByDate.map(({ day, dateStr, periods, totalSessions }) => {
        const isDayCollapsed = collapsedDays.has(dateStr);
        return (
          <div key={dateStr} className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            {/* Day Header */}
            <button
              onClick={() => toggleDay(dateStr)}
              className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isDayCollapsed ? <ChevronRight className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                <div className="text-left">
                  <div className="font-bold text-gray-900">{format(day, 'EEEE')}</div>
                  <div className="text-xs text-gray-500">{format(day, 'MMMM d, yyyy')}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-medium">
                  {totalSessions} exam{totalSessions !== 1 ? 's' : ''}
                </span>
              </div>
            </button>

            {/* Period Groups */}
            {!isDayCollapsed && (
              <div className="divide-y divide-gray-100">
                {periods.map(({ period, sessions }) => {
                  const periodInfo = PERIOD_LABELS[period] || { label: `Period ${period}`, time: '', color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' };
                  const periodKey = `${dateStr}-${period}`;
                  const isPeriodCollapsed = collapsedPeriods.has(periodKey);
                  const pFreeStaff = periodFreeStaff.filter(fs => fs.exam_date === dateStr && fs.period === period);

                  return (
                    <div key={periodKey}>
                      {/* Period sub-header */}
                      <button
                        onClick={() => togglePeriod(periodKey)}
                        className={`w-full flex items-center justify-between px-5 py-2.5 ${periodInfo.bg} hover:opacity-90 transition-colors`}
                      >
                        <div className="flex items-center gap-2">
                          {isPeriodCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                          <Clock className={`w-3.5 h-3.5 ${periodInfo.color}`} />
                          <span className={`text-sm font-semibold ${periodInfo.color}`}>{periodInfo.label}</span>
                          <span className="text-xs text-gray-500">{periodInfo.time}</span>
                        </div>

                        {/* Free Staff List */}
                        <div className="hidden sm:flex flex-wrap items-center gap-2 flex-1 mx-6 justify-start">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const firstSession = sessions.length > 0 ? sessions[0] : null;
                              const startTime = firstSession ? firstSession.start_time : (period === 1 ? '09:00:00' : period === 2 ? '13:00:00' : '15:45:00');
                              setSelectedPeriodForReserves({ dateStr, period, startTime });
                            }}
                            className="flex items-center gap-1 text-[10px] uppercase font-bold text-gray-500 hover:text-primary-600 transition-colors bg-white border border-gray-200 px-2 py-0.5 rounded shadow-sm"
                          >
                            Edit Reserves
                          </button>
                          {pFreeStaff.length > 0 && (
                            <>
                              <span className="text-[10px] uppercase font-bold text-gray-400">Reserves:</span>
                              {pFreeStaff.map((pfs) => {
                                const isConflict = examSessions.some(s => 
                                  s.exam_date === dateStr && 
                                  getPeriodFromTime(s.start_time) === period && 
                                  s.assignments?.some(a => a.staff_id === pfs.staff_id)
                                );
                                return (
                                  <span
                                    key={pfs.id}
                                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                      isConflict
                                        ? 'bg-red-100 text-red-700 border border-red-300 line-through decoration-red-400'
                                        : pfs.role === 'Exam_Supervisor'
                                          ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                                          : 'bg-blue-100 text-blue-700 border border-blue-200'
                                    }`}
                                    title={isConflict ? "Conflict: Already assigned in this period" : `${pfs.staff?.name || 'Unknown'} (${pfs.role === 'Exam_Supervisor' ? 'Supervisor' : 'Invigilator'})`}
                                  >
                                    {pfs.staff?.name?.split(' ')[0]} {pfs.role === 'Exam_Supervisor' ? '(Sprv)' : ''}
                                  </span>
                                );
                              })}
                            </>
                          )}
                        </div>

                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${periodInfo.color} ${periodInfo.bg} ${periodInfo.border}`}>
                          {sessions.length} room{sessions.length !== 1 ? 's' : ''}
                        </span>
                      </button>

                      {/* Session Cards Grid */}
                      {!isPeriodCollapsed && (
                        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
                          {sessions.map(session => {
                            const ratiosSetting = systemSettings.find(s => s.setting_key === 'staffing_ratios');
                            const fullStaffingRatiosConfig = ratiosSetting?.setting_value || { ranges: staffingRatios };
                            return (
                              <SessionCardItem 
                                key={session.id} 
                                session={session} 
                                calendarRules={calendarRules}
                                onClick={() => handleSessionClick(session)} 
                                conflicts={getSessionConflicts(session.id)}
                                fullStaffingRatiosConfig={fullStaffingRatiosConfig}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Session Detail Modal ─────────────────────────────────────────────── */}
      <SessionDetailModal
        isOpen={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        session={activeSession}
        availableStaff={availableStaff}
        conflicts={activeSession ? getSessionConflicts(activeSession.id) : []}
        onUpdate={loadData}
      />

      {/* ── Period Reserves Modal ────────────────────────────────────────────── */}
      {selectedPeriodForReserves && (
        <PeriodReservesModal
          isOpen={!!selectedPeriodForReserves}
          onClose={() => setSelectedPeriodForReserves(null)}
          dateStr={selectedPeriodForReserves.dateStr}
          period={selectedPeriodForReserves.period}
          startTime={selectedPeriodForReserves.startTime}
          currentReserves={periodFreeStaff.filter(fs => fs.exam_date === selectedPeriodForReserves.dateStr && fs.period === selectedPeriodForReserves.period)}
          availableStaff={getAvailableStaff(selectedPeriodForReserves.dateStr, selectedPeriodForReserves.period)}
          onUpdate={loadData}
        />
      )}
    </div>
  );
}

function SessionCardItem({ session, onClick, conflicts, fullStaffingRatiosConfig, calendarRules }: { session: any; onClick: () => void; conflicts: any[]; fullStaffingRatiosConfig: any; calendarRules: any[] }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `session-${session.id}`,
    data: { type: 'session', session },
  });

  const { staffingRatios } = useSchedulingStore();

  const hasError = conflicts.some(c => c.severity === 'error');
  const hasWarning = conflicts.some(c => c.severity === 'warning');
  const assignedCount = session.assignments?.length ?? 0;

  const isOral = !!session.exam_type?.toLowerCase().includes('oral');
  const req = calculateRequiredStaff(session.student_count || 0, fullStaffingRatiosConfig, isOral, session.exam_date, calendarRules);
  const required = isOral ? 1 : (req.headSupervisors + req.assistants + 1); // +1 for Exam Supervisor
  
  const isDeficient = assignedCount < required || conflicts.some(c => c.type === 'understaffed');

  const missingRoles: string[] = [];
  const examSupervisorsCount = session.assignments?.filter((a: any) => a.role === 'Exam_Supervisor').length ?? 0;
  const committeesSupervisorsCount = session.assignments?.filter((a: any) => a.role === 'Head_Supervisor' || a.role === 'Committees_Supervisor').length ?? 0;
  const assistantCount = session.assignments?.filter((a: any) => a.role === 'Assistant' || a.role === 'Invigilator').length ?? 0;

  if (isOral) {
    if (assistantCount < req.assistants) {
      missingRoles.push('Invig');
    }
  } else {
    if (examSupervisorsCount < 1) {
      missingRoles.push('Exam Sprv');
    }
    if (committeesSupervisorsCount < req.headSupervisors) {
      missingRoles.push('Comm Sprv');
    }
    if (assistantCount < req.assistants) {
      missingRoles.push('Invig');
    }
  }

  let cardBorder = 'border-gray-200';
  let cardBg = 'bg-white hover:bg-gray-50';
  let statusDot = 'bg-green-400';
  let statusTitle = 'OK';

  if (isDeficient) {
    cardBorder = 'border-red-300';
    cardBg = 'bg-red-50 hover:bg-red-100';
    statusDot = 'bg-red-500';
    statusTitle = assignedCount === 0 ? 'Unassigned' : 'Understaffed';
  } else if (hasError || hasWarning) {
    cardBorder = 'border-amber-300';
    cardBg = 'bg-amber-50 hover:bg-amber-100';
    statusDot = 'bg-amber-400';
    statusTitle = hasError ? 'Has errors' : 'Has warnings';
  }

  if (isOver) {
    cardBg = 'bg-primary-50 ring-2 ring-primary-500 scale-[1.02] shadow-md z-10';
  }

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      className={`relative text-left w-full p-3 rounded-lg border ${cardBorder} ${cardBg} transition-all duration-150 shadow-sm focus:outline-none`}
    >
      <div className="flex items-start justify-between mb-1.5 pointer-events-none">
        <div className="flex flex-col gap-1 flex-1">
          <p className="text-xs font-bold text-gray-900 leading-snug line-clamp-2">{session.subject_name}</p>
          {session.program && (
            <span className="text-[10px] text-gray-500 font-medium truncate max-w-[120px]">
              {session.program}
            </span>
          )}
          {session.exam_type?.toLowerCase().includes('oral') && (
            <span className="w-fit text-[9px] font-bold uppercase tracking-wider bg-orange-100 text-orange-800 border border-orange-200 px-1.5 py-0.5 rounded shadow-sm">
              Oral Exam
            </span>
          )}
        </div>
        <div className={`w-2 h-2 rounded-full mt-1 ml-2 flex-shrink-0 ${statusDot}`} title={statusTitle} />
      </div>

      {session.room && (
        <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-1.5 pointer-events-none">
          <Building2 className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{session.room.room_name}</span>
        </div>
      )}

      <div className="flex items-center justify-between pointer-events-none mb-2">
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          <Users className="w-3 h-3" />
          <span>{session.student_count} students</span>
        </div>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isDeficient ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {assignedCount} / {required} staff
        </span>
      </div>

      {/* Show Assigned Staff Names */}
      {session.assignments && session.assignments.length > 0 && (
        <div className="flex flex-wrap gap-1 pointer-events-none border-t border-gray-100/50 pt-2">
          {session.assignments.map((a: any) => {
            const isOffDayConflict = isOffDay(session.exam_date, a.staff, calendarRules);
            const isOverridden = !isOffDayConflict && isOverriddenDay(session.exam_date, a.staff, calendarRules);
            return (
              <span 
                key={a.id} 
                className={cn(
                  "text-[9px] px-1.5 py-0.5 rounded border truncate max-w-full",
                  isOffDayConflict 
                    ? "text-red-600 font-bold bg-red-50 border-red-200"
                    : isOverridden
                      ? "text-orange-600 font-bold bg-orange-50 border-orange-200"
                      : "bg-gray-100 text-gray-700 border-gray-200"
                )}
                title={
                  isOffDayConflict ? "Assigned on off-day! (strict — not allowed)" 
                  : isOverridden ? "Assigned on overridden off-day (Universal Working Day override)"
                  : a.staff?.name || 'Unknown'
                }
              >
                {a.staff?.name?.split(' ')[0]} {a.staff?.name?.split(' ')[1]?.[0]}.
              </span>
            );
          })}
        </div>
      )}

      {/* Show Needed Supervision Roles if Deficient */}
      {isDeficient && missingRoles.length > 0 && (
        <div className="flex flex-wrap gap-1 pointer-events-none border-t border-red-200/50 pt-2 mt-2">
          <span className="text-[9px] font-semibold text-red-600 self-center">Needs:</span>
          {missingRoles.map(role => (
            <span key={role} className="text-[9px] bg-red-100 text-red-800 font-medium px-1.5 py-0.5 rounded">
              {role}
            </span>
          ))}
        </div>
      )}

      {isOver && (
        <div className="absolute inset-0 bg-primary-100/50 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary-400 pointer-events-none backdrop-blur-[1px]">
          <span className="font-bold text-primary-700 text-sm tracking-wide bg-white/80 px-3 py-1 rounded shadow-sm">Drop Staff Here</span>
        </div>
      )}
    </button>
  );
}
