import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { Staff, StaffFormData, JobTitle, EmploymentStatus, AvailabilityStatus, Room, RoomFormData, Assignment, ExamSession, AssignmentRole, StaffingRatiosConfig, SupervisionRole, CalendarRule } from '@/types/database.types';
import { parseRoomCode, getPeriodFromTime } from '@/types/database.types';

// Valid values for validation
const VALID_JOB_TITLES: JobTitle[] = ['Chemist', 'Demonstrator', 'Teaching Assistant', 'Lecturer'];
const VALID_EMPLOYMENT_STATUS: EmploymentStatus[] = ['Full-time', 'Part-time'];
const VALID_AVAILABILITY_STATUS: AvailabilityStatus[] = ['Available', 'On-Leave', 'Unavailable'];
const VALID_SUPERVISION_ROLES: SupervisionRole[] = ['Invigilator', 'Committees Supervisor', 'Exam Supervisor', 'Invigilator / Exam Supervisor'];

/**
 * Robustly parses and normalizes supervision role values
 */
export function parseSupervisionRole(raw: string): SupervisionRole {
  const normalized = safeTrim(raw).toLowerCase().replace(/\s+/g, ' ');

  // Look for variants of "Invigilator / Exam Supervisor"
  if (
    (normalized.includes('invig') && normalized.includes('exam')) ||
    normalized.includes('invigilator / exam supervisor') ||
    normalized.includes('invigilator/exam supervisor') ||
    normalized.includes('invigilator /exam supervisor') ||
    normalized.includes('invigilator/ exam supervisor')
  ) {
    return 'Invigilator / Exam Supervisor';
  }
  
  if (normalized.includes('committee')) {
    return 'Committees Supervisor';
  }
  
  if (normalized.includes('exam') && normalized.includes('supervisor')) {
    return 'Exam Supervisor';
  }
  
  if (normalized.includes('invigilator') || normalized.includes('invig')) {
    return 'Invigilator';
  }

  const found = VALID_SUPERVISION_ROLES.find(r => r.toLowerCase() === normalized);
  if (found) return found;

  return 'Invigilator';
}

export interface CSVParseResult<T> {
  success: boolean;
  data: T[];
  errors: string[];
  missingRooms?: string[];
}

/**
 * Safely convert any value to string and trim it
 */
function safeTrim(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * Helper to find value in row by fuzzy matching key
 */
function getValueFuzzy(row: any, candidates: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    // 1. Try exact match
    if (row[candidate] !== undefined) return safeTrim(row[candidate]);

    // 2. Try case-insensitive match
    const foundKey = keys.find(k => k.trim().toLowerCase() === candidate.toLowerCase());
    if (foundKey) return safeTrim(row[foundKey]);
  }
  return undefined;
}

/**
 * Generic helper to parse file (CSV or Excel) into raw objects
 */
async function parseFileToRawData(file: File): Promise<any[]> {
  if (file.name.toLowerCase().endsWith('.csv')) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: (error) => reject(error),
      });
    });
  } else {
    // Excel
    const buffer = await file.arrayBuffer();
    // cellDates: true  → XLSX returns actual JS Date objects for date-type cells
    //                     instead of locale-formatted strings, eliminating D/M vs M/D ambiguity.
    // raw: false       → non-date cells are still returned as formatted strings.
    // dateNF           → fallback format used when the cell has no built-in format string.
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(sheet, { raw: false, dateNF: 'yyyy-mm-dd' });
  }
}

/**
 * Check if a row seems to be completely unrelated (likely wrong file type)
 * Returns true if all checked fields are undefined/empty
 */
function isRowEmptyOrMissingHeaders(row: any, requiredFields: string[]): boolean {
  return requiredFields.every(field => !row[field] && !safeTrim(row[field.trim()]));
}

/**
 * Encapsulated logic to process a single staff row
 */
function processStaffRow(row: any, rowNum: number, errors: string[]): StaffFormData | null {
  // First check if this looks like a valid row at all
  if (isRowEmptyOrMissingHeaders(row, ['name', 'email', 'job_title'])) {
    // Only report this once or if it's the first row, otherwise we might flood errors
    if (rowNum === 2) {
      errors.push(`Row ${rowNum}: Missing required columns (name, email, job_title). Are you uploading the correct Staff file?`);
    } else {
      errors.push(`Row ${rowNum}: Missing required data.`);
    }
    return null;
  }

  // Validate required fields
  if (!safeTrim(row.name)) {
    errors.push(`Row ${rowNum}: Name is required`);
    return null;
  }
  if (!safeTrim(row.email)) {
    errors.push(`Row ${rowNum}: Email is required`);
    return null;
  }

  // Validate job_title
  // Validate job_title
  let jobTitleInput = safeTrim(row.job_title);
  let jobTitleCandidate: JobTitle | null = null;

  // Map abbreviations to full titles
  const inputLower = jobTitleInput.toLowerCase();

  if (['chemist', 'c', 'ch'].includes(inputLower)) {
    jobTitleCandidate = 'Chemist';
  } else if (['demonstrator', 'd', 'dem', 'demonst'].includes(inputLower)) {
    jobTitleCandidate = 'Demonstrator';
  } else if (['teaching assistant', 'ta', 't.a.', 't.a', 'tassist'].includes(inputLower)) {
    jobTitleCandidate = 'Teaching Assistant';
  } else if (['lecturer', 'l'].includes(inputLower)) {
    jobTitleCandidate = 'Lecturer';
  }

  if (!jobTitleCandidate) {
    // Try exact match against valid titles
    if (VALID_JOB_TITLES.includes(jobTitleInput as JobTitle)) {
      jobTitleCandidate = jobTitleInput as JobTitle;
    } else {
      errors.push(`Row ${rowNum}: Invalid job_title "${row.job_title}". Must be Chemist (C), Demonstrator (D), Teaching Assistant (TA), or Lecturer (L)`);
      return null;
    }
  }

  const jobTitle = jobTitleCandidate;

  // Validate employment_status
  const employmentStatus = safeTrim(row.employment_status) as EmploymentStatus;
  if (!VALID_EMPLOYMENT_STATUS.includes(employmentStatus)) {
    errors.push(`Row ${rowNum}: Invalid employment_status "${row.employment_status}". Must be Full-time or Part-time`);
    return null;
  }

  // Validate availability_status (optional, defaults to Available)
  let availabilityStatus: AvailabilityStatus = 'Available';
  if (safeTrim(row.availability_status)) {
    const status = safeTrim(row.availability_status) as AvailabilityStatus;
    if (!VALID_AVAILABILITY_STATUS.includes(status)) {
      errors.push(`Row ${rowNum}: Invalid availability_status "${row.availability_status}"`);
      return null;
    }
    availabilityStatus = status;
  }

  // Weekday Matrix Parsing
  const weekDays = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
  const workingDays: string[] = [];

  let foundAnyDayColumn = false;

  for (const day of weekDays) {
    // Check for 'Saturday', 'Sat', etc.
    const val = getValueFuzzy(row, [day, day.slice(0, 3)]);
    if (val !== undefined) {
      foundAnyDayColumn = true;
      const v = val.toLowerCase();
      // If "yes", "y", "1", "true", "x" -> It's a working day
      if (['yes', 'y', '1', 'true', 'x'].includes(v)) {
        workingDays.push(day);
      }
    }
  }

  // Fallback for legacy files or if no columns found
  if (!foundAnyDayColumn) {
    weekDays.forEach(d => workingDays.push(d));
  }

  // Optional new fields (default if not present in CSV)
  const isFeedingMother = ['yes', 'y', '1', 'true'].includes(
    safeTrim(row.is_feeding_mother || row['Feeding Mother'] || '').toLowerCase()
  );
  const feedingMotherDays = parseInt(safeTrim(row.feeding_mother_days || row['FM Days'] || '0'), 10) || 0;
  const hasHealthIssue = ['yes', 'y', '1', 'true'].includes(
    safeTrim(row.has_health_issue || row['Health Issue'] || '').toLowerCase()
  );
  const isOverloaded = ['yes', 'y', '1', 'true'].includes(
    safeTrim(row.is_overloaded || row['Overloaded'] || '').toLowerCase()
  );
  const overloadPercentage = parseInt(safeTrim(row.overload_percentage || row['Overload %'] || row['Overload Percentage'] || '0'), 10) || 0;
  const supervisionRoleRaw = row.supervision_role || row['Supervision Role'] || 'Invigilator';
  const supervisionRole = parseSupervisionRole(supervisionRoleRaw);

  return {
    name: safeTrim(row.name),
    email: safeTrim(row.email).toLowerCase(),
    job_title: jobTitle,
    employment_status: employmentStatus,
    availability_status: availabilityStatus,
    working_days: workingDays,
    specific_off_dates: [], // Standard CSV has no per-date off information
    is_feeding_mother: isFeedingMother,
    feeding_mother_days: feedingMotherDays,
    has_health_issue: hasHealthIssue,
    is_overloaded: isOverloaded,
    overload_percentage: overloadPercentage,
    supervision_role: supervisionRole,
    can_supervise_oral: false,
  };
}

