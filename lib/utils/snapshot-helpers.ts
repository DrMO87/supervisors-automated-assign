import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/client';

export async function createSnapshot() {
  if (!isSupabaseConfigured() || !supabaseAdmin) {
    throw new Error('Supabase is not configured');
  }

  // Fetch current state of all critical tables
  const [
    { data: assignments, error: aErr },
    { data: staff, error: sErr },
    { data: exams, error: eErr },
    { data: rooms, error: rErr },
    { data: periodFreeStaff, error: pErr }
  ] = await Promise.all([
    supabaseAdmin.from('assignments').select('*'),
    supabaseAdmin.from('staff').select('*'),
    supabaseAdmin.from('exam_sessions').select('*'),
    supabaseAdmin.from('rooms').select('*'),
    supabaseAdmin.from('period_free_staff').select('*')
  ]);

  if (aErr) throw aErr;
  if (sErr) throw sErr;
  if (eErr) throw eErr;
  if (rErr) throw rErr;
  if (pErr) throw pErr;

  const snapshotData = {
    timestamp: new Date().toISOString(),
    assignments: assignments || [],
    staff: staff || [],
    exams: exams || [],
    rooms: rooms || [],
    period_free_staff: periodFreeStaff || []
  };

  // Save to system_settings under key 'latest_undo_snapshot'
  const { error } = await supabaseAdmin.from('system_settings').upsert({
    setting_key: 'latest_undo_snapshot',
    setting_value: snapshotData,
    updated_at: new Date().toISOString()
  }, { onConflict: 'setting_key' });

  if (error) throw error;
  
  return snapshotData.timestamp;
}

export async function restoreSnapshot() {
  if (!isSupabaseConfigured() || !supabaseAdmin) {
    throw new Error('Supabase is not configured');
  }

  // Get the snapshot
  const { data: setting, error: getErr } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'latest_undo_snapshot')
    .single();

  if (getErr || !setting || !setting.setting_value) {
    throw new Error('No undo snapshot available');
  }

  const snapshot = setting.setting_value as any;

  if (!snapshot.staff || !snapshot.exams || !snapshot.rooms) {
    throw new Error('Snapshot data is corrupted or incomplete');
  }

  // First, delete everything from tables (due to FK constraints, order matters)
  // assignments and period_free_staff refer to staff, exams, rooms.
  await supabaseAdmin.from('assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseAdmin.from('period_free_staff').delete().neq('id', 0); // Assuming integer or uuid. We can just use neq to some dummy value or gte. Actually neq('exam_date', '1900-01-01') is safer.
  
  // It's safer to delete by matching existing records, but Supabase doesn't support empty deletes easily.
  // Instead, delete where id is not null.
  await supabaseAdmin.from('assignments').delete().not('id', 'is', null);
  await supabaseAdmin.from('period_free_staff').delete().not('staff_id', 'is', null);
  await supabaseAdmin.from('exam_sessions').delete().not('id', 'is', null);
  await supabaseAdmin.from('rooms').delete().not('id', 'is', null);
  await supabaseAdmin.from('staff').delete().not('id', 'is', null);

  // Now insert data from snapshot
  if (snapshot.staff.length > 0) {
    const { error } = await supabaseAdmin.from('staff').insert(snapshot.staff);
    if (error) throw new Error('Failed to restore staff: ' + error.message);
  }

  if (snapshot.rooms.length > 0) {
    const { error } = await supabaseAdmin.from('rooms').insert(snapshot.rooms);
    if (error) throw new Error('Failed to restore rooms: ' + error.message);
  }

  if (snapshot.exams.length > 0) {
    const { error } = await supabaseAdmin.from('exam_sessions').insert(snapshot.exams);
    if (error) throw new Error('Failed to restore exams: ' + error.message);
  }

  if (snapshot.assignments && snapshot.assignments.length > 0) {
    const { error } = await supabaseAdmin.from('assignments').insert(snapshot.assignments);
    if (error) throw new Error('Failed to restore assignments: ' + error.message);
  }

  if (snapshot.period_free_staff && snapshot.period_free_staff.length > 0) {
    const { error } = await supabaseAdmin.from('period_free_staff').insert(snapshot.period_free_staff);
    if (error) throw new Error('Failed to restore free staff: ' + error.message);
  }

  // Optional: clear the snapshot after restoring so they can't undo an undo indefinitely?
  // Or leave it so they can undo multiple times to the same baseline.

  return true;
}
