import { Navigation } from '@/components/layout/navigation';
export default function ExamsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-100 flex">
      <Navigation />
      <div className="flex-1 ml-64 min-h-screen flex flex-col">
        <main className="flex-1 p-6 lg:p-8 max-w-screen-2xl">{children}</main>
      </div>
    </div>
  );
}
