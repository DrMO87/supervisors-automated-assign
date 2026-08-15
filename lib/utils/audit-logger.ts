import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/client';

export interface LogActivityParams {
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'AUTO_ASSIGN' | 'PERIOD_CHANGE' | 'SWAP_APPROVED' | 'BACKUP_RESTORE';
  tableName: string;
  recordId: string;
  summary: string;
  oldValues?: any;
  newValues?: any;
  userEmail?: string | null;
  userRole?: string | null;
}

export async function logActivity(client: SupabaseClient | null, params: LogActivityParams) {
  const sb = client || supabaseAdmin;
  if (!sb) return;

  try {
    let email = params.userEmail;
    let role = params.userRole;

    if (!email) {
      const { data: userRes } = await sb.auth.getUser();
      email = userRes?.user?.email || 'System Engine';
    }

    if (!role && email) {
      if (email.toLowerCase().includes('melkhodary')) {
        role = 'Super Admin';
      } else if (email.toLowerCase().includes('hod')) {
        role = 'Head of Department';
      } else if (email === 'System Engine') {
        role = 'Automated System';
      } else {
        role = 'Coordinator';
      }
    }

    await sb.from('audit_log').insert({
      table_name: params.tableName,
      record_id: params.recordId,
      action: params.action,
      old_values: params.oldValues || null,
      new_values: params.newValues || null,
      changed_by_email: email,
      user_role: role || 'User',
      summary: params.summary,
      changed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}
