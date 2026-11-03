import type { ExamSessionWithRelations, AssignmentWithStaff, Staff, StaffingRatiosConfig, PeriodFreeStaff, CalendarRule, DayPeriodInfo } from '@/types/database.types';
import { getPeriodFromTime, getSessionPeriod, areSessionsInSamePeriod, timesOverlap, getDayUniquePeriods } from '@/types/database.types';
import { calculateRequiredStaff } from '@/lib/algorithms/auto-assignment';

export interface Conflict {
  type: 'understaffed' | 'double_booking' | 'consecutive_shift' | 'unavailable' | 'overloaded';
  severity: 'error' | 'warning';
  message: string;
  sessionId: string;
  staffId?: string;
}

export interface ConflictOptimizationContext {
  dayPeriodsMap: Map<string, DayPeriodInfo[]>;
  sessionPeriodMap: Map<string, number>;
  sessionsByDate: Map<string, ExamSessionWithRelations[]>;
  staffAssignedDates: Map<string, Set<string>>;
  staffAssignmentsByDate: Map<string, Array<{ session: ExamSessionWithRelations; assignment: AssignmentWithStaff }>>;
  reservesByStaffAndDate: Map<string, PeriodFreeStaff[]>;
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
  calendarRules: CalendarRule[] = [],
  optContext?: ConflictOptimizationContext
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

  const sessionDate = session.exam_date?.slice(0, 10);
  const sessionPeriod = optContext
    ? (optContext.sessionPeriodMap.get(session.id) ?? getSessionPeriod(session, allSessions, optContext.dayPeriodsMap))
    : getSessionPeriod(session, allSessions);

