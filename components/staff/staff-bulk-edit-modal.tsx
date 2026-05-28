import { useState, useEffect } from 'react';
import { X, Save, AlertCircle, ShieldCheck, CheckSquare, Square } from 'lucide-react';
import type { Staff } from '@/types/database.types';

interface StaffBulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  staffList: Staff[];
  onSave: (updates: Partial<Staff>) => Promise<void>;
  isLoading: boolean;
}

export function StaffBulkEditModal({
  isOpen,
  onClose,
  selectedIds,
  staffList,
  onSave,
  isLoading
}: StaffBulkEditModalProps) {
  const [updates, setUpdates] = useState<Partial<Staff>>({});

  useEffect(() => {
    if (isOpen) {
      setUpdates({});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }
    await onSave(updates);
  };

  const handleFieldToggle = (field: keyof Staff, value: any) => {
    setUpdates(prev => {
      const next = { ...prev };
      if (next[field] === value) {
        delete next[field];
      } else {
        next[field] = value;
      }
      return next;
    });
  };

  const renderCheckboxOption = (field: keyof Staff, label: string, description: string) => {
    const isSelectedTrue = updates[field] === true;
    const isSelectedFalse = updates[field] === false;

    return (
      <div className="flex flex-col gap-2 p-3 border border-gray-200 rounded-lg bg-gray-50/50">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-gray-900">{label}</span>
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
              checked={isSelectedTrue}
              onChange={() => handleFieldToggle(field, true)}
            />
            <span className="text-sm text-gray-700">Set True</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-red-600 focus:ring-red-500 w-4 h-4"
              checked={isSelectedFalse}
              onChange={() => handleFieldToggle(field, false)}
            />
            <span className="text-sm text-gray-700">Set False</span>
          </label>
          {updates[field] !== undefined && (
            <button
              type="button"
              onClick={() => handleFieldToggle(field, updates[field])}
              className="text-xs text-gray-400 hover:text-gray-600 underline ml-auto"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Bulk Edit Staff</h2>
            <p className="text-sm text-gray-500 mt-1">
              Applying changes to <strong className="text-primary-600">{selectedIds.length}</strong> staff members
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-200 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Availability Status
              </label>
              <div className="flex gap-2">
                <select
                  value={updates.availability_status || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setUpdates(prev => {
                      const next = { ...prev };
                      if (!val) delete next.availability_status;
                      else next.availability_status = val as any;
                      return next;
                    });
                  }}
                  className="input w-full"
                >
                  <option value="">-- Do not change --</option>
                  <option value="Available">Available</option>
                  <option value="On-Leave">On-Leave</option>
                  <option value="Unavailable">Unavailable</option>
                </select>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Special Conditions</h3>
              
              {renderCheckboxOption('is_feeding_mother', 'Feeding Mother', 'Gets earlier leaving times')}
              {renderCheckboxOption('has_health_issue', 'Health Issue', 'Prefers certain buildings near pharmacy')}
              {renderCheckboxOption('is_overloaded', 'Overloaded', 'Reduced workload priority score')}
              {renderCheckboxOption('can_supervise_oral', 'Can Supervise Oral', 'Eligible for Oral Exam assignments')}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Notice</p>
              <p>Only fields that you explicitly set here will be modified. All other fields for the selected staff members will remain unchanged.</p>
            </div>
          </div>
        </form>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="btn btn-secondary px-4 py-2" disabled={isLoading}>
            Cancel
          </button>
          <button type="submit" onClick={handleSubmit} className="btn btn-primary px-4 py-2" disabled={isLoading || Object.keys(updates).length === 0}>
            <Save className="w-4 h-4 mr-2" />
            {isLoading ? 'Saving...' : 'Apply Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
