import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/client';

export async function POST() {
  try {
const supabaseAuth = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabaseAuth.auth.getSession();
    const email = session?.user?.email?.toLowerCase();
    if (!session || email !== 'melkhodary@horus.edu.eg') {
      return NextResponse.json({ error: 'Unauthorized Access. Super Administrators only.' }, { status: 403 });
    }

    if (!isSupabaseConfigured() || !supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase is not configured' },
        { status: 503 }
      );
    }

    // 1. Fetch all assignments
    const { data: assignments, error: assignmentsError } = await supabaseAdmin
      .from('assignments')
      .select('*');

    if (assignmentsError) throw assignmentsError;

    // 2. Fetch all staff
    const { data: staff, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('*');

    if (staffError) throw staffError;

    // 3. Upsert backups into system_settings
    const now = new Date().toISOString();

    const { error: upsertAssignmentsError } = await supabaseAdmin
      .from('system_settings')
      .upsert({
        setting_key: 'backup_assignments',
        setting_value: assignments || [],
        description: 'Backup of assignments table',
        updated_at: now,
      }, { onConflict: 'setting_key' });

    if (upsertAssignmentsError) throw upsertAssignmentsError;

    const { error: upsertStaffError } = await supabaseAdmin
      .from('system_settings')
      .upsert({
        setting_key: 'backup_staff',
        setting_value: staff || [],
        description: 'Backup of staff table (scores only typically)',
        updated_at: now,
      }, { onConflict: 'setting_key' });

    if (upsertStaffError) throw upsertStaffError;

    return NextResponse.json({
      success: true,
      message: 'Backup created successfully!',
    });
  } catch (error: any) {
    console.error('Backup creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create backup' },
      { status: 500 }
    );
  }
}
