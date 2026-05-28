const XLSX = require('xlsx');
const fs = require('fs');

const STAFF_COUNT = 100;
const ROOMS_COUNT = 50;

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomChance(prob) {
  return Math.random() < prob;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// === GENERATE STAFF ===
const FIRST_NAMES = ["Ahmed", "Mohamed", "Mahmoud", "Ali", "Hassan", "Fatima", "Aisha", "Mona", "Nour", "Youssef", "Sara", "Omar", "Hoda", "Tariq", "Salma"];
const LAST_NAMES = ["Abdullah", "Ibrahim", "Hassan", "Kamel", "Mansour", "Fawzi", "Salim", "Tawfiq", "Saad", "Youssef"];

const staffData = [];
for (let i = 0; i < STAFF_COUNT; i++) {
  const job = Math.random() < 0.15 ? 'Lecturer' : randomElement(["Chemist", "Demonstrator", "Teaching Assistant"]);
  const role = job === 'Lecturer' ? 'Exam Supervisor' : randomElement(["Invigilator", "Committees Supervisor"]);
  const isFemale = randomChance(0.5);
  const isFeedingMother = isFemale && randomChance(0.1) ? 'Yes' : 'No';
  const hasHealthIssue = randomChance(0.05) ? 'Yes' : 'No';

  staffData.push({
    name: `${randomElement(FIRST_NAMES)} ${randomElement(LAST_NAMES)} ${i + 1}`,
    email: `staff${i + 1}@example.edu`,
    job_title: job,
    employment_status: randomChance(0.8) ? 'Full-time' : 'Part-time',
    availability_status: randomChance(0.95) ? 'Available' : 'Unavailable',
    is_feeding_mother: isFeedingMother,
    feeding_mother_days: isFeedingMother === 'Yes' ? randomElement([1, 2, 3, 4]) : 0,
    has_health_issue: hasHealthIssue,
    supervision_role: role,
    Saturday: randomChance(0.8) ? 'Yes' : 'No',
    Sunday: randomChance(0.8) ? 'Yes' : 'No',
    Monday: randomChance(0.8) ? 'Yes' : 'No',
    Tuesday: randomChance(0.8) ? 'Yes' : 'No',
    Wednesday: randomChance(0.8) ? 'Yes' : 'No',
    Thursday: randomChance(0.8) ? 'Yes' : 'No',
  });
}

// === ROOMS: Load from existing file OR generate fresh ===
const ROOMS_FILE = 'test_data/Rooms_Template_50.xlsx';
let roomsData = [];
let roomsFileGenerated = false;

if (fs.existsSync(ROOMS_FILE)) {
  // Read rooms from the existing file so exams always reference the same names
  const existingWb = XLSX.readFile(ROOMS_FILE);
  const sheet = existingWb.Sheets[existingWb.SheetNames[0]];
  roomsData = XLSX.utils.sheet_to_json(sheet);
  console.log(`[INFO] Loaded ${roomsData.length} rooms from existing ${ROOMS_FILE}`);
} else {
  // Generate fresh rooms (first run or file deleted)
  roomsFileGenerated = true;
  const BUILDINGS = ['M1', 'M2', 'P', 'E', 'A'];
  const usedRooms = new Set();

  while (roomsData.length < ROOMS_COUNT) {
    const building = randomElement(BUILDINGS);
    const floor = Math.floor(Math.random() * 4) + 1;
    const roomNumber = (Math.floor(Math.random() * 30) + 1).toString().padStart(2, '0');
    let roomName = "";
    if (building === 'M1' || building === 'M2') {
      roomName = randomChance(0.5) ? `ComputerLab ${building}${floor}${roomNumber}` : `${building}${floor}${roomNumber}`;
    } else {
      roomName = `Hall ${building}${floor}${roomNumber}`;
    }
    if (!usedRooms.has(roomName)) {
      usedRooms.add(roomName);
      roomsData.push({ room_name: roomName, max_capacity: randomElement([30, 40, 50, 60]), building, floor });
    }
  }
  console.log(`[INFO] Generated ${roomsData.length} new rooms (${ROOMS_FILE} not found)`);
}

// === GENERATE EXAMS (conflict-free) ===
/**
 * Constraints enforced:
 *  - Max 2 courses per date+period slot
 *  - Max 25 rooms per exam (course)
 *  - No room reused in the same date+period slot (no room conflicts)
 */
const SUBJECTS = [
  "Introduction to Computing", "Data Structures", "Organic Chemistry",
  "Physics I", "Calculus II", "Anatomy", "Signals and Systems",
  "Thermodynamics", "Linear Algebra", "Microbiology"
];
const SUBJECT_CODES = ["CS101", "CS201", "CHM301", "PHY101", "MTH102", "BIO201", "EE202", "ME203", "MTH103", "BIO301"];

// Horus University working days: Saturday–Thursday (Friday is the weekend)
// April 2026 dates on working days (Starting tomorrow):
//   Apr 7 = Tue, Apr 8 = Wed, Apr 9 = Thu
//   Apr 11 = Sat, Apr 12 = Sun, Apr 13 = Mon, Apr 14 = Tue
const DATES = ["2026-04-07", "2026-04-08", "2026-04-09", "2026-04-11", "2026-04-12", "2026-04-13", "2026-04-14"];
const PERIODS = [1, 2, 3];

// 10 subjects * 5 rooms each = exactly 50 exams total
const MAX_ROOMS_PER_EXAM = 5;
const MAX_COURSES_PER_SLOT = 2;

// Build all available slots (date + period) and track allocations
const allSlots = [];
const coursesPerSlot = new Map();    // key -> count of courses assigned
const takenRoomsPerSlot = new Map(); // key -> Set of room_names used

for (const date of DATES) {
  for (const period of PERIODS) {
    const key = `${date}_${period}`;
    allSlots.push({ date, period, key });
    coursesPerSlot.set(key, 0);
    takenRoomsPerSlot.set(key, new Set());
  }
}
// 5 dates × 3 periods = 15 slots × 2 max courses = 30 capacity for 10 subjects

// Assign each subject to a unique slot (max 2 per slot)
const subjectAssignments = [];
const shuffledSlots = shuffle(allSlots);
let slotPointer = 0;

for (let s = 0; s < SUBJECTS.length; s++) {
  // Advance to next slot with capacity
  while (
    slotPointer < shuffledSlots.length &&
    coursesPerSlot.get(shuffledSlots[slotPointer].key) >= MAX_COURSES_PER_SLOT
  ) {
    slotPointer++;
  }

  if (slotPointer >= shuffledSlots.length) {
    console.warn(`[WARN] No available slot for subject: ${SUBJECTS[s]}`);
    continue;
  }

  const slot = shuffledSlots[slotPointer];
  coursesPerSlot.set(slot.key, coursesPerSlot.get(slot.key) + 1);
  subjectAssignments.push({ name: SUBJECTS[s], code: SUBJECT_CODES[s], ...slot });
}

// Now allocate rooms per subject (no room conflicts within same slot)
const examsData = [];
let studentSeq = 1;

for (const { name, code, date, period, key } of subjectAssignments) {
  const taken = takenRoomsPerSlot.get(key);

  // Only pick rooms not yet assigned in this slot
  const availableRooms = roomsData.filter(r => !taken.has(r.room_name));
  const selectedRooms = shuffle(availableRooms).slice(0, Math.min(MAX_ROOMS_PER_EXAM, availableRooms.length));

  if (selectedRooms.length === 0) {
    console.warn(`[WARN] No free rooms for ${name} on ${date} P${period}`);
    continue;
  }

  let start_time = "09:00", end_time = "11:00";
  if (period === 2) { start_time = "13:00"; end_time = "15:00"; }
  if (period === 3) { start_time = "15:45"; end_time = "17:45"; }

  for (const room of selectedRooms) {
    taken.add(room.room_name); // mark room as used for this slot

    const studentCount = Math.floor(Math.random() * 21) + 20; // 20–40 per room
    examsData.push({
      subject_name: name,
      subject_code: code,
      exam_type: 'Final',
      exam_date: date,
      period: period,
      start_time,
      end_time,
      duration_minutes: 120,
      room_name: room.room_name,
      student_count: studentCount,
      student_start: `${studentSeq}`,
      student_end: `${studentSeq + studentCount - 1}`,
      academic_year: '2025-2026',
      semester: 'Spring',
    });
    studentSeq += studentCount;
  }
}

// === Summary ===
console.log(`\n=== TEST DATA SUMMARY ===`);
console.log(`Staff:  ${staffData.length} members`);
console.log(`Rooms:  ${roomsData.length} rooms (unique names)`);
console.log(`Exams:  ${examsData.length} sessions across ${subjectAssignments.length} subjects`);
console.log(`Slots used:`);
for (const [key, count] of coursesPerSlot.entries()) {
  if (count > 0) console.log(`  ${key.replace('_', ' P')}: ${count} course(s)`);
}

// === WRITE FILES ===
function writeToExcel(data, sheetName, filename) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

writeToExcel(staffData, "Staff", "test_data/Staff_Template_100.xlsx");
if (roomsFileGenerated) {
  writeToExcel(roomsData, "Rooms", "test_data/Rooms_Template_50.xlsx");
  console.log(`Rooms file written (freshly generated).`);
} else {
  console.log(`Rooms file kept unchanged (loaded from existing file).`);
}
writeToExcel(examsData, "Exams", "test_data/Exams_Template_Conflict_Free.xlsx");

console.log(`\nFiles written to /test_data`);
