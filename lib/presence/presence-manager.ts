import { ActiveUserSession, PresenceSummary } from '@/types/presence.types';
import { supabaseAdmin } from '@/lib/supabase/client';
import { HOD_EMAILS } from '@/lib/config/hod-accounts';

// Inactivity threshold: 60 seconds (1 minute without heartbeat marks offline)
const INACTIVITY_TIMEOUT_MS = 60 * 1000;

// Rate-limit database sync to avoid overloading Supabase
const DB_SYNC_INTERVAL_MS = 15 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var __globalPresenceSessions: Map<string, ActiveUserSession> | undefined;
  // eslint-disable-next-line no-var
  var __lastPresenceDbSyncTime: number | undefined;
}

if (!globalThis.__globalPresenceSessions) {
  globalThis.__globalPresenceSessions = new Map<string, ActiveUserSession>();
}

export function cleanStaleSessions(): void {
  const sessions = globalThis.__globalPresenceSessions;
  if (!sessions) return;
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    const lastActive = new Date(session.lastSeenAt).getTime();
    if (now - lastActive > INACTIVITY_TIMEOUT_MS) {
      sessions.delete(id);
    }
  }
}

export function normalizeIp(rawIp: string | null | undefined): string {
  if (!rawIp) return '127.0.0.1';
  let ip = rawIp.trim();
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }
  // Remove IPv6 prefix if mapped IPv4 (e.g., ::ffff:192.168.1.1)
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  if (ip === '::1') {
    return '127.0.0.1';
  }
  return ip || '127.0.0.1';
}

export function parseDevice(ua: string | null | undefined): {
  device: 'Desktop' | 'Mobile' | 'Tablet';
  os: string;
  browser: string;
} {
  if (!ua) {
    return { device: 'Desktop', os: 'Unknown OS', browser: 'Browser' };
  }
  const isTablet = /ipad|tablet|(android(?!.*mobile))/i.test(ua);
  const isMobile = !isTablet && /mobile|iphone|ipod|android.*mobile|windows.*phone|blackberry/i.test(ua);
  const device: 'Desktop' | 'Mobile' | 'Tablet' = isTablet ? 'Tablet' : isMobile ? 'Mobile' : 'Desktop';

  let os = 'Unknown OS';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/chrome|crios/i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome|crios|android/i.test(ua)) browser = 'Safari';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/opr\//i.test(ua)) browser = 'Opera';

  return { device, os, browser };
}

export function resolveUserRole(email?: string | null, metadata?: any): string {
  const emailLower = (email || '').toLowerCase().trim();
  const metaRole = (metadata?.role || '').toLowerCase().trim();

  if (emailLower.includes('melkhodary') || emailLower.startsWith('admin@')) {
    return 'Super Admin';
  }

  if (metaRole === 'control') {
    return 'Control Officer';
  }

  if (metaRole === 'admin_reports') {
    return 'Auditor (Admin Reports)';
  }

  if (metaRole === 'hod' || HOD_EMAILS.some(h => emailLower.includes(h.toLowerCase()))) {
    return 'Head of Department';
  }

  if (metaRole === 'staff' || emailLower === 'staff@horus.edu.eg') {
    return 'Faculty Staff';
  }

  if (metadata?.role) {
    return String(metadata.role);
  }

  if (emailLower) {
    return 'Authorized User';
  }

  return 'Guest / Visitor';
}

export function recordHeartbeat(sessionData: Omit<ActiveUserSession, 'firstSeenAt' | 'lastSeenAt'>): ActiveUserSession {
  cleanStaleSessions();
  const sessions = globalThis.__globalPresenceSessions!;
  const existing = sessions.get(sessionData.sessionId);
  const now = new Date().toISOString();

  const record: ActiveUserSession = {
    ...sessionData,
    firstSeenAt: existing?.firstSeenAt || now,
    lastSeenAt: now,
  };

  sessions.set(sessionData.sessionId, record);

  // Opportunistic DB Sync
  const lastSync = globalThis.__lastPresenceDbSyncTime || 0;
  if (Date.now() - lastSync > DB_SYNC_INTERVAL_MS) {
    globalThis.__lastPresenceDbSyncTime = Date.now();
    syncToDatabase().catch((e) => console.warn('Presence DB sync error:', e));
  }

  return record;
}

export function removeSession(sessionId: string): void {
  const sessions = globalThis.__globalPresenceSessions;
  if (sessions && sessions.has(sessionId)) {
    sessions.delete(sessionId);
    syncToDatabase().catch((e) => console.warn('Presence DB sync error:', e));
  }
}

export function getPresenceSummary(): PresenceSummary {
  cleanStaleSessions();
  const sessions = Array.from(globalThis.__globalPresenceSessions?.values() || []);
  
  // Sort most recently active first
  sessions.sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());

  const uniqueIps = new Set(sessions.map(s => s.ipAddress));
  const uniqueUsers = new Set(sessions.map(s => s.email || s.userId || s.sessionId));

  return {
    onlineCount: sessions.length,
    uniqueAddressesCount: uniqueIps.size,
    uniqueUsersCount: uniqueUsers.size,
    sessions,
    lastUpdated: new Date().toISOString(),
  };
}

export async function syncToDatabase(): Promise<void> {
  try {
    const summary = getPresenceSummary();
    await supabaseAdmin.from('system_settings').upsert({
      setting_key: 'active_online_sessions',
      setting_value: summary,
    });
  } catch (err) {
    console.error('Failed to sync presence to database:', err);
  }
}
