'use client';

import React, { useState, useMemo } from 'react';
import { 
  X, Scale, Download, CheckCircle2, AlertTriangle, Users, 
  Search, Shield, Check, FileSpreadsheet, Sparkles, Filter, ChevronRight
} from 'lucide-react';
import type { Staff, Assignment, ExamSession, PeriodFreeStaff } from '@/types/database.types';

export interface CohortStats {
  cohortName: string;
  totalMembers: number;
  activeMembers: number;
  minScore: number;
  maxScore: number;
  avgScore: number;
  spread: number;
  isCompliant: boolean;
  minDaysWorked: number;
  maxDaysWorked: number;
}

export interface StaffFairnessRecord {
  id: string;
  name: string;
  job_title: string;
  supervision_role: string;
  cohort: string;
  employment_status: string;
  totalScore: number;
  roomDuties: number;
  reserveDuties: number;
  maxDaysInSingleWeek: number;
  totalDaysWorked: number;
  weeklyLimit: number;
  isWeeklyDaysCompliant: boolean;
  workingDaysCount: number;
  configuredDaysCount: number;
  hasHealthIssue: boolean;
  allowedBuildings?: string[];
  status: string;
  peerMinScore: number;
  deltaFromMin: number;
  isCompliant: boolean;
}

function getAcademicWeekKey(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const day = d.getUTCDay();
  const daysSinceSaturday = (day + 1) % 7;
  const sat = new Date(d);
  sat.setUTCDate(d.getUTCDate() - daysSinceSaturday);
  return sat.toISOString().split('T')[0];
}

interface FairnessReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: Staff[];
  assignments: Assignment[];
  sessions: ExamSession[];
  reserves?: PeriodFreeStaff[];
  configuredCap?: number;
  periodName?: string;
}

