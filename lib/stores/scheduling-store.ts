import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { format } from 'date-fns';
import type {
  ExamSessionWithRelations,
  Staff,
  Room,
  SystemSettings,
  StaffingRatioRange,
  PeriodFreeStaff
} from '@/types/database.types';
import { getPeriodFromTime } from '@/types/database.types';
import { detectAllConflicts, Conflict } from '@/lib/utils/conflict-detection';

interface SchedulingState {
  // Data
  examSessions: ExamSessionWithRelations[];
  staff: Staff[];
  rooms: Room[];
  systemSettings: SystemSettings[];
  staffingRatios: StaffingRatioRange[];
  periodFreeStaff: PeriodFreeStaff[];

  // Conflicts
  conflicts: Map<string, Conflict[]>;

  // UI State
  selectedDate: Date | null;
  selectedSession: ExamSessionWithRelations | null;
  isLoading: boolean;
  error: string | null;

  // Filters
  filterByDate: Date | null;
  filterByRoom: string | null;
  filterByStaff: string | null;
  showConflictsOnly: boolean;

  // Actions
  setExamSessions: (sessions: ExamSessionWithRelations[]) => void;
  setStaff: (staff: Staff[]) => void;
  setRooms: (rooms: Room[]) => void;
  setSystemSettings: (settings: SystemSettings[]) => void;
  setStaffingRatios: (ratios: StaffingRatioRange[]) => void;
  setPeriodFreeStaff: (reserves: PeriodFreeStaff[]) => void;
  setSelectedDate: (date: Date | null) => void;
  setSelectedSession: (session: ExamSessionWithRelations | null) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setFilterByDate: (date: Date | null) => void;
  setFilterByRoom: (roomId: string | null) => void;
  setFilterByStaff: (staffId: string | null) => void;
  setShowConflictsOnly: (show: boolean) => void;

  // Conflict detection
  refreshConflicts: () => void;
  getSessionConflicts: (sessionId: string) => Conflict[];
  hasSessionConflicts: (sessionId: string) => boolean;

  // Computed
  getSessionsByDate: (date: Date) => ExamSessionWithRelations[];
  getSessionsByWeek: (startDate: Date) => ExamSessionWithRelations[];
  getStaffById: (id: string) => Staff | undefined;
  getRoomById: (id: string) => Room | undefined;
  getAvailableStaff: (date: string, period: number) => Staff[];

  // Reset
  reset: () => void;
}

const DEFAULT_STAFFING_RATIOS: StaffingRatioRange[] = [
  { min: 1, max: 9, head_supervisors: 1, assistants: 0 },
  { min: 10, max: 30, head_supervisors: 1, assistants: 1 },
  { min: 31, max: 50, head_supervisors: 1, assistants: 2 },
  { min: 51, max: 60, head_supervisors: 1, assistants: 3 },
  { min: 61, max: 9999, head_supervisors: 1, assistants: 4 },
];

const initialState = {
  examSessions: [],
  staff: [],
  rooms: [],
  systemSettings: [],
  staffingRatios: DEFAULT_STAFFING_RATIOS,
  periodFreeStaff: [],
  conflicts: new Map<string, Conflict[]>(),
  selectedDate: null,
  selectedSession: null,
  isLoading: false,
  error: null,
  filterByDate: null,
  filterByRoom: null,
  filterByStaff: null,
  showConflictsOnly: false,
};

export const useSchedulingStore = create<SchedulingState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setExamSessions: (sessions) => {
        set({ examSessions: sessions });
        get().refreshConflicts();
      },
      setStaff: (staff) => {
        set({ staff });
        get().refreshConflicts();
      },
      setRooms: (rooms) => set({ rooms }),
      setSystemSettings: (settings) => {
        set({ systemSettings: settings });
        get().refreshConflicts();
      },
      setStaffingRatios: (ratios) => {
        set({ staffingRatios: ratios });
        get().refreshConflicts();
      },
      setPeriodFreeStaff: (reserves) => {
        set({ periodFreeStaff: reserves });
        get().refreshConflicts();
      },
      setSelectedDate: (date) => set({ selectedDate: date }),
      setSelectedSession: (session) => set({ selectedSession: session }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      setFilterByDate: (date) => set({ filterByDate: date }),
      setFilterByRoom: (roomId) => set({ filterByRoom: roomId }),
      setFilterByStaff: (staffId) => set({ filterByStaff: staffId }),
      setShowConflictsOnly: (show) => set({ showConflictsOnly: show }),

      refreshConflicts: () => {
        const { examSessions, systemSettings, periodFreeStaff, staffingRatios } = get();
        const constraintsSetting = systemSettings.find(s => s.setting_key === 'scheduling_constraints');
        const allowConsecutive = constraintsSetting?.setting_value?.allow_consecutive_shifts ?? false;
        
        const ratiosSetting = systemSettings.find(s => s.setting_key === 'staffing_ratios');
        const fullStaffingRatiosConfig = ratiosSetting?.setting_value || { ranges: staffingRatios };

        const calendarRulesSetting = systemSettings.find(s => s.setting_key === 'calendar_rules');
        const calendarRules = calendarRulesSetting?.setting_value || [];

        const conflicts = detectAllConflicts(examSessions, fullStaffingRatiosConfig, allowConsecutive, periodFreeStaff, calendarRules);
        set({ conflicts });
      },

      getSessionConflicts: (sessionId) => {
        return get().conflicts.get(sessionId) || [];
      },

      hasSessionConflicts: (sessionId) => {
        const conflicts = get().conflicts.get(sessionId);
        return conflicts ? conflicts.length > 0 : false;
      },

      getSessionsByDate: (date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return get().examSessions.filter(
          session => session.exam_date === dateStr
        );
      },

      getSessionsByWeek: (startDate) => {
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);

        const startStr = format(startDate, 'yyyy-MM-dd');
        const endStr = format(endDate, 'yyyy-MM-dd');

        return get().examSessions.filter(
          session => session.exam_date >= startStr && session.exam_date < endStr
        );
      },

      getStaffById: (id) => {
        return get().staff.find(s => s.id === id);
      },

      getRoomById: (id) => {
        return get().rooms.find(r => r.id === id);
      },

      getAvailableStaff: (date, period) => {
        const { staff, examSessions } = get();
        const sessionsAtSlot = examSessions.filter(
          s => s.exam_date === date && getPeriodFromTime(s.start_time) === period
        );
        const assignedStaffIds = new Set<string>();
        sessionsAtSlot.forEach(s => {
          s.assignments?.forEach(a => {
            const member = staff.find(st => st.id === a.staff_id);
            if (member?.supervision_role !== 'Committees Supervisor') {
              assignedStaffIds.add(a.staff_id);
            }
          });
        });

        return staff.filter(s =>
          s.availability_status === 'Available' &&
          !assignedStaffIds.has(s.id)
          // Part-time staff shown for all periods — the UI can display a badge,
          // but they should not be hidden from manual selection.
        );
      },

      reset: () => set(initialState),
    }),
    { name: 'scheduling-store' }
  )
);

