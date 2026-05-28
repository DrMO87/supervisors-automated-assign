'use client';

import { useDroppable } from '@dnd-kit/core';
import type { ExamSessionWithRelations } from '@/types/database.types';

interface Props {
  session: ExamSessionWithRelations;
  dayIndex: number;
  startRow: number;
  durationSlots: number;
  hasError: boolean;
  hasWarning: boolean;
  onClick: () => void;
}

export function DroppableSessionCard({
  session,
  dayIndex,
  startRow,
  durationSlots,
  hasError,
  hasWarning,
  onClick
}: Props) {
  const { isOver, setNodeRef } = useDroppable({
    id: `session-${session.id}`,
    data: { type: 'session', session },
  });

  const baseClasses = "relative m-1 p-2 rounded text-xs overflow-hidden cursor-pointer shadow-sm border transition-all duration-200";
  
  let stateClasses = 'bg-blue-50 border-blue-200 text-blue-700 hover:shadow-md';
  if (hasError) stateClasses = 'bg-red-50 border-red-200 text-red-700 hover:shadow-md';
  else if (hasWarning) stateClasses = 'bg-amber-50 border-amber-200 text-amber-900 hover:shadow-md';
  else if (session.is_locked) stateClasses = 'bg-gray-100 border-gray-300 text-gray-700 hover:shadow-md';

  if (isOver && !session.is_locked) {
    stateClasses += ' ring-2 ring-primary-500 bg-primary-50 scale-[1.02] z-20 shadow-lg';
  }

  return (
    <div
      ref={session.is_locked ? undefined : setNodeRef}
      className={`${baseClasses} ${stateClasses}`}
      style={{
        gridColumn: dayIndex + 2,
        gridRow: `${startRow} / span ${durationSlots}`,
        zIndex: isOver ? 20 : 5
      }}
      onClick={onClick}
    >
      <div className="font-bold truncate">{session.subject_name}</div>
      <div className="truncate text-[10px]">{session.start_time}</div>
      {session.room && <div className="truncate text-[10px] opacity-75">{session.room.room_name}</div>}
      {isOver && !session.is_locked && (
        <div className="absolute inset-0 bg-primary-100/50 flex items-center justify-center font-bold text-primary-700 rounded border-2 border-dashed border-primary-400">
          Drop to assign
        </div>
      )}
    </div>
  );
}
