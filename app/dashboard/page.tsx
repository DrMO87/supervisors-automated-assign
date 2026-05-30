'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { WeeklyScheduleGrid } from '@/components/dashboard/weekly-schedule-grid';
import { WeekNavigator } from '@/components/dashboard/week-navigator';
import { StaffSidebar } from '@/components/dashboard/staff-sidebar';
import { AiQueryBox } from '@/components/dashboard/ai-query-box';
import { DashboardMetrics } from '@/components/dashboard/dashboard-metrics';
import { ChevronLeft, ChevronRight, Calendar, Download, Loader2, Sparkles, CheckCircle, Save, RotateCcw, MessageCircle, ArrowRightLeft, Trash2, Users, X } from 'lucide-react';
import { DndContext, DragEndEvent, DragStartEvent, pointerWithin, DragOverlay } from '@dnd-kit/core';
import { StaffItemUI } from '@/components/dashboard/draggable-staff-item';
import { AutomatedSwapSuggestionsModal } from '@/components/dashboard/automated-swap-suggestions-modal';
import { supabase } from '@/lib/supabase/client';
import { useSchedulingStore } from '@/lib/stores/scheduling-store';
import { startOfWeek } from 'date-fns';
import { generateAssignmentReport, downloadFile } from '@/lib/utils/csv-helpers';
import { getPeriodFromTime } from '@/types/database.types';

