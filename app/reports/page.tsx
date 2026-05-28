'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { FileText, Download, Loader2, Calendar, Users, BarChart3, FileSpreadsheet, Building2, UserCheck, Mail } from 'lucide-react';
import { supabase, isSupabaseConfigured, getSupabaseConfigStatus } from '@/lib/supabase/client';
import type { Staff, ExamSessionWithRelations, AssignmentWithSession } from '@/types/database.types';
import { getPeriodFromTime } from '@/types/database.types';
import { SetupRequired } from '@/components/setup-required';
import { StaffSelectModal } from '@/components/reports/staff-select-modal';
import { DateSelectModal } from '@/components/reports/date-select-modal';
import { RoomSelectModal } from '@/components/reports/room-select-modal';
import { BulkEmailModal } from '@/components/reports/bulk-email-modal';
import {
  generateWorkloadExcel,
  generateDailyHallExcel,
  generateStaffScheduleExcel,
  generateStaffScheduleHTML,
  generateStaffSchedulePDF,
  generateDailyHallHTML,
  generateRoomScheduleExcel,
  generateRoomScheduleHTML,
  generateWeeklyHallHTML,
  generateWeeklyHallExcel,
  generateAllStaffSchedulesHTML,
  generateAllRoomSchedulesHTML,
  generateFreeInvigilatorsHTML,
  generateFreeInvigilatorsExcel,
  generateAssignedReservesHTML,
  generateAssignedReservesExcel,
  getWeekRangeLabel,
  mapFreeStaffToAssignment,
} from '@/lib/utils/report-generators';
import * as XLSX from 'xlsx';
import { downloadFile } from '@/lib/utils/csv-helpers';

