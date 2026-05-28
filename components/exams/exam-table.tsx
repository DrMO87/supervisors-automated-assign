'use client';

import { useState, useMemo } from 'react';
import { ExamSessionWithRelations, getPeriodFromTime } from '@/types/database.types';
import { Loader2, Edit, Trash2, Lock, Unlock, BookOpen, ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { format } from 'date-fns';

interface ExamTableProps {
  exams: ExamSessionWithRelations[];
  isLoading: boolean;
  onEdit: (exam: ExamSessionWithRelations) => void;
  onDelete: (exam: ExamSessionWithRelations) => void;
  onToggleLock: (exam: ExamSessionWithRelations) => void;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
}

type SortField = 'subject_name' | 'exam_type' | 'program' | 'exam_date' | 'start_time' | 'room' | 'student_count';
type SortDirection = 'asc' | 'desc';

export function ExamTable({ exams, isLoading, onEdit, onDelete, onToggleLock, selectedIds = [], onSelectionChange }: ExamTableProps) {
  const [sortField, setSortField] = useState<SortField>('exam_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterRoom, setFilterRoom] = useState('');
  const [filterProgram, setFilterProgram] = useState('');

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

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-wrap gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search subject..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500" />
        </div>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500" />
        <input type="text" placeholder="Filter Program" value={filterProgram} onChange={e => setFilterProgram(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500" />
        <input type="text" placeholder="Filter Room" value={filterRoom} onChange={e => setFilterRoom(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500" />
        {(searchTerm || filterDate || filterProgram || filterRoom) && (
          <button onClick={() => { setSearchTerm(''); setFilterDate(''); setFilterProgram(''); setFilterRoom(''); }} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            Clear
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('exam_type')}>
                Type <SortIcon field="exam_type" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('program')}>
                Program <SortIcon field="program" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('exam_date')}>
                Date <SortIcon field="exam_date" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('start_time')}>
                Time <SortIcon field="start_time" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('room')}>
                Place <SortIcon field="room" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('student_count')}>
                Count <SortIcon field="student_count" />
              </th>
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
                <td className="px-4 py-4 text-sm text-gray-600">
                  {exam.exam_type || '-'}
                </td>
                <td className="px-4 py-4 text-sm text-gray-600">
                  {exam.program || '-'}
                </td>
                <td className="px-4 py-4 text-sm text-gray-900">
                  {formatDate(exam.exam_date)}
                </td>
                <td className="px-4 py-4 text-sm text-gray-600">
                  <div className="whitespace-nowrap">P{getPeriodFromTime(exam.start_time)}: {exam.start_time} - {exam.end_time || '?'}</div>
                </td>
                <td className="px-4 py-4 text-sm text-gray-900">
                  {exam.room?.room_name || 'TBD'}
                </td>
                <td className="px-4 py-4 text-sm text-gray-900">
                  {exam.student_count}
                </td>
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

