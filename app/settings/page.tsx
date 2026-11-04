'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { 
  Save, RotateCcw, Loader2, CheckCircle, Users, Clock, 
  Settings2, Calendar, ShieldCheck, Scale, Building2, 
  Sparkles, Zap, Search, AlertCircle, ArrowRight, Eye,
  Sliders, SlidersHorizontal, CheckCircle2, ChevronRight,
  Layers, Beaker, FileText, Info
} from 'lucide-react';
import { supabase, isSupabaseConfigured, getSupabaseConfigStatus } from '@/lib/supabase/client';
import type { 
  StaffingRatioRange, 
  CalendarRule, 
  SchedulingConstraintsConfig,
  StaffAvailabilityPolicy,
  ConsecutiveShiftPolicy
} from '@/types/database.types';
import { SetupRequired } from '@/components/setup-required';
import { StaffingRatiosEditor } from '@/components/settings/staffing-ratios-editor';
import { CalendarRulesEditor } from '@/components/settings/calendar-rules-editor';
import { ConstraintsEditor } from '@/components/settings/constraints-editor';
import { PresetProfilesSelector } from '@/components/settings/settings-visuals';

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
  consecutive_shifts_policy: 'avoid',
  max_hours_per_week_ft: 16,
  max_hours_per_week_pt: 8,
  max_hours_per_week_chemist: 20,
  enforce_strict_roles: true,
  max_rooms_per_lecturer: 3,
  max_floors_per_supervisor: 2,
  require_committees_supervisors: true,
  reserve_supervisors_target: 3,
  reserve_assistants_target: 3,
  reserve_deprioritize_chemists_p2: true,
  oral_exam_assignment_mode: 'combined',
  availability_policy: 'respect_all_off_days',
  ignore_working_days_if_specific_dates: false,
  max_score_delta_from_average: 3,
  ignore_staff_working_days: false,
  custom_days_per_week: 5,
  max_daily_shifts: 2,
  max_weekly_reserves: 2,
};

type SettingsTab = 'all' | 'algorithm' | 'ratios' | 'reserves_roaming' | 'fairness' | 'calendar';

