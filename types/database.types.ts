// Database types matching Supabase schema

export type JobTitle = 'Chemist' | 'Demonstrator' | 'Teaching Assistant' | 'Lecturer';
export type EmploymentStatus = 'Full-time' | 'Part-time';
export type AvailabilityStatus = 'Available' | 'On-Leave' | 'Unavailable';
export type AssignmentRole = 'Head_Supervisor' | 'Assistant' | 'Committees_Supervisor' | 'Exam_Supervisor' | 'Invigilator';
export type SupervisionRole = 'Invigilator' | 'Committees Supervisor' | 'Exam Supervisor' | 'Invigilator / Exam Supervisor';


export interface Staff {
  id: string;
  name: string;
  email: string;
  job_title: JobTitle;
  current_score: number;
  free_staff_score: number;
  employment_status: EmploymentStatus;
  availability_status: AvailabilityStatus;
  /** Recurring weekday availability, e.g. ['Saturday','Sunday','Monday'] */
  working_days: string[];
  /**
   * Specific calendar dates (ISO YYYY-MM-DD) on which this staff member is OFF,
   * regardless of their recurring working_days pattern.
   * Takes precedence over working_days during scheduling.
   * Used when a staff member has irregular off-days across a specific period.
   * These dates are STRICT off dates and cannot be overridden by Universal Working Days.
   */
  specific_off_dates: string[];
  /**
   * Specific calendar dates (ISO YYYY-MM-DD) on which this staff member is OFF,
   * but these CAN be overridden by Universal Working Days.
   */
  specific_standard_off_dates: string[];
  // Feeding mother support
  is_feeding_mother: boolean;
  feeding_mother_days: number; // 0 = N/A. FT: up to 4 days (1h off) or 2 days (2h off). PT: up to 2 days (1h) or 1 day (2h)
  // Health issue: prefers rooms in M or P buildings
  has_health_issue: boolean;
  // Overloaded condition support
  is_overloaded: boolean;
  overload_percentage: number; // 0-100%
  // The type of supervision role this staff member can serve
  supervision_role: SupervisionRole;
  can_supervise_oral: boolean;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  room_name: string;
  max_capacity: number;
  building: string | null;
  floor: number | null;
  is_active: boolean;
  // Auto-derived from room_name (DB computed columns)
  building_code?: string;      // First char, e.g. 'M', 'P', 'A'
  is_near_pharmacy?: boolean;  // True when building_code IN ('M','P')
  created_at: string;
}

/**
 * Parses a room name to extract building, floor and room number.
 * room_name format: [BuildingLetter][FloorDigit][RoomNN] e.g. "M210"
 *    building_code  = room_name[0]           → 'M'
 *    floor_number   = room_name[1]           → '2'
 *    room_number    = room_name[2..3]        → '10'
 *    is_near_pharmacy = building_code IN ['M','P']
 */
export function parseRoomCode(roomName: string): {
  building_code: string;
  floor_number: string;
  room_number: string;
  is_near_pharmacy: boolean;
} {
  let cleanName = roomName.replace(/\s+/g, '').toUpperCase();
  if (cleanName.startsWith('COMPUTERLAB')) {
    cleanName = cleanName.substring(11);
  }

  // match M1, M2 or a single alphabet letter followed by floor (1 digit) and room (2 digits)
  const match = cleanName.match(/^(M1|M2|[A-Z])(\d)(\d{2})/);
  
  if (match) {
    const building_code = match[1];
    const floor_number = match[2];
    const room_number = match[3];
    const is_near_pharmacy = building_code.startsWith('M') || building_code.startsWith('P');
    return { building_code, floor_number, room_number, is_near_pharmacy };
  }

  const upper = roomName.toUpperCase();
  const building_code = upper[0] || '';
  const floor_number = upper[1] || '';
  const room_number = upper.slice(2, 4) || '';
  const is_near_pharmacy = ['M', 'P'].includes(building_code);
  return { building_code, floor_number, room_number, is_near_pharmacy };
}

/**
 * Calculate feeding-mother weekly hour reduction
 * FT: may leave 2h early for 2 days OR 1h early for 4 days
 * PT: may leave 2h early for 1 day OR 1h early for 2 days
 */
export function getFeedingMotherMaxReduction(
  employmentStatus: EmploymentStatus
): { max_days_2h: number; max_days_1h: number } {
  if (employmentStatus === 'Full-time') {
    return { max_days_2h: 2, max_days_1h: 4 };
  }
  // Part-time
  return { max_days_2h: 1, max_days_1h: 2 };
}

