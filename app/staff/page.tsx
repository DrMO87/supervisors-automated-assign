'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Plus, Upload, Download, RefreshCw, Trash2, CalendarDays, Edit } from 'lucide-react';
import { supabase, isSupabaseConfigured, getSupabaseConfigStatus } from '@/lib/supabase/client';
import type { Staff, StaffFormData } from '@/types/database.types';
import { classifyOffDays } from '@/lib/algorithms/auto-assignment';
import { StaffTable } from '@/components/staff/staff-table';
import { StaffModal } from '@/components/staff/staff-modal';
import { DeleteConfirmModal } from '@/components/staff/delete-confirm-modal';
import { CSVImportModal } from '@/components/staff/csv-import-modal';
import { SetupRequired } from '@/components/setup-required';
import { StaffBulkEditModal } from '@/components/staff/staff-bulk-edit-modal';
import { exportStaffToExcel, downloadFile } from '@/lib/utils/csv-helpers';

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [examDates, setExamDates] = useState<string[]>([]);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);

  const configStatus = getSupabaseConfigStatus();

  useEffect(() => {
    if (isSupabaseConfigured()) {
      loadStaff(true);
    } else {
      setIsLoading(false);
    }
  }, []);

  // Show setup required if Supabase is not configured
  if (!configStatus.configured) {
    return <SetupRequired configStatus={configStatus} />;
  }

  const loadStaff = async (showLoader = false) => {
    if (!supabase) return;
    if (showLoader) setIsLoading(true);
    try {
      const [staffRes, examsRes] = await Promise.all([
        supabase.from('staff').select('*').order('name').limit(10000),
        supabase.from('exam_sessions').select('exam_date').limit(10000)
      ]);
      if (staffRes.error) throw staffRes.error;
      if (examsRes.error) throw examsRes.error;

      setStaff(staffRes.data || []);
      const dates = Array.from(new Set((examsRes.data || []).map(e => e.exam_date))).sort();
      setExamDates(dates);
    } catch (error) {
      console.error('Error loading staff:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddStaff = async (data: StaffFormData) => {
    if (!supabase) return;
    setIsSaving(true); try { await fetch('/api/history/snapshot', { method: 'POST' }); } catch(e) {}
    try {
      const { error } = await supabase.from('staff').insert([{ ...data, current_score: 0 }]);
      if (error) throw error;
      setIsAddModalOpen(false);
      loadStaff();
    } catch (error: any) {
      console.error('Error adding staff:', error);
      alert(error.message || 'Failed to add staff member');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditStaff = async (data: StaffFormData) => {
    if (!supabase || !selectedStaff) return;
    setIsSaving(true); try { await fetch('/api/history/snapshot', { method: 'POST' }); } catch(e) {}
    try {
      const { error } = await supabase.from('staff').update(data).eq('id', selectedStaff.id);
      if (error) throw error;
      setIsEditModalOpen(false);
      setSelectedStaff(null);
      loadStaff();
    } catch (error: any) {
      console.error('Error updating staff:', error);
      alert(error.message || 'Failed to update staff member');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStaff = async () => {
    if (!supabase || !selectedStaff) return;
    setIsSaving(true); try { await fetch('/api/history/snapshot', { method: 'POST' }); } catch(e) {}
    try {
      const { error } = await supabase.from('staff').delete().eq('id', selectedStaff.id);
      if (error) throw error;
      setIsDeleteModalOpen(false);
      setSelectedStaff(null);
      loadStaff();
    } catch (error: any) {
      console.error('Error deleting staff:', error);
      alert(error.message || 'Failed to delete staff member');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImportStaff = async (data: StaffFormData[]) => {
    if (!supabase) return;
    setIsSaving(true); try { await fetch('/api/history/snapshot', { method: 'POST' }); } catch(e) {}
    try {
      const staffToInsert = data.map(s => ({ ...s, current_score: 0 }));
      const { error } = await supabase.from('staff').insert(staffToInsert);
      if (error) throw error;
      setIsImportModalOpen(false);
      loadStaff();
    } catch (error: any) {
      console.error('Error importing staff:', error);
      alert(error.message || 'Failed to import staff');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportExcel = () => {
    const blob = exportStaffToExcel(staff);
    downloadFile(blob, `staff_export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  /**
   * Bulk-cancel non-working days based on Excel specific off dates:
   * - Runs classifyOffDays() for each staff member
   * - Removes any weekdays identified as "recurring off" from that member's working_days
   * - This will mark them with an (X) in the table, exactly as provided in Excel.
   */
  const handleApplyOffRules = async () => {
    if (!supabase) return;
    if (!examDates.length) {
      alert('No exam dates found. Please add exam sessions first so the off-day analysis can run.');
      return;
    }

    const staffWithOffDates = staff.filter(s => s.specific_off_dates && s.specific_off_dates.length > 0);
    if (staffWithOffDates.length === 0) {
      alert('No staff members have specific off-dates to process.');
      return;
    }

    const confirmed = confirm(
      `Cancel non-working days for ${staffWithOffDates.length} staff member(s) with specific off-dates?\n\n` +
      `This will mark the recurring off days with an (X) exactly as provided in the Excel.`
    );
    if (!confirmed) return;

    setIsSaving(true); try { await fetch('/api/history/snapshot', { method: 'POST' }); } catch(e) {}
    let updatedCount = 0;
    let errorCount = 0;

    try {
      for (const member of staffWithOffDates) {
        const { recurringOffDays } = classifyOffDays(member.specific_off_dates, examDates);
        if (recurringOffDays.length === 0) continue; 

        const currentWorkingDays = member.working_days ?? [];
        const updatedWorkingDays = currentWorkingDays.filter(d => !recurringOffDays.includes(d));

        const changed = recurringOffDays.some(d => currentWorkingDays.includes(d));
        if (!changed) continue;

        const { error } = await supabase
          .from('staff')
          .update({ working_days: updatedWorkingDays })
          .eq('id', member.id);

        if (error) {
          console.error(`Error updating ${member.name}:`, error);
          errorCount++;
        } else {
          updatedCount++;
        }
      }

      if (errorCount > 0) {
        alert(`Completed with ${errorCount} error(s). ${updatedCount} staff member(s) updated successfully.`);
      } else if (updatedCount === 0) {
        alert('All staff already have their working days marked correctly. No changes needed.');
      } else {
        alert(`✓ Non-working days cancelled! ${updatedCount} staff member(s) updated to match Excel.`);
      }

      loadStaff();
    } catch (error: any) {
      console.error('Error updating working days:', error);
      alert(error.message || 'Failed to update working days');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetScores = async () => {
    alert('Scores are now automatically calculated by the database based on actual assignments. To reset scores to 0, please go to the Auto-Assign page and click "Reset All Assignments".');
  };

  const handleDeleteAll = async () => {
    if (!supabase) return;
    if (!confirm('Are you sure you want to DELETE ALL staff? This action cannot be undone and will delete associated assignments.')) return;
    setIsSaving(true); try { await fetch('/api/history/snapshot', { method: 'POST' }); } catch(e) {}
    try {
      const { error } = await supabase.from('staff').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      alert('All staff have been deleted');
      loadStaff();
    } catch (error: any) {
      console.error('Error deleting all staff:', error);
      alert(error.message || 'Failed to delete all staff');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkEdit = async (updates: Partial<Staff>) => {
    if (!supabase || selectedStaffIds.length === 0) return;
    setIsSaving(true); try { await fetch('/api/history/snapshot', { method: 'POST' }); } catch(e) {}
    try {
      const { error } = await supabase
        .from('staff')
        .update(updates)
        .in('id', selectedStaffIds);
      
      if (error) throw error;
      
      alert(`Successfully updated ${selectedStaffIds.length} staff members.`);
      setIsBulkEditModalOpen(false);
      setSelectedStaffIds([]); // Clear selection on success
      loadStaff();
    } catch (error: any) {
      console.error('Error in bulk edit:', error);
      alert(error.message || 'Failed to apply bulk edit');
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = (staffMember: Staff) => {
    setSelectedStaff(staffMember);
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (staffMember: Staff) => {
    setSelectedStaff(staffMember);
    setIsDeleteModalOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Staff Management"
        description="Manage faculty members, track scores, and set availability"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Selection actions */}
            {selectedStaffIds.length > 0 && (
              <div className="flex items-center rounded-lg border border-indigo-200 bg-indigo-50 shadow-sm overflow-hidden divide-x divide-indigo-200">
                <button onClick={() => setIsBulkEditModalOpen(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors">
                  <Edit className="w-3.5 h-3.5" />Bulk Edit ({selectedStaffIds.length})
                </button>
              </div>
            )}
            {/* Smart tools group */}
            <div className="flex items-center rounded-lg border border-primary-200 bg-primary-50 shadow-sm overflow-hidden divide-x divide-primary-200">
              <button onClick={handleResetScores} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-primary-700 hover:bg-primary-100 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />Reset Scores
              </button>
              <button onClick={handleApplyOffRules} disabled={isSaving || staff.length === 0}
                title="Cancel non-working days as provided in Excel specific off dates"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-primary-700 hover:bg-primary-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <CalendarDays className="w-3.5 h-3.5" />Cancel Off-Days
              </button>
            </div>
            {/* Data group */}
            <div className="flex items-center rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden divide-x divide-gray-200">
              <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                <Upload className="w-3.5 h-3.5" />Import Excel
              </button>
              <button onClick={handleExportExcel} disabled={staff.length === 0} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <Download className="w-3.5 h-3.5" />Export Excel
              </button>
            </div>
            {/* Danger */}
            <button onClick={handleDeleteAll} title="Delete all staff permanently" className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors shadow-sm">
              <Trash2 className="w-3.5 h-3.5" />Reset All
            </button>
            {/* Primary */}
            <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-sm transition-colors">
              <Plus className="w-3.5 h-3.5" />Add Staff
            </button>
          </div>
        }
      />

      <div className="card p-6">
        <StaffTable 
          staff={staff} 
          examDates={examDates} 
          isLoading={isLoading} 
          onUpdate={loadStaff} 
          onEdit={openEditModal} 
          onDelete={openDeleteModal}
          onSelectionChange={setSelectedStaffIds}
        />
      </div>

      {/* Add Staff Modal */}
      <StaffModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSubmit={handleAddStaff} isLoading={isSaving} examDates={examDates} />

      {/* Edit Staff Modal */}
      <StaffModal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setSelectedStaff(null); }} staff={selectedStaff} onSubmit={handleEditStaff} isLoading={isSaving} examDates={examDates} />

      {/* Delete Confirm Modal */}
      <DeleteConfirmModal isOpen={isDeleteModalOpen} onClose={() => { setIsDeleteModalOpen(false); setSelectedStaff(null); }} staff={selectedStaff} onConfirm={handleDeleteStaff} isLoading={isSaving} />

      {/* CSV Import Modal */}
      <CSVImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onImport={handleImportStaff} isLoading={isSaving} />

      {/* Bulk Edit Modal */}
      <StaffBulkEditModal
        isOpen={isBulkEditModalOpen}
        onClose={() => setIsBulkEditModalOpen(false)}
        selectedIds={selectedStaffIds}
        staffList={staff}
        onSave={handleBulkEdit}
        isLoading={isSaving}
      />
    </div>
  );
}

