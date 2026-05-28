// Scratch script to test the logic of name matching and wide format parsing

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

// ==================== TEST SUITE ====================

const testStaff = [
  { id: '1', name: 'أمير حمودة', email: 'amir@example.com' },
  { id: '2', name: 'محمد زيدان', email: 'zeidan@example.com' },
  { id: '3', name: 'محمد صلاح', email: 'salah@example.com' },
  { id: '4', name: 'محمد مروان', email: 'marwan@example.com' },
  { id: '5', name: 'ناريمان صقر', email: 'nariman@example.com' },
  { id: '6', name: 'ندى حسام', email: 'nada@example.com' }
];

console.log('--- Running Name Normalization Tests ---');

// Test Arabic spelling variations matching
const testCases = [
  { input: 'د/ أمير حموده', expectedId: '1', label: 'Title + teh marbuta vs heh variation' },
  { input: 'د. محمد زيدان', expectedId: '2', label: 'Dot title + exact Arabic match' },
  { input: 'د/ محمد صلاح', expectedId: '3', label: 'Title + exact Arabic match' },
  { input: 'محمد ياسر الشليلى مجدى', expectedId: null, label: 'Name not in DB' },
  { input: 'ناريمان صقر', expectedId: '5', label: 'Exact match without title' },
  { input: 'ندى حسام', expectedId: '6', label: 'Alef maksura vs yeh normalization' }
];

let failed = 0;

testCases.forEach((tc, idx) => {
  const result = findStaffByName(tc.input, testStaff);
  const resultId = result ? result.id : null;
  if (resultId === tc.expectedId) {
    console.log(`PASS: Test ${idx + 1} (${tc.label}): Resolved to ${result ? result.name : 'null'}`);
  } else {
    console.error(`FAIL: Test ${idx + 1} (${tc.label}): Expected ID ${tc.expectedId}, got ${resultId} (${result ? result.name : 'null'})`);
    failed++;
  }
});

console.log('\n--- Running Cell Name Parsing Tests ---');
const cellTests = [
  { cell: 'د/ أمير حموده, د. محمد زيدان', expected: ['د/ أمير حموده', 'د. محمد زيدان'] },
  { cell: 'محمد مروان\nناريمان صقر', expected: ['محمد مروان', 'ناريمان صقر'] },
  { cell: 'ندى حسام; محمد صلاح', expected: ['ندى حسام', 'محمد صلاح'] }
];

cellTests.forEach((tc, idx) => {
  const parsed = parseNamesFromCell(tc.cell);
  const pass = JSON.stringify(parsed) === JSON.stringify(tc.expected);
  if (pass) {
    console.log(`PASS: Test ${idx + 1}: Parsed correctly: ${JSON.stringify(parsed)}`);
  } else {
    console.error(`FAIL: Test ${idx + 1}: Expected ${JSON.stringify(tc.expected)}, got ${JSON.stringify(parsed)}`);
    failed++;
  }
});

if (failed === 0) {
  console.log('\nALL TESTS PASSED SUCCESSFULLY! 🎉');
} else {
  console.error(`\n${failed} TESTS FAILED.`);
  process.exit(1);
}
