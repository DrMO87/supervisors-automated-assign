'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Staff, StaffFormData } from '@/types/database.types';
import { Loader2, Baby, HeartPulse, ShieldCheck } from 'lucide-react';

const staffSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  job_title: z.enum(['Chemist', 'Demonstrator', 'Teaching Assistant', 'Lecturer'], { required_error: 'Please select a job title' }),
  employment_status: z.enum(['Full-time', 'Part-time'], { required_error: 'Please select employment status' }),
  availability_status: z.enum(['Available', 'On-Leave', 'Unavailable']).default('Available'),
  working_days: z.array(z.string()).default(['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']),
  specific_off_dates: z.array(z.string()).default([]),
  // New fields
  is_feeding_mother: z.boolean().default(false),
  feeding_mother_days: z.number().min(0).max(4).default(0),
  has_health_issue: z.boolean().default(false),
  is_overloaded: z.boolean().default(false),
  overload_percentage: z.number().min(0).max(100).default(0),
  supervision_role: z.enum(['Invigilator', 'Committees Supervisor', 'Exam Supervisor', 'Invigilator / Exam Supervisor']).default('Invigilator'),
  can_supervise_oral: z.boolean().default(false),
});

const DAYS_OF_WEEK = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

interface StaffFormProps {
  staff?: Staff | null;
  onSubmit: (data: StaffFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  examDates?: string[];
}

export function StaffForm({ staff, onSubmit, onCancel, isLoading, examDates = [] }: StaffFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<StaffFormData>({
    resolver: zodResolver(staffSchema),
    defaultValues: staff ? {
      name: staff.name,
      email: staff.email,
      job_title: staff.job_title,
      employment_status: staff.employment_status,
      availability_status: staff.availability_status,
      working_days: staff.working_days || ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
      specific_off_dates: staff.specific_off_dates || [],
      is_feeding_mother: staff.is_feeding_mother ?? false,
      feeding_mother_days: staff.feeding_mother_days ?? 0,
      has_health_issue: staff.has_health_issue ?? false,
      is_overloaded: staff.is_overloaded ?? false,
      overload_percentage: staff.overload_percentage ?? 0,
      supervision_role: staff.supervision_role ?? 'Invigilator',
      can_supervise_oral: staff.can_supervise_oral ?? false,
    } : {
      availability_status: 'Available',
      working_days: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
      specific_off_dates: [],
      is_feeding_mother: false,
      feeding_mother_days: 0,
      has_health_issue: false,
      is_overloaded: false,
      overload_percentage: 0,
      supervision_role: 'Invigilator',
      can_supervise_oral: false,
    },
  });

  const isFeedingMother = watch('is_feeding_mother');
  const isOverloaded = watch('is_overloaded');
  const employmentStatus = watch('employment_status');

  // Determine max allowed feeding days based on employment
  const maxFeedingDays = employmentStatus === 'Full-time' ? 4 : 2;
  const feedingHintLines = employmentStatus === 'Full-time'
    ? ['2 days leaving 2h early', '4 days leaving 1h early']
    : ['1 day leaving 2h early', '2 days leaving 1h early'];

  const [selectedWeek, setSelectedWeek] = useState<string>('');

  const availableWeeksMap = useMemo(() => {
    const map = new Map<string, string[]>();
    examDates.forEach(dateStr => {
      if (!dateStr) return;
      const d = new Date(`${dateStr}T12:00:00Z`);
      const day = d.getUTCDay();
      const offset = day === 6 ? 0 : -(day + 1);
      const start = new Date(d);
      start.setUTCDate(d.getUTCDate() + offset);
      const weekStart = start.toISOString().split('T')[0];
      
      if (!map.has(weekStart)) map.set(weekStart, []);
      if (!map.get(weekStart)!.includes(dateStr)) {
        map.get(weekStart)!.push(dateStr);
      }
    });
    return map;
  }, [examDates]);

  const availableWeeks = Array.from(availableWeeksMap.keys()).sort();
  const specificOffDates = watch('specific_off_dates') || [];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
      {/* Name */}
      <div>
        <label className="label mb-1 block">Name *</label>
        <input type="text" {...register('name')} className="input w-full" placeholder="Enter full name" />
        {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
      </div>

      {/* Email */}
      <div>
        <label className="label mb-1 block">Email *</label>
        <input type="email" {...register('email')} className="input w-full" placeholder="email@example.com" />
        {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>}
      </div>

      {/* Job Title & Employment Status - side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label mb-1 block">Job Title *</label>
          <select {...register('job_title')} className="input w-full">
            <option value="">Select job title</option>
            <option value="Chemist">Chemist</option>
            <option value="Demonstrator">Demonstrator</option>
            <option value="Teaching Assistant">Teaching Assistant</option>
            <option value="Lecturer">Lecturer</option>
          </select>
          {errors.job_title && <p className="text-sm text-red-500 mt-1">{errors.job_title.message}</p>}
        </div>
        <div>
          <label className="label mb-1 block">Employment *</label>
          <select {...register('employment_status')} className="input w-full">
            <option value="">Select status</option>
            <option value="Full-time">Full-time</option>
            <option value="Part-time">Part-time</option>
          </select>
          {errors.employment_status && <p className="text-sm text-red-500 mt-1">{errors.employment_status.message}</p>}
        </div>
      </div>

      {/* Availability & Supervision Role - side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label mb-1 block">Availability</label>
          <select {...register('availability_status')} className="input w-full">
            <option value="Available">Available</option>
            <option value="On-Leave">On Leave</option>
            <option value="Unavailable">Unavailable</option>
          </select>
        </div>
        <div>
          <label className="label mb-1 block flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-primary-600" />
            Supervision Role
          </label>
          <select {...register('supervision_role')} className="input w-full">
            <option value="Invigilator">Invigilator</option>
            <option value="Committees Supervisor">Committees Supervisor</option>
            <option value="Exam Supervisor">Exam Supervisor</option>
            <option value="Invigilator / Exam Supervisor">Invigilator / Exam Supervisor</option>
          </select>
        </div>
      </div>

      {/* Working Days */}
      <div>
        <label className="label mb-2 block">Working Days *</label>
        <div className="flex flex-wrap gap-2">
          {DAYS_OF_WEEK.map((day) => (
            <label key={day} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50 text-sm">
              <input
                type="checkbox"
                value={day}
                {...register('working_days')}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <span className="text-gray-700">{day.slice(0, 3)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Specific Unavailable Dates */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Specific Unavailable Dates</label>
          {availableWeeks.length > 0 && (
            <select 
              value={selectedWeek} 
              onChange={e => setSelectedWeek(e.target.value)}
              className="input text-xs py-1 h-auto min-w-[200px]"
            >
              <option value="">Select a week to edit...</option>
              {availableWeeks.map(week => (
                <option key={week} value={week}>
                  Week of {new Date(week).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </option>
              ))}
            </select>
          )}
        </div>
        
        {selectedWeek ? (
          <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            {(availableWeeksMap.get(selectedWeek) || []).sort().map((dateStr) => {
              const isOff = specificOffDates.includes(dateStr);
              return (
                <label 
                  key={dateStr} 
                  className={`flex flex-col items-center p-2 border rounded cursor-pointer transition-colors text-sm min-w-[70px] ${
                    isOff ? 'bg-red-50 border-red-200 hover:bg-red-100' : 'bg-white border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className={`text-[10px] font-bold uppercase mb-1 ${isOff ? 'text-red-700' : 'text-slate-500'}`}>
                    {new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'short' })}
                  </span>
                  <span className={`font-semibold ${isOff ? 'text-red-900' : 'text-slate-800'}`}>
                    {new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  <input
                    type="checkbox"
                    value={dateStr}
                    {...register('specific_off_dates')}
                    className="w-4 h-4 mt-2 text-red-600 rounded focus:ring-red-500"
                  />
                  <span className={`text-[10px] mt-1 font-medium ${isOff ? 'text-red-600' : 'text-slate-400'}`}>
                    {isOff ? 'Off' : 'Avail'}
                  </span>
                </label>
              );
            })}
              {/* Hidden inputs to preserve off dates from other weeks */}
              {specificOffDates
                .filter((dateStr: string) => !(availableWeeksMap.get(selectedWeek) || []).includes(dateStr))
                .map((dateStr: string) => (
                  <input
                    key={`hidden-${dateStr}`}
                    type="checkbox"
                    value={dateStr}
                    {...register('specific_off_dates')}
                    className="hidden"
                  />
                ))}
          </div>
        ) : (
          <div className="text-xs text-slate-500 p-3 bg-slate-50 border border-dashed border-slate-300 rounded-lg">
            Select a week from the dropdown above to mark specific dates as unavailable for this staff member.
            
            {/* If no week is selected, we still need to preserve all existing off dates */}
            {specificOffDates.map((dateStr: string) => (
              <input
                key={`hidden-all-${dateStr}`}
                type="checkbox"
                value={dateStr}
                {...register('specific_off_dates')}
                className="hidden"
              />
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Special Conditions</p>

        {/* Feeding Mother */}
        <div className="p-3 bg-pink-50 border border-pink-100 rounded-lg mb-3">
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input type="checkbox" {...register('is_feeding_mother')} className="w-4 h-4 rounded" />
            <Baby className="w-4 h-4 text-pink-600" />
            <span className="text-sm font-medium text-gray-800">Feeding Mother</span>
          </label>
          {isFeedingMother && (
            <div className="ml-6 space-y-2">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">
                  Allowed early-leave days per week
                  <span className="ml-1 text-gray-400">(max {maxFeedingDays})</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={maxFeedingDays}
                  {...register('feeding_mother_days', { valueAsNumber: true })}
                  className="input w-24 text-sm"
                />
              </div>
              <div className="text-xs text-pink-700 bg-pink-100 px-2 py-1 rounded">
                <div className="font-semibold mb-0.5">Allowed schedule ({employmentStatus || '...'})</div>
                {feedingHintLines.map(l => <div key={l}>• {l}</div>)}
              </div>
            </div>
          )}
        </div>

        {/* Health Issue */}
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register('has_health_issue')} className="w-4 h-4 rounded" />
            <HeartPulse className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-800">Has Health Issue</span>
          </label>
          <p className="text-xs text-blue-700 ml-6 mt-1">
            Will be preferred for rooms in buildings <strong>M</strong> or <strong>P</strong> (near pharmacy).
          </p>
        </div>

        {/* Overloaded */}
        <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg mt-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register('is_overloaded')} className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500" />
            <span className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              Overloaded
            </span>
          </label>
          {isOverloaded && (
            <div className="ml-6 space-y-2 mt-2">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">
                  Overload percentage (Score decrease)
                </label>
                <select
                  {...register('overload_percentage', { valueAsNumber: true })}
                  className="input w-36 text-sm bg-white"
                >
                  <option value={0}>Select percentage</option>
                  <option value={10}>10%</option>
                  <option value={20}>20%</option>
                  <option value={30}>30%</option>
                  <option value={40}>40%</option>
                  <option value={50}>50%</option>
                  <option value={60}>60%</option>
                  <option value={70}>70%</option>
                  <option value={80}>80%</option>
                  <option value={90}>90%</option>
                </select>
              </div>
              <p className="text-xs text-amber-700">
                Will reduce their assignment priority so they receive approximately this percentage fewer invigilation duties.
              </p>
            </div>
          )}
        </div>

        {/* Oral Exam Privilege */}
        <div className="p-3 bg-purple-50 border border-purple-100 rounded-lg mt-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register('can_supervise_oral')} className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500" />
            <span className="text-sm font-medium text-purple-900">Can Supervise Oral Exams</span>
          </label>
          <p className="text-xs text-purple-700 ml-6 mt-1">
            If checked, this staff member will be eligible for auto-assignment to Oral Exam sessions.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button type="button" onClick={onCancel} className="btn btn-secondary px-4 py-2" disabled={isLoading}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary px-4 py-2" disabled={isLoading}>
          {isLoading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
          ) : (
            staff ? 'Update Staff' : 'Add Staff'
          )}
        </button>
      </div>
    </form>
  );
}
