'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Staff, Room, getPeriodFromTime, ExamSessionWithRelations, AssignmentWithSession } from '@/types/database.types';
import { Loader2, Calendar, Clock, DoorOpen, User, RefreshCw, LogOut, CheckCircle2, FileText, Download } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  generateStaffScheduleExcel,
  generateStaffScheduleHTML,
  getWeekRangeLabel,
  mapFreeStaffToAssignment,
} from '@/lib/utils/report-generators';
import { downloadFile } from '@/lib/utils/csv-helpers';
import { AiQueryBox } from '@/components/dashboard/ai-query-box';
export default function UnifiedStaffPortalPage() {
  const [activeTab, setActiveTab] = useState<'swap' | 'schedule'>('swap');
  const [currentUserData, setCurrentUserData] = useState<any>(null);
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
        if (staffId) {
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
        setSwapError(`You can only swap assignments within the current active week (${weekStartDate} to ${weekEndDate}).`);
        return;
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
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
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
    } finally {
      setGeneratingSchedule(null);
    }
  };

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
      <div className="relative z-30 mb-8 bg-white/10 backdrop-blur-xl p-1.5 rounded-full border border-white/20 shadow-xl flex items-center w-80 max-w-full">
        {/* Sliding active background indicator */}
        <div 
          className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-gradient-to-r from-primary-600 to-indigo-600 rounded-full shadow-lg transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          style={{ transform: activeTab === 'swap' ? 'translateX(0)' : 'translateX(calc(100% + 12px))' }}
        />
        
        <button
          onClick={() => setActiveTab('swap')}
          className={`flex-1 relative z-10 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-bold rounded-full transition-colors duration-300 ${activeTab === 'swap' ? 'text-white' : 'text-slate-300 hover:text-white'}`}
        >
          <RefreshCw className="w-4 h-4" />
          Swap Shift
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`flex-1 relative z-10 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-bold rounded-full transition-colors duration-300 ${activeTab === 'schedule' ? 'text-white' : 'text-slate-300 hover:text-white'}`}
        >
          <Calendar className="w-4 h-4" />
          My Schedule
        </button>
      </div>

      {/* Sliding Viewport Container */}
      <div className="w-full max-w-lg relative z-20 overflow-hidden rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] border border-white/20">
        <div 
          className="flex w-[200%] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: activeTab === 'swap' ? 'translateX(0)' : 'translateX(-50%)' }}
        >
          {/* ----- SWAP PANE ----- */}
          <div className="w-1/2 flex-shrink-0 bg-white/95 backdrop-blur-xl h-full flex flex-col">
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
                          min={weekStartDate || undefined}
                          max={weekEndDate || undefined}
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

          {/* ----- SCHEDULE PANE ----- */}
          <div className="w-1/2 flex-shrink-0 bg-white/95 backdrop-blur-xl h-full flex flex-col">
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

              {!currentUserData ? (
                <div className="text-center p-6 bg-amber-50 border border-amber-200 rounded-xl m-auto w-full">
                  <p className="text-amber-800 text-sm font-medium">
                    This feature requires a personalized staff account. The generic login cannot generate personal schedules.
                  </p>
                </div>
              ) : (
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
