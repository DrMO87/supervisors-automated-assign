'use client';

import { Fragment, useState, useEffect, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  X, Users, Calendar, Clock, Plus, Loader2, AlertCircle,
  CheckCircle, Building2, PersonStanding, Zap, ShieldCheck,
  Check, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';
import type { Staff, ExamSessionWithRelations, AssignmentRole, CalendarRule } from '@/types/database.types';
import { getSessionPeriod, getDayUniquePeriods, timesOverlap, normalizeTimeString } from '@/types/database.types';
import { supabase } from '@/lib/supabase/client';
import { useSchedulingStore } from '@/lib/stores/scheduling-store';
import {
  calculateRequiredStaff,
  getRoomBuilding,
  getSessionGapMinutes,
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

// Check if a staff member is on an off-day on dateStr
const isOffDay = (dateStr: string, staffMember?: Staff, calendarRules: CalendarRule[] = []) => {
  if (!staffMember) return false;
  if (staffMember.specific_off_dates?.includes(dateStr)) return true;

  const isUniversalRaw = calendarRules.some(
    r => r.is_universal_working_day && r.start_date <= dateStr && r.end_date >= dateStr
  );
  const isUniversal = isUniversalRaw && staffMember.supervision_role !== 'Committees Supervisor';
  if (isUniversal) return false;

  if (staffMember.specific_standard_off_dates?.includes(dateStr)) return true;

  const dayOfWeek = new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'UTC',
  });
  if (staffMember.working_days && !staffMember.working_days.includes(dayOfWeek)) return true;

  return false;
};

export function getStaffScore(s: Staff): string | number {
  const base = s.current_score || 0;
  const reserves = (s.free_staff_score || 0) * 0.25;
  const total = base + reserves;
  return Number.isInteger(total) ? total : total.toFixed(2);
}