export default function SettingsPage() {
  const [staffingRatios, setStaffingRatios] = useState<StaffingRatioRange[]>(DEFAULT_STAFFING_RATIOS);
  const [calendarRules, setCalendarRules] = useState<CalendarRule[]>([]);
  const [constraints, setConstraints] = useState<SchedulingConstraintsConfig>(DEFAULT_CONSTRAINTS);

  const [activeTab, setActiveTab] = useState<SettingsTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
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
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 4000);
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
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .not('setting_key', 'like', 'backup_%');
      if (error) throw error;

      data?.forEach((setting) => {
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
      const settings = [
        {
          setting_key: 'staffing_ratios',
          setting_value: { ranges: staffingRatios },
          description: 'Staffing ratio configuration',
        },
        {
          setting_key: 'calendar_rules',
          setting_value: calendarRules,
          description: 'Unified calendar exceptions and overrides',
        },
        {
          setting_key: 'scheduling_constraints',
          setting_value: constraints,
          description: 'Scheduling constraints configuration',
        },
      ];

      for (const setting of settings) {
        const { error } = await supabase
          .from('system_settings')
          .upsert(setting, { onConflict: 'setting_key' });
        if (error) throw error;
      }

      setSaveMessage({ type: 'success', text: 'All settings successfully saved and applied to engine!' });
      setHasChanges(false);
    } catch (error: any) {
      console.error('Error saving settings:', error);
      setSaveMessage({ type: 'error', text: error.message || 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Reset all settings to default factory standards? This cannot be undone.')) {
      setStaffingRatios(DEFAULT_STAFFING_RATIOS);
      setCalendarRules([]);
      setConstraints(DEFAULT_CONSTRAINTS);
      setHasChanges(true);
    }
  };

  const handleApplyPreset = (presetKey: string) => {
    if (presetKey === 'standard') {
      setConstraints({
        ...constraints,
        availability_policy: 'respect_all_off_days',
        ignore_staff_working_days: false,
        consecutive_shifts_policy: 'avoid',
        allow_consecutive_shifts: false,
        max_daily_shifts: 2,
        reserve_supervisors_target: 3,
        reserve_assistants_target: 3,
        reserve_deprioritize_chemists_p2: true,
        require_committees_supervisors: true,
        max_rooms_per_lecturer: 3,
        max_floors_per_supervisor: 2,
        max_score_delta_from_average: 3,
        enforce_strict_roles: true,
      });
      setHasChanges(true);
      setSaveMessage({ type: 'success', text: 'Applied "Standard Semester" profile preset. Review and click Save.' });
    } else if (presetKey === 'midterm_crunch') {
      setConstraints({
        ...constraints,
        availability_policy: 'cap_days_per_week',
        custom_days_per_week: 5,
        ignore_staff_working_days: true,
        consecutive_shifts_policy: 'allow',
        allow_consecutive_shifts: true,
        max_daily_shifts: 3,
        reserve_supervisors_target: 4,
        reserve_assistants_target: 4,
        reserve_deprioritize_chemists_p2: true,
        require_committees_supervisors: true,
        max_rooms_per_lecturer: 4,
        max_floors_per_supervisor: 3,
        max_score_delta_from_average: 4,
      });
      setHasChanges(true);
      setSaveMessage({ type: 'success', text: 'Applied "Midterm Rush" high-capacity profile preset.' });
    } else if (presetKey === 'welfare_focus') {
      setConstraints({
        ...constraints,
        availability_policy: 'respect_all_off_days',
        ignore_staff_working_days: false,
        consecutive_shifts_policy: 'strictly_prevent',
        allow_consecutive_shifts: false,
        max_daily_shifts: 1,
        reserve_supervisors_target: 3,
        reserve_assistants_target: 3,
        reserve_deprioritize_chemists_p2: true,
        require_committees_supervisors: true,
        max_rooms_per_lecturer: 2,
        max_floors_per_supervisor: 1,
        max_score_delta_from_average: 2,
        enforce_strict_roles: true,
      });
      setHasChanges(true);
      setSaveMessage({ type: 'success', text: 'Applied "Staff Rest & Equity" protective profile preset.' });
    }
  };

  const updateStaffingRatios = (ranges: StaffingRatioRange[]) => {
    setStaffingRatios(ranges);
    setHasChanges(true);
  };

  const updateCalendarRules = (rules: CalendarRule[]) => {
    setCalendarRules(rules);
    setHasChanges(true);
  };

  const updateConstraints = (config: SchedulingConstraintsConfig) => {
    setConstraints(config);
    setHasChanges(true);
  };

  // Derive active policy for status HUD
  const activePolicy: StaffAvailabilityPolicy =
    constraints.availability_policy ||
    (constraints.ignore_staff_working_days
      ? 'cap_days_per_week'
      : constraints.ignore_working_days_if_specific_dates
      ? 'smart_dates_priority'
      : 'respect_all_off_days');

  const consecutivePolicy: ConsecutiveShiftPolicy =
    constraints.consecutive_shifts_policy ||
    (!constraints.allow_consecutive_shifts ? 'avoid' : 'allow');

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-12 h-12 rounded-2xl bg-primary-100 text-primary-800 flex items-center justify-center mb-3 animate-pulse">
          <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        </div>
        <h3 className="font-display font-semibold text-slate-800 text-base">Loading System Configuration...</h3>
        <span className="text-xs text-slate-500 mt-1">Retrieving algorithm constraints, ratios &amp; calendar rules</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* ── Page Header ── */}
      <PageHeader
        title="System Settings &amp; Rules Engine"
        description="Configure automated assignment constraints, staffing capacity ratios, and special calendar rules."
        actions={
          <div className="flex items-center gap-3">
            {saveMessage && (
              <div
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs border animate-fade-in ${
                  saveMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}
              >
                {saveMessage.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                )}
                <span>{saveMessage.text}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                disabled={isSaving}
                className="btn btn-secondary text-xs flex items-center gap-1.5"
                title="Reset all settings to defaults"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Defaults
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                className="btn btn-primary text-xs flex items-center gap-1.5 shadow-sm"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Changes
              </button>
            </div>
          </div>
        }
      />

      {/* ── Executive Status HUD Strip ── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="font-display font-bold text-slate-900 text-base">
                Operational Roster Architecture HUD
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-100 text-primary-800">
                Live State
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Current operating parameters guiding the automated examination supervisor scheduler.
            </p>
          </div>

          {/* Quick Search / Filter Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search setting options..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-8 pr-3 py-1.5 text-xs w-full bg-slate-50 border-slate-200"
            />
          </div>
        </div>

        {/* Status Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
          {/* Metric 1 */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mb-1">
              <Calendar className="w-3.5 h-3.5 text-primary-600" />
              Availability
            </div>
            <div className="font-bold text-xs text-slate-900 truncate">
              {activePolicy === 'respect_all_off_days'
                ? 'Strict Off-Days'
                : activePolicy === 'cap_days_per_week'
                ? `Capped (${constraints.custom_days_per_week || 5} d/wk)`
                : 'Smart Dates Priority'}
            </div>
          </div>

          {/* Metric 2 */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mb-1">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              Consecutive
            </div>
            <div className="font-bold text-xs text-slate-900 truncate">
              {consecutivePolicy === 'avoid'
                ? 'Avoided (Soft)'
                : consecutivePolicy === 'strictly_prevent'
                ? 'Strict Lockout'
                : 'Allowed Freely'}
            </div>
          </div>

          {/* Metric 3 */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mb-1">
              <Users className="w-3.5 h-3.5 text-emerald-600" />
              Backup Reserves
            </div>
            <div className="font-bold text-xs text-slate-900">
              {constraints.reserve_supervisors_target ?? 3} Sup + {constraints.reserve_assistants_target ?? 3} Inv
            </div>
          </div>

          {/* Metric 4 */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mb-1">
              <Scale className="w-3.5 h-3.5 text-amber-600" />
              Fairness Cap
            </div>
            <div className="font-bold text-xs text-slate-900">
              Avg +{constraints.max_score_delta_from_average ?? 3} pts
            </div>
          </div>

          {/* Metric 5 */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 col-span-2 sm:col-span-1">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mb-1">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              Calendar Overrides
            </div>
            <div className="font-bold text-xs text-slate-900">
              {calendarRules.length} Active Rules
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Presets Bar ── */}
      <PresetProfilesSelector onApplyPreset={handleApplyPreset} disabled={isSaving} />

      {/* ── Reorganized Category Navigation Tabs ── */}
      <div className="border-b border-slate-200 flex items-center gap-1 overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'all'
              ? 'border-primary-600 text-primary-900 bg-white shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>All Settings &amp; Full View</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('algorithm')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'algorithm'
              ? 'border-primary-600 text-primary-900 bg-white shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-primary-600" />
          <span>Availability &amp; Shifts</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ratios')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'ratios'
              ? 'border-primary-600 text-primary-900 bg-white shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4 text-gold-600" />
          <span>Staffing Ratios &amp; Simulator</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reserves_roaming')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'reserves_roaming'
              ? 'border-primary-600 text-primary-900 bg-white shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Building2 className="w-4 h-4 text-emerald-600" />
          <span>Standby Reserves &amp; Roamers</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('fairness')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'fairness'
              ? 'border-primary-600 text-primary-900 bg-white shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Scale className="w-4 h-4 text-amber-600" />
          <span>Workload Fairness &amp; Hours</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'calendar'
              ? 'border-primary-600 text-primary-900 bg-white shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Calendar className="w-4 h-4 text-indigo-600" />
          <span>Calendar Rules &amp; Overrides</span>
          {calendarRules.length > 0 && (
            <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.2 rounded-full">
              {calendarRules.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Tabbed View Sections ── */}

      {/* 1. Staffing Ratios Section */}
      {(activeTab === 'all' || activeTab === 'ratios') && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-gold-600" />
              Room Staffing Ratios &amp; Classroom Capacity
            </h3>
            <span className="text-xs text-slate-500">Tier brackets mapped to student enrollment</span>
          </div>
          <StaffingRatiosEditor
            ranges={staffingRatios}
            onChange={updateStaffingRatios}
            disabled={isSaving}
          />
        </section>
      )}

      {/* 2. Algorithm Scheduling Constraints */}
      {(activeTab === 'all' || activeTab === 'algorithm' || activeTab === 'reserves_roaming' || activeTab === 'fairness') && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary-600" />
              Automated Scheduling Algorithm Rules &amp; Guardrails
            </h3>
            <span className="text-xs text-slate-500">Deterministic solver parameters</span>
          </div>
          <ConstraintsEditor
            config={constraints}
            onChange={updateConstraints}
            disabled={isSaving}
          />
        </section>
      )}

      {/* 3. Calendar Rules Section */}
      {(activeTab === 'all' || activeTab === 'calendar') && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              Unified Calendar Rules &amp; Date Overrides
            </h3>
            <span className="text-xs text-slate-500">Universal working days and temporary ratio adjustments</span>
          </div>
          <CalendarRulesEditor
            rules={calendarRules}
            onChange={updateCalendarRules}
            disabled={isSaving}
          />
        </section>
      )}

      {/* ── Sticky Unsaved Changes Action Floating Banner ── */}
      {hasChanges && (
        <div className="fixed bottom-6 inset-x-4 sm:inset-x-auto sm:right-8 z-50 animate-slide-up">
          <div className="bg-slate-900/95 text-white backdrop-blur-md border border-slate-700/80 rounded-2xl p-4 shadow-2xl flex items-center gap-4 max-w-lg">
            <div className="p-2 rounded-xl bg-gold-400 text-slate-950 font-bold flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-xs text-white">Unsaved Configuration Changes</div>
              <p className="text-[11px] text-slate-300 truncate">
                Settings have been modified. Save now to apply to future auto-assignment passes.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={loadSettings}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-xl border border-white/20 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="btn btn-gold text-xs px-4 py-1.5 font-bold shadow-glow-gold flex items-center gap-1.5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
