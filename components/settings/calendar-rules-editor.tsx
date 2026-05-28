'use client';

import { useState } from 'react';
import { Plus, Trash2, Calendar, Settings2, CalendarDays, Check, CheckSquare, Square } from 'lucide-react';
import type { CalendarRule, StaffingRatioRange } from '@/types/database.types';
import { StaffingRatiosEditor } from '@/components/settings/staffing-ratios-editor';

interface CalendarRulesEditorProps {
  rules: CalendarRule[];
  onChange: (rules: CalendarRule[]) => void;
  disabled?: boolean;
}

export function CalendarRulesEditor({ rules, onChange, disabled }: CalendarRulesEditorProps) {
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const addRule = () => {
    if (!newStartDate) {
      alert("Please select a start date.");
      return;
    }
    
    const end = newEndDate || newStartDate;
    if (end < newStartDate) {
      alert("End date must be after start date.");
      return;
    }

    const defaultRanges: StaffingRatioRange[] = [
      { min: 1, max: 9, head_supervisors: 1, assistants: 0 },
      { min: 10, max: 40, head_supervisors: 1, assistants: 1 },
      { min: 41, max: 60, head_supervisors: 1, assistants: 2 },
      { min: 61, max: 9999, head_supervisors: 1, assistants: 3 },
    ];

    const newRule: CalendarRule = {
      id: crypto.randomUUID(),
      start_date: newStartDate,
      end_date: end,
      description: newDesc || `Rule for ${newStartDate}`,
      is_universal_working_day: false,
      apply_staffing_ratios: false,
      staffing_ratios: defaultRanges
    };

    onChange([...rules, newRule]);
    setNewStartDate('');
    setNewEndDate('');
    setNewDesc('');
  };

  const removeRule = (id: string) => {
    if (!confirm('Remove this calendar rule?')) return;
    onChange(rules.filter(r => r.id !== id));
  };

  const updateRule = (id: string, updates: Partial<CalendarRule>) => {
    onChange(rules.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        {rules.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No calendar rules configured.</p>
        ) : (
          rules.map((rule) => (
            <div key={rule.id} className="border border-indigo-100 rounded-lg overflow-hidden bg-white shadow-sm">
              <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 text-indigo-900 font-semibold mb-1">
                    <Calendar className="w-4 h-4" />
                    {rule.description}
                  </div>
                  <div className="text-sm text-indigo-700">
                    {rule.start_date === rule.end_date 
                      ? new Date(rule.start_date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
                      : `${new Date(rule.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${new Date(rule.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
                    }
                  </div>
                </div>
                <button
                  onClick={() => removeRule(rule.id)}
                  className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-colors"
                  disabled={disabled}
                  title="Remove rule"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Toggles */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <button 
                    type="button"
                    disabled={disabled}
                    onClick={() => updateRule(rule.id, { is_universal_working_day: !rule.is_universal_working_day })}
                    className={`flex-1 flex items-start p-3 border rounded-lg transition-colors text-left ${rule.is_universal_working_day ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div className="mt-0.5 mr-3 text-indigo-600">
                      {rule.is_universal_working_day ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-gray-400" />}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Universal Working Day</div>
                      <div className="text-xs text-gray-500 mt-1">Force all staff to be available (ignores normal days off). Great for filling low-workload days.</div>
                    </div>
                  </button>

                  <button 
                    type="button"
                    disabled={disabled}
                    onClick={() => updateRule(rule.id, { apply_staffing_ratios: !rule.apply_staffing_ratios })}
                    className={`flex-1 flex items-start p-3 border rounded-lg transition-colors text-left ${rule.apply_staffing_ratios ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div className="mt-0.5 mr-3 text-indigo-600">
                      {rule.apply_staffing_ratios ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-gray-400" />}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Custom Staffing Ratios</div>
                      <div className="text-xs text-gray-500 mt-1">Override the default required staff ratios for exams during this date range.</div>
                    </div>
                  </button>
                </div>

                {/* Conditional Ratios Editor */}
                {rule.apply_staffing_ratios && (
                  <div className="pt-4 border-t border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Settings2 className="w-4 h-4" /> Adjust Staffing Ratios for this Rule
                    </h4>
                    <StaffingRatiosEditor 
                      ranges={rule.staffing_ratios || []} 
                      onChange={(newRanges) => updateRule(rule.id, { staffing_ratios: newRanges })} 
                      disabled={disabled} 
                    />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-indigo-500" /> Create New Rule
        </h4>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-auto flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">Description (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Finals Week"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="input w-full"
              disabled={disabled}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
              className="input w-40"
              disabled={disabled}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">End Date (Optional)</label>
            <input
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              className="input w-40"
              disabled={disabled}
              min={newStartDate}
            />
          </div>
          <button
            onClick={addRule}
            disabled={disabled || !newStartDate}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Rule
          </button>
        </div>
      </div>
    </div>
  );
}
