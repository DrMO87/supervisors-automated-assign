'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Staff, Room, getPeriodFromTime } from '@/types/database.types';
import { Loader2, Calendar, Clock, DoorOpen, User, RefreshCw, LogOut, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function SwapRequestPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [roomList, setRoomList] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [examDate, setExamDate] = useState('');
  const [period, setPeriod] = useState<string>('1');
  const [roomId, setRoomId] = useState('');
  const [originalStaffId, setOriginalStaffId] = useState('');
  const [replacementStaffId, setReplacementStaffId] = useState('');

  const [sessionsData, setSessionsData] = useState<any[]>([]);
  const [freeStaffData, setFreeStaffData] = useState<any[]>([]);

  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [staffRes, roomRes] = await Promise.all([
          supabase.from('staff').select('*').order('name'),
          supabase.from('rooms').select('*').eq('is_active', true).order('room_name')
        ]);

        if (staffRes.error) throw staffRes.error;
        if (roomRes.error) throw roomRes.error;

        setStaffList(staffRes.data || []);
        setRoomList(roomRes.data || []);
      } catch (err: any) {
        setError('Failed to load form data: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [supabase]);

  // Fetch dynamic data when date/period change
  useEffect(() => {
    if (!examDate || !period) {
      setSessionsData([]);
      setFreeStaffData([]);
      return;
    }

    const fetchDynamic = async () => {
      const p = parseInt(period);
      const [sessionsRes, freeRes] = await Promise.all([
        supabase
          .from('exam_sessions')
          .select(`
            id, start_time, room_id,
            room:rooms(id, room_name, building_code),
            assignments(staff_id, staff:staff(*))
          `)
          .eq('exam_date', examDate),
        supabase
          .from('period_free_staff')
          .select(`staff_id, staff:staff(*)`)
          .eq('exam_date', examDate)
          .eq('period', p)
      ]);

      const filteredSessions = (sessionsRes.data || []).filter(s => getPeriodFromTime(s.start_time) === p);
      setSessionsData(filteredSessions);
      setFreeStaffData(freeRes.data || []);
      
      // Auto-clear room and assigned staff if they become invalid
      setRoomId('');
      setOriginalStaffId('');
    };

    fetchDynamic();
  }, [examDate, period, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examDate || !period || !roomId || !originalStaffId || !replacementStaffId) {
      setError('Please fill out all fields.');
      return;
    }
    if (originalStaffId === replacementStaffId) {
      setError('Currently assigned staff and replacement staff cannot be the same person.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase.from('swap_requests').insert({
        exam_date: examDate,
        period: parseInt(period),
        room_id: roomId,
        original_staff_id: originalStaffId,
        replacement_staff_id: replacementStaffId,
        status: 'pending'
      });

      if (error) throw error;
      setSuccess(true);
      
      // Reset form
      setExamDate('');
      setPeriod('1');
      setRoomId('');
      setOriginalStaffId('');
      setReplacementStaffId('');
    } catch (err: any) {
      setError('Failed to submit swap request: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute top-4 right-4">
        <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>

      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-primary-900 p-6 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('/images/pattern.svg')] opacity-10"></div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-24 h-12 relative mb-4">
              <Image src="/images/logo-session-master-transparent.png" alt="Logo" fill className="object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Shift Swap Request</h1>
            <p className="text-primary-100 text-sm">Propose a replacement for your scheduled shift</p>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-green-800">Request Submitted Successfully</h3>
                <p className="text-sm text-green-700 mt-1">
                  Your swap request has been sent to the administrator for approval. You will be notified once it is reviewed.
                </p>
                <button onClick={() => setSuccess(false)} className="text-sm text-green-800 font-medium underline mt-2 hover:text-green-900">
                  Submit another request
                </button>
              </div>
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 font-medium">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="date"
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                      className="block w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Period</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      className="block w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 bg-white"
                      required
                    >
                      <option value="1">Period 1 (09:00 - 11:00)</option>
                      <option value="2">Period 2 (13:00 - 15:00)</option>
                      <option value="3">Period 3 (15:45 - 17:45)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Exam Room</label>
                <div className="relative">
                  <DoorOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={roomId}
                    onChange={(e) => { setRoomId(e.target.value); setOriginalStaffId(''); }}
                    className="block w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 bg-white"
                    required
                  >
                    <option value="" disabled>Select a room...</option>
                    {Array.from(new Map(
                      sessionsData.filter(s => s.room).map(s => [s.room_id, s.room])
                    ).values())
                    .sort((a: any, b: any) => a.room_name.localeCompare(b.room_name))
                    .map((r: any) => (
                      <option key={r.id} value={r.id}>{r.room_name} (Bld: {r.building_code || '?'})</option>
                    ))}
                  </select>
                </div>
                {examDate && period && sessionsData.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No exam rooms found for this date and period.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Currently Assigned Staff (or Reserve)</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={originalStaffId}
                    onChange={(e) => setOriginalStaffId(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 bg-white"
                    required
                    disabled={!roomId}
                  >
                    <option value="" disabled>{roomId ? "Select staff member..." : "Select room first"}</option>
                    {(() => {
                      const roomSessions = sessionsData.filter(s => s.room_id === roomId);
                      const assignedStaff = roomSessions.flatMap(s => (s.assignments || []).map((a: any) => a.staff));
                      const reserveStaff = freeStaffData.map(f => f.staff);
                      const eligibleOriginalStaff = [...assignedStaff, ...reserveStaff].filter(Boolean);
                      const uniqueOriginalStaff = Array.from(new Map(eligibleOriginalStaff.map((s: any) => [s.id, s])).values())
                        .sort((a: any, b: any) => a.name.localeCompare(b.name));
                      
                      return uniqueOriginalStaff.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.job_title}) {reserveStaff.find(r => r.id === s.id) ? '[Reserve]' : ''}
                        </option>
                      ));
                    })()}
                  </select>
                </div>
              </div>

              <div className="relative flex justify-center py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                <div className="relative bg-white px-3 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Proposed Replacement</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
                  <select
                    value={replacementStaffId}
                    onChange={(e) => setReplacementStaffId(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 bg-white"
                    required
                  >
                    <option value="" disabled>Select replacement...</option>
                    {staffList.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.job_title})</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Submitting Request...</>
                ) : (
                  'Submit Swap Request'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