export default function DashboardPage() {
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 6 }));
  const { 
    examSessions, 
    setExamSessions, 
    staff, 
    setStaff,
    rooms, 
    systemSettings, 
    getSessionsByWeek,
    periodFreeStaff
  } = useSchedulingStore();
  const [activeStaff, setActiveStaff] = useState<any>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [assignScope, setAssignScope] = useState<'all' | 'final' | 'oral' | 'reserve'>('all');
  const [assignFreeResult, setAssignFreeResult] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [isMobileStaffOpen, setIsMobileStaffOpen] = useState(false);

  // Calculate the 6 working days of the week starting from currentWeekStart
  const weekDates = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    // Ensure consistent YYYY-MM-DD local format
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const handleBackupData = async () => {
    if (!confirm('This will create a backup of your current schedule and staff workload scores. Continue?')) return;
    setIsBackingUp(true);
    try {
      const response = await fetch('/api/backup/create', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Backup failed');
      alert('Data backed up successfully!');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreData = async () => {
    if (!confirm('WARNING: This will overwrite your current schedule and restore the last backup. Proceed?')) return;
    setIsRestoring(true);
    try {
      const response = await fetch('/api/backup/restore', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Restore failed');
      alert('Data restored successfully!');
      setTimeout(() => window.location.reload(), 1000);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleAutoAssign = async () => {
    let confirmMsg = 'This will auto-assign Final & Oral Exams for this week. Continue?';
    if (assignScope === 'final') confirmMsg = 'This will auto-assign Final Exams ONLY for this week. Continue?';
    if (assignScope === 'oral') confirmMsg = 'This will auto-assign Oral Exams ONLY for this week. Continue?';
    if (assignScope === 'reserve') confirmMsg = 'This will automatically allocate available staff as Reserves/Standbys for each period this week. Continue?';
    
    if (!confirm(confirmMsg)) {
      return;
    }

    setIsAssigning(true);
    setAssignFreeResult(null);

    try {
      const endpoint = assignScope === 'reserve' 
        ? '/api/assignments/assign-free-invigilators' 
        : '/api/assignments/auto-assign';
        
      const payload = assignScope === 'reserve' 
        ? { weekStart: currentWeekStart.toISOString() }
        : { weekStart: currentWeekStart.toISOString(), assignmentScope: assignScope };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Assignment failed');
      }

      setAssignFreeResult(data.message || `Successfully assigned!`);

      // Reload page to reflect changes
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      console.error('Assignment error:', error);
      alert(error.message || 'Failed to auto-assign');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleResetWeek = async () => {
    if (!confirm('Are you sure you want to completely RESET all assignments (including manual ones) and reserves for this week? This action cannot be undone.')) {
      return;
    }

    setIsResetting(true);
    try {
      const response = await fetch('/api/assignments/reset-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart: currentWeekStart.toISOString() }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to reset week');

      // Refresh data
      alert('Successfully reset assignments and reserves for this week.');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err: any) {
      console.error('Reset week error:', err);
      alert(err.message || 'Failed to reset week');
    } finally {
      setIsResetting(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'staff') {
      setActiveStaff(active.data.current.staff);
    }
  };

  const handlePreviousWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeekStart(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeekStart(newDate);
  };

  const handleToday = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 6 }));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveStaff(null);
    const { active, over } = event;
    if (!over) return; // Dropped outside valid droppable area

    const staffData = active.data.current?.staff;
    const sessionData = over.data.current?.session;

    if (!staffData || !sessionData) return;

    // Check current assignments
    const headExists = sessionData.assignments?.some((a: any) => a.role === 'Head_Supervisor');
    const examExists = sessionData.assignments?.some((a: any) => a.role === 'Exam_Supervisor');

    let targetRole = 'Assistant';
    
    // Base the dragged role strictly on their supervision_role
    if (staffData.supervision_role === 'Exam Supervisor' || staffData.supervision_role === 'Invigilator / Exam Supervisor') {
      targetRole = !examExists ? 'Exam_Supervisor' : 'Assistant';
    } else if (staffData.supervision_role === 'Committees Supervisor') {
      targetRole = !headExists ? 'Head_Supervisor' : 'Assistant';
    }

    // Check if staff is already a reserve for this period
    const sessionPeriod = getPeriodFromTime(sessionData.start_time);
    const isReserve = periodFreeStaff.some(
      r => r.staff_id === staffData.id && r.exam_date === sessionData.exam_date && r.period === sessionPeriod
    );

    if (isReserve) {
      alert(`${staffData.name} is already assigned as a Reserve for this period. Please remove them from reserves first.`);
      return;
    }

    try {
      // Create assignment
      const { data, error } = await supabase.from('assignments').insert({
        exam_session_id: sessionData.id,
        staff_id: staffData.id,
        role: targetRole,
        is_manual_override: true,
      }).select('*, staff:staff(*)').single();

      if (error) throw error;

      // Recalculate staff score in DB by period
      const { data: staffAssignments } = await supabase.from('assignments').select('exam_session_id').eq('staff_id', staffData.id);
      const { data: dbSessions } = await supabase.from('exam_sessions').select('id, exam_date, start_time');
      const uniquePeriods = new Set();
      staffAssignments?.forEach(a => {
        const s = dbSessions?.find(x => x.id === a.exam_session_id);
        if (s) uniquePeriods.add(`${s.exam_date}__${s.start_time}`);
      });
      await supabase.from('staff').update({ current_score: uniquePeriods.size }).eq('id', staffData.id);

      // Update local store immediately to show the new assignment on the grid
      const updatedSessions = examSessions.map((session: any) => {
        if (session.id === sessionData.id) {
          return {
            ...session,
            assignments: [...(session.assignments || []), data]
          };
        }
        return session;
      });
      setExamSessions(updatedSessions);

      // Also update the staff's historical score in the sidebar live
      const updatedStaff = staff.map((s: any) => 
        s.id === staffData.id ? { ...s, current_score: uniquePeriods.size } : s
      );
      setStaff(updatedStaff);

    } catch (err: any) {
      console.error('Drag and Drop Error:', err);
      alert(err.message || 'Failed to assign staff');
    }
  };

  const handleExportWeekExcel = () => {
    const weekSessions = getSessionsByWeek(currentWeekStart);
    if (!weekSessions || weekSessions.length === 0) {
      alert("No sessions found in the current week to export.");
      return;
    }

    const weekAssignments: any[] = [];
    weekSessions.forEach(session => {
      session.assignments?.forEach((a: any) => {
        weekAssignments.push({
          id: a.id,
          exam_session_id: a.exam_session_id,
          staff_id: a.staff_id,
          role: a.role,
          assigned_at: a.assigned_at,
          assigned_by: a.assigned_by,
          is_manual_override: a.is_manual_override
        });
      });
    });

    const ratiosSetting = systemSettings?.find(s => s.setting_key === 'staffing_ratios');
    const staffingRatios = ratiosSetting?.setting_value || { ranges: [] };

    const calendarRulesSetting = systemSettings?.find(s => s.setting_key === 'calendar_rules');
    const calendarRules = calendarRulesSetting?.setting_value || [];

    // Group the violations of this week's sessions
    const weekViolations: string[] = [];
    weekSessions.forEach(session => {
      const sessionConflicts = useSchedulingStore.getState().getSessionConflicts(session.id);
      sessionConflicts.forEach(c => {
        weekViolations.push(`${c.type}: ${c.message} (Session: ${session.subject_name})`);
      });
    });

    const blob = generateAssignmentReport(
      weekAssignments,
      weekViolations,
      staff,
      weekSessions,
      rooms,
      staffingRatios,
      calendarRules
    );

    const dateLabel = currentWeekStart.toISOString().split('T')[0];
    downloadFile(blob, `weekly_schedule_report_${dateLabel}.xlsx`);
  };

  return (
    <DndContext collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex bg-white h-screen overflow-hidden -m-4 sm:-m-6 lg:-m-8">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-gray-50">
          <PageHeader
            title="Weekly Schedule Dashboard"
            description="View and manage exam supervision assignments"
            actions={
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar sm:flex-wrap w-full max-w-[calc(100vw-3rem)]">

                {/* ── Status feedback ── */}
                {assignFreeResult && (
                  <span className="text-xs text-emerald-700 flex items-center gap-1 font-semibold bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200 shadow-sm">
                    <CheckCircle className="w-3.5 h-3.5" /> {assignFreeResult}
                  </span>
                )}

                {/* ── Group 1: Navigation ── */}
                <div className="flex items-center rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden divide-x divide-gray-200">
                  <button
                    onClick={handleExportWeekExcel}
                    disabled={getSessionsByWeek(currentWeekStart).length === 0}
                    title="Export this week to Excel"
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </button>
                  <button
                    onClick={handleToday}
                    title="Jump to current week"
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Today
                  </button>
                </div>

                {/* ── Group 2: Smart Tools ── */}
                <div className="flex items-center rounded-lg border border-primary-200 bg-primary-50 shadow-sm overflow-hidden divide-x divide-primary-200">
                  <button
                    onClick={() => setIsSwapModalOpen(true)}
                    title="Auto-suggest swaps for staff assigned on off-days"
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-primary-700 hover:bg-primary-100 transition-colors"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    Smart Swaps
                  </button>
                </div>

                {/* ── Group 3: Auto-Assign (primary action) ── */}
                <div className="flex items-center rounded-lg overflow-hidden shadow-sm border border-indigo-600 divide-x divide-indigo-500">
                  <select
                    value={assignScope}
                    onChange={e => setAssignScope(e.target.value as any)}
                    className="bg-indigo-600 text-white text-xs font-medium border-none focus:ring-0 py-2 pl-3 pr-7 cursor-pointer hover:bg-indigo-700 transition-colors appearance-none"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
                  >
                    <option value="all">Final &amp; Oral</option>
                    <option value="final">Final Only</option>
                    <option value="oral">Oral Only</option>
                    <option value="reserve">Free Reserve</option>
                  </select>
                  <button
                    onClick={handleAutoAssign}
                    disabled={isAssigning || getSessionsByWeek(currentWeekStart).length === 0}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isAssigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Auto Assign
                  </button>
                  <button
                    onClick={handleResetWeek}
                    disabled={isResetting || getSessionsByWeek(currentWeekStart).length === 0}
                    title="Clear all assignments and reserves for this week"
                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-700 text-indigo-100 text-xs font-medium hover:bg-red-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Reset
                  </button>
                </div>

                {/* ── Group 4: Data Safety ── */}
                <div className="flex items-center rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden divide-x divide-gray-200">
                  <button
                    onClick={handleBackupData}
                    disabled={isBackingUp}
                    title="Create a backup snapshot"
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 transition-colors"
                  >
                    {isBackingUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Backup
                  </button>
                  <button
                    onClick={handleRestoreData}
                    disabled={isRestoring}
                    title="Restore from last backup"
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-600 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50 transition-colors"
                  >
                    {isRestoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    Restore
                  </button>
                </div>

              </div>
            }
          />

          <div className="mb-6 flex items-center justify-between">
            <WeekNavigator
              currentWeekStart={currentWeekStart}
              onPrevious={handlePreviousWeek}
              onNext={handleNextWeek}
            />
          </div>

          <DashboardMetrics weekStart={currentWeekStart} />

          <AiQueryBox weekStart={currentWeekStart} />

          <WeeklyScheduleGrid weekStart={currentWeekStart} />
        </div>

        {/* The fixed Sidebar - Desktop */}
        <div className="hidden lg:block h-full border-l border-gray-200">
          <StaffSidebar />
        </div>
      </div>

      {/* Mobile Staff Sidebar Overlay */}
      {isMobileStaffOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileStaffOpen(false)} />
          <div className="relative w-[85vw] max-w-sm h-full bg-white shadow-2xl flex flex-col">
            <div className="p-3 border-b flex justify-between items-center bg-gray-50">
              <span className="font-bold text-gray-700 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Available Staff
              </span>
              <button onClick={() => setIsMobileStaffOpen(false)} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden [&>div]:w-full [&>div]:border-none">
               <StaffSidebar />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Floating Button */}
      <button 
        className="lg:hidden fixed bottom-6 right-6 z-40 bg-indigo-600 text-white p-3.5 rounded-full shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 hover:scale-105 transition-all flex items-center justify-center group"
        onClick={() => setIsMobileStaffOpen(true)}
      >
        <Users className="w-6 h-6" />
        <span className="absolute -top-10 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Assign Staff</span>
      </button>

      {/* Renders the dragged item over everything else */}
      <DragOverlay dropAnimation={null}>
        {activeStaff ? (
          <div className="w-64 opacity-90 scale-105 shadow-xl rotate-2 transition-transform">
            <StaffItemUI staff={activeStaff} isDragging={false} />
          </div>
        ) : null}
      </DragOverlay>

      {isSwapModalOpen && (
        <AutomatedSwapSuggestionsModal
          weekDates={weekDates}
          examSessions={getSessionsByWeek(currentWeekStart)}
          onClose={() => setIsSwapModalOpen(false)}
        />
      )}
    </DndContext>
  );
}

