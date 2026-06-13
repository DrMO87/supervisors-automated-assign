'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { LogOut, Loader2, FileText, FileSpreadsheet, ArrowRightLeft, BookOpen } from 'lucide-react';
import Image from 'next/image';
import { ExamSessionWithRelations } from '@/types/database.types';
import { generateOralExamsHTML, generateOralExamsExcel } from '@/lib/utils/report-generators';
import { downloadFile } from '@/lib/utils/csv-helpers';
import { InternalOralSwapModal } from '@/components/staff-portal/internal-oral-swap-modal';

export default function HODPortalPage() {
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<ExamSessionWithRelations[]>([]);
  const [generatingSchedule, setGeneratingSchedule] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);

  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        setCurrentUserData(session.user.user_metadata);

        // Fetch all exam sessions with relations
        let allExams: any[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;
        
        while (hasMore) {
          const { data, error } = await supabase
            .from('exam_sessions')
            .select('*, room:rooms(*)')
            .order('exam_date')
            .range(from, from + step - 1);
            
          if (error) throw error;
          
          if (data && data.length > 0) {
            allExams = [...allExams, ...data];
            from += step;
            if (data.length < step) hasMore = false;
          } else {
            hasMore = false;
          }
        }

        setExams(allExams);
      } catch (err: any) {
        console.error('Failed to load initial data:', err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchInitialData();
  }, [supabase, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const getWeekStart = (dateStr: string) => {
    const d = new Date(`${dateStr}T12:00:00Z`);
    const day = d.getUTCDay();
    const offset = day === 6 ? 0 : -(day + 1);
    const start = new Date(d.setUTCDate(d.getUTCDate() + offset));
    return start.toISOString().split('T')[0];
  };

  const availableWeeks = Array.from(new Set(exams.map(e => getWeekStart(e.exam_date)))).sort();

  const handleGenerateOralReport = async (format: 'pdf' | 'excel') => {
    setGeneratingSchedule(format);
    try {
      const targetWeek = selectedWeek;
      let weekLabel = targetWeek === 'all' ? 'All Weeks' : `Week of ${targetWeek}`;

      const weekExams = exams.filter(e => targetWeek === 'all' ? true : getWeekStart(e.exam_date) === targetWeek);

      if (format === 'excel') {
        const blob = generateOralExamsExcel(weekExams, weekLabel);
        downloadFile(blob, `oral_exams_report_${targetWeek}.xlsx`);
      } else {
        const html = generateOralExamsHTML(weekExams, weekLabel);
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
        }
      }
    } catch (err: any) {
      alert('Error generating report: ' + err.message);
    } finally {
      setGeneratingSchedule(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-amber-950 to-slate-900 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-500/20 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Top right logout */}
      <div className="absolute top-6 right-6 flex items-center gap-3 z-30">
        <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-medium text-slate-200 hover:text-white bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg transition-all hover:bg-white/20 hover:scale-105">
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>

      <div className="w-full max-w-4xl relative z-20">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-amber-600 to-orange-600 p-8 flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('/images/pattern.svg')] opacity-10"></div>
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-24 h-12 relative mb-4">
                <Image src="/images/logo-session-master-transparent.png" alt="Logo" fill className="object-contain" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Head of Department Portal</h1>
              <p className="text-amber-100 text-sm">Manage Oral Exams and Internal Swaps</p>
              
              <div className="mt-4 px-4 py-1.5 bg-white/20 rounded-full text-white text-sm font-medium backdrop-blur-md border border-white/20">
                Welcome, {currentUserData?.name || 'HOD'}
              </div>
            </div>
          </div>
        </div>

        {/* Tools Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* Oral Report Card */}
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white/20 flex flex-col relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-100 to-transparent rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
            
            <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-amber-200">
              <BookOpen className="w-7 h-7" />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Oral Exams Report</h2>
            <p className="text-slate-500 mb-8 flex-1">
              Generate a comprehensive schedule for all upcoming Oral Exams. View assigned staff and room allocations.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Select Week</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-amber-500 focus:border-amber-500 block p-3"
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                >
                  <option value="all">All Available Weeks</option>
                  {availableWeeks.map(week => (
                    <option key={week} value={week}>Week starting {week}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => handleGenerateOralReport('pdf')}
                  disabled={!!generatingSchedule}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl text-sm transition-colors flex justify-center items-center gap-2 border border-slate-300"
                >
                  {generatingSchedule === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  Print PDF
                </button>
                <button 
                  onClick={() => handleGenerateOralReport('excel')}
                  disabled={!!generatingSchedule}
                  className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold py-3 px-4 rounded-xl text-sm transition-colors flex justify-center items-center gap-2 border border-amber-200"
                >
                  {generatingSchedule === 'excel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                  Export Excel
                </button>
              </div>
            </div>
          </div>

          {/* Internal Swap Card */}
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white/20 flex flex-col relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-100 to-transparent rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
            
            <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-orange-200">
              <ArrowRightLeft className="w-7 h-7" />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Internal Swap</h2>
            <p className="text-slate-500 mb-8 flex-1">
              Instantly swap assigned supervisors between two different rooms during the same Oral Exam session.
            </p>

            <button
              onClick={() => setIsSwapModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-orange-500/30 transition-all hover:-translate-y-1 hover:shadow-orange-500/50"
            >
              <ArrowRightLeft className="w-5 h-5" />
              Open Swap Tool
            </button>
          </div>

        </div>
      </div>

      <InternalOralSwapModal
        isOpen={isSwapModalOpen}
        onClose={() => setIsSwapModalOpen(false)}
        selectedWeek={selectedWeek}
      />
    </div>
  );
}
