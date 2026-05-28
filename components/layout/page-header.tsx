'use client';

import { ReactNode, useState } from 'react';
import Image from 'next/image';
import { Undo2, Loader2 } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  badge?: ReactNode;
}

export function PageHeader({ title, description, actions, badge }: PageHeaderProps) {
  const [isUndoing, setIsUndoing] = useState(false);

  const handleUndo = async () => {
    if (!confirm('Are you sure you want to undo the last change? This will revert the database to its state before your last save or auto-assignment.')) return;
    setIsUndoing(true);
    try {
      const res = await fetch('/api/history/undo', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert('Undo successful! The page will now reload.');
      window.location.reload();
    } catch (e: any) {
      alert(e.message || 'Failed to undo');
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <div className="mb-8">
      <div className="flex items-start justify-between gap-6">
        {/* Left Side: Title, Description, and Actions */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight truncate">
              {title}
            </h1>
            {badge}
            <button
              onClick={handleUndo}
              disabled={isUndoing}
              title="Undo last change to the database"
              className="ml-4 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              {isUndoing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
              Undo
            </button>
          </div>
          {description && (
            <p className="text-sm text-slate-500 mb-1">{description}</p>
          )}
          {actions && (
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              {actions}
            </div>
          )}
        </div>
      </div>
      {/* Decorative rule */}
      <div className="mt-5 h-px bg-gradient-to-r from-primary-900/10 via-gold-500/30 to-transparent" />
    </div>
  );
}
