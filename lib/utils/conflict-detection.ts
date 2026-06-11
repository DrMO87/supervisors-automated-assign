import type { ExamSessionWithRelations, AssignmentWithStaff, Staff, StaffingRatiosConfig, PeriodFreeStaff, CalendarRule } from '@/types/database.types';
import { getPeriodFromTime } from '@/types/database.types';
import { calculateRequiredStaff } from '@/lib/algorithms/auto-assignment';

export interface Conflict {
  type: 'understaffed' | 'double_booking' | 'consecutive_shift' | 'unavailable' | 'overloaded';
  severity: 'error' | 'warning';
  message: string;
  sessionId: string;
  staffId?: string;
}

/**
 * Detect conflicts for a single exam session
 */
export function detectSessionConflicts(
  session: ExamSessionWithRelations,
  allSessions: ExamSessionWithRelations[],
  staffingRatios: StaffingRatiosConfig,
  allowConsecutiveShifts: boolean = false,
  periodFreeStaff: PeriodFreeStaff[] = [],
  calendarRules: CalendarRule[] = []
): Conflict[] {
  const conflicts: Conflict[] = [];
  const assignments = session.assignments || [];

  // Only check staffing levels if the session has already been processed
  // (has at least one assignment). Unprocessed/fresh sessions should not
  // show understaffed conflicts — they simply haven't been assigned yet.
  if (assignments.length > 0) {
    const isOral = !!session.exam_type?.toLowerCase().includes('oral');
    const required = calculateRequiredStaff(session.student_count, staffingRatios, isOral, session.exam_date, calendarRules);
    const examSupervisorsCount = assignments.filter(a => a.role === 'Exam_Supervisor').length;
    const committeesSupervisorsCount = assignments.filter(a => a.role === 'Head_Supervisor' || a.role === 'Committees_Supervisor').length;
    const assistantCount = assignments.filter(a => a.role === 'Assistant' || a.role === 'Invigilator').length;

    if (!isOral && examSupervisorsCount < 1) {
      conflicts.push({
        type: 'understaffed',
        severity: 'error',
        message: 'Missing 1 Exam Supervisor(s)',
        sessionId: session.id,
      });
    }

    if (!isOral && committeesSupervisorsCount < required.headSupervisors) {
      conflicts.push({
        type: 'understaffed',
        severity: 'error',
        message: `Missing ${required.headSupervisors - committeesSupervisorsCount} Committees Supervisor(s)`,
        sessionId: session.id,
      });
    }

    if (assistantCount < required.assistants) {
      conflicts.push({
        type: 'understaffed',
        severity: 'warning',
        message: `Missing ${required.assistants - assistantCount} Invigilator(s)`,
        sessionId: session.id,
      });
    }
  }

  // Check for staff-specific conflicts
  assignments.forEach(assignment => {
    if (!assignment.staff) return;
    const staff = assignment.staff;

    // Check for double booking (same date and period in different sessions)
    const otherSessions = allSessions.filter(
      s => s.id !== session.id && s.exam_date === session.exam_date && getPeriodFromTime(s.start_time) === getPeriodFromTime(session.start_time)
    );
    
    for (const otherSession of otherSessions) {
      // Find if this staff is assigned to the other session
      const assignmentInOther = otherSession.assignments?.find(a => a.staff_id === staff.id);
      
      if (assignmentInOther) {
        const isDifferentRoom = otherSession.room_id !== session.room_id;
        const isCommitteesSupervisor = staff.supervision_role === 'Committees Supervisor';
        
        if (!isCommitteesSupervisor && isDifferentRoom) {
          conflicts.push({
            type: 'double_booking',
            severity: 'error',
            message: `${staff.name} is assigned to multiple rooms at the same time`,
            sessionId: session.id,
            staffId: staff.id,
          });
        }
      }
    }

    // Check if staff is already a reserve for this exact period
    const isReserve = periodFreeStaff.some(
      r => r.staff_id === staff.id && r.exam_date === session.exam_date && r.period === getPeriodFromTime(session.start_time)
    );
    if (isReserve) {
      conflicts.push({
        type: 'double_booking',
        severity: 'error',
        message: `${staff.name} is already assigned as a Reserve for this period`,
        sessionId: session.id,
        staffId: staff.id,
      });
    }

    // Check for consecutive shifts (same day, different periods)
    const sameDaySessions = allSessions.filter(
      s => s.id !== session.id && s.exam_date === session.exam_date && getPeriodFromTime(s.start_time) !== getPeriodFromTime(session.start_time)
    );
    
    const hasConsecutiveShift = sameDaySessions.some(otherSession => {
      // Is same staff in the other session, AND is the period exactly adjacent?
      if (!otherSession.assignments?.some(a => a.staff_id === staff.id)) return false;
      return Math.abs(getPeriodFromTime(otherSession.start_time) - getPeriodFromTime(session.start_time)) === 1;
    });

    if (hasConsecutiveShift && !allowConsecutiveShifts) {
      conflicts.push({
        type: 'consecutive_shift',
        severity: 'warning',
        message: `${staff.name} has consecutive shifts on this day`,
        sessionId: session.id,
        staffId: staff.id,
      });
    }


    // Check staff availability
    if (staff.availability_status !== 'Available') {
      conflicts.push({
        type: 'unavailable',
        severity: 'error',
        message: `${staff.name} is ${staff.availability_status}`,
        sessionId: session.id,
        staffId: staff.id,
      });
    }

    // Check weekly workload limit based on working_days length
    const totalSessionAssignments = allSessions.filter(s => s.assignments?.some(a => a.staff_id === staff.id)).length;
    const totalReserveAssignments = periodFreeStaff.filter(r => r.staff_id === staff.id).length;
    const totalAssignments = totalSessionAssignments + totalReserveAssignments;
    const workingDaysCount = staff.working_days?.length || 6; // default 6 days if undefined

    if (totalAssignments > workingDaysCount) {
      // Find if this specific assignment is an 'extra' one, but typically we just warn on all their assignments
      // so the user sees they are overloaded overall in the week.
      conflicts.push({
        type: 'overloaded',
        severity: 'warning',
        message: `${staff.name} is assigned ${totalAssignments} times this week, but only has ${workingDaysCount} working days`,
        sessionId: session.id,
        staffId: staff.id,
      });
    }
  });

  return conflicts;
}

/**
 * Detect all conflicts across all sessions
 */
export function detectAllConflicts(
  sessions: ExamSessionWithRelations[],
  staffingRatios: StaffingRatiosConfig,
  allowConsecutiveShifts: boolean = false,
  periodFreeStaff: PeriodFreeStaff[] = [],
  calendarRules: CalendarRule[] = []
): Map<string, Conflict[]> {
  const conflictMap = new Map<string, Conflict[]>();
  
  sessions.forEach(session => {
    const conflicts = detectSessionConflicts(session, sessions, staffingRatios, allowConsecutiveShifts, periodFreeStaff, calendarRules);
    if (conflicts.length > 0) {
      conflictMap.set(session.id, conflicts);
    }
  });

  return conflictMap;
}



/**
 * Get conflict summary for a session
 */
export function getConflictSummary(conflicts: Conflict[]): { hasErrors: boolean; hasWarnings: boolean; errorCount: number; warningCount: number } {
  const errors = conflicts.filter(c => c.severity === 'error');
  const warnings = conflicts.filter(c => c.severity === 'warning');
  return {
    hasErrors: errors.length > 0,
    hasWarnings: warnings.length > 0,
    errorCount: errors.length,
    warningCount: warnings.length,
  };
}

