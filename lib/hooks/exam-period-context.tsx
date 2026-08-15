'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ExamPeriod } from '@/types/database.types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

interface ExamPeriodContextType {
  activePeriod: ExamPeriod | null;
  allPeriods: ExamPeriod[];
  isLoading: boolean;
  refetchPeriod: () => Promise<void>;
  activatePeriod: (periodId: string) => Promise<boolean>;
  isDateInPeriod: (dateStr: string) => boolean;
}

const ExamPeriodContext = createContext<ExamPeriodContextType>({
  activePeriod: null,
  allPeriods: [],
  isLoading: true,
  refetchPeriod: async () => {},
  activatePeriod: async () => false,
  isDateInPeriod: () => true,
});

export function ExamPeriodProvider({ children }: { children: React.ReactNode }) {
  const [activePeriod, setActivePeriod] = useState<ExamPeriod | null>(null);
  const [allPeriods, setAllPeriods] = useState<ExamPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPeriods = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('exam_periods')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) {
        console.warn('Exam periods table query issue:', error.message);
        setIsLoading(false);
        return;
      }

      if (data) {
        setAllPeriods(data as ExamPeriod[]);
        const active = data.find(p => p.is_active);
        setActivePeriod((active as ExamPeriod) || null);
      }
    } catch (err) {
      console.error('Failed to fetch exam periods:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  const activatePeriod = async (periodId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/exam-periods/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_id: periodId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to activate period');
      }

      await fetchPeriods();
      return true;
    } catch (err) {
      console.error('Error activating period:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const isDateInPeriod = (dateStr: string): boolean => {
    if (!activePeriod) return true; // If no active period, all dates are accepted
    return dateStr >= activePeriod.start_date && dateStr <= activePeriod.end_date;
  };

  return (
    <ExamPeriodContext.Provider
      value={{
        activePeriod,
        allPeriods,
        isLoading,
        refetchPeriod: fetchPeriods,
        activatePeriod,
        isDateInPeriod,
      }}
    >
      {children}
    </ExamPeriodContext.Provider>
  );
}

export function useExamPeriod() {
  return useContext(ExamPeriodContext);
}
