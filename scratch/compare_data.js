const fs = require('fs');
const path = require('path');

// The raw table from the user
const rawTable = `Subject	Date	Period	Time	End Time	Room	Student Count	Required Exam Supervisor	Required Invigilator	⚠ Missing Roles	Committees Supervisor	Exam Supervisor	Invigilator 1	Invigilator 2
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

const dbResults = JSON.parse(fs.readFileSync(path.join(__dirname, 'db_results.json'), 'utf8'));

// Helper to normalize arabic names (remove extra spaces, normalize alef/ya, etc.)
function normalizeArabic(text) {
  if (!text) return '';
  return text.trim()
    .replace(/\s+/g, ' ')
    .replace(/[أإآا]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/[ةه]/g, 'ه');
}

function parseUserTable(tableText) {
  const lines = tableText.trim().split('\n');
  const headers = lines[0].split('\t').map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split('\t').map(c => c.trim());
    if (cells.length < headers.length) continue;
    
    const row = {};
    headers.forEach((h, index) => {
      row[h] = cells[index] || '';
    });
    rows.push(row);
  }
  return rows;
}

const userRows = parseUserTable(rawTable);

console.log(`Parsed ${userRows.length} rows from user input.`);

const discrepancies = [];

userRows.forEach((uRow, idx) => {
  // Convert date format from DD/MM/YYYY to YYYY-MM-DD
  const parts = uRow['Date'].split('/');
  const formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
  const studentCount = parseInt(uRow['Student Count']);
  
  // Find matching session in DB
  // Match on subject, date, room, start_time, and student count
  const matched = dbResults.find(d => {
    const subjectMatch = normalizeArabic(d.subject) === normalizeArabic(uRow['Subject']);
    const dateMatch = d.date === formattedDate;
    const roomMatch = normalizeArabic(d.room) === normalizeArabic(uRow['Room']);
    
    const dbTime = d.start_time.substring(0, 5);
    const userTime = uRow['Time'].substring(0, 5);
    const timeMatch = dbTime === userTime;
    
    const countMatch = d.student_count === studentCount;
    
    return subjectMatch && dateMatch && roomMatch && timeMatch && countMatch;
  });
  
  if (!matched) {
    discrepancies.push({
      line: idx + 2,
      type: 'MISSING_SESSION_IN_DB',
      message: `Could not find session in database matching: Subject "${uRow['Subject']}" on ${uRow['Date']} at ${uRow['Time']} in Room "${uRow['Room']}" with Student Count ${studentCount}`
    });
    return;
  }
  
  // Compare Committees Supervisor (Head_Supervisor in DB)
  const userCommSup = uRow['Committees Supervisor'];
  const dbCommSups = matched.roles['Head_Supervisor'] || matched.roles['Committees_Supervisor'] || [];
  const normalizedUserComm = normalizeArabic(userCommSup);
  const normalizedDbComm = dbCommSups.map(normalizeArabic);
  
  if (userCommSup && !normalizedDbComm.includes(normalizedUserComm)) {
    discrepancies.push({
      line: idx + 2,
      type: 'COMMITTEES_SUPERVISOR_MISMATCH',
      subject: uRow['Subject'],
      date: uRow['Date'],
      room: uRow['Room'],
      student_count: studentCount,
      message: `Committees Supervisor mismatch: User has "${userCommSup}", Database has "${dbCommSups.join(', ') || 'None'}"`
    });
  }
  
  // Compare Exam Supervisor
  const userExamSup = uRow['Exam Supervisor'];
  const dbExamSups = matched.roles['Exam_Supervisor'] || [];
  const normalizedUserExam = normalizeArabic(userExamSup);
  const normalizedDbExam = dbExamSups.map(normalizeArabic);
  
  if (userExamSup && !normalizedDbExam.includes(normalizedUserExam)) {
    discrepancies.push({
      line: idx + 2,
      type: 'EXAM_SUPERVISOR_MISMATCH',
      subject: uRow['Subject'],
      date: uRow['Date'],
      room: uRow['Room'],
      student_count: studentCount,
      message: `Exam Supervisor mismatch: User has "${userExamSup}", Database has "${dbExamSups.join(', ') || 'None'}"`
    });
  }

  // Compare Invigilators (Assistants in DB)
  const userInvigilators = [];
  if (uRow['Invigilator 1']) userInvigilators.push(uRow['Invigilator 1']);
  if (uRow['Invigilator 2']) userInvigilators.push(uRow['Invigilator 2']);
  
  const dbAssistants = matched.roles['Assistant'] || [];
  
  const normalizedUserInvs = userInvigilators.map(normalizeArabic);
  const normalizedDbAssists = dbAssistants.map(normalizeArabic);
  
  // Check if every user invigilator is present in DB assistants
  userInvigilators.forEach(userInv => {
    if (!normalizedDbAssists.includes(normalizeArabic(userInv))) {
      discrepancies.push({
        line: idx + 2,
        type: 'INVIGILATOR_MISSING_IN_DB',
        subject: uRow['Subject'],
        date: uRow['Date'],
        room: uRow['Room'],
        student_count: studentCount,
        message: `Invigilator "${userInv}" is assigned in user table but missing in database (DB has assistants: "${dbAssistants.join(', ') || 'None'}")`
      });
    }
  });

  // Check if there are extra assistants in DB not mentioned in user table
  dbAssistants.forEach(dbAssist => {
    if (!normalizedUserInvs.includes(normalizeArabic(dbAssist))) {
      discrepancies.push({
        line: idx + 2,
        type: 'EXTRA_INVIGILATOR_IN_DB',
        subject: uRow['Subject'],
        date: uRow['Date'],
        room: uRow['Room'],
        student_count: studentCount,
        message: `Database has extra Invigilator (Assistant) "${dbAssist}" who is not in user table (User table has: "${userInvigilators.join(', ') || 'None'}")`
      });
    }
  });
});

console.log("\n--- Comparison Report ---");
if (discrepancies.length === 0) {
  console.log("No discrepancies found! Database is updated precisely according to the user table.");
} else {
  console.log(`Found ${discrepancies.length} discrepancies:`);
  discrepancies.forEach(d => {
    console.log(`[Line ${d.line}] [${d.type}] ${d.message}`);
  });
}
