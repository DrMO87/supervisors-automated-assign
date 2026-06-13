'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, DoorOpen, Calendar,
  FileText, Settings, Home, Zap, ChevronRight, TrendingUp, LogOut, Menu, X, RefreshCw
} from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { cn } from '@/lib/utils/cn';

const navGroups = [
  {
    label: 'Overview',
    items: [
      { href: '/', label: 'Home', icon: Home },
      { href: '/dashboard', label: 'Schedule', icon: LayoutDashboard },
      { href: '/analytics', label: 'Analytics', icon: TrendingUp },
    ],
  },
  {
    label: 'Data Setup',
    items: [
      { href: '/staff', label: 'Staff', icon: Users },
      { href: '/rooms', label: 'Rooms', icon: DoorOpen },
      { href: '/exams', label: 'Exams', icon: Calendar },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/assignments', label: 'Auto-Assign', icon: Zap },
      { href: '/reports', label: 'Reports', icon: FileText },
      { href: '/swaps', label: 'Swaps', icon: RefreshCw },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClientComponentClient();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch(e) {
      console.error(e);
    }
    window.location.href = '/login';
  };

  return (
    <>
      {/* Mobile Header with Hamburger Menu */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-gradient-to-r from-[#002147] to-[#001530] z-40 flex items-center justify-between px-4 shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 relative">
            <Image
              src="/images/logo-session-master-transparent.png"
              alt="Session Master Logo"
              fill
              className="object-contain"
            />
          </div>
          <span className="text-white font-bold text-sm tracking-wide">Session Master</span>
        </div>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="text-white p-2 focus:outline-none bg-white/10 rounded-md"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* The Sidebar itself */}
      <aside
        className={cn(
          "fixed left-0 top-0 bottom-0 w-64 shadow-sidebar z-50 flex flex-col transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        style={{ background: 'linear-gradient(180deg, #002147 0%, #001530 60%, #000d1f 100%)' }}
      >
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/10">
        <Link href="/" className="block group">
          <div className="relative w-full aspect-[1024/558] group-hover:scale-[1.03] transition-transform duration-300">
            <Image
              src="/images/logo-session-master-transparent.png"
              alt="Session Master Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
        </Link>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-4 space-y-6">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-2 text-[10px] font-bold text-white/30 uppercase tracking-widest">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.href);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                        isActive
                          ? 'bg-white/15 text-white'
                          : 'text-white/60 hover:bg-white/8 hover:text-white/90'
                      )}
                      style={isActive ? {} : {}}
                    >
                      {/* Active bar */}
                      {isActive && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                          style={{ background: 'linear-gradient(135deg, #FFB81C, #FFE04A)' }}
                        />
                      )}
                      <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-gold-400' : 'text-white/50')} />
                      <span className="flex-1">{item.label}</span>
                      {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/30" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom section with sign out and version badge */}
      <div className="px-6 py-4 border-t border-white/10 space-y-4">
        {/* Sign Out Button */}
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-white/60 hover:bg-white/5 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span>Sign Out</span>
        </button>

        {/* Version Badge */}
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
            <span className="text-white/60 text-[9px] font-bold">SM</span>
          </div>
          <div>
            <p className="text-white/70 text-[11px] font-semibold leading-tight">Horus University — Egypt</p>
            <p className="text-white/35 text-[9px] mt-0.5">v2.0 · Session Master</p>
          </div>
        </div>
        <div className="mt-2.5 pt-2.5 border-t border-white/5">
          <p className="text-white/25 text-[8px] leading-relaxed">
            Designed &amp; Executed by<br />
            <span className="text-gold-400/60 font-semibold text-[9px]">Prof. Mahmoud Elkhoudary</span>
          </p>
        </div>
      </div>
    </aside>
    </>
  );
}
