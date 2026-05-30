'use client';

import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Users, MapPin, Calendar, Clock, Lock, Unlock, Plus, Trash2, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { ExamSessionWithRelations, Staff, AssignmentWithStaff } from '@/types/database.types';
import { getPeriodFromTime } from '@/types/database.types';
import { supabase } from '@/lib/supabase/client';
import { Conflict } from '@/lib/utils/conflict-detection';
import { useSchedulingStore } from '@/lib/stores/scheduling-store';
import { cn } from '@/lib/utils/cn';

import type { CalendarRule } from '@/types/database.types';

const isOffDay = (dateStr: string, staff?: Staff, calendarRules: CalendarRule[] = []) => {
  if (!staff) return false;
  if (staff.specific_off_dates?.includes(dateStr)) return true;
  const isUniversalRaw = calendarRules.some(r => r.is_universal_working_day && r.start_date <= dateStr && r.end_date >= dateStr);
  const isUniversal = isUniversalRaw && staff.supervision_role !== 'Committees Supervisor';
  if (isUniversal) return false;
  if (staff.specific_standard_off_dates?.includes(dateStr)) return true;
  const dayOfWeek = new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  if (staff.working_days && !staff.working_days.includes(dayOfWeek)) return true;
  return false;
};

/** Returns true when a Universal Working Day legally overrode a standard off-day — flag orange for tracking */
const isOverriddenDay = (dateStr: string, staff?: Staff, calendarRules: CalendarRule[] = []) => {
  if (!staff) return false;
  const isUniversalRaw = calendarRules.some(r => r.is_universal_working_day && r.start_date <= dateStr && r.end_date >= dateStr);
  if (!isUniversalRaw) return false;
  if (staff.supervision_role === 'Committees Supervisor') return false;
  if (staff.specific_standard_off_dates?.includes(dateStr)) return true;
  const dayOfWeek = new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  if (staff.working_days && !staff.working_days.includes(dayOfWeek)) return true;
  return false;
};

interface SessionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: ExamSessionWithRelations | null;
  availableStaff: Staff[];
  conflicts: Conflict[];
  onUpdate: () => void;
}

