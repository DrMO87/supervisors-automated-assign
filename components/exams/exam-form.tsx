'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ExamSession, ExamSessionFormData, Room } from '@/types/database.types';
import { Loader2 } from 'lucide-react';

const examSchema = z.object({
  subject_name: z.string().min(1, 'Subject name is required'),
  exam_date: z.string().min(1, 'Exam date is required'),
  start_time: z.string().min(1, 'Start time is required'),
  student_count: z.coerce.number().min(1, 'Student count must be at least 1'),
  room_id: z.string().uuid('Please select a room'),
  exam_type: z.string().optional(),
  program: z.string().optional(),
  end_time: z.string().optional(),
  student_start: z.string().optional(),
  student_end: z.string().optional(),
});

interface ExamFormProps {
  exam?: ExamSession | null;
  rooms: Room[];
  onSubmit: (data: ExamSessionFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ExamForm({ exam, rooms, onSubmit, onCancel, isLoading }: ExamFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExamSessionFormData>({
    resolver: zodResolver(examSchema),
    defaultValues: exam ? {
      subject_name: exam.subject_name,
      exam_date: exam.exam_date,
      start_time: exam.start_time,
      student_count: exam.student_count,
      room_id: exam.room_id,
      exam_type: exam.exam_type || '',
      program: exam.program || '',
      end_time: exam.end_time || '',
      student_start: exam.student_start || '',
      student_end: exam.student_end || '',
    } : {
      start_time: '09:00',
      exam_type: '',
      program: '',
      end_time: '',
      student_start: '',
      student_end: '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Subject Name */}
        <div className="col-span-2">
          <label className="label mb-1 block">Subject Name *</label>
          <input type="text" {...register('subject_name')} className="input w-full" placeholder="e.g., Introduction to Computing" />
          {errors.subject_name && <p className="text-sm text-red-500 mt-1">{errors.subject_name.message}</p>}
        </div>

        {/* Room */}
        <div>
          <label className="label mb-1 block">Room *</label>
          <select {...register('room_id')} className="input w-full">
            <option value="">Select a room</option>
            {rooms.filter(r => r.is_active).map(room => (
              <option key={room.id} value={room.id}>{room.room_name} ({room.max_capacity} seats)</option>
            ))}
          </select>
          {errors.room_id && <p className="text-sm text-red-500 mt-1">{errors.room_id.message}</p>}
        </div>

        {/* Exam Date */}
        <div>
          <label className="label mb-1 block">Exam Date *</label>
          <input type="date" {...register('exam_date')} className="input w-full" />
          {errors.exam_date && <p className="text-sm text-red-500 mt-1">{errors.exam_date.message}</p>}
        </div>

        {/* Exam Type */}
        <div>
          <label className="label mb-1 block">Exam Type</label>
          <input type="text" {...register('exam_type')} className="input w-full" placeholder="e.g. Midterm, Final" />
        </div>

        {/* Program */}
        <div>
          <label className="label mb-1 block">Program</label>
          <select {...register('program')} className="input w-full">
            <option value="">-- None --</option>
            <option value="PharmD">PharmD</option>
            <option value="PharmD Clinical">PharmD Clinical</option>
          </select>
        </div>

        {/* Start Time */}
        <div>
          <label className="label mb-1 block">Start Time (From) *</label>
          <input type="time" {...register('start_time')} className="input w-full" />
          {errors.start_time && <p className="text-sm text-red-500 mt-1">{errors.start_time.message}</p>}
        </div>

        {/* End Time */}
        <div>
          <label className="label mb-1 block">End Time (To)</label>
          <input type="time" {...register('end_time')} className="input w-full" />
        </div>

        {/* Student Count */}
        <div>
          <label className="label mb-1 block">Student Count *</label>
          <input type="number" {...register('student_count')} className="input w-full" min={1} />
          {errors.student_count && <p className="text-sm text-red-500 mt-1">{errors.student_count.message}</p>}
        </div>

        {/* Seat Range */}
        <div>
          <label className="label mb-1 block">Start Seat</label>
          <input type="text" {...register('student_start')} className="input w-full" placeholder="e.g. 1 or A1" />
        </div>
        <div className="col-start-2">
          <label className="label mb-1 block">End Seat</label>
          <input type="text" {...register('student_end')} className="input w-full" placeholder="e.g. 50 or A50" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button type="button" onClick={onCancel} className="btn btn-secondary px-4 py-2" disabled={isLoading}>Cancel</button>
        <button type="submit" className="btn btn-primary px-4 py-2" disabled={isLoading}>
          {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : (exam ? 'Update Exam' : 'Add Exam')}
        </button>
      </div>
    </form>
  );
}

