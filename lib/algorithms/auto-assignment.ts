import type {
  Staff,
  ExamSession,
  Assignment,
  StaffingRatiosConfig,
  AssignmentConstraintViolation,
  AssignmentResult,
  JobTitle,
  SchedulingConstraintsConfig,
  Room,
  RoomSessionGroup,
  PeriodFreeStaff,
  CalendarRule,
  StaffAvailabilityPolicy,
} from '@/types/database.types';
import { parseRoomCode, getPeriodFromTime, getSessionPeriod, areSessionsInSamePeriod, getDayUniquePeriods, getDurationInMinutes, timesOverlap, DayPeriodInfo, normalizeTimeString } from '@/types/database.types';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Using centralized helper from types/database.types.ts

export interface AutoAssignConfig {
  ratios: StaffingRatiosConfig;
  constraints: SchedulingConstraintsConfig;
  calendarRules?: CalendarRule[];
  availabilityPolicy?: StaffAvailabilityPolicy;
  ignoreStaffAvailableDays?: boolean;
  maxDaysPerWeek?: number;
  isMidterm?: boolean;
}

/**
/**
 * Academic week key starting on Saturday.
 * Returns the YYYY-MM-DD of the Saturday commencing the academic week containing dateStr.
 */
export function getAcademicWeekKey(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const day = d.getUTCDay(); // 0 is Sunday, 6 is Saturday
  const daysSinceSaturday = (day + 1) % 7;
  const sat = new Date(d);
  sat.setUTCDate(d.getUTCDate() - daysSinceSaturday);
  return sat.toISOString().split('T')[0];
}

/**
 * Resolves the effective 3-mode availability policy from constraints,
 * providing 100% backward compatibility with legacy flags.
 * Defaults to 5 days per week (standard full-time working days).
 */