export function SessionDetailModal({ isOpen, onClose, session, availableStaff, conflicts, onUpdate }: SessionDetailModalProps) {
  const { staff, examSessions, systemSettings } = useSchedulingStore();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'Exam_Supervisor' | 'Head_Supervisor' | 'Assistant'>('Assistant');
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const constraintsConfig = systemSettings?.find((s: any) => s.setting_key === 'scheduling_constraints')?.setting_value || {};
  const universalWorkingDays = constraintsConfig.universal_working_days || [];
  
  const calendarRulesSetting = systemSettings?.find((s: any) => s.setting_key === 'calendar_rules');
  const calendarRules = calendarRulesSetting?.setting_value || [];

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (!session) return null;

  const assignedInSession = new Set(session.assignments?.map(a => a.staff_id) || []);

  const availableOptions = availableStaff.filter(s => 
    !assignedInSession.has(s.id) &&
    isQualifiedForRole(s.supervision_role, selectedRole)
  );

  // We no longer strictly filter by role to allow maximum flexibility in manual assignments.
  // The user can assign anyone to any role manually.
  function isQualifiedForRole(supervisionRole: string, selRole: string) {
    return true;
  };

  const getUnavailabilityReason = (member: Staff) => {
    if (member.availability_status !== 'Available') {
      return member.availability_status; // e.g. On-Leave or Unavailable
    }

    const isSpecificOffDate = (member.specific_off_dates as string[])?.includes(session.exam_date);
    if (isSpecificOffDate) {
      return 'Specific Off Day';
    }

    const weekday = new Date(`${session.exam_date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    const isWorkingDay = member.working_days?.includes(weekday);
    if (!isWorkingDay) {
      return 'Non-working Day';
    }

    // Check if double booked (excluding Committees Supervisor under rule 5)
    const period = getPeriodFromTime(session.start_time);
    const sessionsAtSlot = examSessions.filter(
      s => s.exam_date === session.exam_date && getPeriodFromTime(s.start_time) === period
    );
    
    // Rule 5: double booking should not be considered for Committees Supervisor or same room
    const isDoubleBooked = sessionsAtSlot.some(s => 
      s.assignments?.some(a => a.staff_id === member.id && s.room_id !== session.room_id)
    );
    if (isDoubleBooked && member.supervision_role !== 'Committees Supervisor') {
      return 'Assigned in Period';
    }

    return 'Unavailable';
  };

  const unavailableOptions = showUnavailable
    ? staff
        .filter(s => {
          // Must not be already in availableOptions
          const inAvailable = availableOptions.some(av => av.id === s.id);
          if (inAvailable) return false;
          
          // Must not be already assigned to this session
          if (assignedInSession.has(s.id)) return false;

          // Must be qualified for the selected role (now always true for maximum flexibility)
          return true;
        })
        .map(s => ({
          ...s,
          unavailabilityReason: getUnavailabilityReason(s)
        }))
    : [];

  const handleAddAssignment = async () => {
    if (!supabase || !selectedStaffId) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.from('assignments').insert({
        exam_session_id: session.id,
        staff_id: selectedStaffId,
        role: selectedRole,
        is_manual_override: true,
      });
      if (error) throw error;

      // Recalculate staff score in DB by period
      const { data: staffAssignments } = await supabase.from('assignments').select('exam_session_id').eq('staff_id', selectedStaffId);
      const { data: dbSessions } = await supabase.from('exam_sessions').select('id, exam_date, start_time');
      const uniquePeriods = new Set();
      staffAssignments?.forEach(a => {
        const s = dbSessions?.find(x => x.id === a.exam_session_id);
        if (s) uniquePeriods.add(`${s.exam_date}__${s.start_time}`);
      });
      await supabase.from('staff').update({ current_score: uniquePeriods.size }).eq('id', selectedStaffId);

      setMessage({ type: 'success', text: 'Assignment added successfully' });
      setSelectedStaffId('');
      onUpdate();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to add assignment' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!supabase || !confirm('Remove this assignment?')) return;
    setIsLoading(true);
    try {
      // Find staff_id first to update their score
      const { data: assignmentData } = await supabase.from('assignments').select('staff_id').eq('id', assignmentId).single();

      const { error } = await supabase.from('assignments').delete().eq('id', assignmentId);
      if (error) throw error;

      if (assignmentData?.staff_id) {
        const { data: staffAssignments } = await supabase.from('assignments').select('exam_session_id').eq('staff_id', assignmentData.staff_id);
        const { data: dbSessions } = await supabase.from('exam_sessions').select('id, exam_date, start_time');
        const uniquePeriods = new Set();
        staffAssignments?.forEach(a => {
          const s = dbSessions?.find(x => x.id === a.exam_session_id);
          if (s) uniquePeriods.add(`${s.exam_date}__${s.start_time}`);
        });
        await supabase.from('staff').update({ current_score: uniquePeriods.size }).eq('id', assignmentData.staff_id);
      }

      setMessage({ type: 'success', text: 'Assignment removed' });
      onUpdate();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to remove assignment' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleLock = async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.from('exam_sessions').update({ is_locked: !session.is_locked }).eq('id', session.id);
      if (error) throw error;
      setMessage({ type: 'success', text: session.is_locked ? 'Session unlocked' : 'Session locked' });
      onUpdate();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update lock status' });
    } finally {
      setIsLoading(false);
    }
  };

  const examSupervisor = session.assignments?.find(a => a.role === 'Exam_Supervisor');
  const headSupervisor = session.assignments?.find(a => a.role === 'Head_Supervisor' || a.role === 'Committees_Supervisor');
  const assistants = session.assignments?.filter(a => a.role === 'Assistant' || a.role === 'Invigilator') || [];

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-xl bg-white shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-gray-50">
                  <div>
                    <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      {session.subject_name}
                      {session.is_locked && (
                        <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 rounded border border-amber-200">
                          <Lock className="w-3 h-3" /> Locked
                        </span>
                      )}
                    </Dialog.Title>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleToggleLock} className={`p-2 rounded-md ${session.is_locked ? 'bg-gray-200 text-gray-700' : 'bg-primary-100 text-primary-700'}`} disabled={isLoading}>
                      {session.is_locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    </button>
                    <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button>
                  </div>
                </div>

                <div className="p-4">
                  {/* Session Info */}
                  <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>{format(new Date(session.exam_date), 'EEE, MMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>Period {getPeriodFromTime(session.start_time)} • {session.start_time}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4" />
                      <span>{session.room?.room_name || 'No room'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Users className="w-4 h-4" />
                      <span>{session.student_count} students</span>
                    </div>
                  </div>

                  {/* Message */}
                  {message && (
                    <div className={`flex items-center gap-2 p-2 rounded mb-4 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {message.text}
                    </div>
                  )}

                  {/* Conflicts */}
                  {conflicts.length > 0 && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <h4 className="text-sm font-medium text-red-800 mb-2">Issues ({conflicts.length})</h4>
                      <ul className="text-xs text-red-700 space-y-1">
                        {conflicts.map((c, i) => <li key={i}>• {c.message}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Current Assignments */}
                  <h4 className="font-medium text-gray-900 mb-2">Current Assignments</h4>
                  <div className="space-y-2 mb-4">
                    {examSupervisor && (
                      <div className="flex items-center justify-between p-2 bg-purple-50 rounded">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="text-xs font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded">Exam Sprv</span>
                          <span className={cn("text-sm",
                            isOffDay(session.exam_date, examSupervisor.staff, calendarRules) ? "text-red-600 font-bold bg-red-50 px-1 rounded border border-red-200"
                            : isOverriddenDay(session.exam_date, examSupervisor.staff, calendarRules) ? "text-orange-600 font-bold bg-orange-50 px-1 rounded border border-orange-200"
                            : ""
                          )} title={
                            isOffDay(session.exam_date, examSupervisor.staff, calendarRules) ? "Assigned on off-day! (strict — not allowed)"
                            : isOverriddenDay(session.exam_date, examSupervisor.staff, calendarRules) ? "Assigned on overridden off-day (Universal Working Day override)"
                            : undefined
                          }>{examSupervisor.staff?.name}</span>
                        </div>
                        <button onClick={() => handleRemoveAssignment(examSupervisor.id)} className="p-1 text-red-500 hover:bg-red-50 rounded" disabled={isLoading}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {headSupervisor && (
                      <div className="flex items-center justify-between p-2 bg-primary-50 rounded">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="text-xs font-medium text-primary-700 bg-primary-100 px-2 py-0.5 rounded">Comm Sprv</span>
                          <span className={cn("text-sm",
                            isOffDay(session.exam_date, headSupervisor.staff, calendarRules) ? "text-red-600 font-bold bg-red-50 px-1 rounded border border-red-200"
                            : isOverriddenDay(session.exam_date, headSupervisor.staff, calendarRules) ? "text-orange-600 font-bold bg-orange-50 px-1 rounded border border-orange-200"
                            : ""
                          )} title={
                            isOffDay(session.exam_date, headSupervisor.staff, calendarRules) ? "Assigned on off-day! (strict — not allowed)"
                            : isOverriddenDay(session.exam_date, headSupervisor.staff, calendarRules) ? "Assigned on overridden off-day (Universal Working Day override)"
                            : undefined
                          }>{headSupervisor.staff?.name}</span>
                        </div>
                        <button onClick={() => handleRemoveAssignment(headSupervisor.id)} className="p-1 text-red-500 hover:bg-red-50 rounded" disabled={isLoading}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {assistants.map(a => (
                      <div key={a.id} className="flex items-center justify-between p-2 bg-success-50 rounded">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="text-xs font-medium text-success-700 bg-success-100 px-2 py-0.5 rounded">Invig</span>
                          <span className={cn("text-sm",
                            isOffDay(session.exam_date, a.staff, calendarRules) ? "text-red-600 font-bold bg-red-50 px-1 rounded border border-red-200"
                            : isOverriddenDay(session.exam_date, a.staff, calendarRules) ? "text-orange-600 font-bold bg-orange-50 px-1 rounded border border-orange-200"
                            : ""
                          )} title={
                            isOffDay(session.exam_date, a.staff, calendarRules) ? "Assigned on off-day! (strict — not allowed)"
                            : isOverriddenDay(session.exam_date, a.staff, calendarRules) ? "Assigned on overridden off-day (Universal Working Day override)"
                            : undefined
                          }>{a.staff?.name}</span>
                        </div>
                        <button onClick={() => handleRemoveAssignment(a.id)} className="p-1 text-red-500 hover:bg-red-50 rounded" disabled={isLoading}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {!headSupervisor && assistants.length === 0 && (
                      <p className="text-sm text-gray-400 italic">No assignments yet</p>
                    )}
                  </div>

                  {/* Add Assignment */}
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-900 mb-2">Add Assignment</h4>
                    
                    {/* Checkbox for including unavailable staff */}
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="checkbox"
                        id="show-unavailable"
                        checked={showUnavailable}
                        onChange={(e) => {
                          setShowUnavailable(e.target.checked);
                          setSelectedStaffId('');
                        }}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="show-unavailable" className="text-xs text-gray-600 cursor-pointer select-none">
                        Include unavailable or off-duty staff matching selected role
                      </label>
                    </div>

                    <div className="flex gap-2">
                      <select 
                        value={selectedStaffId} 
                        onChange={e => setSelectedStaffId(e.target.value)} 
                        className="input flex-1"
                      >
                        <option value="">Select staff...</option>
                        
                        {/* Available group */}
                        {availableOptions.length > 0 && (
                          <optgroup label="Available Staff">
                            {availableOptions.map(s => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.job_title}) — {s.supervision_role}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        
                        {/* Unavailable matching role group */}
                        {showUnavailable && unavailableOptions.length > 0 && (
                          <optgroup label="Unavailable Staff (Matches Selected Role)">
                            {unavailableOptions.map(s => (
                              <option key={s.id} value={s.id} className="text-red-600 bg-red-50">
                                {s.name} ({s.job_title}) [{s.unavailabilityReason}]
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>

                      <select 
                        value={selectedRole} 
                        onChange={e => {
                          setSelectedRole(e.target.value as any);
                          setSelectedStaffId('');
                        }} 
                        className="input w-36"
                      >
                        <option value="Exam_Supervisor">Exam Sprv</option>
                        <option value="Head_Supervisor">Comm Sprv</option>
                        <option value="Assistant">Invigilator</option>
                      </select>

                      <button onClick={handleAddAssignment} className="btn btn-primary px-3" disabled={isLoading || !selectedStaffId}>
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

