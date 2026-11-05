'use client';

import React from 'react';
import { usePresence } from '@/lib/hooks/use-presence';
import { Globe, Users } from 'lucide-react';

interface OnlineBadgeProps {
  variant?: 'compact' | 'detailed' | 'sidebar';
  className?: string;
}

export function OnlineBadge({ variant = 'compact', className = '' }: OnlineBadgeProps) {
  const { uniqueAddressesCount, onlineCount, setIsModalOpen } = usePresence();

  if (variant === 'sidebar') {
    return (
      <button
        onClick={() => setIsModalOpen(true)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-left group shadow-xs ${className}`}
        title="Click to view all online users, roles, and IP addresses"
      >
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white group-hover:text-gold-400 transition-colors">
                {uniqueAddressesCount} {uniqueAddressesCount === 1 ? 'Address' : 'Addresses'} Online
              </span>
            </div>
            <p className="text-[10px] text-white/50 leading-tight">
              {onlineCount} active {onlineCount === 1 ? 'session' : 'sessions'} · View roles
            </p>
          </div>
        </div>
        <Globe className="w-3.5 h-3.5 text-white/40 group-hover:text-gold-400 transition-colors" />
      </button>
    );
  }

  if (variant === 'detailed') {
    return (
      <button
        onClick={() => setIsModalOpen(true)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 transition-colors shadow-xs ${className}`}
        title="Click to inspect all connected users and IP addresses"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-xs font-semibold">
          {uniqueAddressesCount} {uniqueAddressesCount === 1 ? 'IP' : 'IPs'} Online ({onlineCount} Active)
        </span>
      </button>
    );
  }

  // Default compact variant for PageHeader
  return (
    <button
      onClick={() => setIsModalOpen(true)}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-all shadow-xs cursor-pointer ${className}`}
      title="Click to see online users and roles"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      <span className="text-xs font-bold tracking-tight">
        {uniqueAddressesCount} {uniqueAddressesCount === 1 ? 'Address' : 'Addresses'} Active
      </span>
    </button>
  );
}
