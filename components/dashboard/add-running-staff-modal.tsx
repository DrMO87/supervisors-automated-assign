'use client';

import { Fragment, useState, useEffect, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  X, Users, Calendar, Clock, Plus, Loader2, AlertCircle,
  CheckCircle, Building2, PersonStanding, Zap, ShieldCheck
} from 'lucide-react';
import { format } from 'date-fns';
import type { Staff, ExamSessionWithRelations, AssignmentRole } from '@/types/database.types';
import { supabase } from '@/lib/supabase/client';
import { useSchedulingStore } from '@/lib/stores/scheduling-store';
import {
  calculateRequiredStaff,
  getRoomBuilding,
} from '@/lib/algorithms/auto-assignment';

// ── Building Proximity Groups ────────────────────────────────────────────────
// M, P, E buildings are near each other (Zone 0)
// S, F, A buildings are near each other (Zone 1)
export function getBuildingGroup(buildingCode: string): number {
  if (!buildingCode) return -1;
  const upper = buildingCode.trim().toUpperCase();
  if (upper.startsWith('M') || upper.startsWith('P') || upper.startsWith('E')) {
    return 0; // M, P, E zone
  }
  if (upper.startsWith('S') || upper.startsWith('F') || upper.startsWith('A')) {
    return 1; // S, F, A zone
  }
  return -1; // Other
}

