import { NextResponse } from 'next/server';
import { restoreSnapshot } from '@/lib/utils/snapshot-helpers';

export async function POST() {
  try {
    await restoreSnapshot();
    return NextResponse.json({ success: true, message: 'Undo successful' });
  } catch (error: any) {
    console.error('Undo failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