export interface ExamSession {
  id: string;
  subject_name: string;
  exam_date: string;
  start_time: string;
  student_count: number;
  room_id: string;
  exam_type: string | null;
  program: string | null;
  end_time: string | null;
  student_start: string | null;
  student_end: string | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface Assignment {
  id: string;
  exam_session_id: string;
  staff_id: string;
  role: AssignmentRole;
  assigned_at: string;
  assigned_by: string | null;
  is_manual_override: boolean;
}

import {
  type DayPeriodInfo,
  getDayUniquePeriods,
  getSessionPeriod,
  areSessionsInSamePeriod,
  normalizeTimeString,
  normalizeSessionTimes,
  timesOverlap,
  fallbackGetPeriodFromTime,
} from '@/lib/utils/period-helpers';

export {
  type DayPeriodInfo,
  getDayUniquePeriods,
  getSessionPeriod,
  areSessionsInSamePeriod,
  normalizeTimeString,
  normalizeSessionTimes,
  timesOverlap,
};

/**
 * Calculates a period index (1, 2, 3, 4...) based on start time, or exact unique day periods if sessions context is given.
 */
export function getPeriodFromTime(
  startTime: string,
  endTime?: string | null,
  daySessions?: Array<{ exam_date: string; start_time: string; end_time?: string | null }>
): number {
  if (daySessions && daySessions.length > 0 && daySessions[0].exam_date) {
    return getSessionPeriod(
      { exam_date: daySessions[0].exam_date, start_time: startTime, end_time: endTime },
      daySessions
    );
  }
  return fallbackGetPeriodFromTime(startTime);
}

export function getDurationInMinutes(startTime: string, endTime?: string | null): number {
  if (!startTime || !endTime) return 120; // Default 2 hours for standard exam sessions
  try {
    const [h1, m1] = startTime.split(':').map(Number);
    const [h2, m2] = endTime.split(':').map(Number);
    const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    return diff > 0 ? diff : 120;
  } catch (e) {
    return 120;
  }
}

export interface SystemSettings {
  id: string;
  setting_key: string;
  setting_value: any;
  description: string | null;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string; // 'INSERT' | 'UPDATE' | 'DELETE' | 'AUTO_ASSIGN' | 'PERIOD_CHANGE'
  old_values?: any;
  new_values?: any;
  changed_by?: string | null;
  changed_by_email?: string | null;
  user_role?: string | null;
  summary?: string | null;
  changed_at: string;
}


// Extended types with relations
export interface ExamSessionWithRelations extends ExamSession {
  room?: Room;
  assignments?: AssignmentWithStaff[];
}

export interface AssignmentWithStaff extends Assignment {
  staff?: Staff;
}

export interface AssignmentWithSession extends Assignment {
  exam_session?: ExamSessionWithRelations;
  staff?: Staff;
}

export interface PeriodFreeStaff {
  id: string;
  exam_date: string;
  period: number;
  start_time: string;
  staff_id: string;
  role: 'Exam_Supervisor' | 'Assistant';
  created_at?: string;
  staff?: Staff;
}

export interface SwapRequest {
  id: string;
  exam_date: string;
  period: number;
  room_id: string;
  original_staff_id: string;
  replacement_staff_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  resolved_at?: string;
}

export interface SwapRequestWithRelations extends SwapRequest {
  room?: Room;
  original_staff?: Staff;
  replacement_staff?: Staff;
}

// Staffing ratio configuration
export interface StaffingRatioRange {
  min: number;
  max: number;
  head_supervisors: number;
  assistants: number;
}

export interface StaffingRatioOverride {
  date: string;
  ranges: StaffingRatioRange[];
}
export interface CalendarRule {
  id: string; // uuid
  start_date: string;
  end_date: string;
  description: string;
  is_universal_working_day: boolean;
  apply_staffing_ratios: boolean;
  staffing_ratios?: StaffingRatioRange[];
}

export type CalendarRulesConfig = CalendarRule[];
export interface StaffingRatiosConfig {
  ranges: StaffingRatioRange[];
  overrides?: StaffingRatioOverride[];
}

export interface WorkingHoursConfig {
  period_1: {
    start: string;
    end: string;
  };
  period_2: {
    start: string;
    end: string;
  };
  period_3: {
    start: string;
    end: string;
  };
}

export type StaffAvailabilityPolicy = 'respect_all_off_days' | 'cap_days_per_week' | 'smart_dates_priority';
export type OralAssignmentMode = 'combined' | 'separate' | 'skip';
export type ConsecutiveShiftPolicy = 'avoid' | 'strictly_prevent' | 'allow';

export interface SchedulingConstraintsConfig {
  allow_consecutive_shifts: boolean;
  consecutive_shifts_policy?: ConsecutiveShiftPolicy;
  max_hours_per_week_ft: number; // Default 16
  max_hours_per_week_pt: number; // Default 8
  max_hours_per_week_chemist?: number; // Default 20
  enforce_strict_roles: boolean; // Default true
  max_rooms_per_lecturer: number; // Default 3
  max_floors_per_supervisor?: number; // Default 2
  require_committees_supervisors?: boolean; // Default true
  reserve_supervisors_target?: number; // Default 3
  reserve_assistants_target?: number; // Default 3
  reserve_deprioritize_chemists_p2?: boolean; // Default true
  oral_exam_assignment_mode?: OralAssignmentMode; // Default 'combined'
  availability_policy?: StaffAvailabilityPolicy; // Unified 3-mode availability policy
  ignore_working_days_if_specific_dates?: boolean; // Legacy fallback flag
  max_score_delta_from_average?: number; // Default 3 (fairness delta / max score gap between highest and lowest peer in cohort)
  ignore_staff_working_days?: boolean; // Legacy fallback flag
  custom_days_per_week?: number; // Max days per week per staff member (1-6)
  max_days_per_week_pt?: number; // Max days per week for Part-time staff (Default 3, allowed 1-3)
  max_daily_shifts?: number; // Max daily room shifts / periods per staff member (Default 2)
  max_weekly_reserves?: number; // Max standby reserve duties per week per staff member (Default 2)
  prioritize_room_continuity?: boolean; // Default true (Keep supervisors in same room or building if no time gap between periods)
}

// Form types
export interface StaffFormData {
  name: string;
  email: string;
  job_title: JobTitle;
  employment_status: EmploymentStatus;
  availability_status: AvailabilityStatus;
  /** Recurring available weekdays */
  working_days: string[];
  /**
   * Specific calendar dates (ISO YYYY-MM-DD) on which this staff member is off.
   * Populated from Microsoft List "Off Days" import when the pattern is irregular.
   */
  specific_off_dates: string[];
  is_feeding_mother: boolean;
  feeding_mother_days: number;
  has_health_issue: boolean;
  is_overloaded: boolean;
  overload_percentage: number;
  supervision_role: SupervisionRole;
  can_supervise_oral: boolean;
}

export interface RoomFormData {
  room_name: string;
  max_capacity: number;
  building?: string;
  floor?: number;
}

export interface ExamSessionFormData {
  subject_name: string;
  exam_date: string;
  start_time: string;
  student_count: number;
  room_id: string;
  exam_type?: string;
  program?: string;
  end_time?: string;
  student_start?: string;
  student_end?: string;
}

// Assignment algorithm types
export interface AssignmentConstraintViolation {
  type: 'double_booking' | 'consecutive_shifts' | 'part_time_restriction' | 'unavailable' | 'capacity' | 'health_room' | 'feeding_mother_hours' | 'workload_cap';
  message: string;
  staff_id?: string;
  exam_session_id?: string;
}

export interface AssignmentResult {
  success: boolean;
  assignments: Assignment[];
  violations: AssignmentConstraintViolation[];
}

/**
 * Groups exam sessions sharing the same room + period + date.
 * Returns merged combined student counts for staffing ratio purposes.
 */
export interface RoomSessionGroup {
  room_id: string;
  exam_date: string;
  start_time: string;
  session_ids: string[];
  total_students: number;
  isOral?: boolean;
}

export type SemesterType = 'Fall' | 'Spring' | 'Summer' | 'Midterm' | 'Final' | 'Custom';
export type ScoreMode = 'continue' | 'fresh';

export interface ExamPeriodScoreSnapshot {
  staff_id: string;
  current_score: number;
  free_staff_score: number;
}

export interface ExamPeriod {
  id: string;
  name: string;
  semester_type: SemesterType;
  academic_year?: string | null;
  start_date: string; // ISO YYYY-MM-DD
  end_date: string;   // ISO YYYY-MM-DD
  is_active: boolean;
  score_mode: ScoreMode;
  score_snapshot?: ExamPeriodScoreSnapshot[];
  notes?: string | null;
  availability_policy?: StaffAvailabilityPolicy;
  oral_exam_assignment_mode?: OralAssignmentMode;
  reserve_supervisors_target?: number;
  reserve_assistants_target?: number;
  ignore_staff_working_days?: boolean;
  custom_days_per_week?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ExamPeriodBackup {
  id: string;
  period_id: string;
  period_name: string;
  week_start_date: string;
  week_label: string;
  backup_name: string;
  trigger_type: 'automatic' | 'manual';
  snapshot_data: {
    period: ExamPeriod;
    staff: Staff[];
    rooms: Room[];
    exams: ExamSession[];
    assignments: Assignment[];
    period_free_staff: PeriodFreeStaff[];
    system_settings?: SystemSettings[];
  };
  created_at: string;
}



