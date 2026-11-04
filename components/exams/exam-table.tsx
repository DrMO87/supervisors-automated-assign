'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { ExamSessionWithRelations, getPeriodFromTime, getSessionPeriod } from '@/types/database.types';
import { 
  Loader2, Edit, Trash2, Lock, Unlock, BookOpen, ArrowUpDown, ArrowUp, ArrowDown, 
  Search, LayoutGrid, List, SlidersHorizontal, Check, Sparkles, RotateCcw, Filter 
} from 'lucide-react';
import { format } from 'date-fns';
import { useMobileView } from '@/lib/hooks/use-mobile-view';

interface ExamTableProps {
  exams: ExamSessionWithRelations[];
  isLoading: boolean;
  onEdit: (exam: ExamSessionWithRelations) => void;
  onDelete: (exam: ExamSessionWithRelations) => void;
  onToggleLock: (exam: ExamSessionWithRelations) => void;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
}

// ─── Visible Columns & Presets Configuration ───────────────────────────────
export interface ExamVisibleColumns {
  exam_type: boolean;
  program: boolean;
  exam_date: boolean;
  start_time: boolean;
  room: boolean;
  student_count: boolean;
}

export type ExamViewPreset = 'all' | 'schedule' | 'academic' | 'logistics' | 'custom';

export const DEFAULT_EXAM_COLUMNS: ExamVisibleColumns = {
  exam_type: true,
  program: true,
  exam_date: true,
  start_time: true,
  room: true,
  student_count: true,
};

export const EXAM_PRESETS: { id: ExamViewPreset; label: string; labelAr: string; desc: string; columns: ExamVisibleColumns }[] = [
  {
    id: 'all',
    label: 'All Columns',
    labelAr: 'عرض شامل',
    desc: 'عرض كافة تفاصيل الامتحان والبرنامج والمكان',
    columns: { exam_type: true, program: true, exam_date: true, start_time: true, room: true, student_count: true },
  },
  {
    id: 'schedule',
    label: 'Schedule & Place',
    labelAr: 'المواعيد والمكان',
    desc: 'التاريخ، التوقيت، والفترة مع القاعة فقط',
    columns: { exam_type: false, program: false, exam_date: true, start_time: true, room: true, student_count: false },
  },
  {
    id: 'academic',
    label: 'Academic Details',
    labelAr: 'التفاصيل الأكاديمية',
    desc: 'نوع الامتحان، البرنامج الدراسي، والعدد',
    columns: { exam_type: true, program: true, exam_date: true, start_time: false, room: false, student_count: true },
  },
  {
    id: 'logistics',
    label: 'Capacity & Rooms',
    labelAr: 'القاعات والأعداد',
    desc: 'البرنامج، التاريخ، التوقيت، القاعة، وعدد الطلاب',
    columns: { exam_type: false, program: true, exam_date: true, start_time: true, room: true, student_count: true },
  },
];

const STORAGE_KEY_EXAM_COLUMNS = 'esms_exam_table_columns_v1';
const STORAGE_KEY_EXAM_PRESET = 'esms_exam_table_preset_v1';

type SortField = 'subject_name' | 'exam_type' | 'program' | 'exam_date' | 'start_time' | 'room' | 'student_count';
type SortDirection = 'asc' | 'desc';

