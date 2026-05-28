'use client';

import { AlertTriangle, Check, Clock, CalendarDays, X, Plus } from 'lucide-react';
import type { SchedulingConstraintsConfig } from '@/types/database.types';
import { useState } from 'react';

interface ConstraintsEditorProps {
  config: SchedulingConstraintsConfig;
  onChange: (config: SchedulingConstraintsConfig) => void;
  disabled?: boolean;
}

export function ConstraintsEditor({ config, onChange, disabled }: ConstraintsEditorProps) {
  const [newUWD, setNewUWD] = useState<string>('');

  const updateConstraint = (key: keyof SchedulingConstraintsConfig, value: any) => {
    onChange({
      ...config,
      [key]: value,
    });
  };

  return (
    <div className="space-y-6">
      {/* Consecutive Shifts */}
      <label className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${!config.allow_consecutive_shifts ? 'border-primary-300 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
        <input
          type="checkbox"
          checked={!config.allow_consecutive_shifts}
          onChange={(e) => updateConstraint('allow_consecutive_shifts', !e.target.checked)}
          className="sr-only"
          disabled={disabled}
        />
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-3 mt-0.5 ${!config.allow_consecutive_shifts ? 'bg-primary-600 border-primary-600' : 'border-gray-300'
          }`}>
          {!config.allow_consecutive_shifts && <Check className="w-3 h-3 text-white" />}
        </div>
        <div className="flex-1">
          <div className="font-medium text-gray-900">Prevent Consecutive Shifts (Preferred)</div>
          <p className="text-sm text-gray-600 mt-1">
            The system will try to avoid assigning staff to both Period 1 and Period 2 on the same day.
            <br />
            <span className="text-xs italic opacity-80">(Note: This is a &quot;Soft Constraint&quot;. The system may override this if necessary to ensure all exams have supervisors.)</span>
          </p>
          {!config.allow_consecutive_shifts && (
            <div className="flex items-center gap-1 mt-2 text-xs text-primary-700">
              <Check className="w-3 h-3" />
              <span>Active - Minimizing consecutive shifts</span>
            </div>
          )}
        </div>
      </label>

      {/* Strict Role Enforcement */}
      <label className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${config.enforce_strict_roles ? 'border-primary-300 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
        <input
          type="checkbox"
          checked={config.enforce_strict_roles !== false} // Default to true if undefined
          onChange={(e) => updateConstraint('enforce_strict_roles', e.target.checked)}
          className="sr-only"
          disabled={disabled}
        />
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-3 mt-0.5 ${config.enforce_strict_roles !== false ? 'bg-primary-600 border-primary-600' : 'border-gray-300'
          }`}>
          {config.enforce_strict_roles !== false && <Check className="w-3 h-3 text-white" />}
        </div>
        <div className="flex-1">
          <div className="font-medium text-gray-900">Enforce Strict Role Matching</div>
          <p className="text-sm text-gray-600 mt-1">
            If enabled, only Teaching Assistants can be Exam Supervisors, and only Chemists/Demonstrators can be Invigilators.
            <br />
            <span className="text-xs italic opacity-80">(Uncheck this to allow &quot;Agile&quot; assignment where any staff can fill any role if preferred types are unavailable.)</span>
          </p>
          {config.enforce_strict_roles !== false && (
            <div className="flex items-center gap-1 mt-2 text-xs text-primary-700">
              <Check className="w-3 h-3" />
              <span>Active - Strict roles enforced</span>
            </div>
          )}
        </div>
      </label>

      {/* Ignore Working Days if Specific Dates Exist */}
      <label className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${config.ignore_working_days_if_specific_dates !== false ? 'border-primary-300 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
        <input
          type="checkbox"
          checked={config.ignore_working_days_if_specific_dates !== false}
          onChange={(e) => updateConstraint('ignore_working_days_if_specific_dates', e.target.checked)}
          className="sr-only"
          disabled={disabled}
        />
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-3 mt-0.5 ${config.ignore_working_days_if_specific_dates !== false ? 'bg-primary-600 border-primary-600' : 'border-gray-300'
          }`}>
          {config.ignore_working_days_if_specific_dates !== false && <Check className="w-3 h-3 text-white" />}
        </div>
        <div className="flex-1">
          <div className="font-medium text-gray-900">Assume Full Availability Outside Off-Dates</div>
          <p className="text-sm text-gray-600 mt-1">
            The system automatically classifies specific off-dates into two tiers:
          </p>
          <ul className="text-xs text-gray-600 mt-1 ml-3 list-disc space-y-0.5">
            <li><strong>Recurring non-working day</strong>: If a weekday (e.g. Friday) appears as off for <em>every</em> week during the exam period, it is treated as a permanent off-day — same as the working-days pattern.</li>
            <li><strong>Specific date off</strong>: If a weekday is off only <em>some</em> weeks or just once, only those exact dates are blocked.</li>
          </ul>
          <p className="text-xs italic text-gray-500 mt-2">
            This toggle controls whether the manual &quot;Working Days&quot; pattern is ignored when specific off-dates are present. When ON, the weekly working-days grid is bypassed and only the auto-classified rules above apply.
          </p>
          {config.ignore_working_days_if_specific_dates !== false && (
            <div className="flex items-center gap-1 mt-2 text-xs text-primary-700">
              <Check className="w-3 h-3" />
              <span>Active — smart off-day classification in effect</span>
            </div>
          )}
        </div>
      </label>

      {/* Max Working Hours Constraints */}
      <div className="p-4 border border-gray-200 rounded-lg space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-5 h-5 text-gray-500" />
          <div>
            <h4 className="font-medium text-gray-900">Maximum Weekly Hours</h4>
            <p className="text-sm text-gray-500">
              Set strict weekly hour limits for staff types. The system will warn or avoid assigning beyond these limits.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Full Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full-time Staff (Hours/Week)</label>
            <input
              type="number"
              value={config.max_hours_per_week_ft || 16}
              onChange={(e) => updateConstraint('max_hours_per_week_ft', parseInt(e.target.value) || 0)}
              className="input w-full"
              min={1}
              max={60}
              disabled={disabled}
            />
            <p className="text-xs text-gray-500 mt-1">Recommended: 12-16 hours</p>
          </div>

          {/* Part Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Part-time Staff (Hours/Week)</label>
            <input
              type="number"
              value={config.max_hours_per_week_pt || 8}
              onChange={(e) => updateConstraint('max_hours_per_week_pt', parseInt(e.target.value) || 0)}
              className="input w-full"
              min={1}
              max={40}
              disabled={disabled}
            />
            <p className="text-xs text-gray-500 mt-1">Recommended: 4-8 hours</p>
          </div>

          {/* Chemists */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chemists (Hours/Week)</label>
            <input
              type="number"
              value={config.max_hours_per_week_chemist || 20}
              onChange={(e) => updateConstraint('max_hours_per_week_chemist', parseInt(e.target.value) || 0)}
              className="input w-full"
              min={1}
              max={60}
              disabled={disabled}
            />
            <p className="text-xs text-gray-500 mt-1">Recommended: 16-20 hours</p>
          </div>
        </div>
      </div>

      {/* Lecturer Max Rooms Constraint */}
      <div className="p-4 border border-gray-200 rounded-lg space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-warning-500" />
          <div>
            <h4 className="font-medium text-gray-900">Lecturer Supervision Capacity</h4>
            <p className="text-sm text-gray-500">
              Set the maximum number of rooms a single Lecturer (acting as Exam Supervisor) can be responsible for simultaneously.
            </p>
          </div>
        </div>

        <div className="w-full md:w-1/2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Rooms per Lecturer</label>
          <input
            type="number"
            value={config.max_rooms_per_lecturer || 3}
            onChange={(e) => updateConstraint('max_rooms_per_lecturer', parseInt(e.target.value) || 0)}
            className="input w-full"
            min={1}
            max={10}
            disabled={disabled}
          />
          <p className="text-xs text-gray-500 mt-1">Recommended: 2-4 rooms</p>
        </div>
      </div>

      {/* Hard Workload Cap Constraint */}
      <div className="p-4 border border-gray-200 rounded-lg space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-indigo-500" />
          <div>
            <h4 className="font-medium text-gray-900">Hard Workload Caps (Fairness)</h4>
            <p className="text-sm text-gray-500">
              Prevent staff from exceeding a maximum difference compared to the average score. If the average score is 5 and the delta is 3, staff hitting 8 are temporarily locked out until others catch up.
            </p>
          </div>
        </div>

        <div className="w-full md:w-1/2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Delta from Average</label>
          <input
            type="number"
            value={config.max_score_delta_from_average ?? 3}
            onChange={(e) => updateConstraint('max_score_delta_from_average', parseInt(e.target.value) || 3)}
            className="input w-full"
            min={1}
            max={20}
            disabled={disabled}
          />
          <p className="text-xs text-gray-500 mt-1">Recommended: 2-4 points</p>
        </div>
      </div>

      {/* Summary */}
      <div className="p-3 bg-gray-50 rounded-lg mt-4">
        <div className="text-xs font-medium text-gray-500 mb-2">Current Policy Summary:</div>
        <ul className="text-sm text-gray-700 space-y-1">
          <li className="flex items-center gap-2">
            {!config.allow_consecutive_shifts ? (
              <Check className="w-4 h-4 text-success-600" />
            ) : (
              <span className="w-4 h-4 text-gray-400">•</span>
            )}
            {!config.allow_consecutive_shifts ? 'Minimizing consecutive shifts' : 'Consecutive shifts allowed freely'}
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-success-600" />
            <span>Full-time Cap: <strong>{config.max_hours_per_week_ft || 16}h</strong> / week</span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-success-600" />
            <span>Part-time Cap: <strong>{config.max_hours_per_week_pt || 8}h</strong> / week</span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-success-600" />
            <span>Chemist Cap: <strong>{config.max_hours_per_week_chemist || 20}h</strong> / week</span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-success-600" />
            <span>Strict Roles: <strong>{config.enforce_strict_roles !== false ? 'Enforced' : 'Flexible'}</strong></span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-success-600" />
            <span>Max Rooms per Lecturer: <strong>{config.max_rooms_per_lecturer || 3}</strong> rooms</span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-success-600" />
            <span>Hard Workload Cap: <strong>{config.max_score_delta_from_average ?? 3}</strong> points above average</span>
          </li>

        </ul>
      </div>
    </div>
  );
}
