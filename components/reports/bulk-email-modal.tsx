'use client';

import { Fragment, useState, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { 
  X, Mail, Search, Check, AlertTriangle, AlertCircle, 
  Loader2, Play, Square, Eye, CheckCircle2, ChevronRight, HelpCircle
} from 'lucide-react';
import { format } from 'date-fns';
import type { Staff, AssignmentWithSession, PeriodFreeStaff } from '@/types/database.types';
import { generateStaffScheduleHTML, generateStaffSchedulePDF, getWeekRangeLabel, mapFreeStaffToAssignment } from '@/lib/utils/report-generators';

interface BulkEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedWeek: string;
  availableWeeks: string[];
  staff: Staff[];
  assignments: AssignmentWithSession[];
  freeStaffList?: PeriodFreeStaff[];
}

type SendStatus = 'idle' | 'generating' | 'sending' | 'success' | 'error';

interface StatusState {
  status: SendStatus;
  error?: string;
}

export function BulkEmailModal({
  isOpen,
  onClose,
  selectedWeek: initialWeek,
  availableWeeks,
  staff,
  assignments,
  freeStaffList = []
}: BulkEmailModalProps) {
  const [currentWeek, setCurrentWeek] = useState(initialWeek);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());
  const [activeStaffId, setActiveStaffId] = useState<string>('');
  const [sendStatuses, setSendStatuses] = useState<Record<string, StatusState>>({});
  const [isSending, setIsSending] = useState(false);
  const stopRequested = useRef(false);

  // Egypt standard Saturday offset helper
  const getWeekStart = (dateStr: string) => {
    const d = new Date(`${dateStr}T12:00:00Z`);
    const day = d.getUTCDay();
    const offset = day === 6 ? 0 : -(day + 1);
    const start = new Date(d.setUTCDate(d.getUTCDate() + offset));
    return start.toISOString().split('T')[0];
  };

  // Keep local week state in sync with prop updates
  useEffect(() => {
    setCurrentWeek(initialWeek);
  }, [initialWeek]);

  // Compute filtered assignments for the selected week
  const baseWeekAssignments = currentWeek === 'all'
    ? assignments
    : assignments.filter(a => a.exam_session && getWeekStart(a.exam_session.exam_date) === currentWeek);

  const weekFreeStaff = currentWeek === 'all'
    ? freeStaffList
    : freeStaffList.filter(fs => getWeekStart(fs.exam_date) === currentWeek);

  const weekAssignments = [
    ...baseWeekAssignments,
    ...weekFreeStaff.map(mapFreeStaffToAssignment)
  ];

  // Get only staff members who have assignments in this week
  const staffWithAssignments = staff.filter(s =>
    weekAssignments.some(a => a.staff_id === s.id)
  );

  // Filter staff by search query
  const filteredStaff = staffWithAssignments.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sync selection and preview defaults on week/data changes
  useEffect(() => {
    const initialChecked = new Set(
      staffWithAssignments
        .filter(s => !!s.email)
        .map(s => s.id)
    );
    setSelectedStaffIds(initialChecked);
    setSendStatuses({});
    
    if (staffWithAssignments.length > 0) {
      // Keep selected active preview if still in the list, otherwise default to first
      const exists = staffWithAssignments.some(s => s.id === activeStaffId);
      if (!exists) {
        setActiveStaffId(staffWithAssignments[0].id);
      }
    } else {
      setActiveStaffId('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWeek, staff, assignments, freeStaffList]);

  // Handle master toggle selection
  const handleSelectAllToggle = () => {
    const validEmails = staffWithAssignments.filter(s => !!s.email);
    if (selectedStaffIds.size === validEmails.length) {
      setSelectedStaffIds(new Set()); // Deselect all
    } else {
      setSelectedStaffIds(new Set(validEmails.map(s => s.id))); // Select all valid
    }
  };

  const handleCheckboxChange = (staffId: string) => {
    const next = new Set(selectedStaffIds);
    if (next.has(staffId)) {
      next.delete(staffId);
    } else {
      next.add(staffId);
    }
    setSelectedStaffIds(next);
  };

  // Preview properties
  const activeStaff = staff.find(s => s.id === activeStaffId);
  const weekLabel = getWeekRangeLabel(currentWeek, weekAssignments);
  const previewHtml = activeStaff ? generateStaffScheduleHTML(activeStaff, weekAssignments, weekLabel) : '';
  const previewSubject = activeStaff ? `\u200EYour Exam Supervision Schedule (${getWeekRangeLabel(currentWeek, weekAssignments)}) - ${activeStaff.name}\u200E` : '';

  // Queue sending logic
  const handleBulkSend = async () => {
    if (selectedStaffIds.size === 0) return;
    setIsSending(true);
    stopRequested.current = false;

    // Reset status map for currently selected IDs
    const resetStatuses = { ...sendStatuses };
    selectedStaffIds.forEach(id => {
      resetStatuses[id] = { status: 'idle' };
    });
    setSendStatuses(resetStatuses);

    const staffIdsToProcess = Array.from(selectedStaffIds);

    for (let i = 0; i < staffIdsToProcess.length; i++) {
      if (stopRequested.current) {
        break;
      }

      const staffId = staffIdsToProcess[i];
      const member = staff.find(s => s.id === staffId);
      if (!member || !member.email) continue;

      try {
        // Step 1: Generate PDF
        setSendStatuses(prev => ({
          ...prev,
          [staffId]: { status: 'generating' }
        }));
        
        const weekLabel = getWeekRangeLabel(currentWeek, weekAssignments);
        const html = generateStaffScheduleHTML(member, weekAssignments, weekLabel);
        const pdfBlob = await generateStaffSchedulePDF(member, weekAssignments, weekLabel);

        // Convert blob to base64
        const reader = new FileReader();
        const pdfBase64 = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            const base64data = reader.result as string;
            resolve(base64data.split(',')[1]);
          };
          reader.onerror = () => reject(new Error('Failed to render PDF'));
          reader.readAsDataURL(pdfBlob);
        });

        // Step 2: Send SMTP Email
        if (stopRequested.current) break;
        setSendStatuses(prev => ({
          ...prev,
          [staffId]: { status: 'sending' }
        }));

        const res = await fetch('/api/send-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toEmail: member.email,
            subject: `\u200EYour Exam Supervision Schedule (${getWeekRangeLabel(currentWeek, weekAssignments)}) - ${member.name}\u200E`,
            htmlContent: html,
            pdfBase64: pdfBase64,
            staffName: member.name
          })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'SMTP delivery failure');
        }

        // Step 3: Success
        setSendStatuses(prev => ({
          ...prev,
          [staffId]: { status: 'success' }
        }));
      } catch (err: any) {
        console.error(`Bulk send error for ${member.name}:`, err);
        setSendStatuses(prev => ({
          ...prev,
          [staffId]: { status: 'error', error: err.message || 'Unknown network error' }
        }));
      }

      // Short delay to throttle SMTP connections
      if (i < staffIdsToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }

    setIsSending(false);
  };

  const handleStopSending = () => {
    stopRequested.current = true;
    setIsSending(false);
  };

  // Statistics calculation
  const totalWithAssignments = staffWithAssignments.length;
  const missingEmailCount = staffWithAssignments.filter(s => !s.email).length;
  const validEmailCount = totalWithAssignments - missingEmailCount;
  const selectedCount = selectedStaffIds.size;

  const successCount = Object.values(sendStatuses).filter(s => s.status === 'success').length;
  const errorCount = Object.values(sendStatuses).filter(s => s.status === 'error').length;
  const processingCount = Object.values(sendStatuses).filter(s => s.status === 'generating' || s.status === 'sending').length;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => { if (!isSending) onClose(); }}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-5xl transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all border border-slate-200 flex flex-col max-h-[90vh]">
                
                {/* Modal Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="bg-violet-100 p-2 rounded-xl">
                      <Mail className="w-6 h-6 text-violet-600" />
                    </div>
                    <div>
                      <Dialog.Title as="h3" className="text-lg font-bold text-slate-900 leading-none">
                        Bulk Send Schedules
                      </Dialog.Title>
                      <p className="text-xs text-slate-500 mt-1">
                        Preview templates and dispatch schedules in a sequential queue.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">Week:</span>
                      <select
                        value={currentWeek}
                        onChange={(e) => setCurrentWeek(e.target.value)}
                        disabled={isSending}
                        className="border border-slate-300 rounded-lg p-1.5 bg-slate-50 hover:bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer min-w-[200px]"
                      >
                        <option value="all">All Weeks (Consolidated)</option>
                        {availableWeeks.map(week => (
                          <option key={week} value={week}>
                            Week of {new Date(week).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button 
                      onClick={onClose} 
                      disabled={isSending}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Queue Summary & Control Bar */}
                <div className="bg-slate-50 rounded-xl p-4 my-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-100">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-700">Total Proctors with Duties:</span>
                      <span className="bg-slate-200 px-2 py-0.5 rounded-full font-bold text-slate-800">{totalWithAssignments}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-700">Ready to Send:</span>
                      <span className="bg-emerald-100 px-2 py-0.5 rounded-full font-bold text-emerald-800">{validEmailCount}</span>
                    </div>
                    {missingEmailCount > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-amber-800 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Missing Email:
                        </span>
                        <span className="bg-amber-100 px-2 py-0.5 rounded-full font-bold text-amber-800">{missingEmailCount}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 border-l border-slate-200 pl-6">
                      <span className="font-semibold text-slate-700">Selected for Delivery:</span>
                      <span className="bg-violet-100 px-2 py-0.5 rounded-full font-bold text-violet-800">{selectedCount}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isSending ? (
                      <button
                        onClick={handleStopSending}
                        className="btn bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-4 py-2 flex items-center gap-2 shadow-sm rounded-lg"
                      >
                        <Square className="w-4 h-4" /> Stop Queue
                      </button>
                    ) : (
                      <button
                        onClick={handleBulkSend}
                        disabled={selectedCount === 0 || totalWithAssignments === 0}
                        className="btn bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs px-4 py-2 flex items-center gap-2 shadow-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Play className="w-4 h-4" /> Start Bulk Send
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Indicators when sending */}
                {(isSending || successCount > 0 || errorCount > 0) && (
                  <div className="mb-4">
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1">
                      <span>Queue Sending Status</span>
                      <span>{successCount + errorCount} / {selectedCount} Complete ({successCount} Success, {errorCount} Errors)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div 
                        className="bg-violet-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${selectedCount > 0 ? ((successCount + errorCount) / selectedCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {currentWeek === 'all' && (
                  <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-3 text-xs text-amber-800 items-start">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Caution: consolidated reports.</span> Sending schedules in &quot;All Weeks&quot; will package every exam assigned to that proctor during the entire term into one table. Make sure this is intended, or select a specific week from the dropdown above.
                    </div>
                  </div>
                )}

                {/* Main Split Grid Area */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
                  
                  {/* Left Column: Recipient list */}
                  <div className="lg:col-span-5 flex flex-col h-full min-h-0">
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search proctors by name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>

                    <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col">
                      <div className="sticky top-0 bg-slate-50 border-b border-slate-150 px-4 py-2.5 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider z-10">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            disabled={isSending || totalWithAssignments === 0}
                            checked={selectedCount === validEmailCount && validEmailCount > 0}
                            onChange={handleSelectAllToggle}
                            className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 w-3.5 h-3.5 cursor-pointer disabled:opacity-50"
                          />
                          <span>Proctor Name</span>
                        </div>
                        <span>Status / Duties</span>
                      </div>

                      {filteredStaff.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                          <Eye className="w-10 h-10 text-slate-300 mb-2 stroke-[1.5]" />
                          <p className="text-xs font-semibold">No active duties found</p>
                          <p className="text-[10px] mt-1 text-slate-400">
                            {searchQuery ? 'No proctors match your search criteria.' : 'No schedules mapped for this week.'}
                          </p>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {filteredStaff.map(s => {
                            const count = weekAssignments.filter(a => a.staff_id === s.id).length;
                            const isSelected = selectedStaffIds.has(s.id);
                            const isActive = activeStaffId === s.id;
                            const state = sendStatuses[s.id];

                            return (
                              <div
                                key={s.id}
                                onClick={() => { if (!isSending) setActiveStaffId(s.id); }}
                                className={`flex items-center justify-between p-3 transition-colors cursor-pointer group text-xs ${
                                  isActive ? 'bg-violet-50/70 border-l-4 border-l-violet-600 pl-2' : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    disabled={isSending || !s.email}
                                    checked={isSelected}
                                    onChange={() => handleCheckboxChange(s.id)}
                                    className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 w-3.5 h-3.5 cursor-pointer disabled:opacity-50"
                                  />
                                  <div className="min-w-0">
                                    <div className="font-bold text-slate-800 truncate group-hover:text-violet-950 flex items-center gap-1.5">
                                      {s.name}
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate mt-0.5">
                                      {s.email ? (
                                        <span className="text-slate-400 font-medium">{s.email}</span>
                                      ) : (
                                        <span className="text-red-500 font-bold flex items-center gap-0.5">
                                          <AlertCircle className="w-3 h-3 inline" /> Missing Email
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                  {/* Duty Badge */}
                                  <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded text-[10px]">
                                    {count} {count === 1 ? 'duty' : 'duties'}
                                  </span>

                                  {/* Delivery Queue Status */}
                                  <div className="w-24 flex justify-end">
                                    {state ? (
                                      state.status === 'generating' ? (
                                        <span className="text-blue-600 font-semibold text-[10px] flex items-center gap-1">
                                          <Loader2 className="w-3 h-3 animate-spin" /> Rendering
                                        </span>
                                      ) : state.status === 'sending' ? (
                                        <span className="text-amber-600 font-semibold text-[10px] flex items-center gap-1">
                                          <Loader2 className="w-3 h-3 animate-spin" /> Delivering
                                        </span>
                                      ) : state.status === 'success' ? (
                                        <span className="text-emerald-600 font-bold text-[10px] flex items-center gap-1">
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Dispatched
                                        </span>
                                      ) : state.status === 'error' ? (
                                        <span 
                                          className="text-red-600 font-bold text-[10px] flex items-center gap-0.5 hover:underline" 
                                          title={state.error}
                                        >
                                          <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 inline" /> Failed
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 text-[10px]">Pending</span>
                                      )
                                    ) : (
                                      <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${isActive ? 'translate-x-0.5 text-violet-500' : 'group-hover:translate-x-0.5'}`} />
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: HTML Template Preview */}
                  <div className="lg:col-span-7 flex flex-col h-full min-h-0 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 shadow-inner">
                    <div className="bg-white border-b border-slate-150 p-4">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
                        <span className="text-slate-500">Live Send Preview</span>
                        {activeStaff && (
                          <span className="bg-violet-100 text-violet-800 font-bold px-2 py-0.5 rounded-full text-[10px]">
                            {activeStaff.job_title}
                          </span>
                        )}
                      </div>
                      {activeStaff ? (
                        <div className="space-y-1.5 text-xs">
                          <div className="flex">
                            <span className="w-16 font-bold text-slate-400 shrink-0">To:</span>
                            <span className="text-slate-800 font-semibold truncate">
                              {activeStaff.name} {activeStaff.email ? `<${activeStaff.email}>` : '(No email configured)'}
                            </span>
                          </div>
                          <div className="flex">
                            <span className="w-16 font-bold text-slate-400 shrink-0">Subject:</span>
                            <span className="text-slate-800 font-bold truncate">{previewSubject}</span>
                          </div>
                          <div className="flex">
                            <span className="w-16 font-bold text-slate-400 shrink-0">Attach:</span>
                            <span className="text-slate-600 font-medium italic truncate flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded">
                              schedule_{activeStaff.name.replace(/[\/\\:\*\?"<>\|]/g, '').replace(/\s+/g, '_')}.pdf
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-slate-400 text-xs italic">Select a staff member from the list to preview.</div>
                      )}
                    </div>

                    <div className="flex-1 min-h-0 relative p-4 bg-slate-100 flex flex-col justify-stretch">
                      {activeStaff ? (
                        <div className="flex-1 w-full rounded-lg border border-slate-200 shadow-sm bg-white overflow-hidden flex flex-col">
                          <iframe
                            title="Schedule Preview"
                            srcDoc={previewHtml}
                            className="w-full flex-1 border-none bg-white"
                          />
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs">
                          <HelpCircle className="w-8 h-8 text-slate-300 mb-2 stroke-[1.5]" />
                          <span>No Preview Available</span>
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* Modal Footer Controls */}
                <div className="mt-6 flex justify-between items-center pt-4 border-t border-slate-100">
                  <div className="text-xs text-slate-400 font-semibold">
                    {selectedCount > 0 ? (
                      <span>Ready to dispatch {selectedCount} customized schedules.</span>
                    ) : (
                      <span>Choose at least one recipient to start.</span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={onClose} 
                      disabled={isSending}
                      className="btn btn-secondary px-4 py-2 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    {!isSending && (
                      <button 
                        onClick={handleBulkSend}
                        disabled={selectedCount === 0 || totalWithAssignments === 0}
                        className="btn bg-violet-600 hover:bg-violet-700 text-white font-bold px-5 py-2 text-xs shadow-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Send {selectedCount} Emails
                      </button>
                    )}
                  </div>
                </div>

              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
