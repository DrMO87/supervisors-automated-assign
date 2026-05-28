'use client';

import { Fragment, useState, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Upload, FileText, AlertCircle, CheckCircle, Download, Loader2, ListChecks, Table2 } from 'lucide-react';
import {
  parseStaffCSV,
  parseMicrosoftListStaffExcel,
  getStaffTemplate,
  downloadFile,
} from '@/lib/utils/csv-helpers';
import type { StaffFormData } from '@/types/database.types';

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: StaffFormData[]) => Promise<void>;
  isLoading?: boolean;
}

type ImportMode = 'standard' | 'ms_list';

const ALL_DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'] as const;
const SHORT_DAYS: Record<string, string> = {
  Saturday: 'Sat', Sunday: 'Sun', Monday: 'Mon',
  Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
};

export function CSVImportModal({ isOpen, onClose, onImport, isLoading }: CSVImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ImportMode>('standard');
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<{
    success: boolean;
    data: StaffFormData[];
    errors: string[];
  } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    const result =
      mode === 'ms_list'
        ? await parseMicrosoftListStaffExcel(selectedFile)
        : await parseStaffCSV(selectedFile);
    setParseResult(result);
  };

  const handleModeChange = (newMode: ImportMode) => {
    setMode(newMode);
    // Clear previous parse result when switching mode
    setFile(null);
    setParseResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = async () => {
    if (!parseResult?.data.length) return;
    await onImport(parseResult.data);
    handleClose();
  };

  const handleClose = () => {
    setFile(null);
    setParseResult(null);
    setMode('standard');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  const handleDownloadTemplate = () => {
    const template = getStaffTemplate();
    downloadFile(template, 'staff_template.xlsx');
  };

  const previewRows = parseResult?.data.slice(0, 5) ?? [];

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
              leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-xl bg-white p-6 shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900">
                    Import Staff from File
                  </Dialog.Title>
                  <button onClick={handleClose} className="p-1 rounded-md hover:bg-gray-100">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                {/* Mode Toggle */}
                <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-5">
                  <button
                    id="import-mode-standard"
                    onClick={() => handleModeChange('standard')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                      mode === 'standard'
                        ? 'bg-primary-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Table2 className="w-4 h-4" />
                    Standard Import
                  </button>
                  <button
                    id="import-mode-ms-list"
                    onClick={() => handleModeChange('ms_list')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-l border-gray-200 ${
                      mode === 'ms_list'
                        ? 'bg-primary-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <ListChecks className="w-4 h-4" />
                    Microsoft List Import
                  </button>
                </div>

                {/* Mode Description */}
                {mode === 'ms_list' ? (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-4 text-sm text-indigo-800">
                    <strong>Microsoft List mode:</strong> Upload the Excel exported from your SharePoint / Microsoft List.
                    The <em>&quot;Off Days&quot;</em> column (containing specific calendar dates) will be used to identify
                    each staff member&apos;s <strong>off weekdays</strong>. All remaining weekdays (Sat–Thu) will be set as working days.
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <span className="text-sm text-blue-800">Need a template with the correct column format?</span>
                    </div>
                    <button
                      onClick={handleDownloadTemplate}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 shrink-0"
                    >
                      <Download className="w-4 h-4" /> Download Template
                    </button>
                  </div>
                )}

                {/* File Upload */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center mb-4 hover:border-primary-400 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                    id="csv-upload"
                    key={mode}
                  />
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">{file ? file.name : 'Click to upload or drag and drop'}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {mode === 'ms_list'
                        ? 'Excel exported from Microsoft List / SharePoint'
                        : 'CSV or Excel files'}
                    </p>
                  </label>
                </div>

                {/* Parse Result Banner */}
                {parseResult && (
                  <div
                    className={`rounded-lg p-4 mb-4 ${
                      parseResult.success
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-red-50 border border-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {parseResult.success ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      )}
                      <span className={`font-medium ${parseResult.success ? 'text-green-800' : 'text-red-800'}`}>
                        {parseResult.success
                          ? `${parseResult.data.length} staff member${parseResult.data.length !== 1 ? 's' : ''} ready to import`
                          : 'Errors found in file'}
                      </span>
                    </div>
                    {parseResult.errors.length > 0 && (
                      <ul className="text-sm text-red-700 list-disc list-inside max-h-32 overflow-y-auto">
                        {parseResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                      </ul>
                    )}
                  </div>
                )}

                {/* Preview Table (first 5 records) */}
                {parseResult?.success && previewRows.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Preview (first {previewRows.length} of {parseResult.data.length})
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="min-w-full text-xs divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-gray-500 font-medium">Name</th>
                            <th className="px-3 py-2 text-left text-gray-500 font-medium">Role</th>
                            {ALL_DAYS.map(d => (
                              <th key={d} className="px-2 py-2 text-center text-gray-500 font-medium">
                                {SHORT_DAYS[d]}
                              </th>
                            ))}
                            {mode === 'ms_list' && (
                              <th className="px-3 py-2 text-left text-gray-500 font-medium">Off Dates</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {previewRows.map((s, i) => (
                            <tr key={i}>
                              <td className="px-3 py-1.5 font-medium text-gray-800 whitespace-nowrap max-w-[160px] truncate">
                                {s.name}
                              </td>
                              <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{s.supervision_role}</td>
                              {ALL_DAYS.map(d => {
                                const works = s.working_days.includes(d);
                                return (
                                  <td key={d} className="px-2 py-1.5 text-center">
                                    <span
                                      className={`inline-block w-5 h-5 rounded-full text-xs leading-5 font-bold ${
                                        works
                                          ? 'bg-green-100 text-green-700'
                                          : 'bg-red-100 text-red-400'
                                      }`}
                                    >
                                      {works ? '✓' : '✕'}
                                    </span>
                                  </td>
                                );
                              })}
                              {mode === 'ms_list' && (
                                <td className="px-3 py-1.5 text-gray-500 text-xs max-w-[180px]">
                                  {s.specific_off_dates && s.specific_off_dates.length > 0 ? (
                                    <span className="text-indigo-700 font-medium">
                                      {s.specific_off_dates.length} dates<br/>
                                      <span className="text-gray-400">{s.specific_off_dates.slice(0,2).join(', ')}{s.specific_off_dates.length > 2 ? '…' : ''}</span>
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">none</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3">
                  <button
                    onClick={handleClose}
                    className="btn btn-secondary px-4 py-2"
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    id="import-staff-confirm-btn"
                    onClick={handleImport}
                    className="btn btn-primary px-4 py-2"
                    disabled={isLoading || !parseResult?.success || !parseResult?.data.length}
                  >
                    {isLoading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</>
                    ) : (
                      `Import ${parseResult?.data.length || 0} Staff`
                    )}
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