export default function ReportsPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [exams, setExams] = useState<ExamSessionWithRelations[]>([]);
  const [assignments, setAssignments] = useState<AssignmentWithSession[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [freeStaff, setFreeStaff] = useState<any[]>([]);

  // Modal states
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [isBulkEmailModalOpen, setIsBulkEmailModalOpen] = useState(false);
  const [reportType, setReportType] = useState<'pdf' | 'excel' | 'email'>('pdf');

  const configStatus = getSupabaseConfigStatus();

  useEffect(() => {
    if (isSupabaseConfigured()) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, []);

  if (!configStatus.configured) {
    return <SetupRequired configStatus={configStatus} />;
  }

  const loadData = async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const [staffRes, examsRes, assignmentsRes, roomsRes, settingsRes, freeStaffRes] = await Promise.all([
        supabase.from('staff').select('*').order('name').limit(10000),
        supabase.from('exam_sessions').select('*, room:rooms(*), assignments(*, staff:staff(*))').order('exam_date').limit(10000),
        supabase.from('assignments').select('*, staff:staff(*), exam_session:exam_sessions(*, room:rooms(*))').limit(10000),
        supabase.from('rooms').select('*').order('room_name').limit(10000),
        supabase.from('system_settings').select('*').not('setting_key', 'like', 'backup_%').limit(10000),
        supabase.from('period_free_staff').select('*, staff:staff(*)').order('exam_date').order('period').limit(10000)
      ]);
      if (staffRes.error) throw staffRes.error;
      if (examsRes.error) throw examsRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;
      if (roomsRes.error) throw roomsRes.error;
      if (settingsRes.error) throw settingsRes.error;
      if (freeStaffRes.error) throw freeStaffRes.error;

      setStaff(staffRes.data || []);
      setExams(examsRes.data || []);
      setAssignments(assignmentsRes.data || []);
      setRooms(roomsRes.data || []);
      setFreeStaff(freeStaffRes.data || []);

      const fetchedSettings: any = {};
      settingsRes.data?.forEach(s => {
        fetchedSettings[s.setting_key] = s.setting_value;
      });
      if (fetchedSettings.scheduling_constraints) {
        setConfig(fetchedSettings.scheduling_constraints);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };


  // Helper to get week start date (Saturday for Egypt standard)
  const getWeekStart = (dateStr: string) => {
    const d = new Date(`${dateStr}T12:00:00Z`);
    const day = d.getUTCDay();
    const offset = day === 6 ? 0 : -(day + 1);
    const start = new Date(d.setUTCDate(d.getUTCDate() + offset));
    return start.toISOString().split('T')[0];
  };

  const availableWeeks = Array.from(new Set(exams.map(e => getWeekStart(e.exam_date)))).sort();

  const filteredExams = selectedWeek === 'all' 
    ? exams 
    : exams.filter(e => getWeekStart(e.exam_date) === selectedWeek);

  const filteredAssignments = selectedWeek === 'all'
    ? assignments
    : assignments.filter(a => a.exam_session && getWeekStart(a.exam_session.exam_date) === selectedWeek);

  const filteredFreeStaff = selectedWeek === 'all'
    ? freeStaff
    : freeStaff.filter(fs => getWeekStart(fs.exam_date) === selectedWeek);

  const mergedAssignments = [
    ...filteredAssignments,
    ...filteredFreeStaff.map(mapFreeStaffToAssignment)
  ];

  const examDates = [...new Set(filteredExams.map(e => e.exam_date))].sort();

  const handleStaffSchedule = async (selectedStaff: Staff) => {
    if (reportType === 'email') {
      if (!selectedStaff.email) {
        alert(`Staff member ${selectedStaff.name} has no email address configured in the system.`);
        return;
      }
      setGenerating('email');
      try {
        const weekLabel = getWeekRangeLabel(selectedWeek, mergedAssignments);
        const html = generateStaffScheduleHTML(selectedStaff, mergedAssignments, weekLabel);
        const pdfBlob = await generateStaffSchedulePDF(selectedStaff, mergedAssignments, weekLabel);
        
        // Convert pdfBlob to base64
        const reader = new FileReader();
        const pdfBase64 = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            const base64data = reader.result as string;
            resolve(base64data.split(',')[1]);
          };
          reader.onerror = () => reject(new Error('Failed to read PDF blob'));
          reader.readAsDataURL(pdfBlob);
        });

        const res = await fetch('/api/send-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toEmail: selectedStaff.email,
            subject: `\u200EYour Exam Supervision Schedule (${getWeekRangeLabel(selectedWeek, mergedAssignments)}) - ${selectedStaff.name}\u200E`,
            htmlContent: html,
            pdfBase64: pdfBase64,
            staffName: selectedStaff.name
          })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to send email');
        }

        alert(`Schedule successfully emailed to ${selectedStaff.name} (${selectedStaff.email})!`);
      } catch (err: any) {
        alert(`Error sending email: ${err.message || 'Unknown error'}`);
      } finally {
        setGenerating(null);
      }
      return;
    }

    setGenerating('staff');
    try {
      const weekLabel = getWeekRangeLabel(selectedWeek, mergedAssignments);
      const cleanWeekLabel = weekLabel.replace(/[\/\\:\*\?"<>\|]/g, '').replace(/\s+/g, '_');
      if (reportType === 'excel') {
        const blob = generateStaffScheduleExcel(selectedStaff, mergedAssignments, weekLabel);
        downloadFile(blob, `schedule_${selectedStaff.name.replace(/[\/\\:\*\?"<>\|]/g, '').replace(/\s+/g, '_')}_${cleanWeekLabel}.xlsx`);
      } else {
        const html = generateStaffScheduleHTML(selectedStaff, mergedAssignments, weekLabel);
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
        }
      }
    } finally {
      setGenerating(null);
    }
  };

  const handleDailyHallSheet = (date: string) => {
    setGenerating('hall');
    try {
      if (reportType === 'excel') {
        const blob = generateDailyHallExcel(filteredExams, date);
        downloadFile(blob, `hall_sheet_${date}.xlsx`);
      } else {
        const html = generateDailyHallHTML(filteredExams, date);
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
        }
      }
    } finally {
      setGenerating(null);
    }
  };

  const handleRoomSchedule = (selectedRoom: any) => {
    setGenerating('room');
    try {
      if (reportType === 'excel') {
        const blob = generateRoomScheduleExcel(selectedRoom, filteredExams);
        downloadFile(blob, `room_schedule_${selectedRoom.room_name.replace(/\s+/g, '_')}.xlsx`);
      } else {
        const html = generateRoomScheduleHTML(selectedRoom, filteredExams);
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
        }
      }
    } finally {
      setGenerating(null);
    }
  };

  const handleAllStaffReports = () => {
    setGenerating('all-staff');
    try {
      const weekLabel = getWeekRangeLabel(selectedWeek, mergedAssignments);
      const html = generateAllStaffSchedulesHTML(staff, mergedAssignments, weekLabel);
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
      }
    } finally {
      setGenerating(null);
    }
  };

  const handleAllRoomReports = () => {
    setGenerating('all-rooms');
    try {
      const html = generateAllRoomSchedulesHTML(rooms, filteredExams);
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
      }
    } finally {
      setGenerating(null);
    }
  };

  const handleWorkloadExport = () => {
    setGenerating('workload');
    try {
      const blob = generateWorkloadExcel(staff, mergedAssignments);
      downloadFile(blob, `workload_statistics_${new Date().toISOString().split('T')[0]}.xlsx`);
    } finally {
      setGenerating(null);
    }
  };

  const handleWeeklyHallReport = (mode: 'pdf' | 'excel') => {
    setGenerating('weekly-hall');
    try {
      const weekLabel = getWeekRangeLabel(selectedWeek, mergedAssignments);
      const cleanWeekLabel = weekLabel.replace(/[\/\\:\*\?"<>\|]/g, '').replace(/\s+/g, '_');
      if (mode === 'excel') {
        const blob = generateWeeklyHallExcel(filteredExams, weekLabel, filteredFreeStaff);
        downloadFile(blob, `weekly_hall_report_${cleanWeekLabel}.xlsx`);
      } else {
        const html = generateWeeklyHallHTML(filteredExams, weekLabel, filteredFreeStaff);
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
        }
      }
    } finally {
      setGenerating(null);
    }
  };

  const handleFreeInvigilatorsReport = (mode: 'pdf' | 'excel') => {
    setGenerating('free-invigilators');
    try {
      // Build flat assignment array from the enriched assignments
      const flatAssignments = filteredAssignments.map(a => ({
        id: a.id,
        exam_session_id: a.exam_session_id,
        staff_id: a.staff_id,
        role: a.role,
        assigned_at: a.assigned_at,
        assigned_by: a.assigned_by,
        is_manual_override: a.is_manual_override,
      }));
      // Build flat exam sessions from enriched exams
      const flatSessions = filteredExams.map(e => ({
        id: e.id,
        subject_name: e.subject_name,
        exam_date: e.exam_date,
        start_time: e.start_time,
        student_count: e.student_count,
        room_id: e.room_id,
        exam_type: e.exam_type,
        end_time: e.end_time,
        student_start: e.student_start,
        student_end: e.student_end,
        is_locked: e.is_locked,
        program: e.program,
        created_at: e.created_at,
        updated_at: e.updated_at,
      }));
      if (mode === 'excel') {
        const blob = generateFreeInvigilatorsExcel(staff, flatSessions, flatAssignments, config);
        downloadFile(blob, `free_invigilators_${new Date().toISOString().split('T')[0]}.xlsx`);
      } else {
        const html = generateFreeInvigilatorsHTML(staff, flatSessions, flatAssignments, config);
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
        }
      }
    } finally {
      setGenerating(null);
    }
  };

  const handleAssignedReservesReport = (mode: 'pdf' | 'excel') => {
    setGenerating('assigned-reserves');
    try {
      const weekLabel = getWeekRangeLabel(selectedWeek, mergedAssignments);
      if (mode === 'excel') {
        const blob = generateAssignedReservesExcel(filteredFreeStaff, weekLabel);
        downloadFile(blob, `assigned_reserves_${new Date().toISOString().split('T')[0]}.xlsx`);
      } else {
        const html = generateAssignedReservesHTML(filteredFreeStaff, weekLabel);
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
        }
      }
    } finally {
      setGenerating(null);
    }
  };

  const handleAllSchedulesExport = () => {
    setGenerating('all');
    try {
      const headers = ['Staff Name', 'Date', 'Period', 'Time', 'Subject', 'Room', 'Role'];
      const rows: string[][] = [];

      staff.forEach(s => {
        const staffAssignments = mergedAssignments.filter(a => a.staff_id === s.id && a.exam_session);
        staffAssignments.forEach(a => {
          const exam = a.exam_session!;
          rows.push([
            s.name, exam.exam_date, `Period ${getPeriodFromTime(exam.start_time)}`, exam.start_time,
            exam.subject_name, exam.room?.room_name || '', 
            a.role === 'Exam_Supervisor' ? 'Exam Supervisor' : a.role === 'Head_Supervisor' || a.role === 'Committees_Supervisor' ? 'ComSupervisor' : 'Invigilator'
          ]);
        });
      });

      const data = [headers, ...rows];
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "All Schedules");
      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      downloadFile(blob, `all_schedules_${new Date().toISOString().split('T')[0]}.xlsx`);
    } finally {
      setGenerating(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Loading report data...</span>
      </div>
    );
  }

  return (
    <div className="pb-12">
      <PageHeader title="Reports & Exports" description="Generate schedules and export statistics" />

      {/* Week Filter Selector */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-800 text-sm">Report Filter</h3>
          <p className="text-xs text-slate-500 mt-1">Select a specific week to filter report generation and stats.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Target Week:</label>
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="border border-slate-300 rounded-lg shadow-sm focus:border-primary-500 focus:ring-primary-500 text-xs p-2 bg-slate-50 hover:bg-white transition-colors cursor-pointer min-w-[240px]"
          >
            <option value="all">All Weeks (No Filter)</option>
            {availableWeeks.map(week => (
              <option key={week} value={week}>
                Week of {new Date(week).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} (Saturday)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 text-center">
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm transition-all hover:shadow-md">
          <div className="text-3xl font-display font-bold text-slate-900 leading-none">{staff.length}</div>
          <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-2">Active Staff</div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm transition-all hover:shadow-md">
          <div className="text-3xl font-display font-bold text-primary-600 leading-none">{filteredExams.length}</div>
          <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-2">Total Sessions</div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm transition-all hover:shadow-md">
          <div className="text-3xl font-display font-bold text-success-600 leading-none">{filteredAssignments.length}</div>
          <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-2">Assignments</div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm transition-all hover:shadow-md">
          <div className="text-3xl font-display font-bold text-violet-600 leading-none">{examDates.length}</div>
          <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-2">Exam Days</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Weekly Hall Report - Highlighted */}
        <div className="card p-7 border-l-4 border-l-primary-900 bg-primary-50/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
             <Building2 className="w-32 h-32" />
          </div>
          <div className="relative">
            <div className="flex items-center mb-4">
              <div className="bg-primary-900 p-2.5 rounded-xl shadow-lg shadow-primary-900/20">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold ml-4 text-primary-950">Weekly Hall Report</h3>
            </div>
            <p className="text-gray-600 mb-8 text-sm leading-relaxed">Comprehensive consolidated weekly schedule for all halls, slots, and proctors.</p>
            <div className="space-y-3">
              <button 
                onClick={() => handleWeeklyHallReport('pdf')} 
                className="btn btn-primary bg-primary-950 w-full hover:bg-black transition-colors" 
                disabled={generating === 'weekly-hall' || exams.length === 0}
              >
                {generating === 'weekly-hall' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                Print Preview
              </button>
              <button 
                onClick={() => handleWeeklyHallReport('excel')} 
                className="btn btn-secondary bg-white border border-slate-200 w-full hover:bg-slate-50" 
                disabled={generating === 'weekly-hall' || exams.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />Export Excel
              </button>
            </div>
          </div>
        </div>

        {/* Daily Hall Sheet */}
        <div className="card p-7">
          <div className="flex items-center mb-4">
            <div className="bg-success-100 p-2.5 rounded-xl">
              <Calendar className="w-6 h-6 text-success-600" />
            </div>
            <h3 className="text-lg font-bold ml-4 text-slate-900">Daily Hall Sheet</h3>
          </div>
          <p className="text-gray-600 mb-8 text-sm leading-relaxed">Daily proctoring sheets for all halls, organized by exam period.</p>
          <div className="space-y-3">
            <button onClick={() => { setReportType('pdf'); setIsDateModalOpen(true); }} className="btn btn-success w-full font-bold">
              <FileText className="w-4 h-4 mr-2" />Print Preview
            </button>
            <button onClick={() => { setReportType('excel'); setIsDateModalOpen(true); }} className="btn btn-secondary bg-white border border-slate-200 w-full hover:bg-slate-50">
              <Download className="w-4 h-4 mr-2" />Export Excel
            </button>
          </div>
        </div>

        {/* Staff Schedule */}
        <div className="card p-7">
          <div className="flex items-center mb-4">
            <div className="bg-primary-100 p-2.5 rounded-xl">
              <Users className="w-6 h-6 text-primary-600" />
            </div>
            <h3 className="text-lg font-bold ml-4 text-slate-900">Staff Schedule</h3>
          </div>
          <p className="text-gray-600 mb-8 text-sm leading-relaxed">Individual member schedules with total assigned workload visibility.</p>
          <div className="space-y-3">
            <button onClick={() => { setReportType('pdf'); setIsStaffModalOpen(true); }} className="btn btn-primary w-full font-bold">
              <FileText className="w-4 h-4 mr-2" />Print Preview
            </button>
            <button onClick={() => { setReportType('email'); setIsStaffModalOpen(true); }} className="btn bg-amber-600 hover:bg-amber-700 text-white w-full font-bold flex items-center justify-center" disabled={generating === 'email' || staff.length === 0}>
              {generating === 'email' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Email Schedule
            </button>
            <button onClick={() => setIsBulkEmailModalOpen(true)} className="btn bg-violet-600 hover:bg-violet-700 text-white w-full font-bold flex items-center justify-center" disabled={staff.length === 0}>
              <Mail className="w-4 h-4 mr-2" />
              Bulk Email Week&apos;s Schedules
            </button>
            <button onClick={handleAllStaffReports} className="btn btn-primary bg-indigo-900 w-full font-bold" disabled={generating === 'all-staff' || staff.length === 0}>
              {generating === 'all-staff' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
              Print All Staff
            </button>
            <button onClick={() => { setReportType('excel'); setIsStaffModalOpen(true); }} className="btn btn-secondary bg-white border border-slate-200 w-full hover:bg-slate-50">
              <Download className="w-4 h-4 mr-2" />Export Excel
            </button>
          </div>
        </div>

        {/* Hall Usage Schedule */}
        <div className="card p-7">
          <div className="flex items-center mb-4">
            <div className="bg-indigo-100 p-2.5 rounded-xl">
              <Building2 className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-lg font-bold ml-4 text-slate-900">Hall Usage List</h3>
          </div>
          <p className="text-gray-600 mb-8 text-sm leading-relaxed">View all sessions organized and sorted by specific exam hall/room.</p>
          <div className="space-y-3">
            <button 
              onClick={() => { setReportType('pdf'); setIsRoomModalOpen(true); }} 
              className="btn btn-primary w-full text-white font-bold" 
              style={{ backgroundColor: '#4f46e5' }}
            >
              <FileText className="w-4 h-4 mr-2" />Print Preview
            </button>
            <button onClick={handleAllRoomReports} className="btn btn-primary bg-slate-900 w-full text-white font-bold" disabled={generating === 'all-rooms' || rooms.length === 0}>
              {generating === 'all-rooms' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
              Print All Halls
            </button>
            <button onClick={() => { setReportType('excel'); setIsRoomModalOpen(true); }} className="btn btn-secondary bg-white border border-slate-200 w-full hover:bg-slate-50">
              <Download className="w-4 h-4 mr-2" />Export Excel
            </button>
          </div>
        </div>

        {/* Workload Statistics */}
        <div className="card p-7">
          <div className="flex items-center mb-4">
            <div className="bg-warning-100 p-2.5 rounded-xl">
              <BarChart3 className="w-6 h-6 text-warning-600" />
            </div>
            <h3 className="text-lg font-bold ml-4 text-slate-900">Workload Statistics</h3>
          </div>
          <p className="text-gray-600 mb-8 text-sm">Full table of cumulative scores and total assignments per proctor.</p>
          <button onClick={handleWorkloadExport} className="btn btn-warning w-full font-bold shadow-sm" disabled={generating === 'workload' || staff.length === 0}>
            {generating === 'workload' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Export Stats Excel
          </button>
        </div>

        {/* Bulk Master Export */}
        <div className="card p-7">
          <div className="flex items-center mb-4">
            <div className="bg-slate-100 p-2.5 rounded-xl">
              <FileSpreadsheet className="w-6 h-6 text-slate-600" />
            </div>
            <h3 className="text-lg font-bold ml-4 text-slate-900">Bulk Master List</h3>
          </div>
          <p className="text-gray-600 mb-8 text-sm">Full raw export of every assignment in the database for auditing.</p>
          <button onClick={handleAllSchedulesExport} className="btn btn-secondary w-full font-bold bg-white border border-slate-200 hover:bg-slate-50" disabled={generating === 'all' || assignments.length === 0}>
            {generating === 'all' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Download Master File
          </button>
        </div>

        {/* Free Invigilators Report - Highlighted */}
        <div className="card p-7 border-l-4 border-l-emerald-600 bg-emerald-50/20 relative overflow-hidden group md:col-span-2 lg:col-span-3">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
            <UserCheck className="w-32 h-32" />
          </div>
          <div className="relative">
            <div className="flex items-center mb-3">
              <div className="bg-emerald-600 p-2.5 rounded-xl shadow-lg shadow-emerald-600/20">
                <UserCheck className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-bold text-emerald-950">Free Invigilators &amp; Assigned Reserves</h3>
                <p className="text-gray-600 text-sm mt-0.5">
                  Generate reports for all available (unassigned) invigilators ranked by score, or specifically for the <strong>assigned reserve standbys</strong> for each period.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              <div>
                <h4 className="text-sm font-semibold text-emerald-900 mb-2">Completely Free Staff</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleFreeInvigilatorsReport('pdf')}
                    className="btn flex-1 font-bold text-white text-xs py-2"
                    style={{ backgroundColor: '#059669' }}
                    disabled={generating === 'free-invigilators' || staff.length === 0}
                  >
                    {generating === 'free-invigilators' ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 mr-1.5" />}
                    Print Report
                  </button>
                  <button
                    onClick={() => handleFreeInvigilatorsReport('excel')}
                    className="btn flex-1 font-bold bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 text-xs py-2"
                    disabled={generating === 'free-invigilators' || staff.length === 0}
                  >
                    {generating === 'free-invigilators' ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
                    Excel Export
                  </button>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-emerald-900 mb-2">Assigned Reserves</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAssignedReservesReport('pdf')}
                    className="btn flex-1 font-bold text-white text-xs py-2"
                    style={{ backgroundColor: '#0ea5e9' }}
                    disabled={generating === 'assigned-reserves' || filteredFreeStaff.length === 0}
                  >
                    {generating === 'assigned-reserves' ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 mr-1.5" />}
                    Print Report
                  </button>
                  <button
                    onClick={() => handleAssignedReservesReport('excel')}
                    className="btn flex-1 font-bold bg-white text-sky-700 border border-sky-200 hover:bg-sky-50 text-xs py-2"
                    disabled={generating === 'assigned-reserves' || filteredFreeStaff.length === 0}
                  >
                    {generating === 'assigned-reserves' ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
                    Excel Export
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <StaffSelectModal isOpen={isStaffModalOpen} onClose={() => setIsStaffModalOpen(false)} staff={staff} title="Select Staff Member" onSelect={handleStaffSchedule} />
      <DateSelectModal isOpen={isDateModalOpen} onClose={() => setIsDateModalOpen(false)} title="Select Exam Date" availableDates={examDates} onSelect={handleDailyHallSheet} />
      <RoomSelectModal isOpen={isRoomModalOpen} onClose={() => setIsRoomModalOpen(false)} rooms={rooms} title="Select Exam Hall" onSelect={handleRoomSchedule} />
      <BulkEmailModal
        isOpen={isBulkEmailModalOpen}
        onClose={() => setIsBulkEmailModalOpen(false)}
        selectedWeek={selectedWeek}
        availableWeeks={availableWeeks}
        staff={staff}
        assignments={assignments}
        freeStaffList={freeStaff}
      />
    </div>
  );
}
