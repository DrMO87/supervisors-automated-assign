'use client';

import { useState } from 'react';
import { X, RefreshCcw, Loader2, AlertTriangle } from 'lucide-react';
import type { Staff } from '@/types/database.types';

interface BulkReplaceModalProps {
  staff: Staff;
  weekStart: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkReplaceModal({ staff, weekStart, onClose, onSuccess }: BulkReplaceModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReplace = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/assignments/bulk-replace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStaffId: staff.id,
          weekStart
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to replace assignments');

      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-red-50">
          <h3 className="font-bold text-red-900 flex items-center gap-2 text-lg">
            <RefreshCcw className="w-5 h-5 text-red-600" />
            Bulk Replace Staff
          </h3>
          <button onClick={onClose} className="p-1 text-red-400 hover:text-red-600 rounded-full hover:bg-red-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3 bg-red-100 rounded-full flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-gray-800 font-medium text-base mb-1">
                Replace all assignments for {staff.name}?
              </p>
              <p className="text-sm text-gray-600">
                This will instantly remove <strong>{staff.name}</strong> from all their scheduled rooms and reserve slots for this week. 
                The system will automatically find the best available replacements with the <strong>{staff.supervision_role}</strong> role who have the lowest workload scores, and assign them instead.
              </p>
              <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-md">
                <p className="text-xs text-orange-800">
                  <strong>Note:</strong> If no eligible replacement can be found for a specific slot, the assignment will simply be deleted so you can fill it manually later.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-white bg-transparent font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          
          <button 
            onClick={handleReplace}
            disabled={isSubmitting}
            className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium flex items-center gap-2 disabled:opacity-50 shadow-sm"
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Replacing...</>
            ) : (
              'Confirm Replace All'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