export function resolveAvailabilityPolicy(constraints?: Partial<SchedulingConstraintsConfig> | null): {
  policy: StaffAvailabilityPolicy;
  custom_days_per_week: number;
} {
  if (!constraints) {
    return { policy: 'respect_all_off_days', custom_days_per_week: 5 };
  }
  if (constraints.availability_policy) {
    return {
      policy: constraints.availability_policy,
      custom_days_per_week: constraints.custom_days_per_week || 5,
    };
  }
  if (constraints.ignore_staff_working_days) {
    return {
      policy: 'cap_days_per_week',
      custom_days_per_week: constraints.custom_days_per_week || 5,
    };
  }
  if (constraints.ignore_working_days_if_specific_dates) {
    return {
      policy: 'smart_dates_priority',
      custom_days_per_week: constraints.custom_days_per_week || 5,
    };
  }
  return {
    policy: 'respect_all_off_days',
    custom_days_per_week: constraints.custom_days_per_week || 5,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate required staff (invigilators + committee supervisor) based on
 * combined student count for a room-period group.
 */
export function calculateRequiredStaff(
  studentCount: number,
  staffingRatios: StaffingRatiosConfig,
  isOralExam: boolean = false,
  examDate?: string,
  calendarRules: CalendarRule[] = []
): { headSupervisors: number; assistants: number } {
  // Oral Exam Override: exactly 1 Assistant, 0 Head Supervisors
  if (isOralExam) {
    return { headSupervisors: 0, assistants: 1 };
  }

  // Check for Date-Specific Override from Unified Calendar Rules
  let activeRanges = staffingRatios.ranges || [];
  if (examDate && calendarRules.length > 0) {
    const activeRule = calendarRules.find(r => r.apply_staffing_ratios && r.start_date <= examDate && r.end_date >= examDate);
    if (activeRule && activeRule.staffing_ratios && activeRule.staffing_ratios.length > 0) {
      activeRanges = activeRule.staffing_ratios;
    }
  }

  const range = activeRanges.find((r) => studentCount >= r.min && studentCount <= r.max);

  if (range) return { headSupervisors: range.head_supervisors, assistants: range.assistants };

  if (activeRanges.length === 0) {
    if (studentCount <= 9)  return { headSupervisors: 1, assistants: 0 };
    if (studentCount <= 30) return { headSupervisors: 1, assistants: 1 };
    if (studentCount <= 50) return { headSupervisors: 1, assistants: 2 };
    if (studentCount <= 60) return { headSupervisors: 1, assistants: 3 };
    return { headSupervisors: 1, assistants: 4 };
  }

  const minRange = activeRanges[0];
  if (studentCount < minRange.min) return { headSupervisors: 1, assistants: 0 };

  const maxRange = activeRanges[activeRanges.length - 1];
  if (studentCount > maxRange.max) return { headSupervisors: maxRange.head_supervisors, assistants: maxRange.assistants };

  return { headSupervisors: 1, assistants: 1 };
}

/**
 * Returns true when a room is near the pharmacy (Building M or P).
 */
export function isNearPharmacy(roomName: string): boolean {
  return parseRoomCode(roomName).is_near_pharmacy;
}

/**
 * Resolves the building identifier for a room.
 */
export function getRoomBuilding(room?: Room | null, roomName?: string): string {
  if (room?.building_code && room.building_code.trim()) {
    return room.building_code.trim().toUpperCase();
  }
  if (room?.building && room.building.trim()) {
    return room.building.trim().toUpperCase();
  }
  const name = room?.room_name || roomName || '';
  if (name) {
    const parsed = parseRoomCode(name);
    if (parsed.building_code && parsed.building_code.trim()) {
      return parsed.building_code.trim().toUpperCase();
    }
  }
  return 'UNKNOWN';
}

/**
 * Calculates transition gap in minutes between two sessions on the same date.
 * If sessions overlap, returns 0.
 * If s1 precedes s2, returns start(s2) - end(s1).
 * If s2 precedes s1, returns start(s1) - end(s2).
 */
export function getSessionGapMinutes(
  s1: { start_time: string; end_time?: string | null },
  s2: { start_time: string; end_time?: string | null }
): number {
  const toMins = (t: string) => {
    const clean = normalizeTimeString(t);
    const [h, m] = clean.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const s1Start = toMins(s1.start_time);
  const s1End = s1.end_time ? toMins(s1.end_time) : s1Start + 120;

  const s2Start = toMins(s2.start_time);
  const s2End = s2.end_time ? toMins(s2.end_time) : s2Start + 120;

  if (s1Start < s2End && s2Start < s1End) {
    return 0; // Overlapping
  }

  if (s1End <= s2Start) {
    return s2Start - s1End;
  } else {
    return s1Start - s2End;
  }
}

/**
 * Computes proximity and continuity affinity score for a candidate staff member
 * when being assigned to a room and session.
 * 
 * Hierarchy:
 * - SAME_ROOM_CONTIGUOUS (4): Same room in an adjacent/contiguous period (gap <= 15m) -> 0m transit.
 * - SAME_ROOM_SPACIOUS (3.5): Same room with a comfortable gap (> 15m).
 * - SAME_BUILDING_CONTIGUOUS (3): Same building in an adjacent period (gap <= 15m) -> hallway walk.
 * - SAME_BUILDING_SPACIOUS (2.5): Same building with a comfortable gap (> 15m).
 * - FRESH (2): Candidate has 0 other sessions today -> fresh on campus, can reach any building easily.
 * - DIFF_BUILDING_SPACIOUS (2): Different building with ample gap (> 15m, e.g. 1h+).
 * - DIFF_BUILDING_TIGHT (0): Different building with tight/no gap (<= 15m) -> cross-campus sprint! (Heavily avoided).
 */
export function getStaffRoomAffinity(
  staffId: string,
  targetRoom: Room | null | undefined,
  currentSession: ExamSession | null | undefined,
  existingAssignments: Assignment[],
  allSessions: ExamSession[],
  rooms?: Room[]
): { affinityScore: number; reason: string } {
  if (!targetRoom || !currentSession) {
    return { affinityScore: 2, reason: 'FRESH' };
  }

  const targetDate = currentSession.exam_date;
  const targetBuilding = getRoomBuilding(targetRoom, targetRoom.room_name);
  const sessionMap = (allSessions as any)?._sessionMap || new Map(allSessions.map(s => [s.id, s]));

  // Find all distinct sessions this staff member is assigned to on this date
  const assignedSessionsOnDate: ExamSession[] = [];
  for (const a of existingAssignments) {
    if (a.staff_id === staffId) {
      const s = sessionMap.get(a.exam_session_id);
      if (s && s.exam_date === targetDate && s.id !== currentSession.id) {
        if (!assignedSessionsOnDate.some(x => x.id === s.id)) {
          assignedSessionsOnDate.push(s);
        }
      }
    }
  }

  if (assignedSessionsOnDate.length === 0) {
    return { affinityScore: 2, reason: 'FRESH' };
  }

  // Find the closest adjacent session in time on this date
  let minGap = Infinity;
  let closestSession: ExamSession | null = null;

  for (const s of assignedSessionsOnDate) {
    const gap = getSessionGapMinutes(s, currentSession);
    if (gap < minGap) {
      minGap = gap;
      closestSession = s;
    }
  }

  if (!closestSession) {
    return { affinityScore: 2, reason: 'FRESH' };
  }

  const closestRoom = rooms?.find(r => r.id === closestSession!.room_id);
  const closestBuilding = getRoomBuilding(closestRoom, (closestSession as any).room_name);
  const isSameRoom = Boolean(
    (targetRoom.id && closestSession.room_id === targetRoom.id) ||
    (targetRoom.room_name && closestRoom?.room_name && targetRoom.room_name.trim().toLowerCase() === closestRoom.room_name.trim().toLowerCase())
  );
  const isSameBuilding = (targetBuilding !== 'UNKNOWN' && closestBuilding !== 'UNKNOWN' && targetBuilding === closestBuilding);

  // If the time gap between periods is tight (<= 15 minutes, or 0 minutes):
  if (minGap <= 15) {
    if (isSameRoom) {
      return { affinityScore: 4, reason: 'SAME_ROOM_CONTIGUOUS' };
    }
    if (isSameBuilding) {
      return { affinityScore: 3, reason: 'SAME_BUILDING_CONTIGUOUS' };
    }
    // Cross-building sprint with tight or 0 gap! (Heavily avoided and prohibited)
    return { affinityScore: -100, reason: 'DIFF_BUILDING_TIGHT' };
  }

  // If gap > 15 minutes (comfortable break, e.g. 30m, 1h, 2h):
  if (isSameRoom) {
    return { affinityScore: 3.5, reason: 'SAME_ROOM_SPACIOUS' };
  }
  if (isSameBuilding) {
    return { affinityScore: 2.5, reason: 'SAME_BUILDING_SPACIOUS' };
  }

  return { affinityScore: 2, reason: 'DIFF_BUILDING_SPACIOUS' };
}

/**
 * Feeding-mother weekly hour-reduction tracker.
 * Returns the maximum number of assignment-periods a feeding mother can work
 * in the given day, accounting for early-leave policy.
 *
 * FT: up to 2 days × 2h early  OR up to 4 days × 1h early
 * PT: up to 1 day  × 2h early  OR up to 2 days × 1h early
 *
 * We model this as: the staff member loses up to `allowedEarlyDays` assignment
 * slots. The scheduler uses this as a *soft* constraint to warn when the member
 * has already used their early-leave allocation.
 */
export function getFeedingMotherEarlyLeaveDays(
  staff: Staff
): { maxDays2h: number; maxDays1h: number } {
  if (!staff.is_feeding_mother) return { maxDays2h: 0, maxDays1h: 0 };
  return staff.employment_status === 'Full-time'
    ? { maxDays2h: 2, maxDays1h: 4 }
    : { maxDays2h: 1, maxDays1h: 2 };
}

// ─────────────────────────────────────────────────────────────────────────────
// OFF-DAY CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given all exam session dates (the "exam period") and a staff member's
 * specific_off_dates, this function classifies the off-dates into two buckets:
 *
 * - recurringOffDays: Weekday names (e.g. 'Friday') that are off for EVERY
 *   occurrence of that weekday within the exam period. These should be treated
 *   as permanent non-working days, exactly like the working_days pattern.
 *
 * - specificOffDates: ISO dates that are off for only SOME occurrences of that
 *   weekday (i.e. not every week). These remain as individual date blocks.
 *
 * Logic:
 *   1. Collect all unique weekdays that appear in the exam period dates.
 *   2. For each such weekday, find every exam-period date that falls on it.
 *   3. If ALL those dates appear in specific_off_dates → it's a recurring off-day.
 *   4. Otherwise → keep the matching dates as specific off-dates only.
 */
export function classifyOffDays(
  specificOffDates: string[],
  allExamDates: string[]
): { recurringOffDays: string[]; specificOffDates: string[] } {
  if (!specificOffDates || specificOffDates.length === 0) {
    return { recurringOffDays: [], specificOffDates: [] };
  }

  const offDateSet = new Set(specificOffDates);

  // Map from weekday name → all exam-period dates falling on that weekday
  const weekdayToExamDates = new Map<string, string[]>();
  for (const dateStr of allExamDates) {
    const dayName = new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-US', {
      weekday: 'long',
      timeZone: 'UTC',
    });
    if (!weekdayToExamDates.has(dayName)) weekdayToExamDates.set(dayName, []);
    weekdayToExamDates.get(dayName)!.push(dateStr);
  }

  const recurringOffDays: string[] = [];
  const remainingSpecificOffDates: string[] = [];

  for (const [dayName, examDatesOnDay] of weekdayToExamDates.entries()) {
    // Check if EVERY occurrence of this weekday is in the staff's off-dates
    const allOff = examDatesOnDay.every((d) => offDateSet.has(d));
    // Also check if at least one of those dates IS an off-date (otherwise not relevant)
    const anyOff = examDatesOnDay.some((d) => offDateSet.has(d));

    if (anyOff) {
      if (allOff) {
        // All occurrences of this weekday are off → treat as a recurring non-working day
        recurringOffDays.push(dayName);
        // These dates are accounted for via recurringOffDays, so don't add to specific
      } else {
        // Only some occurrences → keep only the actually-off dates as specific
        examDatesOnDay.filter((d) => offDateSet.has(d)).forEach((d) => remainingSpecificOffDates.push(d));
      }
    }
  }

  // Also include any off-dates whose weekday doesn't appear in exam dates at all
  // (edge case: off-date falls outside any exam day, still block it)
  const allClassifiedDates = new Set([
    ...Array.from(weekdayToExamDates.values()).flat(),
  ]);
  for (const d of specificOffDates) {
    if (!allClassifiedDates.has(d)) {
      remainingSpecificOffDates.push(d);
    }
  }

  return { recurringOffDays, specificOffDates: remainingSpecificOffDates };
}

// ─────────────────────────────────────────────────────────────────────────────
// AVAILABILITY CHECK
// ─────────────────────────────────────────────────────────────────────────────

export function isStaffAvailable(
  staff: Staff,
  examSession: ExamSession,
  existingAssignments: Assignment[],
  allExamSessions: ExamSession[],
  constraints: SchedulingConstraintsConfig,
  allExamDates: string[],
  targetRoom?: Room | null,
  periodFreeStaff: PeriodFreeStaff[] = [],
  calendarRules: CalendarRule[] = [],
  peerMinScore?: number,
  strictOffDays: boolean = false,
  allowWorkloadCapRelax: boolean = false,
  allowDayCapRelax: boolean = false,
  rooms?: Room[],
  allowRelaxCrossBuilding: boolean = false
): {
  available: boolean;
  hardViolations: AssignmentConstraintViolation[];
  softViolations: AssignmentConstraintViolation[];
} {
  const hardViolations: AssignmentConstraintViolation[] = [];
  const softViolations: AssignmentConstraintViolation[] = [];

  const sessionLookup: Map<string, ExamSession> =
    (allExamSessions as any)._sessionMap ||= new Map<string, ExamSession>(allExamSessions.map((s) => [s.id, s]));
  const dayPeriodsMap: Map<string, DayPeriodInfo[]> =
    (allExamSessions as any)._dayPeriodsMap ||= getDayUniquePeriods(allExamSessions);

  // 1. Availability Status (Hard)
  if (staff.availability_status !== 'Available') {
    hardViolations.push({
      type: 'unavailable',
      message: `${staff.name} is ${staff.availability_status}`,
      staff_id: staff.id,
      exam_session_id: examSession.id,
    });
  }

  // 2. Off-day & Designated Day-Off Check (Hard)
  const examDateISO = examSession.exam_date; // already stored as YYYY-MM-DD
  const dateObj = new Date(`${examDateISO}T12:00:00Z`);
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });

  // 2a. Strict Specific Off-Dates (individual leaves, medical, vacation)
  // CRITICAL SAFETY RULE: Approved individual leaves (medical, emergency, vacation) are ALWAYS respected!
  if (staff.specific_off_dates?.includes(examDateISO)) {
    hardViolations.push({
      type: 'unavailable',
      message: `${staff.name} has an approved specific day-off on ${examDateISO}`,
      staff_id: staff.id,
      exam_session_id: examSession.id,
    });
  } else if (staff.specific_standard_off_dates?.includes(examDateISO)) {
    const isUniversalWorkingDay = calendarRules.some(r => r.is_universal_working_day && r.start_date <= examDateISO && r.end_date >= examDateISO);
    if (!isUniversalWorkingDay) {
      hardViolations.push({
        type: 'unavailable',
        message: `${staff.name} has a standard specific day-off on ${examDateISO}`,
        staff_id: staff.id,
        exam_session_id: examSession.id,
      });
    }
  }

  // 2b. Mandatory Staff Designated Off-Day Check (from staff.working_days):
  // If the user or staff member has explicitly set this day as off in their profile
  // (e.g. Tuesday is unchecked in working_days), this day is an OBLIGATORY MANDATORY OFF-DAY (أجازة إجباري).
  // The staff member MUST NOT be assigned on this day under any circumstances.
  if (staff.working_days && staff.working_days.length > 0 && !staff.working_days.includes(dayName)) {
    hardViolations.push({
      type: 'unavailable',
      message: `${staff.name} is designated OFF on ${dayName}s (mandatory off-day in staff profile)`,
      staff_id: staff.id,
      exam_session_id: examSession.id,
    });
  }

  // 2d. Check if staff is already assigned as a Reserve for this period (Hard)
  const sessionPeriod = getSessionPeriod(examSession, allExamSessions, dayPeriodsMap);
  const isReserve = periodFreeStaff.some(
    r => r.staff_id === staff.id && r.exam_date === examSession.exam_date && (
      r.period === sessionPeriod ||
      r.start_time === examSession.start_time ||
      timesOverlap(r.start_time, undefined, examSession.start_time, examSession.end_time)
    )
  );
  if (isReserve) {
    hardViolations.push({
      type: 'double_booking',
      message: `${staff.name} is already assigned as a Reserve for this period`,
      staff_id: staff.id,
      exam_session_id: examSession.id,
    });
  }

  // 3. Double Booking (Hard)
  // Prevent assigning the same staff member to the same session multiple times in different roles
  const alreadyInSession = existingAssignments.some((a) => a.staff_id === staff.id && a.exam_session_id === examSession.id);
  if (alreadyInSession) {
    hardViolations.push({
      type: 'double_booking',
      message: `${staff.name} is already assigned to this specific session`,
      staff_id: staff.id,
      exam_session_id: examSession.id,
    });
  }

  // 3b. Oral Exam specific checks (Hard)
  if (examSession.exam_type?.toLowerCase().includes('oral')) {
    if (!staff.can_supervise_oral && examSession.exam_date >= '2026-06-20') {
      hardViolations.push({
        type: 'unavailable',
        message: `${staff.name} does not have the privilege to supervise Oral Exams (applies starting June 20)`,
        staff_id: staff.id,
        exam_session_id: examSession.id,
      });
    }

    if (staff.supervision_role !== 'Invigilator' && staff.supervision_role !== 'Invigilator / Exam Supervisor') {
      hardViolations.push({
        type: 'unavailable',
        message: `${staff.name} role (${staff.supervision_role}) is not allowed for Oral Exams`,
        staff_id: staff.id,
        exam_session_id: examSession.id,
      });
    }
  }

  const conflicting = existingAssignments.filter((a) => {
    const s = sessionLookup.get(a.exam_session_id);
    return s && a.staff_id === staff.id && s.exam_date === examSession.exam_date && areSessionsInSamePeriod(s, examSession, allExamSessions, dayPeriodsMap);
  });
  
  if (conflicting.length > 0) {
    const inDifferentRoom = conflicting.some(a => {
      const s = sessionLookup.get(a.exam_session_id);
      if (!s) return false;
      const isSameRoom = Boolean(
        (s.room_id && examSession.room_id && s.room_id === examSession.room_id) ||
        ((s as any).room?.room_name && (examSession as any).room?.room_name &&
         (s as any).room.room_name.trim().toLowerCase() === (examSession as any).room.room_name.trim().toLowerCase()) ||
        ((s as any).room_name && (examSession as any).room_name &&
         (s as any).room_name.trim().toLowerCase() === (examSession as any).room_name.trim().toLowerCase())
      );
      return !isSameRoom;
    });

    if (inDifferentRoom) {
      // Committees Supervisors can be assigned to different rooms concurrently.
      const isCommitteesSupervisor = staff.supervision_role === 'Committees Supervisor';
      
      if (!isCommitteesSupervisor) {
        hardViolations.push({
          type: 'double_booking',
          message: `${staff.name} is already assigned to another exam room at this time`,
          staff_id: staff.id,
          exam_session_id: examSession.id,
        });
      }
    }
  }

  // 4. Consecutive Shifts
  const sameDayOther = existingAssignments.filter((a) => {
    const s = sessionLookup.get(a.exam_session_id);
    return s && a.staff_id === staff.id && s.exam_date === examSession.exam_date && !areSessionsInSamePeriod(s, examSession, allExamSessions, dayPeriodsMap);
  });
  if (sameDayOther.length > 0) {
    const isConsecutive = sameDayOther.some((a) => {
      const s = sessionLookup.get(a.exam_session_id);
      if (!s) return false;
      const otherPeriod = getSessionPeriod(s, allExamSessions, dayPeriodsMap);
      return Math.abs(otherPeriod - sessionPeriod) === 1;
    });
    if (isConsecutive) {
      const shiftPolicy = constraints.consecutive_shifts_policy || (!constraints.allow_consecutive_shifts ? 'avoid' : 'allow');
      if (shiftPolicy === 'strictly_prevent') {
        hardViolations.push({
          type: 'consecutive_shifts',
          message: `${staff.name} is already assigned to an adjacent shift on ${examSession.exam_date} (strictly prohibited)`,
          staff_id: staff.id,
          exam_session_id: examSession.id,
        });
      } else if (shiftPolicy === 'avoid') {
        softViolations.push({
          type: 'consecutive_shifts',
          message: `${staff.name} has a consecutive shift on ${examSession.exam_date}`,
          staff_id: staff.id,
          exam_session_id: examSession.id,
        });
      }
    }

    // 4a. Cross-Building Distance Warning / Strict Prevention for tight/no-gap shifts
    if (targetRoom) {
      const targetBuilding = getRoomBuilding(targetRoom, targetRoom.room_name);
      for (const a of sameDayOther) {
        const s = sessionLookup.get(a.exam_session_id);
        if (!s) continue;
        const gap = getSessionGapMinutes(s, examSession);
        if (gap <= 15) {
          const sRoom = rooms?.find(r => r.id === s.room_id);
          const sBuilding = getRoomBuilding(sRoom, (s as any).room?.room_name || (s as any).room_name || sRoom?.room_name);
          if (targetBuilding !== 'UNKNOWN' && sBuilding !== 'UNKNOWN' && targetBuilding !== sBuilding) {
            // If gap is strictly 0 minutes (no gap between periods), cross-building is physically impossible and strictly banned
            if (gap > 0 && allowRelaxCrossBuilding) {
              softViolations.push({
                type: 'capacity',
                message: `${staff.name} has a tight back-to-back shift in a different building (${sBuilding} -> ${targetBuilding}, gap ${gap} min) - allowed as emergency fallback`,
                staff_id: staff.id,
                exam_session_id: examSession.id,
              });
            } else {
              hardViolations.push({
                type: 'capacity',
                message: `${staff.name} has a zero/tight back-to-back shift in a different building (${sBuilding} -> ${targetBuilding}, gap ${gap} min)`,
                staff_id: staff.id,
                exam_session_id: examSession.id,
              });
            }
          }
        }
      }
    }
  }

  // 4b. Max Working Days per week (Strict ceiling configured in Settings)
  const sessionWeekKey = getAcademicWeekKey(examSession.exam_date);
  const datesAssignedInWeek = new Set<string>();
  existingAssignments.forEach(a => {
    if (a.staff_id === staff.id) {
      const s = sessionLookup.get(a.exam_session_id);
      if (s && getAcademicWeekKey(s.exam_date) === sessionWeekKey) {
        datesAssignedInWeek.add(s.exam_date);
      }
    }
  });
  for (const r of periodFreeStaff) {
    if (r.staff_id === staff.id && r.exam_date && getAcademicWeekKey(r.exam_date) === sessionWeekKey) {
      datesAssignedInWeek.add(r.exam_date);
    }
  }

  // Settings-driven cap:
  // Full-time: custom_days_per_week (default 5). If set to 5 -> 6 prohibited; if set to 4 -> 5 prohibited; if set to 3 -> 4 prohibited.
  // Part-time: max_days_per_week_pt (default 3). If set to 3 -> 4 prohibited; if set to 2 -> 3 prohibited.
  const configuredFTDays = constraints.custom_days_per_week ?? 5;
  const configuredPTDays = Math.min(3, Math.max(1, constraints.max_days_per_week_pt ?? 3));
  let maxAllowedDaysInWeek = staff.employment_status === 'Part-time' ? configuredPTDays : configuredFTDays;

  // Cap cannot exceed the number of available working days the staff member actually has in their profile
  if (staff.working_days && staff.working_days.length > 0) {
    maxAllowedDaysInWeek = Math.min(maxAllowedDaysInWeek, staff.working_days.length);
  }

  // If this examSession is on a NEW date, check if they are already at their weekly limit.
  // This is a strict prohibition unless in emergency fallback (allowDayCapRelax).
  if (!datesAssignedInWeek.has(examSession.exam_date)) {
    if (datesAssignedInWeek.size >= maxAllowedDaysInWeek) {
      if (allowDayCapRelax) {
        softViolations.push({
          type: 'unavailable',
          message: `${staff.name} (${staff.employment_status}) exceeds weekly working days cap (${maxAllowedDaysInWeek} days this week as configured in Settings) - allowed as emergency fallback to prevent unstaffed room`,
          staff_id: staff.id,
          exam_session_id: examSession.id,
        });
      } else {
        hardViolations.push({
          type: 'unavailable',
          message: `${staff.name} (${staff.employment_status}) has reached their maximum allowed working days (${maxAllowedDaysInWeek} days this week as configured in Settings)`,
          staff_id: staff.id,
          exam_session_id: examSession.id,
        });
      }
    }
  }

  // 4c. Max Daily Shifts & Shift Spreading (Equalize daily shifts across all staff on duty)
  const sameDayDistinctPeriods = new Set<number>();
  existingAssignments.forEach((a) => {
    if (a.staff_id === staff.id) {
      const s = sessionLookup.get(a.exam_session_id);
      if (s && s.exam_date === examSession.exam_date) {
        sameDayDistinctPeriods.add(getSessionPeriod(s, allExamSessions, dayPeriodsMap));
      }
    }
  });

  const isNewPeriodForStaffToday = !sameDayDistinctPeriods.has(sessionPeriod);
  const currentDailyPeriodsCount = sameDayDistinctPeriods.size;
  const configuredMaxDailyShifts = constraints.max_daily_shifts ?? 2;

  if (isNewPeriodForStaffToday) {
    if (currentDailyPeriodsCount >= configuredMaxDailyShifts) {
      if (currentDailyPeriodsCount >= configuredMaxDailyShifts + 1 && !allowWorkloadCapRelax) {
        // Hard limit at 3+ shifts unless relaxing to prevent deficiency
        hardViolations.push({
          type: 'capacity',
          message: `${staff.name} has reached maximum daily shifts cap (${currentDailyPeriodsCount} shifts on ${examSession.exam_date})`,
          staff_id: staff.id,
          exam_session_id: examSession.id,
        });
      } else {
        // Soft violation at 2 shifts: deprioritizes candidate so colleagues with 0 or 1 shift are assigned first!
        softViolations.push({
          type: 'capacity',
          message: `${staff.name} already has ${currentDailyPeriodsCount} shift(s) on ${examSession.exam_date} (daily cap: ${configuredMaxDailyShifts})`,
          staff_id: staff.id,
          exam_session_id: examSession.id,
        });
      }
    }
  }

  // 5. Max weekly hours (Soft)
  const MAX_MIN_FT = (constraints.max_hours_per_week_ft || 16) * 60;
  const MAX_MIN_PT = (constraints.max_hours_per_week_pt || 8) * 60;
  const MAX_MIN_CHEMIST = (constraints.max_hours_per_week_chemist || 20) * 60;
  
  // To avoid double counting concurrent sessions (Exam Supervisor over 3 rooms = 1 x duration, not 3 x duration)
  const distinctSlots = new Map<string, number>();
  existingAssignments.forEach((a) => {
    if (a.staff_id !== staff.id) return;
    const s = sessionLookup.get(a.exam_session_id);
    if (!s) return;
    const key = `${s.exam_date}_${getSessionPeriod(s, allExamSessions, dayPeriodsMap)}`;
    const dur = getDurationInMinutes(s.start_time, s.end_time);
    if (!distinctSlots.has(key) || distinctSlots.get(key)! < dur) {
      distinctSlots.set(key, dur);
    }
  });

  let usedMinutes = 0;
  distinctSlots.forEach(dur => { usedMinutes += dur; });

  let limit = staff.employment_status === 'Full-time' ? MAX_MIN_FT : MAX_MIN_PT;
  if (staff.job_title === 'Chemist') {
    limit = MAX_MIN_CHEMIST;
  }
  const currentExamDuration = getDurationInMinutes(examSession.start_time, examSession.end_time);
  if (usedMinutes + currentExamDuration > limit) {
    softViolations.push({
      type: 'capacity',
      message: `${staff.name} exceeds preferred weekly hours`,
      staff_id: staff.id,
      exam_session_id: examSession.id,
    });
  }

  // 6. Feeding Mother early-leave tracking (Soft)
  if (staff.is_feeding_mother && staff.feeding_mother_days > 0) {
    const { maxDays2h, maxDays1h } = getFeedingMotherEarlyLeaveDays(staff);
    // Count distinct exam days already assigned
    const assignedDays = new Set(
      existingAssignments
        .filter((a) => a.staff_id === staff.id)
        .map((a) => sessionLookup.get(a.exam_session_id)?.exam_date)
        .filter(Boolean)
    );
    const dayAllowance = Math.max(maxDays2h, maxDays1h); // worst case: allow up to maxDays1h distinct days
    if (assignedDays.size >= dayAllowance) {
      softViolations.push({
        type: 'feeding_mother_hours',
        message: `${staff.name} (feeding mother) has reached her early-leave day allocation`,
        staff_id: staff.id,
        exam_session_id: examSession.id,
      });
    }
  }

  // 7. Health issue: Staff with health issues must only be assigned to pharmacy rooms (M and P buildings)
  if (staff.has_health_issue && targetRoom) {
    const roomName = targetRoom.room_name || '';
    if (roomName && !isNearPharmacy(roomName)) {
      hardViolations.push({
        type: 'health_room',
        message: `${staff.name} has a medical condition and is restricted from non-pharmacy room (${roomName})`,
        staff_id: staff.id,
        exam_session_id: examSession.id,
      });
    }
  }

  // 8. Peer Workload Spread Cap (Fairness)
  if (constraints.max_score_delta_from_average !== undefined && peerMinScore !== undefined) {
    const score = getEffectiveScore(staff);
    const scoreDelta = score - peerMinScore;
    if (scoreDelta >= constraints.max_score_delta_from_average - 1e-6) {
      if (allowWorkloadCapRelax) {
        softViolations.push({
          type: 'workload_cap',
          message: `${staff.name} is at peer workload cap (score ${score.toFixed(2)} vs lowest peer ${peerMinScore.toFixed(2)}) but assigned to prevent room deficiency`,
          staff_id: staff.id,
          exam_session_id: examSession.id,
        });
      } else {
        hardViolations.push({
          type: 'workload_cap',
          message: `${staff.name} has reached the peer workload cap (score ${score.toFixed(2)} vs lowest peer ${peerMinScore.toFixed(2)}). Locked out until peers catch up.`,
          staff_id: staff.id,
          exam_session_id: examSession.id,
        });
      }
    }
  }

  return { available: hardViolations.length === 0, hardViolations, softViolations };
}

