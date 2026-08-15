require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  console.log("Connecting to Supabase at:", process.env.NEXT_PUBLIC_SUPABASE_URL);

  const stats = {};

  // 1. Staff Statistics
  const { data: staff, error: staffErr } = await supabase.from('staff').select('*');
  if (staffErr) console.error("Staff Error:", staffErr);
  else {
    stats.staff = {
      total: staff.length,
      byJobTitle: {},
      bySupervisionRole: {},
      byAvailability: {},
      byEmployment: {},
      healthIssuesCount: staff.filter(s => s.has_health_issue).length,
      feedingMothersCount: staff.filter(s => s.is_feeding_mother).length,
      overloadedCount: staff.filter(s => s.is_overloaded).length,
      oralSupervisorsCount: staff.filter(s => s.can_supervise_oral).length,
      scoreStats: {
        minScore: Math.min(...staff.map(s => s.current_score || 0)),
        maxScore: Math.max(...staff.map(s => s.current_score || 0)),
        avgScore: (staff.reduce((acc, s) => acc + (s.current_score || 0), 0) / staff.length).toFixed(2),
        minReserveScore: Math.min(...staff.map(s => s.free_staff_score || 0)),
        maxReserveScore: Math.max(...staff.map(s => s.free_staff_score || 0)),
        avgReserveScore: (staff.reduce((acc, s) => acc + (s.free_staff_score || 0), 0) / staff.length).toFixed(2)
      }
    };
    staff.forEach(s => {
      stats.staff.byJobTitle[s.job_title] = (stats.staff.byJobTitle[s.job_title] || 0) + 1;
      stats.staff.bySupervisionRole[s.supervision_role] = (stats.staff.bySupervisionRole[s.supervision_role] || 0) + 1;
      stats.staff.byAvailability[s.availability_status] = (stats.staff.byAvailability[s.availability_status] || 0) + 1;
      stats.staff.byEmployment[s.employment_status] = (stats.staff.byEmployment[s.employment_status] || 0) + 1;
    });
  }

  // 2. Rooms Statistics
  const { data: rooms, error: roomsErr } = await supabase.from('rooms').select('*');
  if (roomsErr) console.error("Rooms Error:", roomsErr);
  else {
    stats.rooms = {
      total: rooms.length,
      active: rooms.filter(r => r.is_active).length,
      totalCapacity: rooms.reduce((acc, r) => acc + (r.max_capacity || 0), 0),
      avgCapacity: (rooms.reduce((acc, r) => acc + (r.max_capacity || 0), 0) / (rooms.length || 1)).toFixed(1),
      byBuilding: {}
    };
    rooms.forEach(r => {
      const b = r.building || r.building_code || 'Unassigned';
      stats.rooms.byBuilding[b] = (stats.rooms.byBuilding[b] || 0) + 1;
    });
  }

  // 3. Exam Sessions & Duration Statistics
  let allExams = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const { data: exams, error: examErr } = await supabase
      .from('exam_sessions')
      .select('*')
      .range(from, from + 999);
    if (examErr) { console.error("Exam Error:", examErr); break; }
    if (exams && exams.length > 0) {
      allExams = allExams.concat(exams);
      from += 1000;
      if (exams.length < 1000) hasMore = false;
    } else hasMore = false;
  }

  stats.exams = {
    totalSessions: allExams.length,
    totalStudents: allExams.reduce((acc, e) => acc + (e.student_count || 0), 0),
    avgStudentsPerSession: (allExams.reduce((acc, e) => acc + (e.student_count || 0), 0) / (allExams.length || 1)).toFixed(1),
    dateRange: {
      minDate: allExams.map(e => e.exam_date).sort()[0],
      maxDate: allExams.map(e => e.exam_date).sort().slice(-1)[0],
      totalExamDays: new Set(allExams.map(e => e.exam_date)).size
    },
    byExamType: {},
    byProgram: {},
    byStartTime: {},
    durationStats: {
      durationsInMinutes: {},
      avgDurationMinutes: 0
    },
    lockedSessionsCount: allExams.filter(e => e.is_locked).length
  };

  let totalDurationMinutes = 0;
  let durationCount = 0;

  allExams.forEach(e => {
    const type = e.exam_type || 'Standard';
    stats.exams.byExamType[type] = (stats.exams.byExamType[type] || 0) + 1;

    const prog = e.program || 'General';
    stats.exams.byProgram[prog] = (stats.exams.byProgram[prog] || 0) + 1;

    const st = e.start_time || 'Unspecified';
    stats.exams.byStartTime[st] = (stats.exams.byStartTime[st] || 0) + 1;

    // Calculate duration
    if (e.start_time && e.end_time) {
      const [h1, m1] = e.start_time.split(':').map(Number);
      const [h2, m2] = e.end_time.split(':').map(Number);
      const diffMins = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (diffMins > 0) {
        stats.exams.durationStats.durationsInMinutes[`${diffMins} mins`] = (stats.exams.durationStats.durationsInMinutes[`${diffMins} mins`] || 0) + 1;
        totalDurationMinutes += diffMins;
        durationCount++;
      }
    } else {
      stats.exams.durationStats.durationsInMinutes['Standard (3 hrs / 180 mins)'] = (stats.exams.durationStats.durationsInMinutes['Standard (3 hrs / 180 mins)'] || 0) + 1;
      totalDurationMinutes += 180;
      durationCount++;
    }
  });

  if (durationCount > 0) {
    stats.exams.durationStats.avgDurationMinutes = (totalDurationMinutes / durationCount).toFixed(1);
  }

  // 4. Assignments Statistics
  let allAssignments = [];
  from = 0;
  hasMore = true;
  while (hasMore) {
    const { data: assignments, error: assignErr } = await supabase
      .from('assignments')
      .select('*')
      .range(from, from + 999);
    if (assignErr) { console.error("Assignment Error:", assignErr); break; }
    if (assignments && assignments.length > 0) {
      allAssignments = allAssignments.concat(assignments);
      from += 1000;
      if (assignments.length < 1000) hasMore = false;
    } else hasMore = false;
  }

  const staffAssignmentCounts = {};
  allAssignments.forEach(a => {
    staffAssignmentCounts[a.staff_id] = (staffAssignmentCounts[a.staff_id] || 0) + 1;
  });
  const assignCountsArr = Object.values(staffAssignmentCounts);

  stats.assignments = {
    totalAssignments: allAssignments.length,
    manualOverridesCount: allAssignments.filter(a => a.is_manual_override).length,
    byRole: {},
    workloadDistribution: {
      minAssignedToAStaff: assignCountsArr.length ? Math.min(...assignCountsArr) : 0,
      maxAssignedToAStaff: assignCountsArr.length ? Math.max(...assignCountsArr) : 0,
      avgAssignedPerStaff: (allAssignments.length / (staff?.length || 1)).toFixed(1),
      assignedStaffCount: Object.keys(staffAssignmentCounts).length,
      unassignedStaffCount: (staff?.length || 0) - Object.keys(staffAssignmentCounts).length
    }
  };

  allAssignments.forEach(a => {
    stats.assignments.byRole[a.role] = (stats.assignments.byRole[a.role] || 0) + 1;
  });

  // 5. Reserve Assignments (Period Free Staff)
  const { data: reserves, error: resErr } = await supabase.from('period_free_staff').select('*');
  if (resErr) console.error("Reserves Error:", resErr);
  else {
    stats.reserves = {
      totalReserveDuties: reserves.length,
      byRole: {}
    };
    reserves.forEach(r => {
      stats.reserves.byRole[r.role] = (stats.reserves.byRole[r.role] || 0) + 1;
    });
  }

  // 6. Swap Requests
  const { data: swaps, error: swapErr } = await supabase.from('swap_requests').select('*');
  if (swapErr) console.error("Swaps Error:", swapErr);
  else {
    stats.swaps = {
      totalRequests: swaps.length,
      byStatus: {}
    };
    swaps.forEach(s => {
      stats.swaps.byStatus[s.status] = (stats.swaps.byStatus[s.status] || 0) + 1;
    });
  }

  // 7. Audit Log Statistics
  const { data: auditLogs, count: auditCount, error: auditErr } = await supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('changed_at', { ascending: false })
    .limit(20);

  if (auditErr) console.error("Audit Log Error:", auditErr);
  else {
    stats.auditLog = {
      totalRecords: auditCount || auditLogs.length,
      recentLogsSampleCount: auditLogs.length,
      byAction: {},
      byTable: {}
    };
    // Fetch aggregated table/action counts if possible
    const { data: allLogs } = await supabase.from('audit_log').select('action, table_name');
    if (allLogs) {
      allLogs.forEach(l => {
        stats.auditLog.byAction[l.action] = (stats.auditLog.byAction[l.action] || 0) + 1;
        stats.auditLog.byTable[l.table_name] = (stats.auditLog.byTable[l.table_name] || 0) + 1;
      });
    }
  }

  // 8. System Settings
  const { data: settings, error: setErr } = await supabase.from('system_settings').select('*');
  if (!setErr && settings) {
    stats.systemSettings = {
      totalKeys: settings.length,
      keys: settings.map(s => s.setting_key)
    };
  }

  // Output JSON
  console.log("\n=== SUPABASE LIVE STATS RESULT ===");
  console.log(JSON.stringify(stats, null, 2));
}

run().catch(console.error);
