'use client';

import { useState } from 'react';
import { Plus, Trash2, Calendar } from 'lucide-react';
import type { StaffingRatioOverride, StaffingRatioRange } from '@/types/database.types';
import { StaffingRatiosEditor } from '@/components/settings/staffing-ratios-editor';

interface StaffingRatioOverridesEditorProps {
  overrides: StaffingRatioOverride[];
  onChange: (overrides: StaffingRatioOverride[]) => void;
  disabled?: boolean;
}

export function StaffingRatioOverridesEditor({ overrides, onChange, disabled }: StaffingRatioOverridesEditorProps) {
  const [newDate, setNewDate] = useState('');

  const addOverride = () => {
    if (!newDate) {
      alert("Please select a date first.");
      return;
    }
    
    if (overrides.some(o => o.date === newDate)) {
      alert("An override for this date already exists.");
      return;
    }

    const defaultRanges: StaffingRatioRange[] = [
      { min: 1, max: 9, head_supervisors: 1, assistants: 0 },
      { min: 10, max: 40, head_supervisors: 1, assistants: 1 },
      { min: 41, max: 60, head_supervisors: 1, assistants: 2 },
      { min: 61, max: 9999, head_supervisors: 1, assistants: 3 },
    ];

    onChange([...overrides, { date: newDate, ranges: defaultRanges }]);
    setNewDate('');
  };

  const removeOverride = (index: number) => {
    if (!confirm('Remove the override for this date?')) return;
    onChange(overrides.filter((_, i) => i !== index));
  };

  const updateOverrideRanges = (index: number, newRanges: StaffingRatioRange[]) => {
    const newOverrides = [...overrides];
    newOverrides[index] = { ...newOverrides[index], ranges: newRanges };
    onChange(newOverrides);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        {overrides.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No date-specific overrides configured.</p>
        ) : (
          overrides.map((override, index) => (
            <div key={override.date} className="border border-indigo-100 rounded-lg overflow-hidden bg-white shadow-sm">
              <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-900 font-semibold">
                  <Calendar className="w-4 h-4" />
                  Date: {new Date(override.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
                <button
                  onClick={() => removeOverride(index)}
                  className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-colors"
                  disabled={disabled}
                  title="Remove override for this date"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4">
                <StaffingRatiosEditor 
                  ranges={override.ranges} 
                  onChange={(newRanges) => updateOverrideRanges(index, newRanges)} 
                  disabled={disabled} 
                />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-end gap-3 mt-4 pt-4 border-t">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Add Override For Date</label>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="input w-48"
            disabled={disabled}
          />
        </div>
        <button
          onClick={addOverride}
          disabled={disabled || !newDate}
          className="btn btn-secondary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Date Override
        </button>
      </div>
    </div>
  );
}
