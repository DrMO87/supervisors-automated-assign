import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import {
  recordHeartbeat,
  removeSession,
  getPresenceSummary,
  normalizeIp,
  parseDevice,
  resolveUserRole,
} from '@/lib/presence/presence-manager';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const summary = getPresenceSummary();
    return NextResponse.json(summary);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch presence' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const isDisconnect = searchParams.get('action') === 'disconnect';

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body may be empty on beacon disconnect
    }

    const sessionId = body?.sessionId || searchParams.get('sessionId');
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    if (isDisconnect) {
      removeSession(sessionId);
      return NextResponse.json({ success: true, disconnected: sessionId });
    }

    // Resolve IP address
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const cfIp = req.headers.get('cf-connecting-ip');
    const rawIp = forwarded || realIp || cfIp || (req as any).ip;
    const ipAddress = normalizeIp(rawIp);

    // Resolve Device and OS
    const userAgent = req.headers.get('user-agent');
    const { device, os, browser } = parseDevice(userAgent);

    // Resolve Authenticated Session
    let userId: string | null = null;
    let email: string | null = null;
    let name: string | null = null;
    let userMetadata: any = null;

    try {
      const supabaseAuth = createRouteHandlerClient({ cookies });
      const { data: { session } } = await supabaseAuth.auth.getSession();
      if (session?.user) {
        userId = session.user.id;
        email = session.user.email || null;
        userMetadata = session.user.user_metadata || {};
        name = userMetadata.name || (email ? email.split('@')[0] : null);
      }
    } catch (e) {
      // Unauthenticated / fallback
    }

    const role = resolveUserRole(email, userMetadata);
    const currentPage = body.page || '/';

    const recorded = recordHeartbeat({
      sessionId,
      userId,
      email,
      name,
      role,
      ipAddress,
      currentPage,
      device,
      os,
      browser,
    });

    const summary = getPresenceSummary();

    return NextResponse.json({
      success: true,
      current: recorded,
      summary,
    });
  } catch (error: any) {
    console.error('Presence heartbeat error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    if (sessionId) {
      removeSession(sessionId);
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
