'use client';

import { Room, parseRoomCode } from '@/types/database.types';
import { Loader2, Edit, Trash2, Building2, Users, HeartPulse } from 'lucide-react';

interface RoomTableProps {
  rooms: Room[];
  isLoading: boolean;
  onEdit: (room: Room) => void;
  onDelete: (room: Room) => void;
}

export function RoomTable({ rooms, isLoading, onEdit, onDelete }: RoomTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Loading rooms...</span>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No rooms yet</h3>
        <p className="text-gray-500">Add rooms to configure exam venues.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room Name</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Building</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Floor</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room #</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capacity</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Near Pharmacy</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {rooms.map((room) => {
            // Parse room code from room_name (e.g. "M210" → building=M, floor=2, room=10)
            const parsed = parseRoomCode(room.room_name);
            const nearPharmacy = room.is_near_pharmacy ?? parsed.is_near_pharmacy;

            return (
              <tr key={room.id} className="hover:bg-gray-50">
                {/* Room Name */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="font-semibold text-gray-900">{room.room_name}</span>
                  </div>
                </td>

                {/* Building code */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm">
                    {(room.building_code ?? parsed.building_code) || '?'}
                  </span>
                </td>

                {/* Floor */}
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                  {parsed.floor_number ? `Floor ${parsed.floor_number}` : (room.floor != null ? `Floor ${room.floor}` : '—')}
                </td>

                {/* Room Number */}
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                  {parsed.room_number || '—'}
                </td>

                {/* Capacity */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1 text-gray-600">
                    <Users className="w-4 h-4" />
                    {room.max_capacity}
                  </div>
                </td>

                {/* Near Pharmacy */}
                <td className="px-4 py-3 whitespace-nowrap">
                  {nearPharmacy ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                      <HeartPulse className="w-3 h-3" /> Yes (M/P)
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">No</span>
                  )}
                </td>

                {/* Status */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${room.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {room.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-4 py-3 whitespace-nowrap text-right">
                  <button onClick={() => onEdit(room)} className="text-primary-600 hover:text-primary-900 mr-3" title="Edit room">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => onDelete(room)} className="text-red-600 hover:text-red-900" title="Delete room">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
