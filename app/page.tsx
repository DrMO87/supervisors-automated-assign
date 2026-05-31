import Link from 'next/link';
import { Navigation } from '@/components/layout/navigation';
import {
  Calendar, Users, DoorOpen, Settings, FileText,
  LayoutDashboard, Zap, ArrowRight, ChevronRight,
} from 'lucide-react';

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
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-surface-100 flex">
      <Navigation />

      <div className="flex-1 md:ml-64 flex flex-col pt-14 md:pt-0">
        {/* Hero */}
        <div
          className="relative px-8 py-16 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #002147 0%, #001530 50%, #1929b5 100%)' }}
        >
          {/* Decorative blobs */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gold-400/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-1/2 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/70 text-xs font-medium mb-6 backdrop-blur-sm">
              <Zap className="w-3.5 h-3.5 text-gold-400" />
              Intelligent Exam Supervision Scheduler
            </div>

            <h1 className="text-4xl md:text-5xl font-display font-bold text-white leading-tight tracking-tight mb-4">
              Exam Supervision{' '}
              <span className="text-gradient-gold">Management System</span>
            </h1>

            <p className="text-lg text-white/60 max-w-2xl mb-8 leading-relaxed">
              Automate fair assignment of supervisors to exam halls based on workload scores, 
              staff availability, room proximity, and health constraints — instantly.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link href="/assignments" className="btn btn-gold btn-lg group shadow-glow-gold">
                <Zap className="w-5 h-5" />
                Run Auto-Assign
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/dashboard" className="btn btn-secondary btn-lg">
                <LayoutDashboard className="w-5 h-5" />
                View Schedule
              </Link>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-4">
          <div className="flex flex-wrap items-center gap-4 md:gap-8 text-sm">
            {[
              { label: 'Smart Algorithm', value: 'Greedy + Score-aware' },
              { label: 'Co-located Exam Support', value: 'Shared Committee Supervisor' },
              { label: 'Health Routing', value: 'M/P Building Preference' },
              { label: 'Export', value: 'Excel & PDF Reports' },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-gold-500" />
                <span className="text-slate-500">{s.label}:</span>
                <span className="font-semibold text-slate-700">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cards grid */}
        <div className="p-8 flex-1">
          <div className="mb-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Start Here — Follow the Steps</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.href}
                  href={card.href}
                  className={`group relative card card-hover p-6 border border-slate-200 ${card.border} transition-all duration-200 overflow-hidden`}
                >
                  {/* Background tint */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                  {/* Featured glow */}
                  {card.featured && (
                    <div className="absolute top-3 right-3">
                      <span className="badge badge-gold text-[10px]">
                        <Zap className="w-2.5 h-2.5" /> Core Action
                      </span>
                    </div>
                  )}

                  <div className="relative">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`${card.iconBg} p-3 rounded-xl group-hover:scale-110 transition-transform duration-200`}>
                        <Icon className={`w-5 h-5 ${card.iconColor}`} />
                      </div>
                      <span className="text-2xl font-display font-bold text-slate-100 group-hover:text-slate-200 transition-colors select-none">
                        {card.step}
                      </span>
                    </div>

                    <h3 className="text-base font-display font-semibold text-slate-900 mb-1.5">
                      {card.title}
                    </h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{card.description}</p>

                    <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-primary-900/60 group-hover:text-primary-900 transition-colors">
                      Open <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
