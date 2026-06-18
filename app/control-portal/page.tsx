'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Staff, ExamSessionWithRelations, AssignmentWithSession, PeriodFreeStaff, SwapRequestWithRelations } from '@/types/database.types';
import { Loader2, Download, LogOut, FileText, CheckCircle2, ShieldCheck, RefreshCw, Calendar as CalendarIcon, Clock, XCircle, User, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  generateDailyHallExcel, generateDailyHallHTML,
  generateAssignedReservesExcel, generateAssignedReservesHTML,
} from '@/lib/utils/report-generators';
import { downloadFile, exportSwapsToExcel } from '@/lib/utils/csv-helpers';
import { AiQueryBox } from '@/components/dashboard/ai-query-box';

export default function ControlPortalPage() {
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'reports' | 'swaps'>('reports');

  // Data State
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [exams, setExams] = useState<ExamSessionWithRelations[]>([]);
  const [assignments, setAssignments] = useState<AssignmentWithSession[]>([]);
  const [freeStaff, setFreeStaff] = useState<PeriodFreeStaff[]>([]);
  const [swaps, setSwaps] = useState<SwapRequestWithRelations[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  
  const [weekRange, setWeekRange] = useState({ start: '', end: '' });

  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session || session.user?.user_metadata?.role !== 'control') {
          router.push('/login');
          return;
        }
        
        setCurrentUserData(session.user.user_metadata);

        const [staffRes, examsRes, assignmentsRes, freeStaffRes, swapsRes] = await Promise.all([
          supabase.from('staff').select('*').order('name'),
          supabase.from('exam_sessions').select('*, room:rooms(*), assignments(*, staff:staff(*))').order('exam_date').limit(5000),
          supabase.from('assignments').select('*, staff:staff(*), exam_session:exam_sessions(*, room:rooms(*))').limit(15000),
          supabase.from('period_free_staff').select('*, staff:staff(*)').order('exam_date').order('period').limit(5000),
          supabase.from('swap_requests').select('*, room:rooms(*), original_staff:staff!original_staff_id(*), replacement_staff:staff!replacement_staff_id(*)').order('created_at', { ascending: false })
        ]);

        const fetchedExams = examsRes.data || [];
        setStaffList(staffRes.data || []);
        setExams(fetchedExams);
        setAssignments(assignmentsRes.data || []);
        setFreeStaff(freeStaffRes.data || []);
        setSwaps(swapsRes.data as any || []);

        const todayIso = new Date().toISOString().split('T')[0];
        const getWeekStart = (dateStr: string) => {
          const d = new Date(`${dateStr}T12:00:00Z`);
          const day = d.getUTCDay();
          const offset = day === 6 ? 0 : -(day + 1);
          const start = new Date(d.setUTCDate(d.getUTCDate() + offset));
          return start.toISOString().split('T')[0];
        };
        const currentWeekStart = getWeekStart(todayIso);
        const currentWeekEnd = new Date(new Date(`${currentWeekStart}T12:00:00Z`).getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        setWeekRange({ start: currentWeekStart, end: currentWeekEnd });

        if (fetchedExams.length > 0) {
          const currentWeekFetched = fetchedExams.filter(e => getWeekStart(e.exam_date) === currentWeekStart);
          const upcoming = currentWeekFetched.filter(e => e.exam_date >= todayIso).sort((a,b) => a.exam_date.localeCompare(b.exam_date));
          if (upcoming.length > 0) {
            setSelectedDate(upcoming[0].exam_date);
          } else if (currentWeekFetched.length > 0) {
            setSelectedDate(currentWeekFetched[currentWeekFetched.length - 1].exam_date);
          } else {
            setSelectedDate(currentWeekStart);
          }
        } else {
          setSelectedDate(todayIso);
        }
      } catch (err: any) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [supabase, router]);

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

  const executeDownload = async (reportType: string, format: 'pdf' | 'excel') => {
    setGenerating(`${reportType}-${format}`);
    try {
      if (reportType === 'daily') {
        const dailyExams = exams.filter(e => e.exam_date === selectedDate);
        if (dailyExams.length === 0) {
          alert('No exams found for the selected date.');
          return;
        }
        if (format === 'excel') {
          const blob = generateDailyHallExcel(dailyExams, selectedDate);
          downloadFile(blob, `daily_hall_report_${selectedDate}.xlsx`);
        } else {
          const html = generateDailyHallHTML(dailyExams, selectedDate);
          openPrintable(html);
        }
      }
      else if (reportType === 'assigned-reserve') {
        const dailyFreeStaff = freeStaff.filter(fs => fs.exam_date === selectedDate);
        if (format === 'excel') {
          const blob = generateAssignedReservesExcel(dailyFreeStaff, `Deployment on ${selectedDate}`);
          downloadFile(blob, `assigned_reserves_${selectedDate}.xlsx`);
        } else {
          const html = generateAssignedReservesHTML(dailyFreeStaff, `Deployment on ${selectedDate}`);
          openPrintable(html);
        }
      }
    } catch (err: any) {
      alert('Error generating report: ' + err.message);
    } finally {
      setGenerating(null);
    }
  };

  const openPrintable = (html: string) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
      </div>
    );
  }

  const ReportCard = ({ title, description, type, icon: Icon }: any) => (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
      <div>
        <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 text-indigo-600">
          <Icon className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">{title}</h3>
        <p className="text-slate-500 text-sm mb-6">{description}</p>
      </div>
      <div className="flex gap-3">
        <button 
          onClick={() => executeDownload(type, 'pdf')}
          disabled={!!generating}
          className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors flex justify-center items-center gap-2 border border-slate-200"
        >
          {generating === `${type}-pdf` ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          Print PDF
        </button>
        <button 
          onClick={() => executeDownload(type, 'excel')}
          disabled={!!generating}
          className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors flex justify-center items-center gap-2 border border-indigo-200"
        >
          {generating === `${type}-excel` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Excel
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-slate-900 text-white px-8 py-5 flex items-center justify-between shadow-md z-10 sticky top-0">
        <div className="flex items-center gap-4">
          <div className="w-32 h-10 relative">
            <Image src="/images/logo-session-master-transparent.png" alt="Logo" fill className="object-contain" />
          </div>
          <div className="h-6 w-px bg-slate-700 mx-2"></div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Control Portal</h1>
            <p className="text-slate-400 text-xs">Read-Only Monitoring</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white bg-white/10 px-4 py-2 rounded-full transition-colors hover:bg-white/20">
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-8">
        
        <AiQueryBox 
          weekStart={new Date(`${weekRange.start || new Date().toISOString().split('T')[0]}T12:00:00Z`)}
          externalExamSessions={exams}
          externalStaff={staffList}
        />

        {/* Tabs */}
        <div className="flex gap-4 border-b border-slate-200 mb-8">
          <button
            onClick={() => setActiveTab('reports')}
            className={`pb-4 px-2 text-sm font-bold flex items-center gap-2 transition-colors relative ${activeTab === 'reports' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <CalendarIcon className="w-4 h-4" />
            Daily Reports
            {activeTab === 'reports' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full" />}
          </button>
          <button
            onClick={() => setActiveTab('swaps')}
            className={`pb-4 px-2 text-sm font-bold flex items-center gap-2 transition-colors relative ${activeTab === 'swaps' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <RefreshCw className="w-4 h-4" />
            Swap Log
            {activeTab === 'swaps' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full" />}
          </button>
        </div>

        {activeTab === 'reports' && (
          <section>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Current Week Reports</h2>
                <p className="text-sm text-slate-500">Select a date within the active week to generate reports.</p>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="text-sm font-bold text-slate-700">Selected Date:</label>
                <input 
                  type="date" 
                  value={selectedDate}
                  min={weekRange.start}
                  max={weekRange.end}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="text-sm border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white py-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ReportCard 
                type="daily" 
                title="Daily Hall Report" 
                description="Full schedule matrix showing all exam halls, times, and assigned staff for the selected date."
                icon={FileText} 
              />
              <ReportCard 
                type="assigned-reserve" 
                title="Assigned Reserve" 
                description="List of reserve staff who were officially deployed to cover an exam hall on the selected date."
                icon={CheckCircle2} 
              />
            </div>
          </section>
        )}

        {activeTab === 'swaps' && (
          <section>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="bg-slate-50 p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Swap Requests Log</h2>
                  <p className="text-sm text-slate-500">Read-only view of all shift swap requests across the system.</p>
                </div>
                {swaps.length > 0 && (
                  <button
                    onClick={() => {
                      const blob = exportSwapsToExcel(swaps);
                      downloadFile(blob, `swaps_export_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-semibold transition-colors border border-indigo-200 shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    Export Swaps (Excel)
                  </button>
                )}
              </div>
              
              {swaps.length === 0 ? (
                <div className="p-12 text-center text-gray-500">No swap requests found.</div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {swaps.map(req => (
                    <div key={req.id} className="p-5 hover:bg-gray-50 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-3 flex-1">
                          <div className="flex items-center gap-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                              ${req.status === 'pending' ? 'bg-amber-100 text-amber-800' : 
                                req.status === 'approved' ? 'bg-green-100 text-green-800' : 
                                'bg-gray-100 text-gray-800'}`}
                            >
                              {req.status === 'pending' && <Clock className="w-3.5 h-3.5" />}
                              {req.status === 'approved' && <CheckCircle2 className="w-3.5 h-3.5" />}
                              {req.status === 'rejected' && <XCircle className="w-3.5 h-3.5" />}
                              {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                            </span>
                            <span className="text-xs text-gray-500 font-medium">
                              Requested on {format(new Date(req.created_at), 'MMM d, yyyy')}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-gray-700">
                            <div className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded">
                              <CalendarIcon className="w-4 h-4 text-gray-500" />
                              <span className="font-medium">{format(new Date(req.exam_date), 'MMM d, yyyy')}</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded">
                              <Clock className="w-4 h-4 text-gray-500" />
                              <span className="font-medium">Period {req.period}</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded">
                              <span className="font-medium">{req.room?.room_name || 'Unknown Room'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-sm">
                            <div className="flex items-center gap-2 p-2 bg-red-50 text-red-900 rounded-lg border border-red-100 min-w-[200px]">
                              <User className="w-4 h-4 text-red-500" />
                              <span className="font-semibold">{req.original_staff?.name || 'Unknown'}</span>
                            </div>
                            <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            <div className="flex items-center gap-2 p-2 bg-green-50 text-green-900 rounded-lg border border-green-100 min-w-[200px]">
                              <User className="w-4 h-4 text-green-500" />
                              <span className="font-semibold">{req.replacement_staff?.name || 'Unknown'}</span>
                            </div>
                          </div>
                        </div>
                        {req.resolved_at && (
                          <div className="text-xs text-gray-400 text-right">
                            Resolved {format(new Date(req.resolved_at), 'MMM d, h:mm a')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
