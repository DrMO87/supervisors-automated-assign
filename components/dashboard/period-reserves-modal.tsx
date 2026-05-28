'use client';

import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Users, Calendar, Clock, Plus, Trash2, Loader2, AlertCircle, CheckCircle, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import type { Staff } from '@/types/database.types';
import { supabase } from '@/lib/supabase/client';
import { useSchedulingStore } from '@/lib/stores/scheduling-store';

interface PeriodReservesModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  period: number;
  currentReserves: any[]; // period_free_staff records
  startTime: string;
  availableStaff: Staff[];
  onUpdate: () => void;
}

export function PeriodReservesModal({ isOpen, onClose, dateStr, period, startTime, currentReserves, availableStaff, onUpdate }: PeriodReservesModalProps) {
  const { staff } = useSchedulingStore();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'Assistant' | 'Exam_Supervisor'>('Assistant');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (!isOpen) return null;

  const assignedReserveIds = new Set(currentReserves.map(r => r.staff_id));

  // Filter available options ensuring they are not already reserves and fit the role
  const availableOptions = availableStaff.filter(s => {
    if (assignedReserveIds.has(s.id)) return false;
    // Don't allow Committees Supervisor as reserve
    if (s.supervision_role === 'Committees Supervisor') return false;
    
    if (selectedRole === 'Exam_Supervisor') {
      return s.supervision_role === 'Exam Supervisor' || s.supervision_role === 'Invigilator / Exam Supervisor';
    }
    if (selectedRole === 'Assistant') {
      return s.supervision_role === 'Invigilator' || s.supervision_role === 'Invigilator / Exam Supervisor';
    }
    return false;
  });

  const handleAddReserve = async () => {
    if (!supabase || !selectedStaffId) return;
    setIsLoading(true);
    try {
      // 1. Insert into period_free_staff
      const { error: insertError } = await supabase.from('period_free_staff').insert({
        exam_date: dateStr,
        period: period,
        start_time: startTime,
        staff_id: selectedStaffId,
        role: selectedRole
      });
      if (insertError) throw insertError;

      // 2. Recalculate free_staff_score
      const { data: staffReserves } = await supabase
        .from('period_free_staff')
        .select('id')
        .eq('staff_id', selectedStaffId);
      
      const newScore = staffReserves?.length || 0;
      await supabase.from('staff').update({ free_staff_score: newScore }).eq('id', selectedStaffId);

      setMessage({ type: 'success', text: 'Reserve added successfully' });
      setSelectedStaffId('');
      onUpdate();
    } catch (error: any) {
      console.error('Error adding reserve:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to add reserve' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveReserve = async (reserveId: string, staffId: string) => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      // 1. Delete from period_free_staff
      const { error: deleteError } = await supabase.from('period_free_staff').delete().eq('id', reserveId);
      if (deleteError) throw deleteError;

      // 2. Recalculate free_staff_score
      const { data: staffReserves } = await supabase
        .from('period_free_staff')
        .select('id')
        .eq('staff_id', staffId);
      
      const newScore = staffReserves?.length || 0;
      await supabase.from('staff').update({ free_staff_score: newScore }).eq('id', staffId);

      setMessage({ type: 'success', text: 'Reserve removed successfully' });
      onUpdate();
    } catch (error: any) {
      console.error('Error removing reserve:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to remove reserve' });
    } finally {
      setIsLoading(false);
    }
  };

  const examSupervisors = currentReserves.filter(r => r.role === 'Exam_Supervisor');
  const invigilators = currentReserves.filter(r => r.role === 'Assistant' || !r.role);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-xl bg-white shadow-xl transition-all flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-gray-50 flex-shrink-0">
                  <div>
                    <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-primary-600" />
                      Edit Period Reserves
                    </Dialog.Title>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button>
                  </div>
                </div>

                <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
                  {/* Session Info */}
                  <div className="grid grid-cols-2 gap-3 mb-4 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>{format(new Date(dateStr), 'EEE, MMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>Period {period}</span>
                    </div>
                  </div>

                  {/* Message */}
                  {message && (
                    <div className={`flex items-center gap-2 p-2 rounded mb-4 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {message.text}
                    </div>
                  )}

                  {/* Add Reserve Form */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-1.5">
                      <Plus className="w-4 h-4" /> Add Reserve Staff
                    </h4>
                    
                    <div className="flex flex-col gap-3">
                      <div className="flex gap-2">
                        <select
                          className="input flex-1 py-1.5 text-sm"
                          value={selectedRole}
                          onChange={(e) => {
                            setSelectedRole(e.target.value as any);
                            setSelectedStaffId('');
                          }}
                        >
                          <option value="Exam_Supervisor">Exam Supervisor Reserve</option>
                          <option value="Assistant">Invigilator Reserve</option>
                        </select>
                      </div>

                      <div className="flex gap-2">
                        <select
                          className="input flex-1 py-1.5 text-sm"
                          value={selectedStaffId}
                          onChange={(e) => setSelectedStaffId(e.target.value)}
                          disabled={isLoading}
                        >
                          <option value="">Select available staff...</option>
                          {availableOptions.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.supervision_role}) - Score: {s.current_score}+{s.free_staff_score || 0}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={handleAddReserve}
                          disabled={isLoading || !selectedStaffId}
                          className="btn btn-primary py-1.5 px-4 disabled:opacity-50"
                        >
                          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
                        </button>
                      </div>
                      
                      {availableOptions.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">
                          No available staff for this role at this time.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Current Reserves List */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center justify-between border-b pb-2">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-500" />
                        Current Assigned Reserves
                      </div>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {currentReserves.length} Total
                      </span>
                    </h4>

                    {currentReserves.length === 0 ? (
                      <p className="text-sm text-gray-500 italic py-4 text-center">No reserves assigned for this period.</p>
                    ) : (
                      <div className="space-y-4">
                        {/* Exam Supervisors */}
                        {examSupervisors.length > 0 && (
                          <div>
                            <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Exam Supervisors</h5>
                            <div className="space-y-2">
                              {examSupervisors.map(reserve => (
                                <div key={reserve.id} className="flex items-center justify-between p-2 rounded-md border border-indigo-100 bg-indigo-50/30">
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">{reserve.staff?.name || 'Unknown'}</div>
                                    <div className="text-xs text-gray-500">{reserve.staff?.job_title}</div>
                                  </div>
                                  <button
                                    onClick={() => handleRemoveReserve(reserve.id, reserve.staff_id)}
                                    disabled={isLoading}
                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                    title="Remove Reserve"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Invigilators */}
                        {invigilators.length > 0 && (
                          <div>
                            <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Invigilators</h5>
                            <div className="space-y-2">
                              {invigilators.map(reserve => (
                                <div key={reserve.id} className="flex items-center justify-between p-2 rounded-md border border-blue-100 bg-blue-50/30">
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">{reserve.staff?.name || 'Unknown'}</div>
                                    <div className="text-xs text-gray-500">{reserve.staff?.job_title}</div>
                                  </div>
                                  <button
                                    onClick={() => handleRemoveReserve(reserve.id, reserve.staff_id)}
                                    disabled={isLoading}
                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                    title="Remove Reserve"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
