'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { StaffingRatioRange } from '@/types/database.types';

interface StaffingRatiosEditorProps {
  ranges: StaffingRatioRange[];
  onChange: (ranges: StaffingRatioRange[]) => void;
  disabled?: boolean;
}

export function StaffingRatiosEditor({ ranges, onChange, disabled }: StaffingRatiosEditorProps) {
  const updateRange = (index: number, field: keyof StaffingRatioRange, value: number) => {
    const newRanges = [...ranges];
    newRanges[index] = { ...newRanges[index], [field]: value };
    onChange(newRanges);
  };

  const addRange = () => {
    const lastMax = ranges.length > 0 ? ranges[ranges.length - 1].max : 0;
    onChange([...ranges, { min: lastMax + 1, max: lastMax + 20, head_supervisors: 1, assistants: 1 }]);
  };

  const removeRange = (index: number) => {
    if (ranges.length <= 1) return;
    onChange(ranges.filter((_, i) => i !== index));
  };

  const formatRange = (min: number, max: number) => {
    if (max >= 9999) return `${min}+ students`;
    return `${min}-${max} students`;
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="grid grid-cols-12 gap-3 text-sm font-medium text-gray-700 pb-2 border-b">
        <div className="col-span-2">Min</div>
        <div className="col-span-2">Max</div>
        <div className="col-span-3">Exam Supervisors</div>
        <div className="col-span-3">Invigilators</div>
        <div className="col-span-2"></div>
      </div>

      {/* Rows */}
      {ranges.map((range, index) => (
        <div key={index} className="grid grid-cols-12 gap-3 items-center">
          <div className="col-span-2">
            <input
              type="number"
              value={range.min}
              onChange={(e) => updateRange(index, 'min', parseInt(e.target.value) || 0)}
              className="input w-full"
              min={0}
              disabled={disabled}
            />
          </div>
          <div className="col-span-2">
            <input
              type="number"
              value={range.max >= 9999 ? '' : range.max}
              onChange={(e) => updateRange(index, 'max', parseInt(e.target.value) || 9999)}
              className="input w-full"
              min={range.min}
              placeholder="∞"
              disabled={disabled}
            />
          </div>
          <div className="col-span-3">
            <input
              type="number"
              value={range.head_supervisors}
              onChange={(e) => updateRange(index, 'head_supervisors', parseInt(e.target.value) || 0)}
              className="input w-full"
              min={0}
              max={10}
              disabled={disabled}
            />
          </div>
          <div className="col-span-3">
            <input
              type="number"
              value={range.assistants}
              onChange={(e) => updateRange(index, 'assistants', parseInt(e.target.value) || 0)}
              className="input w-full"
              min={0}
              max={20}
              disabled={disabled}
            />
          </div>
          <div className="col-span-2">
            <button
              onClick={() => removeRange(index)}
              className="p-2 text-danger-600 hover:bg-danger-50 rounded-md transition-colors"
              disabled={disabled || ranges.length <= 1}
              title="Remove range"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      {/* Add Button */}
      <button
        onClick={addRange}
        className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 mt-2"
        disabled={disabled}
      >
        <Plus className="w-4 h-4" />
        Add Range
      </button>

      {/* Preview */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="text-xs font-medium text-gray-500 mb-2">Preview:</div>
        <div className="text-sm text-gray-700 space-y-1">
          {ranges.map((range, i) => (
            <div key={i}>
              {formatRange(range.min, range.max)}: {range.head_supervisors} exam supervisor(s) + {range.assistants} invigilator(s)
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

