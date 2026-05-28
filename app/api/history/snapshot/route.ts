import { NextResponse } from 'next/server';
import { createSnapshot } from '@/lib/utils/snapshot-helpers';

export async function POST() {
  try {
    const timestamp = await createSnapshot();
    return NextResponse.json({ success: true, timestamp });
  } catch (error: any) {
    console.error('Snapshot creation failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
