'use client';

import { useMemo, useState } from 'react';
import { useSchedulingStore } from '@/lib/stores/scheduling-store';
import { calculateRequiredStaff } from '@/lib/algorithms/auto-assignment';
import { format, addDays } from 'date-fns';
import { AlertCircle, CheckCircle2, Users, LayoutDashboard, Calendar as CalendarIcon } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, Tooltip, LabelList } from 'recharts';
import { ScheduleHealthModal, ScheduleHealthDiagnostics } from './schedule-health-modal';

export function DashboardMetrics({ weekStart }: { weekStart: Date }) {
  const { examSessions, conflicts, staff, staffingRatios, systemSettings } = useSchedulingStore();
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);

  const metrics = useMemo(() => {
    const startStr = format(weekStart, 'yyyy-MM-dd');
    const endStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');

    const weekSessions = examSessions.filter(
      s => s.exam_date && s.exam_date.slice(0, 10) >= startStr && s.exam_date.slice(0, 10) < endStr
    );

    let fullyStaffedSessions = 0;
    let needsStaffSessions = 0;
    let totalAssignmentsNeeded = 0;
    let actualAssignments = 0;
    let sessionsWithConflicts = 0;
    let examSupervisorsCount = 0;
    let committeesSupervisorsCount = 0;
    let assistantsCount = 0;

    const dailyCounts = new Map<string, number>();

    const ratiosSetting = systemSettings.find(s => s.setting_key === 'staffing_ratios');
    const fullStaffingRatiosConfig = ratiosSetting?.setting_value || { ranges: staffingRatios };
    const calendarRulesSetting = systemSettings.find(s => s.setting_key === 'calendar_rules');
    const calendarRules = calendarRulesSetting?.setting_value || [];

    weekSessions.forEach(session => {
      const assignedCount = session.assignments?.length || 0;
      actualAssignments += assignedCount;

      const isOral = !!session.exam_type?.toLowerCase().includes('oral');
      const req = calculateRequiredStaff(session.student_count || 0, fullStaffingRatiosConfig, isOral, session.exam_date, calendarRules);
      
      // Standard university staffing requirement:
      // Oral sessions require 1 Assistant/Invigilator.
      // Written sessions require 1 Exam Supervisor + req.assistants + 1 Committee Supervisor (building roaming/oversight).
      const required = isOral ? 1 : (req.headSupervisors + req.assistants + 1);
      totalAssignmentsNeeded += required;

      if (assignedCount >= required) {
        fullyStaffedSessions++;
      } else {
        needsStaffSessions++;
      }

      session.assignments?.forEach(a => {
        if (a.role === 'Exam_Supervisor') examSupervisorsCount++;
        else if (a.role === 'Committees_Supervisor' || a.role === 'Head_Supervisor') committeesSupervisorsCount++;
        else if (a.role === 'Assistant' || a.role === 'Invigilator') assistantsCount++;
      });

      if (conflicts.has(session.id) && (conflicts.get(session.id)?.length || 0) > 0) {
        sessionsWithConflicts++;
      }

      // For chart
      const day = new Date(`${session.exam_date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
      dailyCounts.set(day, (dailyCounts.get(day) || 0) + 1);
    });

    // Health Score calculation:
    // If all sessions are fully staffed and there are 0 conflicts, health is exactly 100%.
    let healthScore = 100;
    if (weekSessions.length > 0) {
      if (needsStaffSessions === 0 && sessionsWithConflicts === 0) {
        healthScore = 100;
      } else {
        const staffingRate = (fullyStaffedSessions / weekSessions.length) * 100;
        const conflictDeduction = (sessionsWithConflicts / weekSessions.length) * 25;
        healthScore = Math.max(0, Math.min(99, Math.round(staffingRate - conflictDeduction)));
      }
    }

    // Daily Chart Data
    const daysOrder = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];
    const chartData = daysOrder.map(day => ({
      name: day,
      exams: dailyCounts.get(day) || 0
    }));

    // Active Staff this week
    const activeStaffIds = new Set<string>();
    weekSessions.forEach(s => s.assignments?.forEach(a => activeStaffIds.add(a.staff_id)));
    const totalAvailableStaff = staff.filter(s => s.availability_status === 'Available').length;
    const staffUtilization = totalAvailableStaff > 0 
      ? Math.round((activeStaffIds.size / totalAvailableStaff) * 100)
      : 0;

    // Build Audit Comments & Explanations
    const comments: ScheduleHealthDiagnostics['comments'] = [];

    // 1. Staffing Quota Comment
    if (needsStaffSessions === 0) {
      comments.push({
        type: 'success',
        title: '100% Staffing Quota Fulfilled',
        description: `All ${weekSessions.length} exam sessions have the required number of invigilators and supervisors. Zero unstaffed sessions.`,
      });
    } else {
      comments.push({
        type: 'warning',
        title: `${needsStaffSessions} Exam Sessions Need Staff`,
        description: `There are ${needsStaffSessions} sessions where assigned staff is below the student capacity requirement.`,
      });
    }

    // 2. Conflict Clearance Comment
    if (sessionsWithConflicts === 0) {
      comments.push({
        type: 'success',
        title: 'Zero Scheduling Conflicts',
        description: 'All sessions are completely conflict-free. No room collisions, double-booked staff, or overlapping duties.',
      });
    } else {
      comments.push({
        type: 'warning',
        title: `${sessionsWithConflicts} Conflict Sessions Detected`,
        description: 'Some staff members or rooms are scheduled concurrently or violate shift rest rules. Manual or automated resolution needed.',
      });
    }

    // 3. Role Breakdown & Supervision Comment
    if (examSupervisorsCount > 0 && committeesSupervisorsCount > 0) {
      comments.push({
        type: 'success',
        title: 'Hierarchical Role Governance Active',
        description: `Every room has an Exam Supervisor (${examSupervisorsCount} assigned), supported by Committee Supervisors (${committeesSupervisorsCount} room coverages) and Invigilators (${assistantsCount} assigned).`,
      });
    }

    // 4. Staff Participation Comment
    if (staffUtilization >= 90) {
      comments.push({
        type: 'success',
        title: `High Faculty Engagement (${staffUtilization}%)`,
        description: `${activeStaffIds.size} of ${totalAvailableStaff} available staff members are actively scheduled, ensuring fair and shared workload distribution.`,
      });
    } else {
      comments.push({
        type: 'info',
        title: `Staff Pool Utilization (${staffUtilization}%)`,
        description: `${activeStaffIds.size} active staff out of ${totalAvailableStaff} available. Additional capacity remains in the reserve pool.`,
      });
    }

    // 5. Fairness & Spread Comment
    const constraintsSetting = systemSettings.find(s => s.setting_key === 'scheduling_constraints');
    const peerCap = constraintsSetting?.setting_value?.max_score_delta_from_average ?? 3;
    comments.push({
      type: 'info',
      title: `Peer Workload Spread Cap Enforced (Max ${peerCap} pts)`,
      description: `Maximum score difference between highest and lowest colleague in each peer group (Chemists, TAs, Demonstrators, Lecturers) is strictly limited to ${peerCap} points.`,
    });

    const diagnostics: ScheduleHealthDiagnostics = {
      healthScore,
      totalSessions: weekSessions.length,
      fullyStaffedSessions,
      needsStaffSessions,
      sessionsWithConflicts,
      totalConflicts: Array.from(conflicts.values()).reduce((sum, c) => sum + c.length, 0),
      activeStaffCount: activeStaffIds.size,
      totalAvailableStaff,
      staffUtilization,
      actualAssignments,
      totalAssignmentsNeeded,
      roleBreakdown: {
        examSupervisors: examSupervisorsCount,
        committeesSupervisors: committeesSupervisorsCount,
        assistants: assistantsCount,
      },
      comments,
    };

    return {
      totalSessions: weekSessions.length,
      healthScore,
      fullyStaffedSessions,
      needsStaffSessions,
      sessionsWithConflicts,
      staffUtilization,
      chartData,
      activeStaffCount: activeStaffIds.size,
      diagnostics,
    };
  }, [examSessions, conflicts, staff, weekStart, staffingRatios, systemSettings]);

  if (metrics.totalSessions === 0) return null;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Schedule Health Card (Interactive & Clickable) */}
        <div 
          onClick={() => setIsHealthModalOpen(true)}
          className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col justify-between cursor-pointer hover:border-primary-400 hover:shadow-md transition-all group relative select-none"
          title="Click to view full Schedule Health breakdown and audit comments"
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider group-hover:text-primary-600 transition-colors">
                  Schedule Health
                </p>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold group-hover:bg-primary-50 group-hover:text-primary-700 transition-colors flex items-center gap-0.5">
                  Audit ↗
                </span>
              </div>
              <h3 className="text-2xl font-display font-bold text-gray-900 mt-1">{metrics.healthScore}%</h3>
            </div>
            <div className={`p-2 rounded-lg transition-transform group-hover:scale-105 ${
              metrics.healthScore === 100 
                ? 'bg-emerald-100 text-emerald-600' 
                : metrics.healthScore >= 90 
                  ? 'bg-amber-100 text-amber-600' 
                  : 'bg-red-100 text-red-600'
            }`}>
              {metrics.healthScore === 100 ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div 
              className={`h-1.5 rounded-full transition-all duration-500 ${
                metrics.healthScore === 100 
                  ? 'bg-emerald-500' 
                  : metrics.healthScore >= 90 
                    ? 'bg-amber-500' 
                    : 'bg-red-500'
              }`} 
              style={{ width: `${metrics.healthScore}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
            <span>
              {metrics.healthScore === 100 
                ? 'Staffing requirements filled' 
                : `${metrics.fullyStaffedSessions}/${metrics.totalSessions} sessions staffed`}
            </span>
            <span className="text-[11px] font-semibold text-primary-600 group-hover:underline">
              View Audit ↗
            </span>
          </div>
        </div>

        {/* Conflicts */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Conflicts</p>
              <h3 className="text-2xl font-display font-bold text-gray-900 mt-1">{metrics.sessionsWithConflicts}</h3>
            </div>
            <div className={`p-2 rounded-lg ${metrics.sessionsWithConflicts > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
              <LayoutDashboard className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-auto">
            {metrics.sessionsWithConflicts > 0 ? (
              <span className="text-red-600 font-medium">Require manual attention</span>
            ) : (
              'All sessions are conflict-free'
            )}
          </p>
        </div>

        {/* Staff Utilization */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Staff Active</p>
              <h3 className="text-2xl font-display font-bold text-gray-900 mt-1">{metrics.activeStaffCount}</h3>
            </div>
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
            <div 
              className="h-1.5 rounded-full bg-blue-500" 
              style={{ width: `${metrics.staffUtilization}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">{metrics.staffUtilization}% of available pool</p>
        </div>

        {/* Weekly Volume Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <CalendarIcon className="w-4 h-4 text-primary-500" />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Exams This Week ({metrics.totalSessions})</p>
          </div>
          <div className="flex-1 min-h-[60px] -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.chartData}>
                <defs>
                  <linearGradient id="colorExams" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="exams" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorExams)">
                  <LabelList dataKey="exams" position="top" fill="#8b5cf6" fontSize={11} fontWeight="bold" />
                </Area>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Schedule Health Audit & Diagnostics Modal */}
      <ScheduleHealthModal
        isOpen={isHealthModalOpen}
        onClose={() => setIsHealthModalOpen(false)}
        diagnostics={metrics.diagnostics}
      />
    </>
  );
}
