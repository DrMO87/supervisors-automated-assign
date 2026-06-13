'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { X, Calendar, Clock, DoorOpen, User, ArrowRightLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { getPeriodFromTime } from '@/types/database.types';

interface InternalOralSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  weekStartDate?: string;
  weekEndDate?: string;
  selectedWeek?: string;
}

export function InternalOralSwapModal({ isOpen, onClose, weekStartDate, weekEndDate, selectedWeek }: InternalOralSwapModalProps) {
  const supabase = createClientComponentClient();
  
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const [examDate, setExamDate] = useState('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  
  const [room1Id, setRoom1Id] = useState('');
  const [assignment1Id, setAssignment1Id] = useState('');
  
  const [room2Id, setRoom2Id] = useState('');
  const [assignment2Id, setAssignment2Id] = useState('');
  
  const [allSessionsData, setAllSessionsData] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setSuccess(false);
      setError(null);
      setExamDate('');
      setSelectedTime('');
      setRoom1Id('');
      setAssignment1Id('');
      setRoom2Id('');
      setAssignment2Id('');
      setAllSessionsData([]);
    }
  }, [isOpen]);

  // Fetch available dates when modal opens
  useEffect(() => {
    if (!isOpen) {
      setAvailableDates([]);
      return;
    }
    const fetchDates = async () => {
      setLoadingDates(true);
      const { data, error } = await supabase
        .from('exam_sessions')
        .select('exam_date')
        .ilike('exam_type', 'oral');
        
      if (!error && data) {
         let dates = Array.from(new Set(data.map(d => d.exam_date))).sort();
         
         if (selectedWeek && selectedWeek !== 'all') {
            const start = new Date(selectedWeek);
            const end = new Date(start);
            end.setDate(end.getDate() + 5); // 6 day week
            
            dates = dates.filter(d => {
               const date = new Date(d);
               // Simple string comparison works for YYYY-MM-DD but Date parsing is safer
               return d >= selectedWeek && date <= end;
            });
         }
         
         setAvailableDates(dates);
         if (dates.length > 0) {
           // Only set if not already set to a valid date
           setExamDate(prev => dates.includes(prev) ? prev : dates[0]);
         } else {
           setExamDate('');
         }
      }
      setLoadingDates(false);
    };
    fetchDates();
  }, [isOpen, selectedWeek, supabase]);

  // Fetch Oral Exam Sessions and Assignments when Date changes
  useEffect(() => {
    if (!examDate || !isOpen) {
      setAllSessionsData([]);
      setSelectedTime('');
      return;
    }

    const fetchOralExams = async () => {
      setLoadingData(true);
      setError(null);
      try {
        // Fetch only ORAL exams for the selected date unconditionally
        const { data, error } = await supabase
          .from('exam_sessions')
          .select(`
            id, start_time, exam_type, subject_name,
            room_id, room:rooms(id, room_name, building_code),
            assignments(id, role, staff_id, staff:staff(id, name))
          `)
          .eq('exam_date', examDate)
          .ilike('exam_type', 'oral')
          .order('start_time', { ascending: true });

        if (error) throw error;

        setAllSessionsData(data || []);
        
        // Auto-select first available time if any exist
        if (data && data.length > 0) {
           const times = Array.from(new Set(data.map(s => s.start_time)));
           if (times.length > 0 && !times.includes(selectedTime)) {
             setSelectedTime(times[0] as string);
           }
        } else {
           setSelectedTime('');
        }
        
        setRoom1Id('');
        setAssignment1Id('');
        setRoom2Id('');
        setAssignment2Id('');
      } catch (err: any) {
        setError('Failed to fetch oral exams: ' + err.message);
      } finally {
        setLoadingData(false);
      }
    };

    fetchOralExams();
  }, [examDate, isOpen, supabase]);

  // Derive filtered sessions based on selected time
  const sessionsData = allSessionsData.filter(s => s.start_time === selectedTime);
  const availableTimes = Array.from(new Set(allSessionsData.map(s => s.start_time))).sort();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!assignment1Id || !assignment2Id) {
      setError('Please select staff members from both rooms to swap.');
      return;
    }

    if (assignment1Id === assignment2Id) {
      setError('Cannot swap a staff member with themselves.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/assignments/internal-oral-swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId1: assignment1Id,
          assignmentId2: assignment2Id,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to swap assignments.');

      setSuccess(true);
      
      // Auto close after 2 seconds
      setTimeout(() => {
        window.location.reload(); // Reload to refresh schedule instantly
      }, 2000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 p-6 relative flex-shrink-0">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 p-1.5 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 text-white">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm border border-white/20">
              <ArrowRightLeft className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">HOD Internal Oral Swap</h2>
              <p className="text-orange-100 text-sm mt-0.5">Instantly swap oral exam supervisors between rooms</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {success ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Swap Executed!</h3>
              <p className="text-gray-500">The assignments have been instantly updated and scores recalculated.</p>
              <p className="text-xs text-gray-400 mt-4">Refreshing schedule...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 text-red-700 text-sm border border-red-200 rounded-xl">
                  {error}
                </div>
              )}

              {/* Step 1: Time Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Exam Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 bg-gray-50"
                      disabled={loadingDates || availableDates.length === 0}
                    >
                      {loadingDates ? (
                         <option value="">Loading dates...</option>
                      ) : availableDates.length === 0 ? (
                         <option value="">No Oral Exams found</option>
                      ) : (
                         availableDates.map(d => (
                            <option key={d} value={d}>{new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</option>
                         ))
                      )}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Period</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={selectedTime}
                      onChange={(e) => {
                         setSelectedTime(e.target.value);
                         setRoom1Id(''); setAssignment1Id(''); setRoom2Id(''); setAssignment2Id('');
                      }}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 bg-gray-50"
                      disabled={availableTimes.length === 0}
                    >
                      {availableTimes.length === 0 ? (
                        <option value="">No times available</option>
                      ) : (
                        availableTimes.map((t: any) => (
                           <option key={t} value={t}>Starts at {t}</option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
              </div>

              {loadingData && (
                <div className="flex items-center justify-center py-4 text-amber-600">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading Oral Exams...
                </div>
              )}

              {/* Step 2 & 3: Room Selection (Only show if date is selected and loading is false) */}
              {!loadingData && examDate && allSessionsData.length === 0 ? (
                <div className="text-center p-6 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-amber-800 font-medium">No Oral Exams scheduled for this date.</p>
                </div>
              ) : null}

              {!loadingData && sessionsData.length > 0 && (
                <div className="grid md:grid-cols-2 gap-6 bg-amber-50/50 p-4 rounded-2xl border border-amber-100">
                  
                  {/* ROOM 1 */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">First Room</label>
                      <div className="relative">
                        <DoorOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select
                          value={room1Id}
                          onChange={(e) => {
                            setRoom1Id(e.target.value);
                            setAssignment1Id('');
                          }}
                          className="w-full pl-9 pr-3 py-2.5 border border-amber-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 bg-white"
                          required
                        >
                          <option value="" disabled>Select Room 1</option>
                          {sessionsData.map((s: any) => (
                            <option key={s.room_id} value={s.room_id} disabled={s.room_id === room2Id}>
                              {s.room?.room_name} ({s.subject_name})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {room1Id && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Assigned Staff</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <select
                            value={assignment1Id}
                            onChange={(e) => setAssignment1Id(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 border border-amber-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 bg-white"
                            required
                          >
                            <option value="" disabled>Select Staff to Swap</option>
                            {(() => {
                              const session = sessionsData.find(s => s.room_id === room1Id);
                              if (!session || !session.assignments || session.assignments.length === 0) {
                                return <option disabled>No staff assigned</option>;
                              }
                              return session.assignments.map((a: any) => (
                                <option key={a.id} value={a.id}>{a.staff?.name} ({a.role.replace('_', ' ')})</option>
                              ));
                            })()}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ROOM 2 */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Second Room</label>
                      <div className="relative">
                        <DoorOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select
                          value={room2Id}
                          onChange={(e) => {
                            setRoom2Id(e.target.value);
                            setAssignment2Id('');
                          }}
                          className="w-full pl-9 pr-3 py-2.5 border border-amber-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 bg-white"
                          required
                        >
                          <option value="" disabled>Select Room 2</option>
                          {sessionsData.map((s: any) => (
                            <option key={s.room_id} value={s.room_id} disabled={s.room_id === room1Id}>
                              {s.room?.room_name} ({s.subject_name})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {room2Id && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Assigned Staff</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <select
                            value={assignment2Id}
                            onChange={(e) => setAssignment2Id(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 border border-amber-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 bg-white"
                            required
                          >
                            <option value="" disabled>Select Staff to Swap</option>
                            {(() => {
                              const session = sessionsData.find(s => s.room_id === room2Id);
                              if (!session || !session.assignments || session.assignments.length === 0) {
                                return <option disabled>No staff assigned</option>;
                              }
                              return session.assignments.map((a: any) => (
                                <option key={a.id} value={a.id}>{a.staff?.name} ({a.role.replace('_', ' ')})</option>
                              ));
                            })()}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!assignment1Id || !assignment2Id || isSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 rounded-xl shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:pointer-events-none transition-all"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                  Execute Swap
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
