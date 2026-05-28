/**
 * free-invigilators.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Computes the pool of *free* (unassigned) staff for every exam period across
 * the schedule, and ranks them by a fairness score so that invigilation duty
 * is distributed as equally as possible throughout the week.
 *
 * Key concepts:
 *  - A staff member is "free" at a given period if they have no assignment that
 *    overlaps that period AND they are marked Available AND they work on that day.
 *  - Equal distribution is enforced via the existing `current_score` field:
 *    staff with the lowest cumulative score are listed first (most desirable for
 *    substitution duty).
 *  - A "substitution load" is also computed per week: the total number of exam
 *    periods in that week divided by the number of free staff, giving admins a
 *    sense of how heavy the on-call burden is.
 */

import type {
  Staff,
  ExamSession,
  Assignment,
  AssignmentWithSession,
  SchedulingConstraintsConfig,
} from '@/types/database.types';
import { getPeriodFromTime } from '@/types/database.types';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ExamPeriodKey {
  /** ISO date string, e.g. "2026-04-10" */
  date: string;
  /** Period index 1, 2, 3… */
  period: number;
  /** HH:mm start time */
  startTime: string;
}

export interface FreeInvigilatorEntry {
  staff: Staff;
  /** Cumulative assignment score (lower = should be chosen first) */
  score: number;
  /** How many times this staff member was already assigned this week */
  weekAssignments: number;
}

export interface PeriodFreePool {
  periodKey: ExamPeriodKey;
  /** All exam sessions running in this period (used for context) */
  activeSessions: ExamSession[];
  /** Staff who are free during this period, sorted by fairness score */
  freeInvigilators: FreeInvigilatorEntry[];
  /** Staff who are assigned in this period */
  busyStaff: Staff[];
}

export interface WeeklyFreeReport {
  weekLabel: string;
  /** ISO date of the first day of the week */
  weekStart: string;
  /** ISO date of the last day of the week */
  weekEnd: string;
  /** Total unique exam periods in the week */
  totalPeriods: number;
  /** Periods with their free/busy pools */
  periods: PeriodFreePool[];
  /** Summary: how many total "free slots" are available across the week */
  totalFreeSlots: number;
  /** Exam-load score for this week: number of sessions */
  examLoad: number;
  /** Substitution burden: avg free slots per period */
  avgFreePerPeriod: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getDayName(dateStr: string): string {
  try {
    // Parse at noon UTC to avoid timezone-caused day shifts
    return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-US', {
      weekday: 'long',
      timeZone: 'UTC',
    });
  } catch {
    return '';
  }
}

function getISOWeekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const day = d.getUTCDay();
  const offset = day === 6 ? 0 : -(day + 1);
  const start = new Date(d.setUTCDate(d.getUTCDate() + offset));
  return start.toISOString().split('T')[0];
}

function groupByWeek(sessions: ExamSession[]): Map<string, ExamSession[]> {
  const map = new Map<string, ExamSession[]>();
  for (const s of sessions) {
    const weekStart = getISOWeekStart(s.exam_date);
    if (!map.has(weekStart)) map.set(weekStart, []);
    map.get(weekStart)!.push(s);
  }
  return map;
}

/**
 * Returns true if a staff member is assigned during the given date + period.
 */
function isAssignedInPeriod(
  staffId: string,
  date: string,
  period: number,
  assignments: Assignment[],
  allSessions: ExamSession[]
): boolean {
  return assignments.some(a => {
    if (a.staff_id !== staffId) return false;
    const session = allSessions.find(s => s.id === a.exam_session_id);
    if (!session) return false;
    return session.exam_date === date && getPeriodFromTime(session.start_time) === period;
  });
}

/**
 * Count how many assignments a staff member has in a given week.
 */
