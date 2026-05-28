'use client';

import { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import type { Room } from '@/types/database.types';

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  rooms: Room[];
  onSubmit: (data: any) => Promise<void>;
  isLoading: boolean;
}

export function BulkEditModal({ isOpen, onClose, selectedIds, rooms, onSubmit, isLoading }: BulkEditModalProps) {
  const [fieldsToUpdate, setFieldsToUpdate] = useState<{ [key: string]: boolean }>({
    exam_date: false,
    start_time: false,
    end_time: false,
    room_id: false,
    program: false,
    exam_type: false,
  });

  const [formData, setFormData] = useState({
    exam_date: '',
    start_time: '',
    end_time: '',
    room_id: '',
    program: '',
    exam_type: '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const updateData: any = {};
    
    if (fieldsToUpdate.exam_date && formData.exam_date) updateData.exam_date = formData.exam_date;
    if (fieldsToUpdate.start_time && formData.start_time) updateData.start_time = formData.start_time;
    if (fieldsToUpdate.end_time) updateData.end_time = formData.end_time || null;
    if (fieldsToUpdate.room_id) updateData.room_id = formData.room_id === 'null' ? null : formData.room_id;
    if (fieldsToUpdate.program) updateData.program = formData.program;
    if (fieldsToUpdate.exam_type) updateData.exam_type = formData.exam_type;

    if (Object.keys(updateData).length === 0) {
      alert('Please select at least one field to update and provide a value.');
      return;
    }

    await onSubmit(updateData);
  };

  const handleCheckboxChange = (field: string) => {
    setFieldsToUpdate(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Bulk Edit Exams</h2>
            <p className="text-sm text-gray-500 mt-1">Updating {selectedIds.length} selected exams</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700">
              Select the fields you want to update for all selected exams. Fields left unchecked will remain unchanged.
            </p>
          </div>

          <div className="space-y-4">
            {/* Exam Date */}
            <div className="flex items-start gap-4">
              <div className="pt-2">
                <input type="checkbox" id="update_exam_date" checked={fieldsToUpdate.exam_date} onChange={() => handleCheckboxChange('exam_date')} className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500" />
              </div>
              <div className="flex-1">
                <label htmlFor="update_exam_date" className="block text-sm font-medium text-gray-700 mb-1 cursor-pointer">Update Exam Date</label>
                <input type="date" value={formData.exam_date} onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })} disabled={!fieldsToUpdate.exam_date} className="input-field disabled:bg-gray-50 disabled:text-gray-400" required={fieldsToUpdate.exam_date} />
              </div>
            </div>

            {/* Start Time */}
            <div className="flex items-start gap-4">
              <div className="pt-2">
                <input type="checkbox" id="update_start_time" checked={fieldsToUpdate.start_time} onChange={() => handleCheckboxChange('start_time')} className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500" />
              </div>
              <div className="flex-1">
                <label htmlFor="update_start_time" className="block text-sm font-medium text-gray-700 mb-1 cursor-pointer">Update Start Time</label>
                <input type="time" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} disabled={!fieldsToUpdate.start_time} className="input-field disabled:bg-gray-50 disabled:text-gray-400" required={fieldsToUpdate.start_time} />
              </div>
            </div>

            {/* End Time */}
            <div className="flex items-start gap-4">
              <div className="pt-2">
                <input type="checkbox" id="update_end_time" checked={fieldsToUpdate.end_time} onChange={() => handleCheckboxChange('end_time')} className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500" />
              </div>
              <div className="flex-1">
                <label htmlFor="update_end_time" className="block text-sm font-medium text-gray-700 mb-1 cursor-pointer">Update End Time</label>
                <input type="time" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} disabled={!fieldsToUpdate.end_time} className="input-field disabled:bg-gray-50 disabled:text-gray-400" />
              </div>
            </div>

            {/* Room */}
            <div className="flex items-start gap-4">
              <div className="pt-2">
                <input type="checkbox" id="update_room" checked={fieldsToUpdate.room_id} onChange={() => handleCheckboxChange('room_id')} className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500" />
              </div>
              <div className="flex-1">
                <label htmlFor="update_room" className="block text-sm font-medium text-gray-700 mb-1 cursor-pointer">Update Room/Place</label>
                <select value={formData.room_id} onChange={(e) => setFormData({ ...formData, room_id: e.target.value })} disabled={!fieldsToUpdate.room_id} className="input-field disabled:bg-gray-50 disabled:text-gray-400">
                  <option value="">Select a room (or leave empty to clear)</option>
                  <option value="null">-- Clear Room --</option>
                  {rooms.map(room => (
                    <option key={room.id} value={room.id}>{room.room_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Program */}
            <div className="flex items-start gap-4">
              <div className="pt-2">
                <input type="checkbox" id="update_program" checked={fieldsToUpdate.program} onChange={() => handleCheckboxChange('program')} className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500" />
              </div>
              <div className="flex-1">
                <label htmlFor="update_program" className="block text-sm font-medium text-gray-700 mb-1 cursor-pointer">Update Program</label>
                <input type="text" value={formData.program} onChange={(e) => setFormData({ ...formData, program: e.target.value })} disabled={!fieldsToUpdate.program} className="input-field disabled:bg-gray-50 disabled:text-gray-400" placeholder="e.g. Pharm D" />
              </div>
            </div>

            {/* Exam Type */}
            <div className="flex items-start gap-4">
              <div className="pt-2">
                <input type="checkbox" id="update_exam_type" checked={fieldsToUpdate.exam_type} onChange={() => handleCheckboxChange('exam_type')} className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500" />
              </div>
              <div className="flex-1">
                <label htmlFor="update_exam_type" className="block text-sm font-medium text-gray-700 mb-1 cursor-pointer">Update Exam Type</label>
                <select value={formData.exam_type} onChange={(e) => setFormData({ ...formData, exam_type: e.target.value })} disabled={!fieldsToUpdate.exam_type} className="input-field disabled:bg-gray-50 disabled:text-gray-400">
                  <option value="">Select exam type</option>
                  <option value="Midterm">Midterm</option>
                  <option value="Final">Final</option>
                  <option value="Practical">Practical</option>
                  <option value="Quiz">Quiz</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

          </div>
        </form>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} disabled={isLoading} className="btn btn-secondary px-6">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={isLoading || Object.values(fieldsToUpdate).every(v => !v)} className="btn btn-primary px-6">
            {isLoading ? (
              <span className="flex items-center"><span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />Updating...</span>
            ) : (
              <span className="flex items-center"><Save className="w-4 h-4 mr-2" />Update {selectedIds.length} Exams</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
