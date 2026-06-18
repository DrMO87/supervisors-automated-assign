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
} from '@/types/database.types';
import { parseRoomCode, getPeriodFromTime, getDurationInMinutes, timesOverlap } from '@/types/database.types';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Using centralized helper from types/database.types.ts

export interface AutoAssignConfig {
  ratios: StaffingRatiosConfig;
  constraints: SchedulingConstraintsConfig;
  calendarRules?: CalendarRule[];
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
  averageScore?: number,
  strictOffDays: boolean = false
): {
  available: boolean;
  hardViolations: AssignmentConstraintViolation[];
  softViolations: AssignmentConstraintViolation[];
} {
  const hardViolations: AssignmentConstraintViolation[] = [];
  const softViolations: AssignmentConstraintViolation[] = [];

  // 1. Availability Status (Hard)
  if (staff.availability_status !== 'Available') {
    hardViolations.push({
      type: 'unavailable',
      message: `${staff.name} is ${staff.availability_status}`,
      staff_id: staff.id,
      exam_session_id: examSession.id,
    });
  }

  // 2. Off-day check (Hard)
  //
  // Smart classification: if a weekday appears in specific_off_dates for EVERY
  // occurrence of that weekday across the entire exam period, treat it as a
  // permanent non-working day (same as working_days pattern).
  // Otherwise, only the explicitly listed dates are blocked.
  const examDateISO = examSession.exam_date; // already stored as YYYY-MM-DD
  const hasSpecificOffDates = staff.specific_off_dates && staff.specific_off_dates.length > 0;

  const { recurringOffDays, specificOffDates: classifiedSpecificOff } = hasSpecificOffDates
    ? classifyOffDays(staff.specific_off_dates, allExamDates)
    : { recurringOffDays: [], specificOffDates: [] };
  const isUniversalWorkingDayRaw = calendarRules.some(r => r.is_universal_working_day && r.start_date <= examDateISO && r.end_date >= examDateISO);
  const isUniversalWorkingDay = !strictOffDays && isUniversalWorkingDayRaw && staff.supervision_role !== 'Committees Supervisor';

  // 2a. Strict Specific Off-Dates (Red X)
  if (staff.specific_off_dates?.includes(examDateISO)) {
    // If it's a specific requested leave day, we respect it EVEN IF it's a universal working day.
    hardViolations.push({
      type: 'unavailable',
      message: `${staff.name} has a specific day-off on ${examDateISO}`,
      staff_id: staff.id,
      exam_session_id: examSession.id,
    });
  } else if (!isUniversalWorkingDay) {
    // 2b. Standard specific off-dates (can be overridden by universal working days)
    if (staff.specific_standard_off_dates?.includes(examDateISO)) {
      hardViolations.push({
        type: 'unavailable',
        message: `${staff.name} has a standard specific day-off on ${examDateISO}`,
        staff_id: staff.id,
        exam_session_id: examSession.id,
      });
    } else {
      // 2c. Weekday pattern check: (Only if NOT a universal working day)
      //   - Start with the staff's manually configured working_days
      //   - Add any weekdays classified as recurring off-days from specific_off_dates
      //   - If ignore_working_days_if_specific_dates is ON and staff has specific off-dates,
      //     skip the manual working_days check (only recurringOffDays from classification apply)
      const date = new Date(`${examSession.exam_date}T12:00:00Z`);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });

      // Check recurring off-days derived from specific_off_dates analysis
      if (recurringOffDays.includes(dayName)) {
        hardViolations.push({
          type: 'unavailable',
          message: `${staff.name} does not work on ${dayName}s (recurring off throughout exam period)`,
          staff_id: staff.id,
          exam_session_id: examSession.id,
        });
      } else {
        // Check the manual working_days pattern — but only if:
        // - Staff has NO specific off-dates, OR
        // - The "ignore working days if specific dates" setting is disabled
        const ignoreWorkingDays =
          constraints.ignore_working_days_if_specific_dates !== false && hasSpecificOffDates;

        if (!ignoreWorkingDays && staff.working_days && !staff.working_days.includes(dayName)) {
          hardViolations.push({
            type: 'unavailable',
            message: `${staff.name} does not work on ${dayName}s`,
            staff_id: staff.id,
            exam_session_id: examSession.id,
          });
        }
      }
    }
  }

  // 2d. Check if staff is already assigned as a Reserve for this period (Hard)
  const isReserve = periodFreeStaff.some(
    r => r.staff_id === staff.id && r.exam_date === examSession.exam_date && r.period === getPeriodFromTime(examSession.start_time)
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
    const s = allExamSessions.find((x) => x.id === a.exam_session_id);
    return s && a.staff_id === staff.id && s.exam_date === examSession.exam_date && timesOverlap(s.start_time, s.end_time, examSession.start_time, examSession.end_time);
  });
  
  if (conflicting.length > 0) {
    const inDifferentRoom = conflicting.some(a => {
      const s = allExamSessions.find((x) => x.id === a.exam_session_id);
      return s && s.room_id !== examSession.room_id;
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

  // 4. Consecutive Shifts (Soft)
  const sameDayOther = existingAssignments.filter((a) => {
    const s = allExamSessions.find((x) => x.id === a.exam_session_id);
    return s && a.staff_id === staff.id && s.exam_date === examSession.exam_date && !timesOverlap(s.start_time, s.end_time, examSession.start_time, examSession.end_time);
  });
  if (sameDayOther.length > 0) {
    const isConsecutive = sameDayOther.some((a) => {
      const s = allExamSessions.find((x) => x.id === a.exam_session_id);
      // We consider consecutive if they don't overlap, but are within the same day,
      // and their periods are adjacent.
      return s && Math.abs(getPeriodFromTime(s.start_time) - getPeriodFromTime(examSession.start_time)) === 1;
    });
    if (isConsecutive && !constraints.allow_consecutive_shifts) {
      softViolations.push({
        type: 'consecutive_shifts',
        message: `${staff.name} has a consecutive shift on ${examSession.exam_date}`,
        staff_id: staff.id,
        exam_session_id: examSession.id,
      });
    }
  }

  // 4b. Max Working Days per week (Hard constraint)
  // W = total distinct exam days in the scheduling period
  const totalExamDays = allExamDates.length;
  
  let maxAllowedDays = 1;
  if (staff.job_title === 'Chemist') {
    maxAllowedDays = Math.max(1, totalExamDays - 1);
  } else if (staff.employment_status === 'Full-time') {
    maxAllowedDays = Math.max(1, totalExamDays - 2);
  } else {
    // Part-time
    maxAllowedDays = totalExamDays >= 6 ? 2 : 1;
  }

  // Count distinct dates staff is already assigned to
  const assignedDates = new Set<string>();
  existingAssignments.forEach(a => {
    if (a.staff_id === staff.id) {
      const s = allExamSessions.find(x => x.id === a.exam_session_id);
      if (s) assignedDates.add(s.exam_date);
    }
  });

  // If this examSession is on a NEW date, check if they are already at their limit
  if (!assignedDates.has(examSession.exam_date)) {
    if (assignedDates.size >= maxAllowedDays) {
      hardViolations.push({
        type: 'unavailable',
        message: `${staff.name} has reached their maximum allowed working days (${maxAllowedDays} days for ${totalExamDays}-day week)`,
        staff_id: staff.id,
        exam_session_id: examSession.id,
      });
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
    const s = allExamSessions.find((x) => x.id === a.exam_session_id);
    if (!s) return;
    const key = `${s.exam_date}_${getPeriodFromTime(s.start_time)}`;
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
        .map((a) => allExamSessions.find((x) => x.id === a.exam_session_id)?.exam_date)
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

  // 7. Health issue -> prefer M/P rooms (Soft warning removed to prevent score decrease)
  // Health issue staff will simply be prioritized in sorting when the room is near pharmacy.

  // 8. Hard Workload Cap
  if (constraints.max_score_delta_from_average !== undefined && averageScore !== undefined) {
    if (staff.current_score > averageScore + constraints.max_score_delta_from_average) {
      hardViolations.push({
        type: 'workload_cap',
        message: `${staff.name} has reached the hard workload cap (${staff.current_score} assignments vs average ${averageScore.toFixed(1)}). Locked out until others catch up.`,
        staff_id: staff.id,
        exam_session_id: examSession.id,
      });
    }
  }

  return { available: hardViolations.length === 0, hardViolations, softViolations };
}

// ─────────────────────────────────────────────────────────────────────────────
// SORTING
// ─────────────────────────────────────────────────────────────────────────────

export function getEffectiveScore(staff: Staff): number {
  // A reserve duty is treated as 25% of a full room assignment
  const baseScore = staff.current_score + ((staff.free_staff_score || 0) * 0.25);
  if (staff.is_overloaded && staff.overload_percentage > 0) {
    const factor = Math.max(0.01, 1 - (staff.overload_percentage / 100));
    return (baseScore / factor) + (staff.overload_percentage / 1000);
  }
  return baseScore;
}

export function sortStaffByPriority(
  staff: Staff[],
  preferredJobTitle?: JobTitle,
  preferNearPharmacy?: boolean,
  preferredSupervisionRole?: string
): Staff[] {
  const jobTitlePriority: Record<JobTitle, number> = {
    Chemist: 3,
    Demonstrator: 2,
    'Teaching Assistant': 1,
    Lecturer: 0,
  };

  return [...staff].sort((a, b) => {
    // Health-room preference: near-pharmacy staff first when flag is set
    if (preferNearPharmacy) {
      // Prioritize staff with health issues for pharmacy rooms (P and M buildings)
      if (a.has_health_issue && !b.has_health_issue) return -1;
      if (!a.has_health_issue && b.has_health_issue) return 1;
    }

    // Prefer specific supervision role (e.g. prioritize exact "Exam Supervisor" over "Invigilator / Exam Supervisor")
    if (preferredSupervisionRole) {
      const aR = a.supervision_role === preferredSupervisionRole ? 1 : 0;
      const bR = b.supervision_role === preferredSupervisionRole ? 1 : 0;
      if (aR !== bR) return bR - aR;
    }

    // Lowest effective score first (fairness & overloaded reduction)
    const aScore = getEffectiveScore(a);
    const bScore = getEffectiveScore(b);
    if (aScore !== bScore) return aScore - bScore;

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

    return a.name.localeCompare(b.name);
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
    const slotKey = `${session.room_id}__${session.exam_date}__${getPeriodFromTime(session.start_time)}`;
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
  roleToAssign: 'Both' | 'Head_Supervisor' | 'Assistant' = 'Both'
): AssignmentResult {
  const violations: AssignmentConstraintViolation[] = [];
  const newAssignments: Assignment[] = [];

  const isOral = !!examSession.exam_type?.toLowerCase().includes('oral');
  const required = calculateRequiredStaff(examSession.student_count, config.ratios, isOral, examSession.exam_date, config.calendarRules);

  const strictRoles = config.constraints.enforce_strict_roles !== false;
  const nearPharmacy = targetRoom ? isNearPharmacy(targetRoom.room_name) : false;

  // Calculate average score for workload cap
  const availableCount = allStaff.filter(s => s.availability_status === 'Available').length;
  const averageScore = availableCount > 0
    ? allStaff.reduce((sum, s) => s.availability_status === 'Available' ? sum + s.current_score : sum, 0) / availableCount
    : undefined;

  // Evaluate each staff member's availability
  const staffWithStatus = allStaff.map((staff) => {
    const { available, hardViolations, softViolations } = isStaffAvailable(
      staff, examSession, existingAssignments, allExamSessions, config.constraints, Array.from(new Set(allExamSessions.map(s => s.exam_date))), targetRoom, periodFreeStaff, config.calendarRules, averageScore
    );
    return { staff, available, hardViolations, softViolations };
  });

  // Separate health-issue staff: prefer them for near-pharmacy rooms
  const availableAll = staffWithStatus.filter((s) => s.available);

  // Health-issue staff who SHOULD get near-pharmacy rooms, de-prioritise them for non-pharmacy rooms
  const healthStaff = availableAll.filter((s) => s.staff.has_health_issue);
  const normalStaff = availableAll.filter((s) => !s.staff.has_health_issue);

  // For pharmacy rooms: health staff first; for other rooms: health staff last
  const orderedPool = nearPharmacy
    ? [...healthStaff, ...normalStaff]
    : [...normalStaff, ...healthStaff];

  const pickBest = (
    candidates: typeof availableAll,
    excluded: Staff[],
    preferredJob?: JobTitle,
    preferredSupervisionRole?: string
  ): Staff | undefined => {
    const ideal = candidates.filter((c) => c.softViolations.length === 0).map((c) => c.staff);
    const fallback = candidates.filter((c) => c.softViolations.length > 0).map((c) => c.staff);

    const tryFrom = (pool: Staff[]) => {
      const sorted = sortStaffByPriority(pool, preferredJob, nearPharmacy, preferredSupervisionRole);
      return sorted.find((s) => !excluded.some((e) => e.id === s.id));
    };
    return tryFrom(ideal) ?? tryFrom(fallback);
  };

  // ── 1. Exam Supervisor (Per Room) ──
  // ONLY exam supervisor or Invigilator / Exam Supervisor are allowed to be exam supervisor.
  const headPool = orderedPool.filter(
    (s) => s.staff.supervision_role === 'Exam Supervisor' || s.staff.supervision_role === 'Invigilator / Exam Supervisor'
  );

  const headSupervisors: Staff[] = [];
  if (roleToAssign === 'Both' || roleToAssign === 'Head_Supervisor') {
    for (let i = 0; i < required.headSupervisors; i++) {
      const candidate = pickBest(headPool, headSupervisors, 'Lecturer', 'Exam Supervisor');
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
    if (headSupervisors.length < required.headSupervisors) {
      violations.push({
        type: 'capacity',
        message: `Not enough Exam Supervisors for ${examSession.subject_name}. Required: ${required.headSupervisors}, Found: ${headSupervisors.length}`,
        exam_session_id: examSession.id,
      });
    }
  }

  // ── 2. Invigilators (Assistants) ──
  if (roleToAssign === 'Both' || roleToAssign === 'Assistant') {
    const assistantPool = strictRoles
      ? orderedPool.filter((s) => s.staff.supervision_role === 'Invigilator' || s.staff.supervision_role === 'Invigilator / Exam Supervisor')
      : orderedPool.filter((s) => s.staff.supervision_role !== 'Exam Supervisor' && s.staff.supervision_role !== 'Committees Supervisor');

    const idealAssistants = assistantPool
      .filter((s) => s.softViolations.length === 0)
      .map((s) => s.staff);
    const fallbackAssistants = assistantPool
      .filter((s) => s.softViolations.length > 0)
      .map((s) => s.staff);

    // Sort both pools by priority (workload score, overload factor, job title) to ensure fairness
    const sortedIdeal = sortStaffByPriority(idealAssistants, undefined, nearPharmacy);
    const sortedFallback = sortStaffByPriority(fallbackAssistants, undefined, nearPharmacy);
    const allSortedAssistants = [...sortedIdeal, ...sortedFallback];

    const excludedFromAssistants = [...headSupervisors];
    const finalAssistantPool = allSortedAssistants.filter(
      (s) => !excludedFromAssistants.some((e) => e.id === s.id)
    );

    for (let i = 0; i < required.assistants && i < finalAssistantPool.length; i++) {
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

    const assignedAssistants = newAssignments.filter((a) => a.role === 'Assistant').length;
    if (assignedAssistants < required.assistants) {
      violations.push({
        type: 'capacity',
        message: `Not enough Invigilators for ${examSession.subject_name}. Required: ${required.assistants}, Found: ${assignedAssistants}`,
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
  onlyFinal?: boolean
): { assignments: Assignment[]; violations: AssignmentConstraintViolation[] } {
  // Step 1: Group sessions by room+period to detect co-located exams
  let roomGroups = groupSessionsByRoom(sessions);
  
  if (onlyOral) {
    roomGroups = roomGroups.filter(g => {
      const sample = sessions.find(s => s.id === g.session_ids[0]);
      return sample && sample.exam_type?.toLowerCase().includes('oral');
    });
  } else if (onlyFinal) {
    roomGroups = roomGroups.filter(g => {
      const sample = sessions.find(s => s.id === g.session_ids[0]);
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

  const sortedSessions = [...sessions].sort((a, b) => {
    const ga = groupMap.get(a.id)?.total_students ?? a.student_count;
    const gb = groupMap.get(b.id)?.total_students ?? b.student_count;
    return gb - ga;
  });

  let currentAssignments = [...existingAssignments];
  let currentStaff = staff.map((s) => ({ ...s }));
  const allNewAssignments: Assignment[] = [];
  const allViolations: AssignmentConstraintViolation[] = [];

  // --- PRE-PASS: UNIVERSAL WORKING DAY COMPENSATORY OFF-DAYS ---
  // Automatically swap a lost off-day (due to Universal Working Day) to a low-load day
  const dailyLoads = new Map<string, number>();
  const allExamDates = Array.from(new Set(sessions.map(s => s.exam_date)));
  for (const date of allExamDates) {
    dailyLoads.set(date, sessions.filter(s => s.exam_date === date).length);
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

  // --- PRE-PASS: COMMITTEES SUPERVISOR ASSIGNMENTS ---
  // Group sessions by date + period
  const datePeriodGroups = new Map<string, ExamSession[]>();
  for (const session of sortedSessions) {
    const key = `${session.exam_date}_${getPeriodFromTime(session.start_time)}`;
    if (!datePeriodGroups.has(key)) datePeriodGroups.set(key, []);
    datePeriodGroups.get(key)!.push(session);
  }

  const configuredMaxRooms = config.constraints.max_rooms_per_lecturer || 5;

  for (const dpSessions of datePeriodGroups.values()) {
    // Group by building
    const buildingGroups = new Map<string, ExamSession[]>();
    for (const session of dpSessions) {
      const room = rooms?.find(r => r.id === session.room_id);
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

      // Break into chunks of rooms respecting: configuredMaxRooms (max 5) AND max 2 floors
      const chunks: typeof bRoomGroups[] = [];
      let currentChunk: typeof bRoomGroups = [];
      let currentChunkFloors = new Set<number>();

      // Use the strict max configuration to ensure tight grouping where possible
      const chunkMaxRooms = configuredMaxRooms; 

      for (const roomGroup of bRoomGroups) {
        const floor = rooms?.find(r => r.id === roomGroup.room_id)?.floor || 0;
        
        const willExceedRooms = currentChunk.length >= chunkMaxRooms;
        const willExceedFloors = !currentChunkFloors.has(floor) && currentChunkFloors.size >= 2;

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
        
        // Find available Committees Supervisor (Strict rule: Committees Supervisor can supervise many rooms)
        const committeeCandidates = currentStaff.filter(s => s.supervision_role === 'Committees Supervisor');
        
        // Calculate average score for workload cap
        const availableCount = currentStaff.filter(s => s.availability_status === 'Available').length;
        const averageScore = availableCount > 0 ? currentStaff.reduce((sum, s) => s.availability_status === 'Available' ? sum + s.current_score : sum, 0) / availableCount : undefined;

        const candidateStatus = committeeCandidates.map(s => {
          let isAvail = true;
          const allSoftViolations: any[] = [];
          
          // Verify availability against ALL rooms in this chunk (e.g., to respect floor-level health constraints)
          for (const roomGroup of chunk) {
            const rSession = bSessions.find(sess => sess.id === roomGroup.session_ids[0]);
            if (!rSession) continue;
            
            const status = isStaffAvailable(s, rSession, currentAssignments, sessions, config.constraints, allExamDates, rooms?.find(r => r.id === roomGroup.room_id), periodFreeStaff, config.calendarRules, averageScore);
            
            if (!status.available) {
              isAvail = false;
              break;
            }
            allSoftViolations.push(...status.softViolations);
          }
          
          return { staff: s, available: isAvail, softViolations: allSoftViolations };
        }).filter(cs => cs.available);

        if (candidateStatus.length > 0) {
          candidateStatus.sort((a, b) => {
             if (a.softViolations.length !== b.softViolations.length) return a.softViolations.length - b.softViolations.length;
             const aScore = getEffectiveScore(a.staff);
             const bScore = getEffectiveScore(b.staff);
             return aScore - bScore;
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

  // Track Committees Supervisors already assigned per room-slot key
  const committeesSupervisorBySlot = new Map<string, string>();

  // Sort room groups by total students to assign the biggest rooms first
  const sortedRoomGroups = [...roomGroups].sort((a, b) => b.total_students - a.total_students);

  // Two-phase assignment to ensure Exam Supervisors are fully filled across ALL rooms
  // before ANY Assistants are assigned. This prevents dual-role staff from being
  // consumed as Assistants before they can act as Head Supervisors.

  // Phase 1: Assign Head Supervisors
  for (const group of sortedRoomGroups) {
    const slotKey = `${group.room_id}__${group.exam_date}__${getPeriodFromTime(group.start_time)}`;

    const sampleSession = sortedSessions.find(s => s.id === group.session_ids[0]);
    if (!sampleSession) continue;

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
      'Head_Supervisor'
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

  // Phase 2: Assign Assistants
  for (const group of sortedRoomGroups) {
    const slotKey = `${group.room_id}__${group.exam_date}__${getPeriodFromTime(group.start_time)}`;

    const sampleSession = sortedSessions.find(s => s.id === group.session_ids[0]);
    if (!sampleSession) continue;

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
      'Assistant'
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

  return { assignments: allNewAssignments, violations: allViolations };
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
  
  // Group sessions by date and period
  const datePeriodGroups = new Map<string, { exam_date: string; period: number; start_time: string; session_ids: string[]; has_final: boolean }>();
  for (const session of sessions) {
    const period = getPeriodFromTime(session.start_time);
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
    // 1. Find staff already assigned to standard duties in this period
    const assignedStaffIds = new Set(
      currentAssignments
        .filter(a => group.session_ids.includes(a.exam_session_id))
        .map(a => a.staff_id)
    );

    if (group.period === 1 && group.exam_date.includes('07')) {
      console.log(`[DEBUG] Period 1 on ${group.exam_date}: found ${assignedStaffIds.size} assigned staff out of ${currentAssignments.length} total assignments.`);
    }

    // Create a dummy exam session to check availability for this slot
    const representativeSession: ExamSession = {
      id: crypto.randomUUID(),
      subject_name: 'Reserve Slot Check',
      exam_date: group.exam_date,
      start_time: group.start_time,
      student_count: 0,
      room_id: crypto.randomUUID(),
      exam_type: 'Reserve',
      program: null,
      end_time: null,
      student_start: null,
      student_end: null,
      is_locked: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 2. Filter available staff who are not already assigned
    const availableStaff = allStaff.filter(staff => {
      // Must not be already assigned in this period
      if (assignedStaffIds.has(staff.id)) return false;

      // Must be available according to standard rules
      const { available } = isStaffAvailable(
        staff,
        representativeSession,
        currentAssignments,
        sessions,
        config.constraints,
        Array.from(new Set(sessions.map(s => s.exam_date))),
        undefined,
        [],
        config.calendarRules,
        undefined,
        true // strictOffDays: True, do not break off-days for reserves
      );
      return available;
    });

    if (availableStaff.length === 0) continue;

    // Separate into supervisor pool and assistant pool
    const supervisorPool = availableStaff.filter(
      s => s.supervision_role === 'Exam Supervisor' || s.supervision_role === 'Invigilator / Exam Supervisor'
    );
    const assistantPool = availableStaff.filter(
      s => s.supervision_role === 'Invigilator' || s.supervision_role === 'Invigilator / Exam Supervisor'
    );

    // Sort both pools using our custom sort (lowest score first)
    const sortedSupervisors = sortStaffByPriority(supervisorPool);
    const sortedAssistants = sortStaffByPriority(assistantPool);

    // Health-issue staff are no longer deprioritized for reserves
    // so they can maintain a fair overall workload score.

    // If it is Period 2, try to avoid selecting Chemists by pushing them to the end of the queue
    if (group.period === 2) {
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

    // Target 3-5 for Exam Supervisors
    const targetSupervisorCount = Math.min(5, Math.max(3, sortedSupervisors.length));
    let addedSupervisors = 0;
    for (const supervisor of sortedSupervisors) {
      if (addedSupervisors >= targetSupervisorCount) break;
      if (!selectedIds.has(supervisor.id)) {
        selected.push({ staff: supervisor, role: 'Exam_Supervisor' });
        selectedIds.add(supervisor.id);
        addedSupervisors++;
      }
    }

    // Target 3-5 for Invigilators (Assistants)
    const targetAssistantCount = Math.min(5, Math.max(3, sortedAssistants.length));
    let addedAssistants = 0;
    for (const assistant of sortedAssistants) {
      if (addedAssistants >= targetAssistantCount) break;
      if (!selectedIds.has(assistant.id)) {
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
      // Increment free_staff_score locally so subsequent periods in the same auto-assign batch see the updated score!
      const s = allStaff.find(x => x.id === item.staff.id);
      if (s) {
        s.free_staff_score = (s.free_staff_score || 0) + 1;
      }
    }
  }

  return reserveAssignments;
}