export function FairnessReportModal({
  isOpen,
  onClose,
  staff,
  assignments,
  sessions,
  reserves = [],
  configuredCap = 3,
  periodName = 'Active Exam Period',
}: FairnessReportModalProps) {
  const [selectedCohortTab, setSelectedCohortTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pre-index sessions for fast O(1) lookup
  const sessionMap = useMemo(() => {
    return new Map<string, ExamSession>(sessions.map(s => [s.id, s]));
  }, [sessions]);

  // Compute staff records and cohort stats
  const { staffRecords, cohortSummaries } = useMemo(() => {
    // 1. Group assignments by staff member
    const staffRoomPeriods = new Map<string, Set<string>>();
    const staffDaysWorked = new Map<string, Set<string>>();
    const staffDaysByWeek = new Map<string, Map<string, Set<string>>>();

    for (const a of assignments) {
      const sess = sessionMap.get(a.exam_session_id);
      if (!sess) continue;

      if (!staffRoomPeriods.has(a.staff_id)) staffRoomPeriods.set(a.staff_id, new Set());
      staffRoomPeriods.get(a.staff_id)!.add(`${sess.exam_date}_${sess.start_time}`);

      if (!staffDaysWorked.has(a.staff_id)) staffDaysWorked.set(a.staff_id, new Set());
      staffDaysWorked.get(a.staff_id)!.add(sess.exam_date);

      const wk = getAcademicWeekKey(sess.exam_date);
      if (!staffDaysByWeek.has(a.staff_id)) staffDaysByWeek.set(a.staff_id, new Map());
      const wMap = staffDaysByWeek.get(a.staff_id)!;
      if (!wMap.has(wk)) wMap.set(wk, new Set());
      wMap.get(wk)!.add(sess.exam_date);
    }

    // 2. Count reserves
    const staffReserves = new Map<string, number>();
    for (const r of reserves) {
      staffReserves.set(r.staff_id, (staffReserves.get(r.staff_id) || 0) + 1);
      if (!staffDaysWorked.has(r.staff_id)) staffDaysWorked.set(r.staff_id, new Set());
      staffDaysWorked.get(r.staff_id)!.add(r.exam_date);

      const wk = getAcademicWeekKey(r.exam_date);
      if (!staffDaysByWeek.has(r.staff_id)) staffDaysByWeek.set(r.staff_id, new Map());
      const wMap = staffDaysByWeek.get(r.staff_id)!;
      if (!wMap.has(wk)) wMap.set(wk, new Set());
      wMap.get(wk)!.add(r.exam_date);
    }

    // 3. Group by cohort
    const cohortGroups = new Map<string, typeof staff>();
    for (const s of staff) {
      const cohort = s.job_title || s.supervision_role || 'General';
      if (!cohortGroups.has(cohort)) cohortGroups.set(cohort, []);
      cohortGroups.get(cohort)!.push(s);
    }

    // 4. Calculate cohort baseline (min score among active members)
    const cohortMinScores = new Map<string, number>();
    for (const [cohort, members] of cohortGroups.entries()) {
      const activeMembers = members.filter(m => m.availability_status === 'Available' && (m.working_days?.length || 0) > 0);
      if (activeMembers.length === 0) continue;

      const scores = activeMembers.map(m => {
        const roomPeriods = staffRoomPeriods.get(m.id)?.size || 0;
        const resCount = staffReserves.get(m.id) || 0;
        return roomPeriods + (resCount * 0.25);
      });
      cohortMinScores.set(cohort, Math.min(...scores));
    }

    // 5. Build detailed staff records
    const records: StaffFairnessRecord[] = staff.map(s => {
      const cohort = s.job_title || s.supervision_role || 'General';
      const roomDuties = staffRoomPeriods.get(s.id)?.size || 0;
      const reserveDuties = staffReserves.get(s.id) || 0;
      const totalScore = roomDuties + (reserveDuties * 0.25);
      const workingDaysCount = staffDaysWorked.get(s.id)?.size || 0;
      const configuredDaysCount = s.working_days?.length || 0;
      const pMin = cohortMinScores.get(cohort) ?? totalScore;
      const deltaFromMin = Number((totalScore - pMin).toFixed(2));
      const isCompliant = deltaFromMin <= configuredCap + 1e-4;

      const wMap = staffDaysByWeek.get(s.id);
      const maxDaysInSingleWeek = wMap ? Math.max(0, ...Array.from(wMap.values()).map(dates => dates.size)) : 0;
      const weeklyLimit = s.employment_status === 'Part-time' ? 3 : 5;
      const isWeeklyDaysCompliant = maxDaysInSingleWeek <= weeklyLimit;

      return {
        id: s.id,
        name: s.name,
        job_title: s.job_title || 'General',
        supervision_role: s.supervision_role,
        cohort,
        employment_status: s.employment_status || 'Full-time',
        totalScore,
        roomDuties,
        reserveDuties,
        maxDaysInSingleWeek,
        totalDaysWorked: workingDaysCount,
        weeklyLimit,
        isWeeklyDaysCompliant,
        workingDaysCount,
        configuredDaysCount,
        hasHealthIssue: Boolean(s.has_health_issue),
        allowedBuildings: s.allowed_buildings,
        status: s.availability_status,
        peerMinScore: pMin,
        deltaFromMin,
        isCompliant,
      };
    });

    // 6. Build cohort summary metrics
    const summaries: CohortStats[] = [];
    const targetCohorts = ['Chemist', 'Teaching Assistant', 'Demonstrator', 'Lecturer'];

    // Include standard cohorts first, then any custom ones
    const allCohortNames = Array.from(new Set([...targetCohorts, ...cohortGroups.keys()]));

    for (const cName of allCohortNames) {
      const cohortRecords = records.filter(r => r.cohort === cName && r.status === 'Available' && r.configuredDaysCount > 0);
      if (cohortRecords.length === 0) continue;

      const scores = cohortRecords.map(r => r.totalScore);
      const daysWorked = cohortRecords.map(r => r.workingDaysCount);
      const minScore = Math.min(...scores);
      const maxScore = Math.max(...scores);
      const avgScore = Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2));
      const spread = Number((maxScore - minScore).toFixed(2));

      summaries.push({
        cohortName: cName,
        totalMembers: records.filter(r => r.cohort === cName).length,
        activeMembers: cohortRecords.length,
        minScore,
        maxScore,
        avgScore,
        spread,
        isCompliant: spread <= configuredCap,
        minDaysWorked: Math.min(...daysWorked),
        maxDaysWorked: Math.max(...daysWorked),
      });
    }

    return { staffRecords: records, cohortSummaries: summaries };
  }, [staff, assignments, reserves, sessionMap, configuredCap]);

  // Filter staff records by tab and search query
  const filteredRecords = useMemo(() => {
    return staffRecords.filter(r => {
      if (selectedCohortTab !== 'all' && r.cohort !== selectedCohortTab) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        return r.name.toLowerCase().includes(query) || r.cohort.toLowerCase().includes(query) || r.supervision_role.toLowerCase().includes(query);
      }
      return true;
    }).sort((a, b) => {
      // Sort within tab: highest score first, then name
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return a.name.localeCompare(b.name);
    });
  }, [staffRecords, selectedCohortTab, searchQuery]);

  // Export to CSV with UTF-8 BOM for Excel
  const handleExportCSV = () => {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    // Header section
    let csv = `\uFEFF`; // UTF-8 BOM
    csv += `Horus University in Egypt - Faculty Examination Supervision System\n`;
    csv += `Fairness & Workload Parity Audit Report\n`;
    csv += `Period:,"${periodName}",Generated:,"${timestamp}",Configured Delta Cap:,"${configuredCap} Points"\n\n`;

    // Cohorts summary section
    csv += `=== COHORT SUMMARY METRICS ===\n`;
    csv += `Cohort Name,Active Staff,Min Score,Max Score,Average Score,Score Spread (Max-Min),Configured Cap,Parity Status,Working Days Range\n`;
    for (const c of cohortSummaries) {
      const statusText = c.isCompliant ? `COMPLIANT (Spread <= ${configuredCap})` : `NON-COMPLIANT (Spread > ${configuredCap})`;
      csv += `"${c.cohortName}",${c.activeMembers},${c.minScore},${c.maxScore},${c.avgScore},${c.spread},${configuredCap},"${statusText}","${c.minDaysWorked} - ${c.maxDaysWorked} days"\n`;
    }

    csv += `\n=== DETAILED INDIVIDUAL STAFF ROSTER ===\n`;
    csv += `Staff Name,Job Title,Supervision Role,Cohort,Employment Status,Total Score,Room Duty Periods,Reserve Duties,Weekly Days (Peak),Weekly Limit,Weekly Days Compliance,Total Period Days,Configured Days,Health Issue,Peer Min Score,Delta From Min,Score Parity Status\n`;

    const sortedForExport = [...staffRecords].sort((a, b) => {
      if (a.cohort !== b.cohort) return a.cohort.localeCompare(b.cohort);
      return b.totalScore - a.totalScore;
    });

    for (const r of sortedForExport) {
      const capStatus = r.isCompliant ? 'COMPLIANT' : 'EXCEEDED';
      const weeklyDayStatus = r.isWeeklyDaysCompliant ? `COMPLIANT (<= ${r.weeklyLimit}d)` : `EXCEEDED (> ${r.weeklyLimit}d)`;
      const healthStr = r.hasHealthIssue ? `YES (${(r.allowedBuildings?.length ? r.allowedBuildings : ['M', 'P']).join('/')})` : 'NO';
      csv += `"${r.name}","${r.job_title}","${r.supervision_role}","${r.cohort}","${r.employment_status}",${r.totalScore},${r.roomDuties},${r.reserveDuties},${r.maxDaysInSingleWeek},${r.weeklyLimit},"${weeklyDayStatus}",${r.totalDaysWorked},${r.configuredDaysCount},"${healthStr}",${r.peerMinScore},${r.deltaFromMin},"${capStatus}"\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fairness_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-[#00122e] via-[#001f4d] to-[#1527a0] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-display font-bold">Fairness &amp; Workload Parity Report</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-white/10 text-white border border-white/20">
                  Target Delta: &le; {configuredCap} pts
                </span>
              </div>
              <p className="text-xs text-white/70 mt-0.5">
                Audit of peer score distributions, maximum score spreads, and working days across all staff cohorts
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors border border-emerald-400/30"
              title="Download Full CSV / Excel Report"
            >
              <Download className="w-4 h-4" />
              Download Report (CSV)
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Cohort KPI Summary Cards */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Peer Cohorts Workload Spreads
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {cohortSummaries.map((c) => (
                <div
                  key={c.cohortName}
                  onClick={() => setSelectedCohortTab(c.cohortName)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    selectedCohortTab === c.cohortName
                      ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-slate-900">{c.cohortName}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                      c.isCompliant
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {c.isCompliant ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      &Delta; {c.spread}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center py-2 bg-slate-50 rounded-lg border border-slate-100 mb-2">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-medium">Min</div>
                      <div className="text-sm font-bold text-slate-900">{c.minScore}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-medium">Avg</div>
                      <div className="text-sm font-bold text-slate-700">{c.avgScore}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-medium">Max</div>
                      <div className="text-sm font-bold text-slate-900">{c.maxScore}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{c.activeMembers} active staff</span>
                    <span>{c.minDaysWorked}&ndash;{c.maxDaysWorked} days</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Search & Tabs Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-full sm:w-auto overflow-x-auto">
              <button
                onClick={() => setSelectedCohortTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedCohortTab === 'all'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Staff ({staffRecords.length})
              </button>
              {cohortSummaries.map((c) => (
                <button
                  key={c.cohortName}
                  onClick={() => setSelectedCohortTab(c.cohortName)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedCohortTab === c.cohortName
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {c.cohortName} ({c.activeMembers})
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search staff name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Detailed Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="max-h-[380px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 border-b border-slate-200 z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">Staff Member</th>
                    <th className="py-2.5 px-3">Job Title</th>
                    <th className="py-2.5 px-3">Supervision Role</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-center">Total Score</th>
                    <th className="py-2.5 px-3 text-center">Room Periods</th>
                    <th className="py-2.5 px-3 text-center">Reserves</th>
                    <th className="py-2.5 px-3 text-center">Weekly Days (Peak)</th>
                    <th className="py-2.5 px-3 text-center">Total Period Days</th>
                    <th className="py-2.5 px-3 text-center">Delta vs Floor</th>
                    <th className="py-2.5 px-3 text-center">Parity Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-slate-400">
                        No staff members found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r, idx) => (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 flex items-center gap-1.5">
                          <span>{r.name}</span>
                          {r.hasHealthIssue && (
                            <span
                              className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded"
                              title={`Allowed buildings: ${(r.allowedBuildings?.length ? r.allowedBuildings : ['M', 'P']).join(', ')}`}
                            >
                              Health ({(r.allowedBuildings?.length ? r.allowedBuildings : ['M', 'P']).join('/')})
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium">
                          <span className="px-2 py-0.5 bg-slate-100 border border-slate-200/80 rounded-md text-[11px]">
                            {r.job_title || '—'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium">
                          <span className={`px-2 py-0.5 rounded-md text-[11px] border font-semibold ${
                            r.supervision_role === 'Committees Supervisor'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : r.supervision_role === 'Exam Supervisor'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : r.supervision_role === 'Invigilator / Exam Supervisor'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {r.supervision_role || '—'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                            r.employment_status === 'Part-time' 
                              ? 'bg-purple-50 text-purple-700 border-purple-200' 
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {r.employment_status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-indigo-700">
                          <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-md">
                            {r.totalScore.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-slate-700">{r.roomDuties}</td>
                        <td className="py-2.5 px-3 text-center text-slate-600">
                          {r.reserveDuties > 0 ? (
                            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded">
                              +{r.reserveDuties}
                            </span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className={`font-semibold ${r.isWeeklyDaysCompliant ? 'text-slate-800' : 'text-red-600 font-bold'}`}>
                              {r.maxDaysInSingleWeek}d
                            </span>
                            <span className="text-slate-400 text-[10px]">/ max {r.weeklyLimit}d</span>
                            {r.isWeeklyDaysCompliant ? (
                              <span className="text-emerald-600 font-bold text-[10px]">✓</span>
                            ) : (
                              <span className="text-red-500 font-bold text-[10px]">⚠</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-600 font-medium">
                          {r.totalDaysWorked}d
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-[11px]">
                          {r.deltaFromMin === 0 ? (
                            <span className="text-slate-400">Baseline</span>
                          ) : (
                            <span className={r.deltaFromMin <= configuredCap ? 'text-slate-700 font-semibold' : 'text-amber-700 font-bold'}>
                              +{r.deltaFromMin}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {r.isCompliant ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Check className="w-3 h-3" /> OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertTriangle className="w-3 h-3" /> Exceeded
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Total Staff Audited: <span className="font-semibold text-slate-700">{staffRecords.length}</span> | 
            Configured Workload Cap: <span className="font-semibold text-slate-700">&le; {configuredCap} points above cohort floor</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
