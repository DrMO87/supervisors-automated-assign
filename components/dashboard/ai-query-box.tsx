'use client';

import { useState } from 'react';
import { useSchedulingStore } from '@/lib/stores/scheduling-store';
import { getPeriodFromTime } from '@/types/database.types';
import { Bot, Loader2, Send, ExternalLink, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

export function AiQueryBox({ weekStart }: { weekStart?: Date }) {
  const { examSessions, staff, getSessionConflicts } = useSchedulingStore();
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setResponse('');

    try {
      const staffMap = new Map(staff.map((s) => [s.id, { name: s.name, job: s.job_title }]));

      const sessionsData = examSessions.map((s) => {
        const roomStr = s.room ? `${s.room.room_name} (Bld: ${s.room.building})` : 'Unassigned Room';
        
        return {
          exam: s.subject_name,
          date: s.exam_date,
          period: `Period ${getPeriodFromTime(s.start_time)}`,
          room: roomStr,
          students: s.student_count,
          conflicts: getSessionConflicts(s.id).map(c => c.message),
          assignments: (s.assignments || []).map(a => {
            const staffObj = staffMap.get(a.staff_id);
            return {
              role: a.role,
              name: staffObj?.name || 'Unknown',
              job: staffObj?.job || 'N/A'
            };
          }),
        };
      });

      let reservesData: any[] = [];
      if (weekStart && supabase) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const startStr = weekStart.toISOString().split('T')[0];
        const endStr = weekEnd.toISOString().split('T')[0];

        const { data: freeStaff } = await supabase
          .from('period_free_staff')
          .select('*, staff:staff(*)')
          .gte('exam_date', startStr)
          .lte('exam_date', endStr);
        
        if (freeStaff) {
          reservesData = freeStaff.map(fs => ({
            date: fs.exam_date,
            period: `Period ${fs.period}`,
            role: fs.role === 'Exam_Supervisor' ? 'Exam Supervisor Reserve' : 'Invigilator Reserve',
            name: fs.staff?.name || 'Unknown',
            job: fs.staff?.job_title || 'N/A'
          }));
        }
      }

      const staffSummary = staff
        .filter(s => s.availability_status === 'Available')
        .map(s => ({
          name: s.name,
          role: s.supervision_role,
          type: s.employment_status,
          exam_score: (s.current_score || 0) + ((s.free_staff_score || 0) * 0.25),
          reserve_score: s.free_staff_score || 0
        }));

      const contextPayload = {
        total_sessions_in_week: examSessions.length,
        sessions_details: sessionsData,
        reserves_details: reservesData,
        staff_summary: staffSummary,
      };

      const fullPrompt = `You are an expert AI scheduling assistant for an Exam Supervision Management System.

App Functions & Rules Summary:
1. The app schedules exam sessions and assigns staff to supervision roles based on required ratios and student counts.
2. Roles include: "Exam Supervisor" (typically Lecturers), "Head/Committees Supervisor", and "Assistant" (Invigilators).
3. "Reserves" (Period Free Staff) are staff assigned to be on standby for a specific period in case of absences.
4. Staff have constraints like "Working Days", "Specific Off Dates", "Feeding Mother", or "Health Issues" which dictate their availability. Their "type" (Full-Time vs Part-Time) also affects their maximum weekly hours.
5. The system tracks TWO scores to ensure fair workload distribution:
   - "exam_score": Number of times assigned to actual exams. Lower score = priority for new exam assignments.
   - "reserve_score": Number of times assigned as a reserve/standby. Lower score = priority for new reserve assignments.
6. The app detects conflicts such as understaffing, staff double-booked, and working on off-days.
7. When suggesting names for manual assignments or reserves, use the "staff_summary" list to find Available staff with the correct role and the lowest relevant score.

Here is the JSON context of the currently visible schedule week, including scheduled exams, assigned staff, detected conflicts, and reserved staff:
${JSON.stringify(contextPayload)}

My question is:
${query}
`;

      await navigator.clipboard.writeText(fullPrompt);
      setResponse("SUCCESS");
      window.open('https://gemini.google.com/app', '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      console.error(err);
      setResponse("Error generating prompt: " + err.message + "\nMake sure your browser allows clipboard access.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white border border-primary-200 rounded-lg p-4 shadow-sm mb-6 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-primary-700 font-semibold">
        <Bot className="w-5 h-5" />
        <h3>Ask Gemini about the Schedule</h3>
      </div>
      
      <form onSubmit={handleAsk} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Who has the highest number of Invigilator assignments?"
          className="flex-1 input border-gray-300 focus:border-primary-500 focus:ring-primary-500"
          disabled={isLoading}
        />
        <button 
          type="submit" 
          disabled={!query.trim() || isLoading}
          className="btn btn-primary px-4 flex items-center gap-2"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
          Ask Gemini
        </button>
        {(response === 'SUCCESS' || query) && (
          <button 
            type="button" 
            onClick={() => { setQuery(''); setResponse(''); }}
            className="btn btn-secondary px-4 flex items-center gap-2"
            title="Clear"
          >
            Clear
          </button>
        )}
      </form>

      {response === 'SUCCESS' && (
        <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4" />
          Prompt and context copied to clipboard! Gemini is opening in a new tab — simply paste (Ctrl+V) into the chat.
        </div>
      )}
      
      {response && response !== 'SUCCESS' && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800 break-words whitespace-pre-wrap">
          {response}
        </div>
      )}
    </div>
  );
}