/**
 * Parse staff CSV/Excel file
 */
export async function parseStaffCSV(file: File): Promise<CSVParseResult<StaffFormData>> {
  try {
    const rawData = await parseFileToRawData(file);
    const data: StaffFormData[] = [];
    const errors: string[] = [];

    // Quick check logic to see if headers exist (for first row)
    if (rawData.length > 0) {
      const firstRow = rawData[0];
      // Check if important keys exist
      const hasStaffKeys = 'name' in firstRow || 'email' in firstRow;
      if (!hasStaffKeys) {
        return {
          success: false,
          data: [],
          errors: ['The uploaded file does not appear to contain the required headers (Name, Email, etc). Please download the template.'],
        };
      }
    }

    rawData.forEach((row, index) => {
      const rowNum = index + 2;
      const processed = processStaffRow(row, rowNum, errors);
      if (processed) data.push(processed);
    });

    return {
      success: errors.length === 0,
      data,
      errors,
    };
  } catch (error: any) {
    return {
      success: false,
      data: [],
      errors: [`Failed to parse file: ${error.message}`],
    };
  }
}

/**
 * Helper to download file (CSV or Excel)
 */
export function downloadFile(content: string | Blob, filename: string) {
  const url = typeof content === 'string'
    ? URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }))
    : URL.createObjectURL(content);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Export staff to Excel
 */
