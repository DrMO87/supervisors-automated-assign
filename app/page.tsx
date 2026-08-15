'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navigation } from '@/components/layout/navigation';
import {
  Calendar, Users, DoorOpen, Settings, FileText,
  LayoutDashboard, Zap, ArrowRight, ChevronRight,
  CheckCircle2, Clock, AlertCircle, RefreshCw, Layers, History, Info, Plus, ChevronDown, Shield
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { HOD_EMAILS } from '@/lib/config/hod-accounts';
import { useExamPeriod } from '@/lib/hooks/exam-period-context';
import { ExamPeriodModal } from '@/components/dashboard/exam-period-modal';
import { WeeklyBackupModal } from '@/components/dashboard/weekly-backup-modal';
import { RecentActivityWidget } from '@/components/dashboard/recent-activity-widget';


export default function HomePage() {
  const router = useRouter();
  const { activePeriod, allPeriods, activatePeriod, refetchPeriod } = useExamPeriod();
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);


  const [stats, setStats] = useState({
    staffCount: 0,
    roomCount: 0,
    examCount: 0,
    assignmentCount: 0,
    isLoading: true,
  });

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const isConfigured = isSupabaseConfigured();

  useEffect(() => {
    async function fetchData() {
      if (!isConfigured || !supabase) {
        setStats(s => ({ ...s, isLoading: false }));
        return;
      }

      try {
        let examsQuery = supabase.from('exam_sessions').select('id', { count: 'exact', head: true });
        if (activePeriod) {
          examsQuery = examsQuery
            .gte('exam_date', activePeriod.start_date)
            .lte('exam_date', activePeriod.end_date);
        }

        const assignQuery = activePeriod
          ? supabase
              .from('assignments')
              .select('id, exam_session:exam_sessions!inner(exam_date)', { count: 'exact', head: true })
              .gte('exam_session.exam_date', activePeriod.start_date)
              .lte('exam_session.exam_date', activePeriod.end_date)
          : supabase.from('assignments').select('id', { count: 'exact', head: true });



        const [staffRes, roomsRes, examsRes, assignRes, userRes, logsRes] = await Promise.all([
          supabase.from('staff').select('id', { count: 'exact', head: true }),
          supabase.from('rooms').select('id', { count: 'exact', head: true }),
          examsQuery,
          assignQuery,
          supabase.auth.getUser(),
          supabase.from('audit_log').select('*').order('changed_at', { ascending: false }).limit(5)
        ]);

        setStats({
          staffCount: staffRes.count || 0,
          roomCount: roomsRes.count || 0,
          examCount: examsRes.count || 0,
          assignmentCount: assignRes.count || 0,
          isLoading: false,
        });

        const email = userRes.data?.user?.email || null;
        if (email && HOD_EMAILS.includes(email.toLowerCase())) {
          router.push('/hod-portal');
          return;
        }

        setUserEmail(email);
        setAuditLogs(logsRes.data || []);

        // Passive end-of-week auto backup check
        if (activePeriod) {
          fetch('/api/backup/weekly/auto-check', { method: 'POST' }).catch(() => {});
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setStats(s => ({ ...s, isLoading: false }));
      }
    }

    fetchData();
  }, [isConfigured, router, activePeriod]);


  const cards = [
    {
      step: '01',
      href: '/staff',
      icon: Users,
      title: 'Staff Management',
      description: 'Manage faculty, track workload scores, set availability & special conditions',
      color: 'from-blue-500/10 to-blue-600/5',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      border: 'hover:border-blue-200',
      isCompleted: stats.staffCount > 0,
    },
    {
      step: '02',
      href: '/rooms',
      icon: DoorOpen,
      title: 'Room Management',
      description: 'Configure exam halls with capacity and automatic building-code parsing',
      color: 'from-violet-500/10 to-violet-600/5',
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
      border: 'hover:border-violet-200',
      isCompleted: stats.roomCount > 0,
    },
    {
      step: '03',
      href: '/exams',
      icon: Calendar,
      title: 'Exam Sessions',
      description: 'Create sessions and bulk-import the exam schedule from Excel files',
      color: 'from-emerald-500/10 to-emerald-600/5',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      border: 'hover:border-emerald-200',
      isCompleted: stats.examCount > 0,
    },
    {
      step: '04',
      href: '/assignments',
      icon: Zap,
      title: 'Auto-Assign',
      description: 'Run the intelligent algorithm to assign optimal supervisors in one click',
      color: 'from-gold-500/10 to-gold-400/5',
      iconBg: 'bg-gold-100',
      iconColor: 'text-gold-600',
      border: 'hover:border-gold-300',
      featured: true,
      isCompleted: stats.assignmentCount > 0,
    },
    {
      step: '05',
      href: '/dashboard',
      icon: LayoutDashboard,
      title: 'View Schedule',
      description: 'Interactive weekly grid with drag-and-drop manual override support',
      color: 'from-primary-900/10 to-primary-800/5',
      iconBg: 'bg-primary-900/10',
      iconColor: 'text-primary-900',
      border: 'hover:border-primary-900/20',
      isCompleted: false, // Informational
    },
    {
      step: '06',
      href: '/reports',
      icon: FileText,
      title: 'Reports',
      description: 'Download PDF schedules and export workload statistics to Excel',
      color: 'from-slate-100 to-slate-50',
      iconBg: 'bg-slate-200',
      iconColor: 'text-slate-700',
      border: 'hover:border-slate-300',
      isCompleted: false, // Informational
    },
  ];

  // Logic for Smart Alerts
  const alerts: { type: 'warning' | 'danger' | 'info'; text: string }[] = [];

  if (!isConfigured) {
    alerts.push({ type: 'danger', text: "Supabase environment variables are missing. Please check your setup." });
  } else if (!stats.isLoading) {
    if (stats.staffCount === 0) {
      alerts.push({ type: 'warning', text: "No staff members found. Add staff before running assignment." });
    }
    if (stats.roomCount === 0) {
      alerts.push({ type: 'warning', text: "No rooms configured. Add room data to enable scheduling." });
    }
    if (stats.examCount > 0 && stats.assignmentCount === 0) {
      alerts.push({ type: 'danger', text: "Attention: You have exams scheduled but NO supervisors assigned yet. Run Auto-Assign." });
    }
  }

  // Logic for Progress Bar
  let completedSteps = 0;
  if (stats.staffCount > 0) completedSteps++;
  if (stats.roomCount > 0) completedSteps++;
  if (stats.examCount > 0) completedSteps++;
  if (stats.assignmentCount > 0) completedSteps++;
  const progressPercent = (completedSteps / 4) * 100;

  // Formatting for Audit Log
  const getActionColor = (action: string) => {
    switch(action.toUpperCase()) {
      case 'INSERT': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'UPDATE': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'DELETE': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const isPopulated = stats.staffCount > 0 || stats.roomCount > 0 || stats.examCount > 0;

  return (
    <div className="min-h-screen bg-surface-100 flex">
      <Navigation />

      <div className="flex-1 md:ml-64 flex flex-col pt-14 md:pt-0">
        {/* Premium Hero */}
        <div
          className="relative px-8 py-14 overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8"
          style={{ background: 'linear-gradient(135deg, #00122e 0%, #001f4d 50%, #1527a0 100%)' }}
        >
          {/* Decorative blobs */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gold-400/20 rounded-full blur-[100px] translate-x-1/3 -translate-y-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/20 rounded-full blur-[80px] -translate-x-1/3 translate-y-1/3 pointer-events-none" />
          
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none"></div>

          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/80 text-xs font-medium mb-6 backdrop-blur-md shadow-glow-gold/20">
              <Zap className="w-3.5 h-3.5 text-gold-400" />
              Intelligent Exam Supervision Scheduler
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white leading-tight tracking-tight mb-4 drop-shadow-sm">
              {userEmail ? (
                <>Welcome back,<br/><span className="text-gradient-gold text-3xl md:text-4xl lg:text-5xl mt-2 block break-all">{userEmail}</span></>
              ) : (
                <>Exam Supervision <span className="text-gradient-gold block mt-1">Management System</span></>
              )}
            </h1>

            <p className="text-lg text-white/70 max-w-xl mb-8 leading-relaxed font-light">
              Automate fair assignment of supervisors to exam halls based on workload scores, 
              staff availability, room proximity, and health constraints — instantly.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href="/assignments" className="btn btn-gold btn-lg group shadow-glow-gold hover:shadow-glow-gold/80 transition-all">
                <Zap className="w-5 h-5 group-hover:scale-110 transition-transform" />
                {stats.assignmentCount > 0 ? 'Run Auto-Assign Again' : 'Run Auto-Assign'}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/dashboard" className="btn bg-white/10 text-white border border-white/20 hover:bg-white/20 btn-lg backdrop-blur-md transition-all">
                <LayoutDashboard className="w-5 h-5" />
                View Schedule
              </Link>
              <button
                onClick={() => setIsPeriodModalOpen(true)}
                className="btn bg-gold-500/20 text-gold-300 border border-gold-400/40 hover:bg-gold-500/30 btn-lg backdrop-blur-md transition-all flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                New Exam Period
              </button>
            </div>
          </div>
          
          {/* Active Period Card / Illustration */}
          <div className="relative z-10 w-full max-w-md">
            <div className="relative rounded-2xl bg-white/10 border border-white/20 backdrop-blur-xl shadow-2xl p-6 text-white">
              <div className="flex items-center justify-between mb-4 border-b border-white/15 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">
                    Active Exam Period
                  </span>
                </div>
                {allPeriods.length > 1 && (
                  <select
                    value={activePeriod?.id || ''}
                    onChange={(e) => activatePeriod(e.target.value)}
                    className="bg-white/10 border border-white/20 rounded-lg text-xs font-medium text-white px-2 py-1 focus:outline-none focus:bg-slate-900"
                  >
                    {allPeriods.map(p => (
                      <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {activePeriod ? (
                <div>
                  <h3 className="text-xl font-bold font-display text-white mb-1">
                    {activePeriod.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-white/80 mb-4">
                    <span className="px-2 py-0.5 rounded bg-gold-400/20 text-gold-300 border border-gold-400/30 font-semibold">
                      {activePeriod.semester_type} Semester
                    </span>
                    {activePeriod.academic_year && (
                      <span className="text-white/60">({activePeriod.academic_year})</span>
                    )}
                  </div>

                  <div className="bg-white/5 rounded-xl p-3 border border-white/10 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-white/60">Dates:</span>
                      <span className="font-semibold text-white font-mono">
                        {activePeriod.start_date} → {activePeriod.end_date}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/60">Scoring Mode:</span>
                      <span className="font-semibold text-gold-300 capitalize">
                        {activePeriod.score_mode === 'fresh' ? '🆕 Start Fresh' : '🔄 Continue Scores'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between">
                    <span className="text-xs text-white/70 flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-emerald-400" /> End-of-Week Backups Active
                    </span>
                    <button
                      onClick={() => setIsBackupModalOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white transition-all flex items-center gap-1.5"
                    >
                      <Shield className="w-3.5 h-3.5 text-gold-400" />
                      Weekly Backups
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Calendar className="w-10 h-10 text-white/40 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-white">No Active Exam Period</p>
                  <p className="text-xs text-white/60 mb-4">Create a period to scope exams, dates & scores</p>
                  <button
                    onClick={() => setIsPeriodModalOpen(true)}
                    className="btn btn-gold btn-sm px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Create Exam Period
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>


        {/* Setup Progress Bar */}
        <div className="bg-white px-8 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Setup Completion</h3>
            <span className="text-xs font-bold text-slate-700">{progressPercent}% Ready</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-gold-500 h-2.5 rounded-full transition-all duration-1000 ease-out" 
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>

        {/* Live System Metrics */}
        <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-6 shadow-sm z-20">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 text-slate-400 ${stats.isLoading ? 'animate-spin' : ''}`} />
              Live System Metrics {activePeriod ? `(${activePeriod.name})` : ''}
            </h2>
            {!isConfigured && (
              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-200 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> Database not connected
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Total Staff</p>
                <p className="text-2xl font-display font-bold text-slate-800">
                  {stats.isLoading ? '...' : stats.staffCount}
                </p>
              </div>
            </div>
            
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="bg-violet-100 text-violet-600 p-3 rounded-lg">
                <DoorOpen className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Exam Rooms</p>
                <p className="text-2xl font-display font-bold text-slate-800">
                  {stats.isLoading ? '...' : stats.roomCount}
                </p>
              </div>
            </div>
            
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="bg-emerald-100 text-emerald-600 p-3 rounded-lg">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Period Exams</p>
                <p className="text-2xl font-display font-bold text-slate-800">
                  {stats.isLoading ? '...' : stats.examCount}
                </p>
              </div>
            </div>
            
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="bg-gold-100 text-gold-600 p-3 rounded-lg">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Period Assignments</p>
                <p className="text-2xl font-display font-bold text-slate-800">
                  {stats.isLoading ? '...' : stats.assignmentCount}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="p-4 md:p-8 max-w-7xl w-full mx-auto space-y-8">
          {/* Smart System Alerts */}
          {alerts.length > 0 && (
            <div className="space-y-3">
              {alerts.map((alert, idx) => (
                <div 
                  key={idx} 
                  className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                    alert.type === 'danger' ? 'bg-red-50 border-red-200 text-red-700' :
                    alert.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                    'bg-blue-50 border-blue-200 text-blue-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span className="text-sm font-semibold">{alert.text}</span>
                  </div>
                  {alert.type === 'danger' && stats.examCount > 0 && stats.assignmentCount === 0 && (
                    <Link href="/assignments" className="btn btn-gold btn-sm shrink-0">
                      Run Auto-Assign
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Workflow Modules Grid */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-display font-bold text-slate-900">System Modules</h2>
                <p className="text-sm text-slate-500">Follow the step-by-step workflow to setup, assign, and manage supervision</p>
              </div>
            </div>


            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cards.map((card) => {
                const Icon = card.icon;
                return (
                  <Link 
                    key={card.step} 
                    href={card.href}
                    className={`group relative bg-white border border-slate-200 rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between ${card.border}`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-3 rounded-xl ${card.iconBg} ${card.iconColor}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="flex items-center gap-2">
                          {card.isCompleted && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Ready
                            </span>
                          )}
                          <span className="text-xs font-bold text-slate-300 font-mono">
                            STEP {card.step}
                          </span>
                        </div>
                      </div>

                      <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-gold-600 transition-colors flex items-center justify-between">
                        {card.title}
                        <ChevronRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-gold-500" />
                      </h3>
                      <p className="text-sm text-slate-500 leading-relaxed mb-6">
                        {card.description}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-400 group-hover:text-gold-600">
                      <span>Open Module</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Audit Log / Recent Activity */}
          <RecentActivityWidget initialLogs={auditLogs} />
        </div>
      </div>


      {/* Exam Period Modal */}
      <ExamPeriodModal
        isOpen={isPeriodModalOpen}
        onClose={() => setIsPeriodModalOpen(false)}
        onSuccess={() => refetchPeriod()}
      />

      {/* Weekly Backup Modal */}
      <WeeklyBackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
      />
    </div>
  );
}

