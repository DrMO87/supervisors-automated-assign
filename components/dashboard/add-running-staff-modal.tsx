'use client';

import { Fragment, useState, useEffect, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  X, Users, Calendar, Clock, Plus, Loader2, AlertCircle,
  CheckCircle, Building2, PersonStanding, Zap, ShieldCheck, Sparkles, Filter
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
// M, P, E buildings are in Zone 1 (0)
// S, F, A buildings are in Zone 2 (1)
export function getBuildingGroup(buildingCode: string): number {
  if (!buildingCode) return -1;
  const upper = buildingCode.trim().toUpperCase();
  if (upper.startsWith('M') || upper.startsWith('P') || upper.startsWith('E')) {
    return 0; // Zone 1: M, P, E
  }
  if (upper.startsWith('S') || upper.startsWith('F') || upper.startsWith('A')) {
    return 1; // Zone 2: S, F, A
  }
  return -1; // Other
}

export const ZONE_CONFIG = {
  0: {
    name: 'Zone 1 (M / P / E)',
    shortName: 'Zone 1 (M, P, E)',
    buildings: 'M, M1, M2, P, E',
    color: 'text-blue-700',
    headerBg: 'bg-blue-50',
    borderColor: 'border-blue-200',
    chipBg: 'bg-blue-50/90 hover:bg-blue-100/90 text-blue-900 border-blue-300',
    badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
    dotColor: 'bg-blue-500',
  },
  1: {
    name: 'Zone 2 (S / F / A)',
    shortName: 'Zone 2 (S, F, A)',
    buildings: 'S, F, A',
    color: 'text-emerald-700',
    headerBg: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    chipBg: 'bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-900 border-emerald-300',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dotColor: 'bg-emerald-500',
  },
  other: {
    name: 'Other Buildings',
    shortName: 'Other',
    buildings: 'Other',
    color: 'text-gray-700',
    headerBg: 'bg-gray-50',
    borderColor: 'border-gray-200',
    chipBg: 'bg-gray-50 hover:bg-gray-100 text-gray-800 border-gray-200',
    badgeBg: 'bg-gray-100 text-gray-700 border-gray-200',
    dotColor: 'bg-gray-400',
  },
};

export function getStaffScore(s: Staff): string | number {
  const base = s.current_score || 0;
  const reserves = (s.free_staff_score || 0) * 0.25;
  const total = base + reserves;
  return Number.isInteger(total) ? total : total.toFixed(2);
}

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
  const [filterZone, setFilterZone] = useState<'all' | '0' | '1'>('all');
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

    return candidates.sort((a, b) => {
      const scoreA = (a.staff.current_score || 0) + ((a.staff.free_staff_score || 0) * 0.25);
      const scoreB = (b.staff.current_score || 0) + ((b.staff.free_staff_score || 0) * 0.25);
      if (scoreA !== scoreB) return scoreA - scoreB;
      return a.staff.name.localeCompare(b.staff.name);
    });
  }, [previousPeriodSessions, currentPeriodSessions, staff]);

  // Separate candidates by zone for clear visibility
  const zone1Candidates = useMemo(() => runningCandidates.filter(c => c.fromGroup === 0), [runningCandidates]);
  const zone2Candidates = useMemo(() => runningCandidates.filter(c => c.fromGroup === 1), [runningCandidates]);
  const otherCandidates = useMemo(() => runningCandidates.filter(c => c.fromGroup !== 0 && c.fromGroup !== 1), [runningCandidates]);

  // ── 2. Only rooms that have VACANT places ──
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

  // Group vacant rooms by proximity zone
  const vacantByGroup = useMemo(() => {
    const map = new Map<number, VacantRoom[]>();
    vacantRooms.forEach(r => {
      const g = r.group;
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(r);
    });
    return map;
  }, [vacantRooms]);

  // Filtered rooms based on user selection
  const filteredRooms = useMemo(() => {
    if (filterZone === 'all') return vacantRooms;
    return vacantRooms.filter(r => r.group === Number(filterZone));
  }, [vacantRooms, filterZone]);

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

  // Auto-fill all vacant rooms: prioritizes same-zone runners first, then cross-zone runners so rooms are filled!
  const handleAutoFill = async (sameZoneOnly: boolean = false) => {
    if (!supabase) return;
    if (vacantRooms.length === 0 || runningCandidates.length === 0) {
      setMessage({ type: 'error', text: 'No vacant rooms or runners available' });
      return;
    }

    setIsLoading(true);
    try {
      let assignedCount = 0;
      const assignmentsToInsert: any[] = [];
      const updatedStaffScores = new Map<string, number>();
      const availableRunners = [...runningCandidates];

      // Pass 1: Try to match each room with runners from the SAME zone
      for (const room of vacantRooms) {
        let remainingVacancies = room.vacantSlots;
        const alreadyAssigned = new Set((room.session.assignments || []).map((a: any) => a.staff_id));

        while (remainingVacancies > 0) {
          const runnerIdx = availableRunners.findIndex(
            r => !alreadyAssigned.has(r.staff.id) && r.fromGroup === room.group
          );
          if (runnerIdx === -1) break;

          const runner = availableRunners.splice(runnerIdx, 1)[0];
          alreadyAssigned.add(runner.staff.id);

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

      // Pass 2: If not sameZoneOnly, fill remaining vacancies with runners from ANY zone
      if (!sameZoneOnly) {
        for (const room of vacantRooms) {
          const newlyAssigned = assignmentsToInsert.filter(a => a.exam_session_id === room.session.id).length;
          let remainingVacancies = room.vacantSlots - newlyAssigned;
          const alreadyAssigned = new Set([
            ...(room.session.assignments || []).map((a: any) => a.staff_id),
            ...assignmentsToInsert.filter(a => a.exam_session_id === room.session.id).map(a => a.staff_id),
          ]);

          while (remainingVacancies > 0 && availableRunners.length > 0) {
            const runnerIdx = availableRunners.findIndex(r => !alreadyAssigned.has(r.staff.id));
            if (runnerIdx === -1) break;

            const runner = availableRunners.splice(runnerIdx, 1)[0];
            alreadyAssigned.add(runner.staff.id);

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
      }

      if (assignmentsToInsert.length === 0) {
        setMessage({ type: 'error', text: 'No eligible runners could be assigned.' });
        setIsLoading(false);
        return;
      }

      const { error: insertErr } = await supabase.from('assignments').insert(assignmentsToInsert);
      if (insertErr) throw insertErr;

      // Update scores
      for (const [staffId, newScore] of updatedStaffScores.entries()) {
        await supabase.from('staff').update({ current_score: newScore }).eq('id', staffId);
      }

      setMessage({ type: 'success', text: `Successfully filled ${assignedCount} vacancy slots!` });
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
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all flex flex-col max-h-[92vh] border border-gray-200">

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
                        Free staff from the previous period who can run to fill vacant rooms
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

                {/* ── Info & Zone Highlights Bar ────────────────────────── */}
                <div className="flex flex-col gap-2 px-6 py-3 border-b border-gray-100 bg-gray-50 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-3">
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
                      <span className="font-bold px-2.5 py-1 rounded-full bg-gray-200 text-gray-800">
                        {runningCandidates.length} Total Runners
                      </span>
                    </div>
                  </div>

                  {/* ── Highlighted Zone Pools ── */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-200/60">
                    <span className="text-[11px] font-bold text-gray-500 uppercase mr-1">Available Runners Pool:</span>
                    
                    {/* Zone 1 Pool Badge */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 font-semibold shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      <span>Zone 1 (M / P / E):</span>
                      <span className="bg-blue-600 text-white text-[11px] font-bold px-1.5 py-0.2 rounded-full ml-0.5">
                        {zone1Candidates.length} staff
                      </span>
                    </div>

                    {/* Zone 2 Pool Badge */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Zone 2 (S / F / A):</span>
                      <span className="bg-emerald-600 text-white text-[11px] font-bold px-1.5 py-0.2 rounded-full ml-0.5">
                        {zone2Candidates.length} staff
                      </span>
                    </div>

                    {otherCandidates.length > 0 && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 border border-gray-200 text-gray-700 font-semibold">
                        <span>Other: {otherCandidates.length}</span>
                      </div>
                    )}

                    {/* Quick Auto-Fill Buttons */}
                    {runningCandidates.length > 0 && vacantRooms.length > 0 && (
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          onClick={() => handleAutoFill(false)}
                          disabled={isLoading}
                          className="flex items-center gap-1.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 px-3 py-1.5 rounded-lg shadow-sm transition-all disabled:opacity-50"
                          title="Fills all vacancies: matches same-zone runners first, then cross-zone runners if needed"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          Auto-Fill All Vacancies
                        </button>
                      </div>
                    )}
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

                  {/* Empty States */}
                  {previousPeriodSessions.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="p-4 bg-gray-100 rounded-full mb-3">
                        <Clock className="w-8 h-8 text-gray-400" />
                      </div>
                      <h4 className="text-base font-bold text-gray-700">First Period of the Day</h4>
                      <p className="text-xs text-gray-500 mt-1 max-w-sm">
                        Period {period} is the first scheduled period on this day. Running staff are drawn from the previous period.
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
                        There are no vacant places in Period {period}. Filled rooms are untouched.
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

                  {/* ── Vacant Rooms List with Both Zone Runners Highlighted ── */}
                  {vacantRooms.length > 0 && runningCandidates.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-500" />
                          Rooms With Vacant Slots ({vacantRooms.length})
                        </h4>
                        <span className="text-[11px] text-gray-400">
                          Click any runner chip below a room to assign them immediately
                        </span>
                      </div>

                      {vacantRooms.map(room => {
                        const roomZone = room.group;
                        const roomZoneConfig = roomZone === 0 ? ZONE_CONFIG[0] : roomZone === 1 ? ZONE_CONFIG[1] : ZONE_CONFIG.other;

                        // Sort running candidates so that same-zone candidates appear first, but BOTH zones are shown!
                        const sortedCandidates = [...runningCandidates].sort((a, b) => {
                          const aIsSame = a.fromGroup === roomZone;
                          const bIsSame = b.fromGroup === roomZone;
                          if (aIsSame && !bIsSame) return -1;
                          if (!aIsSame && bIsSame) return 1;
                          return a.fromGroup - b.fromGroup;
                        });

                        return (
                          <div
                            key={room.session.id}
                            className={`rounded-2xl border ${roomZoneConfig.borderColor} bg-white shadow-xs p-4 hover:shadow-md transition-all`}
                          >
                            {/* Room Header */}
                            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-3 mb-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h5 className="font-bold text-sm text-gray-900 leading-tight">
                                    {room.session.subject_name}
                                  </h5>
                                  {room.session.program && (
                                    <span className="text-[10px] text-gray-500 font-medium">
                                      ({room.session.program})
                                    </span>
                                  )}
                                  {room.session.exam_type?.toLowerCase().includes('oral') && (
                                    <span className="text-[9px] font-bold uppercase bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded">
                                      Oral
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                  <span className="font-bold text-gray-800 flex items-center gap-1">
                                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                                    {room.roomName}
                                  </span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${roomZoneConfig.badgeBg}`}>
                                    {roomZoneConfig.name}
                                  </span>
                                  <span>·</span>
                                  <span>{room.session.student_count} students</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200">
                                  {room.assignedCount} / {room.requiredCount} Staff
                                </span>
                                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-orange-100 text-orange-800">
                                  Needs {room.vacantSlots} more
                                </span>
                              </div>
                            </div>

                            {/* Runners Selection Area: BOTH ZONES SHOWN & HIGHLIGHTED */}
                            <div className="space-y-2.5">
                              {/* 1. Zone 1 (M / P / E) Runners */}
                              {zone1Candidates.length > 0 && (
                                <div>
                                  <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-bold text-blue-800">
                                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                                    <span>Zone 1 Staff (M / P / E)</span>
                                    {roomZone === 0 && (
                                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-semibold ml-1">
                                        ★ Same Zone (Near)
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {zone1Candidates.map(c => {
                                      const alreadyAssigned = room.session.assignments?.some(
                                        (a: any) => a.staff_id === c.staff.id
                                      );
                                      if (alreadyAssigned) return null;

                                      const isSameZone = roomZone === 0;

                                      return (
                                        <button
                                          key={c.staff.id}
                                          onClick={() => handleAssignSingle(c.staff, room)}
                                          disabled={isLoading}
                                          className={`group inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all shadow-xs disabled:opacity-50 ${
                                            isSameZone
                                              ? 'bg-blue-50/90 border-blue-400 text-blue-900 hover:bg-blue-100 ring-1 ring-blue-300'
                                              : 'bg-blue-50/40 border-blue-200 text-blue-800 hover:bg-blue-100/70'
                                          }`}
                                          title={`From: ${c.fromRoom} (${c.fromSubject})\nRole: ${c.staff.supervision_role}\nScore: ${getStaffScore(c.staff)}\nZone: 1 (M/P/E)`}
                                        >
                                          <Plus className="w-3.5 h-3.5 text-blue-600 group-hover:scale-125 transition-transform" />
                                          <span className="font-bold">{c.staff.name}</span>
                                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-200">
                                            Score: {getStaffScore(c.staff)}
                                          </span>
                                          <span className="text-[10px] text-blue-600 font-medium">
                                            (from {c.fromRoom.split(' ').pop() || c.fromBuilding})
                                          </span>
                                          {isSameZone && (
                                            <span className="text-[9px] font-bold text-blue-800 bg-blue-200/80 px-1 py-0.2 rounded">
                                              Optimal
                                            </span>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* 2. Zone 2 (S / F / A) Runners */}
                              {zone2Candidates.length > 0 && (
                                <div className={zone1Candidates.length > 0 ? 'pt-2 border-t border-gray-100' : ''}>
                                  <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-bold text-emerald-800">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span>Zone 2 Staff (S / F / A)</span>
                                    {roomZone === 1 && (
                                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded font-semibold ml-1">
                                        ★ Same Zone (Near)
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {zone2Candidates.map(c => {
                                      const alreadyAssigned = room.session.assignments?.some(
                                        (a: any) => a.staff_id === c.staff.id
                                      );
                                      if (alreadyAssigned) return null;

                                      const isSameZone = roomZone === 1;

                                      return (
                                        <button
                                          key={c.staff.id}
                                          onClick={() => handleAssignSingle(c.staff, room)}
                                          disabled={isLoading}
                                          className={`group inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all shadow-xs disabled:opacity-50 ${
                                            isSameZone
                                              ? 'bg-emerald-50/90 border-emerald-400 text-emerald-900 hover:bg-emerald-100 ring-1 ring-emerald-300'
                                              : 'bg-emerald-50/40 border-emerald-200 text-emerald-800 hover:bg-emerald-100/70'
                                          }`}
                                          title={`From: ${c.fromRoom} (${c.fromSubject})\nRole: ${c.staff.supervision_role}\nScore: ${getStaffScore(c.staff)}\nZone: 2 (S/F/A)`}
                                        >
                                          <Plus className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-125 transition-transform" />
                                          <span className="font-bold">{c.staff.name}</span>
                                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-200">
                                            Score: {getStaffScore(c.staff)}
                                          </span>
                                          <span className="text-[10px] text-emerald-600 font-medium">
                                            (from {c.fromRoom.split(' ').pop() || c.fromBuilding})
                                          </span>
                                          {isSameZone && (
                                            <span className="text-[9px] font-bold text-emerald-800 bg-emerald-200/80 px-1 py-0.2 rounded">
                                              Optimal
                                            </span>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* 3. Other Building Runners */}
                              {otherCandidates.length > 0 && (
                                <div className="pt-2 border-t border-gray-100">
                                  <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-bold text-gray-700">
                                    <span className="w-2 h-2 rounded-full bg-gray-400" />
                                    <span>Other Building Staff</span>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {otherCandidates.map(c => {
                                      const alreadyAssigned = room.session.assignments?.some(
                                        (a: any) => a.staff_id === c.staff.id
                                      );
                                      if (alreadyAssigned) return null;

                                      return (
                                        <button
                                          key={c.staff.id}
                                          onClick={() => handleAssignSingle(c.staff, room)}
                                          disabled={isLoading}
                                          className="group inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-800 transition-all shadow-xs disabled:opacity-50"
                                          title={`From: ${c.fromRoom} (${c.fromSubject})\nRole: ${c.staff.supervision_role}\nScore: ${getStaffScore(c.staff)}`}
                                        >
                                          <Plus className="w-3.5 h-3.5 text-gray-500 group-hover:scale-125 transition-transform" />
                                          <span className="font-bold">{c.staff.name}</span>
                                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-200">
                                            Score: {getStaffScore(c.staff)}
                                          </span>
                                          <span className="text-[10px] text-gray-500 font-medium">
                                            (from {c.fromRoom.split(' ').pop() || c.fromBuilding})
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── Footer ──────────────────────────────────────────── */}
                <div className="px-6 py-3.5 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                      <strong>Zone 1:</strong> M, P, E buildings
                    </span>
                    <span className="text-gray-300">|</span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                      <strong>Zone 2:</strong> S, F, A buildings
                    </span>
                  </div>
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
