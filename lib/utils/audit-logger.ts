import { SupabaseClient } from '@supabase/supabase-js';

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

/**
 * Log activity from client components via the /api/audit-logs POST endpoint
 */
export async function logClientActivity(params: LogActivityParams) {
  try {
    await fetch('/api/audit-logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
  } catch (error) {
    console.error('Failed to log client activity:', error);
  }
}

/**
 * Log activity from server routes directly using Supabase client
 */
export async function logActivity(client: SupabaseClient | null, params: LogActivityParams) {
  if (!client) return;

  try {
    let email = params.userEmail;
    let role = params.userRole;

    if (!email) {
      try {
        const { data: userRes } = await client.auth.getUser();
        email = userRes?.user?.email || 'System Engine';
      } catch (e) {
        email = 'System Engine';
      }
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

    // Ensure recordId is a valid UUID or fallback to system zero-UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const safeRecordId = (params.recordId && uuidRegex.test(params.recordId))
      ? params.recordId
      : '00000000-0000-0000-0000-000000000000';

    await client.from('audit_log').insert({
      table_name: params.tableName,
      record_id: safeRecordId,
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