export function getSupervisionRoleConfig(role?: string) {
  switch (role) {
    case 'Exam Supervisor':
      return {
        badgeBg: 'bg-purple-100 text-purple-800 border-purple-200',
        shortName: 'Exam Sprv',
        fullName: 'Exam Supervisor',
      };
    case 'Invigilator / Exam Supervisor':
      return {
        badgeBg: 'bg-teal-100 text-teal-800 border-teal-200',
        shortName: 'Invig / Sprv',
        fullName: 'Invigilator / Exam Supervisor',
      };
    case 'Committees Supervisor':
      return {
        badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
        shortName: 'Committees Sprv',
        fullName: 'Committees Supervisor',
      };
    case 'Invigilator':
    default:
      return {
        badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
        shortName: 'Invigilator',
        fullName: 'Invigilator',
      };
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface RunningCandidate {
  staff: Staff;
  fromBuilding: string;
  fromRoom: string;
  fromSubject: string;
  fromGroup: number;
  previousRole?: AssignmentRole | string;
}

export interface VacantRoom {
  session: ExamSessionWithRelations;
  building: string;
  roomName: string;
  assignedCount: number;
  requiredCount: number;
  neededExamSupervisors: number;
  neededAssistants: number;
  vacantSlots: number;
  group: number;
  isOral: boolean;
}

/**
 * Checks which role the staff member can fulfill in this vacant room.
 * Returns null if the staff member cannot fulfill any of the room's missing roles.
 *
 * Rule: An Exam Supervisor in the previous period CANNOT be assigned as Exam Supervisor
 * in the following period because they must deliver files to Control and receive new files
 * before opening the next room. They can only serve as an Invigilator (Assistant).
 */
export function getTargetRoleForStaff(
  staffMember: Staff,
  room: VacantRoom,
  previousRole?: AssignmentRole | string
): AssignmentRole | null {
  const wasPrevSupervisor = previousRole === 'Exam_Supervisor' || previousRole === 'Head_Supervisor';

  if (room.isOral) {
    if (room.neededAssistants <= 0) return null;
    // Oral exams require can_supervise_oral privilege
    if (!staffMember.can_supervise_oral) return null;
    // Oral exams allow Invigilator, Invigilator / Exam Supervisor, or running Exam Supervisor stepping down to invigilate
    if (staffMember.supervision_role === 'Invigilator' || staffMember.supervision_role === 'Invigilator / Exam Supervisor' || wasPrevSupervisor) {
      return 'Assistant';
    }
    return null;
  }

  // Written Exams:
  // 1. If Exam Supervisor is needed:
  // Rule: An Exam Supervisor from the previous period CANNOT be Exam Supervisor in the following period
  if (room.neededExamSupervisors > 0 && !wasPrevSupervisor) {
    if (staffMember.supervision_role === 'Exam Supervisor' || staffMember.supervision_role === 'Invigilator / Exam Supervisor') {
      return 'Exam_Supervisor';
    }
  }

  // 2. If Invigilator is needed:
  // Qualified staff or running Exam Supervisors stepping down to Invigilator
  if (room.neededAssistants > 0) {
    if (staffMember.supervision_role === 'Invigilator' || staffMember.supervision_role === 'Invigilator / Exam Supervisor' || wasPrevSupervisor) {
      return 'Assistant';
    }
  }

  return null;
}

export interface AddRunningStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  period: number;
  onUpdate: () => void;
}

export function AddRunningStaffModal({
  isOpen,
  onClose,
  dateStr,
  period,
  onUpdate,
}: AddRunningStaffModalProps) {
  const { staff, examSessions, periodFreeStaff, systemSettings, staffingRatios } = useSchedulingStore();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showRoster, setShowRoster] = useState(false);

  const globalDayPeriodsMap = useMemo(() => getDayUniquePeriods(examSessions), [examSessions]);

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

  // ── Period Time Detection ──────────────────────────────────────────────────
  const dayUniquePeriods = useMemo(() => globalDayPeriodsMap.get(dateStr) || [], [globalDayPeriodsMap, dateStr]);
  const currentIdx = useMemo(() => dayUniquePeriods.findIndex(dp => dp.period === period), [dayUniquePeriods, period]);
  const currentPeriodInfo = useMemo(() => (currentIdx >= 0 ? dayUniquePeriods[currentIdx] : null), [dayUniquePeriods, currentIdx]);
  const prevPeriodInfo = useMemo(() => (currentIdx > 0 ? dayUniquePeriods[currentIdx - 1] : null), [dayUniquePeriods, currentIdx]);

  // ── 1. Unfiltered sessions for the current period ──────────────────────────
  const currentPeriodSessions = useMemo(() => {
    return examSessions.filter(s =>
      s.exam_date === dateStr &&
      getSessionPeriod(s, examSessions, globalDayPeriodsMap) === period
    );
  }, [examSessions, dateStr, period, globalDayPeriodsMap]);

  // Normalized time range string for current period (e.g. "11:30 – 13:30")
  const currentPeriodTime = useMemo(() => {
    if (currentPeriodInfo?.time_range) return currentPeriodInfo.time_range;
    if (currentPeriodSessions.length > 0) {
      const s = currentPeriodSessions[0];
      const start = normalizeTimeString(s.start_time);
      const end = normalizeTimeString(s.end_time || '');
      return end ? `${start} – ${end}` : start;
    }
    return '';
  }, [currentPeriodInfo, currentPeriodSessions]);

  // ── 2. Unfiltered sessions for the immediately preceding period ────────────
  const previousPeriodSessions = useMemo(() => {
    if (!prevPeriodInfo) return [];
    return examSessions.filter(s =>
      s.exam_date === dateStr &&
      getSessionPeriod(s, examSessions, globalDayPeriodsMap) === prevPeriodInfo.period
    );
  }, [examSessions, dateStr, prevPeriodInfo, globalDayPeriodsMap]);

  // Normalized time range string for previous period (e.g. "09:00 – 11:00")
  const prevPeriodTime = useMemo(() => {
    if (prevPeriodInfo?.time_range) return prevPeriodInfo.time_range;
    if (previousPeriodSessions.length > 0) {
      const s = previousPeriodSessions[0];
      const start = normalizeTimeString(s.start_time);
      const end = normalizeTimeString(s.end_time || '');
      return end ? `${start} – ${end}` : start;
    }
    return '';
  }, [prevPeriodInfo, previousPeriodSessions]);

  // Transition gap in minutes between previous and current period
  const gapMinutes = useMemo(() => {
    if (previousPeriodSessions.length === 0 || currentPeriodSessions.length === 0) return 0;
    return getSessionGapMinutes(previousPeriodSessions[0], currentPeriodSessions[0]);
  }, [previousPeriodSessions, currentPeriodSessions]);

  // ── 3. Exact set of staff busy/assigned anywhere in CURRENT period ─────────
  const busyStaffInCurrentPeriod = useMemo(() => {
    const busy = new Set<string>();

    // A. Anyone assigned to an exam session in this period (or overlapping in time on this date)
    for (const s of currentPeriodSessions) {
      s.assignments?.forEach((a: any) => {
        if (a.staff_id) busy.add(a.staff_id);
      });
    }

    // Also check any session on this date that overlaps with current period
    if (currentPeriodSessions.length > 0) {
      const curStart = currentPeriodSessions[0].start_time;
      const curEnd = currentPeriodSessions[0].end_time || curStart;
      for (const s of examSessions) {
        if (s.exam_date !== dateStr) continue;
        if (timesOverlap(s.start_time, s.end_time || s.start_time, curStart, curEnd)) {
          s.assignments?.forEach((a: any) => {
            if (a.staff_id) busy.add(a.staff_id);
          });
        }
      }
    }

    // B. Anyone assigned as reserve/standby in period_free_staff for this date and period
    for (const fs of periodFreeStaff) {
      const fsDate = fs.exam_date?.slice(0, 10);
      if (fsDate === dateStr && fs.period === period && fs.staff_id) {
        busy.add(fs.staff_id);
      }
    }

    return busy;
  }, [currentPeriodSessions, examSessions, dateStr, period, periodFreeStaff]);

  // ── 4. Running Candidates: staff assigned in previous period who are 100% FREE in current period ──
  const runningCandidates = useMemo<RunningCandidate[]>(() => {
    const candidates: RunningCandidate[] = [];
    const seenStaffIds = new Set<string>();

    for (const session of previousPeriodSessions) {
      if (!session.assignments) continue;
      const roomName = (session.room as any)?.room_name || '';
      const building = getRoomBuilding(session.room as any, roomName);

      for (const assignment of session.assignments as any[]) {
        const staffId = assignment.staff_id;
        if (!staffId || seenStaffIds.has(staffId)) continue;

        // 1. Must NOT be busy in the current period (assigned to a room or on reserve)
        if (busyStaffInCurrentPeriod.has(staffId)) continue;

        const staffMember = assignment.staff || staff.find(s => s.id === staffId);
        if (!staffMember) continue;

        // 2. Must be Available
        if (staffMember.availability_status !== 'Available') continue;

        // 3. Must NOT be a Committees Supervisor (they are not room proctors)
        if (staffMember.supervision_role === 'Committees Supervisor') continue;

        // 4. Must NOT be on an off-day today
        if (isOffDay(dateStr, staffMember, calendarRules)) continue;

        seenStaffIds.add(staffId);
        candidates.push({
          staff: staffMember,
          fromBuilding: building,
          fromRoom: roomName,
          fromSubject: session.subject_name || '',
          fromGroup: getBuildingGroup(building),
          previousRole: assignment.role,
        });
      }
    }

    // Sort by lowest score first for fairness, then by name
    return candidates.sort((a, b) => {
      const scoreA = (a.staff.current_score || 0) + ((a.staff.free_staff_score || 0) * 0.25);
      const scoreB = (b.staff.current_score || 0) + ((b.staff.free_staff_score || 0) * 0.25);
      if (scoreA !== scoreB) return scoreA - scoreB;
      return a.staff.name.localeCompare(b.staff.name);
    });
  }, [previousPeriodSessions, busyStaffInCurrentPeriod, staff, dateStr, calendarRules]);

  // Separate candidates by zone
  const zone1Candidates = useMemo(() => runningCandidates.filter(c => c.fromGroup === 0), [runningCandidates]);
  const zone2Candidates = useMemo(() => runningCandidates.filter(c => c.fromGroup === 1), [runningCandidates]);
  const otherCandidates = useMemo(() => runningCandidates.filter(c => c.fromGroup !== 0 && c.fromGroup !== 1), [runningCandidates]);

  // ── 5. Vacant rooms with role breakdown (only rooms that actually need staff) ──
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

        const examSupervisorsCount = session.assignments?.filter((a: any) => a.role === 'Exam_Supervisor').length ?? 0;
        const assistantCount = session.assignments?.filter((a: any) => a.role === 'Assistant' || a.role === 'Invigilator').length ?? 0;

        let neededExamSupervisors = 0;
        let neededAssistants = 0;

        if (isOral) {
          neededAssistants = Math.max(0, 1 - assistantCount);
        } else {
          neededExamSupervisors = Math.max(0, 1 - examSupervisorsCount);
          neededAssistants = Math.max(0, req.assistants - assistantCount);
        }

        const vacantSlots = neededExamSupervisors + neededAssistants;
        const requiredCount = isOral ? 1 : (req.headSupervisors + req.assistants + 1);
        const assignedCount = session.assignments?.length ?? 0;
        const roomName = (session.room as any)?.room_name || '';
        const building = getRoomBuilding(session.room as any, roomName);

        return {
          session,
          building,
          roomName,
          assignedCount,
          requiredCount,
          neededExamSupervisors,
          neededAssistants,
          vacantSlots,
          group: getBuildingGroup(building),
          isOral,
        };
      })
      .filter(r => r.vacantSlots > 0)
      .sort((a, b) => b.vacantSlots - a.vacantSlots);
  }, [currentPeriodSessions, fullStaffingRatiosConfig, calendarRules]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  // Single runner assignment with exact role matching
  const handleAssignSingle = async (staffMember: Staff, room: VacantRoom, previousRole?: AssignmentRole | string) => {
    if (!supabase) return;

    const targetRole = getTargetRoleForStaff(staffMember, room, previousRole);
    if (!targetRole) {
      setMessage({
        type: 'error',
        text: `${staffMember.name.split(' ')[0]} cannot fulfill the role needed in ${room.roomName}.`,
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error: insertError } = await supabase.from('assignments').insert({
        exam_session_id: room.session.id,
        staff_id: staffMember.id,
        role: targetRole,
        is_manual_override: true,
      });

      if (insertError) throw insertError;

      // Update staff score
      await supabase
        .from('staff')
        .update({ current_score: (staffMember.current_score || 0) + 1 })
        .eq('id', staffMember.id);

      const roleLabel = targetRole === 'Exam_Supervisor' ? 'Exam Supervisor' : 'Invigilator';
      setMessage({
        type: 'success',
        text: `${staffMember.name.split(' ')[0]} assigned as ${roleLabel} to ${room.roomName}!`,
      });
      onUpdate();
    } catch (error: any) {
      console.error('Error assigning running staff:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to assign runner' });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fill all vacant rooms respecting needed roles and proximity
  const handleAutoFill = async () => {
    if (!supabase) return;
    if (vacantRooms.length === 0 || runningCandidates.length === 0) {
      setMessage({ type: 'error', text: 'No vacant rooms or free runners available' });
      return;
    }

    setIsLoading(true);
    try {
      let assignedCount = 0;
      const assignmentsToInsert: any[] = [];
      const updatedStaffScores = new Map<string, number>();
      const availableRunners = [...runningCandidates];

      // Clone room state to track vacancies during iteration
      const roomStates = vacantRooms.map(r => ({
        ...r,
        neededExam: r.neededExamSupervisors,
        neededInvig: r.neededAssistants,
        currentStaffIds: new Set((r.session.assignments || []).map((a: any) => a.staff_id)),
      }));

      // Pass 1: Same Zone matching first (strict role qualification)
      for (const room of roomStates) {
        // A. Match Exam Supervisor first if needed
        while (room.neededExam > 0) {
          const runnerIdx = availableRunners.findIndex(r => {
            if (room.currentStaffIds.has(r.staff.id)) return false;
            if (r.fromGroup !== room.group) return false;
            // Staff who were Exam Supervisor in previous period cannot be Exam Supervisor in following period
            const wasPrevSup = r.previousRole === 'Exam_Supervisor' || r.previousRole === 'Head_Supervisor';
            if (wasPrevSup) return false;
            return (r.staff.supervision_role === 'Exam Supervisor' || r.staff.supervision_role === 'Invigilator / Exam Supervisor');
          });
          if (runnerIdx === -1) break;

          const runner = availableRunners.splice(runnerIdx, 1)[0];
          room.currentStaffIds.add(runner.staff.id);
          assignmentsToInsert.push({
            exam_session_id: room.session.id,
            staff_id: runner.staff.id,
            role: 'Exam_Supervisor' as AssignmentRole,
            is_manual_override: true,
          });
          updatedStaffScores.set(runner.staff.id, (runner.staff.current_score || 0) + 1);
          room.neededExam--;
          assignedCount++;
        }

        // B. Match Invigilators next if needed
        while (room.neededInvig > 0) {
          const runnerIdx = availableRunners.findIndex(r => {
            if (room.currentStaffIds.has(r.staff.id)) return false;
            if (r.fromGroup !== room.group) return false;
            const wasPrevSup = r.previousRole === 'Exam_Supervisor' || r.previousRole === 'Head_Supervisor';
            if (room.isOral) {
              return r.staff.can_supervise_oral &&
                (r.staff.supervision_role === 'Invigilator' || r.staff.supervision_role === 'Invigilator / Exam Supervisor' || wasPrevSup);
            }
            return r.staff.supervision_role === 'Invigilator' || r.staff.supervision_role === 'Invigilator / Exam Supervisor' || wasPrevSup;
          });
          if (runnerIdx === -1) break;

          const runner = availableRunners.splice(runnerIdx, 1)[0];
          room.currentStaffIds.add(runner.staff.id);
          assignmentsToInsert.push({
            exam_session_id: room.session.id,
            staff_id: runner.staff.id,
            role: 'Assistant' as AssignmentRole,
            is_manual_override: true,
          });
          updatedStaffScores.set(runner.staff.id, (runner.staff.current_score || 0) + 1);
          room.neededInvig--;
          assignedCount++;
        }
      }

      // Pass 2: Cross Zone matching for remaining vacancies (still strict role qualification!)
      for (const room of roomStates) {
        // A. Match Exam Supervisor
        while (room.neededExam > 0) {
          const runnerIdx = availableRunners.findIndex(r => {
            if (room.currentStaffIds.has(r.staff.id)) return false;
            const wasPrevSup = r.previousRole === 'Exam_Supervisor' || r.previousRole === 'Head_Supervisor';
            if (wasPrevSup) return false;
            return (r.staff.supervision_role === 'Exam Supervisor' || r.staff.supervision_role === 'Invigilator / Exam Supervisor');
          });
          if (runnerIdx === -1) break;

          const runner = availableRunners.splice(runnerIdx, 1)[0];
          room.currentStaffIds.add(runner.staff.id);
          assignmentsToInsert.push({
            exam_session_id: room.session.id,
            staff_id: runner.staff.id,
            role: 'Exam_Supervisor' as AssignmentRole,
            is_manual_override: true,
          });
          updatedStaffScores.set(runner.staff.id, (runner.staff.current_score || 0) + 1);
          room.neededExam--;
          assignedCount++;
        }

        // B. Match Invigilators
        while (room.neededInvig > 0) {
          const runnerIdx = availableRunners.findIndex(r => {
            if (room.currentStaffIds.has(r.staff.id)) return false;
            const wasPrevSup = r.previousRole === 'Exam_Supervisor' || r.previousRole === 'Head_Supervisor';
            if (room.isOral) {
              return r.staff.can_supervise_oral &&
                (r.staff.supervision_role === 'Invigilator' || r.staff.supervision_role === 'Invigilator / Exam Supervisor' || wasPrevSup);
            }
            return r.staff.supervision_role === 'Invigilator' || r.staff.supervision_role === 'Invigilator / Exam Supervisor' || wasPrevSup;
          });
          if (runnerIdx === -1) break;

          const runner = availableRunners.splice(runnerIdx, 1)[0];
          room.currentStaffIds.add(runner.staff.id);
          assignmentsToInsert.push({
            exam_session_id: room.session.id,
            staff_id: runner.staff.id,
            role: 'Assistant' as AssignmentRole,
            is_manual_override: true,
          });
          updatedStaffScores.set(runner.staff.id, (runner.staff.current_score || 0) + 1);
          room.neededInvig--;
          assignedCount++;
        }
      }

      if (assignmentsToInsert.length === 0) {
        setMessage({
          type: 'error',
          text: 'No qualified runners could be matched to the missing roles.',
        });
        setIsLoading(false);
        return;
      }

      const { error: insertErr } = await supabase.from('assignments').insert(assignmentsToInsert);
      if (insertErr) throw insertErr;

      // Update scores
      for (const [staffId, newScore] of updatedStaffScores.entries()) {
        await supabase.from('staff').update({ current_score: newScore }).eq('id', staffId);
      }

      setMessage({ type: 'success', text: `Successfully filled ${assignedCount} vacant slots with qualified runners!` });
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
                      <Dialog.Title as="h3" className="text-lg font-bold text-gray-900 flex flex-wrap items-center gap-2">
                        <span>Add Running Staff — Period {period}</span>
                        {currentPeriodTime && (
                          <span className="text-xs font-bold text-orange-700 bg-orange-100/90 border border-orange-200 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                            <Clock className="w-3 h-3 text-orange-600" />
                            {currentPeriodTime}
                          </span>
                        )}
                      </Dialog.Title>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Free staff from {prevPeriodInfo ? `Period ${prevPeriodInfo.period} (${prevPeriodTime || prevPeriodInfo.time_range})` : 'the previous period'} who can run to fill vacant rooms in Period {period} {currentPeriodTime ? `(${currentPeriodTime})` : ''}
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
                    <div className="flex flex-wrap items-center gap-4 text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-semibold text-gray-800">
                          {format(new Date(dateStr + 'T12:00:00Z'), 'EEEE, MMMM d, yyyy')}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-orange-500" />
                        <span className="font-bold text-gray-900">Period {period}</span>
                        {currentPeriodTime && (
                          <span className="font-semibold text-gray-800 bg-white border border-gray-200 px-1.5 py-0.2 rounded shadow-2xs">
                            {currentPeriodTime}
                          </span>
                        )}
                        {prevPeriodInfo && (
                          <span className="text-gray-500 text-[11px] ml-1">
                            · Prev: <strong>P{prevPeriodInfo.period} ({prevPeriodTime || prevPeriodInfo.time_range})</strong> · <span className="text-orange-700 font-bold">{gapMinutes}m gap</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700">
                        {totalVacancies} Vacant Spot{totalVacancies !== 1 ? 's' : ''} ({vacantRooms.length} rooms)
                      </span>
                      <span className="font-bold px-2.5 py-1 rounded-full bg-gray-200 text-gray-800">
                        {runningCandidates.length} Free Runners
                      </span>
                    </div>
                  </div>

                  {/* ── Highlighted Zone Pools ── */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-200/60">
                    <span className="text-[11px] font-bold text-gray-500 uppercase mr-1">Available Runners Pool:</span>

                    {/* Zone 1 Pool Badge */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 font-semibold shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span>Zone 1 (M / P / E):</span>
                      <span className="bg-blue-600 text-white text-[11px] font-bold px-1.5 py-0.2 rounded-full ml-0.5">
                        {zone1Candidates.length} staff
                      </span>
                    </div>

                    {/* Zone 2 Pool Badge */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
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

                    {/* Toggle Roster Button */}
                    {runningCandidates.length > 0 && (
                      <button
                        onClick={() => setShowRoster(prev => !prev)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 px-2.5 py-1 rounded-lg transition-colors shadow-2xs ml-1"
                        title="View all free running candidates with their supervision roles and details"
                      >
                        <Users className="w-3 h-3 text-gray-500" />
                        <span>{showRoster ? 'Hide Runner Roster' : `View All Runners (${runningCandidates.length})`}</span>
                        {showRoster ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
                      </button>
                    )}

                    {/* Quick Auto-Fill Button */}
                    {runningCandidates.length > 0 && vacantRooms.length > 0 && (
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          onClick={handleAutoFill}
                          disabled={isLoading}
                          className="flex items-center gap-1.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 px-3.5 py-1.5 rounded-lg shadow-sm transition-all disabled:opacity-50"
                          title="Fills vacancies strictly matching needed roles, prioritizing same-zone runners first"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          Auto-Fill All Vacancies
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ── Expandable Full Runners Roster ── */}
                  {showRoster && runningCandidates.length > 0 && (
                    <div className="mt-2 p-3 bg-white rounded-xl border border-gray-200 shadow-xs space-y-2">
                      <div className="flex items-center justify-between text-xs border-b border-gray-100 pb-2">
                        <span className="font-bold text-gray-800 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-primary-600" />
                          All Free Running Candidates ({runningCandidates.length})
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {prevPeriodInfo ? `P${prevPeriodInfo.period} (${prevPeriodTime || prevPeriodInfo.time_range})` : 'Previous'} → P{period} {currentPeriodTime ? `(${currentPeriodTime})` : ''}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto custom-scrollbar p-1">
                        {runningCandidates.map(c => {
                          const roleConfig = getSupervisionRoleConfig(c.staff.supervision_role);
                          const wasPrevSup = c.previousRole === 'Exam_Supervisor' || c.previousRole === 'Head_Supervisor';
                          const zoneConfig = c.fromGroup === 0 ? ZONE_CONFIG[0] : c.fromGroup === 1 ? ZONE_CONFIG[1] : ZONE_CONFIG.other;

                          return (
                            <div
                              key={c.staff.id}
                              className={`p-2 rounded-lg border ${zoneConfig.borderColor} bg-white hover:bg-gray-50/80 transition-all flex flex-col gap-1.5 text-xs shadow-2xs`}
                            >
                              <div className="flex items-start justify-between gap-1.5">
                                <div>
                                  <span className="font-bold text-gray-900 block leading-tight">{c.staff.name}</span>
                                  <span className="text-[10px] text-gray-500">{c.staff.job_title}</span>
                                </div>
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-200 flex-shrink-0">
                                  Score: {getStaffScore(c.staff)}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-gray-100">
                                <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded border ${roleConfig.badgeBg}`}>
                                  <ShieldCheck className="w-2.5 h-2.5 flex-shrink-0" />
                                  {roleConfig.fullName}
                                </span>

                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${zoneConfig.badgeBg}`}>
                                  {zoneConfig.shortName}
                                </span>

                                <span className="text-[9px] text-gray-500 bg-gray-50 px-1 py-0.2 rounded border border-gray-200">
                                  from {c.fromRoom} ({wasPrevSup ? 'Exam Sprv' : 'Invig'})
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
                        Period {period} {currentPeriodTime ? `(${currentPeriodTime})` : ''} is the first scheduled period on this day. Running staff are drawn from the previous period.
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
                        There are no vacant places in Period {period} {currentPeriodTime ? `(${currentPeriodTime})` : ''}. Filled rooms are untouched.
                      </p>
                    </div>
                  )}

                  {previousPeriodSessions.length > 0 && vacantRooms.length > 0 && runningCandidates.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="p-4 bg-amber-100 rounded-full mb-3">
                        <Users className="w-8 h-8 text-amber-600" />
                      </div>
                      <h4 className="text-base font-bold text-gray-700">No Free Runners Available</h4>
                      <p className="text-xs text-gray-500 mt-1 max-w-sm">
                        All staff who supervised in the previous period {prevPeriodTime ? `(${prevPeriodTime})` : ''} are already scheduled in Period {period} {currentPeriodTime ? `(${currentPeriodTime})` : ''}, on reserve duty, or on their off-day.
                      </p>
                    </div>
                  )}

                  {/* ── Vacant Rooms List with Qualified Runners Highlighted ── */}
                  {vacantRooms.length > 0 && runningCandidates.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-500" />
                          Rooms With Vacant Slots ({vacantRooms.length})
                        </h4>
                        <span className="text-[11px] text-gray-400">
                          Only candidates qualified for the room&apos;s missing roles are shown
                        </span>
                      </div>

                      {vacantRooms.map(room => {
                        const roomZone = room.group;
                        const roomZoneConfig = roomZone === 0 ? ZONE_CONFIG[0] : roomZone === 1 ? ZONE_CONFIG[1] : ZONE_CONFIG.other;

                        // Filter runners who are qualified for what THIS room needs
                        const qualifiedZone1 = zone1Candidates.filter(c => getTargetRoleForStaff(c.staff, room, c.previousRole) !== null);
                        const qualifiedZone2 = zone2Candidates.filter(c => getTargetRoleForStaff(c.staff, room, c.previousRole) !== null);
                        const qualifiedOther = otherCandidates.filter(c => getTargetRoleForStaff(c.staff, room, c.previousRole) !== null);
                        const totalQualified = qualifiedZone1.length + qualifiedZone2.length + qualifiedOther.length;

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
                                  {room.isOral && (
                                    <span className="text-[9px] font-bold uppercase bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded border border-orange-200">
                                      Oral Exam
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-1">
                                  <span className="font-bold text-gray-800 flex items-center gap-1">
                                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                                    {room.roomName}
                                  </span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${roomZoneConfig.badgeBg}`}>
                                    {roomZoneConfig.name}
                                  </span>
                                  <span>·</span>
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-700 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded">
                                    <Clock className="w-3 h-3 text-gray-500" />
                                    {normalizeTimeString(room.session.start_time)} – {normalizeTimeString(room.session.end_time || '')}
                                  </span>
                                  <span>·</span>
                                  <span>{room.session.student_count} students</span>
                                </div>
                              </div>

                              {/* Exact Role Deficiencies */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700">
                                  {room.assignedCount} / {room.requiredCount} Staff
                                </span>

                                {room.neededExamSupervisors > 0 && (
                                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 border border-indigo-200">
                                    Needs: Exam Sprv
                                  </span>
                                )}

                                {room.neededAssistants > 0 && (
                                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-red-100 text-red-800 border border-red-200">
                                    Needs: {room.neededAssistants} Invig
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Runners Selection Area */}
                            {totalQualified === 0 ? (
                              <p className="text-xs text-amber-600 italic py-2 flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                No available runners currently qualified for this room&apos;s needed roles ({room.neededExamSupervisors > 0 ? 'Exam Supervisor' : ''}{room.neededExamSupervisors > 0 && room.neededAssistants > 0 ? ' & ' : ''}{room.neededAssistants > 0 ? 'Invigilator' : ''}).
                              </p>
                            ) : (
                              <div className="space-y-2.5">
                                {/* Zone 1 (M / P / E) Qualified Runners */}
                                {qualifiedZone1.length > 0 && (
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
                                      {qualifiedZone1.map(c => {
                                        const alreadyAssigned = room.session.assignments?.some(
                                          (a: any) => a.staff_id === c.staff.id
                                        );
                                        if (alreadyAssigned) return null;

                                        const targetRole = getTargetRoleForStaff(c.staff, room, c.previousRole);
                                        const isSameZone = roomZone === 0;
                                        const wasPrevSup = c.previousRole === 'Exam_Supervisor' || c.previousRole === 'Head_Supervisor';
                                        const roleConfig = getSupervisionRoleConfig(c.staff.supervision_role);

                                        return (
                                          <button
                                            key={c.staff.id}
                                            onClick={() => handleAssignSingle(c.staff, room, c.previousRole)}
                                            disabled={isLoading}
                                            className={`group inline-flex items-center flex-wrap gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all shadow-xs disabled:opacity-50 ${
                                              isSameZone
                                                ? 'bg-blue-50/90 border-blue-400 text-blue-900 hover:bg-blue-100 ring-1 ring-blue-300'
                                                : 'bg-blue-50/40 border-blue-200 text-blue-800 hover:bg-blue-100/70'
                                            }`}
                                            title={`Staff: ${c.staff.name} (${c.staff.job_title || ''})\nSupervision Role: ${c.staff.supervision_role}\nFrom: ${c.fromRoom} (${c.fromSubject})\nAssigned As: ${targetRole === 'Exam_Supervisor' ? 'Exam Supervisor' : 'Invigilator'}${wasPrevSup ? ' (Prev: Exam Supervisor -> Invigilator only)' : ''}\nScore: ${getStaffScore(c.staff)}`}
                                          >
                                            <Plus className="w-3.5 h-3.5 text-blue-600 group-hover:scale-125 transition-transform" />
                                            <span className="font-bold text-gray-900">{c.staff.name}</span>

                                            {/* Staff Supervision Role Badge */}
                                            <span
                                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${roleConfig.badgeBg}`}
                                              title={`Staff Profile Supervision Role: ${roleConfig.fullName}`}
                                            >
                                              <ShieldCheck className="w-2.5 h-2.5" />
                                              <span>{roleConfig.shortName}</span>
                                            </span>

                                            {/* Target Assignment Role */}
                                            <span
                                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                                targetRole === 'Exam_Supervisor'
                                                  ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                                                  : wasPrevSup
                                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                                  : 'bg-blue-100 text-blue-800 border-blue-200'
                                              }`}
                                              title={`Assigned in this room as: ${targetRole === 'Exam_Supervisor' ? 'Exam Supervisor' : 'Invigilator'}${wasPrevSup ? ' (Previous Exam Supervisor stepped down to Invigilator)' : ''}`}
                                            >
                                              → {targetRole === 'Exam_Supervisor' ? 'Exam Sprv' : 'Invig'}
                                              {wasPrevSup && <span className="ml-0.5 text-[8px] font-normal text-amber-700">(Prev Sprv)</span>}
                                            </span>

                                            {/* Score */}
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                                              Score: {getStaffScore(c.staff)}
                                            </span>

                                            <span className="text-[10px] text-blue-600 font-medium">
                                              (from {c.fromRoom.split(' ').pop() || c.fromBuilding})
                                            </span>

                                            {isSameZone && (
                                              <span className="text-[9px] font-bold text-blue-800 bg-blue-200/80 px-1 py-0.5 rounded">
                                                Optimal
                                              </span>
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Zone 2 (S / F / A) Qualified Runners */}
                                {qualifiedZone2.length > 0 && (
                                  <div className={qualifiedZone1.length > 0 ? 'pt-2 border-t border-gray-100' : ''}>
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
                                      {qualifiedZone2.map(c => {
                                        const alreadyAssigned = room.session.assignments?.some(
                                          (a: any) => a.staff_id === c.staff.id
                                        );
                                        if (alreadyAssigned) return null;

                                        const targetRole = getTargetRoleForStaff(c.staff, room, c.previousRole);
                                        const isSameZone = roomZone === 1;
                                        const wasPrevSup = c.previousRole === 'Exam_Supervisor' || c.previousRole === 'Head_Supervisor';
                                        const roleConfig = getSupervisionRoleConfig(c.staff.supervision_role);

                                        return (
                                          <button
                                            key={c.staff.id}
                                            onClick={() => handleAssignSingle(c.staff, room, c.previousRole)}
                                            disabled={isLoading}
                                            className={`group inline-flex items-center flex-wrap gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all shadow-xs disabled:opacity-50 ${
                                              isSameZone
                                                ? 'bg-emerald-50/90 border-emerald-400 text-emerald-900 hover:bg-emerald-100 ring-1 ring-emerald-300'
                                                : 'bg-emerald-50/40 border-emerald-200 text-emerald-800 hover:bg-emerald-100/70'
                                            }`}
                                            title={`Staff: ${c.staff.name} (${c.staff.job_title || ''})\nSupervision Role: ${c.staff.supervision_role}\nFrom: ${c.fromRoom} (${c.fromSubject})\nAssigned As: ${targetRole === 'Exam_Supervisor' ? 'Exam Supervisor' : 'Invigilator'}${wasPrevSup ? ' (Prev: Exam Supervisor -> Invigilator only)' : ''}\nScore: ${getStaffScore(c.staff)}`}
                                          >
                                            <Plus className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-125 transition-transform" />
                                            <span className="font-bold text-gray-900">{c.staff.name}</span>

                                            {/* Staff Supervision Role Badge */}
                                            <span
                                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${roleConfig.badgeBg}`}
                                              title={`Staff Profile Supervision Role: ${roleConfig.fullName}`}
                                            >
                                              <ShieldCheck className="w-2.5 h-2.5" />
                                              <span>{roleConfig.shortName}</span>
                                            </span>

                                            {/* Target Assignment Role */}
                                            <span
                                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                                targetRole === 'Exam_Supervisor'
                                                  ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                                                  : wasPrevSup
                                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                                  : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                              }`}
                                              title={`Assigned in this room as: ${targetRole === 'Exam_Supervisor' ? 'Exam Supervisor' : 'Invigilator'}${wasPrevSup ? ' (Previous Exam Supervisor stepped down to Invigilator)' : ''}`}
                                            >
                                              → {targetRole === 'Exam_Supervisor' ? 'Exam Sprv' : 'Invig'}
                                              {wasPrevSup && <span className="ml-0.5 text-[8px] font-normal text-amber-700">(Prev Sprv)</span>}
                                            </span>

                                            {/* Score */}
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                                              Score: {getStaffScore(c.staff)}
                                            </span>

                                            <span className="text-[10px] text-emerald-600 font-medium">
                                              (from {c.fromRoom.split(' ').pop() || c.fromBuilding})
                                            </span>

                                            {isSameZone && (
                                              <span className="text-[9px] font-bold text-emerald-800 bg-emerald-200/80 px-1 py-0.5 rounded">
                                                Optimal
                                              </span>
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Other Building Qualified Runners */}
                                {qualifiedOther.length > 0 && (
                                  <div className="pt-2 border-t border-gray-100">
                                    <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-bold text-gray-700">
                                      <span className="w-2 h-2 rounded-full bg-gray-400" />
                                      <span>Other Building Staff</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {qualifiedOther.map(c => {
                                        const alreadyAssigned = room.session.assignments?.some(
                                          (a: any) => a.staff_id === c.staff.id
                                        );
                                        if (alreadyAssigned) return null;

                                        const targetRole = getTargetRoleForStaff(c.staff, room, c.previousRole);
                                        const wasPrevSup = c.previousRole === 'Exam_Supervisor' || c.previousRole === 'Head_Supervisor';
                                        const roleConfig = getSupervisionRoleConfig(c.staff.supervision_role);

                                        return (
                                          <button
                                            key={c.staff.id}
                                            onClick={() => handleAssignSingle(c.staff, room, c.previousRole)}
                                            disabled={isLoading}
                                            className="group inline-flex items-center flex-wrap gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-800 transition-all shadow-xs disabled:opacity-50"
                                            title={`Staff: ${c.staff.name} (${c.staff.job_title || ''})\nSupervision Role: ${c.staff.supervision_role}\nFrom: ${c.fromRoom} (${c.fromSubject})\nAssigned As: ${targetRole === 'Exam_Supervisor' ? 'Exam Supervisor' : 'Invigilator'}${wasPrevSup ? ' (Prev: Exam Supervisor -> Invigilator only)' : ''}\nScore: ${getStaffScore(c.staff)}`}
                                          >
                                            <Plus className="w-3.5 h-3.5 text-gray-500 group-hover:scale-125 transition-transform" />
                                            <span className="font-bold text-gray-900">{c.staff.name}</span>

                                            {/* Staff Profile Supervision Role Badge */}
                                            <span
                                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${roleConfig.badgeBg}`}
                                              title={`Profile Supervision Role: ${roleConfig.fullName}`}
                                            >
                                              <ShieldCheck className="w-2.5 h-2.5" />
                                              <span>{roleConfig.shortName}</span>
                                            </span>

                                            {/* Target Assignment Role */}
                                            <span
                                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                                targetRole === 'Exam_Supervisor'
                                                  ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                                                  : wasPrevSup
                                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                                  : 'bg-gray-200 text-gray-800 border-gray-300'
                                              }`}
                                              title={`Assigned in this room as: ${targetRole === 'Exam_Supervisor' ? 'Exam Supervisor' : 'Invigilator'}${wasPrevSup ? ' (Previous Exam Supervisor stepped down to Invigilator)' : ''}`}
                                            >
                                              → {targetRole === 'Exam_Supervisor' ? 'Exam Sprv' : 'Invig'}
                                              {wasPrevSup && <span className="ml-0.5 text-[8px] font-normal text-amber-700">(Prev Sprv)</span>}
                                            </span>

                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
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
                            )}
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
                    <span className="text-gray-300">|</span>
                    <span className="text-gray-600 font-medium">
                      Roles and availability strictly verified
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
