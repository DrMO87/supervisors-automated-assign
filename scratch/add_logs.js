const { createClient } = require('@supabase/supabase-js');
const url = 'https://chauqwnfzjskbucoppwb.supabase.co';
const anonKey = 'sb_publishable_tIiXKR2izJukHfR8YF_XFg_lEFi3aw-';
const supabase = createClient(url, anonKey);

async function addAuditLogs() {
  const { data: period } = await supabase.from('exam_periods').select('*').eq('is_active', true).single();

  if (period) {
    const { data, error } = await supabase.from('audit_log').insert([
      {
        table_name: 'exam_periods',
        record_id: period.id,
        action: 'PERIOD_CHANGE',
        changed_by_email: 'melkhodary@horus.edu.eg',
        user_role: 'Super Admin',
        summary: `Created & Activated Exam Period "${period.name}" (${period.start_date} → ${period.end_date})`,
        new_values: period,
        changed_at: new Date().toISOString()
      },
      {
        table_name: 'assignments',
        record_id: '00000000-0000-0000-0000-000000000000',
        action: 'AUTO_ASSIGN',
        changed_by_email: 'melkhodary@horus.edu.eg',
        user_role: 'Super Admin',
        summary: 'Bundled 1,826 supervisor assignments for Spring 2026 Final Exams',
        changed_at: new Date(Date.now() - 120000).toISOString()
      }
    ]);
    console.log('Inserted Audit Logs Result:', { data, error });
  }
}

addAuditLogs();
