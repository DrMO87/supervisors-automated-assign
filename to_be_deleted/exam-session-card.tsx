'use client';

import { ExamSessionWithRelations } from '@/types/database.types';
import { Users, MapPin, Lock, AlertCircle, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Conflict, getConflictSummary } from '@/lib/utils/conflict-detection';
import type { Staff } from '@/types/database.types';

const isOffDay = (dateStr: string, staff?: Staff) => {
  if (!staff) return false;
  if (staff.specific_off_dates?.includes(dateStr)) return true;
  const dayOfWeek = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' });
  if (staff.working_days && !staff.working_days.includes(dayOfWeek)) return true;
  return false;
};

interface ExamSessionCardProps {
  session: ExamSessionWithRelations;
  onUpdate: () => void;
  conflicts?: Conflict[];
  onClick?: () => void;
}

export function ExamSessionCard({ session, onUpdate, conflicts = [], onClick }: ExamSessionCardProps) {
  const examSupervisor = session.assignments?.find(a => a.role === 'Exam_Supervisor');
  const commitSupervisor = session.assignments?.find(a => a.role === 'Committees_Supervisor');
  const headSupervisor = session.assignments?.find(a => a.role === 'Head_Supervisor');
  const assistants = session.assignments?.filter((a) => a.role === 'Assistant' || a.role === 'Invigilator') || [];

  const conflictSummary = getConflictSummary(conflicts);
  const hasConflict = conflicts.length > 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-md border p-3 text-sm transition-all hover:shadow-md cursor-pointer',
        session.is_locked
          ? 'bg-gray-100 border-gray-300'
          : hasConflict
            ? conflictSummary.hasErrors
              ? 'bg-red-50 border-red-300 hover:border-red-400'
              : 'bg-amber-50 border-amber-300 hover:border-amber-400'
            : 'bg-white border-gray-200 hover:border-primary-300'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 truncate">
            {session.subject_name}
          </h4>
        </div>
        <div className="flex items-center gap-1 ml-2">
          {session.is_locked && (
            <span title="Locked"><Lock className="w-3 h-3 text-gray-500" /></span>
          )}
          {conflictSummary.hasErrors && (
            <span title={`${conflictSummary.errorCount} error(s)`}><AlertCircle className="w-3 h-3 text-red-500" /></span>
          )}
          {conflictSummary.hasWarnings && !conflictSummary.hasErrors && (
            <span title={`${conflictSummary.warningCount} warning(s)`}><AlertTriangle className="w-3 h-3 text-amber-500" /></span>
          )}
        </div>
      </div>

      {/* Room and Student Count */}
      <div className="flex items-center gap-3 mb-2 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          <span>{session.room?.room_name || 'N/A'}</span>
        </div>
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          <span>{session.student_count}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{session.start_time}</span>
        </div>
      </div>

      {/* Conflict Indicators */}
      {hasConflict && (
        <div className="mb-2 space-y-0.5">
          {conflicts.slice(0, 2).map((conflict, i) => (
            <div
              key={i}
              className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                conflict.severity === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              )}
            >
              {conflict.message}
            </div>
          ))}
          {conflicts.length > 2 && (
            <div className="text-xs text-gray-500">+{conflicts.length - 2} more</div>
          )}
        </div>
      )}


      {/* Assignments */}
      <div className="space-y-1 mt-2">
        {examSupervisor && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">
              Exam
            </span>
            <span 
              className={cn(
                "text-xs truncate", 
                examSupervisor.is_manual_override && isOffDay(session.exam_date, examSupervisor.staff) 
                  ? "text-red-600 font-bold bg-red-50 px-1 rounded border border-red-200" 
                  : "text-gray-700"
              )}
              title={examSupervisor.is_manual_override && isOffDay(session.exam_date, examSupervisor.staff) ? "Manually assigned on off-day" : undefined}
            >
              {examSupervisor.staff?.name || 'Unknown'}
            </span>
          </div>
        )}

        {(commitSupervisor || headSupervisor) && (() => {
          const sup = commitSupervisor || headSupervisor;
          return sup ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary-100 text-primary-700">
                Comm Sprv
              </span>
              <span 
                className={cn(
                  "text-xs truncate", 
                  sup.is_manual_override && isOffDay(session.exam_date, sup.staff) 
                    ? "text-red-600 font-bold bg-red-50 px-1 rounded border border-red-200" 
                    : "text-gray-700"
                )}
                title={sup.is_manual_override && isOffDay(session.exam_date, sup.staff) ? "Manually assigned on off-day" : undefined}
              >
                {sup.staff?.name || 'Unknown'}
              </span>
            </div>
          ) : null;
        })()}

        {assistants.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-success-100 text-success-700">
              Invig
            </span>
            <div className="flex-1 min-w-0 space-y-0.5">
              {assistants.map((assistant) => (
                <div 
                  key={assistant.id} 
                  className={cn(
                    "text-xs truncate", 
                    assistant.is_manual_override && isOffDay(session.exam_date, assistant.staff) 
                      ? "inline-block text-red-600 font-bold bg-red-50 px-1 rounded border border-red-200" 
                      : "text-gray-700"
                  )}
                  title={assistant.is_manual_override && isOffDay(session.exam_date, assistant.staff) ? "Manually assigned on off-day" : undefined}
                >
                  {assistant.staff?.name || 'Unknown'}
                </div>
              ))}
            </div>
          </div>
        )}

        {!headSupervisor && assistants.length === 0 && (
          <div className="text-xs text-gray-400 italic">No assignments</div>
        )}
      </div>
    </div>
  );
}