export function exportStaffToExcel(staff: Staff[]): Blob {
  const data = staff.map((s) => ({
    name: s.name,
    email: s.email,
    job_title: s.job_title,
    employment_status: s.employment_status,
    availability_status: s.availability_status,
    is_feeding_mother: s.is_feeding_mother ? 'Yes' : 'No',
    feeding_mother_days: s.feeding_mother_days || 0,
    has_health_issue: s.has_health_issue ? 'Yes' : 'No',
    is_overloaded: s.is_overloaded ? 'Yes' : 'No',
    overload_percentage: s.overload_percentage || 0,
    supervision_role: s.supervision_role || 'Invigilator',
    current_score: s.current_score,
    // Add Weekday Matrix Columns for Export
    Saturday: s.working_days?.includes('Saturday') ? 'Yes' : 'No',
    Sunday: s.working_days?.includes('Sunday') ? 'Yes' : 'No',
    Monday: s.working_days?.includes('Monday') ? 'Yes' : 'No',
    Tuesday: s.working_days?.includes('Tuesday') ? 'Yes' : 'No',
    Wednesday: s.working_days?.includes('Wednesday') ? 'Yes' : 'No',
    Thursday: s.working_days?.includes('Thursday') ? 'Yes' : 'No',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Staff");
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Get Excel template for staff import
 */
export function getStaffTemplate(): Blob {
  const template = [
    {
      name: 'John Doe',
      email: 'john@example.com',
      job_title: 'Chemist',
      employment_status: 'Full-time',
      availability_status: 'Available',
      is_feeding_mother: 'No',
      feeding_mother_days: 0,
      has_health_issue: 'No',
      is_overloaded: 'No',
      overload_percentage: 0,
      supervision_role: 'Exam Supervisor',
      Saturday: 'Yes', Sunday: 'Yes', Monday: 'Yes', Tuesday: 'Yes', Wednesday: 'Yes', Thursday: 'Yes'
    },
    {
      name: 'Jane Smith',
      email: 'jane@example.com',
      job_title: 'Teaching Assistant',
      employment_status: 'Part-time',
      availability_status: 'Available',
      is_feeding_mother: 'Yes',
      feeding_mother_days: 2,
      has_health_issue: 'No',
      is_overloaded: 'Yes',
      overload_percentage: 20,
      supervision_role: 'Invigilator',
      Saturday: 'Yes', Sunday: 'No', Monday: 'Yes', Tuesday: 'No', Wednesday: 'Yes', Thursday: 'No'
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(template);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Staff");

  // Create binary string
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ==================== ROOM CSV FUNCTIONS ====================

function processRoomRow(row: any, rowNum: number, errors: string[]): RoomFormData | null {
  if (!safeTrim(row.room_name)) {
    errors.push(`Row ${rowNum}: Room name is required`);
    return null;
  }

  const maxCapacity = parseInt(row.max_capacity, 10);
  if (isNaN(maxCapacity) || maxCapacity < 1) {
    errors.push(`Row ${rowNum}: Invalid max_capacity "${row.max_capacity}". Must be a positive number`);
    return null;
  }

  const room_name = safeTrim(row.room_name);
  let building = safeTrim(row.building) || undefined;
  let floor = row.floor ? parseInt(row.floor, 10) : undefined;

  if (!building || floor === undefined) {
    const parsed = parseRoomCode(room_name);
    if (!building && parsed.building_code) building = parsed.building_code;
    if (floor === undefined && parsed.floor_number) floor = parseInt(parsed.floor_number, 10);
  }

  return {
    room_name,
    max_capacity: maxCapacity,
    building,
    floor,
  };
}

/**
 * Parse room CSV/Excel file
 */
export async function parseRoomCSV(file: File): Promise<CSVParseResult<RoomFormData>> {
  try {
    const rawData = await parseFileToRawData(file);
    const data: RoomFormData[] = [];
    const errors: string[] = [];

    if (rawData.length > 0) {
      const firstRow = rawData[0];
      if (!('room_name' in firstRow)) {
        return {
          success: false,
          data: [],
          errors: ['The uploaded file does not appear to contain "room_name". Please download the template.'],
        };
      }
    }

    rawData.forEach((row, index) => {
      const rowNum = index + 2;
      const processed = processRoomRow(row, rowNum, errors);
      if (processed) data.push(processed);
    });

    return { success: errors.length === 0, data, errors };
  } catch (error: any) {
    return { success: false, data: [], errors: [`Failed to parse file: ${error.message}`] };
  }
}

/**
 * Export rooms to Excel
 */
export function exportRoomsToExcel(rooms: Room[]): Blob {
  const data = rooms.map((r) => ({
    room_name: r.room_name,
    max_capacity: r.max_capacity,
    building: r.building || '',
    floor: r.floor ?? '',
    is_active: r.is_active ? 'Yes' : 'No',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Rooms");
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Get Excel template for room import
 */
export function getRoomTemplate(): Blob {
  const template = [
    { room_name: 'CS Lab 1', max_capacity: 30, building: 'Main Building', floor: 1 },
    { room_name: 'Room 201', max_capacity: 50, building: 'Engineering Block', floor: 2 },
  ];
  const worksheet = XLSX.utils.json_to_sheet(template);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Rooms");
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ==================== EXAM SESSION CSV FUNCTIONS ====================

export interface ExamCSVData {
  subject_name: string;
  exam_date: string;
  start_time: string;
  student_count: number;
  room_name: string;
  exam_type?: string;
  end_time?: string;
  student_start?: string;
  student_end?: string;
}

/**
 * Parse exam session CSV/Excel file
 */
export async function parseExamCSV(file: File, roomMap: Map<string, string>): Promise<CSVParseResult<ExamCSVData & { room_id: string }>> {
  try {
    const rawData = await parseFileToRawData(file);
    const data: (ExamCSVData & { room_id: string })[] = [];
    const errors: string[] = [];
    const missingRooms = new Set<string>();

    if (rawData.length > 0) {
      const firstRow = rawData[0];
      // Check for common exam headers
      const examHeaders = ['Exam', 'subject_name', 'Date', 'exam_date', 'Place', 'room_name'];
      const hasExamHeaders = examHeaders.some(h => h in firstRow);
      if (!hasExamHeaders) {
        return {
          success: false,
          data: [],
          errors: ['The uploaded file does not appear to be an Exam schedule (missing Exam, Date, or Place headers). Please download the template.'],
        };
      }
    }

    rawData.forEach((row, index) => {
      const rowNum = index + 2;

      // Mapping from user-friendly headers to internal fields
      // Headers: Exam, Type, Date, From, To, Place, Count, Start, End
      // Mapped: subject_name, exam_type, exam_date, start_time, end_time, room_name, student_count, student_start, student_end

      // Mapped: subject_name, exam_type, exam_date, start_time, end_time, room_name, student_count, student_start, student_end

      const subjectName = getValueFuzzy(row, ['Exam', 'Subject', 'subject_name', 'Course']);
      if (!subjectName) {
        errors.push(`Row ${rowNum}: Exam (Subject name) is required`);
        return;
      }

      const examDate = getValueFuzzy(row, ['Date', 'exam_date', 'Day']);
      if (!examDate) {
        errors.push(`Row ${rowNum}: Date is required`);
        return;
      }
      // Try multiple common headers for Room/Place
      // Try multiple common headers for Room/Place
      const roomName = getValueFuzzy(row, ['Place', 'Room', 'Hall', 'Location', 'Venue', 'room_name', 'Room Name']);

      if (!roomName) {
        errors.push(`Row ${rowNum}: Place (Room name) is required. Tried 'Place', 'Room', 'Hall', 'Location'.`);
        return;
      }

      let roomId = roomMap.get(roomName.toLowerCase());
      if (!roomId) {
        missingRooms.add(roomName);
        roomId = '';
      }

      const startTime = getValueFuzzy(row, ['From', 'Start Time', 'start_time', 'Time']) || '09:30';

      const studentCountVal = getValueFuzzy(row, ['Count', 'Student Count', 'student_count', 'No of Students']);
      const studentCount = parseInt(studentCountVal || '0', 10);
      if (isNaN(studentCount) || studentCount < 1) {
        errors.push(`Row ${rowNum}: Count (Student count) must be at least 1`);
        return;
      }


      data.push({
        subject_name: subjectName,
        exam_date: examDate,
        start_time: startTime,
        student_count: studentCount,
        room_name: roomName,
        room_id: roomId,
        exam_type: safeTrim(row['Type']) || safeTrim(row.exam_type) || undefined,
        end_time: safeTrim(row['To']) || safeTrim(row.end_time) || undefined,
        student_start: safeTrim(row['Start']) || safeTrim(row.student_start) || undefined,
        student_end: safeTrim(row['End']) || safeTrim(row.student_end) || undefined,
      });
    });

    return { success: errors.length === 0, data, errors, missingRooms: Array.from(missingRooms) };
  } catch (error: any) {
    return { success: false, data: [], errors: [`Failed to parse file: ${error.message}`] };
  }
}

/**
 * Export exams to Excel
 */
export function exportExamsToExcel(exams: any[]): Blob {
  const data = exams.map((e) => ({
    subject_name: e.subject_name,
      program: e.program || '',
    exam_type: e.exam_type || '',
    exam_date: e.exam_date,
    period: getPeriodFromTime(e.start_time),
    start_time: e.start_time,
    end_time: e.end_time || '',
    room_name: e.room?.room_name || e.room_name || '',
    student_count: e.student_count,
    student_start: e.student_start || '',
    student_end: e.student_end || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Exams");
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Get Excel template for exam import
 */
export function getExamTemplate(): Blob {
  const template = [
    {
      subject_name: 'Introduction to Computing',
      exam_type: 'Final',
      exam_date: '2025-01-20',
      start_time: '09:00',
      end_time: '11:00',
      room_name: 'Hall A',
      student_count: 50,
      student_start: '1',
      student_end: '50',
    },
    {
      subject_name: 'Data Structures',
      exam_type: 'Midterm',
      exam_date: '2025-01-22',
      start_time: '13:00',
      end_time: '14:30',
      room_name: 'Room 201',
      student_count: 35,
      student_start: 'A1',
      student_end: 'A35',
    },
  ];
  const worksheet = XLSX.utils.json_to_sheet(template);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Exams");
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
// ==================== ASSIGNMENT CSV FUNCTIONS ====================

export interface AssignmentCSVData {
  exam_subject: string;
  exam_date: string;
  period: number;
  room_name: string;
  staff_name: string;
  role: 'Head_Supervisor' | 'Assistant';
}

// Import calculateRequiredStaff from auto-assignment logic
// To avoid importing large files, we duplicate the small calculation logic or move it to a shared util
// Since `auto-assignment.ts` is in `lib/algorithms`, importing it here might be fine if no circular deps.
// `auto-assignment` imports `types`. `csv-helpers` imports `types`. 
import { calculateRequiredStaff } from '@/lib/algorithms/auto-assignment';

// ... (CSV Functions)

/**
 * Generate an Excel report for all swap requests
 */
export function exportSwapsToExcel(swaps: any[]): Blob {
  const data = swaps.map(swap => {
    return {
      'Request ID': swap.id,
      'Requested On': swap.created_at ? new Date(swap.created_at).toISOString().split('T')[0] : '',
      'Status': swap.status.charAt(0).toUpperCase() + swap.status.slice(1),
      'Original Staff': swap.original_staff?.name || 'Unknown',
      'Replacement Staff': swap.replacement_staff?.name || 'Unknown',
      'Reason': swap.reason || '',
      'Session Details': swap.session_details || '',
      'Room': swap.room?.room_name || 'Unknown',
      'Reviewed By': swap.reviewed_by_id || '',
      'Reviewed At': swap.reviewed_at ? new Date(swap.reviewed_at).toISOString().split('T')[0] : '',
    };
  });
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Swap Requests");
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Generate detailed assignment report (Excel) - WIDE FORMAT
 */
export function generateAssignmentReport(
  assignments: Assignment[],
  violations: string[],
  staff: Staff[],
  exams: ExamSession[],
  rooms: Room[],
  staffingRatios?: StaffingRatiosConfig,
  calendarRules: CalendarRule[] = []
): Blob {
  const workbook = XLSX.utils.book_new();

  // 1. Group Assignments by Session
  const sessionMap = new Map<string, { exam_supervisors: Staff[], head: Staff[], assistants: Staff[] }>();
  assignments.forEach(a => {
    if (!sessionMap.has(a.exam_session_id)) {
      sessionMap.set(a.exam_session_id, { exam_supervisors: [], head: [], assistants: [] });
    }
    const entry = sessionMap.get(a.exam_session_id)!;
    const s = staff.find(st => st.id === a.staff_id);
    if (s) {
      if (a.role === 'Exam_Supervisor') entry.exam_supervisors.push(s);
      else if (a.role === 'Head_Supervisor' || a.role === 'Committees_Supervisor') entry.head.push(s);
      else entry.assistants.push(s);
    }
  });

  // 2. Pre-calculate Room Totals to match the algorithm's group logic
  const roomTotals = new Map<string, number>();
  exams.forEach(e => {
      const key = `${e.room_id}_${e.exam_date}_${e.start_time}`;
      roomTotals.set(key, (roomTotals.get(key) || 0) + e.student_count);
  });

  // 3. Build Wide Rows + compute missing roles per session
  const missingRoleRows: any[] = [];

  const reportRows = exams.map(exam => {
    const assignments = sessionMap.get(exam.id) || { exam_supervisors: [], head: [], assistants: [] };
    const room = exam.room_id ? rooms.find(r => r.id === exam.room_id) : null;
    const roomName = room?.room_name || (exam as any).room?.room_name || (exam as any).room_name || 'Unknown';

    // Calculate required based on the COMBINED student count of all exams sharing this room and time
    const key = `${exam.room_id}_${exam.exam_date}_${exam.start_time}`;
    const effectiveCount = roomTotals.get(key) || exam.student_count;

    const effectiveRatios = staffingRatios || { ranges: [] };
    const isOral = !!exam.exam_type?.toLowerCase().includes('oral');
    const req = calculateRequiredStaff(effectiveCount, effectiveRatios, isOral, exam.exam_date, calendarRules);
    const requiredHead = req.headSupervisors;
    const requiredAssist = req.assistants;

    const period = getPeriodFromTime(exam.start_time);

    // --- Detect missing supervision roles ---
    const missingParts: string[] = [];

    // Committees Supervisor / Head Supervisor
    if (requiredHead > 0 && assignments.head.length === 0) {
      missingParts.push('Committees Supervisor');
    }

    // Exam Supervisor (always required — 1 per room)
    if (assignments.exam_supervisors.length === 0) {
      missingParts.push('Exam Supervisor');
    }

    // Invigilators — check deficit
    const invigilatorDeficit = requiredAssist - assignments.assistants.length;
    if (invigilatorDeficit > 0) {
      missingParts.push(`${invigilatorDeficit} Invigilator${invigilatorDeficit > 1 ? 's' : ''}`);
    }

    const missingFlag = missingParts.length > 0 ? `⚠ Missing: ${missingParts.join(', ')}` : '✓ Complete';

    const row: any = {
      'Date': exam.exam_date,
      'Period': period,
      'Time': exam.start_time,
      'End Time': exam.end_time || '',
      'Room': roomName,
      'Students': exam.student_count,
      'Subject': exam.subject_name,
      'Program': exam.program || '',
      'Exam Type': exam.exam_type || '',
      'Committees Supervisor': assignments.head.map(s => s.name).join(', '),
      'Exam Supervisor': assignments.exam_supervisors.map(s => s.name).join(', '),
      'Invigilator 1': assignments.assistants[0]?.name || '',
      'Invigilator 2': assignments.assistants[1]?.name || '',
      'Invigilator 3': assignments.assistants[2]?.name || '',
      'Invigilator 4': assignments.assistants[3]?.name || '',
      '⚠ Missing Roles': missingFlag,
    };

    // Collect rows with missing roles for the dedicated sheet
    if (missingParts.length > 0) {
      missingRoleRows.push({
        'Subject': exam.subject_name,
        'Program': exam.program || '',
        'Exam Type': exam.exam_type || '',
        'Date': exam.exam_date,
        'Period': period,
        'Room': roomName,
        'Student Count': exam.student_count,
        'Missing Roles': missingParts.join(', '),
        'Committees Supervisor Assigned': assignments.head.map(s => s.name).join(', ') || '— EMPTY —',
        'Exam Supervisor Assigned': assignments.exam_supervisors.map(s => s.name).join(', ') || '— EMPTY —',
        'Invigilators Assigned': assignments.assistants.map(s => s.name).join(', ') || '— EMPTY —',
        'Required Invigilators': requiredAssist,
        'Actual Invigilators': assignments.assistants.length,
      });
    }

    return row;
  });

  // Sort by Date then Period
  reportRows.sort((a, b) => {
    if (a.Date !== b.Date) return a.Date.localeCompare(b.Date);
    return Number(a.Period) - Number(b.Period);
  });

  if (reportRows.length > 0) {
    const wsAssignments = XLSX.utils.json_to_sheet(reportRows);
    XLSX.utils.book_append_sheet(workbook, wsAssignments, "Schedule View");
  } else {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ Info: 'No assignments generated' }]), "Schedule View");
  }

  // Sheet 2: Missing Roles — only rooms with incomplete supervision
  missingRoleRows.sort((a: any, b: any) => {
    if (a.Date !== b.Date) return a.Date.localeCompare(b.Date);
    return Number(a.Period) - Number(b.Period);
  });
  if (missingRoleRows.length > 0) {
    const wsMissing = XLSX.utils.json_to_sheet(missingRoleRows);
    XLSX.utils.book_append_sheet(workbook, wsMissing, "⚠ Missing Roles");
  } else {
    const wsComplete = XLSX.utils.json_to_sheet([{ 'Status': '✓ All rooms have complete supervision coverage.' }]);
    XLSX.utils.book_append_sheet(workbook, wsComplete, "⚠ Missing Roles");
  }

  // Sheet 3: Violations
  if (violations.length > 0) {
    const violationRows = violations.map(v => ({ 'Issue': v }));
    const wsViolations = XLSX.utils.json_to_sheet(violationRows);
    XLSX.utils.book_append_sheet(workbook, wsViolations, "Issues");
  }

  // Generate blob
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function calculateEndTime(startTime: string, durationMinutes: number): string {
  if (!startTime) return '';
  try {
    const [h, m] = startTime.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m + durationMinutes);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch (e) { return ''; }
}

/**
 * Export assignments for manual editing - LIST FORMAT with Extra Context
 */
export function exportAssignmentsToExcel(
  assignments: Assignment[],
  staff: Staff[],
  exams: ExamSession[],
  rooms: Room[]
): Blob {
  const data = assignments.map(a => {
    const session = exams.find(e => e.id === a.exam_session_id);
    const staffMember = staff.find(s => s.id === a.staff_id);
    const room = session?.room_id ? rooms.find(r => r.id === session.room_id) : null;
    const roomName = room?.room_name || (session as any)?.room?.room_name || '';

    // We include Name/Email for easy editing, and context like Date/Period/Room
    return {
      'Subject': session?.subject_name || '',
        'Program': session?.program || '',
        'Exam Type': session?.exam_type || '',
      'Date': session?.exam_date || '',
      'Period': session ? getPeriodFromTime(session.start_time) : '',
      'Time': session?.start_time || '',
      'Room': roomName,
      'Student Count': session?.student_count || '',
      'Staff Name': staffMember?.name || '',
      'Staff Email': staffMember?.email || '', // Key for import
      'Staff Role': a.role
    };
  });

  // Sort
  data.sort((a, b) => {
    if (a.Date !== b.Date) return a.Date.localeCompare(b.Date);
    return Number(a.Period) - Number(b.Period);
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Assignments");
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Normalize common Arabic spelling variations for robust name matching
 */
function normalizeArabicString(str: string): string {
  return str
    .replace(/[أإآ]/g, 'ا') // Normalize alefs
    .replace(/ة/g, 'ه')     // Normalize teh marbuta to heh
    .replace(/ى/g, 'i')     // Let's normalize alef maksura and yeh:
    .replace(/ي/g, 'i')     // both map to same character 'i' to handle spelling variations
    .replace(/\s+/g, ' ')   // Normalize whitespace
    .trim();
}

/**
 * Clean academic titles and normalize Arabic text in staff names for matching
 */
function findStaffByName(name: string, staff: Staff[]): Staff | null {
  const normName = name.toLowerCase().trim();
  if (!normName) return null;

  const cleanName = (n: string) => {
    // Remove Egyptian academic titles: "د/", "د.", "أ/", "أ.د/", "أ.د.", "م/", "م."
    const withoutTitles = n
      .replace(/^(أ\.د\.|أ\.د\/|د\.|د\/|أ\.|أ\/|م\.|م\/)\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
    return normalizeArabicString(withoutTitles);
  };

  const targetClean = cleanName(normName);

  // Try exact match on clean name
  let matched = staff.find(s => cleanName(s.name.toLowerCase()) === targetClean);
  if (matched) return matched;

  // Try partial match on clean name
  matched = staff.find(s => {
    const sClean = cleanName(s.name.toLowerCase());
    return sClean.includes(targetClean) || targetClean.includes(sClean);
  });

  return matched || null;
}

/**
 * Normalize date string or Date object to YYYY-MM-DD
 */
function normalizeDateString(dateInput: any): string {
  if (!dateInput) return '';
  if (dateInput instanceof Date) {
    const y = dateInput.getFullYear();
    const m = String(dateInput.getMonth() + 1).padStart(2, '0');
    const d = String(dateInput.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(dateInput).trim();
  const d = parseOffDayDate(str);
  if (d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return str;
}

/**
 * Parse a comma/semicolon/newline separated list of names from a cell
 */
function parseNamesFromCell(cellValue: string | undefined): string[] {
  if (!cellValue) return [];
  return cellValue
    .split(/[,\n;]+/)
    .map(name => name.trim())
    .filter(Boolean);
}

/**
 * Find exam session based on subject, date, room, and time/period
 */
function findExamSession(
  subject: string,
  date: string,
  roomName: string | undefined,
  timeOrPeriod: string | undefined,
  exams: ExamSession[],
  rooms: Room[],
  studentCount?: number
): ExamSession | null {
  const normSubject = subject.toLowerCase().trim();
  const normDate = normalizeDateString(date);

  // Filter by subject and date first
  let candidates = exams.filter(e => 
    e.subject_name.toLowerCase().trim() === normSubject &&
    normalizeDateString(e.exam_date) === normDate
  );

  if (candidates.length === 0) {
    // Try looser matching (subject contains)
    candidates = exams.filter(e => 
      (e.subject_name.toLowerCase().includes(normSubject) || normSubject.includes(e.subject_name.toLowerCase())) &&
      normalizeDateString(e.exam_date) === normDate
    );
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Filter by Room Name if multiple exist
  if (roomName && rooms.length > 0) {
    const normRoomName = roomName.toLowerCase().trim();
    const matchedRoom = rooms.find(r => r.room_name.toLowerCase().trim() === normRoomName);
    if (matchedRoom) {
      const roomCandidates = candidates.filter(e => e.room_id === matchedRoom.id);
      if (roomCandidates.length > 0) {
        if (roomCandidates.length === 1) return roomCandidates[0];
        candidates = roomCandidates;
      }
    }
  }

  // Filter by Time or Period if still multiple
  if (timeOrPeriod) {
    const normTimeOrPeriod = timeOrPeriod.toLowerCase().trim();
    const timeCandidates = candidates.filter(e => {
      if (e.start_time.toLowerCase().includes(normTimeOrPeriod)) return true;
      const period = String(getPeriodFromTime(e.start_time));
      if (period === normTimeOrPeriod) return true;
      return false;
    });
    if (timeCandidates.length > 0) {
      if (timeCandidates.length === 1) return timeCandidates[0];
      candidates = timeCandidates;
    }
  }

  // If there are still multiple candidates, filter by student count if provided
  if (studentCount !== undefined && !isNaN(studentCount)) {
    const countCandidates = candidates.filter(e => e.student_count === studentCount);
    if (countCandidates.length > 0) {
      return countCandidates[0];
    }
    
    // Fallback: find candidate with closest student count
    let closest = candidates[0];
    let minDiff = Math.abs(candidates[0].student_count - studentCount);
    for (let i = 1; i < candidates.length; i++) {
      const diff = Math.abs(candidates[i].student_count - studentCount);
      if (diff < minDiff) {
        minDiff = diff;
        closest = candidates[i];
      }
    }
    return closest;
  }

  return candidates[0];
}

/**
 * Parse assignments from Excel for import
 */
export async function parseAssignmentCSV(
  file: File,
  exams: ExamSession[],
  staff: Staff[],
  rooms?: Room[]
): Promise<CSVParseResult<{ exam_session_id: string; staff_id: string; role: AssignmentRole }>> {
  try {
    const rawData = await parseFileToRawData(file);
    const data: { exam_session_id: string; staff_id: string; role: AssignmentRole }[] = [];
    const errors: string[] = [];

    if (rawData.length === 0) {
      return { success: true, data: [], errors: [] };
    }

    // Detect if this is the Wide Format or List Format
    const firstRow = rawData[0];
    const keys = Object.keys(firstRow).map(k => k.trim().toLowerCase());
    const isWideFormat = keys.some(k => 
      k.includes('committee') || 
      k.includes('exam supervisor') || 
      k.includes('exam sup') || 
      k.startsWith('invigilator')
    );

    if (isWideFormat) {
      // Wide Format Parsing
      rawData.forEach((row, index) => {
        const rowNum = index + 2;

        const subject = getValueFuzzy(row, ['Subject', 'subject_name', 'Exam', 'Exam_Subject']);
        const date = getValueFuzzy(row, ['Date', 'exam_date', 'Exam_Date']);
        const room = getValueFuzzy(row, ['Room', 'room_name', 'Place', 'Location']);
        const timeOrPeriod = getValueFuzzy(row, ['Time', 'start_time', 'Period', 'period']);
        const studentCountStr = getValueFuzzy(row, ['Student Count', 'student_count', 'students', 'count']);
        const studentCount = studentCountStr ? parseInt(studentCountStr, 10) : undefined;

        if (!subject || !date) {
          // Skip empty or invalid rows (e.g., summary rows)
          return;
        }

        const session = findExamSession(subject, date, room, timeOrPeriod, exams, rooms || [], studentCount);
        if (!session) {
          errors.push(`Row ${rowNum}: Exam session not found for "${subject}" on "${date}"`);
          return;
        }

        // Iterate over all keys of the row to find assigned staff
        Object.entries(row).forEach(([key, val]) => {
          const normKey = key.trim().toLowerCase();
          
          // Skip metadata, requirement, count, and missing status keys
          if (
            normKey.includes('required') ||
            normKey.includes('missing') ||
            normKey.includes('count') ||
            ['subject', 'date', 'period', 'time', 'end time', 'room'].includes(normKey)
          ) {
            return;
          }

          const cellStr = safeTrim(val);
          if (!cellStr) return;

          let role: AssignmentRole | null = null;
          if (normKey === 'committee' || normKey === 'committees supervisor' || normKey === 'committee supervisor' || normKey === 'committees_supervisor') {
            role = 'Head_Supervisor';
          } else if (normKey === 'exam supervisor' || normKey === 'exam sup' || normKey === 'exam_supervisor') {
            role = 'Exam_Supervisor';
          } else if (normKey.includes('invigilator') || normKey.includes('assistant') || normKey.includes('invig') || normKey.includes('assist')) {
            role = 'Assistant';
          }

          if (role) {
            const names = parseNamesFromCell(cellStr);
            names.forEach(name => {
              const staffMember = findStaffByName(name, staff);
              if (staffMember) {
                data.push({
                  exam_session_id: session.id,
                  staff_id: staffMember.id,
                  role: role!
                });
              } else {
                errors.push(`Row ${rowNum} (${key}): Staff member "${name}" not found in database`);
              }
            });
          }
        });
      });
    } else {
      // List Format Parsing
      rawData.forEach((row, index) => {
        const rowNum = index + 2;

        const email = getValueFuzzy(row, ['Staff_Email', 'Email', 'Staff Email']);
        const subject = getValueFuzzy(row, ['Exam_Subject', 'Subject', 'Exam']);
        const date = getValueFuzzy(row, ['Exam_Date', 'Date']);
        const roleInput = getValueFuzzy(row, ['Role', 'Staff Role']);

        if (!email || !subject || !roleInput) {
          // Skip empty or incomplete rows
          return;
        }

        // Find Staff
        const staffMember = staff.find(s => s.email.toLowerCase() === email.toLowerCase());
        if (!staffMember) {
          errors.push(`Row ${rowNum}: Staff not found with email "${email}"`);
          return;
        }

        // Find Exam (Best effort matching using normalized dates)
        const candidates = exams.filter(e => e.subject_name.toLowerCase() === subject.toLowerCase());
        const dateNormalized = normalizeDateString(date);
        let session = candidates.find(e => normalizeDateString(e.exam_date) === dateNormalized);

        if (!session && candidates.length === 1) {
          session = candidates[0];
        }

        if (!session) {
          errors.push(`Row ${rowNum}: Exam session not found for "${subject}" on "${date}"`);
          return;
        }

        // Validate Role
        let role: AssignmentRole | null = null;
        const r = roleInput.toLowerCase();
        if (r.includes('exam') && r.includes('sup')) role = 'Exam_Supervisor';
        else if (r.includes('committee') || r.includes('head')) role = 'Head_Supervisor';
        else if (r.includes('invig') || r.includes('assist') || r.includes('assi')) role = 'Assistant';
        else if (r.includes('sup')) role = 'Head_Supervisor';

        if (!role) {
          errors.push(`Row ${rowNum}: Invalid role "${roleInput}"`);
          return;
        }

        data.push({
          exam_session_id: session.id,
          staff_id: staffMember.id,
          role: role
        });
      });
    }

    // Deduplicate parsed assignments
    const seen = new Set<string>();
    const uniqueData = data.filter(item => {
      const key = `${item.exam_session_id}_${item.staff_id}_${item.role}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return { success: errors.length === 0, data: uniqueData, errors };

  } catch (error: any) {
    return { success: false, data: [], errors: [`Failed to parse file: ${error.message}`] };
  }
}

// ==================== MICROSOFT LIST STAFF IMPORT ====================

/**
 * All six working weekdays used in the system (Saturday-based week for Egyptian universities)
 */
const ALL_WORK_WEEKDAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'] as const;

/**
 * Map a JS Date.getDay() index (0=Sun…6=Sat) to the full weekday name.
 * Returns null if the day is Friday (weekend) or an unrecognised index.
 */
function dayIndexToWeekdayName(dayIndex: number): string | null {
  const map: Record<number, string> = {
    0: 'Sunday',
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    6: 'Saturday',
  };
  return map[dayIndex] ?? null;
}

/**
 * Parse a date string from Microsoft List / Excel into a local Date object.
 *
 * Supported formats (all treated as day-first — Egyptian D/M/YYYY locale):
 *   "31/5/2026"       D/M/YYYY  (most common from MS List)
 *   "31/05/2026"      D/MM/YYYY (zero-padded)
 *   "1/6/2026"        D/M/YYYY
 *   "31-5-2026"       D-M-YYYY  (dashes)
 *   "31.5.2026"       D.M.YYYY  (dots — some locales)
 *   "31 May 2026"     D Mon YYYY (month name)
 *   "31-May-2026"     D-Mon-YYYY
 *   "2026-05-31"      ISO YYYY-MM-DD
 *
 * Returns null if the string cannot be parsed.
 */
function parseOffDayDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;

  // ── 1. ISO: YYYY-MM-DD ───────────────────────────────────────────────────
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    if (y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const dt = new Date(y, m - 1, d);
      return isNaN(dt.getTime()) ? null : dt;
    }
  }

  // ── 2. Month-name formats: "31 May 2026" or "31-May-2026" ───────────────
  const MONTH_NAMES: Record<string, number> = {
    jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
    jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
    january:1, february:2, march:3, april:4, june:6,
    july:7, august:8, september:9, october:10, november:11, december:12,
  };
  // Match: day [sep] month-name [sep] year
  const monthNameMatch = s.match(
    /^(\d{1,2})[\s\-\/.]([A-Za-z]+)[\s\-\/.](\d{4})$/
  );
  if (monthNameMatch) {
    const day   = parseInt(monthNameMatch[1], 10);
    const month = MONTH_NAMES[monthNameMatch[2].toLowerCase()];
    const year  = parseInt(monthNameMatch[3], 10);
    if (month && day >= 1 && day <= 31 && year > 1900) {
      const dt = new Date(year, month - 1, day);
      return isNaN(dt.getTime()) ? null : dt;
    }
  }

  // ── 3. Numeric separator formats: /, -, . ────────────────────────────────
  // Split on any of / - .
  const numParts = s.split(/[\/\-\.]/).map(p => p.trim());
  if (numParts.length === 3) {
    const nums = numParts.map(Number);

    // Detect if first part is the year (ISO-like but with - or /)
    if (nums[0] > 1900) {
      // YYYY / M / D
      const [y, m, d] = nums;
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const dt = new Date(y, m - 1, d);
        return isNaN(dt.getTime()) ? null : dt;
      }
    } else {
      // D / M / YYYY  ← Egyptian locale (day-first, always try this first)
      const [a, b, c] = nums;
      if (c > 1900 && b >= 1 && b <= 12 && a >= 1 && a <= 31) {
        const dt = new Date(c, b - 1, a);
        if (!isNaN(dt.getTime())) return dt;
      }
      // Fallback: M / D / YYYY (US locale)
      if (c > 1900 && a >= 1 && a <= 12 && b >= 1 && b <= 31) {
        const dt = new Date(c, a - 1, b);
        if (!isNaN(dt.getTime())) return dt;
      }
    }
  }

  // ── 4. Last resort: native JS parse ─────────────────────────────────────
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

/**
 * Converts a parsed Date to an ISO YYYY-MM-DD string using LOCAL calendar values.
 * (We use local because parseOffDayDate builds dates via `new Date(year, month, day)`.)
 */
function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Analyzes the raw "Off Days" cell and returns:
 * - `specificOffDates`: every individual date (ISO YYYY-MM-DD) that is off — stored verbatim
 *   in staff.specific_off_dates for per-date scheduling checks.
 * - `workingDays`: the recurring weekday pattern, derived by MAJORITY VOTE.
 *   A weekday is marked as "off" in the pattern only when it appears as an off-day
 *   in MORE THAN 50% of the weeks it was observed.  This correctly handles staff
 *   whose off-days differ by week:
 *     • Mon off in 3 of 4 weeks → Mon removed from working_days (consistent pattern)
 *     • Thu off in 1 of 4 weeks → Thu kept in working_days (one-off, handled via specificOffDates)
 *
 * This means:
 *   - The `specific_off_dates` list is the authoritative source for the scheduler.
 *   - `working_days` is used for display and for staff who have NO specific_off_dates.
 */
function analyzeOffDays(rawOffDays: string | Date | number | null | undefined): {
  specificOffDates: string[];
  workingDays: string[];
} {
  // ── Coerce the cell value to a list of raw token strings ──────────────────
  // XLSX with cellDates:true returns JS Date objects for date cells; with raw:false
  // it returns formatted strings. We handle both.
  let tokens: string[];

  if (!rawOffDays) {
    return { specificOffDates: [], workingDays: [...ALL_WORK_WEEKDAYS] };
  }

  if (rawOffDays instanceof Date) {
    // Single date cell — MS List stored this as a proper Excel date
    tokens = [dateToISO(rawOffDays)];
  } else if (typeof rawOffDays === 'number') {
    // Excel serial number — convert via XLSX utility
    const d = XLSX.SSF.parse_date_code(rawOffDays);
    if (d) {
      const iso = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
      tokens = [iso];
    } else {
      return { specificOffDates: [], workingDays: [...ALL_WORK_WEEKDAYS] };
    }
  } else {
    // String value — may be "31/5/2026;3/6/2026" or "2026-05-31" or JSON array etc.
    const raw = String(rawOffDays);
    if (!raw.trim()) return { specificOffDates: [], workingDays: [...ALL_WORK_WEEKDAYS] };
    // Strip ALL quotes and brackets globally, since sometimes it comes as a JSON-like array string
    const cleaned = raw.replace(/["'\[\]\(\)]/g, '').trim();
    tokens = cleaned
      .split(/\s*[;,|\n]\s*/)   // ; , | or newline with optional surrounding spaces
      .map(t => t.trim())
      .filter(Boolean);
  }

  // --- 1. Collect all specific off-dates and their weekdays ---
  const isoOffDates: string[] = [];
  // weekdayOffCount[day] = how many times this weekday appears as an off-day
  const weekdayOffCount: Record<string, number> = {};
  // weekdayTotalCount[day] = how many distinct weeks contained this weekday at all
  // (approximated: we count every occurrence since the period may not be symmetric)
  const weekdayTotalWeeks: Record<string, Set<string>> = {};

  console.debug('[analyzeOffDays] raw input:', rawOffDays);
  console.debug('[analyzeOffDays] tokens:', tokens);

  for (const token of tokens) {
    const date = parseOffDayDate(token);
    console.debug('[analyzeOffDays] token:', JSON.stringify(token), '→', date ? dateToISO(date) : 'FAILED');
    if (!date) continue;

    const iso = dateToISO(date);
    if (!isoOffDates.includes(iso)) isoOffDates.push(iso);

    const weekdayName = dayIndexToWeekdayName(date.getDay());
    if (!weekdayName || !(ALL_WORK_WEEKDAYS as readonly string[]).includes(weekdayName)) continue;

    weekdayOffCount[weekdayName] = (weekdayOffCount[weekdayName] ?? 0) + 1;

    // Track which calendar week this date belongs to (ISO week = Mon-Sun, close enough)
    // We use a simple YYYY-Wnn key by dividing the day-of-year
    const weekKey = `${date.getFullYear()}-W${Math.ceil(
      (date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / (7 * 86400_000) + 1
    )}`;
    if (!weekdayTotalWeeks[weekdayName]) weekdayTotalWeeks[weekdayName] = new Set();
    weekdayTotalWeeks[weekdayName].add(weekKey);
  }

  // --- 2. Determine the total number of distinct weeks spanned by all off-dates ---
  const allWeeks = new Set<string>();
  for (const iso of isoOffDates) {
    const d = new Date(iso + 'T12:00:00');
    const weekKey = `${d.getFullYear()}-W${Math.ceil(
      (d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / (7 * 86400_000) + 1
    )}`;
    allWeeks.add(weekKey);
  }
  const totalWeeks = Math.max(1, allWeeks.size);

  // Keep workingDays as all work days when specific off-dates are provided.
  // The scheduler and UI will dynamically classify recurring off-days at runtime 
  // based on the actual exam period.
  return { specificOffDates: isoOffDates, workingDays: [...ALL_WORK_WEEKDAYS] };
}

/**
 * Detect if a file looks like a Microsoft List export by checking for the
 * "Off Days" column in the first row.
 */
export function isMicrosoftListFormat(rawData: any[]): boolean {
  if (!rawData.length) return false;
  const keys = Object.keys(rawData[0]).map(k => k.trim().toLowerCase());
  return keys.some(k => k === 'off days' || k === 'offdays' || k === 'off_days');
}

/**
 * Process a single Microsoft List staff row.
 * Column names follow the pattern exported by SharePoint / MS List, e.g.:
 *   "Off Days", "email", "Staff Name", "Staff Name: supervision_role", etc.
 */
function processMicrosoftListRow(row: any, rowNum: number, errors: string[]): StaffFormData | null {

  // ── Helper: look up value by multiple candidate column names ──
  const get = (...candidates: string[]): string => {
    return getValueFuzzy(row, candidates) ?? '';
  };

  // ── Name ──
  // MS List exports the person column as "Staff Name" and nested metadata as "Staff Name: <field>"
  const name = get('Staff Name', 'name', 'Name', 'StaffName');
  if (!name) {
    errors.push(`Row ${rowNum}: Staff name is required`);
    return null;
  }

  // ── Email ──
  const email = get('email', 'Email', 'staff_email', 'StaffEmail').toLowerCase();
  if (!email) {
    errors.push(`Row ${rowNum}: Email is required`);
    return null;
  }

  const supervisionRoleRaw = get(
    'Staff Name: supervision_role',
    'supervision_role',
    'Supervision Role',
    'supervisorRole'
  );
  const supervisionRole = parseSupervisionRole(supervisionRoleRaw);

  // ── Has Health Issue ──
  const healthRaw = get(
    'Staff Name: has_health_issue',
    'has_health_issue',
    'Health Issue',
    'hasHealthIssue'
  ).toLowerCase();
  const hasHealthIssue = ['yes', 'y', '1', 'true'].includes(healthRaw);

  // ── Feeding Mother ──
  const feedingMotherRaw = get(
    'Staff Name: is_feeding_mother',
    'is_feeding_mother',
    'Feeding Mother',
    'isFeedingMother'
  ).toLowerCase();
  const isFeedingMother = ['yes', 'y', '1', 'true'].includes(feedingMotherRaw);

  const feedingDaysRaw = get(
    'Staff Name: feeding_mother_days',
    'feeding_mother_days',
    'FM Days',
    'feedingMotherDays'
  );
  const feedingMotherDays = parseInt(feedingDaysRaw, 10) || 0;

  // ── Overloaded ──
  const overloadedRaw = get(
    'Staff Name: is_overloaded',
    'is_overloaded',
    'Overloaded',
    'isOverloaded'
  ).toLowerCase();
  const isOverloaded = ['yes', 'y', '1', 'true'].includes(overloadedRaw);

  const overloadPercentRaw = get(
    'Staff Name: overload_percentage',
    'overload_percentage',
    'Overload %',
    'overloadPercentage'
  );
  const overloadPercentage = parseInt(overloadPercentRaw, 10) || 0;

  // ── Availability Status ──
  const availabilityRaw = get(
    'Staff Name: availability_status',
    'availability_status',
    'Availability Status',
    'availabilityStatus'
  );
  const availabilityStatus: AvailabilityStatus =
    (VALID_AVAILABILITY_STATUS as readonly string[]).includes(availabilityRaw)
      ? (availabilityRaw as AvailabilityStatus)
      : 'Available';

  // ── Employment Status ──
  const employmentRaw = get(
    'Staff Name: employment_status',
    'employment_status',
    'Employment Status',
    'employmentStatus'
  );
  if (!VALID_EMPLOYMENT_STATUS.includes(employmentRaw as EmploymentStatus)) {
    errors.push(`Row ${rowNum}: Invalid employment_status "${employmentRaw}". Must be Full-time or Part-time`);
    return null;
  }
  const employmentStatus = employmentRaw as EmploymentStatus;

  // ── Job Title ──
  const jobTitleRaw = get(
    'Staff Name: job_title',
    'job_title',
    'Job Title',
    'jobTitle'
  );

  let jobTitle: JobTitle | null = null;
  const jLower = jobTitleRaw.toLowerCase();
  if (['chemist', 'c', 'ch'].includes(jLower)) jobTitle = 'Chemist';
  else if (['demonstrator', 'd', 'dem'].includes(jLower)) jobTitle = 'Demonstrator';
  else if (['teaching assistant', 'ta', 't.a.'].includes(jLower)) jobTitle = 'Teaching Assistant';
  else if (['lecturer', 'l'].includes(jLower)) jobTitle = 'Lecturer';
  else if (VALID_JOB_TITLES.includes(jobTitleRaw as JobTitle)) jobTitle = jobTitleRaw as JobTitle;

  if (!jobTitle) {
    errors.push(`Row ${rowNum}: Invalid job_title "${jobTitleRaw}". Must be Chemist, Demonstrator, Teaching Assistant, or Lecturer`);
    return null;
  }

  // ── Off Days → specific_off_dates + working_days ──
  const offDaysRaw = get('Off Days', 'off_days', 'OffDays', 'offDays', 'Off_Days');
  const { specificOffDates, workingDays } = analyzeOffDays(offDaysRaw);

  return {
    name,
    email,
    job_title: jobTitle,
    employment_status: employmentStatus,
    availability_status: availabilityStatus,
    working_days: workingDays,
    specific_off_dates: specificOffDates,
    is_feeding_mother: isFeedingMother,
    feeding_mother_days: feedingMotherDays,
    has_health_issue: hasHealthIssue,
    is_overloaded: isOverloaded,
    overload_percentage: overloadPercentage,
    supervision_role: supervisionRole,
    can_supervise_oral: false,
  };
}

/**
 * Parse a Microsoft List exported Excel file and return staff records.
 *
 * The "Off Days" column contains specific calendar dates (e.g. "1/6/2026;3/6/2026").
 * This function converts those dates to weekday names, collects the off-weekdays,
 * and sets `working_days` as the inverse (remaining weekdays from Sat-Thu).
 */
export async function parseMicrosoftListStaffExcel(file: File): Promise<CSVParseResult<StaffFormData>> {
  try {
    const rawData = await parseFileToRawData(file);
    const data: StaffFormData[] = [];
    const errors: string[] = [];

    if (rawData.length === 0) {
      return { success: false, data: [], errors: ['The file appears to be empty.'] };
    }

    // Confirm it has Off Days column
    if (!isMicrosoftListFormat(rawData)) {
      return {
        success: false,
        data: [],
        errors: ['This file does not appear to be a Microsoft List export (missing "Off Days" column). Use the standard import instead.'],
      };
    }

    rawData.forEach((row, index) => {
      const rowNum = index + 2;
      const processed = processMicrosoftListRow(row, rowNum, errors);
      if (processed) data.push(processed);
    });

    return { success: errors.length === 0, data, errors };
  } catch (error: any) {
    return { success: false, data: [], errors: [`Failed to parse Microsoft List file: ${error.message}`] };
  }
}

// ==================== IMPORT EXPORTED SCHEDULE ====================

export interface ScheduleImportResult {
  success: boolean;
  assignmentsToInsert: { exam_session_id: string; staff_id: string; role: AssignmentRole; is_manual_override: boolean }[];
  affectedSessionIds: string[];
  errors: string[];
}

export async function parseScheduleImportCSV(
  file: File,
  staffList: Staff[],
  weekSessions: ExamSession[],
  rooms: Room[]
): Promise<ScheduleImportResult> {
  try {
    const rawData = await parseFileToRawData(file);
    const assignmentsToInsert: { exam_session_id: string; staff_id: string; role: AssignmentRole; is_manual_override: boolean }[] = [];
    const affectedSessionIds = new Set<string>();
    const globalAssignedKeys = new Set<string>();
    const errors: string[] = [];

    // Helper to find staff ID by name (case-insensitive fuzzy match)
    const findStaffId = (name: string): string | null => {
      if (!name) return null;
      const cleanName = safeTrim(name).toLowerCase();
      if (!cleanName || cleanName === '— empty —') return null;
      
      const found = staffList.find(s => s.name.toLowerCase() === cleanName);
      return found ? found.id : null;
    };

    rawData.forEach((row, index) => {
      const rowNum = index + 2;

      // Ensure this row has the minimum required columns for matching
      const date = getValueFuzzy(row, ['Date']);
      const time = getValueFuzzy(row, ['Time', 'Start Time']);
      const roomName = getValueFuzzy(row, ['Room', 'Hall']);
      const subjectName = getValueFuzzy(row, ['Subject']);

      if (!date && !time && !roomName && !subjectName) return; // Skip empty rows

      if (!date || !time || !roomName || !subjectName) {
        errors.push(`Row ${rowNum}: Missing critical columns to identify the session (Date, Time, Room, Subject).`);
        return;
      }

      // Try to find the exact session in the current week
      const matchingSession = weekSessions.find(s => {
        const sRoom = rooms.find(r => r.id === s.room_id)?.room_name || (s as any).room?.room_name || (s as any).room_name;
        return s.exam_date === date && 
               s.start_time.startsWith(time.substring(0, 5)) && 
               sRoom === roomName && 
               s.subject_name === subjectName;
      });

      if (!matchingSession) {
        errors.push(`Row ${rowNum}: Could not find an existing Exam Session for ${subjectName} on ${date} at ${time} in ${roomName}. New sessions cannot be created via this import.`);
        return;
      }

      const sessionId = matchingSession.id;
      affectedSessionIds.add(sessionId);

      // Process Supervisors
      const commSupervisors = getValueFuzzy(row, ['Committees Supervisor', 'Committees Supervisor Assigned'])?.split(',') || [];
      const examSupervisors = getValueFuzzy(row, ['Exam Supervisor', 'Exam Supervisor Assigned'])?.split(',') || [];
      
      const invigilators = [
        getValueFuzzy(row, ['Invigilator 1']),
        getValueFuzzy(row, ['Invigilator 2']),
        getValueFuzzy(row, ['Invigilator 3']),
        getValueFuzzy(row, ['Invigilator 4']),
      ].filter(Boolean) as string[];

      // If "Invigilators Assigned" is present (from Missing Roles sheet), parse that
      const invigAssigned = getValueFuzzy(row, ['Invigilators Assigned'])?.split(',') || [];
      invigAssigned.forEach(i => invigilators.push(i));

      const assignStaff = (nameArray: string[], role: AssignmentRole) => {
        nameArray.forEach(name => {
          const sName = safeTrim(name);
          if (!sName || sName === '— empty —') return;
          const sId = findStaffId(sName);
          if (sId) {
            const assignmentKey = `${sessionId}_${sId}`;
            if (globalAssignedKeys.has(assignmentKey)) {
              return; // Already assigned to this session, skip duplicate to prevent DB error
            }
            globalAssignedKeys.add(assignmentKey);

            assignmentsToInsert.push({
              exam_session_id: sessionId,
              staff_id: sId,
              role,
              is_manual_override: true // Tag as manually imported
            });
          } else {
            errors.push(`Row ${rowNum}: Could not find staff member named "${sName}". Please ensure the name matches exactly.`);
          }
        });
      };

      assignStaff(commSupervisors, 'Committees_Supervisor');
      assignStaff(examSupervisors, 'Exam_Supervisor');
      assignStaff(invigilators, 'Assistant');

    });

    return { 
      success: errors.length === 0, 
      assignmentsToInsert, 
      affectedSessionIds: Array.from(affectedSessionIds),
      errors 
    };

  } catch (error: any) {
    return { success: false, assignmentsToInsert: [], affectedSessionIds: [], errors: [`Failed to parse import file: ${error.message}`] };
  }
}

