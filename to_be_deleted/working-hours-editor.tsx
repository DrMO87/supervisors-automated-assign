'use client';

import { Clock } from 'lucide-react';
import type { WorkingHoursConfig } from '@/types/database.types';

interface WorkingHoursEditorProps {
  config: WorkingHoursConfig;
  onChange: (config: WorkingHoursConfig) => void;
  disabled?: boolean;
}

export function WorkingHoursEditor({ config, onChange, disabled }: WorkingHoursEditorProps) {
  const updatePeriod = (period: 'period_1' | 'period_2' | 'period_3', field: 'start' | 'end', value: string) => {
    onChange({
      ...config,
      [period]: {
        ...config[period],
        [field]: value,
      },
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Period 1 */}
      <div className="p-4 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-primary-600" />
          <h4 className="font-medium text-gray-900">Period 1 (Morning)</h4>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Start Time</label>
            <input
              type="time"
              value={config.period_1.start}
              onChange={(e) => updatePeriod('period_1', 'start', e.target.value)}
              className="input w-full"
              disabled={disabled}
            />
          </div>
          <span className="text-gray-400 mt-5">to</span>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">End Time</label>
            <input
              type="time"
              value={config.period_1.end}
              onChange={(e) => updatePeriod('period_1', 'end', e.target.value)}
              className="input w-full"
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      {/* Period 2 */}
      <div className="p-4 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-warning-600" />
          <h4 className="font-medium text-gray-900">Period 2 (Afternoon)</h4>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Start Time</label>
            <input
              type="time"
              value={config.period_2.start}
              onChange={(e) => updatePeriod('period_2', 'start', e.target.value)}
              className="input w-full"
              disabled={disabled}
            />
          </div>
          <span className="text-gray-400 mt-5">to</span>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">End Time</label>
            <input
              type="time"
              value={config.period_2.end}
              onChange={(e) => updatePeriod('period_2', 'end', e.target.value)}
              className="input w-full"
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      {/* Period 3 */}
      <div className="p-4 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-purple-600" />
          <h4 className="font-medium text-gray-900">Period 3 (End of Day)</h4>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Start Time</label>
            <input
              type="time"
              value={config.period_3?.start || '15:45'}
              onChange={(e) => updatePeriod('period_3', 'start', e.target.value)}
              className="input w-full"
              disabled={disabled}
            />
          </div>
          <span className="text-gray-400 mt-5">to</span>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">End Time</label>
            <input
              type="time"
              value={config.period_3?.end || '16:00'}
              onChange={(e) => updatePeriod('period_3', 'end', e.target.value)}
              className="input w-full"
              disabled={disabled}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

