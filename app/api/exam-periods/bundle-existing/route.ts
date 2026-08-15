import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { logActivity } from '@/lib/utils/audit-logger';


export async function GET() {
  try {
    // 1. Fetch earliest and latest exam date from existing exam_sessions
    const { data: exams, error } = await supabaseAdmin
      .from('exam_sessions')
      .select('exam_date')
      .order('exam_date', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!exams || exams.length === 0) {
      return NextResponse.json({
        hasExistingExams: false,
        count: 0,
        minDate: null,
        maxDate: null,
      });
    }

    const dates = exams.map(e => e.exam_date).filter(Boolean);
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];

    // 2. Check if a period already covers these dates
    const { data: existingPeriods } = await supabaseAdmin
      .from('exam_periods')
      .select('*');

    return NextResponse.json({
      hasExistingExams: true,
      count: exams.length,
      minDate,
      maxDate,
      periodsCount: existingPeriods?.length || 0,
      existingPeriods: existingPeriods || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      historical_name,
      historical_start_date,
      historical_end_date,
      summer_name,
      summer_start_date,
      summer_end_date,
      summer_score_mode,
      academic_year,
      notes,
    } = body;

    if (!historical_name || !summer_name || !summer_start_date || !summer_end_date) {
      return NextResponse.json(
        { error: 'Missing required fields for historical and summer periods' },
        { status: 400 }
      );
    }

    // 1. Fetch min and max dates if not explicitly provided
    let hStart = historical_start_date;
    let hEnd = historical_end_date;

    if (!hStart || !hEnd) {
      const { data: exams } = await supabaseAdmin
        .from('exam_sessions')
        .select('exam_date')
        .order('exam_date', { ascending: true });

      if (exams && exams.length > 0) {
        const dates = exams.map(e => e.exam_date).filter(Boolean);
        hStart = dates[0];
        hEnd = dates[dates.length - 1];
      } else {
        hStart = new Date().toISOString().split('T')[0];
        hEnd = hStart;
      }
    }

    // 2. Snapshot current staff scores for historical period
    const { data: currentStaff } = await supabaseAdmin
      .from('staff')
      .select('id, current_score, free_staff_score');

    const scoreSnapshot = (currentStaff || []).map(s => ({
      staff_id: s.id,
      current_score: s.current_score || 0,
      free_staff_score: s.free_staff_score || 0,
    }));

    // 3. Create Historical Period (inactive)
    const { data: historicalPeriod, error: hErr } = await supabaseAdmin
      .from('exam_periods')
      .insert({
        name: historical_name.trim(),
        semester_type: 'Final',
        academic_year: academic_year || '2025-2026',
        start_date: hStart,
        end_date: hEnd,
        is_active: false,
        score_mode: 'continue',
        score_snapshot: scoreSnapshot,
        notes: 'Automatically bundled existing database exams',
      })
      .select('*')
      .single();

    if (hErr) {
      console.error('Error creating historical period:', hErr);
      return NextResponse.json({ error: hErr.message }, { status: 500 });
    }

    await logActivity(supabaseAdmin, {
      action: 'PERIOD_CHANGE',
      tableName: 'exam_periods',
      recordId: historicalPeriod.id,
      summary: `Bundled existing database exams into Historical Period "${historical_name}" (${hStart} → ${hEnd})`,
      newValues: historicalPeriod,
    });

    // 4. Deactivate all periods
    await supabaseAdmin
      .from('exam_periods')
      .update({ is_active: false })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    // 5. Create & Activate Summer Period
    const { data: summerPeriod, error: sErr } = await supabaseAdmin
      .from('exam_periods')
      .insert({
        name: summer_name.trim(),
        semester_type: 'Summer',
        academic_year: academic_year || '2025-2026',
        start_date: summer_start_date,
        end_date: summer_end_date,
        is_active: true,
        score_mode: summer_score_mode || 'fresh',
        score_snapshot: scoreSnapshot,
        notes: notes || 'New Summer Exam Period',
      })
      .select('*')
      .single();

    if (sErr) {
      console.error('Error creating summer period:', sErr);
      return NextResponse.json({ error: sErr.message }, { status: 500 });
    }

    await logActivity(supabaseAdmin, {
      action: 'PERIOD_CHANGE',
      tableName: 'exam_periods',
      recordId: summerPeriod.id,
      summary: `Created & Activated new Summer Exam Period "${summer_name}" (${summer_start_date} → ${summer_end_date})`,
      newValues: summerPeriod,
    });


    // 6. Handle Staff Scoring for Summer Period
    if (summer_score_mode === 'fresh') {
      await supabaseAdmin
        .from('staff')
        .update({ current_score: 0, free_staff_score: 0 })
        .neq('id', '00000000-0000-0000-0000-000000000000');
    }

    return NextResponse.json({
      success: true,
      historicalPeriod,
      summerPeriod,
      message: `Successfully bundled existing database exams into "${historical_name}" and activated "${summer_name}"!`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
