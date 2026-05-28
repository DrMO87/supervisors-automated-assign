'use client';

import { Fragment, useState, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Upload, FileText, AlertCircle, CheckCircle, Download, Loader2 } from 'lucide-react';
import { parseRoomCSV, getRoomTemplate, downloadFile } from '@/lib/utils/csv-helpers';
import type { RoomFormData } from '@/types/database.types';

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: RoomFormData[]) => Promise<void>;
  isLoading?: boolean;
}

export function RoomCSVImportModal({ isOpen, onClose, onImport, isLoading }: CSVImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<{
    success: boolean;
    data: RoomFormData[];
    errors: string[];
  } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    const result = await parseRoomCSV(selectedFile);
    setParseResult(result);
  };

  const handleImport = async () => {
    if (!parseResult?.data.length) return;
    await onImport(parseResult.data);
    handleClose();
  };

  const handleClose = () => {
    setFile(null);
    setParseResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  const handleDownloadTemplate = () => {
    const template = getRoomTemplate();
    downloadFile(template, 'rooms_template.xlsx');
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
                  <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900">Import Rooms from File</Dialog.Title>
                  <button onClick={handleClose} className="p-1 rounded-md hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button>
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
                  <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} className="hidden" id="room-csv-upload" />
                  <label htmlFor="room-csv-upload" className="cursor-pointer">
                    <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">{file ? file.name : 'Click to upload or drag and drop'}</p>
                    <p className="text-xs text-gray-400 mt-1">CSV or Excel files</p>
                  </label>
                </div>

                {/* Parse Results */}
                {parseResult && (
                  <div className={`rounded-lg p-4 mb-4 ${parseResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {parseResult.success ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
                      <span className={`font-medium ${parseResult.success ? 'text-green-800' : 'text-red-800'}`}>
                        {parseResult.success ? `${parseResult.data.length} rooms ready to import` : 'Errors found in file'}
                      </span>
                    </div>
                    {parseResult.errors.length > 0 && (
                      <ul className="text-sm text-red-700 list-disc list-inside max-h-32 overflow-y-auto">
                        {parseResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                      </ul>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3">
                  <button onClick={handleClose} className="btn btn-secondary px-4 py-2" disabled={isLoading}>Cancel</button>
                  <button onClick={handleImport} className="btn btn-primary px-4 py-2" disabled={isLoading || !parseResult?.success || !parseResult?.data.length}>
                    {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</> : `Import ${parseResult?.data.length || 0} Rooms`}
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

