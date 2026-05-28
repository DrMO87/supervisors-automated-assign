import { format, startOfWeek, endOfWeek, eachDayOfInterval, addDays } from 'date-fns';

/**
 * Format date for display
 */
export function formatDate(date: Date | string, formatStr: string = 'PPP'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, formatStr);
}

/**
 * Get week range (Saturday to Friday — Egyptian university week)
 */
export function getWeekRange(date: Date): { start: Date; end: Date } {
  return {
    start: startOfWeek(date, { weekStartsOn: 6 }),
    end: endOfWeek(date, { weekStartsOn: 6 }),
  };
}

/**
 * Get all days in a week
 */
export function getWeekDays(date: Date): Date[] {
  const { start, end } = getWeekRange(date);
  return eachDayOfInterval({ start, end });
}

/**
 * Get next week
 */
export function getNextWeek(date: Date): Date {
  return addDays(date, 7);
}

/**
 * Get previous week
 */
export function getPreviousWeek(date: Date): Date {
  return addDays(date, -7);
}

/**
 * Convert date to ISO date string (YYYY-MM-DD)
 */
export function toISODateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  return toISODateString(d1) === toISODateString(d2);
}