function countWeekAssignments(
  staffId: string,
  weekDates: string[],
  assignments: Assignment[],
  allSessions: ExamSession[]
): number {
  const uniqueSlots = new Set<string>();
  assignments.forEach(a => {
    if (a.staff_id !== staffId) return;
    const session = allSessions.find(s => s.id === a.exam_session_id);
    if (session && weekDates.includes(session.exam_date)) {
      const p = getPeriodFromTime(session.start_time);
      if (a.role === 'Head_Supervisor') {
        uniqueSlots.add(`${session.exam_date}_${p}`);
      } else {
        uniqueSlots.add(`${session.exam_date}_${p}_${session.room_id}`);
      }
    }
  });
  return uniqueSlots.size;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the full free-invigilators report for every distinct exam period
 * across all sessions, grouped by week.
 *
 * @param allStaff       All staff records (any availability)
 * @param allSessions    All exam sessions
 * @param allAssignments All assignments (flat, no relations needed)
 * @param config         Optional scheduling constraints config
 * @returns              One WeeklyFreeReport per calendar week
 */
export function computeFreeInvigilatorsReport(
  allStaff: Staff[],
  allSessions: ExamSession[],
  allAssignments: Assignment[],
  config?: SchedulingConstraintsConfig
): WeeklyFreeReport[] {
  if (!allSessions.length) return [];

  // Only consider staff who are actually Available
  const availableStaff = allStaff.filter(s => s.availability_status === 'Available');

  // Group sessions by week
  const byWeek = groupByWeek(allSessions);
  const reports: WeeklyFreeReport[] = [];

  for (const [weekStart, weekSessions] of byWeek.entries()) {
    // Unique dates in this week
    const weekDates = [...new Set(weekSessions.map(s => s.exam_date))].sort();
    const weekEnd = weekDates[weekDates.length - 1];

    // Unique period-keys in this week (date + period + startTime)
    const periodMap = new Map<string, ExamPeriodKey>();
    for (const session of weekSessions) {
      const p = getPeriodFromTime(session.start_time);
      const key = `${session.exam_date}_${p}`;
      if (!periodMap.has(key)) {
        periodMap.set(key, {
          date: session.exam_date,
          period: p,
          startTime: session.start_time,
        });
      }
    }

    const periods: PeriodFreePool[] = [];
    let totalFreeSlots = 0;

    for (const [, periodKey] of periodMap.entries()) {
      const { date, period } = periodKey;
      const dayName = getDayName(date);

      // All sessions active in this period
      const activeSessions = weekSessions.filter(
        s => s.exam_date === date && getPeriodFromTime(s.start_time) === period
      );

      // For each available staff: check if they work that day AND are not assigned
      const freeEntries: FreeInvigilatorEntry[] = [];
      const busyStaff: Staff[] = [];

      for (const staff of availableStaff) {
        // 1. Check specific date-off first (takes precedence)
        const hasSpecificOffDates = staff.specific_off_dates && staff.specific_off_dates.length > 0;
        if (hasSpecificOffDates && staff.specific_off_dates.includes(date)) continue;

        // 2. Fall back to recurring weekday pattern
        const ignoreWorkingDays = config?.ignore_working_days_if_specific_dates !== false && hasSpecificOffDates;
        const worksToday =
          ignoreWorkingDays ||
          !staff.working_days ||
          staff.working_days.length === 0 ||
          staff.working_days.includes(dayName);

        if (!worksToday) continue; // doesn't work this day — neither free nor busy from our perspective

        const busy = isAssignedInPeriod(staff.id, date, period, allAssignments, allSessions);
        if (busy) {
          busyStaff.push(staff);
        } else {
          const weekAssignments = countWeekAssignments(
            staff.id,
            weekDates,
            allAssignments,
            allSessions
          );
          freeEntries.push({
            staff,
            score: staff.current_score,
            weekAssignments,
          });
        }
      }

      // Sort free staff: fewest weekly assignments first, then by cumulative score
      freeEntries.sort((a, b) => {
        if (a.weekAssignments !== b.weekAssignments) return a.weekAssignments - b.weekAssignments;
        if (a.score !== b.score) return a.score - b.score;
        return a.staff.name.localeCompare(b.staff.name);
      });

      totalFreeSlots += freeEntries.length;

      periods.push({
        periodKey,
        activeSessions,
        freeInvigilators: freeEntries,
        busyStaff,
      });
    }

    // Sort periods by date then by period number
    periods.sort((a, b) => {
      const dateCmp = a.periodKey.date.localeCompare(b.periodKey.date);
      if (dateCmp !== 0) return dateCmp;
      return a.periodKey.period - b.periodKey.period;
    });

    const totalPeriods = periods.length;
    const avgFreePerPeriod = totalPeriods > 0 ? Math.round((totalFreeSlots / totalPeriods) * 10) / 10 : 0;

    // Week label
    const startLabel = new Date(weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const endLabel = new Date(weekEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    reports.push({
      weekLabel: `Week of ${startLabel} – ${endLabel}`,
      weekStart,
      weekEnd,
      totalPeriods,
      periods,
      totalFreeSlots,
      examLoad: weekSessions.length,
      avgFreePerPeriod,
    });
  }

  // Sort reports chronologically
  reports.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  return reports;
}

/**
 * Flat list of all exam period free pools (no week grouping) — useful for
 * embedding in the full exam schedule report.
 */
export function computeAllPeriodFreePools(
  allStaff: Staff[],
  allSessions: ExamSession[],
  allAssignments: Assignment[]
): PeriodFreePool[] {
  const reports = computeFreeInvigilatorsReport(allStaff, allSessions, allAssignments);
  return reports.flatMap(r => r.periods);
}
