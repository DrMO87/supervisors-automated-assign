import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('exam_periods')
      .select('*')
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Error fetching exam periods:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ periods: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, semester_type, academic_year, start_date, end_date, score_mode, notes, set_active } = body;

    if (!name || !semester_type || !start_date || !end_date) {
      return NextResponse.json({ error: 'Missing required fields: name, semester_type, start_date, end_date' }, { status: 400 });
    }

    const isActive = set_active !== undefined ? Boolean(set_active) : true;

    // Snapshot existing staff scores before changing periods
    const { data: currentStaff } = await supabaseAdmin
      .from('staff')
      .select('id, current_score, free_staff_score');

    const scoreSnapshot = (currentStaff || []).map(s => ({
      staff_id: s.id,
      current_score: s.current_score || 0,
      free_staff_score: s.free_staff_score || 0,
    }));

    if (isActive) {
      // Deactivate all existing periods
      await supabaseAdmin
        .from('exam_periods')
        .update({ is_active: false })
        .neq('id', '00000000-0000-0000-0000-000000000000');
    }

    // Insert new period
    const { data: newPeriod, error: createErr } = await supabaseAdmin
      .from('exam_periods')
      .insert({
        name,
        semester_type,
        academic_year: academic_year || null,
        start_date,
        end_date,
        is_active: isActive,
        score_mode: score_mode || 'fresh',
        score_snapshot: scoreSnapshot,
        notes: notes || null,
      })
      .select('*')
      .single();

    if (createErr) {
      console.error('Error creating exam period:', createErr);
      return NextResponse.json({ error: createErr.message }, { status: 500 });
    }

    // Handle Score Logic
    if (isActive) {
      if (score_mode === 'fresh') {
        // Reset staff scores to 0
        await supabaseAdmin
          .from('staff')
          .update({ current_score: 0, free_staff_score: 0 })
          .neq('id', '00000000-0000-0000-0000-000000000000');
      } else if (score_mode === 'continue') {
        // Recalculate staff scores based on assignments in new date range
        // Or keep current scores
        const { data: assignments } = await supabaseAdmin
          .from('assignments')
          .select('staff_id, exam_session:exam_sessions(exam_date, start_time)');

        const { data: reserves } = await supabaseAdmin
          .from('period_free_staff')
          .select('staff_id, exam_date');

        if (currentStaff) {
          for (const s of currentStaff) {
            const periodAssignments = (assignments || []).filter(a => {
              const date = (a.exam_session as any)?.exam_date;
              return a.staff_id === s.id && date >= start_date && date <= end_date;
            });
            const uniquePeriods = new Set(periodAssignments.map(a => `${(a.exam_session as any).exam_date}_${(a.exam_session as any).start_time}`));

            const periodReserves = (reserves || []).filter(r => r.staff_id === s.id && r.exam_date >= start_date && r.exam_date <= end_date);

            await supabaseAdmin
              .from('staff')
              .update({
                current_score: (s.current_score || 0) + uniquePeriods.size,
                free_staff_score: (s.free_staff_score || 0) + periodReserves.length,
              })
              .eq('id', s.id);
          }
        }
      }
    }

    return NextResponse.json({ success: true, period: newPeriod });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
