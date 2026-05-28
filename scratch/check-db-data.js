const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local manually
let supabaseUrl, supabaseKey;
try {
  const envPath = path.resolve('.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.trim().split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = value;
      if (key === 'SUPABASE_SERVICE_ROLE_KEY') supabaseKey = value;
      if (key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' && !supabaseKey) supabaseKey = value;
    }
  });
} catch (e) {
  console.error('Failed to read .env.local:', e);
}

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// User's TSV data
const rawData = `Subject	Date	Period	Time	End Time	Room	Student Count	Required Exam Supervisor	Required Invigilator	⚠ Missing Roles	Committees Supervisor	Exam Supervisor	Invigilator 1	Invigilator 2
Quality Control of Pharmaceuticals	23/05/2026	1	10:00:00	12:00:00	Computer Lab P108	1	1	2	✓ Complete	د/ أمير حمودة	محمد مروان	ليلى مجدى	ندا المدثر
Drug Quality Control	23/05/2026	1	10:00:00	12:00:00	Computer Lab P108	42	1	2	✓ Complete	د/ أمير حمودة	محمد مروان	ليلى مجدى	ندا المدثر
Physical Pharmacy	23/05/2026	1	10:00:00	12:00:00	Computer Lab M2 202	29	1	1	✓ Complete	د/ محمد زيدان	نورهان الصباغ	منه شروش	
Physical Pharmacy	23/05/2026	1	10:00:00	12:00:00	Computer Lab M2 204	29	1	1	✓ Complete	د/ محمد زيدان	هشام سامح	غادة راضي	
Physical Pharmacy	23/05/2026	1	10:00:00	12:00:00	Computer Lab M2 205	29	1	1	✓ Complete	د/ محمد زيدان	هاجر الجزار	ناريمان صقر	
Physical Pharmacy	23/05/2026	1	10:00:00	12:00:00	Computer Lab M2 213	29	1	1	✓ Complete	د/ محمد زيدان	مي عاطف	هبة الله جمال	
Physical Pharmacy	23/05/2026	1	10:00:00	12:00:00	Computer Lab M2 217	29	1	1	✓ Complete	د/ محمد صلاح	خالد أبو السعود	نور عمرو	
Physical Pharmacy	23/05/2026	1	10:00:00	12:00:00	Computer Lab M2 322	29	1	1	✓ Complete	د/ محمد صلاح	دينا إيهاب	هاجر ابو المعاطى	
Physical Pharmacy	23/05/2026	1	10:00:00	12:00:00	Computer Lab M2 402	29	1	1	✓ Complete	د/ محمد صلاح	منة عبد الشهيد	هايدي رمضان	
Physical Pharmacy	23/05/2026	1	10:00:00	12:00:00	Computer Lab M2 409	29	1	1	✓ Complete	د/ محمد صلاح	نوران قنديل	إسراء الشرباصي	
Physical Pharmacy	23/05/2026	1	10:00:00	12:00:00	Computer Lab M2 420	29	1	1	✓ Complete	د/ محمد صلاح	أحمد وائل	كريمه كارم	
Physical Pharmacy	23/05/2026	1	10:00:00	12:00:00	Computer Lab M2 115	29	1	1	✓ Complete	د/ محمد زيدان	ندى حسام	ايه هدايت	
Physical Pharmacy	23/05/2026	1	10:00:00	12:00:00	Computer Lab P101	65	1	3	✓ Complete	د/ أمير حمودة	محمد ياسر الشبراوى	غادة على	رحمه فرحات
Physical Pharmacy	23/05/2026	1	10:00:00	12:00:00	Computer Lab F 403	37	1	2	✓ Complete	د/ محمد حمدان	منى عبد الرافع	رحمه صلاح	روان البسيوني
Physical Pharmacy	23/05/2026	1	10:00:00	12:00:00	Computer Lab F 404	40	1	2	✓ Complete	د/ محمد حمدان	آيه العساس	روان عصر	مروه عرنسه
Physical Pharmacy	23/05/2026	1	10:00:00	12:00:00	Computer Lab F 411	39	1	2	✓ Complete	د/ محمد حمدان	أميرة سمير	جهاد جبريل	رقية إسماعيل
Physical Pharmacy	23/05/2026	1	10:00:00	12:00:00	Computer Lab F 412	40	1	2	✓ Complete	د/ محمد حمدان	أحمد موسى	ايمان عثمان	ايه الغالي
Physical Pharmacy	23/05/2026	1	10:00:00	12:00:00	Computer Lab A 402	37	1	2	✓ Complete	د/ إيمان حمدي	مى صلاح	سلمى داوود	شروق علي
Physical Pharmacy	23/05/2026	1	10:00:00	12:00:00	Computer Lab A 405	15	1	1	✓ Complete	د/ إيمان حمدي	إيهاب السيد	يوسف الحارتى	
Physical Pharmacy	23/05/2026	1	10:00:00	12:00:00	Computer Lab A 404	37	1	2	✓ Complete	د/ إيمان حمدي	ندى كمال	عمر حليم	عبير سراج
Physical Pharmacy	23/05/2026	1	10:00:00	12:00:00	Computer Lab A 412	39	1	2	✓ Complete	د / أميرة المتولى	أميرة مشالى	ريهام هشام	سميحة حمدي
Physical Pharmacy	23/05/2026	1	10:00:00	12:00:00	Computer Lab A 413	39	1	2	✓ Complete	د / أميرة المتولى	ايمان ممدوح	شيرين الحسيني	نهله عاشور
Physical Pharmacy	23/05/2026	1	10:00:00	12:00:00	Computer Lab A 415	38	1	2	✓ Complete	د / أميرة المتولى	سمر الشربينى	هند محسن	ايمان يوسف
Physical Pharmacy	23/05/2026	1	10:00:00	12:00:00	Computer Lab A 416	38	1	2	✓ Complete	د / أميرة المتولى	إنجى أيمن	دينا الحسيني	رحمه البابلي
Physical Pharmacy	23/05/2026	1	10:00:00	12:00:00	Computer Lab A 410	8	1	2	✓ Complete	د / أميرة المتولى	منة الداودي	هدير امين	ياسمينا منصور
Sterile Dosage Forms & Radiopharmaceuticals	23/05/2026	1	10:00:00	12:00:00	Computer Lab A 410	32	1	2	✓ Complete	د / أميرة المتولى	منة الداودي	هدير امين	ياسمينا منصور
Pharmaceutical Organic Chemistry 3	23/05/2026	2	13:00:00	15:00:00	P416	1	1	1	✓ Complete	د / منة أسامة	منى عبد الرافع	شروق على	
Clinical Pharmacy Practice	23/05/2026	2	13:00:00	15:00:00	P416	9	1	1	✓ Complete	د / منة أسامة	منى عبد الرافع	شروق على	
Clinical Pharmacy Practice	23/05/2026	2	13:00:00	15:00:00	M1.218	74	1	3	✓ Complete	د / محمد الجمال	هشام سامح	أحمد وائل	رحمة فرحات
Clinical Pharmacy Practice	23/05/2026	2	13:00:00	15:00:00	M1.317	74	1	3	✓ Complete	د / محمد الجمال	اميرة سمير	إسراء الشرباصي	نوران قنديل
Clinical Pharmacy Practice	23/05/2026	2	13:00:00	15:00:00	M2.103	39	1	2	✓ Complete	د/ خالد علي	خالد أبو السعود	مي عاطف	محمد مروان
Clinical Pharmacy Practice	23/05/2026	2	13:00:00	15:00:00	M2.215	57	1	3	✓ Complete	د/ خالد علي	احمد موسى	ليلى مجدي	دينا الحسيني
Clinical Pharmacy Practice	23/05/2026	2	13:00:00	15:00:00	P221	42	1	2	✓ Complete	د / منة أسامة	ايمان ممدوح	هبة الله جمال	انجي ايمن
Clinical Pharmacy Practice	23/05/2026	2	13:00:00	15:00:00	P408	42	1	2	✓ Complete	د / منة أسامة	اميرة مشالي	ندى حسام	نور عمرو
Clinical Biochemistry	24/05/2026	1	10:00:00	12:00:00	Computer Lab P108	39	1	2	✓ Complete	د / أمل الطوبشى	دينا إيهاب	ايه هدايت	إسراء الشرباصي
Clinical Biochemistry	24/05/2026	1	10:00:00	12:00:00	Computer Lab M2 217	29	1	1	✓ Complete	د/ أحمد صالح	ليلى مجدى	هند محسن	
Clinical Biochemistry	24/05/2026	1	10:00:00	12:00:00	Computer Lab M2 322	29	1	1	✓ Complete	د/ غادة سعد	آيه العساس	ياسمينا منصور	
Clinical Biochemistry	24/05/2026	1	10:00:00	12:00:00	Computer Lab M2 402	29	1	1	✓ Complete	د/ غادة سعد	أحمد موسى	غادة على	
Clinical Biochemistry	24/05/2026	1	10:00:00	12:00:00	Computer Lab M2 409	29	1	1	✓ Complete	د/ غادة سعد	أميرة سمير	هاجر الجزار	
Clinical Biochemistry	24/05/2026	1	10:00:00	12:00:00	Computer Lab M2 420	29	1	1	✓ Complete	د/ غادة سعد	أميرة مشالى	ايمان عثمان	
Clinical Biochemistry	24/05/2026	1	10:00:00	12:00:00	Computer Lab P101	60	1	3	✓ Complete	د / أمل الطوبشى	أحمد وائل	رحمه البابلي	شيرين الحسيني
Clinical Biochemistry	24/05/2026	1	10:00:00	12:00:00	Computer Lab P101	5	1	3	✓ Complete	د / أمل الطوبشى	أحمد وائل	رحمه البابلي	شيرين الحسيني
Clinical Biochemistry	24/05/2026	1	10:00:00	12:00:00	Computer Lab M2 213	29	1	1	✓ Complete	د/ أحمد صالح	إبراهيم  عرفان	هدير امين	
Management of Dermatological, Reproductive & Musculoskeletal Diseases	24/05/2026	1	10:00:00	12:00:00	P408	33	1	2	✓ Complete	د / أمل الطوبشى	رانيا اللايح	محمود الشربينى	رحمه فرحات
Management of Dermatological, Reproductive & Musculoskeletal Diseases	24/05/2026	1	10:00:00	12:00:00	M2.121	39	1	2	✓ Complete	د/ أحمد صالح	آية عادل	كريمه كارم	مروه عرنسه
Management of Dermatological, Reproductive & Musculoskeletal Diseases	24/05/2026	1	10:00:00	12:00:00	P221	42	1	2	✓ Complete	د / أمل الطوبشى	محمد ياسر الشبراوى	هاجر ابو المعاطى	هايدي رمضان
Pharmacy Practice (1)	24/05/2026	1	10:00:00	12:00:00	Computer Lab M2 204	28	1	1	✓ Complete	د/ أحمد صالح	نوران قنديل	هبة الله جمال	
Pharmacy Practice (1)	24/05/2026	1	10:00:00	12:00:00	Computer Lab M2 205	11	1	1	✓ Complete	د/ غادة سعد	شروق علي	عبير سراج	
Phytochemistry (1)	24/05/2026	1	10:00:00	12:00:00	Computer Lab M2 205	11	1	1	✓ Complete	د/ غادة سعد	شروق علي	عبير سراج	
Phytochemistry 1	24/05/2026	1	10:00:00	12:00:00	Computer Lab M2 202	29	1	1	✓ Complete	د/ أحمد صالح	منة عبد الشهيد	محمد مروان	
Phytochemistry 1	24/05/2026	1	10:00:00	12:00:00	Computer Lab M2 204	1	1	1	✓ Complete	د/ أحمد صالح	نوران قنديل	هبة الله جمال	
Pathology & Pathophysiology	24/05/2026	2	13:30:00	15:30:00	Computer Lab M2 202	29	1	1	✓ Complete	د/ مصطفى بهاء	آية عادل	دينا الحسيني	
Pathology & Pathophysiology	24/05/2026	2	13:30:00	15:30:00	Computer Lab M2 204	29	1	1	✓ Complete	د/ مصطفى بهاء	ايمان ممدوح	ياسمينا منصور	
Pathology & Pathophysiology	24/05/2026	2	13:30:00	15:30:00	Computer Lab M2 205	29	1	1	✓ Complete	د/ مصطفى بهاء	رانيا اللايح	هدير امين	
Pathology & Pathophysiology	24/05/2026	2	13:30:00	15:30:00	Computer Lab M2 213	29	1	1	✓ Complete	د/ مصطفى بهاء	سمر الشربينى	هايدي رمضان	
Pathology & Pathophysiology	24/05/2026	2	13:30:00	15:30:00	Computer Lab M2 217	29	1	1	✓ Complete	د/ مصطفى بهاء	منة الداودي	هاجر ابو المعاطى	
Pathology & Pathophysiology	24/05/2026	2	13:30:00	15:30:00	Computer Lab M2 322	29	1	1	✓ Complete	د/ منة شاهين	مى صلاح	منه شروش	
Pathology & Pathophysiology	24/05/2026	2	13:30:00	15:30:00	Computer Lab M2 402	29	1	1	✓ Complete	د/ منة شاهين	ندى كمال	سميحة حمدي	
Pathology & Pathophysiology	24/05/2026	2	13:30:00	15:30:00	Computer Lab M2 409	29	1	1	✓ Complete	د/ منة شاهين	نورهان الصباغ	نور عمرو	
Pathology & Pathophysiology	24/05/2026	2	13:30:00	15:30:00	Computer Lab P101	65	1	3	✓ Complete	د/ آية سعد	شروق علي	ندى حسام	ليلى مجدى
Pathology & Pathophysiology	24/05/2026	2	13:30:00	15:30:00	Computer Lab P108	47	1	2	✓ Complete	د/ آية سعد	غادة على	روان البسيوني	سلمى داوود`;

