'use client';

import React, { useState } from 'react';
import { 
  Plus, Trash2, Calendar, Settings2, CalendarDays, Check, 
  CheckSquare, Square, Zap, Info, ArrowRight, Sparkles, AlertCircle 
} from 'lucide-react';
import type { CalendarRule, StaffingRatioRange } from '@/types/database.types';
import { StaffingRatiosEditor } from '@/components/settings/staffing-ratios-editor';
import { CalendarRuleVisualSvg } from './settings-svg-illustrations';

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
      alert('Please select a start date.');
      return;
    }

    const end = newEndDate || newStartDate;
    if (end < newStartDate) {
      alert('End date must be after start date.');
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
      description: newDesc.trim() || `Special Exam Rule (${newStartDate})`,
      is_universal_working_day: false,
      apply_staffing_ratios: false,
      staffing_ratios: defaultRanges,
    };

    onChange([...rules, newRule]);
    setNewStartDate('');
    setNewEndDate('');
    setNewDesc('');
  };

  const removeRule = (id: string) => {
    if (!confirm('Remove this calendar rule?')) return;
    onChange(rules.filter((r) => r.id !== id));
  };

  const updateRule = (id: string, updates: Partial<CalendarRule>) => {
    onChange(rules.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const formatDateRange = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    if (start === end) {
      return s.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }
    return `${s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const calculateDays = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const diffTime = Math.abs(e.getTime() - s.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays === 1 ? 'Single Day' : `${diffDays} Days Window`;
  };

  return (
    <div className="space-y-6">
      {/* ── Visual Rules List ── */}
      <div className="space-y-4">
        {rules.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800">No Calendar Rules Configured</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
              Calendar rules allow defining special high-intensity exam periods where regular staff days-off are universally suspended, or where customized hall staffing ratios apply.
            </p>
          </div>
        ) : (
          rules.map((rule) => {
            return (
              <div
                key={rule.id}
                className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm hover:border-indigo-300 transition-all"
              >
                {/* Rule Header */}
                <div className="bg-gradient-to-r from-indigo-50/90 via-white to-slate-50 px-6 py-4 border-b border-indigo-100 flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <span className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-xs flex-shrink-0">
                      <Calendar className="w-5 h-5" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h4 className="font-display font-extrabold text-slate-900 text-base">{rule.description}</h4>
                        <span className="text-xs font-extrabold px-3 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                          {calculateDays(rule.start_date, rule.end_date)}
                        </span>
                      </div>
                      <div className="text-sm text-indigo-900 font-semibold mt-0.5">
                        {formatDateRange(rule.start_date, rule.end_date)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => removeRule(rule.id)}
                      className="text-slate-400 hover:text-red-600 p-2.5 rounded-xl hover:bg-red-50 transition-colors"
                      disabled={disabled}
                      title="Remove rule"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Rule Body */}
                <div className="p-6 space-y-5">
                  {/* Visual Option Toggles */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Universal Working Day Toggle */}
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => updateRule(rule.id, { is_universal_working_day: !rule.is_universal_working_day })}
                      className={`p-4 sm:p-5 rounded-2xl border-2 transition-all text-left flex items-start gap-3.5 ${
                        rule.is_universal_working_day
                          ? 'border-indigo-600 bg-indigo-50/70 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="mt-0.5 text-indigo-600 flex-shrink-0">
                        {rule.is_universal_working_day ? (
                          <CheckSquare className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                          <span>Universal Working Day</span>
                          {rule.is_universal_working_day && (
                            <span className="text-xs font-extrabold bg-indigo-600 text-white px-2 py-0.5 rounded">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed font-normal">
                          Overrides and suspends normal weekly days off during this window. Staff become available for full exam roster allocation.
                        </p>
                      </div>
                    </button>

                    {/* Custom Staffing Ratios Toggle */}
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => updateRule(rule.id, { apply_staffing_ratios: !rule.apply_staffing_ratios })}
                      className={`p-4 sm:p-5 rounded-2xl border-2 transition-all text-left flex items-start gap-3.5 ${
                        rule.apply_staffing_ratios
                          ? 'border-indigo-600 bg-indigo-50/70 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="mt-0.5 text-indigo-600 flex-shrink-0">
                        {rule.apply_staffing_ratios ? (
                          <CheckSquare className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                          <span>Custom Staffing Ratios Override</span>
                          {rule.apply_staffing_ratios && (
                            <span className="text-xs font-extrabold bg-indigo-600 text-white px-2 py-0.5 rounded">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed font-normal">
                          Replaces standard university staffing ratios with custom ratios specific to this date range (e.g. Higher supervision for final exams).
                        </p>
                      </div>
                    </button>
                  </div>

                  {/* Bespoke SVG Timeline for this Rule */}
                  <CalendarRuleVisualSvg
                    startDate={rule.start_date}
                    endDate={rule.end_date}
                    isUniversalWorkingDay={rule.is_universal_working_day}
                    applyCustomRatios={rule.apply_staffing_ratios}
                  />

                  {/* Nested Custom Ratio Editor if enabled */}
                  {rule.apply_staffing_ratios && (
                    <div className="pt-5 border-t border-slate-100">
                      <div className="flex items-center gap-2 mb-4">
                        <Settings2 className="w-5 h-5 text-indigo-600" />
                        <h5 className="font-extrabold text-sm text-slate-900">
                          Custom Staffing Ratios for &ldquo;{rule.description}&rdquo;
                        </h5>
                      </div>
                      <StaffingRatiosEditor
                        ranges={rule.staffing_ratios || []}
                        onChange={(newRanges) => updateRule(rule.id, { staffing_ratios: newRanges })}
                        disabled={disabled}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Create New Rule Panel ── */}
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xs">
        <div className="flex items-center gap-3 mb-4">
          <span className="p-2 rounded-xl bg-indigo-100 text-indigo-700 shadow-2xs">
            <Plus className="w-5 h-5" />
          </span>
          <h4 className="font-display font-extrabold text-base text-slate-900">
            Define New Calendar Rule / Exception
          </h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
          <div className="sm:col-span-5">
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
              Rule Title / Label
            </label>
            <input
              type="text"
              placeholder="e.g. Fall 2026 Finals Week, High Stakes Exam Period"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="input w-full h-11 bg-white text-sm font-semibold rounded-xl border-slate-300"
              disabled={disabled}
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
              Start Date
            </label>
            <input
              type="date"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
              className="input w-full h-11 bg-white text-sm font-semibold rounded-xl border-slate-300"
              disabled={disabled}
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
              End Date (Inclusive)
            </label>
            <input
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              className="input w-full h-11 bg-white text-sm font-semibold rounded-xl border-slate-300"
              disabled={disabled}
              min={newStartDate}
            />
          </div>

          <div className="sm:col-span-1">
            <button
              type="button"
              onClick={addRule}
              disabled={disabled || !newStartDate}
              className="btn btn-primary h-11 w-full text-sm font-extrabold rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
              title="Add Calendar Rule"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>
        </div>

        <div className="mt-3.5 flex items-center gap-2 text-xs text-slate-500 font-medium">
          <Info className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          <span>If End Date is left blank, the rule applies to the single selected Start Date.</span>
        </div>
      </div>
    </div>
  );
}
