'use client';

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Navigation } from '@/components/layout/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, Cell, LabelList
} from 'recharts';
import { 
  Loader2, AlertTriangle, Users, Calendar, DoorOpen, 
  TrendingUp, Award, Clock, FileCheck, ShieldCheck, PieChart as PieChartIcon, Download, Sparkles, X
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { LOGO_DTU_BASE64, LOGO_PHARMACY_BASE64, LOGO_HUE_BASE64, LOGO_SESSION_MASTER_BASE64 } from '@/lib/utils/logo-base64';
import { getPeriodFromTime } from '@/types/database.types';
import type { Staff, ExamSessionWithRelations, Room } from '@/types/database.types';
import { calculateRequiredStaff } from '@/lib/algorithms/auto-assignment';

// ── Design tokens ──────────────────────────────────────────────────────────
const PALETTE = {
  invig:   { dark: '#059669', mid: '#10b981', light: '#d1fae5', text: '#065f46' },
  exam:    { dark: '#4338ca', mid: '#6366f1', light: '#e0e7ff', text: '#312e81' },
  comm:    { dark: '#7c3aed', mid: '#8b5cf6', light: '#ede9fe', text: '#4c1d95' },
  amber:   { dark: '#d97706', mid: '#f59e0b', light: '#fef3c7', text: '#92400e' },
};

const ROLE_COLORS = [
  '#6366f1','#8b5cf6','#10b981','#f59e0b','#3b82f6','#06b6d4','#ec4899','#f43f5e','#84cc16','#14b8a6',
];

// ── Custom rounded pill bar ─────────────────────────────────────────────────
const PillBar = (props: any) => {
  const { fill, x, y, width, height } = props;
  if (!width || !height || height < 2) return null;
  const r = Math.min(4, width / 2);
  return (
    <rect
      x={x} y={y} width={width} height={height}
      rx={r} ry={r} fill={fill}
      style={{ filter: `drop-shadow(0 1px 2px ${fill}66)` }}
    />
  );
};

// ── Custom gradient area tooltip ───────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur border border-gray-100 rounded-xl shadow-xl px-4 py-3 text-xs">
      <p className="font-bold text-gray-700 mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color || p.fill }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold text-gray-900">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ── KPI Card ───────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, icon: Icon, color, sub }: { label: string; value: string | number; icon: any; color: string; sub?: string }) => (
  <div className={`relative overflow-hidden rounded-2xl p-5 border shadow-sm`} style={{ background: `linear-gradient(135deg, ${color}12, ${color}05)`, borderColor: `${color}22` }}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
        <p className="text-3xl font-bold text-gray-900 leading-none">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </div>
      <div className="p-3 rounded-xl" style={{ background: `${color}18` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
    </div>
    <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full opacity-5" style={{ background: color }} />
  </div>
);

// ── Section card wrapper ───────────────────────────────────────────────────
const ChartCard = ({ title, icon: Icon, iconColor, children, span2 = false, note }: { title: string; icon: any; iconColor: string; children: React.ReactNode; span2?: boolean; note?: string }) => (
  <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${span2 ? 'lg:col-span-2' : ''}`}>
    <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50">
      <div className="p-2 rounded-lg" style={{ background: `${iconColor}15` }}>
        <Icon className="w-4 h-4" style={{ color: iconColor }} />
      </div>
      <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
    </div>
    <div className="p-6">{children}</div>
    {note && <p className="px-6 pb-4 text-[10px] text-gray-400 text-center italic">{note}</p>}
  </div>
);

export default function AnalyticsPage() {
  const [data, setData] = useState<{
    staff: Staff[]; exams: ExamSessionWithRelations[]; rooms: Room[];
    assignments: any[]; staffingRatios: any; schedulingConstraints: any;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [employmentFilter, setEmploymentFilter] = useState<'All' | 'Full-time' | 'Part-time'>('All');
  const [dateFilter, setDateFilter] = useState<string>('All Time');
  const [activeTab, setActiveTab] = useState<'pre' | 'post'>('pre');
  const [selectedDetail, setSelectedDetail] = useState<{ title: string; items: any[] } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    setIsExporting(true);
    setTimeout(async () => {
      const element = document.getElementById('analytics-report-container');
      if (!element) { setIsExporting(false); return; }
      try {
        const canvas = await html2canvas(element, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        let heightLeft = pdfHeight;
        let position = 0;
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
        while (heightLeft >= 0) {
          position = heightLeft - pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
          heightLeft -= pdf.internal.pageSize.getHeight();
        }
        pdf.save(`Analytics_Report_${activeTab}_${dateFilter}.pdf`);
      } catch (err) {
        alert('Failed to generate PDF report.');
      } finally { setIsExporting(false); }
    }, 500);
  };

  useEffect(() => {
    async function loadData() {
      if (!isSupabaseConfigured()) return;
      try {
        const [staffRes, examsRes, roomsRes, assignmentsRes, settingsRes] = await Promise.all([
          supabase.from('staff').select('*').limit(10000),
          supabase.from('exam_sessions').select('*, room:rooms(*)').order('exam_date').limit(10000),
          supabase.from('rooms').select('*').limit(10000),
          supabase.from('assignments').select('*, staff:staff(*), exam_session:exam_sessions(*, room:rooms(*))').limit(10000),
          supabase.from('system_settings').select('*').not('setting_key', 'like', 'backup_%').limit(10000)
        ]);
        const settingsData = settingsRes.data || [];
        setData({
          staff: staffRes.data || [], exams: examsRes.data || [], rooms: roomsRes.data || [],
          assignments: assignmentsRes.data || [],
          staffingRatios: settingsData.find(s => s.setting_key === 'staffing_ratios')?.setting_value || { ranges: [] },
          schedulingConstraints: settingsData.find(s => s.setting_key === 'scheduling_constraints')?.setting_value || {},
        });
      } catch (err) { console.error('Failed to load analytics data:', err); }
      finally { setIsLoading(false); }
    }
    loadData();
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    const filteredStaff = data.staff.filter(s => employmentFilter === 'All' ? true : s.employment_status === employmentFilter);
    const getWeekStart = (dateStr: string) => {
      const d = new Date(`${dateStr}T12:00:00Z`);
      const day = d.getUTCDay();
      const offset = day === 6 ? 0 : -(day + 1);
      const start = new Date(d.setUTCDate(d.getUTCDate() + offset));
      return start.toISOString().split('T')[0];
    };
    const availableWeeks = Array.from(new Set(data.exams.map(e => getWeekStart(e.exam_date)))).sort();
    let filteredExams = data.exams;
    let filteredAssignments = data.assignments;
    if (dateFilter !== 'All Time') {
      filteredExams = data.exams.filter(e => getWeekStart(e.exam_date) === dateFilter);
      filteredAssignments = data.assignments.filter(a => {
        const session = data.exams.find(e => e.id === a.exam_session_id);
        return session && getWeekStart(session.exam_date) === dateFilter;
      });
    }

    // PRE-ASSIGN CALCS
    const preDayStatsMap = new Map<string, any>();
    filteredExams.forEach(e => {
      if (!preDayStatsMap.has(e.exam_date)) preDayStatsMap.set(e.exam_date, { date: e.exam_date, reqInvig: 0, availInvig: 0, reqExamSup: 0, availExamSup: 0, reqCommSup: 0, availCommSup: 0 });
    });
    const dayPeriodReqs = new Map<string, { reqInvig: number; reqExamSup: number; reqCommSup: number }>();
    const examGroupsByDayPeriodRoom = new Map<string, { students: number; isOral: boolean }>();
    filteredExams.forEach(e => {
      const p = getPeriodFromTime(e.start_time);
      const key = `${e.exam_date}_${p}_${e.room_id}`;
      const ex = examGroupsByDayPeriodRoom.get(key) || { students: 0, isOral: false };
      examGroupsByDayPeriodRoom.set(key, { students: ex.students + e.student_count, isOral: ex.isOral || !!e.exam_type?.toLowerCase().includes('oral') });
    });
    examGroupsByDayPeriodRoom.forEach((groupData, key) => {
      const [date, pStr] = key.split('_');
      const dpk = `${date}_${pStr}`;
      if (!dayPeriodReqs.has(dpk)) dayPeriodReqs.set(dpk, { reqInvig: 0, reqExamSup: 0, reqCommSup: 0 });
      const req = calculateRequiredStaff(groupData.students, data.staffingRatios, groupData.isOral, date);
      dayPeriodReqs.get(dpk)!.reqExamSup += groupData.isOral ? 0 : 1;
      dayPeriodReqs.get(dpk)!.reqInvig += req.assistants || 0;
    });
    const roomsPerDayPeriodBuilding = new Map<string, Set<string>>();
    filteredExams.forEach(e => {
      const isOral = !!e.exam_type?.toLowerCase().includes('oral');
      if (isOral) return;
      const p = getPeriodFromTime(e.start_time);
      const building = e.room?.building_code || e.room?.building || e.room?.room_name?.[0] || 'UNKNOWN';
      const dpbKey = `${e.exam_date}_${p}_${building}`;
      if (!roomsPerDayPeriodBuilding.has(dpbKey)) roomsPerDayPeriodBuilding.set(dpbKey, new Set());
      roomsPerDayPeriodBuilding.get(dpbKey)!.add(e.room_id);
    });
    const maxRoomsPerCommSup = data.schedulingConstraints?.max_rooms_per_lecturer || 5;
    roomsPerDayPeriodBuilding.forEach((roomsSet, dpbKey) => {
      const [date, pStr] = dpbKey.split('_');
      const dpk = `${date}_${pStr}`;
      if (!dayPeriodReqs.has(dpk)) dayPeriodReqs.set(dpk, { reqInvig: 0, reqExamSup: 0, reqCommSup: 0 });
      dayPeriodReqs.get(dpk)!.reqCommSup += Math.ceil(roomsSet.size / maxRoomsPerCommSup);
    });
    dayPeriodReqs.forEach((reqs, dpk) => {
      const [date] = dpk.split('_');
      const stat = preDayStatsMap.get(date);
      if (stat) {
        if (reqs.reqInvig > stat.reqInvig) stat.reqInvig = reqs.reqInvig;
        if (reqs.reqExamSup > stat.reqExamSup) stat.reqExamSup = reqs.reqExamSup;
        if (reqs.reqCommSup > stat.reqCommSup) stat.reqCommSup = reqs.reqCommSup;
      }
    });
    Array.from(preDayStatsMap.keys()).forEach(date => {
      const entry = preDayStatsMap.get(date);
      const availableStaffOnDay = filteredStaff.filter(s => {
        if (s.availability_status !== 'Available') return false;
        const dayName = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
        return (s.working_days || []).includes(dayName) && !(s.specific_off_dates || []).includes(date);
      });
      availableStaffOnDay.forEach(s => {
        if (s.supervision_role === 'Invigilator') entry.availInvig++;
        else if (s.supervision_role === 'Exam Supervisor') entry.availExamSup++;
        else if (s.supervision_role === 'Committees Supervisor') entry.availCommSup++;
      });
      const dualRoleStaff = availableStaffOnDay.filter(s => s.supervision_role === 'Invigilator / Exam Supervisor');
      dualRoleStaff.forEach(() => {
        if (entry.reqInvig - entry.availInvig > entry.reqExamSup - entry.availExamSup) entry.availInvig++;
        else entry.availExamSup++;
      });
    });
    const preDayStats = Array.from(preDayStatsMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    const densityMap = new Map<string, any>();
    filteredExams.forEach(e => {
      const p = getPeriodFromTime(e.start_time);
      if (!densityMap.has(e.exam_date)) densityMap.set(e.exam_date, { date: e.exam_date, p1: 0, p2: 0, p3: 0 });
      const entry = densityMap.get(e.exam_date);
      if (p === 1) entry.p1++; else if (p === 2) entry.p2++; else if (p === 3) entry.p3++;
    });
    const densityData = Array.from(densityMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    const roomUsage = new Map<string, number>();
    filteredExams.forEach(e => { const rName = e.room?.room_name || 'Unknown'; roomUsage.set(rName, (roomUsage.get(rName) || 0) + 1); });
    const roomUsageData = Array.from(roomUsage.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 15);

    const committeesPerDayMap = new Map<string, Set<string>>();
    filteredExams.forEach(e => {
      if (!committeesPerDayMap.has(e.exam_date)) committeesPerDayMap.set(e.exam_date, new Set());
      committeesPerDayMap.get(e.exam_date)!.add(`${getPeriodFromTime(e.start_time)}_${e.room_id}`);
    });
    const committeesPerDayData = Array.from(committeesPerDayMap.entries()).map(([date, set]) => ({ date, count: set.size })).sort((a, b) => a.date.localeCompare(b.date));

    const preRedFlags: any[] = [];
    preDayStats.forEach(day => {
      if (day.availInvig < day.reqInvig) preRedFlags.push({ message: `${day.date}: Shortage of ${day.reqInvig - day.availInvig} Invigilators` });
      if (day.availExamSup < day.reqExamSup) preRedFlags.push({ message: `${day.date}: Shortage of ${day.reqExamSup - day.availExamSup} Exam Supervisors` });
      if (day.availCommSup < day.reqCommSup) preRedFlags.push({ message: `${day.date}: Shortage of ${day.reqCommSup - day.availCommSup} Committee Supervisors` });
    });

    // POST-ASSIGN CALCS
    const workloadMap = new Map<string, number>();
    const commSupPeriods = new Map<string, Set<string>>();
    const staffSlotsMap = new Map<string, Set<string>>();
    filteredAssignments.forEach(a => {
      const s = data.staff.find(st => st.id === a.staff_id);
      if (!s) return;
      const e = data.exams.find(ex => ex.id === a.exam_session_id);
      if (!e) return;
      if (s.supervision_role === 'Committees Supervisor') {
        if (!commSupPeriods.has(s.id)) commSupPeriods.set(s.id, new Set());
        commSupPeriods.get(s.id)!.add(`${e.exam_date}_${getPeriodFromTime(e.start_time)}`);
      } else {
        if (!staffSlotsMap.has(s.id)) staffSlotsMap.set(s.id, new Set());
        staffSlotsMap.get(s.id)!.add(`${e.exam_date}_${getPeriodFromTime(e.start_time)}_${e.room_id}`);
      }
    });
    staffSlotsMap.forEach((slots, staffId) => workloadMap.set(staffId, slots.size));
    commSupPeriods.forEach((periods, staffId) => workloadMap.set(staffId, periods.size));

    const getTopLoadedStaff = (role: string) => filteredStaff.filter(s => s.supervision_role === role)
      .map(s => ({ id: s.id, name: s.name, count: workloadMap.get(s.id) || 0 }))
      .sort((a, b) => b.count - a.count).slice(0, 10);

    const topInvigilators = getTopLoadedStaff('Invigilator');
    const topExamSups = getTopLoadedStaff('Exam Supervisor');
    const topCommSups = getTopLoadedStaff('Committees Supervisor');

    const dailyReserveMap = new Map<string, any>();
    Array.from(preDayStatsMap.keys()).forEach(date => { dailyReserveMap.set(date, { date, invig: 0, exam: 0, comm: 0 }); });
    Array.from(preDayStatsMap.keys()).forEach(date => {
      const entry = dailyReserveMap.get(date)!;
      const dayReq = preDayStatsMap.get(date)!;
      const freeStaffOnDay = filteredStaff.filter(s => {
        if (s.availability_status !== 'Available') return false;
        const dayName = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
        if (!(s.working_days || []).includes(dayName) || (s.specific_off_dates || []).includes(date)) return false;
        return !filteredAssignments.some(a => a.staff_id === s.id && data.exams.find(ex => ex.id === a.exam_session_id)?.exam_date === date);
      });
      freeStaffOnDay.forEach(s => {
        if (s.supervision_role === 'Invigilator') entry.invig++;
        else if (s.supervision_role === 'Exam Supervisor') entry.exam++;
        else if (s.supervision_role === 'Committees Supervisor') entry.comm++;
      });
      freeStaffOnDay.filter(s => s.supervision_role === 'Invigilator / Exam Supervisor').forEach(() => {
        if (dayReq.reqInvig - dayReq.availInvig > dayReq.reqExamSup - dayReq.availExamSup) entry.invig++;
        else entry.exam++;
      });
    });
    const dailyReserveData = Array.from(dailyReserveMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    const workloadDistMap = new Map<number, { count: number; invig: number; exam: number; comm: number }>();
    filteredStaff.forEach(s => {
      if (s.availability_status !== 'Available') return;
      const count = workloadMap.get(s.id) || 0;
      if (!workloadDistMap.has(count)) workloadDistMap.set(count, { count, invig: 0, exam: 0, comm: 0 });
      const entry = workloadDistMap.get(count)!;
      if (s.supervision_role === 'Invigilator') entry.invig++;
      else if (s.supervision_role === 'Exam Supervisor') entry.exam++;
      else if (s.supervision_role === 'Committees Supervisor') entry.comm++;
      else if (s.supervision_role === 'Invigilator / Exam Supervisor') {
        const staffA = filteredAssignments.filter(a => a.staff_id === s.id);
        staffA.filter(a => a.role === 'Exam_Supervisor').length > staffA.filter(a => a.role !== 'Exam_Supervisor').length ? entry.exam++ : entry.invig++;
      }
    });
    const fairnessData = Array.from(workloadDistMap.values()).sort((a, b) => a.count - b.count);
    const readyReserve = filteredStaff.filter(s => (workloadMap.get(s.id) || 0) === 0 && s.availability_status === 'Available');
    const qualityRatio = filteredAssignments.length > 0
      ? Math.round((filteredAssignments.filter(a => a.role !== 'Assistant').length / filteredAssignments.length) * 100) : 0;
    const preRecommendations: string[] = preRedFlags.length > 0
      ? ['CRITICAL: Assign more staff to Reserve or recruit temporary staff for shortage dates.',
         readyReserve.length > 0 ? `Suggested Reserves (0 assignments): ${readyReserve.slice(0, 5).map(s => s.name).join(', ')}` : '',
         'Consider relaxing the max_rooms_per_lecturer constraint if Committee Supervisor shortages persist.'].filter(Boolean)
      : ['✓ Capacity is healthy. No immediate action required.'];
    if (densityData.some(d => d.p3 > (d.p1 + d.p2))) preRecommendations.push('High density detected in Period 3. Consider rotating staff across days.');
    const postRecommendations: string[] = [];
    if (fairnessData.length > 0) {
      const maxLoad = fairnessData[fairnessData.length - 1].count;
      const minLoad = fairnessData[0].count;
      if (maxLoad - minLoad > 5) {
        postRecommendations.push(`Workload disparity detected — Max: ${maxLoad}, Min: ${minLoad}.`);
        postRecommendations.push(`Most Overloaded: ${filteredStaff.filter(s => workloadMap.get(s.id) === maxLoad).map(s => s.name).join(', ')}`);
        postRecommendations.push(`Staff with 0 load: ${readyReserve.slice(0, 5).map(s => s.name).join(', ') || 'None'}`);
      } else { postRecommendations.push('✓ Workload distribution is fair and balanced.'); }
    }
    if (qualityRatio > 0 && qualityRatio < 50) postRecommendations.push('Supervisor-to-Staff Quality ratio is below 50%. Review staffing ratios.');

    return { preDayStats, densityData, roomUsageData, committeesPerDayData, preRedFlags, topInvigilators, topExamSups, topCommSups, dailyReserveData, fairnessData, readyReserve, availableWeeks, totalAssignments: filteredAssignments.length, qualityRatio, preRecommendations, postRecommendations };
  }, [data, employmentFilter, dateFilter]);

  const handleRoomClick = (payload: any) => {
    if (!payload || !data) return;
    const roomExams = data.exams.filter(e => e.room?.room_name === payload.name).map(e => ({ subject: e.subject_name, date: e.exam_date, time: e.start_time, count: e.student_count }));
    setSelectedDetail({ title: `Room Usage: ${payload.name}`, items: roomExams });
  };

  if (isLoading) return (
    <div className="flex bg-surface-100 min-h-screen">
      {/* Loading State */}
      <div className="flex-1 md:ml-64 flex items-center justify-center pt-14 md:pt-0">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          <p className="text-sm text-gray-500">Loading analytics data…</p>
        </div>
      </div>
    </div>
  );
  if (!stats) return null;

  const fmtDate = (d: string) => d.slice(5); // MM-DD

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Navigation />

      <main className="flex-1 md:ml-64 p-4 md:p-8 space-y-6 pt-20 md:pt-8 w-full max-w-screen-2xl">

        {/* ── Header ───────────────────────────────────── */}
        <PageHeader
          title="System Analytics"
          description="In-depth analysis of capacity, workloads, and schedule health"
          actions={
            <div className="flex items-center gap-2">
              {/* Week filter */}
              <div className="flex items-center rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
                <Calendar className="w-3.5 h-3.5 text-gray-400 ml-3" />
                <select
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  className="bg-transparent border-none text-xs font-medium text-gray-700 focus:ring-0 py-2 pl-2 pr-3 cursor-pointer"
                >
                  <option value="All Time">All Weeks</option>
                  {stats.availableWeeks.map(w => <option key={w} value={w}>Week of {w}</option>)}
                </select>
              </div>
              {/* Employment filter */}
              <div className="flex items-center rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden divide-x divide-gray-200">
                {(['All', 'Full-time', 'Part-time'] as const).map(type => (
                  <button key={type} onClick={() => setEmploymentFilter(type)}
                    className={`px-3 py-2 text-xs font-medium transition-colors ${employmentFilter === type ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                    {type}
                  </button>
                ))}
              </div>
              {/* Export */}
              <button onClick={handleExportPDF} disabled={isExporting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 shadow-sm transition-colors">
                {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Export PDF
              </button>
            </div>
          }
        />

        {/* ── Tab Switcher ─────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'pre', label: 'Before Assign', sub: 'Capacity planning & shortage alerts', icon: PieChartIcon, accent: '#6366f1' },
            { key: 'post', label: 'After Assign', sub: 'Workload fairness & reserve health', icon: ShieldCheck, accent: '#10b981' },
          ].map(({ key, label, sub, icon: Icon, accent }) => (
            <button key={key} onClick={() => setActiveTab(key as any)}
              className={`relative flex items-center gap-4 p-5 rounded-2xl border-2 text-left transition-all duration-200 ${activeTab === key ? 'shadow-md' : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'}`}
              style={activeTab === key ? { background: `${accent}0c`, borderColor: accent } : {}}>
              <div className="p-3 rounded-xl flex-shrink-0" style={{ background: activeTab === key ? `${accent}20` : '#f3f4f6' }}>
                <Icon className="w-5 h-5" style={{ color: activeTab === key ? accent : '#9ca3af' }} />
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: activeTab === key ? accent : '#374151' }}>{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
              </div>
              {activeTab === key && <div className="absolute right-4 top-4 w-2 h-2 rounded-full" style={{ background: accent }} />}
            </button>
          ))}
        </div>

        <div id="analytics-report-container" className="space-y-6 pb-8">

          {isExporting && (
            <div className="flex flex-col items-center justify-center mb-8 border-b-2 border-[#002147] pb-6 bg-white p-6 pt-10 rounded-2xl">
              <div className="flex justify-center items-center gap-8 mb-4">
                <img src={LOGO_HUE_BASE64} alt="HUE" className="h-16 object-contain" />
                <img src={LOGO_PHARMACY_BASE64} alt="Pharmacy" className="h-16 object-contain" />
                <img src={LOGO_DTU_BASE64} alt="DTU" className="h-16 object-contain" />
                <img src={LOGO_SESSION_MASTER_BASE64} alt="Session Master" className="h-16 object-contain" />
              </div>
              <div className="text-center text-sm text-slate-500 font-medium">
                Full Stack Developed by Prof. Mahmoud Elkhoudary<br />
                <span className="text-xs text-slate-400">Head of Digital Transformation Unit - Faculty of Pharmacy</span>
              </div>
              <h2 className="mt-6 text-2xl font-bold text-[#002147] uppercase font-display">
                Analytics Report — {activeTab === 'pre' ? 'Before Assign' : 'After Assign'}
              </h2>
            </div>
          )}

          {/* ═══════════════════════════════════════════════ */}
          {/* PRE-ASSIGN TAB                                  */}
          {/* ═══════════════════════════════════════════════ */}
          {activeTab === 'pre' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">

              {/* Alert banner */}
              {stats.preRedFlags.length > 0 ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                  <div className="flex items-center gap-2 font-bold text-red-800 mb-3 text-sm">
                    <AlertTriangle className="w-4 h-4" /> Critical Capacity Shortages Detected
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {stats.preRedFlags.map((f, i) => (
                      <div key={i} className="bg-white rounded-xl px-3 py-2 text-xs text-red-700 border border-red-100 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse flex-shrink-0" />{f.message}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  <span className="text-sm font-semibold text-emerald-800">All Capacity Checks Passed — Sufficient staff available for all exam days.</span>
                </div>
              )}

              {/* Daily Capacity vs Requirement */}
              <ChartCard title="Daily Capacity vs Requirement (All Roles)" icon={Users} iconColor="#6366f1"
                note="Light bars = Available staff · Dark bars = Required slots. A dark bar exceeding light = shortage.">
                <div className="h-[380px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.preDayStats} barGap={2} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 16, fontSize: 11 }} />
                      <Bar isAnimationActive={false} dataKey="reqInvig" name="Req Invigilator" fill={PALETTE.invig.dark} barSize={10} shape={<PillBar />} />
                      <Bar isAnimationActive={false} dataKey="availInvig" name="Avail Invigilator" fill={PALETTE.invig.mid} barSize={10} shape={<PillBar />} />
                      <Bar isAnimationActive={false} dataKey="gap1" fill="transparent" legendType="none" barSize={12} />
                      <Bar isAnimationActive={false} dataKey="reqExamSup" name="Req Exam Sup" fill={PALETTE.exam.dark} barSize={10} shape={<PillBar />} />
                      <Bar isAnimationActive={false} dataKey="availExamSup" name="Avail Exam Sup" fill={PALETTE.exam.mid} barSize={10} shape={<PillBar />} />
                      <Bar isAnimationActive={false} dataKey="gap2" fill="transparent" legendType="none" barSize={12} />
                      <Bar isAnimationActive={false} dataKey="reqCommSup" name="Req Comm Sup" fill={PALETTE.comm.dark} barSize={10} shape={<PillBar />} />
                      <Bar isAnimationActive={false} dataKey="availCommSup" name="Avail Comm Sup" fill={PALETTE.comm.mid} barSize={10} shape={<PillBar />} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Period Load Density */}
                <ChartCard title="Period Load Density" icon={Clock} iconColor="#f59e0b">
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.densityData} barGap={1} barCategoryGap="25%">
                        <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: 12, fontSize: 11 }} />
                        <Bar isAnimationActive={false} dataKey="p1" stackId="a" name="Slot 1" fill="#6366f1" barSize={28} radius={[0,0,0,0]} />
                        <Bar isAnimationActive={false} dataKey="p2" stackId="a" name="Slot 2" fill="#f59e0b" barSize={28} />
                        <Bar isAnimationActive={false} dataKey="p3" stackId="a" name="Slot 3" fill="#0f172a" barSize={28} radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>

                {/* Committees per day */}
                <ChartCard title="Committees Load per Day" icon={Calendar} iconColor="#10b981">
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.committeesPerDayData}>
                        <defs>
                          <linearGradient id="gComm" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Area isAnimationActive={false} type="monotone" dataKey="count" name="Committees" stroke="#10b981" strokeWidth={2.5} fill="url(#gComm)">
                          <LabelList dataKey="count" position="top" fill="#059669" fontSize={10} fontWeight="bold" />
                        </Area>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>

                {/* Room Frequency */}
                <ChartCard title="Room Frequency (Top Utilized)" icon={DoorOpen} iconColor="#6366f1" span2>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.roomUsageData} onClick={(v: any) => v?.activePayload?.[0]?.payload && handleRoomClick(v.activePayload[0].payload)} layout="vertical">
                        <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: '#eef2ff' }} />
                        <Bar isAnimationActive={false} dataKey="count" name="Times Booked" barSize={14} radius={[0,4,4,0]} className="cursor-pointer">
                          <LabelList dataKey="count" position="right" fill="#6b7280" fontSize={10} fontWeight="bold" />
                          {stats.roomUsageData.map((_, i) => <Cell key={i} fill={ROLE_COLORS[i % ROLE_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2 text-center">Click a room bar to view its exam breakdown</p>
                </ChartCard>
              </div>

              {/* Recommendations */}
              <div className="bg-white rounded-2xl border border-indigo-100 p-6">
                <h4 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" /> Recommendations & Analysis Notes
                </h4>
                <ul className="space-y-2">
                  {stats.preRecommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          )}

          {/* ═══════════════════════════════════════════════ */}
          {/* POST-ASSIGN TAB                                 */}
          {/* ═══════════════════════════════════════════════ */}
          {activeTab === 'post' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">

              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard label="Total Assignments" value={stats.totalAssignments} icon={FileCheck} color="#10b981" />
                <KpiCard label="Quality Ratio" value={`${stats.qualityRatio}%`} icon={Award} color="#6366f1" sub="Supervisor-to-Staff" />
                <KpiCard label="Ready Reserve" value={stats.readyReserve.length} icon={Users} color="#f59e0b" sub="Staff with 0 load" />
                <KpiCard label="Exam Days" value={stats.preDayStats.length} icon={Calendar} color="#06b6d4" />
              </div>

              {/* Fairness Distribution */}
              <ChartCard title="Workload Fairness Distribution" icon={TrendingUp} iconColor="#6366f1">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.fairnessData} barGap={2} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="count" label={{ value: 'Assignments per Staff', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#94a3b8' }} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis label={{ value: 'No. of Staff', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8' }} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 12, fontSize: 11 }} />
                      <Bar isAnimationActive={false} dataKey="comm" stackId="a" name="Committee Supervisors" fill={PALETTE.comm.mid} barSize={36} shape={<PillBar />} />
                      <Bar isAnimationActive={false} dataKey="exam" stackId="a" name="Exam Supervisors" fill={PALETTE.exam.mid} barSize={36} />
                      <Bar isAnimationActive={false} dataKey="invig" stackId="a" name="Invigilators" fill={PALETTE.invig.mid} barSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              {/* Top Load per Role */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {[
                  { data: stats.topInvigilators, label: 'Top Load · Invigilators', color: PALETTE.invig.mid, icon: Users },
                  { data: stats.topExamSups, label: 'Top Load · Exam Supervisors', color: PALETTE.exam.mid, icon: ShieldCheck },
                  { data: stats.topCommSups, label: 'Top Load · Committees Sups', color: PALETTE.comm.mid, icon: Award },
                ].map(({ data: d, label, color, icon }) => (
                  <ChartCard key={label} title={label} icon={icon} iconColor={color}>
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={d} layout="vertical" barGap={2}>
                          <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke="#f1f5f9" />
                          <XAxis type="number" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <YAxis dataKey="name" type="category" width={85} tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar isAnimationActive={false} dataKey="count" name="Assignments" barSize={12} radius={[0,4,4,0]}>
                            <LabelList dataKey="count" position="right" fill="#6b7280" fontSize={9} fontWeight="bold" />
                            {d.map((_, i) => <Cell key={i} fill={ROLE_COLORS[i % ROLE_COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Daily Free Reserve */}
                <ChartCard title="Daily Free Staff Pool (Reserve)" icon={ShieldCheck} iconColor="#10b981" span2>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.dailyReserveData} barGap={1} barCategoryGap="20%">
                        <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 12, fontSize: 11 }} />
                        <Bar isAnimationActive={false} dataKey="comm" stackId="a" name="Committee Supervisors" fill={PALETTE.comm.mid} barSize={28} />
                        <Bar isAnimationActive={false} dataKey="exam" stackId="a" name="Exam Supervisors" fill={PALETTE.exam.mid} barSize={28} />
                        <Bar isAnimationActive={false} dataKey="invig" stackId="a" name="Invigilators" fill={PALETTE.invig.mid} barSize={28} radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>

                {/* Ready Reserve List */}
                <ChartCard title="Ready Reserve (0 Load)" icon={Users} iconColor="#f59e0b">
                  <div className="overflow-y-auto max-h-[260px] space-y-2 pr-1">
                    {stats.readyReserve.length === 0 ? (
                      <div className="text-center py-10 text-gray-400 text-sm">No staff with 0 assignments</div>
                    ) : stats.readyReserve.map((s, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 bg-amber-50 rounded-xl border border-amber-100">
                        <div>
                          <p className="text-xs font-semibold text-gray-900">{s.name}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{s.job_title || 'N/A'}</p>
                        </div>
                        <span className="text-[9px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">{s.supervision_role?.split(' ')[0]}</span>
                      </div>
                    ))}
                  </div>
                </ChartCard>
              </div>

              {/* Recommendations */}
              <div className="bg-white rounded-2xl border border-emerald-100 p-6">
                <h4 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-500" /> Recommendations & Analysis Notes
                </h4>
                <ul className="space-y-2">
                  {stats.postRecommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          )}

          {isExporting && (
            <div className="mt-12 pt-6 border-t-2 border-slate-200 flex justify-between items-center text-xs text-slate-500 font-medium">
              <div>Generated on {new Date().toLocaleString()}</div>
              <div>Developed by <strong>Prof. Mahmoud Elkhoudary</strong></div>
              <div>Session Master — Analytics</div>
            </div>
          )}
        </div>
      </main>

      {/* ── Drill-down Modal ─────────────────────────── */}
      {selectedDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm">{selectedDetail.title}</h3>
              <button onClick={() => setSelectedDetail(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {selectedDetail.items.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">No records found.</div>
              ) : selectedDetail.items.map((item, idx) => (
                <div key={idx} className="flex items-start justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 hover:bg-white hover:border-indigo-100 transition-all">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{item.subject}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{item.time}</span>
                      {item.room && <span className="flex items-center gap-1"><DoorOpen className="w-3 h-3" />{item.room}</span>}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 rounded-lg text-gray-500">{item.date}</span>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button onClick={() => setSelectedDetail(null)} className="px-5 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
