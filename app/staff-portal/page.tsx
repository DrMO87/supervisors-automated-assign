'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Staff, Room, getPeriodFromTime, ExamSessionWithRelations, AssignmentWithSession } from '@/types/database.types';
import { Loader2, Calendar, Clock, DoorOpen, User, RefreshCw, LogOut, CheckCircle2, FileText, Download, BarChart3, Users, FileSpreadsheet, ShieldCheck, AlertCircle, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  generateStaffScheduleExcel,
  generateStaffScheduleHTML,
  generateAllStaffSchedulesHTML,
  generateDailyHallExcel, generateDailyHallHTML,
  generateWeeklyHallExcel, generateWeeklyHallHTML,
  generateAssignedReservesExcel, generateAssignedReservesHTML,
  generateFreeInvigilatorsExcel, generateFreeInvigilatorsHTML,
  generateWorkloadExcel,
  generateOralExamsHTML, generateOralExamsExcel,
  getWeekRangeLabel,
  mapFreeStaffToAssignment,
} from '@/lib/utils/report-generators';
import { downloadFile } from '@/lib/utils/csv-helpers';
import { AreaChart, Area, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { AiQueryBox } from '@/components/dashboard/ai-query-box';

export default function UnifiedStaffPortalPage() {
  const [activeTab, setActiveTab] = useState<'swap' | 'schedule' | 'swap_log' | 'all_schedules' | 'reserves'>('swap');
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [roomList, setRoomList] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Swap State ---
  const [submittingSwap, setSubmittingSwap] = useState(false);
  const [swapSuccess, setSwapSuccess] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [examDate, setExamDate] = useState('');
  const [period, setPeriod] = useState<string>('1');
  const [roomId, setRoomId] = useState('');
  const [originalStaffId, setOriginalStaffId] = useState('');
  const [replacementStaffId, setReplacementStaffId] = useState('');
  const [sessionsData, setSessionsData] = useState<any[]>([]);
  const [freeStaffData, setFreeStaffData] = useState<any[]>([]);

  // --- Schedule State ---
  const [staffMember, setStaffMember] = useState<Staff | null>(null);
  const [exams, setExams] = useState<ExamSessionWithRelations[]>([]);
  const [assignments, setAssignments] = useState<AssignmentWithSession[]>([]);
  const [freeStaff, setFreeStaff] = useState<any[]>([]);
  const [generatingSchedule, setGeneratingSchedule] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // --- Generic Staff State ---
  const [swaps, setSwaps] = useState<any[]>([]);
  const [reserveDate, setReserveDate] = useState<string>('');
  const [reservePeriod, setReservePeriod] = useState<string>('1');
  const [reserveStaffId, setReserveStaffId] = useState<string>('');
  const [reserveRole, setReserveRole] = useState<string>('Assistant');
  const [addingReserve, setAddingReserve] = useState(false);
  const [reserveMessage, setReserveMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const handleAddReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reserveDate || !reserveStaffId) return;
    setAddingReserve(true);
    setReserveMessage(null);
    try {
      const periodExam = exams.find(ex => ex.exam_date === reserveDate && getPeriodFromTime(ex.start_time) === parseInt(reservePeriod));
      const startTime = periodExam ? periodExam.start_time : '09:00:00'; 
      const { error } = await supabase.from('period_free_staff').insert({
        staff_id: reserveStaffId,
        exam_date: reserveDate,
        period: parseInt(reservePeriod),
        start_time: startTime,
        role: reserveRole
      });
      if (error) throw error;
      setReserveMessage({ type: 'success', text: 'Reserve added successfully' });
      const { data } = await supabase.from('period_free_staff').select('*, staff(*)');
      if (data) {
        setFreeStaffData(data);
        setFreeStaff(data);
      }
    } catch (err: any) {
      setReserveMessage({ type: 'error', text: err.message });
    } finally {
      setAddingReserve(false);
    }
  };

  const handleDeleteReserve = async (id: string) => {
    try {
      const { error } = await supabase.from('period_free_staff').delete().eq('id', id);
      if (error) throw error;
      const { data } = await supabase.from('period_free_staff').select('*, staff(*)');
      if (data) {
        setFreeStaffData(data);
        setFreeStaff(data);
      }
    } catch (err: any) {
      alert('Failed to delete reserve: ' + err.message);
    }
  };
  const [selectedGlobalWeek, setSelectedGlobalWeek] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [metrics, setMetrics] = useState({
    totalExams: 0,
    totalAssignments: 0,
    assignedReserves: 0,
    freeReserves: 0,
    coverage: 0,
    chartData: [] as any[]
  });

  const supabase = createClientComponentClient();
  const router = useRouter();



  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        if (session?.user?.email) {
          setUserEmail(session.user.email);
        }

        let staffId = null;
        if (session?.user?.user_metadata?.staff_id) {
          setCurrentUserData(session.user.user_metadata);
          staffId = session.user.user_metadata.staff_id;
          setOriginalStaffId(staffId);
        }

        // Fetch common lists
        const [staffRes, roomRes] = await Promise.all([
          supabase.from('staff').select('*').order('name'),
          supabase.from('rooms').select('*').eq('is_active', true).order('room_name')
        ]);

        if (staffRes.error) throw staffRes.error;
        if (roomRes.error) throw roomRes.error;

        setStaffList(staffRes.data || []);
        setRoomList(roomRes.data || []);

        // Fetch specific data if a personalized account
        const fetchAll = async (queryBuilder: any) => {
          let allData: any[] = [];
          let from = 0;
          const step = 1000;
          let hasMore = true;
          while (hasMore) {
            const { data, error } = await queryBuilder.range(from, from + step - 1);
            if (error) throw error;
            if (data && data.length > 0) {
              allData = [...allData, ...data];
              from += step;
              if (data.length < step) hasMore = false;
            } else {
              hasMore = false;
            }
          }
          return { data: allData, error: null };
        };

        if (staffId) {
          const [specificStaffRes, examsRes, assignmentsRes, freeStaffRes] = await Promise.all([
            supabase.from('staff').select('*').eq('id', staffId).single(),
            fetchAll(supabase.from('exam_sessions').select('*, room:rooms(*), assignments(*, staff:staff(*))').order('exam_date')),
            fetchAll(supabase.from('assignments').select('*, staff:staff(*), exam_session:exam_sessions(*, room:rooms(*))').eq('staff_id', staffId)),
            fetchAll(supabase.from('period_free_staff').select('*, staff:staff(*)').eq('staff_id', staffId).order('exam_date').order('period'))
          ]);

          if (!specificStaffRes.error) setStaffMember(specificStaffRes.data);
          if (!examsRes.error) setExams(examsRes.data || []);
          if (!assignmentsRes.error) setAssignments(assignmentsRes.data || []);
          if (!freeStaffRes.error) setFreeStaff(freeStaffRes.data || []);
        } else {
          // Generic staff: fetch all data needed for reports and swaps
          const [examsRes, assignmentsRes, freeStaffRes, swapsRes] = await Promise.all([
            fetchAll(supabase.from('exam_sessions').select('*, room:rooms(*)')),
            fetchAll(supabase.from('assignments').select('*, staff:staff(*), exam_session:exam_sessions(*, room:rooms(*))')),
            fetchAll(supabase.from('period_free_staff').select('*, staff:staff(*)').order('exam_date').order('period')),
            supabase.from('swap_requests').select('*, room:rooms(*), original_staff:staff!original_staff_id(*), replacement_staff:staff!replacement_staff_id(*)').order('created_at', { ascending: false })
          ]);
          if (!examsRes.error) setExams(examsRes.data || []);
          if (!assignmentsRes.error) setAssignments(assignmentsRes.data || []);
          if (!freeStaffRes.error) setFreeStaff(freeStaffRes.data || []);
          if (!swapsRes.error) setSwaps(swapsRes.data as any || []);
        }
      } catch (err: any) {
        setSwapError('Failed to load initial data: ' + err.message);
        setScheduleError('Failed to load initial data: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [supabase, router]);

  // Fetch dynamic data when date/period change (for swap form)
  useEffect(() => {
    if (!examDate || !period) {
      setSessionsData([]);
      setFreeStaffData([]);
      return;
    }

    const fetchDynamic = async () => {
      const p = parseInt(period);
      const [sessionsRes, freeRes] = await Promise.all([
        supabase
          .from('exam_sessions')
          .select(`id, start_time, room_id, room:rooms(id, room_name, building_code), assignments(staff_id, staff:staff(*))`)
          .eq('exam_date', examDate),
        supabase
          .from('period_free_staff')
          .select(`staff_id, staff:staff(*)`)
          .eq('exam_date', examDate)
          .eq('period', p)
      ]);

      let filteredSessions = (sessionsRes.data || []).filter(s => getPeriodFromTime(s.start_time) === p);
      
      if (currentUserData?.staff_id) {
        filteredSessions = filteredSessions.filter(s => 
          s.assignments && s.assignments.some((a: any) => a.staff_id === currentUserData.staff_id)
        );
      }
      
      setSessionsData(filteredSessions);
      setFreeStaffData(freeRes.data || []);
      
      setRoomId('');
      if (!currentUserData) {
        setOriginalStaffId('');
      }
    };

    fetchDynamic();
  }, [examDate, period, supabase, currentUserData]);

  // Schedule Logic
  const getWeekStart = (dateStr: string) => {
    const d = new Date(`${dateStr}T12:00:00Z`);
    const day = d.getUTCDay();
    const offset = day === 6 ? 0 : -(day + 1);
    const start = new Date(d.setUTCDate(d.getUTCDate() + offset));
    return start.toISOString().split('T')[0];
  };

  const availableWeeks = Array.from(new Set(exams.map(e => getWeekStart(e.exam_date)))).sort();
  
  const getUpcomingOrCurrentWeek = () => {
    if (availableWeeks.length === 0) return 'all';
    const today = new Date();
    const cairoTime = new Date(today.toLocaleString("en-US", {timeZone: "Africa/Cairo"}));
    const todayIso = cairoTime.toISOString().split('T')[0];
    
    for (const weekStart of availableWeeks) {
       const weekStartDate = new Date(`${weekStart}T12:00:00Z`);
       const weekEndDate = new Date(weekStartDate);
       weekEndDate.setDate(weekEndDate.getDate() + 6);
       const weekEndIso = weekEndDate.toISOString().split('T')[0];
       if (todayIso <= weekEndIso) {
         return weekStart;
       }
    }
    return availableWeeks[availableWeeks.length - 1];
  };

  const currentWeek = getUpcomingOrCurrentWeek();

  useEffect(() => {
    // Calculate Metrics for the currently selected week context
    if (exams.length === 0) return;

    const targetWeek = selectedGlobalWeek || currentWeek;
    if (!targetWeek || targetWeek === 'all') return;

    const getWeekStart = (dateStr: string) => {
      const d = new Date(`${dateStr}T12:00:00Z`);
      const day = d.getUTCDay();
      const offset = day === 6 ? 0 : -(day + 1);
      const start = new Date(d.setUTCDate(d.getUTCDate() + offset));
      return start.toISOString().split('T')[0];
    };

    const currentWeekExams = exams.filter(e => getWeekStart(e.exam_date) === targetWeek);
    const currentWeekAssignments = assignments.filter(a => a.exam_session && getWeekStart(a.exam_session.exam_date) === targetWeek);
    const currentWeekFreeStaff = freeStaff.filter(fs => getWeekStart(fs.exam_date) === targetWeek);

    const expectedStaffRequired = currentWeekExams.length * 3;
    let coverageRatio = 0;
    if (expectedStaffRequired > 0) {
      coverageRatio = Math.min(100, Math.round((currentWeekAssignments.length / expectedStaffRequired) * 100));
    } else if (currentWeekExams.length === 0 && exams.length > 0) {
      coverageRatio = 100;
    }

    const assignedReservesCount = assignments.filter(a => (a.role === 'Assistant' || a.role === 'Invigilator') && a.is_manual_override).length;

    const dailyCounts = new Map<string, number>();
    const daysOrder = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];
    currentWeekExams.forEach(session => {
      const day = new Date(`${session.exam_date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
      dailyCounts.set(day, (dailyCounts.get(day) || 0) + 1);
    });
    
    const chartData = daysOrder.map(day => ({
      name: day,
      exams: dailyCounts.get(day) || 0
    }));

    setMetrics({
      totalExams: currentWeekExams.length,
      totalAssignments: currentWeekAssignments.length,
      assignedReserves: assignedReservesCount,
      freeReserves: currentWeekFreeStaff.length,
      coverage: coverageRatio,
      chartData: chartData
    });
    
    // Auto-select a date in that week if none selected
    if (!selectedDate || getWeekStart(selectedDate) !== targetWeek) {
        if (currentWeekExams.length > 0) {
            setSelectedDate(currentWeekExams[0].exam_date);
        } else {
            setSelectedDate(targetWeek);
        }
    }
  }, [exams, assignments, freeStaff, selectedGlobalWeek, currentWeek, selectedDate]);

  let weekStartDate = '';
  let weekEndDate = '';
  if (currentWeek !== 'all') {
    weekStartDate = currentWeek;
    const d = new Date(`${currentWeek}T12:00:00Z`);
    d.setDate(d.getDate() + 6);
    weekEndDate = d.toISOString().split('T')[0];
  }

  const handleSwapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examDate || !period || !roomId || !originalStaffId || !replacementStaffId) {
      setSwapError('Please fill out all fields.');
      return;
    }
    if (originalStaffId === replacementStaffId) {
      setSwapError('Currently assigned staff and replacement staff cannot be the same person.');
      return;
    }
    
    if (weekStartDate && weekEndDate) {
      if (examDate < weekStartDate || examDate > weekEndDate) {
        if (userEmail?.toLowerCase() !== 'staff@horus.edu.eg') {
          setSwapError(`You can only swap assignments within the current active week (${weekStartDate} to ${weekEndDate}).`);
          return;
        }
      }
    }

    setSubmittingSwap(true);
    setSwapError(null);

    try {
      const { error } = await supabase.from('swap_requests').insert({
        exam_date: examDate,
        period: parseInt(period),
        room_id: roomId,
        original_staff_id: originalStaffId,
        replacement_staff_id: replacementStaffId,
        status: 'pending'
      });

      if (error) throw error;
      setSwapSuccess(true);
      
      setExamDate('');
      setPeriod('1');
      setRoomId('');
      if (!currentUserData) setOriginalStaffId('');
      setReplacementStaffId('');
    } catch (err: any) {
      setSwapError('Failed to submit swap request: ' + err.message);
    } finally {
      setSubmittingSwap(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      await fetch('/api/auth/signout', { method: 'POST' });
      document.cookie.split(";").forEach((c) => { document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); });
    } catch(e) {
      console.error(e);
    }
    window.location.href = '/login?clear=1';
  };

  // Schedule Logic moved above

  const filteredAssignments = currentWeek === 'all' 
    ? assignments 
    : assignments.filter(a => a.exam_session && getWeekStart(a.exam_session.exam_date) === currentWeek);

  const filteredFreeStaff = currentWeek === 'all'
    ? freeStaff
    : freeStaff.filter(fs => getWeekStart(fs.exam_date) === currentWeek);

  const mergedAssignments = [
    ...filteredAssignments,
    ...filteredFreeStaff.map(mapFreeStaffToAssignment)
  ];

  const handleMySchedule = (mode: 'pdf' | 'excel') => {
    if (!staffMember) return;
    setGeneratingSchedule('schedule');
    try {
      const weekLabel = getWeekRangeLabel(currentWeek, mergedAssignments);
      const cleanWeekLabel = weekLabel.replace(/[\/\\:\*\?"<>\|]/g, '').replace(/\s+/g, '_');
      
      if (mode === 'excel') {
        const blob = generateStaffScheduleExcel(staffMember, mergedAssignments, weekLabel);
        downloadFile(blob, `my_schedule_${staffMember.name.replace(/[\/\\:\*\?"<>\|]/g, '').replace(/\s+/g, '_')}_${cleanWeekLabel}.xlsx`);
      } else {
        const html = generateStaffScheduleHTML(staffMember, mergedAssignments, weekLabel);
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
        }
      }
    } catch (err: any) {
      setScheduleError('Failed to generate schedule: ' + err.message);
    } finally {
      setGeneratingSchedule(null);
    }
  };

  const handleGlobalSchedule = async (reportType: string, format: 'pdf' | 'excel') => {
    setGeneratingSchedule(`global-${reportType}-${format}`);
    try {
      const targetWeek = selectedGlobalWeek || currentWeek;
      
      let weekLabel = targetWeek === 'all' ? 'All Weeks' : `Week of ${targetWeek}`;

      const getWeekStart = (dateStr: string) => {
        const dx = new Date(`${dateStr}T12:00:00Z`);
        const dday = dx.getUTCDay();
        const doffset = dday === 6 ? 0 : -(dday + 1);
        return new Date(dx.setUTCDate(dx.getUTCDate() + doffset)).toISOString().split('T')[0];
      };

      if (reportType === 'daily') {
        const dailyExams = exams.filter(e => e.exam_date === selectedDate);
        if (dailyExams.length === 0) {
          alert('No exams found for the selected date.');
          setGeneratingSchedule(null);
          return;
        }
        if (format === 'excel') {
          const blob = generateDailyHallExcel(dailyExams, selectedDate);
          downloadFile(blob, `daily_hall_report_${selectedDate}.xlsx`);
        } else {
          const html = generateDailyHallHTML(dailyExams, selectedDate);
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
          }
        }
      }
      else if (reportType === 'weekly') {
        const weekExams = exams.filter(e => targetWeek === 'all' ? true : getWeekStart(e.exam_date) === targetWeek);
        if (format === 'excel') {
          const blob = generateWeeklyHallExcel(weekExams, weekLabel);
          downloadFile(blob, `weekly_hall_report_${targetWeek}.xlsx`);
        } else {
          const html = generateWeeklyHallHTML(weekExams, weekLabel);
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
          }
        }
      }
      else if (reportType === 'all-staff') {
        const merged = assignments.map(a => {
            const session = exams.find(e => e.id === a.exam_session_id);
            return {
                ...a,
                exam_session: session ? {
                    ...session,
                    room: roomList.find(r => r.id === session.room_id)
                } : undefined
            };
        });
        const weekAssignments = targetWeek === 'all' ? merged : merged.filter(a => a.exam_session && getWeekStart(a.exam_session.exam_date) === targetWeek);

        if (format === 'excel') {
          const blob = generateWorkloadExcel(staffList, weekAssignments);
          downloadFile(blob, `all_staff_workload_${targetWeek}.xlsx`);
        } else {
          const html = generateAllStaffSchedulesHTML(staffList, weekAssignments, weekLabel);
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
          }
        }
      }
      else if (reportType === 'oral-exams') {
        const weekExams = exams.filter(e => targetWeek === 'all' ? true : getWeekStart(e.exam_date) === targetWeek);
        if (format === 'excel') {
          const blob = generateOralExamsExcel(weekExams, weekLabel);
          downloadFile(blob, `oral_exams_report_${targetWeek}.xlsx`);
        } else {
          const html = generateOralExamsHTML(weekExams, weekLabel);
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
          }
        }
      }
      else if (reportType === 'assigned-reserve') {
        const dailyFreeStaff = freeStaff.filter(fs => fs.exam_date === selectedDate);
        if (dailyFreeStaff.length === 0) {
            alert('No reserves found for the selected date.');
            setGeneratingSchedule(null);
            return;
        }

        if (format === 'excel') {
          const blob = generateAssignedReservesExcel(dailyFreeStaff, `Deployment on ${selectedDate}`);
          downloadFile(blob, `assigned_reserves_${selectedDate}.xlsx`);
        } else {
          const html = generateAssignedReservesHTML(dailyFreeStaff, `Deployment on ${selectedDate}`);
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
          }
        }
      }
      else if (reportType === 'free-reserve') {
        const dailyExams = exams.filter(e => e.exam_date === selectedDate);
        
        const mergedDailyAssignments = assignments.map(a => {
            const session = exams.find(e => e.id === a.exam_session_id);
            return {
                ...a,
                exam_session: session ? {
                    ...session,
                    room: roomList.find(r => r.id === session.room_id)
                } : undefined
            };
        });
        const dailyAssignments = mergedDailyAssignments.filter(a => a.exam_session && a.exam_session.exam_date === selectedDate);

        if (format === 'excel') {
          const blob = generateFreeInvigilatorsExcel(staffList, dailyExams, dailyAssignments);
          downloadFile(blob, `free_reserves_${selectedDate}.xlsx`);
        } else {
          const html = generateFreeInvigilatorsHTML(staffList, dailyExams, dailyAssignments);
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
          }
        }
      }
    } catch (err: any) {
      alert('Error generating schedule: ' + err.message);
    } finally {
      setGeneratingSchedule(null);
    }
  };

  const ReportCard = ({ title, description, type, icon: Icon }: any) => (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-lg transition-all group flex flex-col justify-between">
      <div>
        <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 text-indigo-600 group-hover:scale-110 transition-transform">
          <Icon className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">{title}</h3>
        <p className="text-slate-500 text-sm mb-6">{description}</p>
      </div>
      <div className="flex gap-3">
        <button 
          onClick={() => handleGlobalSchedule(type, 'pdf')}
          disabled={!!generatingSchedule}
          className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors flex justify-center items-center gap-2 border border-slate-200"
        >
          {generatingSchedule === `global-${type}-pdf` ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          Print PDF
        </button>
        <button 
          onClick={() => handleGlobalSchedule(type, 'excel')}
          disabled={!!generatingSchedule}
          className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors flex justify-center items-center gap-2 border border-indigo-200"
        >
          {generatingSchedule === `global-${type}-excel` ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
          Excel
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-950 to-slate-900 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-500/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="absolute top-6 right-6 flex items-center gap-3 z-30">
        <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-medium text-slate-200 hover:text-white bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg transition-all hover:bg-white/20 hover:scale-105">
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>

      {/* Centered Pill Toggle */}
      <div className={`relative z-30 mb-8 bg-white/10 backdrop-blur-xl p-1.5 rounded-full border border-white/20 shadow-xl flex items-center max-w-full ${!currentUserData ? 'w-[800px]' : 'w-80'}`}>
        {/* Sliding active background indicator */}
        <div 
          className="absolute top-1.5 bottom-1.5 bg-gradient-to-r from-primary-600 to-indigo-600 rounded-full shadow-lg transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          style={{ 
            width: !currentUserData ? 'calc(25% - 3px)' : 'calc(50% - 6px)',
            transform: activeTab === 'swap' ? 'translateX(0)' : 
                       (activeTab === 'schedule' || activeTab === 'all_schedules') ? (!currentUserData ? 'translateX(calc(100% + 4px))' : 'translateX(calc(100% + 12px))') : 
                       activeTab === 'swap_log' ? 'translateX(calc(200% + 8px))' :
                       activeTab === 'reserves' ? 'translateX(calc(300% + 12px))' :
                       'translateX(calc(200% + 12px))'
          }}
        />
        
        <button
          onClick={() => setActiveTab('swap')}
          className={`flex-1 relative z-10 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-bold rounded-full transition-colors duration-300 ${activeTab === 'swap' ? 'text-white' : 'text-slate-300 hover:text-white'}`}
        >
          <RefreshCw className="w-4 h-4" />
          Swap Shift
        </button>
        
        {!currentUserData ? (
          <>
            <button
              onClick={() => setActiveTab('all_schedules')}
              className={`flex-1 relative z-10 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-bold rounded-full transition-colors duration-300 ${activeTab === 'all_schedules' ? 'text-white' : 'text-slate-300 hover:text-white'}`}
            >
              <BarChart3 className="w-4 h-4" />
              Admin Reports
            </button>
            <button
              onClick={() => setActiveTab('swap_log')}
              className={`flex-1 relative z-10 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-bold rounded-full transition-colors duration-300 ${activeTab === 'swap_log' ? 'text-white' : 'text-slate-300 hover:text-white'}`}
            >
              <FileText className="w-4 h-4" />
              Swap Log
            </button>
            <button
              onClick={() => setActiveTab('reserves')}
              className={`flex-1 relative z-10 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-bold rounded-full transition-colors duration-300 ${activeTab === 'reserves' ? 'text-white' : 'text-slate-300 hover:text-white'}`}
            >
              <ShieldCheck className="w-4 h-4" />
              Manage Reserves
            </button>
          </>
        ) : (
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 relative z-10 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-bold rounded-full transition-colors duration-300 ${activeTab === 'schedule' ? 'text-white' : 'text-slate-300 hover:text-white'}`}
          >
            <Calendar className="w-4 h-4" />
            My Schedule
          </button>
        )}
      </div>

      {/* Sliding Viewport Container */}
      <div className={`w-full relative z-20 overflow-hidden rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] border border-white/20 ${!currentUserData ? 'max-w-5xl' : 'max-w-lg'}`}>
        <div 
          className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ 
            width: !currentUserData ? '400%' : '200%',
            transform: activeTab === 'swap' ? 'translateX(0)' : 
                       activeTab === 'all_schedules' ? 'translateX(-25%)' :
                       activeTab === 'swap_log' ? 'translateX(-50%)' :
                       activeTab === 'reserves' ? 'translateX(-75%)' :
                       'translateX(-50%)' 
          }}
        >
          {/* ----- SWAP PANE ----- */}
          <div className={`${!currentUserData ? 'w-1/4' : 'w-1/2'} flex-shrink-0 bg-white/95 backdrop-blur-xl h-full flex flex-col`}>
            <div className="bg-gradient-to-r from-primary-900 to-indigo-900 p-8 flex flex-col items-center text-center relative overflow-hidden flex-shrink-0">
              <div className="absolute top-0 left-0 w-full h-full bg-[url('/images/pattern.svg')] opacity-10"></div>
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-24 h-12 relative mb-4">
                  <Image src="/images/logo-session-master-transparent.png" alt="Logo" fill className="object-contain" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Shift Swap Request</h1>
                <p className="text-primary-100 text-sm">Propose a replacement for your scheduled shift</p>
              </div>
            </div>

            <div className="p-6 sm:p-8 flex-1">
              {swapSuccess ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3 h-full justify-center flex-col text-center">
                  <div className="flex justify-center w-full mb-3"><CheckCircle2 className="w-12 h-12 text-green-600" /></div>
                  <h3 className="text-lg font-semibold text-green-800 w-full">Request Submitted Successfully</h3>
                  <p className="text-sm text-green-700 mt-2">
                    Your swap request has been sent to the administrator for approval. You will be notified once it is reviewed.
                  </p>
                  <button onClick={() => setSwapSuccess(false)} className="text-sm text-green-800 font-medium underline mt-6 hover:text-green-900 w-full">
                    Submit another request
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSwapSubmit} className="space-y-5">
                  {swapError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 font-medium">
                      {swapError}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="date"
                          value={examDate}
                          onChange={(e) => setExamDate(e.target.value)}
                          min={userEmail?.toLowerCase() === 'staff@horus.edu.eg' ? undefined : (weekStartDate || undefined)}
                          max={userEmail?.toLowerCase() === 'staff@horus.edu.eg' ? undefined : (weekEndDate || undefined)}
                          className="block w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 bg-white"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Period</label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select
                          value={period}
                          onChange={(e) => setPeriod(e.target.value)}
                          className="block w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 bg-white"
                          required
                        >
                          <option value="1">Period 1 (09:00 - 11:00)</option>
                          <option value="2">Period 2 (13:00 - 15:00)</option>
                          <option value="3">Period 3 (15:45 - 17:45)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Exam Room</label>
                    <div className="relative">
                      <DoorOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select
                        value={roomId}
                        onChange={(e) => { 
                          setRoomId(e.target.value); 
                          if (!currentUserData) setOriginalStaffId(''); 
                        }}
                        className="block w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 bg-white"
                        required
                      >
                        <option value="" disabled>Select a room...</option>
                        {Array.from(new Map(
                          sessionsData.filter(s => s.room).map(s => [s.room_id, s.room])
                        ).values())
                        .sort((a: any, b: any) => a.room_name.localeCompare(b.room_name))
                        .map((r: any) => (
                          <option key={r.id} value={r.id}>{r.room_name} (Bld: {r.building_code || '?'})</option>
                        ))}
                      </select>
                    </div>
                    {examDate && period && sessionsData.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">No exam rooms found for this date and period.</p>
                    )}
                  </div>

                  {!currentUserData && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Currently Assigned Staff (or Reserve)</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select
                          value={originalStaffId}
                          onChange={(e) => setOriginalStaffId(e.target.value)}
                          className="block w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 bg-white"
                          required
                          disabled={!roomId}
                        >
                          <option value="" disabled>{roomId ? "Select staff member..." : "Select room first"}</option>
                          {(() => {
                            const roomSessions = sessionsData.filter(s => s.room_id === roomId);
                            const assignedStaff = roomSessions.flatMap(s => (s.assignments || []).map((a: any) => a.staff));
                            const reserveStaff = freeStaffData.map(f => f.staff);
                            const eligibleOriginalStaff = [...assignedStaff, ...reserveStaff].filter(Boolean);
                            
                            return Array.from(new Map(eligibleOriginalStaff.map(s => [s.id, s])).values())
                              .sort((a: any, b: any) => a.name.localeCompare(b.name))
                              .map((s: any) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ));
                          })()}
                        </select>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Proposed Replacement Staff</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select
                        value={replacementStaffId}
                        onChange={(e) => setReplacementStaffId(e.target.value)}
                        className="block w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 bg-white"
                        required
                      >
                        <option value="" disabled>Select replacement staff...</option>
                        {staffList
                          .filter(s => !staffMember || s.supervision_role === staffMember.supervision_role)
                          .map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingSwap}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-primary-900/20 transition-all hover:shadow-primary-900/40 hover:-translate-y-0.5 disabled:opacity-70 disabled:pointer-events-none mt-2"
                  >
                    {submittingSwap ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Submitting Request...</>
                    ) : (
                      <><RefreshCw className="w-5 h-5" /> Submit Swap Request</>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>

          {currentUserData ? (
            <div className="w-1/2 flex-shrink-0 bg-white/95 backdrop-blur-xl h-full flex flex-col">
              {/* ----- SCHEDULE PANE (INDIVIDUAL) ----- */}
              <div className="bg-gradient-to-r from-primary-900 to-indigo-900 p-8 flex flex-col items-center text-center relative overflow-hidden flex-shrink-0">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('/images/pattern.svg')] opacity-10"></div>
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-24 h-12 relative mb-4">
                    <Image src="/images/logo-session-master-transparent.png" alt="Logo" fill className="object-contain" />
                  </div>
                  <h1 className="text-2xl font-bold text-white mb-2">My Schedule Reports</h1>
                  <p className="text-primary-100 text-sm max-w-sm">View and download your personal supervision schedule</p>
                </div>
              </div>

              <div className="p-8 flex-1 flex flex-col">
                {scheduleError && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">
                    {scheduleError}
                  </div>
                )}
                
                <div className="flex-1 flex flex-col justify-center">
                  {staffMember?.job_title === 'Lecturer' && (
                    <AiQueryBox 
                      weekStart={currentWeek !== 'all' ? new Date(`${currentWeek}T12:00:00Z`) : undefined}
                      externalExamSessions={exams}
                      externalStaff={staffList}
                    />
                  )}
                  <div className="card p-7 border border-gray-200 rounded-[1.5rem] bg-white shadow-sm transition-shadow">
                    <div className="flex items-center mb-5">
                      <div className="bg-primary-50 p-3 rounded-2xl">
                        <Calendar className="w-7 h-7 text-primary-600" />
                      </div>
                      <h3 className="text-xl font-bold ml-4 text-slate-900">My Schedule</h3>
                    </div>
                    <p className="text-gray-600 mb-8 text-sm leading-relaxed">
                      Generate your personal schedule for the current active exam week <br/>
                      <strong className="text-primary-700 mt-2 inline-block">({currentWeek !== 'all' ? `Week of ${new Date(currentWeek).toLocaleDateString()}` : 'All Weeks'})</strong>.
                    </p>
                    <div className="space-y-4">
                      <button 
                        onClick={() => handleMySchedule('pdf')} 
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold py-4 px-4 rounded-xl shadow-lg shadow-primary-900/20 transition-all hover:shadow-primary-900/40 hover:-translate-y-0.5 disabled:opacity-70 disabled:pointer-events-none"
                        disabled={generatingSchedule === 'schedule'}
                      >
                        {generatingSchedule === 'schedule' ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <FileText className="w-5 h-5 mr-2" />}
                        Print Preview (PDF)
                      </button>
                      <button 
                        onClick={() => handleMySchedule('excel')} 
                        className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold py-4 px-4 rounded-xl shadow-sm transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:pointer-events-none"
                        disabled={generatingSchedule === 'schedule'}
                      >
                        <Download className="w-5 h-5 mr-2" />
                        Export to Excel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* ----- ALL SCHEDULES PANE (GENERIC) ----- */}
              <div className="w-1/4 flex-shrink-0 bg-white/95 backdrop-blur-xl h-full flex flex-col">
                <div className="bg-gradient-to-r from-primary-900 to-indigo-900 p-8 flex flex-col items-center text-center relative overflow-hidden flex-shrink-0">
                  <div className="absolute top-0 left-0 w-full h-full bg-[url('/images/pattern.svg')] opacity-10"></div>
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-24 h-12 relative mb-4">
                      <Image src="/images/logo-session-master-transparent.png" alt="Logo" fill className="object-contain" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Admin Reports Portal</h1>
                    <p className="text-primary-100 text-sm max-w-sm">View and download schedules and reports</p>
                  </div>
                </div>

                <div className="p-8 flex-1 flex flex-col overflow-y-auto">
                  <div className="mb-6">
                    <AiQueryBox 
                      weekStart={(selectedGlobalWeek && selectedGlobalWeek !== 'all') ? new Date(`${selectedGlobalWeek}T12:00:00Z`) : undefined}
                      externalExamSessions={exams}
                      externalStaff={staffList}
                    />
                  </div>
                  <div className="flex-1 space-y-8">
                    {/* Week Selector */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                      <div className="flex items-center gap-2 mb-4">
                        <Calendar className="w-5 h-5 text-indigo-600" />
                        <h2 className="text-xl font-bold text-slate-900">Select Exam Context</h2>
                      </div>
                      <select
                        value={selectedGlobalWeek || currentWeek}
                        onChange={e => setSelectedGlobalWeek(e.target.value)}
                        className="block w-full pl-3 pr-10 py-3 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-xl bg-slate-50"
                      >
                        <option value="all">All Available Weeks</option>
                        {availableWeeks.map(w => (
                          <option key={w} value={w}>Week of {new Date(w).toLocaleDateString()}</option>
                        ))}
                      </select>
                    </div>

                    {/* Analysis Section */}
                    {(selectedGlobalWeek || currentWeek) !== 'all' && (
                      <section>
                        <div className="flex items-center gap-2 mb-4">
                          <BarChart3 className="w-5 h-5 text-indigo-600" />
                          <h2 className="text-xl font-bold text-slate-900">Current Week Analysis</h2>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                          {/* KPI Cards */}
                          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><FileText className="w-6 h-6" /></div>
                              <div>
                                <p className="text-sm font-medium text-slate-500">Exams</p>
                                <p className="text-2xl font-bold text-slate-900">{metrics.totalExams}</p>
                              </div>
                            </div>
                            
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><CheckCircle2 className="w-6 h-6" /></div>
                              <div>
                                <p className="text-sm font-medium text-slate-500">Assignments</p>
                                <p className="text-2xl font-bold text-slate-900">{metrics.totalAssignments}</p>
                              </div>
                            </div>

                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><ShieldCheck className="w-6 h-6" /></div>
                              <div>
                                <p className="text-sm font-medium text-slate-500">Free Reserves</p>
                                <p className="text-2xl font-bold text-slate-900">{metrics.freeReserves}</p>
                              </div>
                            </div>

                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><AlertCircle className="w-6 h-6" /></div>
                              <div>
                                <p className="text-sm font-medium text-slate-500">Coverage</p>
                                <p className="text-2xl font-bold text-slate-900">{metrics.coverage}%</p>
                              </div>
                            </div>
                          </div>

                          {/* Weekly Volume Chart */}
                          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col">
                            <div className="flex items-center gap-2 mb-2">
                              <BarChart3 className="w-4 h-4 text-indigo-500" />
                              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Exam Volume</p>
                            </div>
                            <div className="flex-1 min-h-[120px] -ml-4">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={metrics.chartData}>
                                  <defs>
                                    <linearGradient id="colorExams" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                    </linearGradient>
                                  </defs>
                                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
                                  <Area type="monotone" dataKey="exams" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorExams)">
                                    <LabelList dataKey="exams" position="top" fill="#4f46e5" fontSize={11} fontWeight="bold" />
                                  </Area>
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>
                      </section>
                    )}

                    <hr className="border-slate-200" />

                    {/* Reports Grid */}
                    <section className="space-y-8 pb-8">
                      <div className="flex items-center gap-2">
                        <Download className="w-5 h-5 text-indigo-600" />
                        <h2 className="text-xl font-bold text-slate-900">Generate Reports</h2>
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 border-b pb-2">Weekly Reports ({selectedGlobalWeek === 'all' ? 'All Weeks Context' : 'Selected Week Context'})</h3>
                        <div className="grid grid-cols-1 gap-6">
                          <ReportCard 
                            type="all-staff" 
                            title="All Staff Schedule" 
                            description="Master list detailing every staff member's individual assignments and workload."
                            icon={Users} 
                          />
                          <ReportCard 
                            type="weekly" 
                            title="Weekly Hall Report" 
                            description="Comprehensive weekly overview of all hall assignments."
                            icon={FileSpreadsheet} 
                          />
                          <ReportCard 
                            type="oral-exams" 
                            title="Oral Exams Report" 
                            description="Dedicated report for all Oral Exams scheduled."
                            icon={Users} 
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex flex-col mb-4 border-b pb-2 gap-4">
                          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Daily Reports</h3>
                          {(selectedGlobalWeek || currentWeek) !== 'all' && (
                            <div className="flex items-center gap-3">
                              <label className="text-sm font-medium text-slate-600">Select Day within Week:</label>
                              <input 
                                type="date" 
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                                className="text-sm border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white py-1.5"
                              />
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-6">
                          <ReportCard 
                            type="daily" 
                            title="Daily Hall Report" 
                            description="Full schedule matrix showing all exam halls, times, and assigned staff for the selected date."
                            icon={FileText} 
                          />
                          <ReportCard 
                            type="assigned-reserve" 
                            title="Assigned Reserve" 
                            description="List of reserve staff who were officially deployed to cover an exam hall."
                            icon={CheckCircle2} 
                          />
                          <ReportCard 
                            type="free-reserve" 
                            title="Free Reserve" 
                            description="List of standby staff who are currently unassigned and available for emergencies."
                            icon={ShieldCheck} 
                          />
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              </div>

              {/* ----- SWAP LOG PANE (GENERIC) ----- */}
              <div className="w-1/4 flex-shrink-0 bg-white/95 backdrop-blur-xl h-full flex flex-col">
                <div className="bg-gradient-to-r from-primary-900 to-indigo-900 p-8 flex flex-col items-center text-center relative overflow-hidden flex-shrink-0">
                  <div className="absolute top-0 left-0 w-full h-full bg-[url('/images/pattern.svg')] opacity-10"></div>
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-24 h-12 relative mb-4">
                      <Image src="/images/logo-session-master-transparent.png" alt="Logo" fill className="object-contain" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Swap Requests Log</h1>
                    <p className="text-primary-100 text-sm max-w-sm">Read-only view of all shift swap requests</p>
                  </div>
                </div>

                <div className="p-8 flex-1 flex flex-col overflow-y-auto bg-slate-50">
                  {swaps.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 bg-white rounded-2xl border border-slate-200">No swap requests found.</div>
                  ) : (
                    <div className="space-y-4">
                      {swaps.map(req => (
                        <div key={req.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-2">
                              <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-3 py-1 rounded-full">
                                {req.exam_date} • Period {req.period}
                              </span>
                              <span className="text-sm font-medium text-slate-500 flex items-center gap-1">
                                <DoorOpen className="w-3.5 h-3.5" />
                                {req.room?.room_name}
                              </span>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                              req.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              req.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                              'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <div className="flex-1">
                              <p className="text-xs text-slate-500 font-medium mb-1">Original Staff</p>
                              <p className="text-sm font-bold text-slate-900">{req.original_staff?.name}</p>
                            </div>
                            <div className="flex flex-col items-center px-4 text-slate-400">
                              <RefreshCw className="w-5 h-5 mb-1" />
                            </div>
                            <div className="flex-1 text-right">
                              <p className="text-xs text-slate-500 font-medium mb-1">Replacement Staff</p>
                              <p className="text-sm font-bold text-indigo-700">{req.replacement_staff?.name}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ----- RESERVES PANE (GENERIC) ----- */}
              <div className="w-1/4 flex-shrink-0 bg-white/95 backdrop-blur-xl h-full flex flex-col">
                <div className="bg-gradient-to-r from-primary-900 to-indigo-900 p-8 flex flex-col items-center text-center relative overflow-hidden flex-shrink-0">
                  <div className="absolute top-0 left-0 w-full h-full bg-[url('/images/pattern.svg')] opacity-10"></div>
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-24 h-12 relative mb-4">
                      <Image src="/images/logo-session-master-transparent.png" alt="Logo" fill className="object-contain" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Manage Reserves</h1>
                    <p className="text-primary-100 text-sm max-w-sm">Add or delete reserve staff assignments for specific days</p>
                  </div>
                </div>

                <div className="p-8 flex-1 flex flex-col overflow-y-auto bg-slate-50 space-y-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <h2 className="text-xl font-bold text-slate-900 mb-4">Add Reserve</h2>
                    {reserveMessage && (
                      <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${reserveMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {reserveMessage.text}
                      </div>
                    )}
                    <form onSubmit={handleAddReserve} className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                        <input type="date" required value={reserveDate} onChange={e => setReserveDate(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-xl text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
                        <select value={reservePeriod} onChange={e => setReservePeriod(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-xl text-sm">
                          <option value="1">Period 1</option>
                          <option value="2">Period 2</option>
                          <option value="3">Period 3</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Staff Member</label>
                        <select required value={reserveStaffId} onChange={e => setReserveStaffId(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-xl text-sm">
                          <option value="" disabled>Select Staff...</option>
                          {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <select value={reserveRole} onChange={e => setReserveRole(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-xl text-sm">
                          <option value="Assistant">Invigilator Reserve</option>
                          <option value="Exam_Supervisor">Exam Supervisor Reserve</option>
                        </select>
                      </div>
                      <div className="col-span-2 mt-2">
                        <button type="submit" disabled={addingReserve} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition-colors shadow-sm">
                          {addingReserve ? 'Adding...' : 'Add Reserve'}
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <h2 className="text-xl font-bold text-slate-900 mb-4">Current Reserves for {reserveDate || 'Selected Date'}</h2>
                    {!reserveDate ? (
                      <p className="text-gray-500 text-sm bg-slate-100 p-4 rounded-xl text-center italic">Please select a date above to view reserves.</p>
                    ) : (
                      <div className="space-y-3">
                        {freeStaffData.filter(fs => fs.exam_date === reserveDate).length === 0 ? (
                          <p className="text-gray-500 text-sm italic bg-slate-100 p-4 rounded-xl text-center">No reserves found for this date.</p>
                        ) : (
                          freeStaffData.filter(fs => fs.exam_date === reserveDate).sort((a,b) => a.period - b.period).map(fs => (
                            <div key={fs.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-indigo-200 transition-colors">
                              <div>
                                <p className="font-bold text-slate-800 text-sm">{fs.staff?.name}</p>
                                <p className="text-xs text-slate-500 font-medium">Period {fs.period} • {fs.role === 'Exam_Supervisor' ? 'Exam Supervisor' : 'Invigilator'}</p>
                              </div>
                              <button onClick={() => handleDeleteReserve(fs.id)} className="text-red-500 hover:text-red-700 p-2 bg-red-50 rounded-lg transition-colors border border-red-100 hover:bg-red-100">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
