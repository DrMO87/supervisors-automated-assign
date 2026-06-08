import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { restoreSnapshot } from '@/lib/utils/snapshot-helpers';

export async function POST() {
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabaseAuth.auth.getSession();
    if (!session || session.user.user_metadata?.role !== 'control') {
      return NextResponse.json({ error: 'Unauthorized Access. Administrators only.' }, { status: 403 });
    }

    await restoreSnapshot();
    return NextResponse.json({ success: true, message: 'Undo successful' });
  } catch (error: any) {
    console.error('Undo failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
