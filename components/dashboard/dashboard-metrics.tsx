'use client';

import { useMemo } from 'react';
import { useSchedulingStore } from '@/lib/stores/scheduling-store';
import { getPeriodFromTime } from '@/types/database.types';
import { groupSessionsByRoom, calculateRequiredStaff } from '@/lib/algorithms/auto-assignment';
import { format, addDays } from 'date-fns';
import { AlertCircle, CheckCircle2, Users, LayoutDashboard, TrendingUp, Calendar as CalendarIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area, LabelList } from 'recharts';

export function DashboardMetrics({ weekStart }: { weekStart: Date }) {
  const { examSessions, conflicts, staff, staffingRatios, systemSettings } = useSchedulingStore();

  const metrics = useMemo(() => {
    const startStr = format(weekStart, 'yyyy-MM-dd');
    const endStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');

    const weekSessions = examSessions.filter(
      s => s.exam_date >= startStr && s.exam_date < endStr
    );

    let totalAssignmentsNeeded = 0;
    let actualAssignments = 0;
    let sessionsWithConflicts = 0;

    const dailyCounts = new Map<string, number>();
    
    // Group sessions by room and calculate needed staff
    const groupedSessions = groupSessionsByRoom(weekSessions);
    
    const ratiosSetting = systemSettings.find(s => s.setting_key === 'staffing_ratios');
    const fullStaffingRatiosConfig = ratiosSetting?.setting_value || { ranges: staffingRatios };
    const calendarRulesSetting = systemSettings.find(s => s.setting_key === 'calendar_rules');
    const calendarRules = calendarRulesSetting?.setting_value || [];

    groupedSessions.forEach(group => {
      const req = calculateRequiredStaff(group.total_students, fullStaffingRatiosConfig, group.isOral, group.exam_date, calendarRules);
      totalAssignmentsNeeded += group.isOral ? 1 : (req.headSupervisors + req.assistants + 1);
    });

    // We also need Committee Supervisors (rough approximation for dashboard: 1 per 5 rooms per period)
    // Oral exams do NOT require Committee Supervisors, so we exclude them.
    const buildingPeriodRooms = new Map<string, Set<string>>();
    weekSessions.forEach(session => {
      // Calculate actual assignments for completion tracking
      actualAssignments += (session.assignments?.length || 0);

      if (conflicts.has(session.id) && (conflicts.get(session.id)?.length || 0) > 0) {
        sessionsWithConflicts++;
      }

      // For chart
      const day = new Date(`${session.exam_date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
      dailyCounts.set(day, (dailyCounts.get(day) || 0) + 1);
      
      // Track buildings for Comm Sups (excluding Oral Exams)
      const isOral = !!session.exam_type?.toLowerCase().includes('oral');
      if (!isOral) {
        const building = session.room?.building_code || session.room?.building || 'UNKNOWN';
        const key = `${session.exam_date}_${getPeriodFromTime(session.start_time)}_${building}`;
        if (!buildingPeriodRooms.has(key)) buildingPeriodRooms.set(key, new Set());
        buildingPeriodRooms.get(key)!.add(session.room_id);
      }
    });
    
    buildingPeriodRooms.forEach(roomsSet => {
      totalAssignmentsNeeded += Math.ceil(roomsSet.size / 5); // Default 5 rooms per lecturer
    });

    const completionRate = totalAssignmentsNeeded > 0 
      ? Math.round((actualAssignments / totalAssignmentsNeeded) * 100) 
      : 100;

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

    return {
      totalSessions: weekSessions.length,
      completionRate: Math.min(completionRate, 100), // Cap at 100 if over-assigned
      sessionsWithConflicts,
      staffUtilization,
      chartData,
      activeStaffCount: activeStaffIds.size,
    };
  }, [examSessions, conflicts, staff, weekStart, staffingRatios]);

  if (metrics.totalSessions === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Schedule Health */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col justify-between">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Schedule Health</p>
            <h3 className="text-2xl font-display font-bold text-gray-900 mt-1">{metrics.completionRate}%</h3>
          </div>
          <div className={`p-2 rounded-lg ${metrics.completionRate === 100 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
            {metrics.completionRate === 100 ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          </div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
          <div 
            className={`h-1.5 rounded-full ${metrics.completionRate === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
            style={{ width: `${metrics.completionRate}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">Staffing requirements filled</p>
      </div>

      {/* Conflicts */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col justify-between">
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
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col justify-between">
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
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col">
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
  );
}