  // Check for staff-specific conflicts
  assignments.forEach(assignment => {
    if (!assignment.staff) return;
    const staff = assignment.staff;

    // Fast path: find other assignments for this staff member on the same date
    const staffDateKey = `${staff.id}__${sessionDate}`;
    const staffDayAssignments = optContext
      ? (optContext.staffAssignmentsByDate.get(staffDateKey) || [])
      : null;

    if (staffDayAssignments) {
      // O(1) checks using pre-indexed assignments for this staff on this day
      for (const other of staffDayAssignments) {
        if (other.session.id === session.id) continue;
        const otherSession = other.session;
        const assignmentInOther = other.assignment;

        const otherPeriod = optContext!.sessionPeriodMap.get(otherSession.id) ?? getSessionPeriod(otherSession, allSessions, optContext!.dayPeriodsMap);
        const inSamePeriod = (otherPeriod === sessionPeriod) || areSessionsInSamePeriod(session, otherSession, allSessions, optContext!.dayPeriodsMap);

        if (inSamePeriod) {
          const isSameRoom = Boolean(
            (session.room_id && otherSession.room_id && session.room_id === otherSession.room_id) ||
            (session.room?.room_name && otherSession.room?.room_name && 
             session.room.room_name.trim().toLowerCase() === otherSession.room.room_name.trim().toLowerCase()) ||
            ((session as any).room_name && (otherSession as any).room_name &&
             (session as any).room_name.trim().toLowerCase() === (otherSession as any).room_name.trim().toLowerCase())
          );

          if (!isSameRoom) {
            const isCommitteesSupervisor = 
              staff.supervision_role === 'Committees Supervisor' ||
              assignment.role === 'Committees_Supervisor' ||
              assignment.role === 'Head_Supervisor' ||
              assignmentInOther.role === 'Committees_Supervisor' ||
              assignmentInOther.role === 'Head_Supervisor';
            
            if (!isCommitteesSupervisor) {
              const roleLabel = (assignment.role === 'Exam_Supervisor' || staff.supervision_role === 'Exam Supervisor')
                ? 'Exam Supervisor'
                : 'Invigilator';
              conflicts.push({
                type: 'double_booking',
                severity: 'error',
                message: `${staff.name} (${roleLabel}) is assigned to multiple rooms in the same period`,
                sessionId: session.id,
                staffId: staff.id,
              });
            }
          }
        }
      }
    } else {
      // Fallback path when optContext is not provided
      const otherSessions = allSessions.filter(
        s => s.id !== session.id && s.exam_date === session.exam_date && areSessionsInSamePeriod(s, session, allSessions)
      );
      
      for (const otherSession of otherSessions) {
        const assignmentInOther = otherSession.assignments?.find(a => a.staff_id === staff.id);
        if (assignmentInOther) {
          const isSameRoom = Boolean(
            (session.room_id && otherSession.room_id && session.room_id === otherSession.room_id) ||
            (session.room?.room_name && otherSession.room?.room_name && 
             session.room.room_name.trim().toLowerCase() === otherSession.room.room_name.trim().toLowerCase()) ||
            ((session as any).room_name && (otherSession as any).room_name &&
             (session as any).room_name.trim().toLowerCase() === (otherSession as any).room_name.trim().toLowerCase())
          );

          if (!isSameRoom) {
            const isCommitteesSupervisor = 
              staff.supervision_role === 'Committees Supervisor' ||
              assignment.role === 'Committees_Supervisor' ||
              assignment.role === 'Head_Supervisor' ||
              assignmentInOther.role === 'Committees_Supervisor' ||
              assignmentInOther.role === 'Head_Supervisor';
            
            if (!isCommitteesSupervisor) {
              const roleLabel = (assignment.role === 'Exam_Supervisor' || staff.supervision_role === 'Exam Supervisor')
                ? 'Exam Supervisor'
                : 'Invigilator';
              conflicts.push({
                type: 'double_booking',
                severity: 'error',
                message: `${staff.name} (${roleLabel}) is assigned to multiple rooms in the same period`,
                sessionId: session.id,
                staffId: staff.id,
              });
            }
          }
        }
      }
    }

    // Check if staff is already a reserve for this exact period
    let isReserve = false;
    if (optContext) {
      const reservesForStaffToday = optContext.reservesByStaffAndDate.get(staffDateKey) || [];
      isReserve = reservesForStaffToday.some(
        r => r.period === sessionPeriod ||
             r.start_time === session.start_time ||
             timesOverlap(r.start_time, undefined, session.start_time, session.end_time)
      );
    } else {
      isReserve = periodFreeStaff.some(
        r => r.staff_id === staff.id && r.exam_date === session.exam_date && (
          r.period === sessionPeriod ||
          r.start_time === session.start_time ||
          timesOverlap(r.start_time, undefined, session.start_time, session.end_time)
        )
      );
    }

    if (isReserve) {
      conflicts.push({
        type: 'double_booking',
        severity: 'error',
        message: `${staff.name} is already assigned as a Reserve for this period`,
        sessionId: session.id,
        staffId: staff.id,
      });
    }

    // Check for consecutive shifts (same day, adjacent periods)
    if (!allowConsecutiveShifts) {
      let hasConsecutiveShift = false;
      if (staffDayAssignments) {
        hasConsecutiveShift = staffDayAssignments.some(other => {
          if (other.session.id === session.id) return false;
          const otherPeriod = optContext!.sessionPeriodMap.get(other.session.id) ?? getSessionPeriod(other.session, allSessions, optContext!.dayPeriodsMap);
          return Math.abs(otherPeriod - sessionPeriod) === 1;
        });
      } else {
        const sameDaySessions = allSessions.filter(
          s => s.id !== session.id && s.exam_date === session.exam_date && !areSessionsInSamePeriod(s, session, allSessions)
        );
        hasConsecutiveShift = sameDaySessions.some(otherSession => {
          if (!otherSession.assignments?.some(a => a.staff_id === staff.id)) return false;
          const otherPeriod = getSessionPeriod(otherSession, allSessions);
          return Math.abs(otherPeriod - sessionPeriod) === 1;
        });
      }

      if (hasConsecutiveShift) {
        conflicts.push({
          type: 'consecutive_shift',
          severity: 'warning',
          message: `${staff.name} has consecutive shifts on this day`,
          sessionId: session.id,
          staffId: staff.id,
        });
      }
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
    // We count UNIQUE days assigned, not total assignments
    let uniqueDaysCount = 0;
    if (optContext) {
      uniqueDaysCount = optContext.staffAssignedDates.get(staff.id)?.size || 0;
    } else {
      const assignedDates = new Set<string>();
      allSessions.forEach(s => {
        if (s.assignments?.some(a => a.staff_id === staff.id)) {
          assignedDates.add(s.exam_date);
        }
      });
      periodFreeStaff.forEach(r => {
        if (r.staff_id === staff.id) {
          assignedDates.add(r.exam_date);
        }
      });
      uniqueDaysCount = assignedDates.size;
    }

    const workingDaysCount = staff.working_days?.length || 6; // default 6 days if undefined

    if (uniqueDaysCount > workingDaysCount) {
      conflicts.push({
        type: 'overloaded',
        severity: 'warning',
        message: `${staff.name} is assigned on ${uniqueDaysCount} distinct days this week, but only has ${workingDaysCount} working days`,
        sessionId: session.id,
        staffId: staff.id,
      });
    }
  });

  return conflicts;
}

/**
 * Detect all conflicts across all sessions with O(N) indexing
 */
export function detectAllConflicts(
  sessions: ExamSessionWithRelations[],
  staffingRatios: StaffingRatiosConfig,
  allowConsecutiveShifts: boolean = false,
  periodFreeStaff: PeriodFreeStaff[] = [],
  calendarRules: CalendarRule[] = []
): Map<string, Conflict[]> {
  const conflictMap = new Map<string, Conflict[]>();
  if (!sessions || sessions.length === 0) return conflictMap;

  // Pre-compute lookup structures once for the entire batch
  const dayPeriodsMap = getDayUniquePeriods(sessions);
  const sessionPeriodMap = new Map<string, number>();
  const sessionsByDate = new Map<string, ExamSessionWithRelations[]>();
  const staffAssignedDates = new Map<string, Set<string>>();
  const staffAssignmentsByDate = new Map<string, Array<{ session: ExamSessionWithRelations; assignment: AssignmentWithStaff }>>();
  const reservesByStaffAndDate = new Map<string, PeriodFreeStaff[]>();

  for (const session of sessions) {
    const date = session.exam_date?.slice(0, 10);
    if (!date) continue;

    if (!sessionsByDate.has(date)) sessionsByDate.set(date, []);
    sessionsByDate.get(date)!.push(session);

    const period = getSessionPeriod(session, sessions, dayPeriodsMap);
    sessionPeriodMap.set(session.id, period);

    if (session.assignments) {
      for (const a of session.assignments) {
        if (a.staff_id) {
          // Track unique assigned dates
          let datesSet = staffAssignedDates.get(a.staff_id);
          if (!datesSet) {
            datesSet = new Set<string>();
            staffAssignedDates.set(a.staff_id, datesSet);
          }
          datesSet.add(date);

          // Track assignments by staff and date
          const staffDateKey = `${a.staff_id}__${date}`;
          let dayList = staffAssignmentsByDate.get(staffDateKey);
          if (!dayList) {
            dayList = [];
            staffAssignmentsByDate.set(staffDateKey, dayList);
          }
          dayList.push({ session, assignment: a });
        }
      }
    }
  }

  for (const r of periodFreeStaff) {
    const date = r.exam_date?.slice(0, 10);
    if (r.staff_id && date) {
      let datesSet = staffAssignedDates.get(r.staff_id);
      if (!datesSet) {
        datesSet = new Set<string>();
        staffAssignedDates.set(r.staff_id, datesSet);
      }
      datesSet.add(date);

      const staffDateKey = `${r.staff_id}__${date}`;
      let reserveList = reservesByStaffAndDate.get(staffDateKey);
      if (!reserveList) {
        reserveList = [];
        reservesByStaffAndDate.set(staffDateKey, reserveList);
      }
      reserveList.push(r);
    }
  }

  const optContext: ConflictOptimizationContext = {
    dayPeriodsMap,
    sessionPeriodMap,
    sessionsByDate,
    staffAssignedDates,
    staffAssignmentsByDate,
    reservesByStaffAndDate,
  };

  sessions.forEach(session => {
    const conflicts = detectSessionConflicts(
      session,
      sessions,
      staffingRatios,
      allowConsecutiveShifts,
      periodFreeStaff,
      calendarRules,
      optContext
    );
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
