import { Navigation } from '@/components/layout/navigation';
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-100 flex">
      <Navigation />
      <div className="flex-1 md:ml-64 min-h-screen flex flex-col pt-14 md:pt-0">
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-screen-2xl w-full">{children}</main>
      </div>
    </div>
  );
}
