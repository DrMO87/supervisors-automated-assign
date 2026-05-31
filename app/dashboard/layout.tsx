import { Navigation } from '@/components/layout/navigation';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-100 flex">
      {/* Fixed dark sidebar */}
      <Navigation />

      {/* Main scrollable area, offset by sidebar on desktop */}
      <div className="flex-1 md:ml-64 min-h-screen flex flex-col w-full overflow-x-hidden pt-14 md:pt-0">
        <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-screen-2xl w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
