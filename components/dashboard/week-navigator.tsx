'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays } from 'date-fns';

interface WeekNavigatorProps {
  currentWeekStart: Date;
  onPrevious: () => void;
  onNext: () => void;
}

export function WeekNavigator({
  currentWeekStart,
  onPrevious,
  onNext,
}: WeekNavigatorProps) {
  const weekEnd = addDays(currentWeekStart, 5);

  return (
    <div className="flex items-center justify-between bg-white rounded-lg shadow-sm p-4">
      <button
        onClick={onPrevious}
        className="btn btn-secondary px-3 py-2"
        aria-label="Previous week"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900">
          {format(currentWeekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
        </h2>
        <p className="text-sm text-gray-500">Week View</p>
      </div>

      <button
        onClick={onNext}
        className="btn btn-secondary px-3 py-2"
        aria-label="Next week"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}

