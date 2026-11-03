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
import { parseRoomCode, getPeriodFromTime, getSessionPeriod, areSessionsInSamePeriod, getDayUniquePeriods, getDurationInMinutes, timesOverlap } from '@/types/database.types';

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
  strictOffDays: boolean = false,
  allowWorkloadCapRelax: boolean = false,
  allowDayCapRelax: boolean = false
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
  const examDateISO = examSession.exam_date; // already stored as YYYY-MM-DD
  const hasSpecificOffDates = staff.specific_off_dates && staff.specific_off_dates.length > 0;

  // 2a. Strict Specific Off-Dates (Red X / approved leaves)
  // CRITICAL SAFETY RULE: Approved individual leaves (medical, emergency, vacation) are ALWAYS respected,
  // regardless of which availability mode is active!
  if (staff.specific_off_dates?.includes(examDateISO)) {
    hardViolations.push({
      type: 'unavailable',
      message: `${staff.name} has an approved specific day-off on ${examDateISO}`,
      staff_id: staff.id,
      exam_session_id: examSession.id,
    });
  } else {
    // Resolve availability policy (respect_all_off_days | cap_days_per_week | smart_dates_priority)
    const { policy, custom_days_per_week: maxDaysPerWeek } = resolveAvailabilityPolicy(constraints);

    if (policy === 'cap_days_per_week') {
      // Mode 2: Flexible Availability (Bypass weekly off-days, cap days per academic week)
      const sessionWeekKey = getAcademicWeekKey(examSession.exam_date);
      const effectiveCapDays = staff.employment_status === 'Part-time'
        ? Math.min(maxDaysPerWeek || 5, staff.working_days?.length || 3)
        : (maxDaysPerWeek || 5);

      if (effectiveCapDays && effectiveCapDays > 0) {
        const assignedDatesThisWeek = new Set<string>();
        for (const a of existingAssignments) {
          if (a.staff_id === staff.id) {
            const s = allExamSessions.find(x => x.id === a.exam_session_id);
            const sDate = (a as any).exam_date || (a as any).exam_sessions?.exam_date || (a as any).exam_session?.exam_date || s?.exam_date;
            if (sDate) {
              const cleanDate = sDate.split('T')[0];
              if (getAcademicWeekKey(cleanDate) === sessionWeekKey) {
                assignedDatesThisWeek.add(cleanDate);
              }
            }
          }
        }
        for (const r of periodFreeStaff) {
          if (r.staff_id === staff.id && r.exam_date) {
            const cleanDate = r.exam_date.split('T')[0];
            if (getAcademicWeekKey(cleanDate) === sessionWeekKey) {
              assignedDatesThisWeek.add(cleanDate);
            }
          }
        }
        if (!assignedDatesThisWeek.has(examSession.exam_date) && assignedDatesThisWeek.size >= effectiveCapDays) {
          if (allowDayCapRelax) {
            softViolations.push({
              type: 'capacity',
              message: `${staff.name} assigned extra day this week to prevent room deficiency`,
              staff_id: staff.id,
              exam_session_id: examSession.id,
            });
          } else {
            hardViolations.push({
              type: 'unavailable',
              message: `${staff.name} has reached the maximum of ${effectiveCapDays} assigned days this week`,
              staff_id: staff.id,
              exam_session_id: examSession.id,
            });
          }
        }
      }
    } else {
      // Mode 1 (Standard) or Mode 3 (Smart Dates Priority)
      const isUniversalWorkingDayRaw = calendarRules.some(r => r.is_universal_working_day && r.start_date <= examDateISO && r.end_date >= examDateISO);
      const isUniversalWorkingDay = !strictOffDays && isUniversalWorkingDayRaw && staff.supervision_role !== 'Committees Supervisor';

      if (!isUniversalWorkingDay) {
        if (staff.specific_standard_off_dates?.includes(examDateISO)) {
          hardViolations.push({
            type: 'unavailable',
            message: `${staff.name} has a standard specific day-off on ${examDateISO}`,
            staff_id: staff.id,
            exam_session_id: examSession.id,
          });
        } else {
          const date = new Date(`${examSession.exam_date}T12:00:00Z`);
          const dayName = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });

          const { recurringOffDays } = hasSpecificOffDates
            ? classifyOffDays(staff.specific_off_dates, allExamDates)
            : { recurringOffDays: [] as string[] };

          if (recurringOffDays.includes(dayName)) {
            hardViolations.push({
              type: 'unavailable',
              message: `${staff.name} does not work on ${dayName}s (recurring off throughout exam period)`,
              staff_id: staff.id,
              exam_session_id: examSession.id,
            });
          } else {
            // Mode 3: Smart dates priority - if staff has specific off-dates, ignore weekly working days pattern
            const shouldBypassWeeklyPattern = policy === 'smart_dates_priority' && hasSpecificOffDates;
            if (!shouldBypassWeeklyPattern && staff.working_days && !staff.working_days.includes(dayName)) {
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
    }
  }

  // 2d. Check if staff is already assigned as a Reserve for this period (Hard)
  const sessionPeriod = getSessionPeriod(examSession, allExamSessions);
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
    const s = allExamSessions.find((x) => x.id === a.exam_session_id);
    return s && a.staff_id === staff.id && s.exam_date === examSession.exam_date && areSessionsInSamePeriod(s, examSession, allExamSessions);
  });
  
  if (conflicting.length > 0) {
    const inDifferentRoom = conflicting.some(a => {
      const s = allExamSessions.find((x) => x.id === a.exam_session_id);
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
    const s = allExamSessions.find((x) => x.id === a.exam_session_id);
    return s && a.staff_id === staff.id && s.exam_date === examSession.exam_date && !areSessionsInSamePeriod(s, examSession, allExamSessions);
  });
  if (sameDayOther.length > 0) {
    const isConsecutive = sameDayOther.some((a) => {
      const s = allExamSessions.find((x) => x.id === a.exam_session_id);
      if (!s) return false;
      const otherPeriod = getSessionPeriod(s, allExamSessions);
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
  }

  // 4b. Max Working Days per week (Scoped to this academic week!)
  const sessionWeekKey = getAcademicWeekKey(examSession.exam_date);
  const datesAssignedInWeek = new Set<string>();
  existingAssignments.forEach(a => {
    if (a.staff_id === staff.id) {
      const s = allExamSessions.find(x => x.id === a.exam_session_id);
      if (s && getAcademicWeekKey(s.exam_date) === sessionWeekKey) {
        datesAssignedInWeek.add(s.exam_date);
      }
    }
  });

  const { custom_days_per_week: configuredMaxDays } = resolveAvailabilityPolicy(constraints);
  const targetDaysCap = configuredMaxDays || 5;

  let maxAllowedDaysInWeek = targetDaysCap;
  if (staff.employment_status === 'Part-time') {
    maxAllowedDaysInWeek = Math.min(targetDaysCap, staff.working_days?.length || 3);
  } else {
    maxAllowedDaysInWeek = targetDaysCap; // Full-time staff up to 5 days
  }

  // If this examSession is on a NEW date, check if they are already at their weekly limit
  if (!datesAssignedInWeek.has(examSession.exam_date)) {
    if (datesAssignedInWeek.size >= maxAllowedDaysInWeek) {
      if (allowDayCapRelax) {
        softViolations.push({
          type: 'capacity',
          message: `${staff.name} assigned extra day this week to prevent room deficiency`,
          staff_id: staff.id,
          exam_session_id: examSession.id,
        });
      } else {
        hardViolations.push({
          type: 'unavailable',
          message: `${staff.name} has reached their maximum allowed working days (${maxAllowedDaysInWeek} days this week)`,
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
    const s = allExamSessions.find((x) => x.id === a.exam_session_id);
    if (!s) return;
    const key = `${s.exam_date}_${getSessionPeriod(s, allExamSessions)}`;
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

  // 8. Workload Cap
  if (constraints.max_score_delta_from_average !== undefined && averageScore !== undefined) {
    if (staff.current_score > averageScore + constraints.max_score_delta_from_average) {
      if (allowWorkloadCapRelax) {
        softViolations.push({
          type: 'workload_cap',
          message: `${staff.name} is above average workload (${staff.current_score} vs ${averageScore.toFixed(1)}) but assigned to prevent room deficiency`,
          staff_id: staff.id,
          exam_session_id: examSession.id,
        });
      } else {
        hardViolations.push({
          type: 'workload_cap',
          message: `${staff.name} has reached the hard workload cap (${staff.current_score} assignments vs average ${averageScore.toFixed(1)}). Locked out until others catch up.`,
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
      // Tier 2 Fallback: Relax workload cap to prevent room deficiency
      const fallbackStaffWithStatus = allStaff.map((staff) => {
        return {
          staff,
          ...isStaffAvailable(
            staff, examSession, existingAssignments, allExamSessions, config.constraints,
            Array.from(new Set(allExamSessions.map(s => s.exam_date))), targetRoom, periodFreeStaff,
            config.calendarRules, averageScore, false, true, false
          )
        };
      });
      const fallbackHeadPool = fallbackStaffWithStatus.filter(
        (s) => s.available && (s.staff.supervision_role === 'Exam Supervisor' || s.staff.supervision_role === 'Invigilator / Exam Supervisor')
      );
      while (headSupervisors.length < required.headSupervisors) {
        const candidate = pickBest(fallbackHeadPool, headSupervisors, 'Lecturer', 'Exam Supervisor');
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

    if (headSupervisors.length < required.headSupervisors) {
      // Tier 3 Fallback (Zero-Deficiency Guarantee): Prevent unstaffed room by relaxing day cap
      const emergencyStaffWithStatus = allStaff.map((staff) => {
        return {
          staff,
          ...isStaffAvailable(
            staff, examSession, existingAssignments, allExamSessions, config.constraints,
            Array.from(new Set(allExamSessions.map(s => s.exam_date))), targetRoom, periodFreeStaff,
            config.calendarRules, averageScore, false, true, true
          )
        };
      });
      const emergencyHeadPool = emergencyStaffWithStatus.filter(
        (s) => s.available && (s.staff.supervision_role === 'Exam Supervisor' || s.staff.supervision_role === 'Invigilator / Exam Supervisor')
      );
      while (headSupervisors.length < required.headSupervisors) {
        const candidate = pickBest(emergencyHeadPool, headSupervisors, 'Lecturer', 'Exam Supervisor');
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

    // Sort both pools by priority (workload score, overload factor, job title) to ensure fairness.
    // Prioritize pure 'Invigilator' staff (Chemists & pure-invigilator Demonstrators) over dual-role staff
    // so dual-role staff are preserved for Exam Supervisor duties where pure invigilators cannot serve.
    const sortedIdeal = sortStaffByPriority(idealAssistants, undefined, nearPharmacy, 'Invigilator');
    const sortedFallback = sortStaffByPriority(fallbackAssistants, undefined, nearPharmacy, 'Invigilator');
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

    let assignedAssistants = newAssignments.filter((a) => a.role === 'Assistant').length;

    if (assignedAssistants < required.assistants) {
      // Tier 2 Fallback: Relax workload cap to prevent assistant deficiency
      const fallbackStaffWithStatus = allStaff.map((staff) => {
        return {
          staff,
          ...isStaffAvailable(
            staff, examSession, existingAssignments, allExamSessions, config.constraints,
            Array.from(new Set(allExamSessions.map(s => s.exam_date))), targetRoom, periodFreeStaff,
            config.calendarRules, averageScore, false, true, false
          )
        };
      });
      const fallbackPool = strictRoles
        ? fallbackStaffWithStatus.filter((s) => s.available && (s.staff.supervision_role === 'Invigilator' || s.staff.supervision_role === 'Invigilator / Exam Supervisor'))
        : fallbackStaffWithStatus.filter((s) => s.available && s.staff.supervision_role !== 'Exam Supervisor' && s.staff.supervision_role !== 'Committees Supervisor');
      
      const excludedStaff = [...headSupervisors, ...newAssignments.map(a => allStaff.find(s => s.id === a.staff_id)).filter(Boolean) as Staff[]];
      const eligible = sortStaffByPriority(fallbackPool.map(p => p.staff), undefined, nearPharmacy, 'Invigilator')
        .filter(s => !excludedStaff.some(e => e.id === s.id));

      for (let i = 0; i < eligible.length && assignedAssistants < required.assistants; i++) {
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

    if (assignedAssistants < required.assistants) {
      // Tier 3 Fallback (Zero-Deficiency Guarantee): Prevent unstaffed room by relaxing day cap
      const emergencyStaffWithStatus = allStaff.map((staff) => {
        return {
          staff,
          ...isStaffAvailable(
            staff, examSession, existingAssignments, allExamSessions, config.constraints,
            Array.from(new Set(allExamSessions.map(s => s.exam_date))), targetRoom, periodFreeStaff,
            config.calendarRules, averageScore, false, true, true
          )
        };
      });
      const emergencyPool = strictRoles
        ? emergencyStaffWithStatus.filter((s) => s.available && (s.staff.supervision_role === 'Invigilator' || s.staff.supervision_role === 'Invigilator / Exam Supervisor'))
        : emergencyStaffWithStatus.filter((s) => s.available && s.staff.supervision_role !== 'Exam Supervisor' && s.staff.supervision_role !== 'Committees Supervisor');
      
      const excludedStaff = [...headSupervisors, ...newAssignments.map(a => allStaff.find(s => s.id === a.staff_id)).filter(Boolean) as Staff[]];
      const eligible = sortStaffByPriority(emergencyPool.map(p => p.staff), undefined, nearPharmacy, 'Invigilator')
        .filter(s => !excludedStaff.some(e => e.id === s.id));

      for (let i = 0; i < eligible.length && assignedAssistants < required.assistants; i++) {
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
  let currentStaff = staff.map((s) => ({ ...s }));
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

  for (const s of currentStaff) {
    if (s.supervision_role === 'Committees Supervisor') {
      csAssignedPeriods.set(s.id, new Set());
      csDailyDutyCounts.set(s.id, new Map());
      csPeriodDutyCounts.set(s.id, 0);
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

        // Calculate average score for workload cap among Committees Supervisors
        const csStaff = currentStaff.filter(s => s.supervision_role === 'Committees Supervisor' && s.availability_status === 'Available');
        const averageScore = csStaff.length > 0 ? csStaff.reduce((sum, s) => sum + s.current_score, 0) / csStaff.length : undefined;

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
                rooms?.find(r => r.id === roomGroup.room_id), periodFreeStaff, config.calendarRules, averageScore,
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
          candidateStatus.sort((a, b) => {
            const staffA = a.staff;
            const staffB = b.staff;

            // 1. Daily Equalization: Staff with 0 duties today come before staff with 1 duty today
            const dayDutiesA = csDailyDutyCounts.get(staffA.id)?.get(examDate) ?? 0;
            const dayDutiesB = csDailyDutyCounts.get(staffB.id)?.get(examDate) ?? 0;
            if (dayDutiesA !== dayDutiesB) {
              return dayDutiesA - dayDutiesB;
            }

            // 2. Weekly / Cycle Equalization: Fewest duties in this exam run/week first
            const periodDutiesA = csPeriodDutyCounts.get(staffA.id) ?? 0;
            const periodDutiesB = csPeriodDutyCounts.get(staffB.id) ?? 0;
            if (periodDutiesA !== periodDutiesB) {
              return periodDutiesA - periodDutiesB;
            }

            // 3. Effective score tie-breaker: prioritize staff with lower baseline score
            const aScore = getEffectiveScore(staffA);
            const bScore = getEffectiveScore(staffB);
            if (aScore !== bScore) {
              return aScore - bScore;
            }

            // 4. Soft violations as secondary factor
            if (a.softViolations.length !== b.softViolations.length) {
              return a.softViolations.length - b.softViolations.length;
            }

            // 5. Deterministic tie-breaker by name
            return staffA.name.localeCompare(staffB.name);
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

  // Two-phase assignment to ensure Exam Supervisors are fully filled across ALL rooms
  // before ANY Assistants are assigned. This prevents dual-role staff from being
  // consumed as Assistants before they can act as Head Supervisors.

  // Phase 1: Assign Head Supervisors
  for (const group of sortedRoomGroups) {
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
        reserveAssignments as any,
        config.calendarRules,
        undefined,
        !config.constraints.ignore_staff_working_days // Do not force strict off-days if ignoring working days (e.g. Midterm)
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
    // Prioritize pure 'Exam Supervisor' for supervisor reserves, and pure 'Invigilator' for assistant reserves
    const sortedSupervisors = sortStaffByPriority(supervisorPool, undefined, false, 'Exam Supervisor');
    const sortedAssistants = sortStaffByPriority(assistantPool, undefined, false, 'Invigilator');

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

    // Target configured count for Exam Supervisors (default 3, range 0-10)
    const configuredTargetSupervisors = config.constraints?.reserve_supervisors_target ?? 3;
    const targetSupervisorCount = Math.min(configuredTargetSupervisors, sortedSupervisors.length);
    let addedSupervisors = 0;
    for (const supervisor of sortedSupervisors) {
      if (addedSupervisors >= targetSupervisorCount) break;
      if (!selectedIds.has(supervisor.id)) {
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
