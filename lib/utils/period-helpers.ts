/**
 * Period Helpers for Day-Specific Exam Period Calculation & Conflict Prevention
 */

export interface DayPeriodInfo {
  /** 1-based sequential period index for this specific day: 1, 2, 3... */
  period: number;
  /** YYYY-MM-DD */
  exam_date: string;
  /** Normalized HH:mm start time, e.g. "09:00" */
  start_time: string;
  /** Normalized HH:mm end time, e.g. "11:00" */
  end_time: string;
  /** Display label, e.g. "Period 1" */
  label: string;
  /** Display range, e.g. "09:00 – 11:00" */
  time_range: string;
  /** Unique key for this day's slot, e.g. "2026-04-11__09:00__11:00" */
  slot_key: string;
}

/**
 * Normalizes any time representation into a strict "HH:mm" 24-hour string.
 * Supports:
 * - "9:00" -> "09:00"
 * - "09:00:00" -> "09:00"
 * - "1:30 PM" / "01:30 PM" -> "13:30"
 * - "9:30 AM" -> "09:30"
 * - Excel time fractions (e.g. 0.375 -> "09:00")
 * - JS Date objects -> "HH:mm"
 */
export function normalizeTimeString(raw: any): string {
  if (raw === null || raw === undefined) return '';

  if (raw instanceof Date) {
    const h = String(raw.getHours()).padStart(2, '0');
    const m = String(raw.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  // If number (Excel fractional day)
  if (typeof raw === 'number') {
    if (raw >= 0 && raw <= 1) {
      const totalMinutes = Math.round(raw * 24 * 60);
      const h = Math.floor(totalMinutes / 60) % 24;
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  const str = String(raw).trim();
  if (!str) return '';

  // Check 12-hour AM/PM format, e.g. "9:30 AM" or "01:30 PM"
  const ampmMatch = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2];
    const meridiem = ampmMatch[3].toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }

  // Check standard HH:mm or HH:mm:ss
  const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    const hours = String(parseInt(match[1], 10)).padStart(2, '0');
    const minutes = String(parseInt(match[2], 10)).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // If contains range like "09:00 - 11:00", take first part
  if (str.includes('-')) {
    const parts = str.split('-').map(s => s.trim());
    return normalizeTimeString(parts[0]);
  }

  return str;
}

/**
 * Normalizes start and end time. If end_time is not provided or invalid,
 * defaults to 2 hours (120 minutes) after start_time.
 */
export function normalizeSessionTimes(startTimeRaw: any, endTimeRaw?: any): { startTime: string; endTime: string } {
  const startTime = normalizeTimeString(startTimeRaw) || '09:00';
  let endTime = normalizeTimeString(endTimeRaw);

  if (!endTime) {
    try {
      const [h, m] = startTime.split(':').map(Number);
      const endTotal = (h * 60 + (m || 0) + 120) % (24 * 60);
      const endH = Math.floor(endTotal / 60);
      const endM = endTotal % 60;
      endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    } catch {
      endTime = '11:00';
    }
  }

  return { startTime, endTime };
}

/**
 * Checks whether two time windows strictly overlap on the same day.
 */
export function timesOverlap(
  start1: string,
  end1: string | null | undefined,
  start2: string,
  end2: string | null | undefined
): boolean {
  try {
    const toMins = (t: string) => {
      const clean = normalizeTimeString(t);
      const [h, m] = clean.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const s1 = toMins(start1);
    const e1 = end1 ? toMins(end1) : s1 + 120;

    const s2 = toMins(start2);
    const e2 = end2 ? toMins(end2) : s2 + 120;

    return s1 < e2 && s2 < e1;
  } catch {
    return false;
  }
}

// Cache for getDayUniquePeriods by sessions array reference
const dayPeriodsCache = new WeakMap<any[], Map<string, DayPeriodInfo[]>>();

// Cache for getSessionPeriod by session object reference
const sessionPeriodCache = new WeakMap<any, number>();

/**
 * Computes the exact unique periods of each day from the uploaded / loaded exam sessions.
 * On each day, the unique combinations of (start_time, end_time) are ordered chronologically:
 * - 1st slot -> Period 1
 * - 2nd slot -> Period 2
 * - 3rd slot -> Period 3
 * ...
 * 
 * Returns a Map keyed by exam_date (YYYY-MM-DD) mapping to the sorted array of DayPeriodInfo.
 */
export function getDayUniquePeriods<T extends { exam_date: string; start_time: string; end_time?: string | null }>(
  sessions: T[]
): Map<string, DayPeriodInfo[]> {
  if (!sessions || sessions.length === 0) return new Map();

  const cached = dayPeriodsCache.get(sessions);
  if (cached) return cached;

  const dateMap = new Map<string, Map<string, { startTime: string; endTime: string }>>();

  for (const session of sessions) {
    if (!session.exam_date) continue;
    const date = session.exam_date.slice(0, 10);
    const { startTime, endTime } = normalizeSessionTimes(session.start_time, session.end_time);

    let slotsMap = dateMap.get(date);
    if (!slotsMap) {
      slotsMap = new Map();
      dateMap.set(date, slotsMap);
    }

    const slotKey = `${startTime}__${endTime}`;
    if (!slotsMap.has(slotKey)) {
      slotsMap.set(slotKey, { startTime, endTime });
    }
  }

  const resultMap = new Map<string, DayPeriodInfo[]>();

  for (const [date, slotsMap] of dateMap.entries()) {
    // Sort slots chronologically by start_time, then end_time
    const sortedSlots = Array.from(slotsMap.values()).sort((a, b) => {
      const [ah, am] = a.startTime.split(':').map(Number);
      const [bh, bm] = b.startTime.split(':').map(Number);
      const diffStart = (ah * 60 + (am || 0)) - (bh * 60 + (bm || 0));
      if (diffStart !== 0) return diffStart;

      const [aEh, aEm] = a.endTime.split(':').map(Number);
      const [bEh, bEm] = b.endTime.split(':').map(Number);
      return (aEh * 60 + (aEm || 0)) - (bEh * 60 + (bEm || 0));
    });

    const dayPeriods: DayPeriodInfo[] = sortedSlots.map((slot, index) => {
      const periodNum = index + 1;
      return {
        period: periodNum,
        exam_date: date,
        start_time: slot.startTime,
        end_time: slot.endTime,
        label: `Period ${periodNum}`,
        time_range: `${slot.startTime} – ${slot.endTime}`,
        slot_key: `${date}__${slot.startTime}__${slot.endTime}`,
      };
    });

    resultMap.set(date, dayPeriods);
  }

  dayPeriodsCache.set(sessions, resultMap);
  return resultMap;
}

/**
 * Returns the exact unique period index (1, 2, 3...) for a given exam session on its day.
 * If dayPeriodsMap or allSessions is provided, calculates based on the day's unique periods.
 * If omitted or empty, falls back to the static getPeriodFromTime calculation.
 */
export function getSessionPeriod<T extends { exam_date: string; start_time: string; end_time?: string | null }>(
  session: T,
  allSessions?: T[],
  precomputedDayMap?: Map<string, DayPeriodInfo[]>
): number {
  if (!session) return 1;

  if (typeof session === 'object' && sessionPeriodCache.has(session) && !precomputedDayMap) {
    return sessionPeriodCache.get(session)!;
  }

  const dayMap = precomputedDayMap || (allSessions && allSessions.length > 0 ? getDayUniquePeriods(allSessions) : null);

  if (dayMap) {
    const date = session.exam_date?.slice(0, 10);
    const dayPeriods = date ? dayMap.get(date) : undefined;

    if (dayPeriods && dayPeriods.length > 0) {
      const { startTime, endTime } = normalizeSessionTimes(session.start_time, session.end_time);

      // Exact match on start and end
      const exact = dayPeriods.find(p => p.start_time === startTime && p.end_time === endTime);
      if (exact) {
        if (typeof session === 'object') sessionPeriodCache.set(session, exact.period);
        return exact.period;
      }

      // Match on start time
      const matchStart = dayPeriods.find(p => p.start_time === startTime);
      if (matchStart) {
        if (typeof session === 'object') sessionPeriodCache.set(session, matchStart.period);
        return matchStart.period;
      }

      // Match on overlapping time interval
      const overlapping = dayPeriods.find(p => timesOverlap(p.start_time, p.end_time, startTime, endTime));
      if (overlapping) {
        if (typeof session === 'object') sessionPeriodCache.set(session, overlapping.period);
        return overlapping.period;
      }
    }
  }

  // Fallback to time-based period
  const fallback = fallbackGetPeriodFromTime(session.start_time);
  if (typeof session === 'object') sessionPeriodCache.set(session, fallback);
  return fallback;
}

/**
 * Validates whether two sessions are in the SAME period of the day.
 * They are in the same period if:
 * 1. They are on the exact same exam_date
 * 2. AND either:
 *    - Their normalized start times are identical
 *    - Their scheduled time intervals overlap strictly
 *    - They share the exact same day period index (1, 2, 3...)
 */
export function areSessionsInSamePeriod<T extends { exam_date: string; start_time: string; end_time?: string | null }>(
  s1: T,
  s2: T,
  allSessions?: T[],
  precomputedDayMap?: Map<string, DayPeriodInfo[]>
): boolean {
  if (!s1 || !s2) return false;
  if (s1 === s2) return true;

  const d1 = s1.exam_date?.slice(0, 10);
  const d2 = s2.exam_date?.slice(0, 10);
  if (d1 !== d2) return false;

  // Quick check: exact same start time on the same date = definitely same period!
  if (s1.start_time && s2.start_time && s1.start_time === s2.start_time) return true;

  const t1 = normalizeSessionTimes(s1.start_time, s1.end_time);
  const t2 = normalizeSessionTimes(s2.start_time, s2.end_time);

  if (t1.startTime === t2.startTime) return true;
  if (timesOverlap(t1.startTime, t1.endTime, t2.startTime, t2.endTime)) return true;

  if (precomputedDayMap || (allSessions && allSessions.length > 0)) {
    const p1 = getSessionPeriod(s1, allSessions, precomputedDayMap);
    const p2 = getSessionPeriod(s2, allSessions, precomputedDayMap);
    if (p1 === p2) return true;
  }

  return false;
}

/**
 * Fallback static time-bucket calculation if no schedule context is available.
 */
export function fallbackGetPeriodFromTime(startTime: string): number {
  if (!startTime) return 1;
  try {
    const normalized = normalizeTimeString(startTime);
    const [hours, minutes] = normalized.split(':').map(Number);
    const totalMinutes = (hours || 0) * 60 + (minutes || 0);

    if (totalMinutes < 11 * 60 + 15) return 1;
    if (totalMinutes < 13 * 60 + 45) return 2;
    if (totalMinutes < 16 * 60 + 15) return 3;
    return 4;
  } catch {
    return 1;
  }
}
