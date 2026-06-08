'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Plus, Upload, Download, Trash2 } from 'lucide-react';
import { supabase, isSupabaseConfigured, getSupabaseConfigStatus } from '@/lib/supabase/client';
import type { Room, RoomFormData } from '@/types/database.types';
import { RoomTable } from '@/components/rooms/room-table';
import { RoomModal } from '@/components/rooms/room-modal';
import { RoomCSVImportModal } from '@/components/rooms/csv-import-modal';
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal';
import { SetupRequired } from '@/components/setup-required';
import { exportRoomsToExcel, downloadFile } from '@/lib/utils/csv-helpers';

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const configStatus = getSupabaseConfigStatus();

  useEffect(() => {
    if (isSupabaseConfigured()) {
      loadRooms(true);
    } else {
      setIsLoading(false);
    }
  }, []);

  if (!configStatus.configured) {
    return <SetupRequired configStatus={configStatus} />;
  }

  const loadRooms = async (showLoader = false) => {
    if (!supabase) return;
    if (showLoader) setIsLoading(true);
    try {
      const { data, error } = await supabase.from('rooms').select('*').order('room_name');
      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      console.error('Error loading rooms:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRoom = async (data: RoomFormData) => {
    if (!supabase) return;
    setIsSaving(true); try { await fetch('/api/history/snapshot', { method: 'POST' }); } catch(e) {}
    try {
      const { error } = await supabase.from('rooms').insert([{ ...data, is_active: true }]);
      if (error) throw error;
      setIsAddModalOpen(false);
      loadRooms();
    } catch (error: any) {
      console.error('Error adding room:', error);
      alert(error.message || 'Failed to add room');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditRoom = async (data: RoomFormData) => {
    if (!supabase || !selectedRoom) return;
    setIsSaving(true); try { await fetch('/api/history/snapshot', { method: 'POST' }); } catch(e) {}
    try {
      const { error } = await supabase.from('rooms').update(data).eq('id', selectedRoom.id);
      if (error) throw error;
      setIsEditModalOpen(false);
      setSelectedRoom(null);
      loadRooms();
    } catch (error: any) {
      console.error('Error updating room:', error);
      alert(error.message || 'Failed to update room');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!supabase || !selectedRoom) return;
    setIsSaving(true); try { await fetch('/api/history/snapshot', { method: 'POST' }); } catch(e) {}
    try {
      const { error } = await supabase.from('rooms').delete().eq('id', selectedRoom.id);
      if (error) throw error;
      setIsDeleteModalOpen(false);
      setSelectedRoom(null);
      loadRooms();
    } catch (error: any) {
      console.error('Error deleting room:', error);
      alert(error.message || 'Failed to delete room');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImportRooms = async (data: RoomFormData[]) => {
    if (!supabase) return;
    setIsSaving(true); try { await fetch('/api/history/snapshot', { method: 'POST' }); } catch(e) {}
    try {
      const roomsToInsert = data.map(r => ({ ...r, is_active: true }));
      const { error } = await supabase.from('rooms').insert(roomsToInsert);
      if (error) throw error;
      setIsImportModalOpen(false);
      loadRooms();
    } catch (error: any) {
      console.error('Error importing rooms:', error);
      alert(error.message || 'Failed to import rooms');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportExcel = () => {
    const blob = exportRoomsToExcel(rooms);
    downloadFile(blob, `rooms_export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleDeleteAll = async () => {
    if (!supabase) return;
    if (!confirm('Are you sure you want to DELETE ALL rooms? This action cannot be undone.')) return;
    setIsSaving(true); try { await fetch('/api/history/snapshot', { method: 'POST' }); } catch(e) {}
    try {
      const { error } = await supabase.from('rooms').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      alert('All rooms have been deleted');
      loadRooms();
    } catch (error: any) {
      console.error('Error deleting all rooms:', error);
      alert(error.message || 'Failed to delete all rooms');
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = (room: Room) => {
    setSelectedRoom(room);
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (room: Room) => {
    setSelectedRoom(room);
    setIsDeleteModalOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Room Management"
        description="Configure exam rooms with capacity and location details"
        actions={
          <div className="flex items-center gap-2">
            {/* Data group */}
            <div className="flex items-center rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden divide-x divide-gray-200">
              <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                <Upload className="w-3.5 h-3.5" />Import Excel
              </button>
              <button onClick={handleExportExcel} disabled={rooms.length === 0} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <Download className="w-3.5 h-3.5" />Export Excel
              </button>
            </div>
            {/* Danger action */}
            <button onClick={handleDeleteAll} title="Delete all rooms permanently" className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors shadow-sm">
              <Trash2 className="w-3.5 h-3.5" />Reset All
            </button>
            {/* Primary action */}
            <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-sm transition-colors">
              <Plus className="w-3.5 h-3.5" />Add Room
            </button>
          </div>
        }
      />

      <div className="card p-6">
        <RoomTable rooms={rooms} isLoading={isLoading} onEdit={openEditModal} onDelete={openDeleteModal} />
      </div>

      {/* Add Room Modal */}
      <RoomModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSubmit={handleAddRoom} isLoading={isSaving} />

      {/* Edit Room Modal */}
      <RoomModal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setSelectedRoom(null); }} room={selectedRoom} onSubmit={handleEditRoom} isLoading={isSaving} />

      {/* Delete Confirm Modal */}
      <DeleteConfirmModal isOpen={isDeleteModalOpen} onClose={() => { setIsDeleteModalOpen(false); setSelectedRoom(null); }} title="Delete Room" itemName={selectedRoom?.room_name || ''} description=" Any exam sessions using this room will need to be reassigned." onConfirm={handleDeleteRoom} isLoading={isSaving} />

      {/* CSV Import Modal */}
      <RoomCSVImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onImport={handleImportRooms} isLoading={isSaving} />
    </div>
  );
}

