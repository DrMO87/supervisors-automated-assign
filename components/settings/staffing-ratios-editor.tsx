'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Users, ShieldCheck, UserCheck, Sparkles, AlertCircle, RotateCcw } from 'lucide-react';
import type { StaffingRatioRange } from '@/types/database.types';
import { ClassroomSimulatorVisual } from './settings-visuals';

interface StaffingRatiosEditorProps {
  ranges: StaffingRatioRange[];
  onChange: (ranges: StaffingRatioRange[]) => void;
  disabled?: boolean;
}

const STANDARD_HUE_PRESET: StaffingRatioRange[] = [
  { min: 1, max: 9, head_supervisors: 1, assistants: 0 },
  { min: 10, max: 30, head_supervisors: 1, assistants: 1 },
  { min: 31, max: 50, head_supervisors: 1, assistants: 2 },
  { min: 51, max: 60, head_supervisors: 1, assistants: 3 },
  { min: 61, max: 9999, head_supervisors: 1, assistants: 4 },
];

export function StaffingRatiosEditor({ ranges, onChange, disabled }: StaffingRatiosEditorProps) {
  const updateRange = (index: number, field: keyof StaffingRatioRange, value: number) => {
    const newRanges = [...ranges];
    newRanges[index] = { ...newRanges[index], [field]: value };
    onChange(newRanges);
  };

  const addRange = () => {
    const lastRange = ranges.length > 0 ? ranges[ranges.length - 1] : null;
    const lastMax = lastRange && lastRange.max < 9999 ? lastRange.max : 60;
    const newMin = lastMax + 1;
    const newMax = newMin + 20;

    // Adjust previous max if it was infinite
    const adjustedRanges = ranges.map((r, i) => {
      if (i === ranges.length - 1 && r.max >= 9999) {
        return { ...r, max: lastMax };
      }
      return r;
    });

    onChange([
      ...adjustedRanges,
      { min: newMin, max: 9999, head_supervisors: 1, assistants: (lastRange?.assistants || 3) + 1 },
    ]);
  };

  const removeRange = (index: number) => {
    if (ranges.length <= 1) return;
    onChange(ranges.filter((_, i) => i !== index));
  };

  const applyPreset = () => {
    if (confirm('Reset to HUE Standard Staffing Ratio Tiers?')) {
      onChange(STANDARD_HUE_PRESET);
    }
  };

  const formatRange = (min: number, max: number) => {
    if (max >= 9999) return `${min}+ students`;
    return `${min} – ${max} students`;
  };

  return (
    <div className="space-y-6">
      {/* ── 1. Interactive Classroom Visualizer ── */}
      <ClassroomSimulatorVisual ranges={ranges} />

      {/* ── 2. Staffing Ratios Configuration Table ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-600" />
              Room Capacity Tier Brackets
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Define the exact head supervisor and invigilator headcount required for each student enrollment bracket.
            </p>
          </div>
          <button
            type="button"
            onClick={applyPreset}
            disabled={disabled}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            Reset to HUE Preset
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Header Row */}
          <div className="hidden md:grid md:grid-cols-12 gap-3 text-xs font-bold text-slate-600 uppercase tracking-wider pb-2 border-b border-slate-200 px-2">
            <div className="col-span-3">Student Bracket</div>
            <div className="col-span-3">Min &amp; Max Students</div>
            <div className="col-span-2 text-center">Head Supervisors</div>
            <div className="col-span-2 text-center">Invigilators</div>
            <div className="col-span-1 text-center">Total Staff</div>
            <div className="col-span-1 text-right">Action</div>
          </div>

          {/* Tier Cards / Rows */}
          {ranges.map((range, index) => {
            const isInfinite = range.max >= 9999;
            const totalStaff = range.head_supervisors + range.assistants;

            return (
              <div
                key={index}
                className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center p-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white transition-all shadow-xs"
              >
                {/* Visual Label Column */}
                <div className="md:col-span-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-800 font-bold text-xs flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Tier {index + 1}: {formatRange(range.min, range.max)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {isInfinite ? 'Large Exam Halls & Auditoriums' : range.min <= 10 ? 'Small Seminar Rooms' : 'Standard Examination Hall'}
                    </div>
                  </div>
                </div>

                {/* Min & Max Inputs */}
                <div className="md:col-span-3 flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-semibold text-slate-500 block mb-0.5 md:hidden">Min Students</label>
                    <input
                      type="number"
                      value={range.min}
                      onChange={(e) => updateRange(index, 'min', Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="input w-full text-center text-xs font-bold"
                      min={0}
                      disabled={disabled}
                      placeholder="Min"
                    />
                  </div>
                  <span className="text-slate-400 font-bold text-xs">–</span>
                  <div className="flex-1">
                    <label className="text-[10px] font-semibold text-slate-500 block mb-0.5 md:hidden">Max Students</label>
                    <input
                      type="number"
                      value={isInfinite ? '' : range.max}
                      onChange={(e) => updateRange(index, 'max', parseInt(e.target.value, 10) || 9999)}
                      className="input w-full text-center text-xs font-bold"
                      min={range.min}
                      placeholder="∞ (Unlimited)"
                      disabled={disabled}
                    />
                  </div>
                </div>

                {/* Head Supervisors Input */}
                <div className="md:col-span-2">
                  <label className="text-[10px] font-semibold text-slate-500 block mb-0.5 md:hidden">Exam Supervisors</label>
                  <div className="flex items-center gap-1.5 justify-center bg-primary-50/60 border border-primary-200/80 rounded-lg p-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary-700 flex-shrink-0" />
                    <input
                      type="number"
                      value={range.head_supervisors}
                      onChange={(e) => updateRange(index, 'head_supervisors', Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="input w-16 text-center text-xs font-bold bg-white h-7 py-0"
                      min={0}
                      max={10}
                      disabled={disabled}
                    />
                  </div>
                </div>

                {/* Invigilators / Assistants Input */}
                <div className="md:col-span-2">
                  <label className="text-[10px] font-semibold text-slate-500 block mb-0.5 md:hidden">Invigilators</label>
                  <div className="flex items-center gap-1.5 justify-center bg-amber-50/60 border border-amber-200/80 rounded-lg p-1">
                    <UserCheck className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
                    <input
                      type="number"
                      value={range.assistants}
                      onChange={(e) => updateRange(index, 'assistants', Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="input w-16 text-center text-xs font-bold bg-white h-7 py-0"
                      min={0}
                      max={20}
                      disabled={disabled}
                    />
                  </div>
                </div>

                {/* Total Staff Pill */}
                <div className="md:col-span-1 text-center">
                  <span className="inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                    {totalStaff} staff
                  </span>
                </div>

                {/* Actions */}
                <div className="md:col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeRange(index)}
                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    disabled={disabled || ranges.length <= 1}
                    title={ranges.length <= 1 ? 'At least one tier bracket must exist' : 'Delete this tier'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer with Add Button & Status */}
        <div className="p-4 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={addRange}
            disabled={disabled}
            className="btn btn-secondary text-xs flex items-center gap-2 border-dashed border-primary-300 text-primary-700 hover:bg-primary-50/50 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Add New Bracket Tier
          </button>

          <span className="text-xs text-slate-500">
            Current configuration spans <strong>{ranges.length} capacity tiers</strong>.
          </span>
        </div>
      </div>
    </div>
  );
}
