'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Staff, ExamSessionWithRelations, AssignmentWithSession, PeriodFreeStaff } from '@/types/database.types';
import { Loader2, Download, LogOut, BarChart3, FileText, CheckCircle2, AlertCircle, Users, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  generateDailyHallExcel, generateDailyHallHTML,
  generateWeeklyHallExcel, generateWeeklyHallHTML,
  generateAssignedReservesExcel, generateAssignedReservesHTML,
  generateFreeInvigilatorsExcel, generateFreeInvigilatorsHTML,
  generateAllStaffSchedulesHTML,
  generateWorkloadExcel
} from '@/lib/utils/report-generators';
import { downloadFile } from '@/lib/utils/csv-helpers';
import { AreaChart, Area, Tooltip, ResponsiveContainer, LabelList, Calendar as CalendarIcon } from 'recharts';

export default function AdminReportsPage() {
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  // Data State
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [exams, setExams] = useState<ExamSessionWithRelations[]>([]);
  const [assignments, setAssignments] = useState<AssignmentWithSession[]>([]);
  const [freeStaff, setFreeStaff] = useState<PeriodFreeStaff[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Metrics State
  const [metrics, setMetrics] = useState({
    totalExams: 0,
    totalAssignments: 0,
    assignedReserves: 0,
    freeReserves: 0,
    coverage: 0,
    chartData: [] as any[]
  });
  
  const [weekRange, setWeekRange] = useState({ start: '', end: '' });

  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session || session.user?.user_metadata?.role !== 'admin_reports') {
          router.push('/login');
          return;
        }
        
        setCurrentUserData(session.user.user_metadata);

        // Fetch entire database for the current reporting purposes
        // In a production app with huge data, this should be paginated or date-filtered
        const [staffRes, examsRes, assignmentsRes, freeStaffRes] = await Promise.all([
          supabase.from('staff').select('*').order('name'),
          supabase.from('exam_sessions').select('*, room:rooms(*), assignments(*, staff:staff(*))').order('exam_date').limit(5000),
          supabase.from('assignments').select('*, staff:staff(*), exam_session:exam_sessions(*, room:rooms(*))').limit(15000),
          supabase.from('period_free_staff').select('*, staff:staff(*)').order('exam_date').order('period').limit(5000)
        ]);

        if (staffRes.error) throw staffRes.error;
        if (examsRes.error) throw examsRes.error;
        if (assignmentsRes.error) throw assignmentsRes.error;
        if (freeStaffRes.error) throw freeStaffRes.error;

        const fetchedExams = examsRes.data || [];
        const fetchedAssignments = assignmentsRes.data || [];
        const fetchedFreeStaff = freeStaffRes.data || [];

        setStaffList(staffRes.data || []);
        setExams(fetchedExams);
        setAssignments(fetchedAssignments);
        setFreeStaff(fetchedFreeStaff);

        // Pre-select the most common upcoming date WITHIN the current week
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
            setSelectedDate(currentWeekStart); // fallback
          }
        } else {
          setSelectedDate(todayIso);
        }

        // Calculate Metrics for the current week context
        const currentWeekExams = fetchedExams.filter(e => getWeekStart(e.exam_date) === currentWeekStart);
        const currentWeekAssignments = fetchedAssignments.filter(a => a.exam_session && getWeekStart(a.exam_session.exam_date) === currentWeekStart);
        const currentWeekFreeStaff = fetchedFreeStaff.filter(fs => getWeekStart(fs.exam_date) === currentWeekStart);

        // An assigned reserve is someone assigned to a session with role Assistant or similar, or just any reserve metric we can estimate.
        // We'll calculate coverage as Assignments / (Exams * expected_staff_per_exam). Roughly assuming 1 head + 2 invigilators = 3
        const expectedStaffRequired = currentWeekExams.length * 3;
        let coverageRatio = 0;
        if (expectedStaffRequired > 0) {
          coverageRatio = Math.min(100, Math.round((currentWeekAssignments.length / expectedStaffRequired) * 100));
        } else if (currentWeekExams.length === 0 && fetchedExams.length > 0) {
          coverageRatio = 100;
        }

        // Count how many free reserves were actually converted to assignments
        const assignedReservesCount = fetchedAssignments.filter(a => a.role === 'Assistant' || a.role === 'Invigilator' && a.is_manual_override).length;

        // Daily Chart Data
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

      } catch (err: any) {
        console.error('Failed to load data:', err);
        alert('Failed to load portal data. Check console.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [supabase, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
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
      else if (reportType === 'weekly') {
        // Just use the latest week or a specific week. We'll use the whole dataset for the selected date's week.
        const d = new Date(`${selectedDate || new Date().toISOString().split('T')[0]}T12:00:00Z`);
        const day = d.getUTCDay();
        const offset = day === 6 ? 0 : -(day + 1);
        const weekStartStr = new Date(d.setUTCDate(d.getUTCDate() + offset)).toISOString().split('T')[0];
        
        const getWeekStart = (dateStr: string) => {
          const dx = new Date(`${dateStr}T12:00:00Z`);
          const dday = dx.getUTCDay();
          const doffset = dday === 6 ? 0 : -(dday + 1);
          return new Date(dx.setUTCDate(dx.getUTCDate() + doffset)).toISOString().split('T')[0];
        };
        const weekExams = exams.filter(e => getWeekStart(e.exam_date) === weekStartStr);

        if (format === 'excel') {
          const blob = generateWeeklyHallExcel(weekExams, `Week of ${weekStartStr}`);
          downloadFile(blob, `weekly_hall_report_${weekStartStr}.xlsx`);
        } else {
          const html = generateWeeklyHallHTML(weekExams, `Week of ${weekStartStr}`);
          openPrintable(html);
        }
      }
      else if (reportType === 'all-staff') {
        const d = new Date(`${selectedDate || new Date().toISOString().split('T')[0]}T12:00:00Z`);
        const day = d.getUTCDay();
        const offset = day === 6 ? 0 : -(day + 1);
        const weekStartStr = new Date(d.setUTCDate(d.getUTCDate() + offset)).toISOString().split('T')[0];
        
        const getWeekStart = (dateStr: string) => {
          const dx = new Date(`${dateStr}T12:00:00Z`);
          const dday = dx.getUTCDay();
          const doffset = dday === 6 ? 0 : -(dday + 1);
          return new Date(dx.setUTCDate(dx.getUTCDate() + doffset)).toISOString().split('T')[0];
        };
        const weekAssignments = assignments.filter(a => a.exam_session && getWeekStart(a.exam_session.exam_date) === weekStartStr);

        if (format === 'excel') {
          const blob = generateWorkloadExcel(staffList, weekAssignments);
          downloadFile(blob, `all_staff_workload_${weekStartStr}.xlsx`);
        } else {
          const html = generateAllStaffSchedulesHTML(staffList, weekAssignments, `Week of ${weekStartStr}`);
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
      else if (reportType === 'free-reserve') {
        const dailyExams = exams.filter(e => e.exam_date === selectedDate);
        const dailyAssignments = assignments.filter(a => a.exam_session && a.exam_session.exam_date === selectedDate);
        
        if (format === 'excel') {
          const blob = generateFreeInvigilatorsExcel(staffList, dailyExams, dailyAssignments);
          downloadFile(blob, `free_reserves_${selectedDate}.xlsx`);
        } else {
          const html = generateFreeInvigilatorsHTML(staffList, dailyExams, dailyAssignments);
          openPrintable(html);
        }
      }
    } catch (err: any) {
      console.error(err);
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
          {generating === `${type}-excel` ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
          Excel
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 text-white px-8 py-5 flex items-center justify-between shadow-md z-10 sticky top-0">
        <div className="flex items-center gap-4">
          <div className="w-32 h-10 relative">
            <Image src="/images/logo-session-master-transparent.png" alt="Logo" fill className="object-contain" />
          </div>
          <div className="h-6 w-px bg-slate-700 mx-2"></div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Admin Reports Portal</h1>
            <p className="text-slate-400 text-xs">Post-Assign Analysis & Downloads</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white bg-white/10 px-4 py-2 rounded-full transition-colors hover:bg-white/20">
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-8 space-y-8">
        
        {/* Analysis Section */}
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
                  <p className="text-sm font-medium text-slate-500">Exams Scheduled</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics.totalExams}</p>
                </div>
              </div>
              
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><CheckCircle2 className="w-6 h-6" /></div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Assignments</p>
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
                  <p className="text-sm font-medium text-slate-500">Coverage Ratio</p>
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

        <hr className="border-slate-200" />

        {/* Reports Grid */}
        <section className="space-y-8">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-900">Generate Reports</h2>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 border-b pb-2">Weekly Reports (Current Week Context)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ReportCard 
                type="all-staff" 
                title="All Staff Schedule" 
                description="Master list detailing every staff member's individual assignments and workload for this week."
                icon={Users} 
              />
              <ReportCard 
                type="weekly" 
                title="Weekly Hall Report" 
                description="Comprehensive weekly overview of all hall assignments for the current week."
                icon={FileSpreadsheet} 
              />
            </div>
          </div>

          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b pb-2 gap-4">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Daily Reports (Selected Date Context)</h3>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-slate-600">Select Date:</label>
                <input 
                  type="date" 
                  value={selectedDate}
                  min={weekRange.start}
                  max={weekRange.end}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="text-sm border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white py-1.5"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              <ReportCard 
                type="free-reserve" 
                title="Free Reserve" 
                description="List of standby staff who are currently unassigned and available for emergencies on the selected date."
                icon={ShieldCheck} 
              />
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
