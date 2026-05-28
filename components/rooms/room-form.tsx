'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Room, RoomFormData } from '@/types/database.types';
import { Loader2 } from 'lucide-react';

const roomSchema = z.object({
  room_name: z.string().min(1, 'Room name is required'),
  max_capacity: z.coerce.number().min(1, 'Capacity must be at least 1').max(1000, 'Capacity too large'),
  building: z.string().optional(),
  floor: z.coerce.number().optional(),
});

interface RoomFormProps {
  room?: Room | null;
  onSubmit: (data: RoomFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function RoomForm({ room, onSubmit, onCancel, isLoading }: RoomFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RoomFormData>({
    resolver: zodResolver(roomSchema),
    defaultValues: room ? {
      room_name: room.room_name,
      max_capacity: room.max_capacity,
      building: room.building || '',
      floor: room.floor || undefined,
    } : {
      max_capacity: 30,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Room Name */}
      <div>
        <label className="label mb-1 block">Room Name *</label>
        <input
          type="text"
          {...register('room_name')}
          className="input w-full"
          placeholder="e.g., Hall A, Room 101"
        />
        {errors.room_name && (
          <p className="text-sm text-red-500 mt-1">{errors.room_name.message}</p>
        )}
      </div>

      {/* Max Capacity */}
      <div>
        <label className="label mb-1 block">Maximum Capacity *</label>
        <input
          type="number"
          {...register('max_capacity')}
          className="input w-full"
          placeholder="Number of students"
          min={1}
        />
        {errors.max_capacity && (
          <p className="text-sm text-red-500 mt-1">{errors.max_capacity.message}</p>
        )}
      </div>

      {/* Building */}
      <div>
        <label className="label mb-1 block">Building</label>
        <input
          type="text"
          {...register('building')}
          className="input w-full"
          placeholder="e.g., Main Building, Engineering Block"
        />
      </div>

      {/* Floor */}
      <div>
        <label className="label mb-1 block">Floor</label>
        <input
          type="number"
          {...register('floor')}
          className="input w-full"
          placeholder="Floor number"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary px-4 py-2"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary px-4 py-2"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            room ? 'Update Room' : 'Add Room'
          )}
        </button>
      </div>
    </form>
  );
}

