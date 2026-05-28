// Scratch script to test wide-format CSV parser logic with the bug fix included.

// 1. Arabic normalization function
function normalizeArabicString(str) {
  return str
    .replace(/[أإآ]/g, 'ا') // Normalize alefs
    .replace(/ة/g, 'ه')     // Normalize teh marbuta to heh
    .replace(/ى/g, 'i')     // Normalize alef maksura and yeh:
    .replace(/ي/g, 'i')     // both map to same character 'i' to handle spelling variations
    .replace(/\s+/g, ' ')   // Normalize whitespace
    .trim();
}

// 2. Staff name cleaner & finder
function findStaffByName(name, staff) {
  const normName = name.toLowerCase().trim();
  if (!normName) return null;

  const cleanName = (n) => {
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

// 3. Name parser from cell
function parseNamesFromCell(cellValue) {
  if (!cellValue) return [];
  return cellValue
    .split(/[,\n;]+/)
    .map(name => name.trim())
    .filter(Boolean);
}

function safeTrim(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

// Test data
const testStaff = [
  { id: '101', name: 'أمير حمودة', email: 'amir@example.com' },
  { id: '102', name: 'محمد زيدان', email: 'zeidan@example.com' },
  { id: '103', name: 'محمد صلاح', email: 'salah@example.com' },
  { id: '104', name: 'محمد مروان', email: 'marwan@example.com' }
];

const mockExams = [
  { id: 'session_1', subject_name: 'Data Structures', exam_date: '2025-01-22', start_time: '09:00', room_id: 'room_1' }
];

const mockRooms = [
  { id: 'room_1', room_name: 'Room 201' }
];

function normalizeDateString(dateInput) {
  if (!dateInput) return '';
  return String(dateInput).trim();
}

function getPeriodFromTime(time) {
  return 1;
}

function findExamSession(subject, date, roomName, timeOrPeriod, exams, rooms) {
  const normSubject = subject.toLowerCase().trim();
  const normDate = normalizeDateString(date);

  let candidates = exams.filter(e => 
    e.subject_name.toLowerCase().trim() === normSubject &&
    normalizeDateString(e.exam_date) === normDate
  );

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

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

  return candidates[0];
}

// Emulate parser loop
function parseWideFormatRow(row, rowNum, errors, data) {
  const subject = row['Subject'];
  const date = row['Date'];
  const room = row['Room'];
  const timeOrPeriod = row['Time'] || row['Period'];

  if (!subject || !date) {
    return;
  }

  const session = findExamSession(subject, date, room, timeOrPeriod, mockExams, mockRooms);
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

    let role = null;
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
        const staffMember = findStaffByName(name, testStaff);
        if (staffMember) {
          data.push({
            exam_session_id: session.id,
            staff_id: staffMember.id,
            role: role
          });
        } else {
          errors.push(`Row ${rowNum} (${key}): Staff member "${name}" not found in database`);
        }
      });
    }
  });
}

// Run test
const mockRow = {
  "Subject": "Data Structures",
  "Date": "2025-01-22",
  "Period": "1",
  "Time": "09:00",
  "Room": "Room 201",
  "Student Count": "35",
  "Required Exam Supervisor": "1",
  "Required Invigilator": "2",
  "Committees Supervisor": "محمد مروان",
  "Exam Supervisor": "محمد صلاح",
  "Invigilator 1": "أمير حمودة",
  "Invigilator 2": "محمد زيدان",
  "⚠ Missing Roles": "✓ Complete"
};

const errors = [];
const parsedData = [];

parseWideFormatRow(mockRow, 2, errors, parsedData);

console.log('Errors found:', errors);
console.log('Parsed assignments count:', parsedData.length);
console.log('Parsed assignments detail:', JSON.stringify(parsedData, null, 2));

if (errors.length > 0) {
  console.error('FAIL: Expected no errors, but found: ', errors);
  process.exit(1);
}

if (parsedData.length !== 4) {
  console.error(`FAIL: Expected 4 assignments, but got ${parsedData.length}`);
  process.exit(1);
}

// Verify roles and IDs
const expected = [
  { exam_session_id: 'session_1', staff_id: '104', role: 'Head_Supervisor' },
  { exam_session_id: 'session_1', staff_id: '103', role: 'Exam_Supervisor' },
  { exam_session_id: 'session_1', staff_id: '101', role: 'Assistant' },
  { exam_session_id: 'session_1', staff_id: '102', role: 'Assistant' }
];

expected.forEach((exp) => {
  const matched = parsedData.find(d => d.staff_id === exp.staff_id && d.role === exp.role);
  if (!matched) {
    console.error(`FAIL: Could not find assignment matching staff ${exp.staff_id} for role ${exp.role}`);
    process.exit(1);
  }
});

console.log('ALL SIMULATED PARSER TESTS PASSED SUCCESSFULLY! 🎉');
