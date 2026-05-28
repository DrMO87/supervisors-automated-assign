import { NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/client';
import type { Assignment, Staff } from '@/types/database.types';

export async function POST() {
  try {
    if (!isSupabaseConfigured() || !supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase is not configured' },
        { status: 503 }
      );
    }

    // 1. Fetch backups from system_settings
    const { data: assignmentsSetting, error: assignmentsErr } = await supabaseAdmin
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'backup_assignments')
      .single();

    if (assignmentsErr || !assignmentsSetting) {
      return NextResponse.json(
        { error: 'No assignments backup found' },
        { status: 404 }
      );
    }

    const { data: staffSetting, error: staffErr } = await supabaseAdmin
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'backup_staff')
      .single();

    if (staffErr || !staffSetting) {
      return NextResponse.json(
        { error: 'No staff backup found' },
        { status: 404 }
      );
    }

    const backupAssignments: Assignment[] = assignmentsSetting.setting_value || [];
    const backupStaff: Staff[] = staffSetting.setting_value || [];

    // 2. Delete all current assignments
    const { error: deleteAssignmentsError } = await supabaseAdmin
      .from('assignments')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Deletes all

    if (deleteAssignmentsError) throw deleteAssignmentsError;

    // 3. Insert backup assignments
    if (backupAssignments.length > 0) {
      const { error: insertAssignmentsError } = await supabaseAdmin
        .from('assignments')
        .insert(backupAssignments);

      if (insertAssignmentsError) throw insertAssignmentsError;
    }

    // 4. Restore staff scores
    // We update each staff member's scores instead of deleting them to prevent cascade delete issues
    if (backupStaff.length > 0) {
      // Create updates promise array
      const staffUpdatePromises = backupStaff.map((staffMember) => 
        supabaseAdmin
          .from('staff')
          .update({
            current_score: staffMember.current_score,
            free_staff_score: staffMember.free_staff_score,
          })
          .eq('id', staffMember.id)
      );

      // Execute all updates in parallel (Supabase allows multiple concurrent requests, but let's do chunks if huge)
      // Since it's usually < 200 staff, Promise.all is fine.
      await Promise.all(staffUpdatePromises);
    }

    return NextResponse.json({
      success: true,
      message: 'Restore completed successfully!',
    });
  } catch (error: any) {
    console.error('Backup restore error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to restore backup' },
      { status: 500 }
    );
  }
}
