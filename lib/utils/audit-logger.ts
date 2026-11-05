import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { HOD_EMAILS } from '@/lib/config/hod-accounts';

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
    let email = params.userEmail;
    let role = params.userRole;

    // Automatically resolve logged in user if on browser and not provided
    if (!email && typeof window !== 'undefined' && supabase) {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        if (userRes?.user?.email) {
          email = userRes.user.email;
          role = role || userRes.user.user_metadata?.role ||
            (email.toLowerCase().includes('melkhodary') ? 'Super Admin' :
             email.toLowerCase().includes('admin') ? 'Super Admin' :
             HOD_EMAILS.includes(email.toLowerCase()) ? 'Head of Department' : 'Coordinator');
        }
      } catch (e) {
        // Fallback
      }
    }

    if (!email || email === 'System Engine') {
      email = 'melkhodary@horus.edu.eg';
      role = role || 'Super Admin';
    }

    await fetch('/api/audit-logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...params,
        userEmail: email,
        userRole: role,
      }),
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

    if (!email || email === 'System Engine') {
      try {
        const { data: userRes } = await client.auth.getUser();
        if (userRes?.user?.email) {
          email = userRes.user.email;
        }
      } catch (e) {}
    }

    // Default to primary administrator if still unresolved
    if (!email || email === 'System Engine') {
      email = 'melkhodary@horus.edu.eg';
    }

    if (!role && email) {
      if (email.toLowerCase().includes('melkhodary') || email.toLowerCase().includes('admin')) {
        role = 'Super Admin';
      } else if (HOD_EMAILS.includes(email.toLowerCase())) {
        role = 'Head of Department';
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
      user_role: role || 'Super Admin',
      summary: params.summary,
      changed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}
