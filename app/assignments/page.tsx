'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Play, Calendar, Users, DoorOpen, CheckCircle, AlertTriangle, ArrowRight, Download, Upload, Trash2 } from 'lucide-react';
import { supabase, isSupabaseConfigured, getSupabaseConfigStatus } from '@/lib/supabase/client';
import { Staff, ExamSession, Room, Assignment, SystemSettings, getPeriodFromTime } from '@/types/database.types';
import { SetupRequired } from '@/components/setup-required';
import { batchAssign, allocateReserveStaff } from '@/lib/algorithms/auto-assignment';
import { generateAssignmentReport, exportAssignmentsToExcel, parseAssignmentCSV, downloadFile } from '@/lib/utils/csv-helpers';

export default function AutoAssignPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [counts, setCounts] = useState({ staff: 0, exams: 0, rooms: 0, assignments: 0 });
    const [staff, setStaff] = useState<Staff[]>([]);
    const [exams, setExams] = useState<ExamSession[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [result, setResult] = useState<{ assigned: number; violations: number, assignments?: Assignment[], violationsList?: any[] } | null>(null);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
    const [selectedWeek, setSelectedWeek] = useState<string>('all_unassigned');

    const configStatus = getSupabaseConfigStatus();

    useEffect(() => {
        if (isSupabaseConfigured()) {
            loadData();
        } else {
            setIsLoading(false);
        }
    }, []);

    const loadData = async () => {
        if (!supabase) return;
        setIsLoading(true);
        try {
            const [staffRes, examsRes, roomsRes, assignmentsRes, settingsRes] = await Promise.all([
                supabase.from('staff').select('*').limit(10000),
                supabase.from('exam_sessions').select('*').limit(10000),
                supabase.from('rooms').select('*').limit(10000),
                supabase.from('assignments').select('*, staff:staff(*), exam_session:exam_sessions(*)').limit(10000),
                supabase.from('system_settings').select('*').not('setting_key', 'like', 'backup_%').limit(10000), // Fetch needed settings
            ]);

            setCounts({
                staff: staffRes.data?.length || 0,
                exams: examsRes.data?.length || 0,
                rooms: roomsRes.data?.length || 0,
                assignments: assignmentsRes.data?.length || 0,
            });

            setStaff(staffRes.data || []);
            setExams(examsRes.data || []);
            setRooms(roomsRes.data || []);
            setAllAssignments(assignmentsRes.data || []); // We need full assignment data for export
            setExams(examsRes.data || []);
            setRooms(roomsRes.data || []);
            setAllAssignments(assignmentsRes.data || []);

            // Process Settings
            const fetchedSettings: any = {};
            settingsRes.data?.forEach(s => {
                fetchedSettings[s.setting_key] = s.setting_value;
            });
            setSettings(fetchedSettings);

        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetAssignments = async () => {
        if (counts.assignments === 0) {
            alert('No assignments to reset.');
            return;
        }

        const isSpecificWeek = selectedWeek !== 'all_unassigned';
        let weekLabel = '';

        if (isSpecificWeek) {
            weekLabel = new Date(selectedWeek).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
            if (!confirm(`Are you sure you want to delete assignments only for the week of ${weekLabel}? This cannot be undone.`)) return;
        } else {
            if (!confirm('Are you sure you want to delete ALL assignments? This cannot be undone.')) return;
        }

        setIsProcessing(true);
        try {
            setResult(null);

            if (isSpecificWeek) {
                // Filter exams for the selected week
                const targetExams = exams.filter(e => getWeekStart(e.exam_date) === selectedWeek);
                const examIds = targetExams.map(e => e.id);

                if (examIds.length === 0) {
                    alert('No exams found for this week.');
                    setIsProcessing(false);
                    return;
                }

                // Get assignments that will be deleted to adjust staff scores
                const { data: assignmentsToDelete, error: fetchError } = await supabase
                    .from('assignments')
                    .select('id, staff_id')
                    .in('exam_session_id', examIds);

                if (fetchError) throw fetchError;

                // Delete the assignments
                const { error: deleteError } = await supabase
                    .from('assignments')
                    .delete()
                    .in('exam_session_id', examIds);

                if (deleteError) throw deleteError;

                // Delete free staff assignments for the week
                const startStr = selectedWeek;
                const endDate = new Date(selectedWeek);
                endDate.setDate(endDate.getDate() + 7);
                const endStr = endDate.toISOString().split('T')[0];
                const { error: deleteFreeStaffError } = await supabase
                    .from('period_free_staff')
                    .delete()
                    .gte('exam_date', startStr)
                    .lt('exam_date', endStr);
                if (deleteFreeStaffError) throw deleteFreeStaffError;

                // Recalculate free_staff_score in database
                const { data: allFreeStaff } = await supabase.from('period_free_staff').select('staff_id');
                const freeStaffCounts = new Map<string, number>();
                allFreeStaff?.forEach(fs => {
                    freeStaffCounts.set(fs.staff_id, (freeStaffCounts.get(fs.staff_id) || 0) + 1);
                });
                const freeStaffUpdatePromises = staff.map(async (s) => {
                    const newFreeScore = freeStaffCounts.get(s.id) || 0;
                    if ((s.free_staff_score || 0) !== newFreeScore) {
                        return await supabase.from('staff').update({ free_staff_score: newFreeScore }).eq('id', s.id);
                    }
                    return null;
                });
                for (let i = 0; i < freeStaffUpdatePromises.length; i += 20) {
                    await Promise.all(freeStaffUpdatePromises.slice(i, i + 20));
                }

                // Recalculate and update scores of affected staff members by periods
                if (assignmentsToDelete && assignmentsToDelete.length > 0) {
                    const affectedStaffIds = Array.from(new Set(assignmentsToDelete.map(a => a.staff_id)));
                    const remainingAssignments = allAssignments.filter(a => !examIds.includes(a.exam_session_id));
                    
                    const staffNewPeriods = new Map<string, Set<string>>();
                    remainingAssignments.forEach(a => {
                        const session = exams.find(e => e.id === a.exam_session_id);
                        if (session) {
                            const periodKey = `${session.exam_date}__${getPeriodFromTime(session.start_time)}`;
                            if (!staffNewPeriods.has(a.staff_id)) {
                                staffNewPeriods.set(a.staff_id, new Set());
                            }
                            staffNewPeriods.get(a.staff_id)!.add(periodKey);
                        }
                    });

                    const updatePromises = affectedStaffIds.map(async (staffId) => {
                        const s = staff.find(x => x.id === staffId);
                        if (s) {
                            const newScore = staffNewPeriods.get(staffId)?.size || 0;
                            if (s.current_score !== newScore) {
                                return await supabase.from('staff').update({ current_score: newScore }).eq('id', staffId);
                            }
                        }
                        return null;
                    });

                    for (let i = 0; i < updatePromises.length; i += 20) {
                        await Promise.all(updatePromises.slice(i, i + 20));
                    }
                }

                alert(`Assignments for the week of ${weekLabel} have been reset and staff scores adjusted.`);
            } else {
                // Delete ALL assignments
                const { error } = await supabase.from('assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                if (error) throw error;

                // Delete ALL period free staff assignments
                const { error: freeStaffError } = await supabase.from('period_free_staff').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                if (freeStaffError) throw freeStaffError;

                if (confirm('Assignments deleted. Do you also want to reset STAFF SCORES (workload count) to 0?\nClick OK to reset scores to zero.\nClick Cancel to keep scores as is.')) {
                    const { error: scoreError } = await supabase.from('staff').update({ current_score: 0, free_staff_score: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');
                    if (scoreError) throw scoreError;
                    alert('Assignments and scores have been reset.');
                } else {
                    alert('Assignments deleted.');
                }
            }

            loadData();
        } catch (err: any) {
            console.error(err);
            alert('Error: ' + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    // Helper to get week start date (Saturday for Egypt standard)
    const getWeekStart = (dateStr: string) => {
        const d = new Date(`${dateStr}T12:00:00Z`);
        const day = d.getUTCDay();
        const offset = day === 6 ? 0 : -(day + 1);
        const start = new Date(d.setUTCDate(d.getUTCDate() + offset));
        return start.toISOString().split('T')[0];
    };

    const availableWeeks = Array.from(new Set(exams.map(e => getWeekStart(e.exam_date)))).sort();

    const handleGenerateAssignments = async () => {
        if (!supabase || staff.length === 0 || exams.length === 0) return;

        // Check if assignments already exist
        if (counts.assignments > 0) {
            if (!confirm(`Warning: There are already ${counts.assignments} assignments. Generating new ones will APPEND to existing ones. Is this what you want? (Usually you want to Reset All Exams first if starting fresh)`)) {
                return;
            }
        }

        setIsProcessing(true);
        try {
            // 1. Get existing assignments to avoid conflicts
            const { data: existingAssignments } = await supabase.from('assignments').select('*').limit(10000);
            const assignedExamIds = new Set((existingAssignments || []).map(a => a.exam_session_id));

            // Filter exams based on week selection and unassigned status
            let examsToAssign = exams.filter(e => !assignedExamIds.has(e.id));
            
            if (selectedWeek !== 'all_unassigned') {
                examsToAssign = examsToAssign.filter(e => getWeekStart(e.exam_date) === selectedWeek);
            }

            if (examsToAssign.length === 0) {
                alert('No unassigned exams found for the selected criteria.');
                setIsProcessing(false);
                return;
            }

            // 2. Run Algorithm locally
            const ratios = settings?.staffing_ratios?.ranges ? settings.staffing_ratios : { ranges: [] };
            const constraints = settings?.scheduling_constraints || {
                allow_consecutive_shifts: false,
                max_hours_per_week_ft: 18,
                max_hours_per_week_pt: 10
            };

            const { assignments, violations } = batchAssign(
                examsToAssign,
                staff,
                existingAssignments || [],
                { ratios, constraints },
                rooms
            );

            // 3. Save to DB
            if (assignments.length > 0) {
                // Chunk inserts to avoid request limits
                const chunkSize = 100;
                for (let i = 0; i < assignments.length; i += chunkSize) {
                    const chunk = assignments.slice(i, i + chunkSize);
                    const { error } = await supabase.from('assignments').insert(chunk);
                    if (error) throw error;
                }

                // Calculate scores map by distinct date + period slots
                const staffNewPeriods = new Map<string, Set<string>>();
                const combined = [...(existingAssignments || []), ...assignments];
                combined.forEach(a => {
                    const session = exams.find(e => e.id === a.exam_session_id);
                    if (session) {
                        const periodKey = `${session.exam_date}__${getPeriodFromTime(session.start_time)}`;
                        if (!staffNewPeriods.has(a.staff_id)) {
                            staffNewPeriods.set(a.staff_id, new Set());
                        }
                        staffNewPeriods.get(a.staff_id)!.add(periodKey);
                    }
                });

                const updatePromises = Array.from(staffNewPeriods.entries()).map(async ([staffId, periods]) => {
                    const s = staff.find(x => x.id === staffId);
                    if (s && s.current_score !== periods.size) {
                        return await supabase.from('staff').update({ current_score: periods.size }).eq('id', staffId);
                    }
                    return null;
                });

                // Run in batches of 20 to avoid overwhelming the database
                for (let i = 0; i < updatePromises.length; i += 20) {
                    await Promise.all(updatePromises.slice(i, i + 20));
                }
            }

            // ── Allocate and save reserve staff ───────────────────────────
            // Removed as per user request: reserve assignments are now handled separately.

            setResult({
                assigned: assignments.length,
                violations: violations.length,
                assignments: assignments,
                violationsList: violations
            });

            // Reload counts
            loadData();

        } catch (error: any) {
            console.error('Assignment generation failed:', error);
            alert('Failed to generate assignments: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownloadReport = () => {
        if (!result?.assignments) return;

        // Convert complex violations objects to strings for report
        const violationStrings = result.violationsList?.map(v =>
            `${v.type}: ${v.message} (Session: ${exams.find(e => e.id === v.exam_session_id)?.subject_name})`
        ) || [];

        const blob = generateAssignmentReport(
            result.assignments,
            violationStrings,
            staff,
            exams,
            rooms,
            settings // Pass settings for valid calculation of required staff
        );
        downloadFile(blob, `assignment_report_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleExportCurrent = () => {
        if (counts.assignments === 0) return;
        const blob = exportAssignmentsToExcel(allAssignments, staff, exams, rooms);
        downloadFile(blob, `assignments_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleImportAssignments = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;
        if (!supabase) return;

        const file = e.target.files[0];
        setIsProcessing(true);
        try {
            const { success, data, errors } = await parseAssignmentCSV(file, exams, staff, rooms);

            if (!success) {
                alert('Import failed:\n' + errors.join('\n').slice(0, 500));
                return;
            }

            if (data.length === 0) {
                alert('No valid assignments found in file.');
                return;
            }

            // Identify unique exam sessions present in the imported file
            const importedSessionIds = Array.from(new Set(data.map(d => d.exam_session_id)));
            const sessionsToReplace: string[] = [];
            const newSessions: string[] = [];

            importedSessionIds.forEach(sessionId => {
                const hasExisting = allAssignments.some(a => a.exam_session_id === sessionId);
                const session = exams.find(e => e.id === sessionId);
                const room = session?.room_id ? rooms.find(r => r.id === session.room_id) : null;
                const roomName = room?.room_name || (session as any)?.room?.room_name || 'Unknown Room';
                const label = `${roomName} - ${session?.subject_name || 'Unknown Subject'} (${session?.exam_date || ''})`;

                if (hasExisting) {
                    sessionsToReplace.push(label);
                } else {
                    newSessions.push(label);
                }
            });

            let confirmMessage = `Found ${data.length} assignments in the file.\n\n`;

            if (sessionsToReplace.length > 0) {
                confirmMessage += `The following already assigned rooms/sessions will have their existing assignments REPLACED:\n`;
                sessionsToReplace.slice(0, 10).forEach(s => {
                    confirmMessage += `• ${s}\n`;
                });
                if (sessionsToReplace.length > 10) {
                    confirmMessage += `• ... and ${sessionsToReplace.length - 10} more rooms.\n`;
                }
                confirmMessage += `\n`;
            }

            if (newSessions.length > 0) {
                confirmMessage += `NOTE (New Rooms): The following rooms/sessions currently have no assignments and will be newly assigned:\n`;
                newSessions.slice(0, 10).forEach(s => {
                    confirmMessage += `• ${s}\n`;
                });
                if (newSessions.length > 10) {
                    confirmMessage += `• ... and ${newSessions.length - 10} more rooms.\n`;
                }
                confirmMessage += `\n`;
            }

            confirmMessage += `Are you sure you want to proceed with importing and modifying these assignments?`;

            if (!confirm(confirmMessage)) {
                setIsProcessing(false);
                if (e.target) e.target.value = '';
                return;
            }

            // 1. Delete existing assignments for the imported sessions first to replace them
            if (importedSessionIds.length > 0) {
                const { error: deleteError } = await supabase
                    .from('assignments')
                    .delete()
                    .in('exam_session_id', importedSessionIds);
                if (deleteError) throw deleteError;
            }

            // 2. Prepare inserts
            const toInsertAssignments = data.map(d => ({
                exam_session_id: d.exam_session_id,
                staff_id: d.staff_id,
                role: d.role,
                assigned_at: new Date().toISOString()
            }));

            // 3. Insert chunked
            const chunkSize = 100;
            for (let i = 0; i < toInsertAssignments.length; i += chunkSize) {
                const chunk = toInsertAssignments.slice(i, i + chunkSize);
                const { error } = await supabase.from('assignments').insert(chunk);
                if (error) throw error;
            }

            // 4. Recalculate staff scores by periods
            const { data: dbAssignments } = await supabase.from('assignments').select('staff_id, exam_session_id');
            
            const staffNewPeriods = new Map<string, Set<string>>();
            
            // Initialize all staff members to handle score reset to 0 if all their assignments were removed
            staff.forEach(s => {
                staffNewPeriods.set(s.id, new Set());
            });

            (dbAssignments || []).forEach(a => {
                const session = exams.find(e => e.id === a.exam_session_id);
                if (session) {
                    const periodKey = `${session.exam_date}__${getPeriodFromTime(session.start_time)}`;
                    if (!staffNewPeriods.has(a.staff_id)) {
                        staffNewPeriods.set(a.staff_id, new Set());
                    }
                    staffNewPeriods.get(a.staff_id)!.add(periodKey);
                }
            });

            const importUpdatePromises = Array.from(staffNewPeriods.entries()).map(async ([staffId, periods]) => {
                const s = staff.find(x => x.id === staffId);
                if (s && s.current_score !== periods.size) {
                    return await supabase.from('staff').update({ current_score: periods.size }).eq('id', staffId);
                }
                return null;
            });

            // Run in batches of 20 to avoid overwhelming the database
            for (let i = 0; i < importUpdatePromises.length; i += 20) {
                await Promise.all(importUpdatePromises.slice(i, i + 20));
            }

            alert('Successfully imported assignments.');
            loadData();

        } catch (error: any) {
            console.error('Import error:', error);
            alert('Import failed: ' + error.message);
        } finally {
            if (e.target) e.target.value = ''; // Reset input
            setIsProcessing(false);
        }
    };

    if (!configStatus.configured) {
        return <SetupRequired configStatus={configStatus} />;
    }

    return (
        <div>
            <PageHeader
                title="Auto-Assign Supervisors"
                description="Intelligently assign staff to exams based on rules and availability"
                actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetAssignments}
              disabled={isProcessing || counts.assignments === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              title={selectedWeek === 'all_unassigned' ? 'Delete all assignments' : 'Delete assignments for the selected week'}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {selectedWeek === 'all_unassigned' ? 'Reset All Assignments' : 'Reset Week'}
            </button>
          </div>
        }
      />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Status Card */}
                <div className="card p-6 lg:col-span-1 space-y-6">
                    <h3 className="font-semibold text-lg text-gray-900 border-b pb-2">Current Data Status</h3>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                            <div className="flex items-center gap-3">
                                <Users className={`w-5 h-5 ${counts.staff > 0 ? 'text-green-600' : 'text-gray-400'}`} />
                                <span className="text-gray-700">Staff Members</span>
                            </div>
                            <span className="font-bold text-gray-900">{counts.staff}</span>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                            <div className="flex items-center gap-3">
                                <DoorOpen className={`w-5 h-5 ${counts.rooms > 0 ? 'text-green-600' : 'text-gray-400'}`} />
                                <span className="text-gray-700">Rooms</span>
                            </div>
                            <span className="font-bold text-gray-900">{counts.rooms}</span>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                            <div className="flex items-center gap-3">
                                <Calendar className={`w-5 h-5 ${counts.exams > 0 ? 'text-green-600' : 'text-gray-400'}`} />
                                <span className="text-gray-700">Exam Sessions</span>
                            </div>
                            <span className="font-bold text-gray-900">{counts.exams}</span>
                        </div>

                        <div className="pt-4 border-t">
                            <div className="flex items-center justify-between p-3 bg-blue-50 rounded border border-blue-100">
                                <div className="flex items-center gap-3">
                                    <CheckCircle className={`w-5 h-5 ${counts.assignments > 0 ? 'text-blue-600' : 'text-gray-400'}`} />
                                    <span className="text-blue-900 font-medium">Assignments Created</span>
                                </div>
                                <span className="font-bold text-blue-700">{counts.assignments}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Area */}
                <div className="card p-6 lg:col-span-2 flex flex-col items-center justify-center text-center space-y-6 min-h-[400px]">
                    {result ? (
                        <div className="w-full max-w-md bg-green-50 border border-green-200 rounded-lg p-6 space-y-4">
                            <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
                            <h2 className="text-2xl font-bold text-green-800">Assignment Complete!</h2>
                            <p className="text-green-700">
                                Successfully created <strong>{result.assigned}</strong> new assignments.
                                {result.violations > 0 && <span className="block mt-1 text-amber-700 font-medium">Note: {result.violations} constraints could not be fully met. Check the dashboard for details.</span>}
                            </p>

                            <div className="pt-4 flex gap-3 justify-center">
                                <button
                                    onClick={() => setResult(null)}
                                    className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-white"
                                >
                                    Run Again
                                </button>
                                <button
                                    onClick={handleDownloadReport}
                                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 shadow-sm flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" /> Download Report
                                </button>
                                <button
                                    onClick={() => router.push('/dashboard')}
                                    className="px-6 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 shadow-sm flex items-center gap-2"
                                >
                                    View Schedule <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-2">
                                <Play className="w-8 h-8 text-primary-600 ml-1" />
                            </div>

                            <div className="max-w-md space-y-2">
                                <h2 className="text-2xl font-bold text-gray-900">Ready to Assign?</h2>
                                <p className="text-gray-600">
                                    This process will analyze all {counts.exams} exam sessions and assign the optimal staff members based on your configured rules and ratios.
                                </p>
                            </div>

                            <div className="pt-4 flex flex-col gap-4 items-center w-full max-w-sm mx-auto">
                                <div className="w-full text-left mb-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Week</label>
                                    <select
                                        value={selectedWeek}
                                        onChange={(e) => setSelectedWeek(e.target.value)}
                                        className="w-full border-gray-300 rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border"
                                        disabled={isProcessing}
                                    >
                                        <option value="all_unassigned">Auto-Assign All Unassigned Exams</option>
                                        {availableWeeks.map(week => (
                                            <option key={week} value={week}>
                                                Week of {new Date(week).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} (Saturday)
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <button
                                    onClick={handleGenerateAssignments}
                                    disabled={isProcessing || counts.exams === 0 || counts.staff === 0}
                                    className={`btn btn-primary w-full py-3 text-lg shadow-lg flex items-center justify-center gap-3
                    ${(isProcessing || counts.exams === 0 || counts.staff === 0) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 transition-transform'}
                  `}
                                >
                                    {isProcessing ? (
                                        <>Processing...</>
                                    ) : (
                                        <>
                                            <Play className="w-5 h-5 fill-current" />
                                            Generate Assignments
                                        </>
                                    )}
                                </button>

                                <div className="flex gap-3 mt-2">
                                    {/* Hidden Import Input */}
                                    <input
                                        type="file"
                                        accept=".csv, .xlsx, .xls"
                                        onChange={handleImportAssignments}
                                        className="hidden"
                                        id="assignment-import"
                                        disabled={isProcessing}
                                    />

                                    <button
                                        onClick={handleExportCurrent}
                                        disabled={counts.assignments === 0}
                                        className="text-sm text-gray-600 hover:text-primary-600 flex items-center gap-1 disabled:opacity-50"
                                    >
                                        <Download className="w-4 h-4" /> Export Assignments
                                    </button>

                                    <span className="text-gray-300">|</span>

                                    <label
                                        htmlFor="assignment-import"
                                        className={`text-sm text-gray-600 hover:text-primary-600 flex items-center gap-1 cursor-pointer ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
                                    >
                                        <Upload className="w-4 h-4" /> Import Manual Edits
                                    </label>
                                </div>
                            </div>

                            {(counts.exams === 0 || counts.staff === 0) && (
                                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded text-sm">
                                    <AlertTriangle className="w-4 h-4" />
                                    Please import Staff and Exams first.
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
