'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navigation } from '@/components/layout/navigation';
import {
  Calendar, Users, DoorOpen, Settings, FileText,
  LayoutDashboard, Zap, ArrowRight, ChevronRight,
  CheckCircle2, Clock, AlertCircle, RefreshCw, Layers, History, Info
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

export default function HomePage() {
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
        const [staffRes, roomsRes, examsRes, assignRes, userRes, logsRes] = await Promise.all([
          supabase.from('staff').select('id', { count: 'exact', head: true }),
          supabase.from('rooms').select('id', { count: 'exact', head: true }),
          supabase.from('exam_sessions').select('id', { count: 'exact', head: true }),
          supabase.from('assignments').select('id', { count: 'exact', head: true }),
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

        setUserEmail(userRes.data?.user?.email || null);
        setAuditLogs(logsRes.data || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        setStats(s => ({ ...s, isLoading: false }));
      }
    }

    fetchData();
  }, [isConfigured]);

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
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-500',
      border: 'hover:border-slate-300',
      isCompleted: false, // Informational
    },
  ];

  // Logic for Alerts
  const alerts = [];
  if (!stats.isLoading) {
    if (stats.staffCount === 0) {
      alerts.push({ type: 'warning', text: "Action Required: Please import your staff Excel file to begin." });
    } else if (stats.roomCount === 0) {
      alerts.push({ type: 'warning', text: "Missing Data: Please configure exam rooms before scheduling sessions." });
    } else if (stats.examCount > 0 && stats.assignmentCount === 0) {
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
          className="relative px-8 py-16 overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8"
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
            </div>
          </div>
          
          {/* Dashboard Illustration / Graphic for Premium feel */}
          <div className="relative z-10 hidden lg:block w-full max-w-md">
            <div className="relative rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl p-6 transform rotate-3 hover:rotate-0 hover:scale-105 transition-all duration-500">
              <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-400/80"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400/80"></div>
                </div>
                <div className="text-white/40 text-xs font-mono ml-2">system_status.log</div>
              </div>
              <div className="space-y-4">
                <div className="h-2 w-3/4 bg-white/10 rounded"></div>
                <div className="h-2 w-1/2 bg-white/10 rounded"></div>
                <div className="h-2 w-5/6 bg-white/10 rounded"></div>
                <div className="flex gap-2 pt-2">
                  <div className="h-8 w-8 rounded-lg bg-gold-400/20 border border-gold-400/30"></div>
                  <div className="h-8 w-full rounded-lg bg-white/5 border border-white/10"></div>
                </div>
              </div>
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
              Live System Metrics
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
                <p className="text-xs font-semibold text-slate-500 uppercase">Exam Sessions</p>
                <p className="text-2xl font-display font-bold text-slate-800">
                  {stats.isLoading ? '...' : stats.examCount}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="bg-gold-100 text-gold-600 p-3 rounded-lg">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Assignments</p>
                <p className="text-2xl font-display font-bold text-slate-800">
                  {stats.isLoading ? '...' : stats.assignmentCount}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area (Cards + Sidebar) */}
        <div className="p-8 flex-1 bg-surface-50 flex flex-col lg:flex-row gap-8">
          
          <div className="flex-1">
            {/* Smart Alerts */}
            {alerts.length > 0 && (
              <div className="mb-8 space-y-3">
                {alerts.map((alert, i) => (
                  <div key={i} className={`p-4 rounded-xl border flex items-start gap-3 shadow-sm animate-slide-up ${
                    alert.type === 'danger' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}>
                    {alert.type === 'danger' ? <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" /> : <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />}
                    <p className="text-sm font-medium">{alert.text}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mb-6 flex items-end justify-between">
              <div>
                <h2 className="text-xl font-display font-bold text-slate-900 mb-1">
                  {isPopulated ? 'System Configuration' : 'Welcome! Let\'s set up your first exam cycle'}
                </h2>
                <p className="text-sm text-slate-500">
                  {isPopulated 
                    ? 'Access key areas to manage your data and assignments.' 
                    : 'Follow the steps below to import your data and run the automated assignment engine.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {cards.map((card, idx) => {
                const Icon = card.icon;
                const delayClass = `animate-slide-up delay-[${idx * 100}ms]`;
                
                return (
                  <Link
                    key={card.href}
                    href={card.href}
                    className={`group relative card card-hover p-6 border ${card.border} transition-all duration-300 overflow-hidden bg-white hover:-translate-y-1 hover:shadow-xl ${delayClass}`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out`} />

                    {card.featured ? (
                      <div className="absolute top-4 right-4">
                        <span className="badge badge-gold text-[10px] shadow-sm">
                          <Zap className="w-2.5 h-2.5" /> Core Action
                        </span>
                      </div>
                    ) : card.isCompleted ? (
                      <div className="absolute top-4 right-4">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                          <CheckCircle2 className="w-3 h-3" /> Completed
                        </span>
                      </div>
                    ) : (
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                      </div>
                    )}

                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-5">
                        <div className={`${card.iconBg} p-3.5 rounded-xl group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-sm`}>
                          <Icon className={`w-6 h-6 ${card.iconColor}`} />
                        </div>
                        <span className="text-3xl font-display font-extrabold text-slate-100 group-hover:text-slate-200 transition-colors select-none tracking-tighter">
                          {card.step}
                        </span>
                      </div>

                      <h3 className="text-lg font-display font-bold text-slate-900 mb-2 group-hover:text-primary-700 transition-colors">
                        {card.title}
                      </h3>
                      <p className="text-sm text-slate-500 leading-relaxed min-h-[40px]">
                        {card.description}
                      </p>

                      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 group-hover:text-primary-800 transition-colors">
                          Enter Module <ChevronRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-300" />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right Sidebar: Recent Activity */}
          <div className="lg:w-80 shrink-0">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-24">
              <div className="p-5 border-b border-slate-100 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                <h3 className="font-display font-bold text-slate-900 text-sm uppercase tracking-wide">Recent Activity</h3>
              </div>
              <div className="p-0">
                {auditLogs.length > 0 ? (
                  <ul className="divide-y divide-slate-50">
                    {auditLogs.map((log) => (
                      <li key={log.id} className="p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border ${getActionColor(log.action)}`}>
                            {log.action}
                          </span>
                          <span className="text-xs font-medium text-slate-500">{log.table_name}</span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2">
                          Record <span className="font-mono text-[10px] bg-slate-100 px-1 rounded">{log.record_id.substring(0,8)}</span> was modified.
                        </p>
                        <div className="mt-2 text-[10px] text-slate-400">
                          {new Date(log.changed_at).toLocaleString()}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-8 text-center text-slate-400">
                    <p className="text-sm">No recent activity.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
