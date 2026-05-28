'use client';

import { Fragment, useState, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Upload, FileText, AlertCircle, CheckCircle, Download, Loader2, Plus } from 'lucide-react';
import { parseExamCSV, getExamTemplate, downloadFile, ExamCSVData } from '@/lib/utils/csv-helpers';
import { supabase } from '@/lib/supabase/client';
import type { Room, ExamSessionFormData } from '@/types/database.types';

interface ExamCSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: ExamSessionFormData[]) => Promise<void>;
  rooms: Room[];
  isLoading?: boolean;
}

export function ExamCSVImportModal({ isOpen, onClose, onImport, rooms, isLoading }: ExamCSVImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<{
    success: boolean;
    data: (ExamCSVData & { room_id: string })[];
    errors: string[];
    missingRooms?: string[];
  } | null>(null);
  const [isCreatingRooms, setIsCreatingRooms] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<string>('');

  // Create room name to ID map
  const roomMap = new Map<string, string>();
  rooms.forEach(r => roomMap.set(r.room_name.toLowerCase(), r.id));

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    const result = await parseExamCSV(selectedFile, roomMap);
    setParseResult(result);
  };

  const handleImport = async () => {
    if (!parseResult?.data.length) return;
    // Convert to ExamSessionFormData (remove room_name, keep room_id)
    const formData: ExamSessionFormData[] = parseResult.data.map(({ room_name, ...rest }) => ({
      ...rest,
      program: selectedProgram || undefined,
    }));
    await onImport(formData);
    handleClose();
  };

  const handleClose = () => {
    setFile(null);
    setParseResult(null);
    setSelectedProgram('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  const handleDownloadTemplate = () => {
    const template = getExamTemplate();
    downloadFile(template, 'exams_template.xlsx');
  };

  const handleCreateMissingRooms = async () => {
    if (!parseResult?.missingRooms?.length || !supabase) return;
    setIsCreatingRooms(true);

    try {
      const createdRoomsMap = new Map<string, string>();
      const roomsToCreate = parseResult.missingRooms;

      // 1. Create rooms
      for (const roomName of roomsToCreate) {
        // Find max capacity needed for this room based on student counts in CSV
        const maxNeeded = Math.max(
          ...parseResult.data
            .filter(d => d.room_name === roomName)
            .map(d => d.student_count),
          30 // Minimum default
        );

        const { data, error } = await supabase
          .from('rooms')
          .insert({
            room_name: roomName,
            max_capacity: maxNeeded,
            is_active: true
          })
          .select('id')
          .single();

        if (error) throw error;
        if (data) createdRoomsMap.set(roomName.toLowerCase(), data.id);
      }

      // 2. Update data with new room IDs
      const updatedData = parseResult.data.map(item => {
        if (!item.room_id) {
          const newId = createdRoomsMap.get(item.room_name.toLowerCase());
          if (newId) return { ...item, room_id: newId };
        }
        return item;
      });

      // 3. Update state to clear missing rooms and set new data
      setParseResult({
        ...parseResult,
        data: updatedData,
        missingRooms: [],
        success: parseResult.errors.length === 0 // Success if no other errors
      });

    } catch (error: any) {
      console.error('Error creating rooms:', error);
      alert('Failed to create rooms: ' + error.message);
    } finally {
      setIsCreatingRooms(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-xl bg-white p-6 shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900">Import Exam Sessions from File</Dialog.Title>
                  <button onClick={handleClose} className="p-1 rounded-md hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button>
                </div>

                {/* Room Info */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 text-sm text-gray-600">
                  <strong>Available rooms:</strong> {rooms.map(r => r.room_name).join(', ') || 'No rooms configured'}
                </div>

                {/* Template Download */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <span className="text-sm text-blue-800">Need a template?</span>
                    </div>
                    <button onClick={handleDownloadTemplate} className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                      <Download className="w-4 h-4" /> Download Template
                    </button>
                  </div>
                </div>

                {/* File Upload */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center mb-4 hover:border-primary-400 transition-colors">
                  <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} className="hidden" id="exam-csv-upload" />
                  <label htmlFor="exam-csv-upload" className="cursor-pointer">
                    <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">{file ? file.name : 'Click to upload or drag and drop'}</p>
                    <p className="text-xs text-gray-400 mt-1">CSV or Excel files</p>
                  </label>
                </div>

                {/* Program Selection */}
                {parseResult?.success && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Assign Program to All Uploaded Exams (Optional)
                    </label>
                    <select
                      className="input w-full"
                      value={selectedProgram}
                      onChange={(e) => setSelectedProgram(e.target.value)}
                    >
                      <option value="">-- No Program Specified --</option>
                      <option value="PharmD">PharmD</option>
                      <option value="PharmD Clinical">PharmD Clinical</option>
                    </select>
                  </div>
                )}

                {/* Parse Results */}
                {parseResult && (
                  <div className={`rounded-lg p-4 mb-4 ${parseResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {parseResult.success ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
                      <span className={`font-medium ${parseResult.success ? 'text-green-800' : 'text-red-800'}`}>
                        {parseResult.success ? `${parseResult.data.length} exam sessions ready to import` : 'Errors found in file'}
                      </span>
                    </div>
                    {parseResult.errors.length > 0 && (
                      <ul className="text-sm text-red-700 list-disc list-inside max-h-32 overflow-y-auto">
                        {parseResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                      </ul>
                    )}
                  </div>
                )}

                {/* Missing Rooms Warning */}
                {parseResult && parseResult.missingRooms && parseResult.missingRooms.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      <span className="font-medium text-amber-800">
                        {parseResult.missingRooms.length} Rooms Not Found
                      </span>
                    </div>
                    <p className="text-sm text-amber-700 mb-3">
                      The following rooms are mentioned in the CSV but do not exist in the database:
                      <br />
                      <strong>{parseResult.missingRooms.join(', ')}</strong>
                    </p>
                    <button
                      onClick={handleCreateMissingRooms}
                      disabled={isCreatingRooms}
                      className="btn bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-300 w-full justify-center"
                    >
                      {isCreatingRooms ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                      Auto-Create Missing Rooms
                    </button>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3">
                  <button onClick={handleClose} className="btn btn-secondary px-4 py-2" disabled={isLoading}>Cancel</button>
                  <button 
                    onClick={handleImport} 
                    className="btn btn-primary px-4 py-2" 
                    disabled={isLoading || !parseResult?.success || !parseResult?.data.length || (parseResult.missingRooms?.length || 0) > 0}
                  >
                    {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</> : `Import ${parseResult?.data.length || 0} Exams`}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