const GROUP_META: Record<number, { label: string; color: string; bg: string; border: string; badge: string }> = {
  0: { label: 'M / P / E Zone', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-800' },
  1: { label: 'S / F / A Zone', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-800' },
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface RunningCandidate {
  staff: Staff;
  fromBuilding: string;
  fromRoom: string;
  fromSubject: string;
  fromGroup: number;
}

export interface VacantRoom {
  session: ExamSessionWithRelations;
  building: string;
  roomName: string;
  assignedCount: number;
  requiredCount: number;
  vacantSlots: number;
  group: number;
}

export interface AddRunningStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  period: number;
  currentPeriodSessions: ExamSessionWithRelations[];
  previousPeriodSessions: ExamSessionWithRelations[];
  gapMinutes: number;
  onUpdate: () => void;
}

export function AddRunningStaffModal({
  isOpen,
  onClose,
  dateStr,
  period,
  currentPeriodSessions,
  previousPeriodSessions,
  gapMinutes,
  onUpdate,
}: AddRunningStaffModalProps) {
  const { staff, systemSettings, staffingRatios } = useSchedulingStore();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const calendarRules = useMemo(() => {
    const cr = systemSettings?.find((s: any) => s.setting_key === 'calendar_rules');
    return cr?.setting_value || [];
  }, [systemSettings]);

  const fullStaffingRatiosConfig = useMemo(() => {
    const rs = systemSettings?.find((s: any) => s.setting_key === 'staffing_ratios');
    return rs?.setting_value || { ranges: staffingRatios };
  }, [systemSettings, staffingRatios]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // ── 1. Running Candidates: staff assigned in previous period who are free now ──
  const runningCandidates = useMemo<RunningCandidate[]>(() => {
    const candidates: RunningCandidate[] = [];
    const seenStaffIds = new Set<string>();

    // Staff already assigned anywhere in the current period cannot be runners
    const currentlyAssignedStaffIds = new Set<string>();
    currentPeriodSessions.forEach(s => {
      s.assignments?.forEach((a: any) => {
        if (a.staff_id) currentlyAssignedStaffIds.add(a.staff_id);
      });
    });

    for (const session of previousPeriodSessions) {
      if (!session.assignments) continue;
      const roomName = (session.room as any)?.room_name || '';
      const building = getRoomBuilding(session.room as any, roomName);

      for (const assignment of session.assignments as any[]) {
        const staffId = assignment.staff_id;
        if (!staffId || seenStaffIds.has(staffId)) continue;
        if (currentlyAssignedStaffIds.has(staffId)) continue;

        const staffMember = assignment.staff || staff.find(s => s.id === staffId);
        if (!staffMember) continue;
        if (staffMember.availability_status !== 'Available') continue;

        seenStaffIds.add(staffId);
        candidates.push({
          staff: staffMember,
          fromBuilding: building,
          fromRoom: roomName,
          fromSubject: session.subject_name || '',
          fromGroup: getBuildingGroup(building),
        });
      }
    }

    return candidates.sort((a, b) => a.staff.name.localeCompare(b.staff.name));
  }, [previousPeriodSessions, currentPeriodSessions, staff]);

  // ── 2. Only rooms that have VACANT places (leave already filled rooms untouched) ──
  const vacantRooms = useMemo<VacantRoom[]>(() => {
    return currentPeriodSessions
      .map(session => {
        const isOral = !!session.exam_type?.toLowerCase().includes('oral');
        const req = calculateRequiredStaff(
          session.student_count || 0,
          fullStaffingRatiosConfig,
          isOral,
          session.exam_date,
          calendarRules
        );
        const requiredCount = isOral ? 1 : (req.headSupervisors + req.assistants + 1);
        const assignedCount = session.assignments?.length ?? 0;
        const vacantSlots = Math.max(0, requiredCount - assignedCount);
        const roomName = (session.room as any)?.room_name || '';
        const building = getRoomBuilding(session.room as any, roomName);

        return {
          session,
          building,
          roomName,
          assignedCount,
          requiredCount,
          vacantSlots,
          group: getBuildingGroup(building),
        };
      })
      .filter(r => r.vacantSlots > 0)
      .sort((a, b) => b.vacantSlots - a.vacantSlots);
  }, [currentPeriodSessions, fullStaffingRatiosConfig, calendarRules]);

  // ── 3. Group vacant rooms by proximity zone ────────────────────────────────
  const vacantByGroup = useMemo(() => {
    const map = new Map<number, VacantRoom[]>();
    vacantRooms.forEach(r => {
      const g = r.group;
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(r);
    });
    return map;
  }, [vacantRooms]);

  // ── 4. Candidates matching each zone ───────────────────────────────────────
  const candidatesByGroup = useMemo(() => {
    const map = new Map<number, RunningCandidate[]>();
    for (const [groupIdx] of vacantByGroup) {
      const matching = runningCandidates.filter(c => c.fromGroup === groupIdx);
      map.set(groupIdx, matching);
    }
    return map;
  }, [runningCandidates, vacantByGroup]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  // Single runner assignment
  const handleAssignSingle = async (staffMember: Staff, room: VacantRoom) => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const isOral = !!room.session.exam_type?.toLowerCase().includes('oral');
      const examSupervisorsCount = room.session.assignments?.filter((a: any) => a.role === 'Exam_Supervisor').length ?? 0;
      let role: AssignmentRole = 'Assistant';
      if (!isOral && examSupervisorsCount < 1 && (staffMember.supervision_role === 'Exam Supervisor' || staffMember.supervision_role === 'Invigilator / Exam Supervisor')) {
        role = 'Exam_Supervisor';
      }

      const { error: insertError } = await supabase.from('assignments').insert({
        exam_session_id: room.session.id,
        staff_id: staffMember.id,
        role,
        is_manual_override: true,
      });

      if (insertError) throw insertError;

      // Update staff score
      await supabase
        .from('staff')
        .update({ current_score: (staffMember.current_score || 0) + 1 })
        .eq('id', staffMember.id);

      setMessage({ type: 'success', text: `${staffMember.name.split(' ')[0]} assigned as runner to ${room.roomName}!` });
      onUpdate();
    } catch (error: any) {
      console.error('Error assigning running staff:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to assign runner' });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fill all vacant rooms in a zone with nearby runners
  const handleAutoFillZone = async (groupIdx: number) => {
    if (!supabase) return;
    const roomsInZone = vacantByGroup.get(groupIdx) || [];
    const availableRunners = [...(candidatesByGroup.get(groupIdx) || [])];

    if (roomsInZone.length === 0 || availableRunners.length === 0) {
      setMessage({ type: 'error', text: 'No matching runners or vacant rooms in this zone' });
      return;
    }

    setIsLoading(true);
    try {
      let assignedCount = 0;
      const assignmentsToInsert: any[] = [];
      const updatedStaffScores = new Map<string, number>();

      for (const room of roomsInZone) {
        let remainingVacancies = room.vacantSlots;
        const alreadyAssignedStaffInRoom = new Set((room.session.assignments || []).map((a: any) => a.staff_id));

        while (remainingVacancies > 0 && availableRunners.length > 0) {
          // Find first runner not already in this room
          const runnerIdx = availableRunners.findIndex(r => !alreadyAssignedStaffInRoom.has(r.staff.id));
          if (runnerIdx === -1) break;

          const runner = availableRunners.splice(runnerIdx, 1)[0];
          alreadyAssignedStaffInRoom.add(runner.staff.id);

          const isOral = !!room.session.exam_type?.toLowerCase().includes('oral');
          let role: AssignmentRole = 'Assistant';
          if (!isOral && (runner.staff.supervision_role === 'Exam Supervisor' || runner.staff.supervision_role === 'Invigilator / Exam Supervisor')) {
            role = 'Exam_Supervisor';
          }

          assignmentsToInsert.push({
            exam_session_id: room.session.id,
            staff_id: runner.staff.id,
            role,
            is_manual_override: true,
          });

          updatedStaffScores.set(runner.staff.id, (runner.staff.current_score || 0) + 1);
          remainingVacancies--;
          assignedCount++;
        }
      }

      if (assignmentsToInsert.length === 0) {
        setMessage({ type: 'error', text: 'Could not assign runners to these rooms.' });
        setIsLoading(false);
        return;
      }

      const { error: insertErr } = await supabase.from('assignments').insert(assignmentsToInsert);
      if (insertErr) throw insertErr;

      // Update scores
      for (const [staffId, newScore] of updatedStaffScores.entries()) {
        await supabase.from('staff').update({ current_score: newScore }).eq('id', staffId);
      }

      setMessage({ type: 'success', text: `Successfully filled ${assignedCount} vacancy slots with nearby runners!` });
      onUpdate();
    } catch (err: any) {
      console.error('Error auto-filling runners:', err);
      setMessage({ type: 'error', text: err.message || 'Auto-assignment failed' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const totalVacancies = vacantRooms.reduce((sum, r) => sum + r.vacantSlots, 0);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all flex flex-col max-h-[90vh] border border-gray-200">

                {/* ── Header ─────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-orange-100 rounded-xl text-orange-600 shadow-sm">
                      <PersonStanding className="w-6 h-6" />
                    </div>
                    <div>
                      <Dialog.Title as="h3" className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        Add Running Staff (Period {period})
                      </Dialog.Title>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Free staff from the previous period available to run to nearby vacant rooms
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white/80 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* ── Info Bar ────────────────────────────────────────── */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-gray-100 bg-gray-50 text-xs">
                  <div className="flex items-center gap-4 text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span className="font-semibold text-gray-800">
                        {format(new Date(dateStr + 'T12:00:00Z'), 'EEEE, MMMM d, yyyy')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <span>Period {period} (Gap: {gapMinutes}m from previous)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700">
                      {totalVacancies} Vacant Spot{totalVacancies !== 1 ? 's' : ''} ({vacantRooms.length} rooms)
                    </span>
                    <span className="font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                      {runningCandidates.length} Free Runner{runningCandidates.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* ── Content ─────────────────────────────────────────── */}
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                  {/* Feedback Message */}
                  {message && (
                    <div className={`flex items-center gap-2.5 p-3 rounded-xl text-sm font-medium border ${
                      message.type === 'success'
                        ? 'bg-green-50 text-green-800 border-green-200'
                        : 'bg-red-50 text-red-800 border-red-200'
                    }`}>
                      {message.type === 'success' ? (
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                      )}
                      <span>{message.text}</span>
                    </div>
                  )}

                  {/* Proximity Rule Notice */}
                  <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-800 leading-relaxed">
                      <strong className="font-bold">Proximity Rule Active:</strong>
                      <span className="ml-1">
                        Only candidates from nearby buildings are suggested to ensure safe physical transit:
                      </span>
                      <div className="flex flex-wrap gap-3 mt-1.5 font-medium">
                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          Zone 1: Buildings M, P, E
                        </span>
                        <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                          Zone 2: Buildings S, F, A
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Empty States */}
                  {previousPeriodSessions.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="p-4 bg-gray-100 rounded-full mb-3">
                        <Clock className="w-8 h-8 text-gray-400" />
                      </div>
                      <h4 className="text-base font-bold text-gray-700">First Period of the Day</h4>
                      <p className="text-xs text-gray-500 mt-1 max-w-sm">
                        Period {period} is the first scheduled period on this day. Running staff can only be drawn from preceding periods.
                      </p>
                    </div>
                  )}

                  {previousPeriodSessions.length > 0 && vacantRooms.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="p-4 bg-green-100 rounded-full mb-3">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                      </div>
                      <h4 className="text-base font-bold text-green-800">All Rooms Are Fully Staffed!</h4>
                      <p className="text-xs text-gray-500 mt-1 max-w-sm">
                        There are no vacant places in Period {period}. Already filled rooms are left untouched.
                      </p>
                    </div>
                  )}

                  {previousPeriodSessions.length > 0 && vacantRooms.length > 0 && runningCandidates.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="p-4 bg-amber-100 rounded-full mb-3">
                        <Users className="w-8 h-8 text-amber-600" />
                      </div>
                      <h4 className="text-base font-bold text-gray-700">No Eligible Runners Available</h4>
                      <p className="text-xs text-gray-500 mt-1 max-w-sm">
                        All staff who supervised in the previous period are already scheduled in Period {period}.
                      </p>
                    </div>
                  )}

                  {/* ── Vacant Zones ───────────────────────────────────── */}
                  {Array.from(vacantByGroup.entries()).map(([groupIdx, rooms]) => {
                    const meta = GROUP_META[groupIdx] || {
                      label: 'Other Buildings',
                      color: 'text-gray-700',
                      bg: 'bg-gray-50',
                      border: 'border-gray-200',
                      badge: 'bg-gray-100 text-gray-700',
                    };
                    const zoneCandidates = candidatesByGroup.get(groupIdx) || [];
                    const zoneVacancies = rooms.reduce((sum, r) => sum + r.vacantSlots, 0);

                    return (
                      <div key={groupIdx} className={`rounded-2xl border ${meta.border} overflow-hidden shadow-sm`}>
                        {/* Zone Header */}
                        <div className={`${meta.bg} px-5 py-3 border-b ${meta.border} flex flex-wrap items-center justify-between gap-3`}>
                          <div className="flex items-center gap-2.5">
                            <Building2 className={`w-5 h-5 ${meta.color}`} />
                            <span className={`font-bold text-sm ${meta.color}`}>{meta.label}</span>
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${meta.badge}`}>
                              {rooms.length} vacant room{rooms.length !== 1 ? 's' : ''} ({zoneVacancies} spots)
                            </span>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white text-gray-600 border border-gray-200">
                              {zoneCandidates.length} runner{zoneCandidates.length !== 1 ? 's' : ''} nearby
                            </span>
                          </div>

                          {zoneCandidates.length > 0 && (
                            <button
                              onClick={() => handleAutoFillZone(groupIdx)}
                              disabled={isLoading}
                              className="flex items-center gap-1.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 px-3 py-1.5 rounded-lg shadow-sm transition-all disabled:opacity-50"
                            >
                              <Zap className="w-3.5 h-3.5" />
                              Auto-Fill Zone Runners
                            </button>
                          )}
                        </div>

                        {/* Rooms List */}
                        <div className="p-4 bg-white divide-y divide-gray-100 space-y-4">
                          {rooms.map(room => (
                            <div key={room.session.id} className="pt-3 first:pt-0">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h5 className="font-bold text-sm text-gray-900 leading-tight">
                                      {room.session.subject_name}
                                    </h5>
                                    {room.session.exam_type?.toLowerCase().includes('oral') && (
                                      <span className="text-[9px] font-bold uppercase bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded">
                                        Oral
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                    <span className="font-medium text-gray-700 flex items-center gap-1">
                                      <Building2 className="w-3 h-3 text-gray-400" />
                                      {room.roomName}
                                    </span>
                                    <span>·</span>
                                    <span>{room.session.student_count} students</span>
                                    <span>·</span>
                                    <span className="text-red-600 font-semibold">
                                      Needs {room.vacantSlots} more staff
                                    </span>
                                  </div>
                                </div>

                                <span className="text-xs font-bold px-2 py-1 rounded-md bg-red-50 text-red-700 border border-red-200 flex-shrink-0">
                                  {room.assignedCount} / {room.requiredCount} Staff
                                </span>
                              </div>

                              {/* Candidate Runner Chips */}
                              <div className="mt-2.5">
                                <p className="text-[10px] uppercase font-bold text-gray-400 mb-1.5">
                                  Assign Runner From Previous Period:
                                </p>
                                {zoneCandidates.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {zoneCandidates.map(c => {
                                      const alreadyAssigned = room.session.assignments?.some(
                                        (a: any) => a.staff_id === c.staff.id
                                      );
                                      if (alreadyAssigned) return null;

                                      return (
                                        <button
                                          key={c.staff.id}
                                          onClick={() => handleAssignSingle(c.staff, room)}
                                          disabled={isLoading}
                                          className="group inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-900 text-gray-700 transition-all shadow-xs disabled:opacity-50"
                                          title={`From: ${c.fromRoom} (${c.fromSubject})\nRole: ${c.staff.supervision_role}`}
                                        >
                                          <Plus className="w-3.5 h-3.5 text-gray-400 group-hover:text-orange-600" />
                                          <span className="font-semibold">{c.staff.name}</span>
                                          <span className="text-[10px] text-gray-400 group-hover:text-orange-600">
                                            (from {c.fromRoom.split(' ').pop() || c.fromBuilding})
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-400 italic">
                                    No runners available from nearby buildings ({meta.label})
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Footer ──────────────────────────────────────────── */}
                <div className="px-6 py-3.5 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Only vacant slots are assigned · Filled rooms remain untouched
                  </p>
                  <button
                    onClick={onClose}
                    className="px-5 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors shadow-sm"
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