// Arabic normalization and name cleanup logic to match code
function normalizeArabicString(str) {
  return str
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'i')
    .replace(/ي/g, 'i')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanAcademicTitle(n) {
  return n
    .replace(/^(أ\.د\.|أ\.د\/|د\.|د\/|أ\.|أ\/|م\.|م\/)\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(name) {
  return normalizeArabicString(cleanAcademicTitle(name.toLowerCase().trim()));
}

// Map dates from D/M/YYYY to YYYY-MM-DD
function parseDateString(dateStr) {
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${y}-${m}-${d}`;
  }
  return dateStr;
}

// Convert D/M/YYYY or YYYY-MM-DD to YYYY-MM-DD
function normalizeDate(d) {
  if (!d) return '';
  if (d.includes('/')) return parseDateString(d);
  return d.trim();
}

async function verify() {
  try {
    console.log('Loading database records...');
    
    // Fetch all needed records
    const { data: assignments, error: errA } = await supabase
      .from('assignments')
      .select('*, staff:staff(*), exam_session:exam_sessions(*, room:rooms(*))');
    
    if (errA) throw errA;

    console.log(`Successfully fetched ${assignments.length} assignments from DB.\n`);

    // Parse TSV rows
    const lines = rawData.trim().split('\n');
    const headers = lines[0].split('\t').map(h => h.trim());
    
    const expectedRows = lines.slice(1).map((line, idx) => {
      const cols = line.split('\t').map(c => c.trim());
      const row = {};
      headers.forEach((h, i) => {
        row[h] = cols[i] || '';
      });
      row.lineNum = idx + 2;
      return row;
    });

    console.log(`Parsed ${expectedRows.length} expected rows from TSV.\n`);

    let passedCount = 0;
    let failedCount = 0;
    const discrepancies = [];

    // Check each expected row
    expectedRows.forEach(row => {
      const targetSubject = row.Subject.toLowerCase().trim();
      const targetDate = normalizeDate(row.Date);
      const targetRoom = row.Room.toLowerCase().trim();
      const targetTime = row.Time.slice(0, 5); // E.g., "10:00"

      // Filter DB assignments for this session
      const sessionAssignments = assignments.filter(a => {
        const es = a.exam_session;
        if (!es) return false;
        const esSubject = es.subject_name.toLowerCase().trim();
        const esDate = normalizeDate(es.exam_date);
        const roomName = (es.room?.room_name || es.room_name || '').toLowerCase().trim();
        const esTime = es.start_time.slice(0, 5);
        
        return (
          esSubject === targetSubject &&
          esDate === targetDate &&
          roomName === targetRoom &&
          esTime === targetTime
        );
      });

      if (sessionAssignments.length === 0) {
        discrepancies.push({
          line: row.lineNum,
          session: `${row.Subject} | ${row.Date} | ${row.Room}`,
          issue: `No assignments found in DB for this session!`
        });
        failedCount++;
        return;
      }

      // Collect expected staff names & roles for this row
      const expectedStaff = [];
      if (row['Committees Supervisor']) {
        expectedStaff.push({ name: row['Committees Supervisor'], role: 'Head_Supervisor' });
      }
      if (row['Exam Supervisor']) {
        expectedStaff.push({ name: row['Exam Supervisor'], role: 'Exam_Supervisor' });
      }
      if (row['Invigilator 1']) {
        expectedStaff.push({ name: row['Invigilator 1'], role: 'Assistant' });
      }
      if (row['Invigilator 2']) {
        expectedStaff.push({ name: row['Invigilator 2'], role: 'Assistant' });
      }

      // Match each expected staff with DB assignment
      let rowPassed = true;
      const dbMatched = new Set();

      expectedStaff.forEach(exp => {
        const expNormName = normalizeName(exp.name);
        
        // Find matching assignment in DB
        const match = sessionAssignments.find(a => {
          if (dbMatched.has(a.id)) return false;
          if (a.role !== exp.role) return false;
          
          const dbNormName = normalizeName(a.staff?.name || '');
          // Check for exact or partial name inclusion
          return dbNormName.includes(expNormName) || expNormName.includes(dbNormName);
        });

        if (match) {
          dbMatched.add(match.id);
        } else {
          // Discrepancy
          discrepancies.push({
            line: row.lineNum,
            session: `${row.Subject} | ${row.Date} | ${row.Room}`,
            issue: `Expected "${exp.name}" as ${exp.role}, but not found/matched in DB for this session.`
          });
          rowPassed = false;
        }
      });

      // Check if DB has extra assignments not listed in the row
      sessionAssignments.forEach(a => {
        if (!dbMatched.has(a.id)) {
          discrepancies.push({
            line: row.lineNum,
            session: `${row.Subject} | ${row.Date} | ${row.Room}`,
            issue: `DB has extra assignment: "${a.staff?.name}" assigned as ${a.role}, but not in imported sheet.`
          });
          rowPassed = false;
        }
      });

      if (rowPassed) {
        passedCount++;
      } else {
        failedCount++;
      }
    });

    console.log('--- Verification Report ---');
    console.log(`Passed sessions: ${passedCount}`);
    console.log(`Failed/Mismatched sessions: ${failedCount}`);
    console.log(`Total sessions processed: ${expectedRows.length}\n`);

    if (discrepancies.length > 0) {
      console.error('--- Discrepancies Details ---');
      discrepancies.forEach(d => {
        console.error(`Row ${d.line} | ${d.session} => ${d.issue}`);
      });
      process.exit(1);
    } else {
      console.log('🎉 ALL ASSIGNMENTS MATCH THE DATABASE PRECISELY! NO DISCREPANCIES FOUND.');
      process.exit(0);
    }

  } catch (error) {
    console.error('Verification error:', error);
    process.exit(1);
  }
}

verify();
