'use client';

import { useState } from 'react';
import { useSchedulingStore } from '@/lib/stores/scheduling-store';
import { DraggableStaffItem } from './draggable-staff-item';
import { Search } from 'lucide-react';
import { getPeriodFromTime } from '@/types/database.types';
import type { Staff, ExamSessionWithRelations } from '@/types/database.types';
import { BulkReplaceModal } from './bulk-replace-modal';

export function StaffSidebar() {
  const { staff, examSessions, periodFreeStaff } = useSchedulingStore();
  const [search, setSearch] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('All');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('name');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [dayStatusFilter, setDayStatusFilter] = useState<'All' | 'Working' | 'Off'>('Working');
  const [assignmentFilter, setAssignmentFilter] = useState<'All' | 'Assigned' | 'Unassigned'>('All');
  const [staffToReplace, setStaffToReplace] = useState<Staff | null>(null);

  const uniqueExamDates = Array.from(new Set(examSessions.map((s: ExamSessionWithRelations) => s.exam_date))).sort();
  const currentWeekStart = uniqueExamDates.length > 0 ? uniqueExamDates[0] : new Date().toISOString().split('T')[0];

  const filteredStaff = staff.filter((s: Staff) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || 
                          s.job_title.toLowerCase().includes(search.toLowerCase());
    const matchesAvailability = availabilityFilter === 'All' || s.availability_status === availabilityFilter;
    const matchesRole = roleFilter === 'All' || s.supervision_role === roleFilter;
    
    const matchesDate = !dateFilter || (() => {
      const dayName = new Date(`${dateFilter}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
      const hasSpecificOffDates = s.specific_off_dates && s.specific_off_dates.length > 0;
      
      let isOffDay = false;
      
      // Basic check: is the specific date explicitly an off date?
      if (hasSpecificOffDates && s.specific_off_dates.includes(dateFilter)) {
        isOffDay = true;
      } else {
        // Determine if the day is a recurring off day
        let isRecurringOff = false;
        if (hasSpecificOffDates) {
          const sameWeekdays = uniqueExamDates.filter(d => 
            new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }) === dayName
          );
          isRecurringOff = sameWeekdays.length > 0 && sameWeekdays.every(d => s.specific_off_dates?.includes(d));
        }
        
        if (isRecurringOff) {
          isOffDay = true;
        } else {
          // Check normal working days
          if (!hasSpecificOffDates && s.working_days && !s.working_days.includes(dayName)) {
            isOffDay = true;
          }
        }
      }
      
      if (dayStatusFilter === 'Working') return !isOffDay;
      if (dayStatusFilter === 'Off') return isOffDay;
      return true; // 'All'
    })();

    const matchesAssignment = assignmentFilter === 'All' || (() => {
      const sessionsToCheck = dateFilter 
        ? examSessions.filter(session => session.exam_date === dateFilter)
        : examSessions;
        
      const isAssignedToSession = sessionsToCheck.some(session => 
        session.assignments?.some((a: any) => a.staff_id === s.id)
      );

      const isAssignedAsReserve = dateFilter
        ? periodFreeStaff.some((p: any) => p.exam_date === dateFilter && p.staff_id === s.id)
        : periodFreeStaff.some((p: any) => p.staff_id === s.id);

      const isAssigned = isAssignedToSession || isAssignedAsReserve;

      if (assignmentFilter === 'Assigned') return isAssigned;
      if (assignmentFilter === 'Unassigned') return !isAssigned;
      return true;
    })();

    return matchesSearch && matchesAvailability && matchesRole && matchesDate && matchesAssignment;
  });

  // Calculate assignments/periods per staff for the current week (currently loaded sessions)
  const weeklyCounts = new Map<string, number>();
  
  // Track unique periods/slots assigned to each staff member to count them correctly
  const staffPeriods = new Map<string, Set<string>>();
  const staffAssignmentsCount = new Map<string, number>();

  examSessions.forEach((session: ExamSessionWithRelations) => {
    session.assignments?.forEach((assignment: any) => {
      const staffId = assignment.staff_id;
      
      // Look up staff supervision role
      const staffMember = staff.find((s: Staff) => s.id === staffId);
      const isCommSupervisor = staffMember?.supervision_role === 'Committees Supervisor';

      if (isCommSupervisor) {
        if (!staffPeriods.has(staffId)) {
          staffPeriods.set(staffId, new Set());
        }
        const period = getPeriodFromTime(session.start_time);
        staffPeriods.get(staffId)!.add(`${session.exam_date}_${period}`);
      } else {
        const currentCount = staffAssignmentsCount.get(staffId) || 0;
        staffAssignmentsCount.set(staffId, currentCount + 1);
      }
    });
  });

  // Populate weeklyCounts map
  staff.forEach(s => {
    if (s.supervision_role === 'Committees Supervisor') {
      weeklyCounts.set(s.id, staffPeriods.get(s.id)?.size || 0);
    } else {
      weeklyCounts.set(s.id, staffAssignmentsCount.get(s.id) || 0);
    }
  });

  return (
    <div className="w-72 bg-gray-50 border-l border-gray-200 p-4 h-full flex flex-col flex-shrink-0" style={{ zIndex: 40 }}>
      <h3 className="font-semibold text-gray-900 mb-2">Available Staff</h3>
      
      {/* Mini Stats for Decision Making */}
      <div className="mb-4">
        <div className="flex h-2 w-full rounded-full overflow-hidden bg-gray-200">
          <div className="bg-emerald-500" style={{ width: `${(staff.filter(s => s.availability_status === 'Available').length / (staff.length || 1)) * 100}%` }} title="Available" />
          <div className="bg-red-500" style={{ width: `${(staff.filter(s => s.availability_status === 'Unavailable').length / (staff.length || 1)) * 100}%` }} title="Unavailable" />
          <div className="bg-gray-400" style={{ width: `${(staff.filter(s => s.availability_status === 'On-Leave').length / (staff.length || 1)) * 100}%` }} title="On-Leave" />
        </div>
        <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-medium">
          <span className="text-emerald-600">{staff.filter(s => s.availability_status === 'Available').length} Avail</span>
          <span className="text-red-500">{staff.filter(s => s.availability_status === 'Unavailable').length} Unavail</span>
          <span className="text-gray-500">{staff.filter(s => s.availability_status === 'On-Leave').length} On-Leave</span>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input 
            type="text"
            placeholder="Search staff..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-white"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value)}
            className="w-1/2 px-2 py-1.5 text-xs border rounded-md bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="All">All Statuses</option>
            <option value="Available">Available</option>
            <option value="On-Leave">On Leave</option>
            <option value="Unavailable">Unavailable</option>
          </select>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-1/2 px-2 py-1.5 text-xs border rounded-md bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">Any Date</option>
            {uniqueExamDates.map(d => (
              <option key={d} value={d}>
                {new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          {dateFilter && (
            <select
              value={dayStatusFilter}
              onChange={(e) => setDayStatusFilter(e.target.value as any)}
              className="w-1/2 px-2 py-1.5 text-xs border rounded-md bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="All">Show All Staff</option>
              <option value="Working">Working Day Only</option>
              <option value="Off">Off Day Only</option>
            </select>
          )}
          <select
            value={assignmentFilter}
            onChange={(e) => setAssignmentFilter(e.target.value as any)}
            className={`${dateFilter ? 'w-1/2' : 'w-full'} px-2 py-1.5 text-xs border rounded-md bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-500`}
          >
            <option value="All">Any Assignment</option>
            <option value="Assigned">{dateFilter ? 'Assigned on Day' : 'Assigned in Week'}</option>
            <option value="Unassigned">{dateFilter ? 'Unassigned on Day' : 'Unassigned in Week'}</option>
          </select>
        </div>
        <div className="flex gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-1/2 px-2 py-1.5 text-xs border rounded-md bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="All">All Roles</option>
            <option value="Committees Supervisor">Comm Sprv</option>
            <option value="Exam Supervisor">Exam Sprv</option>
            <option value="Invigilator">Invigilator</option>
            <option value="Invigilator / Exam Supervisor">Invig / Exam Sprv</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-1/2 px-2 py-1.5 text-xs border rounded-md bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="name">Sort: Name</option>
            <option value="lowest_total">Lowest Total</option>
            <option value="lowest_current">Lowest Main</option>
            <option value="lowest_free">Lowest Reserve</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-20 custom-scrollbar pr-1">
        {filteredStaff.length === 0 ? (
          <p className="text-sm text-gray-500 italic text-center">No staff found.</p>
        ) : (
          ['Committees Supervisor', 'Exam Supervisor', 'Invigilator', 'Invigilator / Exam Supervisor'].map(role => {
            let staffInRole = filteredStaff.filter(s => s.supervision_role === role);
            if (staffInRole.length === 0) return null;

            // Apply sorting
            staffInRole = staffInRole.sort((a, b) => {
              if (sortBy === 'lowest_free') {
                return (a.free_staff_score || 0) - (b.free_staff_score || 0);
              }
              if (sortBy === 'lowest_current') {
                return (a.current_score || 0) - (b.current_score || 0);
              }
              if (sortBy === 'lowest_total') {
                const totalA = (a.current_score || 0) + ((a.free_staff_score || 0) * 0.25);
                const totalB = (b.current_score || 0) + ((b.free_staff_score || 0) * 0.25);
                return totalA - totalB;
              }
              return a.name.localeCompare(b.name);
            });
            return (
              <div key={role} className="space-y-2">
                <div className="sticky top-0 bg-gray-50 z-10 py-1.5 border-b border-gray-200">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    {role === 'Invigilator / Exam Supervisor' ? 'Invigilators / Exam Supervisors' : `${role}s`}
                  </h4>
                </div>
                {staffInRole.map((s) => (
                  <DraggableStaffItem 
                    key={s.id} 
                    staff={s} 
                    weeklyAssignmentsCount={weeklyCounts.get(s.id) || 0}
                    historicalScore={(s.current_score || 0) + ((s.free_staff_score || 0) * 0.25)}
                    onBulkReplace={setStaffToReplace}
                  />
                ))}
              </div>
            );
          })
        )}
      </div>

      {staffToReplace && (
        <BulkReplaceModal
          staff={staffToReplace}
          weekStart={currentWeekStart}
          onClose={() => setStaffToReplace(null)}
          onSuccess={() => {
            setStaffToReplace(null);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
