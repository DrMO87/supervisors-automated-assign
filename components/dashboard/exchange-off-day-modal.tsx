'use client';

import { useState } from 'react';
import type { Staff, ExamSessionWithRelations } from '@/types/database.types';
import { X, ArrowRightLeft, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useSchedulingStore } from '@/lib/stores/scheduling-store';

interface ExchangeOffDayModalProps {
  staff: Staff;
  oldDate: string; // The date they are currently off (ISO)
  weekDates: string[]; // The 6 working dates of the week
  onClose: () => void;
  examSessions: ExamSessionWithRelations[];
}

export function ExchangeOffDayModal({ staff, oldDate, weekDates, onClose, examSessions }: ExchangeOffDayModalProps) {
  const { staff: allStaff, setStaff, periodFreeStaff } = useSchedulingStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate daily load (total students per day)
  const dailyLoads = weekDates.map(dateStr => {
    const sessions = examSessions.filter(s => s.exam_date === dateStr);
    const load = sessions.reduce((sum, s) => sum + s.student_count, 0);
    const sessionAssignments = sessions.filter(s => s.assignments?.some(a => a.staff_id === staff.id)).length;
    const reserveAssignments = periodFreeStaff.filter(p => p.exam_date === dateStr && p.staff_id === staff.id).length;
    const staffAssignedCount = sessionAssignments + reserveAssignments;
    return { dateStr, load, sessionCount: sessions.length, staffAssignedCount };
  });

  const maxLoad = Math.max(...dailyLoads.map(d => d.load), 1); // Avoid div by 0
  
  // Find recommended replacement day (lowest load, not already an off-day, and not the old date)
  const candidates = dailyLoads.filter(d => d.dateStr !== oldDate && !(staff.specific_off_dates || []).includes(d.dateStr));
  const minLoadCandidate = candidates.reduce((min, curr) => curr.load < min.load ? curr : min, candidates[0]);

  const [selectedNewDate, setSelectedNewDate] = useState<string | null>(minLoadCandidate?.dateStr || null);

  const handleExchange = async () => {
    if (!selectedNewDate) return;
    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Remove oldDate, add selectedNewDate
      const currentOffDates = staff.specific_off_dates || [];
      const newOffDates = currentOffDates.filter(d => d !== oldDate);
      if (!newOffDates.includes(selectedNewDate)) {
        newOffDates.push(selectedNewDate);
      }
      
      const { error: updateError } = await supabase
        .from('staff')
        .update({ specific_off_dates: newOffDates })
        .eq('id', staff.id);

      if (updateError) throw updateError;

      // 2. Update local state
      const updatedStaffList = allStaff.map(s => 
        s.id === staff.id ? { ...s, specific_off_dates: newOffDates } : s
      );
      setStaff(updatedStaffList);

      onClose();
      // Reload page to ensure all scores, conflicts, and schedules strictly match the database
      window.location.reload();
    } catch (err: any) {
      console.error('Failed to exchange off-day:', err);
      setError(err.message || 'Failed to update off-day in database.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-primary-500" />
            Exchange Off-Day
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <p className="text-sm text-gray-600 mb-4">
            You are canceling the off-day for <strong>{staff.name}</strong> on <strong className="text-red-600">{new Date(oldDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</strong>.
            Select a replacement day based on the daily exam load below.
          </p>

          {error && (
            <div className="mb-4 p-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded">
              {error}
            </div>
          )}

          <div className="space-y-3">
            {dailyLoads.map((dayData) => {
              const dateObj = new Date(dayData.dateStr);
              const dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'short' });
              const dateLabel = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
              
              const isOldDate = dayData.dateStr === oldDate;
              const isAlreadyOff = !isOldDate && (staff.specific_off_dates || []).includes(dayData.dateStr);
              const isSelected = selectedNewDate === dayData.dateStr;
              const isRecommended = minLoadCandidate?.dateStr === dayData.dateStr;
              
              return (
                <div 
                  key={dayData.dateStr}
                  onClick={() => !isOldDate && !isAlreadyOff && setSelectedNewDate(dayData.dateStr)}
                  className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${
                    isOldDate ? 'bg-red-50 border-red-200 opacity-50 cursor-not-allowed' :
                    isAlreadyOff ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed' :
                    isSelected ? 'bg-primary-50 border-primary-500 ring-1 ring-primary-500 cursor-pointer' :
                    'bg-white border-gray-200 hover:border-primary-300 cursor-pointer'
                  }`}
                >
                  <div className="w-20 shrink-0">
                    <div className="text-xs font-bold text-gray-500 uppercase">{dayName}</div>
                    <div className="text-sm font-semibold text-gray-900">{dateLabel}</div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600 font-medium">Load: {dayData.sessionCount} exams</span>
                      <span className="text-gray-400">{dayData.load} students</span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${isSelected ? 'bg-primary-500' : isRecommended ? 'bg-green-500' : 'bg-gray-400'}`} 
                        style={{ width: `${(dayData.load / maxLoad) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="w-24 shrink-0 flex flex-col items-end gap-1">
                    {isOldDate ? (
                      <span className="text-xs font-bold text-red-500">Removing</span>
                    ) : isAlreadyOff ? (
                      <span className="text-xs font-medium text-gray-400">Already Off</span>
                    ) : isSelected ? (
                      <span className="text-xs font-bold text-primary-600 bg-primary-100 px-2 py-1 rounded-full">Selected</span>
                    ) : isRecommended ? (
                      <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full border border-green-200 uppercase tracking-wide">Recommended</span>
                    ) : (
                      <span className="text-xs font-medium text-gray-400">Available</span>
                    )}

                    {!isOldDate && !isAlreadyOff && dayData.staffAssignedCount > 0 && (
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-1" title="Swapping to this day will create a conflict because they are already assigned to exams here.">
                        <AlertCircle className="w-2.5 h-2.5" /> {dayData.staffAssignedCount} Assigned
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExchange}
            disabled={!selectedNewDate || isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? 'Swapping...' : 'Confirm Swap'}
          </button>
        </div>
      </div>
    </div>
  );
}
