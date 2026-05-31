'use client';

import { Room, parseRoomCode } from '@/types/database.types';
import { Loader2, Edit, Trash2, Building2, Users, HeartPulse, LayoutGrid, List } from 'lucide-react';
import { useMobileView } from '@/lib/hooks/use-mobile-view';

interface RoomTableProps {
  rooms: Room[];
  isLoading: boolean;
  onEdit: (room: Room) => void;
  onDelete: (room: Room) => void;
}

export function RoomTable({ rooms, isLoading, onEdit, onDelete }: RoomTableProps) {
  const { viewMode, toggleViewMode } = useMobileView();

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
    <div className="space-y-4">
      {/* Mobile View Toggle */}
      <div className="md:hidden flex justify-end mb-2">
        <button onClick={toggleViewMode} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
          {viewMode === 'standard' ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          {viewMode === 'standard' ? 'Compact View' : 'Standard View'}
        </button>
      </div>

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {rooms.map((room) => {
          const parsed = parseRoomCode(room.room_name);
          const nearPharmacy = room.is_near_pharmacy ?? parsed.is_near_pharmacy;

          if (viewMode === 'compact') {
            return (
              <div key={room.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 flex items-center gap-3">
                <Building2 className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-bold text-gray-900 text-sm truncate">{room.room_name}</span>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>Bld: {(room.building_code ?? parsed.building_code) || '?'}</span>
                    <span>•</span>
                    <span className="flex items-center gap-0.5"><Users className="w-3 h-3" /> {room.max_capacity}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`w-2 h-2 rounded-full ${room.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div className="flex gap-1">
                    <button onClick={() => onEdit(room)} className="p-1 text-primary-600 bg-primary-50 rounded"><Edit className="w-3 h-3" /></button>
                    <button onClick={() => onDelete(room)} className="p-1 text-red-600 bg-red-50 rounded"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={room.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                  <span className="font-bold text-gray-900 text-lg">{room.room_name}</span>
                </div>
                <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${room.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {room.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-y-2 text-sm px-1">
                <div className="text-gray-500">Building</div>
                <div className="font-medium text-gray-900 flex items-center gap-1">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px]">
                    {(room.building_code ?? parsed.building_code) || '?'}
                  </span>
                </div>
                <div className="text-gray-500">Floor</div>
                <div className="font-medium text-gray-900">{parsed.floor_number ? `Floor ${parsed.floor_number}` : (room.floor != null ? `Floor ${room.floor}` : '—')}</div>
                <div className="text-gray-500">Room #</div>
                <div className="font-medium text-gray-900">{parsed.room_number || '—'}</div>
                <div className="text-gray-500">Capacity</div>
                <div className="font-medium text-gray-900 flex items-center gap-1.5"><Users className="w-4 h-4 text-gray-400" />{room.max_capacity}</div>
                <div className="text-gray-500">Near Pharmacy</div>
                <div className="font-medium text-gray-900">
                  {nearPharmacy ? <span className="text-green-600 flex items-center gap-1"><HeartPulse className="w-3 h-3" /> Yes</span> : <span className="text-gray-400">No</span>}
                </div>
              </div>
              <div className="pt-3 mt-1 border-t border-gray-100 flex justify-end gap-2">
                <button onClick={() => onEdit(room)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors">
                  <Edit className="w-3.5 h-3.5" /> Edit
                </button>
                <button onClick={() => onDelete(room)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
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
    </div>
  );
}
