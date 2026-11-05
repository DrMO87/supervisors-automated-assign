'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ToastProvider } from '@/components/ui/toast';
import { ExamPeriodProvider } from '@/lib/hooks/exam-period-context';
import { PresenceProvider } from '@/lib/hooks/use-presence';
import { PresenceTracker } from '@/components/presence/presence-tracker';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ExamPeriodProvider>
          <PresenceProvider>
            {children}
            <PresenceTracker />
          </PresenceProvider>
        </ExamPeriodProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
