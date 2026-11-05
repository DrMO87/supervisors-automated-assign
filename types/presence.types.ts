export interface ActiveUserSession {
  sessionId: string;
  userId?: string | null;
  email?: string | null;
  name?: string | null;
  role: string;
  ipAddress: string;
  currentPage: string;
  device: 'Desktop' | 'Mobile' | 'Tablet';
  os: string;
  browser: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface PresenceSummary {
  onlineCount: number;
  uniqueAddressesCount: number;
  uniqueUsersCount: number;
  sessions: ActiveUserSession[];
  lastUpdated: string;
}
