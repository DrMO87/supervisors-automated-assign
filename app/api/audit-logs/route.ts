import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { logActivity } from '@/lib/utils/audit-logger';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const tableName = searchParams.get('table');

    let query = supabaseAdmin
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('changed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (tableName) {
      query = query.eq('table_name', tableName);
    }

    const { data, count, error } = await query;
    if (error) {
      console.error('Error fetching audit logs:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ logs: data || [], total: count || 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await logActivity(supabaseAdmin, body);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error logging audit activity:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
