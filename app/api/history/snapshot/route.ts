import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSnapshot } from '@/lib/utils/snapshot-helpers';

export async function POST() {
  try {
const supabaseAuth = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabaseAuth.auth.getSession();
    const email = session?.user?.email?.toLowerCase();
    if (!session || email !== 'melkhodary@horus.edu.eg') {
      return NextResponse.json({ error: 'Unauthorized Access. Super Administrators only.' }, { status: 403 });
    }

    const timestamp = await createSnapshot();
    return NextResponse.json({ success: true, timestamp });
  } catch (error: any) {
    console.error('Snapshot creation failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
