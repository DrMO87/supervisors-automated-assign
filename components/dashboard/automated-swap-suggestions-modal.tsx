'use client';

import { useState, useEffect } from 'react';
import type { Staff, ExamSessionWithRelations, PeriodFreeStaff } from '@/types/database.types';
import { X, ArrowRightLeft, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useSchedulingStore } from '@/lib/stores/scheduling-store';

interface SwapSuggestion {
  staffId: string;
  staffName: string;
  fromOldDate: string;
  toNewDate: string;
}

interface AutomatedSwapSuggestionsModalProps {
  weekDates: string[];
  examSessions: ExamSessionWithRelations[];
  onClose: () => void;
}

export function AutomatedSwapSuggestionsModal({ weekDates, examSessions, onClose }: AutomatedSwapSuggestionsModalProps) {
  const { staff: allStaff, setStaff, periodFreeStaff } = useSchedulingStore();
  const [suggestions, setSuggestions] = useState<SwapSuggestion[]>([]);
  const [selectedSwaps, setSelectedSwaps] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    analyzeWorkload();
  }, [weekDates, examSessions, allStaff, periodFreeStaff]);

  const analyzeWorkload = () => {
    setIsAnalyzing(true);
    try {
      // 1. Calculate daily loads (student counts)
      const dailyLoads = weekDates.map(dateStr => {
        const sessions = examSessions.filter(s => s.exam_date === dateStr);
        const load = sessions.reduce((sum, s) => sum + s.student_count, 0);
        return { dateStr, load };
      });

      // 2. Determine average load to classify High vs Low load days
      const totalLoad = dailyLoads.reduce((sum, d) => sum + d.load, 0);
      const avgLoad = totalLoad / (dailyLoads.length || 1);
      
      const highLoadDays = dailyLoads.filter(d => d.load > avgLoad).sort((a, b) => b.load - a.load);
      const lowLoadDays = dailyLoads.filter(d => d.load <= avgLoad).sort((a, b) => a.load - b.load);

      const generatedSuggestions: SwapSuggestion[] = [];

      // 3. Find staff whose specific_off_dates fall on High Load days
      for (const staff of allStaff) {
        if (!staff.specific_off_dates || staff.specific_off_dates.length === 0) continue;
        
        for (const offDate of staff.specific_off_dates) {
          const isHighLoadOffDay = highLoadDays.some(d => d.dateStr === offDate);
          
          if (isHighLoadOffDay) {
            // 4. Find the best low load day for this staff where they have NO assignments and aren't already off
            let bestNewDate = null;

            for (const lowDay of lowLoadDays) {
              const newDate = lowDay.dateStr;
              
              // Ensure they aren't already off on this day
              if (staff.specific_off_dates.includes(newDate)) continue;

              // Ensure they have no Exam Session assignments on this day
              const hasExamAssignment = examSessions.some(s => 
                s.exam_date === newDate && 
                s.assignments?.some((a: any) => a.staff_id === staff.id)
              );
              
              // Ensure they have no PeriodFreeStaff reserve assignments on this day
              const hasReserveAssignment = periodFreeStaff.some((p: PeriodFreeStaff) => 
                p.exam_date === newDate && p.staff_id === staff.id
              );

              if (!hasExamAssignment && !hasReserveAssignment) {
                bestNewDate = newDate;
                break; // Found the lowest load day available!
              }
            }

            if (bestNewDate) {
              generatedSuggestions.push({
                staffId: staff.id,
                staffName: staff.name,
                fromOldDate: offDate,
                toNewDate: bestNewDate
              });
            }
          }
        }
      }

      setSuggestions(generatedSuggestions);
      // Select all by default
      setSelectedSwaps(new Set(generatedSuggestions.map(s => `${s.staffId}_${s.fromOldDate}_${s.toNewDate}`)));
    } catch (err: any) {
      setError('Failed to analyze workload: ' + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleSwap = (id: string) => {
    const newSelected = new Set(selectedSwaps);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedSwaps(newSelected);
  };

  const toggleAll = () => {
    if (selectedSwaps.size === suggestions.length) {
      setSelectedSwaps(new Set());
    } else {
      setSelectedSwaps(new Set(suggestions.map(s => `${s.staffId}_${s.fromOldDate}_${s.toNewDate}`)));
    }
  };

  const applySwaps = async () => {
    if (selectedSwaps.size === 0) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const selectedArr = Array.from(selectedSwaps);
      const updatesToMake = new Map<string, string[]>(); // staffId -> newOffDates[]

      // Initialize map with current specific_off_dates
      for (const staff of allStaff) {
        updatesToMake.set(staff.id, [...(staff.specific_off_dates || [])]);
      }

      // Apply the selected swaps
      for (const idStr of selectedArr) {
        const [staffId, fromOldDate, toNewDate] = idStr.split('_');
        let dates = updatesToMake.get(staffId) || [];
        
        // Remove old date
        dates = dates.filter(d => d !== fromOldDate);
        
        // Add new date
        if (!dates.includes(toNewDate)) {
          dates.push(toNewDate);
        }
        
        updatesToMake.set(staffId, dates);
      }

      // Execute updates
      const updatePromises = [];
      const updatedStaffList = [...allStaff];

      for (const idStr of selectedArr) {
        const [staffId] = idStr.split('_');
        const newDates = updatesToMake.get(staffId) || [];

        // Add promise
        updatePromises.push(
          supabase
            .from('staff')
            .update({ specific_off_dates: newDates })
            .eq('id', staffId)
        );

        // Update local list
        const idx = updatedStaffList.findIndex(s => s.id === staffId);
        if (idx !== -1) {
          updatedStaffList[idx] = { ...updatedStaffList[idx], specific_off_dates: newDates };
        }
      }

      const results = await Promise.all(updatePromises);
      
      const failed = results.find(r => r.error);
      if (failed) throw failed.error;

      // Update state
      setStaff(updatedStaffList);
      onClose();
      
      // Reload page to re-calculate UI grids and conflicts
      window.location.reload();

    } catch (err: any) {
      console.error('Failed to apply swaps:', err);
      setError(err.message || 'Failed to update off-days in the database.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg">
            <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
            Automated Off-Day Swaps
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <div className="mb-6">
            <p className="text-gray-600">
              The system has analyzed the exam workload for this week. It suggests swapping the following staff off-days from <strong>busy days</strong> to <strong>lighter days</strong> where they currently have no assignments.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
              <p>Analyzing schedule loads and staff availability...</p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
              <p className="text-lg font-medium text-gray-900">All Good!</p>
              <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">The current off-days are optimally placed. No staff members are taking an off-day on a heavy workload day that could be moved.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-sm font-medium text-gray-700">
                  {suggestions.length} suggestions found
                </span>
                <button 
                  onClick={toggleAll}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >
                  {selectedSwaps.size === suggestions.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="space-y-2">
                {suggestions.map((suggestion) => {
                  const id = `${suggestion.staffId}_${suggestion.fromOldDate}_${suggestion.toNewDate}`;
                  const isSelected = selectedSwaps.has(id);
                  const fromDateStr = new Date(suggestion.fromOldDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
                  const toDateStr = new Date(suggestion.toNewDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

                  return (
                    <div 
                      key={id} 
                      onClick={() => toggleSwap(id)}
                      className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
                        isSelected ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => {}} // handled by parent onClick
                        className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                      />
                      
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{suggestion.staffName}</div>
                        <div className="flex items-center gap-2 mt-1 text-sm">
                          <span className="px-2 py-1 bg-red-100 text-red-700 font-medium rounded text-xs whitespace-nowrap">
                            Cancel: {fromDateStr}
                          </span>
                          <ArrowRightLeft className="w-3 h-3 text-gray-400" />
                          <span className="px-2 py-1 bg-green-100 text-green-700 font-medium rounded text-xs whitespace-nowrap">
                            New Off-Day: {toDateStr}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
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
            onClick={applySwaps}
            disabled={isSubmitting || selectedSwaps.size === 0 || suggestions.length === 0}
            className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium flex items-center gap-2 disabled:opacity-50 shadow-sm"
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Applying...</>
            ) : (
              `Apply ${selectedSwaps.size} Swaps`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