// ─────────────────────────────────────────────────────────────────────────────
// SORTING
// ─────────────────────────────────────────────────────────────────────────────

export function getEffectiveScore(staff: Staff): number {
  // A reserve duty is treated as 25% of a full room assignment
  const reserveCredits = ((staff.free_staff_score ?? (staff as any).reserve_count ?? 0) * 0.25);
  const baseScore = (staff.current_score ?? 0) + reserveCredits;
  if (staff.is_overloaded && staff.overload_percentage > 0) {
    const factor = Math.max(0.01, 1 - (staff.overload_percentage / 100));
    return (baseScore / factor) + (staff.overload_percentage / 1000);
  }
  return baseScore;
}

/**
 * Computes the minimum effective workload score for each peer group (cohort)
 * among active, available staff who have scheduled working days.
 * This establishes the peer floor for maximum spread calculations.
 */
export function getPeerMinScores(allStaff: Staff[]): Map<string, number> {
  const peerScores = new Map<string, number[]>();

  for (const s of allStaff) {
    // Only active, available staff who have working days can set the peer cohort baseline
    if (s.availability_status !== 'Available') continue;
    if (!s.working_days || s.working_days.length === 0) continue;

    const group = s.job_title || s.supervision_role || 'General';
    const score = getEffectiveScore(s);
    if (!peerScores.has(group)) {
      peerScores.set(group, []);
    }
    peerScores.get(group)!.push(score);
  }

  const minMap = new Map<string, number>();
  for (const [group, scores] of peerScores.entries()) {
    if (scores.length > 0) {
      minMap.set(group, Math.min(...scores));
    }
  }
  return minMap;
}

