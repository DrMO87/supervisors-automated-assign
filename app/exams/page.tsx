'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Plus, Upload, Download, Trash2, Edit3 } from 'lucide-react';
import { supabase, isSupabaseConfigured, getSupabaseConfigStatus } from '@/lib/supabase/client';
import type { ExamSessionWithRelations, ExamSessionFormData, Room } from '@/types/database.types';
import { ExamTable } from '@/components/exams/exam-table';
import { ExamModal } from '@/components/exams/exam-modal';
import { ExamCSVImportModal } from '@/components/exams/csv-import-modal';
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal';
import { BulkEditModal } from '@/components/exams/bulk-edit-modal';
import { SetupRequired } from '@/components/setup-required';
import { exportExamsToExcel, downloadFile } from '@/lib/utils/csv-helpers';

export default function ExamsPage() {
  const [exams, setExams] = useState<ExamSessionWithRelations[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Selection state
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<ExamSessionWithRelations | null>(null);

  const configStatus = getSupabaseConfigStatus();

  useEffect(() => {
    if (isSupabaseConfigured()) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, []);

  if (!configStatus.configured) {
    return <SetupRequired configStatus={configStatus} />;
  }

  const loadData = async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const [examsRes, roomsRes] = await Promise.all([
        supabase.from('exam_sessions').select('*, room:rooms(*)').order('exam_date').order('start_time'),
        supabase.from('rooms').select('*').eq('is_active', true).order('room_name'),
      ]);
      if (examsRes.error) throw examsRes.error;
      if (roomsRes.error) throw roomsRes.error;
      setExams(examsRes.data || []);
      setRooms(roomsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddExam = async (data: ExamSessionFormData) => {
    if (!supabase) return;
    setIsSaving(true); try { await fetch('/api/history/snapshot', { method: 'POST' }); } catch(e) {}
    try {
      const { error } = await supabase.from('exam_sessions').insert([{ ...data, is_locked: false }]);
      if (error) throw error;
      setIsAddModalOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error adding exam:', error);
      alert(error.message || 'Failed to add exam session');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditExam = async (data: ExamSessionFormData) => {
    if (!supabase || !selectedExam) return;
    setIsSaving(true); try { await fetch('/api/history/snapshot', { method: 'POST' }); } catch(e) {}
    try {
      const { error } = await supabase.from('exam_sessions').update(data).eq('id', selectedExam.id);
      if (error) throw error;
      setIsEditModalOpen(false);
      setSelectedExam(null);
      loadData();
    } catch (error: any) {
      console.error('Error updating exam:', error);
      alert(error.message || 'Failed to update exam session');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteExam = async () => {
    if (!supabase || !selectedExam) return;
    setIsSaving(true); try { await fetch('/api/history/snapshot', { method: 'POST' }); } catch(e) {}
    try {
      const { error } = await supabase.from('exam_sessions').delete().eq('id', selectedExam.id);
      if (error) throw error;
      setIsDeleteModalOpen(false);
      setSelectedExam(null);
      // Remove from selected list if deleted
      setSelectedExamIds(prev => prev.filter(id => id !== selectedExam.id));
      loadData();
    } catch (error: any) {
      console.error('Error deleting exam:', error);
      alert(error.message || 'Failed to delete exam session');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkEdit = async (updateData: any) => {
    if (!supabase || selectedExamIds.length === 0) return;
    setIsSaving(true); try { await fetch('/api/history/snapshot', { method: 'POST' }); } catch(e) {}
    try {
      const { error } = await supabase.from('exam_sessions').update(updateData).in('id', selectedExamIds);
      if (error) throw error;
      setIsBulkEditModalOpen(false);
      setSelectedExamIds([]); // Clear selection after successful edit
      loadData();
    } catch (error: any) {
      console.error('Error in bulk update:', error);
      alert(error.message || 'Failed to apply bulk update');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!supabase || selectedExamIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedExamIds.length} selected exams?`)) return;
    setIsSaving(true); try { await fetch('/api/history/snapshot', { method: 'POST' }); } catch(e) {}
    try {
      const { error } = await supabase.from('exam_sessions').delete().in('id', selectedExamIds);
      if (error) throw error;
      setSelectedExamIds([]);
      loadData();
    } catch (error: any) {
      console.error('Error in bulk delete:', error);
      alert(error.message || 'Failed to delete selected exams');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleLock = async (exam: ExamSessionWithRelations) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from('exam_sessions').update({ is_locked: !exam.is_locked }).eq('id', exam.id);
      if (error) throw error;
      
      // If locking, remove from selected
      if (!exam.is_locked) {
        setSelectedExamIds(prev => prev.filter(id => id !== exam.id));
      }
      
      loadData();
    } catch (error: any) {
      console.error('Error toggling lock:', error);
      alert(error.message || 'Failed to toggle lock status');
    }
  };

  const handleImportExams = async (data: ExamSessionFormData[]) => {
    if (!supabase) return;
    setIsSaving(true); try { await fetch('/api/history/snapshot', { method: 'POST' }); } catch(e) {}
    try {
      const examsToInsert = data.map(e => ({ ...e, is_locked: false }));
      const { error } = await supabase.from('exam_sessions').insert(examsToInsert);
      if (error) throw error;
      setIsImportModalOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error importing exams:', error);
      alert(error.message || 'Failed to import exams');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportExcel = () => {
    const blob = exportExamsToExcel(exams);
    downloadFile(blob, `exams_export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleDeleteAll = async () => {
    if (!supabase) return;
    if (!confirm('Are you sure you want to DELETE ALL exam sessions? This action cannot be undone and will delete all assignments.')) return;
    setIsSaving(true); try { await fetch('/api/history/snapshot', { method: 'POST' }); } catch(e) {}
    try {
      const { error } = await supabase.from('exam_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      alert('All exam sessions have been deleted');
      setSelectedExamIds([]);
      loadData();
    } catch (error: any) {
      console.error('Error deleting all exams:', error);
      alert(error.message || 'Failed to delete all exams');
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = (exam: ExamSessionWithRelations) => {
    if (exam.is_locked) {
      alert('Cannot edit a locked session. Unlock it first.');
      return;
    }
    setSelectedExam(exam);
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (exam: ExamSessionWithRelations) => {
    if (exam.is_locked) {
      alert('Cannot delete a locked session. Unlock it first.');
      return;
    }
    setSelectedExam(exam);
    setIsDeleteModalOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Exam Sessions"
        description="Create and manage exam sessions with bulk import capabilities"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Selection actions */}
            {selectedExamIds.length > 0 && (
              <div className="flex items-center rounded-lg border border-indigo-200 bg-indigo-50 shadow-sm overflow-hidden divide-x divide-indigo-200">
                <button onClick={() => setIsBulkEditModalOpen(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors">
                  <Edit3 className="w-3.5 h-3.5" />Bulk Edit ({selectedExamIds.length})
                </button>
                <button onClick={handleBulkDelete} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />Delete ({selectedExamIds.length})
                </button>
              </div>
            )}
            {/* Data group */}
            <div className="flex items-center rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden divide-x divide-gray-200">
              <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                <Upload className="w-3.5 h-3.5" />Import Excel
              </button>
              <button onClick={handleExportExcel} disabled={exams.length === 0} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <Download className="w-3.5 h-3.5" />Export Excel
              </button>
            </div>
            {/* Danger */}
            <button onClick={handleDeleteAll} title="Delete all exam sessions" className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors shadow-sm">
              <Trash2 className="w-3.5 h-3.5" />Reset All
            </button>
            {/* Primary */}
            <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-sm transition-colors">
              <Plus className="w-3.5 h-3.5" />Add Exam
            </button>
          </div>
        }
      />

      <div className="card p-6">
        <ExamTable exams={exams} isLoading={isLoading} onEdit={openEditModal} onDelete={openDeleteModal} onToggleLock={handleToggleLock} selectedIds={selectedExamIds} onSelectionChange={setSelectedExamIds} />
      </div>

      {/* Add Exam Modal */}
      <ExamModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} rooms={rooms} onSubmit={handleAddExam} isLoading={isSaving} />

      {/* Edit Exam Modal */}
      <ExamModal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setSelectedExam(null); }} exam={selectedExam} rooms={rooms} onSubmit={handleEditExam} isLoading={isSaving} />

      {/* Delete Confirm Modal */}
      <DeleteConfirmModal isOpen={isDeleteModalOpen} onClose={() => { setIsDeleteModalOpen(false); setSelectedExam(null); }} title="Delete Exam Session" itemName={selectedExam?.subject_name || ''} description=" All assignments for this session will also be deleted." onConfirm={handleDeleteExam} isLoading={isSaving} />

      {/* Bulk Edit Modal */}
      <BulkEditModal isOpen={isBulkEditModalOpen} onClose={() => setIsBulkEditModalOpen(false)} selectedIds={selectedExamIds} rooms={rooms} onSubmit={handleBulkEdit} isLoading={isSaving} />

      {/* CSV Import Modal */}
      <ExamCSVImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} rooms={rooms} onImport={handleImportExams} isLoading={isSaving} />
    </div>
  );
}