export function ExamTable({ exams, isLoading, onEdit, onDelete, onToggleLock, selectedIds = [], onSelectionChange }: ExamTableProps) {
  const [sortField, setSortField] = useState<SortField>('exam_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const { viewMode, toggleViewMode } = useMobileView();
  
  // ─── Columns Visibility & Presets State ─────────────────────────────────
  const [visibleColumns, setVisibleColumns] = useState<ExamVisibleColumns>(DEFAULT_EXAM_COLUMNS);
  const [activePreset, setActivePreset] = useState<ExamViewPreset>('all');
  const [isColumnsDropdownOpen, setIsColumnsDropdownOpen] = useState(false);
  const columnsDropdownRef = useRef<HTMLDivElement>(null);

  // ─── Filters State ──────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterRoom, setFilterRoom] = useState('');
  const [filterProgram, setFilterProgram] = useState('');

  // Load preferences from localStorage once mounted
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedCols = localStorage.getItem(STORAGE_KEY_EXAM_COLUMNS);
      const savedPreset = localStorage.getItem(STORAGE_KEY_EXAM_PRESET);
      if (savedCols) {
        setVisibleColumns(JSON.parse(savedCols));
      }
      if (savedPreset) {
        setActivePreset(savedPreset as ExamViewPreset);
      }
    } catch (e) {
      console.error('Failed to load exam table column preferences', e);
    }
  }, []);

  // Click-outside listener for columns dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnsDropdownRef.current && !columnsDropdownRef.current.contains(event.target as Node)) {
        setIsColumnsDropdownOpen(false);
      }
    };
    if (isColumnsDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isColumnsDropdownOpen]);

  const applyPreset = (presetId: ExamViewPreset) => {
    if (presetId === 'custom') return;
    const target = EXAM_PRESETS.find(p => p.id === presetId);
    if (!target) return;
    setVisibleColumns(target.columns);
    setActivePreset(presetId);
    try {
      localStorage.setItem(STORAGE_KEY_EXAM_COLUMNS, JSON.stringify(target.columns));
      localStorage.setItem(STORAGE_KEY_EXAM_PRESET, presetId);
    } catch (e) {}
  };

  const toggleColumn = (key: keyof ExamVisibleColumns) => {
    setVisibleColumns(prev => {
      const next = { ...prev, [key]: !prev[key] };
      const matchingPreset = EXAM_PRESETS.find(p => 
        Object.keys(p.columns).every(k => p.columns[k as keyof ExamVisibleColumns] === next[k as keyof ExamVisibleColumns])
      );
      const newPreset: ExamViewPreset = matchingPreset ? matchingPreset.id : 'custom';
      setActivePreset(newPreset);
      try {
        localStorage.setItem(STORAGE_KEY_EXAM_COLUMNS, JSON.stringify(next));
        localStorage.setItem(STORAGE_KEY_EXAM_PRESET, newPreset);
      } catch (e) {}
      return next;
    });
  };

  const resetAllColumns = () => {
    applyPreset('all');
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 text-gray-400 ml-1 inline-block" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-4 h-4 text-primary-600 ml-1 inline-block" /> : <ArrowDown className="w-4 h-4 text-primary-600 ml-1 inline-block" />;
  };

  const filteredAndSortedExams = useMemo(() => {
    let result = [...exams];

    // Filtering
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(e => e.subject_name.toLowerCase().includes(lowerSearch));
    }
    if (filterDate) {
      result = result.filter(e => e.exam_date === filterDate);
    }
    if (filterRoom) {
      result = result.filter(e => e.room?.room_name.toLowerCase().includes(filterRoom.toLowerCase()) || (filterRoom === 'unassigned' && !e.room));
    }
    if (filterProgram) {
      result = result.filter(e => e.program?.toLowerCase().includes(filterProgram.toLowerCase()));
    }

    // Sorting
    result.sort((a, b) => {
      let aVal: any = a[sortField as keyof ExamSessionWithRelations];
      let bVal: any = b[sortField as keyof ExamSessionWithRelations];

      if (sortField === 'room') {
        aVal = a.room?.room_name || '';
        bVal = b.room?.room_name || '';
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [exams, searchTerm, filterDate, filterRoom, filterProgram, sortField, sortDirection]);

  const hasActiveFilters = Boolean(searchTerm || filterDate || filterRoom || filterProgram);

  const clearFilters = () => {
    setSearchTerm('');
    setFilterDate('');
    setFilterProgram('');
    setFilterRoom('');
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onSelectionChange) return;
    if (e.target.checked) {
      const allSelectable = filteredAndSortedExams.filter(e => !e.is_locked).map(e => e.id);
      onSelectionChange(allSelectable);
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter(selectedId => selectedId !== id));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Loading exams...</span>
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <div className="text-center py-12">
        <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No exam sessions yet</h3>
        <p className="text-gray-500">Add exam sessions to start scheduling supervision.</p>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'EEE, MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const selectableExams = filteredAndSortedExams.filter(e => !e.is_locked);
  const allSelected = selectableExams.length > 0 && selectableExams.every(e => selectedIds.includes(e.id));
  const someSelected = selectedIds.length > 0 && selectedIds.length < selectableExams.length;

  const activeColumnsCount = Object.values(visibleColumns).filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* ─── Top Control Toolbar: Presets, Columns Toggle & Quick Filters ─── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-4 space-y-3">
        {/* Row 1: Presets & Columns Dropdown */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 mr-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              View Presets:
            </span>
            {EXAM_PRESETS.map((preset) => {
              const isActive = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset.id)}
                  title={preset.desc}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900'
                  }`}
                >
                  {preset.label}
                  {isActive && <Check className="w-3 h-3 stroke-[3]" />}
                </button>
              );
            })}
            {activePreset === 'custom' && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                Custom View
              </span>
            )}
          </div>

          {/* Right Side: Columns Dropdown & Mobile View */}
          <div className="flex items-center gap-2 relative" ref={columnsDropdownRef}>
            {/* Columns Customizer Dropdown Button */}
            <button
              onClick={() => setIsColumnsDropdownOpen(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                isColumnsDropdownOpen 
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
              <span>Columns</span>
              <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                {activeColumnsCount}/6
              </span>
              <ArrowDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isColumnsDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Mobile View Toggle */}
            <div className="md:hidden">
              <button 
                onClick={toggleViewMode} 
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                title="Toggle View Mode"
              >
                {viewMode === 'standard' ? <List className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Columns Dropdown Popover */}
            {isColumnsDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-gray-900">Customize Columns</span>
                  </div>
                  <button
                    onClick={resetAllColumns}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium hover:underline flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                </div>

                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {[
                    { key: 'exam_type', label: 'Exam Type', labelAr: 'نوع الامتحان', desc: 'Final, Oral, Midterm, Practical' },
                    { key: 'program', label: 'Academic Program', labelAr: 'البرنامج الدراسي', desc: 'Faculty department / study program' },
                    { key: 'exam_date', label: 'Exam Date', labelAr: 'تاريخ الامتحان', desc: 'Scheduled calendar day' },
                    { key: 'start_time', label: 'Time & Period', labelAr: 'الوقت والفترة', desc: 'P1/P2 and start/end time' },
                    { key: 'room', label: 'Venue / Hall', labelAr: 'القاعة / المكان', desc: 'Assigned examination room' },
                    { key: 'student_count', label: 'Student Count', labelAr: 'عدد الطلاب', desc: 'Total expected examinees' },
                  ].map((col) => {
                    const isChecked = visibleColumns[col.key as keyof ExamVisibleColumns];
                    return (
                      <label
                        key={col.key}
                        className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleColumn(col.key as keyof ExamVisibleColumns)}
                          className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-gray-900 leading-tight">
                            {col.label}
                          </span>
                          <span className="text-[10px] text-gray-500 mt-0.5">
                            {col.desc}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-[11px] text-gray-500">
                  <span>{activeColumnsCount} of 6 selected</span>
                  <button
                    onClick={() => applyPreset('all')}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    Select All
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Search & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-gray-100">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search subject..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" 
            />
          </div>
          <input 
            type="date" 
            value={filterDate} 
            onChange={e => setFilterDate(e.target.value)} 
            className="px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-1 focus:ring-indigo-500 text-gray-700" 
          />
          <input 
            type="text" 
            placeholder="Filter Program" 
            value={filterProgram} 
            onChange={e => setFilterProgram(e.target.value)} 
            className="px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-1 focus:ring-indigo-500 text-gray-700 min-w-[120px]" 
          />
          <input 
            type="text" 
            placeholder="Filter Room" 
            value={filterRoom} 
            onChange={e => setFilterRoom(e.target.value)} 
            className="px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-1 focus:ring-indigo-500 text-gray-700 min-w-[120px]" 
          />
          {hasActiveFilters && (
            <button 
              onClick={clearFilters} 
              className="px-2.5 py-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1 font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              Clear
            </button>
          )}
          <div className="ml-auto text-xs text-gray-500 font-medium">
            Showing <span className="font-bold text-gray-900">{filteredAndSortedExams.length}</span> of {exams.length}
          </div>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 gap-4 md:hidden mt-2">
        {filteredAndSortedExams.map((exam) => {
          if (viewMode === 'compact') {
            return (
              <div key={exam.id} className={`bg-white rounded-lg border ${selectedIds.includes(exam.id) ? 'border-primary-400 ring-1 ring-primary-400' : 'border-gray-200'} shadow-sm p-3 flex items-center gap-3 transition-all`}>
                {onSelectionChange && (
                  <input type="checkbox" checked={selectedIds.includes(exam.id)} disabled={exam.is_locked} onChange={(e) => handleSelectOne(exam.id, e.target.checked)} className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500 disabled:opacity-50" />
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 text-sm truncate">{exam.subject_name}</span>
                    {exam.is_locked && <Lock className="w-3 h-3 text-blue-500 flex-shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {visibleColumns.exam_date && <span>{format(new Date(exam.exam_date), 'MMM d')}</span>}
                    {visibleColumns.start_time && (
                      <>
                        <span>•</span>
                        <span>P{getSessionPeriod(exam, exams)}</span>
                      </>
                    )}
                    {visibleColumns.room && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-[80px]">{exam.room?.room_name || 'TBD'}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => onEdit(exam)} className="p-1 text-primary-600 bg-primary-50 rounded"><Edit className="w-3.5 h-3.5" /></button>
                  <button onClick={() => onToggleLock(exam)} className="p-1 text-blue-600 bg-blue-50 rounded">{exam.is_locked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}</button>
                  <button onClick={() => onDelete(exam)} className="p-1 text-red-600 bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            );
          }

          return (
            <div key={exam.id} className={`bg-white rounded-xl border ${selectedIds.includes(exam.id) ? 'border-primary-400 ring-1 ring-primary-400' : 'border-gray-200'} shadow-sm p-4 flex flex-col gap-3 relative overflow-hidden transition-all`}>
              {exam.is_locked && (
                <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none overflow-hidden">
                  <div className="absolute top-4 -right-6 bg-blue-100 text-blue-700 text-[10px] font-bold py-1 w-24 text-center transform rotate-45 shadow-sm">LOCKED</div>
                </div>
              )}
              
              <div className="flex items-start gap-3 border-b border-gray-100 pb-3 pr-8">
                {onSelectionChange && (
                  <div className="pt-1 flex-shrink-0">
                    <input type="checkbox" checked={selectedIds.includes(exam.id)} disabled={exam.is_locked} onChange={(e) => handleSelectOne(exam.id, e.target.checked)} className="w-5 h-5 text-primary-600 rounded border-gray-300 focus:ring-primary-500 disabled:opacity-50" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="font-bold text-gray-900 leading-tight">{exam.subject_name}</div>
                  <div className="text-xs text-gray-500 font-mono mt-1">ID: {exam.id.slice(0, 8)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-2 text-sm px-1">
                {visibleColumns.exam_date && (
                  <>
                    <div className="text-gray-500">Date</div>
                    <div className="font-medium text-gray-900">{formatDate(exam.exam_date)}</div>
                  </>
                )}
                
                {visibleColumns.start_time && (
                  <>
                    <div className="text-gray-500">Time</div>
                    <div className="font-medium text-gray-900">P{getSessionPeriod(exam, exams)}: {exam.start_time}-{exam.end_time || '?'}</div>
                  </>
                )}
                
                {visibleColumns.room && (
                  <>
                    <div className="text-gray-500">Place</div>
                    <div className="font-medium text-gray-900">{exam.room?.room_name || 'TBD'}</div>
                  </>
                )}
                
                {visibleColumns.student_count && (
                  <>
                    <div className="text-gray-500">Count</div>
                    <div className="font-medium text-gray-900">{exam.student_count}</div>
                  </>
                )}
                
                {visibleColumns.exam_type && (
                  <>
                    <div className="text-gray-500">Type</div>
                    <div className="font-medium text-gray-600">{exam.exam_type || '-'}</div>
                  </>
                )}
                
                {visibleColumns.program && (
                  <>
                    <div className="text-gray-500">Program</div>
                    <div className="font-medium text-gray-600">{exam.program || '-'}</div>
                  </>
                )}
              </div>

              <div className="pt-3 mt-1 border-t border-gray-100 flex justify-end gap-2">
                <button onClick={() => onToggleLock(exam)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${exam.is_locked ? 'text-blue-700 bg-blue-50 hover:bg-blue-100' : 'text-gray-700 bg-gray-100 hover:bg-gray-200'}`}>
                  {exam.is_locked ? <><Unlock className="w-3.5 h-3.5" /> Unlock</> : <><Lock className="w-3.5 h-3.5" /> Lock</>}
                </button>
                <button onClick={() => onEdit(exam)} disabled={exam.is_locked} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors">
                  <Edit className="w-3.5 h-3.5" /> Edit
                </button>
                <button onClick={() => onDelete(exam)} disabled={exam.is_locked} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          );
        })}
        {filteredAndSortedExams.length === 0 && exams.length > 0 && (
          <div className="text-center py-8 text-gray-500 bg-white rounded-xl border border-gray-200">
            No exams match your filters.
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {onSelectionChange && (
                <th className="px-4 py-3 text-left w-12">
                  <input type="checkbox" checked={allSelected} ref={input => { if (input) input.indeterminate = someSelected; }} onChange={handleSelectAll} className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500" />
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('subject_name')}>
                Exam <SortIcon field="subject_name" />
              </th>
              {visibleColumns.exam_type && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('exam_type')}>
                  Type <SortIcon field="exam_type" />
                </th>
              )}
              {visibleColumns.program && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('program')}>
                  Program <SortIcon field="program" />
                </th>
              )}
              {visibleColumns.exam_date && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('exam_date')}>
                  Date <SortIcon field="exam_date" />
                </th>
              )}
              {visibleColumns.start_time && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('start_time')}>
                  Time <SortIcon field="start_time" />
                </th>
              )}
              {visibleColumns.room && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('room')}>
                  Place <SortIcon field="room" />
                </th>
              )}
              {visibleColumns.student_count && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('student_count')}>
                  Count <SortIcon field="student_count" />
                </th>
              )}
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAndSortedExams.map((exam) => (
              <tr key={exam.id} className={`hover:bg-gray-50 ${exam.is_locked ? 'bg-blue-50/50' : ''} ${selectedIds.includes(exam.id) ? 'bg-primary-50/30' : ''}`}>
                {onSelectionChange && (
                  <td className="px-4 py-4 text-xs text-gray-500 w-12">
                    <input type="checkbox" checked={selectedIds.includes(exam.id)} disabled={exam.is_locked} onChange={(e) => handleSelectOne(exam.id, e.target.checked)} className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500 disabled:opacity-50" />
                  </td>
                )}
                <td className="px-4 py-4">
                  <div className="font-medium text-gray-900">{exam.subject_name}</div>
                  <div className="text-xs text-gray-500 font-mono mt-0.5">{exam.id.slice(0, 8)}</div>
                </td>
                {visibleColumns.exam_type && (
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {exam.exam_type || '-'}
                  </td>
                )}
                {visibleColumns.program && (
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {exam.program || '-'}
                  </td>
                )}
                {visibleColumns.exam_date && (
                  <td className="px-4 py-4 text-sm text-gray-900">
                    {formatDate(exam.exam_date)}
                  </td>
                )}
                {visibleColumns.start_time && (
                  <td className="px-4 py-4 text-sm text-gray-600">
                    <div className="whitespace-nowrap">P{getSessionPeriod(exam, exams)}: {exam.start_time} - {exam.end_time || '?'}</div>
                  </td>
                )}
                {visibleColumns.room && (
                  <td className="px-4 py-4 text-sm text-gray-900">
                    {exam.room?.room_name || 'TBD'}
                  </td>
                )}
                {visibleColumns.student_count && (
                  <td className="px-4 py-4 text-sm text-gray-900">
                    {exam.student_count}
                  </td>
                )}
                <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => onToggleLock(exam)} className={`mr-2 ${exam.is_locked ? 'text-blue-600 hover:text-blue-900' : 'text-gray-600 hover:text-gray-900'}`} title={exam.is_locked ? 'Unlock session' : 'Lock session'}>
                    {exam.is_locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  </button>
                  <button onClick={() => onEdit(exam)} className="text-primary-600 hover:text-primary-900 mr-2" title="Edit exam" disabled={exam.is_locked}>
                    <Edit className={`w-4 h-4 ${exam.is_locked ? 'opacity-50' : ''}`} />
                  </button>
                  <button onClick={() => onDelete(exam)} className="text-danger-600 hover:text-danger-900" title="Delete exam" disabled={exam.is_locked}>
                    <Trash2 className={`w-4 h-4 ${exam.is_locked ? 'opacity-50' : ''}`} />
                  </button>
                </td>
              </tr>
            ))}
            {filteredAndSortedExams.length === 0 && exams.length > 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  No exams match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