export function sortStaffByPriority(
  staff: Staff[],
  preferredJobTitle?: JobTitle,
  preferNearPharmacy?: boolean,
  preferredSupervisionRole?: string,
  schedulingContext?: {
    examDate?: string;
    existingAssignments?: Assignment[];
    allExamSessions?: ExamSession[];
    maxDailyShifts?: number;
    targetRoom?: Room | null;
    currentSession?: ExamSession | null;
    rooms?: Room[];
  }
): Staff[] {
  const jobTitlePriority: Record<JobTitle, number> = {
    Chemist: 3,
    Demonstrator: 2,
    'Teaching Assistant': 1,
    Lecturer: 0,
  };

  const staffStats = new Map<string, { shiftsToday: number; daysThisWeek: number }>();
  if (schedulingContext?.examDate && schedulingContext.existingAssignments) {
    const targetDate = schedulingContext.examDate;
    const weekKey = getAcademicWeekKey(targetDate);
    const sessionMap = (schedulingContext.allExamSessions as any)?._sessionMap ||
      new Map(schedulingContext.allExamSessions?.map(s => [s.id, s]) || []);

    for (const s of staff) {
      const distinctSlotsToday = new Set<string>();
      const assignedDates = new Set<string>();
      for (const a of schedulingContext.existingAssignments) {
        if (a.staff_id === s.id) {
          const sess = sessionMap.get(a.exam_session_id);
          const sDate = (a as any).exam_date || sess?.exam_date;
          if (sDate) {
            const clean = sDate.split('T')[0];
            if (getAcademicWeekKey(clean) === weekKey) {
              assignedDates.add(clean);
            }
            if (clean === targetDate) {
              const sTime = (a as any).start_time || sess?.start_time || 'slot';
              distinctSlotsToday.add(sTime);
            }
          }
        }
      }
      staffStats.set(s.id, { shiftsToday: distinctSlotsToday.size, daysThisWeek: assignedDates.size });
    }
  }

  const maxDaily = schedulingContext?.maxDailyShifts ?? 2;

  return [...staff].sort((a, b) => {
    // 0. Proximity & Continuity Affinity (Top Priority for contiguous periods with no/tight gap)
    if (schedulingContext?.targetRoom && schedulingContext.currentSession) {
      const affA = getStaffRoomAffinity(
        a.id,
        schedulingContext.targetRoom,
        schedulingContext.currentSession,
        schedulingContext.existingAssignments || [],
        schedulingContext.allExamSessions || [],
        schedulingContext.rooms
      );
      const affB = getStaffRoomAffinity(
        b.id,
        schedulingContext.targetRoom,
        schedulingContext.currentSession,
        schedulingContext.existingAssignments || [],
        schedulingContext.allExamSessions || [],
        schedulingContext.rooms
      );

      if (affA.affinityScore !== affB.affinityScore) {
        return affB.affinityScore - affA.affinityScore;
      }
    }

    // Health-room preference: near-pharmacy staff prioritized first for pharmacy rooms,
    // provided they have not already exceeded the peer workload (to prevent overloading them)
    if (preferNearPharmacy) {
      const aScore = getEffectiveScore(a);
      const bScore = getEffectiveScore(b);
      if (a.has_health_issue && !b.has_health_issue) {
        if (aScore <= bScore + 1) return -1;
      }
      if (!a.has_health_issue && b.has_health_issue) {
        if (bScore <= aScore + 1) return 1;
      }
    }

    if (staffStats.size > 0) {
      const statsA = staffStats.get(a.id);
      const statsB = staffStats.get(b.id);
      if (statsA && statsB) {
        // 1. Shift Packing / Day-off Preservation:
        // Candidates already on campus today (shiftsToday > 0) who can take another shift today
        // consume 0 new working days! Prioritize them to keep colleagues home with full days off!
        const canPackA = statsA.shiftsToday > 0 && statsA.shiftsToday < maxDaily ? 1 : 0;
        const canPackB = statsB.shiftsToday > 0 && statsB.shiftsToday < maxDaily ? 1 : 0;
        if (canPackA !== canPackB) {
          return canPackB - canPackA;
        }

        // 2. Weekly Day Balance: Candidate with fewer assigned days in this week comes first!
        if (statsA.daysThisWeek !== statsB.daysThisWeek) {
          return statsA.daysThisWeek - statsB.daysThisWeek;
        }
      }
    }

    // Lowest effective score first (PRIMARY SORT: Strict Fairness & Parity across colleagues)
    const aScore = getEffectiveScore(a);
    const bScore = getEffectiveScore(b);
    if (Math.abs(aScore - bScore) > 0.01) return aScore - bScore;

    // Prefer specific supervision role ONLY as a tie-breaker when scores are equal
    // (e.g. prioritize exact "Exam Supervisor" over "Invigilator / Exam Supervisor")
    if (preferredSupervisionRole) {
      const aR = a.supervision_role === preferredSupervisionRole ? 1 : 0;
      const bR = b.supervision_role === preferredSupervisionRole ? 1 : 0;
      if (aR !== bR) return bR - aR;
    }

    // Prefer specific job title
    if (preferredJobTitle) {
      const aP = a.job_title === preferredJobTitle ? 1 : 0;
      const bP = b.job_title === preferredJobTitle ? 1 : 0;
      if (aP !== bP) return bP - aP;
    }

    // Job title priority
    const aPriority = jobTitlePriority[a.job_title] || 0;
    const bPriority = jobTitlePriority[b.job_title] || 0;
    if (aPriority !== bPriority) return bPriority - aPriority;

    // Rotational deterministic tie-breaker instead of alphabetical name to prevent alphabetical bias
    const seed = (schedulingContext?.examDate || '').split('-').reduce((acc, part) => acc + Number(part), 0);
    const hashA = (a.id.charCodeAt(0) * 31 + a.id.charCodeAt(a.id.length - 1) + seed) % 1000;
    const hashB = (b.id.charCodeAt(0) * 31 + b.id.charCodeAt(b.id.length - 1) + seed) % 1000;
    if (hashA !== hashB) return hashA - hashB;

    return a.id.localeCompare(b.id);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOM-SESSION GROUPING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Groups exam sessions that share the same room + period + date.
 * When two exams share a room-slot, their students must be summed to
 * determine invigilator count, and they must share the same Committees Supervisor.
 */


export function groupSessionsByRoom(sessions: ExamSession[]): RoomSessionGroup[] {
  const map = new Map<string, RoomSessionGroup>();

  for (const session of sessions) {
    const period = getSessionPeriod(session, sessions);
    const slotKey = `${session.room_id}__${session.exam_date}__${period}`;
    if (!map.has(slotKey)) {
      map.set(slotKey, {
        room_id: session.room_id,
        exam_date: session.exam_date,
        start_time: session.start_time,
        session_ids: [],
        total_students: 0,
        isOral: false,
      });
    }
    const group = map.get(slotKey)!;
    group.session_ids.push(session.id);
    group.total_students += session.student_count;
    group.isOral = group.isOral || !!session.exam_type?.toLowerCase().includes('oral');
  }

  return Array.from(map.values());
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE-SESSION ASSIGNMENT
// ─────────────────────────────────────────────────────────────────────────────

export function assignStaffToSession(
  examSession: ExamSession,
  allStaff: Staff[],
  existingAssignments: Assignment[],
  allExamSessions: ExamSession[],
  config: AutoAssignConfig,
  targetRoom?: Room | null,
  /** If this session shares a room, pass the Committees Supervisor already assigned to that room-slot */
  sharedCommitteeSupervisorId?: string | null,
  periodFreeStaff: PeriodFreeStaff[] = [],
  roleToAssign: 'Both' | 'Head_Supervisor' | 'Assistant' = 'Both',
  rooms?: Room[]
): AssignmentResult {
  const violations: AssignmentConstraintViolation[] = [];
  const newAssignments: Assignment[] = [];

  const isOral = !!examSession.exam_type?.toLowerCase().includes('oral');
  const required = calculateRequiredStaff(examSession.student_count, config.ratios, isOral, examSession.exam_date, config.calendarRules);

  const strictRoles = config.constraints.enforce_strict_roles !== false;
  const nearPharmacy = targetRoom ? isNearPharmacy(targetRoom.room_name) : false;

  // Precompute the lowest effective score for each peer group among active colleagues
  const peerMinScores = getPeerMinScores(allStaff);

  // Evaluate each staff member's availability (workload cap is a soft constraint during room assignment, strictly equalized at post-pass)
  const staffWithStatus = allStaff.map((staff) => {
    const peerMinScore = peerMinScores.get(staff.job_title || staff.supervision_role || 'General');
    const { available, hardViolations, softViolations } = isStaffAvailable(
      staff, examSession, existingAssignments, allExamSessions, config.constraints,
      Array.from(new Set(allExamSessions.map(s => s.exam_date))), targetRoom,
      periodFreeStaff, config.calendarRules, peerMinScore, false, true, false,
      rooms, false
    );
    return { staff, available, hardViolations, softViolations };
  });

  // Separate health-issue staff: prefer them for near-pharmacy rooms
  const availableAll = staffWithStatus.filter((s) => s.available);

  // Health Status Balancing:
  // For pharmacy rooms (P and M buildings): health-issue staff are prioritized first so they get convenient rooms.
  // For non-pharmacy rooms: staff with health issues are completely removed from the candidate pool.
  const healthStaff = availableAll.filter((s) => s.staff.has_health_issue);
  const normalStaff = availableAll.filter((s) => !s.staff.has_health_issue);

  const orderedPool = nearPharmacy
    ? [...healthStaff, ...normalStaff]
    : normalStaff;

  const pickBest = (
    candidates: typeof availableAll,
    excluded: Staff[],
    preferredJob?: JobTitle,
    preferredSupervisionRole?: string
  ): Staff | undefined => {
    const configuredMaxDaily = config.constraints?.max_daily_shifts ?? 3;
    const sorted = sortStaffByPriority(
      candidates.map((c) => c.staff),
      preferredJob,
      nearPharmacy,
      preferredSupervisionRole,
      {
        examDate: examSession.exam_date,
        existingAssignments: [...existingAssignments, ...newAssignments],
        allExamSessions,
        maxDailyShifts: configuredMaxDaily,
        targetRoom,
        currentSession: examSession,
        rooms,
      }
    );
    return sorted.find((s) => !excluded.some((e) => e.id === s.id));
  };

  // ── 1. Exam Supervisor (Per Room) ──
  // ONLY exam supervisor or Invigilator / Exam Supervisor are allowed to be exam supervisor.
  const existingHeads = existingAssignments.filter(
    (a) => a.exam_session_id === examSession.id && a.role === 'Exam_Supervisor'
  );
  const neededHeadSupervisors = Math.max(0, required.headSupervisors - existingHeads.length);

  const headPool = orderedPool.filter(
    (s) => s.staff.supervision_role === 'Exam Supervisor' || s.staff.supervision_role === 'Invigilator / Exam Supervisor'
  );

  const headSupervisors: Staff[] = [];
  if (roleToAssign === 'Both' || roleToAssign === 'Head_Supervisor') {
    for (let i = 0; i < neededHeadSupervisors; i++) {
      const candidate = pickBest(headPool, headSupervisors, undefined, 'Exam Supervisor');
      if (candidate) {
        headSupervisors.push(candidate);
        newAssignments.push({
          id: crypto.randomUUID(),
          exam_session_id: examSession.id,
          staff_id: candidate.id,
          role: 'Exam_Supervisor',
          assigned_at: new Date().toISOString(),
          assigned_by: null,
          is_manual_override: false,
        });
        const status = staffWithStatus.find((s) => s.staff.id === candidate.id);
        if (status?.softViolations.length) violations.push(...status.softViolations);
      }
    }
    if (headSupervisors.length < neededHeadSupervisors) {
      // Tier 2 Fallback: Relax workload cap to prevent room deficiency
      const fallbackStaffWithStatus = allStaff.map((staff) => {
        const peerMinScore = peerMinScores.get(staff.job_title || staff.supervision_role || 'General');
        return {
          staff,
          ...isStaffAvailable(
            staff, examSession, existingAssignments, allExamSessions, config.constraints,
            Array.from(new Set(allExamSessions.map(s => s.exam_date))), targetRoom, periodFreeStaff,
            config.calendarRules, peerMinScore, false, true, false, rooms, false
          )
        };
      });
      const fallbackHeadPool = fallbackStaffWithStatus.filter(
        (s) => s.available && (s.staff.supervision_role === 'Exam Supervisor' || s.staff.supervision_role === 'Invigilator / Exam Supervisor')
      );
      while (headSupervisors.length < neededHeadSupervisors) {
        const candidate = pickBest(fallbackHeadPool, headSupervisors, undefined, 'Exam Supervisor');
        if (!candidate) break;
        headSupervisors.push(candidate);
        newAssignments.push({
          id: crypto.randomUUID(),
          exam_session_id: examSession.id,
          staff_id: candidate.id,
          role: 'Exam_Supervisor',
          assigned_at: new Date().toISOString(),
          assigned_by: null,
          is_manual_override: false,
        });
      }
    }

    if (headSupervisors.length < neededHeadSupervisors) {
      // Tier 3 Fallback (Zero-Deficiency Guarantee): Prevent unstaffed room by relaxing day cap and cross-building
      const emergencyStaffWithStatus = allStaff.map((staff) => {
        const peerMinScore = peerMinScores.get(staff.job_title || staff.supervision_role || 'General');
        return {
          staff,
          ...isStaffAvailable(
            staff, examSession, existingAssignments, allExamSessions, config.constraints,
            Array.from(new Set(allExamSessions.map(s => s.exam_date))), targetRoom, periodFreeStaff,
            config.calendarRules, peerMinScore, false, true, true, rooms, true
          )
        };
      });
      const emergencyHeadPool = emergencyStaffWithStatus.filter(
        (s) => s.available && (s.staff.supervision_role === 'Exam Supervisor' || s.staff.supervision_role === 'Invigilator / Exam Supervisor')
      );
      while (headSupervisors.length < neededHeadSupervisors) {
        const candidate = pickBest(emergencyHeadPool, headSupervisors, undefined, 'Exam Supervisor');
        if (!candidate) break;
        headSupervisors.push(candidate);
        newAssignments.push({
          id: crypto.randomUUID(),
          exam_session_id: examSession.id,
          staff_id: candidate.id,
          role: 'Exam_Supervisor',
          assigned_at: new Date().toISOString(),
          assigned_by: null,
          is_manual_override: false,
        });
      }
    }

    if (existingHeads.length + headSupervisors.length < required.headSupervisors) {
      violations.push({
        type: 'capacity',
        message: `Not enough Exam Supervisors for ${examSession.subject_name}. Required: ${required.headSupervisors}, Found: ${existingHeads.length + headSupervisors.length}`,
        exam_session_id: examSession.id,
      });
    }
  }

  // ── 2. Invigilators (Assistants) ──
  if (roleToAssign === 'Both' || roleToAssign === 'Assistant') {
    const existingAssistants = existingAssignments.filter(
      (a) => a.exam_session_id === examSession.id && a.role === 'Assistant'
    );
    const neededAssistants = Math.max(0, required.assistants - existingAssistants.length);

    const assistantPool = strictRoles
      ? orderedPool.filter((s) => s.staff.supervision_role === 'Invigilator' || s.staff.supervision_role === 'Invigilator / Exam Supervisor')
      : orderedPool.filter((s) => s.staff.supervision_role !== 'Exam Supervisor' && s.staff.supervision_role !== 'Committees Supervisor');

    const configuredMaxDaily = config.constraints?.max_daily_shifts ?? 3;
    const assistantSortContext = {
      examDate: examSession.exam_date,
      existingAssignments: [...existingAssignments, ...newAssignments],
      allExamSessions,
      maxDailyShifts: configuredMaxDaily,
      targetRoom,
      currentSession: examSession,
      rooms,
    };
    const allSortedAssistants = sortStaffByPriority(
      assistantPool.map((s) => s.staff),
      undefined,
      nearPharmacy,
      'Invigilator',
      assistantSortContext
    );

    const excludedFromAssistants = [
      ...headSupervisors,
      ...existingHeads.map(h => allStaff.find(s => s.id === h.staff_id)).filter(Boolean) as Staff[],
      ...existingAssistants.map(ast => allStaff.find(s => s.id === ast.staff_id)).filter(Boolean) as Staff[]
    ];
    const finalAssistantPool = allSortedAssistants.filter(
      (s) => !excludedFromAssistants.some((e) => e.id === s.id)
    );

    for (let i = 0; i < neededAssistants && i < finalAssistantPool.length; i++) {
      const candidate = finalAssistantPool[i];
      newAssignments.push({
        id: crypto.randomUUID(),
        exam_session_id: examSession.id,
        staff_id: candidate.id,
        role: 'Assistant',
        assigned_at: new Date().toISOString(),
        assigned_by: null,
        is_manual_override: false,
      });
      const status = staffWithStatus.find((s) => s.staff.id === candidate.id);
      if (status?.softViolations.length) violations.push(...status.softViolations);
    }

    let assignedAssistants = newAssignments.filter((a) => a.role === 'Assistant').length;

    if (assignedAssistants < neededAssistants) {
      // Tier 2 Fallback: Relax workload cap to prevent assistant deficiency
      const fallbackStaffWithStatus = allStaff.map((staff) => {
        const peerMinScore = peerMinScores.get(staff.job_title || staff.supervision_role || 'General');
        return {
          staff,
          ...isStaffAvailable(
            staff, examSession, existingAssignments, allExamSessions, config.constraints,
            Array.from(new Set(allExamSessions.map(s => s.exam_date))), targetRoom, periodFreeStaff,
            config.calendarRules, peerMinScore, false, true, false, rooms, false
          )
        };
      });
      const fallbackPool = strictRoles
        ? fallbackStaffWithStatus.filter((s) => s.available && (s.staff.supervision_role === 'Invigilator' || s.staff.supervision_role === 'Invigilator / Exam Supervisor'))
        : fallbackStaffWithStatus.filter((s) => s.available && s.staff.supervision_role !== 'Exam Supervisor' && s.staff.supervision_role !== 'Committees Supervisor');
      
      const excludedStaff = [...excludedFromAssistants, ...newAssignments.map(a => allStaff.find(s => s.id === a.staff_id)).filter(Boolean) as Staff[]];
      const eligible = sortStaffByPriority(fallbackPool.map(p => p.staff), undefined, nearPharmacy, 'Invigilator', assistantSortContext)
        .filter(s => !excludedStaff.some(e => e.id === s.id));

      for (let i = 0; i < eligible.length && assignedAssistants < neededAssistants; i++) {
        const candidate = eligible[i];
        newAssignments.push({
          id: crypto.randomUUID(),
          exam_session_id: examSession.id,
          staff_id: candidate.id,
          role: 'Assistant',
          assigned_at: new Date().toISOString(),
          assigned_by: null,
          is_manual_override: false,
        });
        assignedAssistants++;
        excludedStaff.push(candidate);
      }
    }

    if (assignedAssistants < neededAssistants) {
      // Tier 3 Fallback (Zero-Deficiency Guarantee): Prevent unstaffed room by relaxing day cap and cross-building
      const emergencyStaffWithStatus = allStaff.map((staff) => {
        const peerMinScore = peerMinScores.get(staff.job_title || staff.supervision_role || 'General');
        return {
          staff,
          ...isStaffAvailable(
            staff, examSession, existingAssignments, allExamSessions, config.constraints,
            Array.from(new Set(allExamSessions.map(s => s.exam_date))), targetRoom, periodFreeStaff,
            config.calendarRules, peerMinScore, false, true, true, rooms, true
          )
        };
      });
      const emergencyPool = strictRoles
        ? emergencyStaffWithStatus.filter((s) => s.available && (s.staff.supervision_role === 'Invigilator' || s.staff.supervision_role === 'Invigilator / Exam Supervisor'))
        : emergencyStaffWithStatus.filter((s) => s.available && s.staff.supervision_role !== 'Exam Supervisor' && s.staff.supervision_role !== 'Committees Supervisor');
      
      const excludedStaff = [...excludedFromAssistants, ...newAssignments.map(a => allStaff.find(s => s.id === a.staff_id)).filter(Boolean) as Staff[]];
      const eligible = sortStaffByPriority(emergencyPool.map(p => p.staff), undefined, nearPharmacy, 'Invigilator', assistantSortContext)
        .filter(s => !excludedStaff.some(e => e.id === s.id));

      for (let i = 0; i < eligible.length && assignedAssistants < neededAssistants; i++) {
        const candidate = eligible[i];
        newAssignments.push({
          id: crypto.randomUUID(),
          exam_session_id: examSession.id,
          staff_id: candidate.id,
          role: 'Assistant',
          assigned_at: new Date().toISOString(),
          assigned_by: null,
          is_manual_override: false,
        });
        assignedAssistants++;
        excludedStaff.push(candidate);
      }
    }

    if (existingAssistants.length + assignedAssistants < required.assistants) {
      violations.push({
        type: 'capacity',
        message: `Not enough Invigilators for ${examSession.subject_name}. Required: ${required.assistants}, Found: ${existingAssistants.length + assignedAssistants}`,
        exam_session_id: examSession.id,
      });
    }
  }

  return {
    success: violations.every((v) => v.type === 'consecutive_shifts' || v.type === 'capacity' || v.type === 'health_room' || v.type === 'feeding_mother_hours'),
    assignments: newAssignments,
    violations,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH ASSIGNMENT (room-aware)
// ─────────────────────────────────────────────────────────────────────────────

export function batchAssign(
  sessions: ExamSession[],
  staff: Staff[],
  existingAssignments: Assignment[],
  config: AutoAssignConfig,
  rooms?: Room[],
  periodFreeStaff: PeriodFreeStaff[] = [],
  onlyOral?: boolean,
  onlyFinal?: boolean,
  onlyMidterm?: boolean
): { assignments: Assignment[]; violations: AssignmentConstraintViolation[] } {
  let effectiveSessions = sessions;
  const oralMode = config.constraints?.oral_exam_assignment_mode || 'combined';
  if (onlyMidterm || oralMode === 'skip') {
    effectiveSessions = sessions.filter(s => !s.exam_type?.toLowerCase().includes('oral'));
  } else if (oralMode === 'separate' && !onlyOral) {
    effectiveSessions = sessions.filter(s => !s.exam_type?.toLowerCase().includes('oral'));
  }

  // Step 1: Group sessions by room+period to detect co-located exams
  let roomGroups = groupSessionsByRoom(effectiveSessions);
  
  if (onlyOral) {
    roomGroups = roomGroups.filter(g => {
      const sample = effectiveSessions.find(s => s.id === g.session_ids[0]);
      return sample && sample.exam_type?.toLowerCase().includes('oral');
    });
  } else if (onlyFinal || onlyMidterm) {
    roomGroups = roomGroups.filter(g => {
      const sample = effectiveSessions.find(s => s.id === g.session_ids[0]);
      return sample && !sample.exam_type?.toLowerCase().includes('oral');
    });
  }

  // Step 2: Sort sessions — largest (by combined group students) first
  const groupMap = new Map<string, RoomSessionGroup>();
  for (const group of roomGroups) {
    for (const sid of group.session_ids) {
      groupMap.set(sid, group);
    }
  }

  const sortedSessions = [...effectiveSessions].sort((a, b) => {
    const ga = groupMap.get(a.id)?.total_students ?? a.student_count;
    const gb = groupMap.get(b.id)?.total_students ?? b.student_count;
    return gb - ga;
  });

  let currentAssignments = [...existingAssignments];
  let currentStaff = staff.map((s) => ({
    ...s,
    specific_standard_off_dates: [...(s.specific_standard_off_dates || [])],
    specific_off_dates: [...(s.specific_off_dates || [])]
  }));
  const allNewAssignments: Assignment[] = [];
  const allViolations: AssignmentConstraintViolation[] = [];
  const allExamDates = Array.from(new Set(effectiveSessions.map(s => s.exam_date)));

  // --- PRE-PASS: UNIVERSAL WORKING DAY COMPENSATORY OFF-DAYS ---
  // (Skipped if ignoring staff working days or under flexible cap_days_per_week)
  const resolvedPrepassPolicy = resolveAvailabilityPolicy(config.constraints).policy;
  if (resolvedPrepassPolicy !== 'cap_days_per_week' && !config.ignoreStaffAvailableDays) {
    const dailyLoads = new Map<string, number>();
    for (const date of allExamDates) {
      dailyLoads.set(date, effectiveSessions.filter(s => s.exam_date === date).length);
    }

    const universalWorkingDays = new Set<string>();
    const calendarRules = config.calendarRules || [];
    for (const date of allExamDates) {
      const isUWD = calendarRules.some(r => r.is_universal_working_day && r.start_date <= date && r.end_date >= date);
      if (isUWD) {
        universalWorkingDays.add(date);
      }
    }

    for (const uwdDate of universalWorkingDays) {
      const dateObj = new Date(`${uwdDate}T12:00:00Z`);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
      
      for (const s of currentStaff) {
        if (s.supervision_role === 'Committees Supervisor') continue; // Not subject to Universal Working Day
        
        const { recurringOffDays } = classifyOffDays(s.specific_off_dates || [], allExamDates);
        const isDefaultOffDay = (s.working_days && !s.working_days.includes(dayName)) || recurringOffDays.includes(dayName);
        
        if (isDefaultOffDay) {
          let bestCompensatoryDate: string | null = null;
          let minLoad = Infinity;
          
          for (const candidateDate of allExamDates) {
            if (universalWorkingDays.has(candidateDate)) continue;
            
            const candObj = new Date(`${candidateDate}T12:00:00Z`);
            const candDayName = candObj.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
            
            const isAlreadyOff = (s.working_days && !s.working_days.includes(candDayName)) 
              || recurringOffDays.includes(candDayName) 
              || (s.specific_off_dates && s.specific_off_dates.includes(candidateDate))
              || (s.specific_standard_off_dates && s.specific_standard_off_dates.includes(candidateDate));
              
            if (!isAlreadyOff) {
              const load = dailyLoads.get(candidateDate) || 0;
              if (load < minLoad) {
                minLoad = load;
                bestCompensatoryDate = candidateDate;
              }
            }
          }
          
          if (bestCompensatoryDate) {
            // Deep copy to avoid mutating the original staff object passed into the function
            s.specific_standard_off_dates = s.specific_standard_off_dates ? [...s.specific_standard_off_dates] : [];
            if (!s.specific_standard_off_dates.includes(bestCompensatoryDate)) {
              s.specific_standard_off_dates.push(bestCompensatoryDate);
            }
          }
        }
      }
    }
  }

  // --- PRE-PASS: COMMITTEES SUPERVISOR ASSIGNMENTS ---
  const requireCommitteesSupervisors = config.constraints?.require_committees_supervisors !== false;
  const configuredMaxRooms = config.constraints?.max_rooms_per_lecturer || 3;
  const configuredMaxFloors = config.constraints?.max_floors_per_supervisor || 2;

  if (requireCommitteesSupervisors) {
  // Group sessions by date + unique period of that day
  const datePeriodGroups = new Map<string, ExamSession[]>();
  for (const session of sortedSessions) {
    const period = getSessionPeriod(session, sessions);
    const key = `${session.exam_date}_${period}`;
    if (!datePeriodGroups.has(key)) datePeriodGroups.set(key, []);
    datePeriodGroups.get(key)!.push(session);
  }

  // Sort slot keys chronologically (date ascending, then period ascending)
  // This guarantees duties progress naturally day-by-day and period-by-period
  const sortedSlotKeys = Array.from(datePeriodGroups.keys()).sort((a, b) => {
    const [dateA, periodA] = a.split('_');
    const [dateB, periodB] = b.split('_');
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return Number(periodA) - Number(periodB);
  });

  // Track Committees Supervisor assignment frequency to achieve strict workload equalization in the same week
  const csAssignedPeriods = new Map<string, Set<string>>(); // staffId -> Set of slotKeys ('YYYY-MM-DD_Period')
  const csDailyDutyCounts = new Map<string, Map<string, number>>(); // staffId -> Map of date -> count
  const csPeriodDutyCounts = new Map<string, number>(); // staffId -> count of period duties in this run/week
  const csAssignedDatesInWeek = new Map<string, Map<string, Set<string>>>(); // staffId -> weekKey -> Set<date>

  for (const s of currentStaff) {
    if (s.supervision_role === 'Committees Supervisor') {
      csAssignedPeriods.set(s.id, new Set());
      csDailyDutyCounts.set(s.id, new Map());
      csPeriodDutyCounts.set(s.id, 0);
      csAssignedDatesInWeek.set(s.id, new Map());
    }
  }

  // Populate from any existing assignments in currentAssignments (counted once per slotKey)
  for (const a of currentAssignments) {
    if (a.role === 'Committees_Supervisor' || a.role === 'Head_Supervisor') {
      const sess = sessions.find((x) => x.id === a.exam_session_id);
      if (sess && csAssignedPeriods.has(a.staff_id)) {
        const p = getSessionPeriod(sess, sessions);
        const slotKey = `${sess.exam_date}_${p}`;
        if (!csAssignedPeriods.get(a.staff_id)!.has(slotKey)) {
          csAssignedPeriods.get(a.staff_id)!.add(slotKey);

          const dMap = csDailyDutyCounts.get(a.staff_id)!;
          dMap.set(sess.exam_date, (dMap.get(sess.exam_date) || 0) + 1);
          csPeriodDutyCounts.set(a.staff_id, (csPeriodDutyCounts.get(a.staff_id) || 0) + 1);

          const wk = getAcademicWeekKey(sess.exam_date);
          if (!csAssignedDatesInWeek.get(a.staff_id)!.has(wk)) {
            csAssignedDatesInWeek.get(a.staff_id)!.set(wk, new Set());
          }
          csAssignedDatesInWeek.get(a.staff_id)!.get(wk)!.add(sess.exam_date);
        }
      }
    }
  }

  for (const slotKey of sortedSlotKeys) {
    const dpSessions = datePeriodGroups.get(slotKey)!;
    const [examDate] = slotKey.split('_');

    // Group by building
    const buildingGroups = new Map<string, ExamSession[]>();
    for (const session of dpSessions) {
      const room = rooms?.find((r) => r.id === session.room_id);
      const building = room?.building_code || room?.building || 'UNKNOWN';
      if (!buildingGroups.has(building)) buildingGroups.set(building, []);
      buildingGroups.get(building)!.push(session);
    }

    // Dynamically calculate how many rooms each CS should take for this period
    const totalRoomsInPeriod = Array.from(buildingGroups.values()).reduce((sum, bSessions) => sum + groupSessionsByRoom(bSessions).length, 0);
    const availableCSCount = currentStaff.filter(s => s.supervision_role === 'Committees Supervisor' && s.availability_status === 'Available').length;
    
    // Distribute evenly up to the configured max
    const dynamicMax = Math.ceil(totalRoomsInPeriod / Math.max(1, availableCSCount));
    const actualMaxRoomsPerLecturer = Math.min(configuredMaxRooms, dynamicMax);

    for (const [building, bSessions] of buildingGroups.entries()) {
      // Find unique room groups in this building for this slot
      let bRoomGroups = groupSessionsByRoom(bSessions);
      
      // Filter out oral exams before chunking, as Committees Supervisors don't supervise oral exams
      bRoomGroups = bRoomGroups.filter(rg => {
        const sample = bSessions.find(s => s.id === rg.session_ids[0]);
        return sample && !sample.exam_type?.toLowerCase().includes('oral');
      });

      if (bRoomGroups.length === 0) continue;

      // Sort by floor
      bRoomGroups.sort((a, b) => {
         const fa = rooms?.find(r => r.id === a.room_id)?.floor || 0;
         const fb = rooms?.find(r => r.id === b.room_id)?.floor || 0;
         return fa - fb;
      });

      // Break into chunks of rooms respecting: configuredMaxRooms AND configuredMaxFloors
      const chunks: typeof bRoomGroups[] = [];
      let currentChunk: typeof bRoomGroups = [];
      let currentChunkFloors = new Set<number>();

      // Use the strict max configuration to ensure tight grouping where possible
      const chunkMaxRooms = configuredMaxRooms; 

      for (const roomGroup of bRoomGroups) {
        const floor = rooms?.find(r => r.id === roomGroup.room_id)?.floor || 0;
        
        const willExceedRooms = currentChunk.length >= chunkMaxRooms;
        const willExceedFloors = !currentChunkFloors.has(floor) && currentChunkFloors.size >= configuredMaxFloors;

        if (willExceedRooms || willExceedFloors) {
          chunks.push(currentChunk);
          currentChunk = [roomGroup];
          currentChunkFloors = new Set([floor]);
        } else {
          currentChunk.push(roomGroup);
          currentChunkFloors.add(floor);
        }
      }
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }

      for (const chunk of chunks) {
        // Find available Committees Supervisor candidates
        const committeeCandidates = currentStaff.filter(
          (s) => s.supervision_role === 'Committees Supervisor' && s.availability_status === 'Available'
        );

        // Strict concurrency prohibition: A Committees Supervisor can only supervise ONE chunk in this period
        const availableInPeriodCandidates = committeeCandidates.filter((s) => {
          return !csAssignedPeriods.get(s.id)?.has(slotKey);
        });

        // Calculate min score for peer workload spread cap among Committees Supervisors
        const csStaff = currentStaff.filter(s => s.supervision_role === 'Committees Supervisor' && s.availability_status === 'Available' && (s.working_days?.length || 0) > 0);
        const minCSScore = csStaff.length > 0 ? Math.min(...csStaff.map(s => getEffectiveScore(s))) : undefined;

        const getCSCandidates = (relaxWorkload: boolean, relaxDayCap: boolean) => {
          return availableInPeriodCandidates.map(s => {
            let isAvail = true;
            const allSoftViolations: AssignmentConstraintViolation[] = [];
            
            // Verify availability against ALL rooms in this chunk (e.g., to respect floor-level health constraints)
            for (const roomGroup of chunk) {
              const rSession = bSessions.find(sess => sess.id === roomGroup.session_ids[0]);
              if (!rSession) continue;
              
              const status = isStaffAvailable(
                s, rSession, currentAssignments, sessions, config.constraints, allExamDates,
                rooms?.find(r => r.id === roomGroup.room_id), periodFreeStaff, config.calendarRules, minCSScore,
                false, relaxWorkload, relaxDayCap
              );
              
              if (!status.available) {
                isAvail = false;
                break;
              }
              allSoftViolations.push(...status.softViolations);
            }
            
            return { staff: s, available: isAvail, softViolations: allSoftViolations };
          }).filter(cs => cs.available);
        };

        let candidateStatus = getCSCandidates(false, false);
        if (candidateStatus.length === 0) {
          candidateStatus = getCSCandidates(true, false);
        }
        if (candidateStatus.length === 0) {
          candidateStatus = getCSCandidates(true, true);
        }

        if (candidateStatus.length > 0) {
          // Sort candidates for strict equalization in the same week:
          // 1. Equalize Daily duties (0 duties today first, then 1 duty today, never stacking multiple on the same day)
          // 2. Equalize Weekly / Cycle duties (fewest duties in this exam period/week first)
          // 3. Lowest baseline/cumulative score (breaks ties among candidates with equal duties)
          // 4. Soft violations count
          // 5. Deterministic tie-breaker by name
          const sessionWeekKey = getAcademicWeekKey(examDate);
          candidateStatus.sort((a, b) => {
            const staffA = a.staff;
            const staffB = b.staff;

            // 0. Building Continuity Affinity for Committees Supervisors:
            // If candidate had a duty today in adjacent period, keep them in the same building!
            const getCSAffinity = (candidateId: string) => {
              const prevAssigned = currentAssignments.filter(asg => {
                if (asg.staff_id !== candidateId) return false;
                const s = sessions.find(x => x.id === asg.exam_session_id);
                return s && s.exam_date === examDate;
              });
              if (prevAssigned.length === 0) return 2; // Fresh today

              let minGap = Infinity;
              let closestSession: ExamSession | null = null;
              for (const pa of prevAssigned) {
                const s = sessions.find(x => x.id === pa.exam_session_id);
                if (!s) continue;
                const gap = getSessionGapMinutes(s, dpSessions[0]);
                if (gap < minGap) {
                  minGap = gap;
                  closestSession = s;
                }
              }
              if (!closestSession) return 2;

              const cRoom = rooms?.find(r => r.id === closestSession!.room_id);
              const cBld = getRoomBuilding(cRoom, (closestSession as any).room_name);
              if (minGap <= 15) {
                return cBld === building ? 3 : 0; // 3 if same building contiguous, 0 if different building sprint
              }
              return cBld === building ? 2.5 : 2;
            };

            const csAffA = getCSAffinity(staffA.id);
            const csAffB = getCSAffinity(staffB.id);
            if (csAffA !== csAffB) {
              return csAffB - csAffA; // Same building first, different building tight gap penalized!
            }

            // 1. Shift Consolidation / Day-off Preservation:
            // If candidate is ALREADY on campus today (has duties today) and is below max_daily_shifts:
            // Assigning them today costs 0 new working days! Use them first to preserve full days off for peers!
            const configuredMaxDaily = config.constraints?.max_daily_shifts ?? 2;
            const dayDutiesA = csDailyDutyCounts.get(staffA.id)?.get(examDate) ?? 0;
            const dayDutiesB = csDailyDutyCounts.get(staffB.id)?.get(examDate) ?? 0;
            const canPackA = dayDutiesA > 0 && dayDutiesA < configuredMaxDaily ? 1 : 0;
            const canPackB = dayDutiesB > 0 && dayDutiesB < configuredMaxDaily ? 1 : 0;
            if (canPackA !== canPackB) {
              return canPackB - canPackA; // Already on campus today first!
            }

            // 2. Weekly Day Balance: candidate with fewer assigned days in this week comes first
            const daysThisWeekA = csAssignedDatesInWeek.get(staffA.id)?.get(sessionWeekKey)?.size ?? 0;
            const daysThisWeekB = csAssignedDatesInWeek.get(staffB.id)?.get(sessionWeekKey)?.size ?? 0;
            if (daysThisWeekA !== daysThisWeekB) {
              return daysThisWeekA - daysThisWeekB;
            }

            // 3. Effective score tie-breaker: prioritize staff with lower baseline score
            const aScore = getEffectiveScore(staffA);
            const bScore = getEffectiveScore(staffB);
            if (Math.abs(aScore - bScore) > 0.01) {
              return aScore - bScore;
            }

            // 4. Period duties in this cycle
            const periodDutiesA = csPeriodDutyCounts.get(staffA.id) ?? 0;
            const periodDutiesB = csPeriodDutyCounts.get(staffB.id) ?? 0;
            if (periodDutiesA !== periodDutiesB) {
              return periodDutiesA - periodDutiesB;
            }

            // 5. Soft violations as secondary factor
            if (a.softViolations.length !== b.softViolations.length) {
              return a.softViolations.length - b.softViolations.length;
            }

            // 6. Deterministic rotational tie-breaker to avoid alphabetical bias
            const csSeed = (examDate || '').split('-').reduce((acc, part) => acc + Number(part), 0);
            const csHashA = (staffA.id.charCodeAt(0) * 31 + csSeed) % 1000;
            const csHashB = (staffB.id.charCodeAt(0) * 31 + csSeed) % 1000;
            if (csHashA !== csHashB) return csHashA - csHashB;
            return staffA.id.localeCompare(staffB.id);
          });
          
          const chosen = candidateStatus[0].staff;

          // Assign chosen Committees Supervisor to all sessions in all rooms in this chunk
          for (const roomGroup of chunk) {
            for (const sessionId of roomGroup.session_ids) {
              const assignment: Assignment = {
                id: crypto.randomUUID(),
                exam_session_id: sessionId,
                staff_id: chosen.id,
                role: 'Committees_Supervisor',
                assigned_at: new Date().toISOString(),
                assigned_by: null,
                is_manual_override: false,
              };
              allNewAssignments.push(assignment);
              currentAssignments.push(assignment);
            }
          }

          // Update stats to guarantee subsequent chunks and days stay equalized
          if (!csAssignedPeriods.has(chosen.id)) csAssignedPeriods.set(chosen.id, new Set());
          csAssignedPeriods.get(chosen.id)!.add(slotKey);

          if (!csDailyDutyCounts.has(chosen.id)) csDailyDutyCounts.set(chosen.id, new Map());
          const dayMap = csDailyDutyCounts.get(chosen.id)!;
          dayMap.set(examDate, (dayMap.get(examDate) || 0) + 1);

          if (!csAssignedDatesInWeek.has(chosen.id)) csAssignedDatesInWeek.set(chosen.id, new Map());
          const wMap = csAssignedDatesInWeek.get(chosen.id)!;
          if (!wMap.has(sessionWeekKey)) wMap.set(sessionWeekKey, new Set());
          wMap.get(sessionWeekKey)!.add(examDate);

          csPeriodDutyCounts.set(chosen.id, (csPeriodDutyCounts.get(chosen.id) || 0) + 1);
          chosen.current_score += 1; // Score for taking on the supervisor role

          if (candidateStatus[0].softViolations.length) {
            allViolations.push(...candidateStatus[0].softViolations);
          }
        } else {
           // Not enough Committees Supervisors!
           allViolations.push({
             type: 'capacity',
             message: `No available Committees Supervisor for a block of ${chunk.length} rooms in building ${building}`,
             exam_session_id: chunk[0].session_ids[0],
           });
        }
      }
    }
  }
  }

  // Track Committees Supervisors already assigned per room-slot key
  const committeesSupervisorBySlot = new Map<string, string>();

  // Sort room groups chronologically: date ascending, period ascending, total_students descending.
  // This ensures assignments progress naturally day-by-day and period-by-period, concentrating shifts
  // on campus days, respecting calendar weeks, and eliminating artificial day-limit exhaustion.
  const sortedRoomGroups = [...roomGroups].sort((a, b) => {
    if (a.exam_date !== b.exam_date) {
      return a.exam_date.localeCompare(b.exam_date);
    }
    const sampleA = sortedSessions.find(s => s.id === a.session_ids[0]);
    const sampleB = sortedSessions.find(s => s.id === b.session_ids[0]);
    const pA = sampleA ? getSessionPeriod(sampleA, sessions) : 0;
    const pB = sampleB ? getSessionPeriod(sampleB, sessions) : 0;
    if (pA !== pB) {
      return pA - pB;
    }
    return b.total_students - a.total_students;
  });

  // ─── MEDICAL STAFF PRIORITY PRE-PASS ──────────────────────────────────────────
  // Assign staff with medical issues (has_health_issue) in the beginning to fulfill
  // their 5 days rule (respecting any approved off-day/leave), placing them into
  // pharmacy-adjacent rooms (Buildings M and P) to ensure they achieve workload parity
  // with their colleagues within ±1, 2, or 3 delta.
  const medicalStaffMembers = currentStaff.filter(
    (s) => s.has_health_issue && s.availability_status === 'Available'
  );

  if (medicalStaffMembers.length > 0) {
    // 1. Identify peer cohorts and compute target workloads
    const peerCohorts = ['Teaching Assistant', 'Demonstrator', 'Chemist', 'Lecturer'];
    const cohortTargets = new Map<string, number>();

    for (const c of peerCohorts) {
      const peers = currentStaff.filter(
        (s) => (s.job_title || s.supervision_role) === c && s.availability_status === 'Available'
      );
      if (peers.length > 0) {
        let totalSlots = 0;
        for (const rg of roomGroups) {
          const sample = sortedSessions.find(sess => sess.id === rg.session_ids[0]);
          const isOral = !!sample?.exam_type?.toLowerCase().includes('oral');
          const req = calculateRequiredStaff(rg.total_students, config.ratios, isOral, rg.exam_date, config.calendarRules);
          totalSlots += (c === 'Lecturer' || c === 'Exam Supervisor') ? req.headSupervisors : req.assistants;
        }
        const avg = Math.round(totalSlots / peers.length);
        cohortTargets.set(c, Math.max(10, Math.min(16, avg)));
      }
    }

    // 2. Collect all pharmacy room groups
    const pharmacyGroups = roomGroups.filter((rg) => {
      const room = rooms?.find((r) => r.id === rg.room_id);
      const sample = sortedSessions.find((s) => s.id === rg.session_ids[0]);
      return isNearPharmacy(room?.room_name || (sample as any)?.room_name || '');
    });

    const uniqueDatesWithPharmacy = Array.from(new Set(pharmacyGroups.map(g => g.exam_date))).sort();

    for (const mStaff of medicalStaffMembers) {
      const cohortKey = mStaff.job_title || mStaff.supervision_role || 'General';
      const targetScore = cohortTargets.get(cohortKey) || 14;
      const isFT = mStaff.employment_status === 'Full-time';
      const weeklyDayLimit = isFT
        ? (config.constraints?.custom_days_per_week ?? 5)
        : Math.min(3, Math.max(1, config.constraints?.max_days_per_week_pt ?? 3));
      const maxDaily = config.constraints?.max_daily_shifts ?? 2;

      // Track assigned dates per academic week
      const weekDatesMap = new Map<string, Set<string>>();
      for (const a of currentAssignments) {
        if (a.staff_id === mStaff.id) {
          const s = sortedSessions.find(sess => sess.id === a.exam_session_id);
          if (s) {
            const wk = getAcademicWeekKey(s.exam_date);
            if (!weekDatesMap.has(wk)) weekDatesMap.set(wk, new Set());
            weekDatesMap.get(wk)!.add(s.exam_date);
          }
        }
      }

      for (const date of uniqueDatesWithPharmacy) {
        if (mStaff.current_score >= targetScore) break;

        const wk = getAcademicWeekKey(date);
        if (!weekDatesMap.has(wk)) weekDatesMap.set(wk, new Set());
        const weekDates = weekDatesMap.get(wk)!;

        // Respect weekly day cap
        if (!weekDates.has(date) && weekDates.size >= weeklyDayLimit) {
          continue;
        }

        // Respect approved individual leaves (medical, emergency, vacation)
        if (mStaff.specific_off_dates?.includes(date)) continue;

        // Respect profile working days if specified (preserving designated off-day)
        const dateObj = new Date(`${date}T12:00:00Z`);
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
        if (mStaff.working_days && mStaff.working_days.length > 0) {
          if (!mStaff.working_days.includes(dayName)) {
            // Respect designated off-day if they already have 5+ days on
            if (!isFT || mStaff.working_days.length >= 5) {
              continue;
            }
          }
        }

        // Check daily shift count
        let dailyCount = currentAssignments.filter(a => {
          if (a.staff_id !== mStaff.id) return false;
          const s = sortedSessions.find(sess => sess.id === a.exam_session_id);
          return s && s.exam_date === date;
        }).length;

        if (dailyCount >= maxDaily) continue;

        const dayPharmGroups = pharmacyGroups.filter(g => g.exam_date === date);

        for (const rg of dayPharmGroups) {
          if (dailyCount >= maxDaily || mStaff.current_score >= targetScore) break;

          const sample = sortedSessions.find(s => s.id === rg.session_ids[0]);
          if (!sample) continue;

          // Check if staff already assigned at this time/period
          const alreadyAssignedSlot = currentAssignments.some(a => {
            if (a.staff_id !== mStaff.id) return false;
            const s = sortedSessions.find(sess => sess.id === a.exam_session_id);
            return s && s.exam_date === date && (s.start_time === sample.start_time || timesOverlap(s.start_time, s.end_time, sample.start_time, sample.end_time));
          });
          if (alreadyAssignedSlot) continue;

          const isOral = !!sample.exam_type?.toLowerCase().includes('oral');
          const req = calculateRequiredStaff(rg.total_students, config.ratios, isOral, date, config.calendarRules);

          const canBeHead = (mStaff.supervision_role === 'Exam Supervisor' || mStaff.supervision_role === 'Invigilator / Exam Supervisor') && !isOral;
          const canBeAssist = mStaff.supervision_role === 'Invigilator' || mStaff.supervision_role === 'Invigilator / Exam Supervisor';

          const rgAssigns = currentAssignments.filter(a => rg.session_ids.includes(a.exam_session_id));
          const currHeads = rgAssigns.filter(a => a.role === 'Exam_Supervisor').length;
          const currAssists = rgAssigns.filter(a => a.role === 'Assistant').length;

          let roleToAssign: 'Exam_Supervisor' | 'Assistant' | null = null;
          if (canBeHead && currHeads < req.headSupervisors) {
            roleToAssign = 'Exam_Supervisor';
          } else if (canBeAssist && currAssists < req.assistants) {
            roleToAssign = 'Assistant';
          }

          if (!roleToAssign) continue;

          const targetRoom = rooms?.find(r => r.id === rg.room_id) ?? null;
          const { available } = isStaffAvailable(
            mStaff,
            sample,
            currentAssignments,
            sessions,
            config.constraints,
            roomGroups.map(g => g.exam_date),
            targetRoom,
            periodFreeStaff,
            config.calendarRules
          );

          if (available) {
            const multiplied: Assignment[] = [];
            for (const sid of rg.session_ids) {
              multiplied.push({
                id: crypto.randomUUID(),
                exam_session_id: sid,
                staff_id: mStaff.id,
                role: roleToAssign,
                assigned_at: new Date().toISOString(),
                assigned_by: null,
                is_manual_override: false,
              });
            }
            allNewAssignments.push(...multiplied);
            currentAssignments.push(...multiplied);
            mStaff.current_score += 1;
            dailyCount++;
            weekDates.add(date);
          }
        }
      }
    }
  }

  // Assign room supervisors date-by-date (chronologically).
  // On each date, prioritize peak periods first so that high-demand time slots (e.g. 27 rooms)
  // get first pick of supervisors before staff hit daily shift limits in smaller periods.
  // Within each date, Head Supervisors are assigned first across all rooms, followed by Assistants,
  // preserving dual-role staff for Head Supervisor duties.
  const uniqueExamDates = Array.from(new Set(roomGroups.map(g => g.exam_date))).sort();

  // ─── STAGGERED FLOATING OFF-DAY DISTRIBUTION ──────────────────────────────
  // When an exam week has more exam days than the configured weekly day limit
  // (e.g. 6 exam days from Sat to Thu, but custom_days_per_week is 5),
  // distribute the floating off-day evenly across the week for staff without
  // an explicit off-day in their profile. This guarantees:
  // 1. Every staff member works strictly <= 5 days (never exceeding weekly cap).
  // 2. Thursday is never starved of staff, eliminating unstaffed rooms.
  const weekToDatesMap = new Map<string, string[]>();
  for (const d of uniqueExamDates) {
    const wk = getAcademicWeekKey(d);
    if (!weekToDatesMap.has(wk)) weekToDatesMap.set(wk, []);
    weekToDatesMap.get(wk)!.push(d);
  }

  const configuredFT = config.constraints.custom_days_per_week ?? 5;
  const configuredPT = Math.min(3, Math.max(1, config.constraints.max_days_per_week_pt ?? 3));

  let globalStaggerIndex = 0;
  for (const [, wDates] of weekToDatesMap.entries()) {
    wDates.sort();

    for (const st of currentStaff) {
      if (st.availability_status !== 'Available') continue;
      const allowedDays = st.employment_status === 'Part-time' ? configuredPT : configuredFT;

      // Check which exam dates in this week this staff member is currently active on
      const activeDatesInWeek = wDates.filter(d => {
        if (st.specific_off_dates?.includes(d)) return false;
        const dayName = new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
        if (st.working_days && st.working_days.length > 0 && !st.working_days.includes(dayName)) return false;
        return true;
      });

      if (activeDatesInWeek.length > allowedDays) {
        const excess = activeDatesInWeek.length - allowedDays;
        const offDatesToAssign: string[] = [];
        for (let e = 0; e < excess; e++) {
          const pickDate = activeDatesInWeek[(globalStaggerIndex + e) % activeDatesInWeek.length];
          offDatesToAssign.push(pickDate);
        }
        globalStaggerIndex++;

        st.specific_standard_off_dates = [
          ...(st.specific_standard_off_dates || []),
          ...offDatesToAssign
        ];
      }
    }
  }

  for (const date of uniqueExamDates) {
    const dayGroups = roomGroups.filter(rg => rg.exam_date === date);

    // Sort day groups strictly chronologically by period, with Pharmacy rooms (M & P) FIRST,
    // and within each period by building and room.
    const sortedDayGroups = [...dayGroups].sort((a, b) => {
      const sampleA = sortedSessions.find(s => s.id === a.session_ids[0]);
      const sampleB = sortedSessions.find(s => s.id === b.session_ids[0]);
      const pA = sampleA ? getSessionPeriod(sampleA, sessions) : 0;
      const pB = sampleB ? getSessionPeriod(sampleB, sessions) : 0;
      if (pA !== pB) return pA - pB; // Chronological period order (Period 1, then Period 2, etc.)

      // Pharmacy rooms (Buildings M & P) FIRST
      const roomA = rooms?.find(r => r.id === a.room_id);
      const roomB = rooms?.find(r => r.id === b.room_id);
      const isPharmA = isNearPharmacy(roomA?.room_name || (sampleA as any)?.room_name || '');
      const isPharmB = isNearPharmacy(roomB?.room_name || (sampleB as any)?.room_name || '');
      if (isPharmA !== isPharmB) {
        return isPharmA ? -1 : 1;
      }

      const bldA = getRoomBuilding(roomA, roomA?.room_name);
      const bldB = getRoomBuilding(roomB, roomB?.room_name);
      if (bldA !== bldB) return bldA.localeCompare(bldB);

      // Within same building: largest room first
      return b.total_students - a.total_students;
    });

    // Sub-Phase 1: Assign Head Supervisors for this date
    for (const group of sortedDayGroups) {
      const sampleSession = sortedSessions.find(s => s.id === group.session_ids[0]);
      if (!sampleSession) continue;

      const period = getSessionPeriod(sampleSession, sessions);
      const slotKey = `${group.room_id}__${group.exam_date}__${period}`;

      const adjustedSession: ExamSession = { ...sampleSession, student_count: group.total_students };
      const targetRoom = rooms?.find((r) => r.id === group.room_id) ?? null;

      const result = assignStaffToSession(
        adjustedSession,
        currentStaff,
        currentAssignments,
        sessions,
        config,
        targetRoom,
        undefined,
        periodFreeStaff,
        'Head_Supervisor',
        rooms
      );

      if (result.assignments.length > 0) {
        const multipliedAssignments: Assignment[] = [];
        for (const sid of group.session_ids) {
          for (const a of result.assignments) {
            multipliedAssignments.push({ ...a, id: crypto.randomUUID(), exam_session_id: sid });
          }
        }
        allNewAssignments.push(...multipliedAssignments);
        currentAssignments.push(...multipliedAssignments);
        result.assignments.forEach((a) => {
          const s = currentStaff.find((x) => x.id === a.staff_id);
          if (s) s.current_score += 1;
        });
      }
      if (result.violations.length > 0) allViolations.push(...result.violations);
    }

    // Sub-Phase 2: Assign Assistants for this date
    for (const group of sortedDayGroups) {
      const sampleSession = sortedSessions.find(s => s.id === group.session_ids[0]);
      if (!sampleSession) continue;

      const period = getSessionPeriod(sampleSession, sessions);
      const slotKey = `${group.room_id}__${group.exam_date}__${period}`;

      const adjustedSession: ExamSession = { ...sampleSession, student_count: group.total_students };
      const targetRoom = rooms?.find((r) => r.id === group.room_id) ?? null;

      const result = assignStaffToSession(
        adjustedSession,
        currentStaff,
        currentAssignments,
        sessions,
        config,
        targetRoom,
        undefined,
        periodFreeStaff,
        'Assistant',
        rooms
      );

      if (result.assignments.length > 0) {
        const multipliedAssignments: Assignment[] = [];
        for (const sid of group.session_ids) {
          for (const a of result.assignments) {
            multipliedAssignments.push({ ...a, id: crypto.randomUUID(), exam_session_id: sid });
          }
        }
        allNewAssignments.push(...multipliedAssignments);
        currentAssignments.push(...multipliedAssignments);
        result.assignments.forEach((a) => {
          const s = currentStaff.find((x) => x.id === a.staff_id);
          if (s) s.current_score += 1;
        });
      }
      if (result.violations.length > 0) allViolations.push(...result.violations);
    }
  }

  // --- POST-PASS: WORKLOAD EQUALIZATION REBALANCER ---
  // Strictly enforces max_score_delta_from_average (default: spread <= 3) across each peer cohort
  equalizeWorkloadPass(allNewAssignments, currentStaff, effectiveSessions, config, rooms);

  return { assignments: allNewAssignments, violations: allViolations };
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKLOAD EQUALIZATION REBALANCER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rebalances room assignments within each peer cohort (Chemists, TAs, Demonstrators, Lecturers)
 * to strictly enforce that max(peer_score) - min(peer_score) <= maxSpread (default 3),
 * without sacrificing 100% full staffing, room suitability, or constraint integrity.
 */
export function equalizeWorkloadPass(
  assignments: Assignment[],
  staffList: Staff[],
  sessions: ExamSession[],
  config: AutoAssignConfig,
  rooms?: Room[]
) {
  const maxSpread = config.constraints?.max_score_delta_from_average ?? 3;
  const sessionMap = new Map<string, ExamSession>(sessions.map(s => [s.id, s]));
  const activeStaff = staffList.filter(s => s.availability_status === 'Available' && (s.working_days?.length || 0) > 0);
  const cohorts = ['Chemist', 'Teaching Assistant', 'Demonstrator', 'Lecturer'];

  for (const cohort of cohorts) {
    const cohortStaff = activeStaff.filter(s => (s.job_title || s.supervision_role) === cohort);
    if (cohortStaff.length <= 1) continue;

    const calcPeriods = () => {
      const map = new Map<string, { staff: Staff; periods: Set<string>; assigns: Assignment[] }>();
      for (const s of cohortStaff) {
        map.set(s.id, { staff: s, periods: new Set(), assigns: [] });
      }
      for (const a of assignments) {
        const entry = map.get(a.staff_id);
        if (!entry) continue;
        const sess = sessionMap.get(a.exam_session_id);
        if (sess) {
          entry.periods.add(`${sess.exam_date}_${sess.start_time}`);
          entry.assigns.push(a);
        }
      }
      return map;
    };

    let periodMap = calcPeriods();
    let members = Array.from(periodMap.values()).sort((a, b) => b.periods.size - a.periods.size);
    let minSize = members[members.length - 1].periods.size;
    let maxSize = members[0].periods.size;

    let swaps = 0;
    while (maxSize - minSize > maxSpread && swaps < 300) {
      const highest = members[0];
      let swapped = false;

      // Try swapping duties to lowest scoring members in this cohort
      for (let lIdx = members.length - 1; lIdx >= 0; lIdx--) {
        const lowest = members[lIdx];
        if (highest.periods.size - lowest.periods.size <= maxSpread) break;

        // If lowest has a health issue, look across ANY peer with surplus shifts (not just highest)
        // who currently holds an assignment in a pharmacy room (M or P building)
        const donorPool = lowest.staff.has_health_issue
          ? members.filter((m) => m.periods.size > lowest.periods.size + 1)
          : [highest];

        for (const donor of donorPool) {
          // Find an assignment in donor that lowest can safely take
          for (const a of donor.assigns) {
            const sess = sessionMap.get(a.exam_session_id);
            if (!sess) continue;

            // 1. Slot check: lowest must not already be assigned in this period/slot
            const slotKey = `${sess.exam_date}_${sess.start_time}`;
            if (lowest.periods.has(slotKey)) continue;

            // Also check all other assignments in general for lowest at this time
            const hasClash = assignments.some(x => {
              if (x.staff_id !== lowest.staff.id) return false;
              const xs = sessionMap.get(x.exam_session_id);
              return xs && xs.exam_date === sess.exam_date && (
                xs.start_time === sess.start_time ||
                timesOverlap(xs.start_time, xs.end_time, sess.start_time, sess.end_time)
              );
            });
            if (hasClash) continue;

            // 2. Off-date check: lowest must not have an approved specific off-date on this date
            if (lowest.staff.specific_off_dates?.includes(sess.exam_date)) continue;

            // 2b. Mandatory staff designated off-day check (from staff.working_days)
            const sessDayName = new Date(`${sess.exam_date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
            if (lowest.staff.working_days && lowest.staff.working_days.length > 0) {
              if (!lowest.staff.working_days.includes(sessDayName)) {
                // If they are FT and have 5+ days, respect the off-day
                if (lowest.staff.employment_status !== 'Full-time' || lowest.staff.working_days.length >= 5) {
                  continue; // Recipient is designated off on this weekday!
                }
              }
            }

            // 2c. Building continuity check for tight back-to-back shifts:
            // Prevent workload equalization from creating a cross-campus sprint with <= 15m gap!
            const targetRoom = rooms?.find(r => r.id === sess.room_id);
            const targetBuilding = getRoomBuilding(targetRoom, (sess as any).room_name);

            const lowestHasTightCrossBuildingSprint = assignments.some(x => {
              if (x.staff_id !== lowest.staff.id) return false;
              const xs = sessionMap.get(x.exam_session_id);
              if (!xs || xs.exam_date !== sess.exam_date) return false;
              const gap = getSessionGapMinutes(xs, sess);
              if (gap <= 15) {
                const xRoom = rooms?.find(r => r.id === xs.room_id);
                const xBuilding = getRoomBuilding(xRoom, (xs as any).room_name);
                return targetBuilding !== 'UNKNOWN' && xBuilding !== 'UNKNOWN' && targetBuilding !== xBuilding;
              }
              return false;
            });
            if (lowestHasTightCrossBuildingSprint) continue;

            // 2d. Health issue room check: Staff with health issues cannot receive a non-pharmacy room
            if (lowest.staff.has_health_issue) {
              const targetRoomName = targetRoom?.room_name || (sess as any).room?.room_name || (sess as any).room_name || '';
              if (targetRoomName && !isNearPharmacy(targetRoomName)) {
                continue; // Do not transfer a non-pharmacy room to staff with health issues
              }
            }

            // 3. Role eligibility check
            if (a.role === 'Exam_Supervisor') {
              const role = lowest.staff.supervision_role;
              if (role !== 'Exam Supervisor' && role !== 'Invigilator / Exam Supervisor') {
                continue;
              }
            } else if (a.role === 'Committees_Supervisor') {
              if (lowest.staff.supervision_role !== 'Committees Supervisor') {
                continue;
              }
            }

            // 4. Daily shifts check: respect max daily shifts
            const configuredMaxDaily = config.constraints?.max_daily_shifts ?? 2;
            let lowestDailyCount = 0;
            for (const p of lowest.periods) {
              if (p.startsWith(sess.exam_date)) lowestDailyCount++;
            }
            if (lowestDailyCount >= configuredMaxDaily + 1) continue;

            // 4b. Weekly days check: lowest must not exceed weekly day cap configured in Settings
            const sessionWeekKey = getAcademicWeekKey(sess.exam_date);
            const configuredPT = Math.min(3, Math.max(1, config.constraints?.max_days_per_week_pt ?? 3));
            const configuredFT = config.constraints?.custom_days_per_week ?? 5;
            const baseLimit = lowest.staff.employment_status === 'Part-time' ? configuredPT : configuredFT;
            const maxAllowedWeeklyDays = Math.min(baseLimit, (lowest.staff.employment_status === 'Full-time' ? 5 : (lowest.staff.working_days?.length || baseLimit)));

            const lowestDatesThisWeek = new Set<string>();
            for (const p of lowest.periods) {
              const pDate = p.split('_')[0];
              if (getAcademicWeekKey(pDate) === sessionWeekKey) {
                lowestDatesThisWeek.add(pDate);
              }
            }
            if (!lowestDatesThisWeek.has(sess.exam_date) && lowestDatesThisWeek.size >= maxAllowedWeeklyDays) {
              continue; // Cannot swap to recipient because it would add a day exceeding their weekly cap!
            }

            // Perform swap: If this room session is shared, swap all assignments for this room-slot together
            const sameSlotAssigns = donor.assigns.filter(x => {
              const xs = sessionMap.get(x.exam_session_id);
              return xs && xs.exam_date === sess.exam_date && xs.start_time === sess.start_time && xs.room_id === sess.room_id;
            });

            for (const sa of sameSlotAssigns) {
              sa.staff_id = lowest.staff.id;
            }

            swapped = true;
            swaps++;
            break;
          }
          if (swapped) break;
        }

        if (swapped) break;
      }

      if (!swapped) {
        break; // No further valid swaps could be made
      }

      periodMap = calcPeriods();
      members = Array.from(periodMap.values()).sort((a, b) => b.periods.size - a.periods.size);
      minSize = members[members.length - 1].periods.size;
      maxSize = members[0].periods.size;
    }
  }

  // Resynchronize staff.current_score with final assignments
  const finalScoreMap = new Map<string, Set<string>>();
  for (const a of assignments) {
    const sess = sessionMap.get(a.exam_session_id);
    if (sess) {
      if (!finalScoreMap.has(a.staff_id)) finalScoreMap.set(a.staff_id, new Set());
      finalScoreMap.get(a.staff_id)!.add(`${sess.exam_date}_${sess.start_time}`);
    }
  }
  for (const s of staffList) {
    s.current_score = finalScoreMap.get(s.id)?.size || 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORE UPDATES
// ─────────────────────────────────────────────────────────────────────────────

export function updateStaffScores(staff: Staff[], assignments: Assignment[]): Staff[] {
  const updated = [...staff];
  assignments.forEach((a) => {
    const s = updated.find((x) => x.id === a.staff_id);
    if (s) s.current_score += 1;
  });
  return updated;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESERVE STAFF ALLOCATION (Period Free Staff)
// ─────────────────────────────────────────────────────────────────────────────

export interface ReserveAssignment {
  id: string;
  exam_date: string;
  period: number;
  start_time: string;
  staff_id: string;
  role: 'Exam_Supervisor' | 'Assistant';
}

export function allocateReserveStaff(
  sessions: ExamSession[],
  allStaff: Staff[],
  currentAssignments: Assignment[],
  config: AutoAssignConfig
): ReserveAssignment[] {
  const reserveAssignments: ReserveAssignment[] = [];
  
  // Group sessions by date and exact unique day period
  const datePeriodGroups = new Map<string, { exam_date: string; period: number; start_time: string; session_ids: string[]; has_final: boolean }>();
  for (const session of sessions) {
    const period = getSessionPeriod(session, sessions);
    const key = `${session.exam_date}_${period}`;
    if (!datePeriodGroups.has(key)) {
      datePeriodGroups.set(key, {
        exam_date: session.exam_date,
        period,
        start_time: session.start_time,
        session_ids: [],
        has_final: false
      });
    }
    const group = datePeriodGroups.get(key)!;
    group.session_ids.push(session.id);
    
    // Check if this is a final (written) exam
    if (!session.exam_type?.toLowerCase().includes('oral')) {
      group.has_final = true;
    }
  }

  // Process each date-period group
  for (const group of datePeriodGroups.values()) {
    // If a period has ONLY oral exams, skip reserve allocation entirely
    if (!group.has_final) {
      continue;
    }

    // DEFICIENCY-FIRST INVARIANT:
    // If any session in this date-period slot is deficient (fewer Head Supervisors or Assistants than required),
    // NEVER allocate staff to standby reserves for this slot! Room duties always take absolute priority.
    let slotHasDeficiency = false;
    for (const sid of group.session_ids) {
      const sess = sessions.find(s => s.id === sid);
      if (!sess) continue;
      const isOral = !!sess.exam_type?.toLowerCase().includes('oral');
      const req = calculateRequiredStaff(sess.student_count, config.ratios, isOral, sess.exam_date, config.calendarRules);
      const assigned = currentAssignments.filter(a => a.exam_session_id === sid);
      const headsCount = assigned.filter(a => a.role === 'Exam_Supervisor').length;
      const asstsCount = assigned.filter(a => a.role === 'Assistant').length;
      if (headsCount < req.headSupervisors || asstsCount < req.assistants) {
        slotHasDeficiency = true;
        break;
      }
    }
    if (slotHasDeficiency) {
      continue;
    }

    // 1. Find staff already assigned to standard duties in this period
    const assignedStaffIds = new Set(
      currentAssignments
        .filter(a => {
          if (group.session_ids.includes(a.exam_session_id)) return true;
          const s = sessions.find(x => x.id === a.exam_session_id);
          if (!s || s.exam_date !== group.exam_date) return false;
          return getSessionPeriod(s, sessions) === group.period || timesOverlap(s.start_time, s.end_time, group.start_time, undefined);
        })
        .map(a => a.staff_id)
    );

    // Also exclude staff already allocated as reserves in this exact period or overlapping slot
    for (const r of reserveAssignments) {
      if (r.exam_date === group.exam_date && (r.period === group.period || r.start_time === group.start_time)) {
        assignedStaffIds.add(r.staff_id);
      }
    }

    if (group.period === 1 && group.exam_date.includes('07')) {
      console.log(`[DEBUG] Period 1 on ${group.exam_date}: found ${assignedStaffIds.size} assigned staff out of ${currentAssignments.length} total assignments.`);
    }

    const sampleSession = sessions.find(s => group.session_ids.includes(s.id));

    // Create a representative exam session to check availability for this slot
    const representativeSession: ExamSession = {
      id: crypto.randomUUID(),
      subject_name: 'Reserve Slot Check',
      exam_date: group.exam_date,
      start_time: group.start_time,
      end_time: sampleSession?.end_time || null,
      student_count: 0,
      room_id: crypto.randomUUID(),
      exam_type: 'Reserve',
      program: null,
      student_start: null,
      student_end: null,
      is_locked: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const peerMinScores = getPeerMinScores(allStaff);

    // 2. Filter available staff who are not already assigned (respecting peer workload spread cap)
    let availableStaff = allStaff.filter(staff => {
      // Must not be already assigned in this period
      if (assignedStaffIds.has(staff.id)) return false;

      const peerMinScore = peerMinScores.get(staff.job_title || staff.supervision_role || 'General');

      // Must be available according to standard rules
      const { available } = isStaffAvailable(
        staff,
        representativeSession,
        currentAssignments,
        sessions,
        config.constraints,
        Array.from(new Set(sessions.map(s => s.exam_date))),
        undefined,
        reserveAssignments as any,
        config.calendarRules,
        peerMinScore,
        !config.constraints.ignore_staff_working_days // Do not force strict off-days if ignoring working days (e.g. Midterm)
      );
      return available;
    });

    // If reserve pool is smaller than target, relax workload cap so reserve slots can still be staffed
    const neededReserves = (config.constraints?.reserve_supervisors_target ?? 3) + (config.constraints?.reserve_assistants_target ?? 3);
    if (availableStaff.length < neededReserves) {
      availableStaff = allStaff.filter(staff => {
        if (assignedStaffIds.has(staff.id)) return false;
        const peerMinScore = peerMinScores.get(staff.job_title || staff.supervision_role || 'General');
        const { available } = isStaffAvailable(
          staff,
          representativeSession,
          currentAssignments,
          sessions,
          config.constraints,
          Array.from(new Set(sessions.map(s => s.exam_date))),
          undefined,
          reserveAssignments as any,
          config.calendarRules,
          peerMinScore,
          !config.constraints.ignore_staff_working_days,
          true // allowWorkloadCapRelax
        );
        return available;
      });
    }

    if (availableStaff.length === 0) continue;

    // Separate into supervisor pool and assistant pool
    const supervisorPool = availableStaff.filter(
      s => s.supervision_role === 'Exam Supervisor' || s.supervision_role === 'Invigilator / Exam Supervisor'
    );
    const assistantPool = availableStaff.filter(
      s => s.supervision_role === 'Invigilator' || s.supervision_role === 'Invigilator / Exam Supervisor'
    );

    // Track weekly reserve count per staff to enforce reserve duty cap (default: max 2 reserves per week)
    const sessionWeekKey = getAcademicWeekKey(group.exam_date);
    const maxWeeklyReserves = config.constraints?.max_weekly_reserves ?? 2;

    const getWeekReserveCount = (staffId: string): number => {
      let count = 0;
      for (const r of reserveAssignments) {
        if (r.staff_id === staffId && getAcademicWeekKey(r.exam_date) === sessionWeekKey) {
          count++;
        }
      }
      return count;
    };

    // Sort both pools using our custom sort (lowest score first)
    // Prioritize pure 'Exam Supervisor' for supervisor reserves, and pure 'Invigilator' for assistant reserves
    const sortedSupervisors = sortStaffByPriority(supervisorPool, undefined, false, 'Exam Supervisor');
    const sortedAssistants = sortStaffByPriority(assistantPool, undefined, false, 'Invigilator');

    // Equitably distribute reserves:
    // 1. Staff with lower effective workload score first (strictly preventing over-allocated staff from getting reserves)
    // 2. Staff with fewer reserves this week come first
    // 3. Name tie-breaker
    const compareReserves = (a: Staff, b: Staff) => {
      const aScore = getEffectiveScore(a);
      const bScore = getEffectiveScore(b);
      if (Math.abs(aScore - bScore) > 0.01) return aScore - bScore;

      const aW = getWeekReserveCount(a.id);
      const bW = getWeekReserveCount(b.id);
      if (aW !== bW) return aW - bW;

      return a.name.localeCompare(b.name);
    };

    sortedSupervisors.sort(compareReserves);
    sortedAssistants.sort(compareReserves);

    // Health-issue staff are no longer deprioritized for reserves
    // so they can maintain a fair overall workload score.

    // If it is Period 2, try to avoid selecting Chemists by pushing them to the end of the queue
    // ONLY during Final/Oral exam periods (where Chemists are reserved for Period 2 oral exams).
    // In Midterms or when no oral exams exist in this schedule, Chemists can be assigned across all periods equally.
    const isMidtermSchedule = config.isMidterm || (!sessions.some(s => s.exam_type?.toLowerCase().includes('oral')) && !currentAssignments.some(a => (a as any).exam_session?.exam_type?.toLowerCase().includes('oral')));
    const shouldDeprioritizeChemist = (config.constraints?.reserve_deprioritize_chemists_p2 !== false) && !isMidtermSchedule;
    if (group.period === 2 && shouldDeprioritizeChemist) {
      const deprioritizeChemist = (a: Staff, b: Staff) => {
        if (a.job_title === 'Chemist' && b.job_title !== 'Chemist') return 1;
        if (b.job_title === 'Chemist' && a.job_title !== 'Chemist') return -1;
        return 0;
      };
      sortedSupervisors.sort(deprioritizeChemist);
      sortedAssistants.sort(deprioritizeChemist);
    }

    const selected: { staff: Staff; role: 'Exam_Supervisor' | 'Assistant' }[] = [];
    const selectedIds = new Set<string>();

    const maxSpread = config.constraints?.max_score_delta_from_average ?? 3;

    // Target configured count for Exam Supervisors (default 3, range 0-10)
    const configuredTargetSupervisors = config.constraints?.reserve_supervisors_target ?? 3;
    const targetSupervisorCount = Math.min(configuredTargetSupervisors, sortedSupervisors.length);
    let addedSupervisors = 0;
    for (const supervisor of sortedSupervisors) {
      if (addedSupervisors >= targetSupervisorCount) break;
      if (!selectedIds.has(supervisor.id)) {
        // Enforce peer spread cap: avoid giving reserve to staff who already exceeded or reached the peer cap
        const pGroup = supervisor.job_title || supervisor.supervision_role || 'General';
        const cohortStaff = allStaff.filter(s => (s.job_title || s.supervision_role || 'General') === pGroup && s.availability_status === 'Available' && (s.working_days?.length || 0) > 0);
        const pMin = cohortStaff.length > 0 ? Math.min(...cohortStaff.map(s => getEffectiveScore(s))) : 0;
        if (getEffectiveScore(supervisor) + 0.25 > pMin + maxSpread) {
          const hasLowerAlternative = sortedSupervisors.some(s => !selectedIds.has(s.id) && getEffectiveScore(s) + 0.25 <= pMin + maxSpread);
          if (hasLowerAlternative) continue;
        }

        // Enforce reserve cap: avoid giving 3rd reserve if other colleagues have < maxWeeklyReserves
        if (
          getWeekReserveCount(supervisor.id) >= maxWeeklyReserves &&
          sortedSupervisors.some(s => !selectedIds.has(s.id) && getWeekReserveCount(s.id) < maxWeeklyReserves)
        ) {
          continue;
        }
        selected.push({ staff: supervisor, role: 'Exam_Supervisor' });
        selectedIds.add(supervisor.id);
        addedSupervisors++;
      }
    }

    // Target configured count for Invigilators (Assistants) (default 3, range 0-10)
    const configuredTargetAssistants = config.constraints?.reserve_assistants_target ?? 3;
    const targetAssistantCount = Math.min(configuredTargetAssistants, sortedAssistants.length);
    let addedAssistants = 0;
    for (const assistant of sortedAssistants) {
      if (addedAssistants >= targetAssistantCount) break;
      if (!selectedIds.has(assistant.id)) {
        // Enforce peer spread cap: avoid giving reserve to staff who already exceeded or reached the peer cap
        const pGroup = assistant.job_title || assistant.supervision_role || 'General';
        const cohortStaff = allStaff.filter(s => (s.job_title || s.supervision_role || 'General') === pGroup && s.availability_status === 'Available' && (s.working_days?.length || 0) > 0);
        const pMin = cohortStaff.length > 0 ? Math.min(...cohortStaff.map(s => getEffectiveScore(s))) : 0;
        if (getEffectiveScore(assistant) + 0.25 > pMin + maxSpread) {
          const hasLowerAlternative = sortedAssistants.some(s => !selectedIds.has(s.id) && getEffectiveScore(s) + 0.25 <= pMin + maxSpread);
          if (hasLowerAlternative) continue;
        }

        // Enforce reserve cap: avoid giving 3rd reserve if other colleagues have < maxWeeklyReserves
        if (
          getWeekReserveCount(assistant.id) >= maxWeeklyReserves &&
          sortedAssistants.some(s => !selectedIds.has(s.id) && getWeekReserveCount(s.id) < maxWeeklyReserves)
        ) {
          continue;
        }
        selected.push({ staff: assistant, role: 'Assistant' });
        selectedIds.add(assistant.id);
        addedAssistants++;
      }
    }

    // Save reserve assignments
    for (const item of selected) {
      reserveAssignments.push({
        id: crypto.randomUUID(),
        exam_date: group.exam_date,
        period: group.period,
        start_time: group.start_time,
        staff_id: item.staff.id,
        role: item.role
      });
      assignedStaffIds.add(item.staff.id);
      // Increment free_staff_score locally so subsequent periods in the same auto-assign batch see the updated score!
      const s = allStaff.find(x => x.id === item.staff.id);
      if (s) {
        s.free_staff_score = (s.free_staff_score || 0) + 1;
      }
    }
  }

  return reserveAssignments;
}
