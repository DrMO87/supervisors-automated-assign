'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Save, RotateCcw, Loader2, CheckCircle, Users, Clock, Settings2, Calendar } from 'lucide-react';
import { supabase, isSupabaseConfigured, getSupabaseConfigStatus } from '@/lib/supabase/client';
import type { StaffingRatioRange, WorkingHoursConfig, SchedulingConstraintsConfig } from '@/types/database.types';
import { SetupRequired } from '@/components/setup-required';
import { StaffingRatiosEditor } from '@/components/settings/staffing-ratios-editor';
import { CalendarRulesEditor } from '@/components/settings/calendar-rules-editor';
import { ConstraintsEditor } from '@/components/settings/constraints-editor';

// Default values
const DEFAULT_STAFFING_RATIOS: StaffingRatioRange[] = [
  { min: 1, max: 9, head_supervisors: 1, assistants: 0 },
  { min: 10, max: 30, head_supervisors: 1, assistants: 1 },
  { min: 31, max: 50, head_supervisors: 1, assistants: 2 },
  { min: 51, max: 60, head_supervisors: 1, assistants: 3 },
  { min: 61, max: 9999, head_supervisors: 1, assistants: 4 },
];



const DEFAULT_CONSTRAINTS: SchedulingConstraintsConfig = {
  allow_consecutive_shifts: false,
  max_hours_per_week_ft: 16,
  max_hours_per_week_pt: 8,
  max_hours_per_week_chemist: 20,
  enforce_strict_roles: true,
  max_rooms_per_lecturer: 3,
  ignore_working_days_if_specific_dates: true,
  max_score_delta_from_average: 3,
};

export default function SettingsPage() {
  const [staffingRatios, setStaffingRatios] = useState<StaffingRatioRange[]>(DEFAULT_STAFFING_RATIOS);
  const [calendarRules, setCalendarRules] = useState<any[]>([]);
  const [constraints, setConstraints] = useState<SchedulingConstraintsConfig>(DEFAULT_CONSTRAINTS);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const configStatus = getSupabaseConfigStatus();

  useEffect(() => {
    if (isSupabaseConfigured()) {
      loadSettings();
    } else {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Clear save message after 3 seconds
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  if (!configStatus.configured) {
    return <SetupRequired configStatus={configStatus} />;
  }

  const loadSettings = async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('system_settings').select('*').not('setting_key', 'like', 'backup_%');
      if (error) throw error;

      data?.forEach(setting => {
        switch (setting.setting_key) {
          case 'staffing_ratios':
            if (setting.setting_value?.ranges) setStaffingRatios(setting.setting_value.ranges);
            break;

          case 'calendar_rules':
            if (Array.isArray(setting.setting_value)) setCalendarRules(setting.setting_value);
            break;

          case 'scheduling_constraints':
            if (setting.setting_value) setConstraints(setting.setting_value);
            break;
        }
      });
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
      setHasChanges(false);
    }
  };

  const handleSave = async () => {
    if (!supabase) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      // Upsert each setting
      const settings = [
        { setting_key: 'staffing_ratios', setting_value: { ranges: staffingRatios }, description: 'Staffing ratio configuration' },
        { setting_key: 'calendar_rules', setting_value: calendarRules, description: 'Unified calendar exceptions and overrides' },
        { setting_key: 'scheduling_constraints', setting_value: constraints, description: 'Scheduling constraints configuration' },
      ];

      for (const setting of settings) {
        const { error } = await supabase
          .from('system_settings')
          .upsert(setting, { onConflict: 'setting_key' });
        if (error) throw error;
      }

      setSaveMessage({ type: 'success', text: 'Settings saved successfully!' });
      setHasChanges(false);
    } catch (error: any) {
      console.error('Error saving settings:', error);
      setSaveMessage({ type: 'error', text: error.message || 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      setStaffingRatios(DEFAULT_STAFFING_RATIOS);
      setCalendarRules([]);
      setConstraints(DEFAULT_CONSTRAINTS);
      setHasChanges(true);
    }
  };

  const updateStaffingRatios = (ranges: StaffingRatioRange[]) => {
    setStaffingRatios(ranges);
    setHasChanges(true);
  };

  const updateCalendarRules = (rules: any[]) => {
    setCalendarRules(rules);
    setHasChanges(true);
  };
  
  const updateConstraints = (config: SchedulingConstraintsConfig) => {
    setConstraints(config);
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Loading settings...</span>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="System Settings"
        description="Configure staffing ratios, working hours, and scheduling constraints"
        actions={
          <div className="flex items-center gap-3">
            {saveMessage && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm border ${saveMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                {saveMessage.type === 'success' && <CheckCircle className="w-3.5 h-3.5" />}
                {saveMessage.text}
              </div>
            )}
            <div className="flex items-center gap-2">
              <button onClick={handleReset} disabled={isSaving} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-40">
                <RotateCcw className="w-3.5 h-3.5" />Reset
              </button>
              <button onClick={handleSave} disabled={isSaving || !hasChanges} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Settings
              </button>
            </div>
          </div>
        }
      />

      <div className="space-y-6">
        {/* Staffing Ratios */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold">Staffing Ratios</h3>
          </div>
          <p className="text-gray-600 mb-4 text-sm">
            Configure the required number of supervisors based on student count in each exam session.
          </p>
          <StaffingRatiosEditor ranges={staffingRatios} onChange={updateStaffingRatios} disabled={isSaving} />
        </div>

        {/* Unified Calendar Rules */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-semibold">Calendar Rules</h3>
          </div>
          <p className="text-gray-600 mb-4 text-sm">
            Define specific dates or date ranges to bypass normal days off or enforce custom staffing ratios.
          </p>
          <CalendarRulesEditor rules={calendarRules} onChange={updateCalendarRules} disabled={isSaving} />
        </div>        {/* Scheduling Constraints */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-2">
            <Settings2 className="w-5 h-5 text-success-600" />
            <h3 className="text-lg font-semibold">Scheduling Constraints</h3>
          </div>
          <p className="text-gray-600 mb-4 text-sm">
            Set rules that the auto-assignment algorithm will follow when creating schedules.
          </p>
          <ConstraintsEditor config={constraints} onChange={updateConstraints} disabled={isSaving} />
        </div>

        {/* Unsaved Changes Warning */}
        {hasChanges && (
          <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 flex items-center justify-between">
            <span className="text-warning-800 text-sm">You have unsaved changes.</span>
            <button onClick={handleSave} className="btn btn-warning px-4 py-1.5 text-sm" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Now'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

