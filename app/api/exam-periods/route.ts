import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from '@/lib/supabase/client';
import { logActivity } from '@/lib/utils/audit-logger';

export async function GET() {
  try {
    const { data: periods, error } = await supabaseAdmin
      .from('exam_periods')
      .select('*')
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Error fetching exam periods:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch period_rules and scheduling_constraints to enrich periods seamlessly
    const { data: rulesSetting } = await supabaseAdmin
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'period_rules')
      .maybeSingle();

    const periodRulesMap = rulesSetting?.setting_value || {};

    const { data: constraintsSetting } = await supabaseAdmin
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'scheduling_constraints')
      .maybeSingle();

    const globalConstraints = constraintsSetting?.setting_value || {};

    const enrichedPeriods = (periods || []).map((p: any) => {
      const rule = periodRulesMap[p.id];
      const ignoreDays =
        p.ignore_staff_working_days !== undefined
          ? p.ignore_staff_working_days
          : rule?.ignore_staff_working_days !== undefined
          ? rule.ignore_staff_working_days
          : p.is_active && globalConstraints.ignore_staff_working_days !== undefined
          ? globalConstraints.ignore_staff_working_days
          : false;

      const customDays =
        p.custom_days_per_week !== undefined
          ? p.custom_days_per_week
          : rule?.custom_days_per_week !== undefined
          ? rule.custom_days_per_week
          : p.is_active && globalConstraints.custom_days_per_week !== undefined
          ? globalConstraints.custom_days_per_week
          : 3;

      const availabilityPolicy =
        p.availability_policy ||
        rule?.availability_policy ||
        (ignoreDays
          ? 'cap_days_per_week'
          : p.is_active && globalConstraints.availability_policy
          ? globalConstraints.availability_policy
          : 'respect_all_off_days');

      const oralMode =
        p.oral_exam_assignment_mode ||
        rule?.oral_exam_assignment_mode ||
        (p.is_active && globalConstraints.oral_exam_assignment_mode
          ? globalConstraints.oral_exam_assignment_mode
          : 'combined');

      const reserveSupervisors =
        p.reserve_supervisors_target ??
        rule?.reserve_supervisors_target ??
        (p.is_active && globalConstraints.reserve_supervisors_target !== undefined
          ? globalConstraints.reserve_supervisors_target
          : 3);

      const reserveAssistants =
        p.reserve_assistants_target ??
        rule?.reserve_assistants_target ??
        (p.is_active && globalConstraints.reserve_assistants_target !== undefined
          ? globalConstraints.reserve_assistants_target
          : 3);

      return {
        ...p,
        ignore_staff_working_days: ignoreDays,
        custom_days_per_week: customDays,
        availability_policy: availabilityPolicy,
        oral_exam_assignment_mode: oralMode,
        reserve_supervisors_target: reserveSupervisors,
        reserve_assistants_target: reserveAssistants,
      };
    });

    return NextResponse.json(enrichedPeriods);
  } catch (err: any) {
    console.error('Error in GET /api/exam-periods:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      semester_type,
      academic_year,
      start_date,
      end_date,
      score_mode,
      notes,
      set_as_active = true,
      availability_policy,
      oral_exam_assignment_mode = 'combined',
      reserve_supervisors_target = 3,
      reserve_assistants_target = 3,
      ignore_staff_working_days = false,
      custom_days_per_week = 5,
    } = body;

    const resolvedPolicy =
      availability_policy ||
      (ignore_staff_working_days ? 'cap_days_per_week' : 'respect_all_off_days');
    const effectiveIgnoreStaffDays = resolvedPolicy === 'cap_days_per_week';

    if (!name || !semester_type || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'Missing required fields: name, semester_type, start_date, and end_date are mandatory.' },
        { status: 400 }
      );
    }

    // 1. Take a baseline snapshot of current staff scores
    const { data: currentStaff } = await supabaseAdmin
      .from('staff')
      .select('id, name, email, current_score, free_staff_score, department');

    const scoreSnapshot = (currentStaff || []).map(s => ({
      staff_id: s.id,
      name: s.name,
      email: s.email,
      department: s.department,
      baseline_current_score: s.current_score || 0,
      baseline_free_score: s.free_staff_score || 0,
    }));

    // 2. If setting as active, deactivate other periods
    if (set_as_active) {
      await supabaseAdmin
        .from('exam_periods')
        .update({ is_active: false })
        .eq('is_active', true);
    }

    // 3. Insert the new period with schema fallback
    const insertPayload: Record<string, any> = {
      name,
      semester_type,
      academic_year,
      start_date,
      end_date,
      is_active: set_as_active,
      score_mode: score_mode || 'fresh',
      score_snapshot: scoreSnapshot,
      notes,
      ignore_staff_working_days: effectiveIgnoreStaffDays,
      custom_days_per_week: Number(custom_days_per_week) || 5,
    };

    let newPeriod: any = null;
    const { data: firstTryNew, error: firstTryErr } = await supabaseAdmin
      .from('exam_periods')
      .insert(insertPayload)
      .select('*')
      .single();

    if (!firstTryErr && firstTryNew) {
      newPeriod = firstTryNew;
    } else if (
      firstTryErr &&
      (firstTryErr.message.includes('custom_days_per_week') ||
        firstTryErr.message.includes('ignore_staff_working_days') ||
        firstTryErr.message.includes('schema cache'))
    ) {
      // Columns not present in Postgres schema yet; omit them and insert standard columns
      const fallbackPayload = { ...insertPayload };
      delete fallbackPayload.ignore_staff_working_days;
      delete fallbackPayload.custom_days_per_week;

      const { data: retryNew, error: retryErr } = await supabaseAdmin
        .from('exam_periods')
        .insert(fallbackPayload)
        .select('*')
        .single();

      if (retryErr || !retryNew) {
        console.error('Error in fallback insert:', retryErr);
        return NextResponse.json({ error: retryErr?.message || 'Failed to create period' }, { status: 500 });
      }

      newPeriod = {
        ...retryNew,
        ignore_staff_working_days: effectiveIgnoreStaffDays,
        custom_days_per_week: Number(custom_days_per_week) || 5,
      };
    } else {
      console.error('Error creating exam period:', firstTryErr);
      return NextResponse.json({ error: firstTryErr?.message || 'Failed to create period' }, { status: 500 });
    }

    // Persist period rules in system_settings
    const { data: curRulesSetting } = await supabaseAdmin
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'period_rules')
      .maybeSingle();

    const existingRules = curRulesSetting?.setting_value || {};
    await supabaseAdmin.from('system_settings').upsert({
      setting_key: 'period_rules',
      setting_value: {
        ...existingRules,
        [newPeriod.id]: {
          availability_policy: resolvedPolicy,
          oral_exam_assignment_mode,
          reserve_supervisors_target: Number(reserve_supervisors_target) || 3,
          reserve_assistants_target: Number(reserve_assistants_target) || 3,
          ignore_staff_working_days: effectiveIgnoreStaffDays,
          custom_days_per_week: Number(custom_days_per_week) || 5,
        },
      },
      description: 'Working days rules and constraints per exam period',
    }, { onConflict: 'setting_key' });

    // 4. Update system_settings with the active period and scheduling constraints
    if (set_as_active) {
      await supabaseAdmin.from('system_settings').upsert({
        setting_key: 'active_exam_period',
        setting_value: {
          period_id: newPeriod.id,
          period_name: newPeriod.name,
          semester_type: newPeriod.semester_type,
          start_date: newPeriod.start_date,
          end_date: newPeriod.end_date,
          academic_year: newPeriod.academic_year,
          score_mode: newPeriod.score_mode,
          availability_policy: resolvedPolicy,
          oral_exam_assignment_mode,
          reserve_supervisors_target: Number(reserve_supervisors_target) || 3,
          reserve_assistants_target: Number(reserve_assistants_target) || 3,
          ignore_staff_working_days: effectiveIgnoreStaffDays,
          custom_days_per_week: Number(custom_days_per_week) || 5,
        },
        description: 'Current active exam cycle and rules',
      }, { onConflict: 'setting_key' });

      // Sync scheduling constraints with period settings
      const { data: curConstraints } = await supabaseAdmin
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'scheduling_constraints')
        .maybeSingle();

      const updatedConstraints = {
        ...(curConstraints?.setting_value || {}),
        availability_policy: resolvedPolicy,
        oral_exam_assignment_mode,
        reserve_supervisors_target: Number(reserve_supervisors_target) || 3,
        reserve_assistants_target: Number(reserve_assistants_target) || 3,
        ignore_staff_working_days: effectiveIgnoreStaffDays,
        custom_days_per_week: Number(custom_days_per_week) || 5,
      };

      await supabaseAdmin.from('system_settings').upsert({
        setting_key: 'scheduling_constraints',
        setting_value: updatedConstraints,
        description: 'Global scheduling constraints and parameters',
      }, { onConflict: 'setting_key' });

      // 5. Handle scoring based on mode
      if (score_mode === 'fresh') {
        // Reset current scores to 0 for a fresh start
        await supabaseAdmin
          .from('staff')
          .update({ current_score: 0, free_staff_score: 0 })
          .not('id', 'is', null);
      } else if (score_mode === 'continue') {
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

    // Log audit activity
    try {
      const supabaseAuth = createRouteHandlerClient({ cookies });
      const { data: { session } } = await supabaseAuth.auth.getSession();
      const userEmail = session?.user?.email || 'melkhodary@horus.edu.eg';

      await logActivity(supabaseAdmin, {
        action: 'PERIOD_CHANGE',
        tableName: 'exam_periods',
        recordId: newPeriod.id,
        summary: `Created Exam Period "${newPeriod.name}" (${newPeriod.start_date} → ${newPeriod.end_date})`,
        newValues: newPeriod,
        userEmail,
        userRole: 'Super Admin',
      });
    } catch (logErr) {
      console.warn('Failed to log period creation activity:', logErr);
    }

    return NextResponse.json({ success: true, period: newPeriod });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      name,
      semester_type,
      academic_year,
      start_date,
      end_date,
      availability_policy,
      oral_exam_assignment_mode,
      reserve_supervisors_target,
      reserve_assistants_target,
      ignore_staff_working_days,
      custom_days_per_week,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing period ID' }, { status: 400 });
    }

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (name && name.trim()) updateData.name = name.trim();
    if (semester_type) updateData.semester_type = semester_type;
    if (academic_year !== undefined) updateData.academic_year = academic_year.trim();
    if (start_date) updateData.start_date = start_date;
    if (end_date) updateData.end_date = end_date;

    const resolvedPatchPolicy = availability_policy || (typeof ignore_staff_working_days === 'boolean' ? (ignore_staff_working_days ? 'cap_days_per_week' : 'respect_all_off_days') : undefined);

    if (resolvedPatchPolicy) {
      updateData.ignore_staff_working_days = resolvedPatchPolicy === 'cap_days_per_week';
    } else if (typeof ignore_staff_working_days === 'boolean') {
      updateData.ignore_staff_working_days = ignore_staff_working_days;
    }

    if (typeof custom_days_per_week === 'number') {
      updateData.custom_days_per_week = Math.max(1, Math.min(6, Math.floor(custom_days_per_week)));
    }

    // 1. Update details in exam_periods table with schema fallback
    let updatedPeriod: any = null;
    const { data: firstTryPeriod, error: firstTryErr } = await supabaseAdmin
      .from('exam_periods')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (!firstTryErr && firstTryPeriod) {
      updatedPeriod = firstTryPeriod;
    } else if (
      firstTryErr &&
      (firstTryErr.message.includes('custom_days_per_week') ||
        firstTryErr.message.includes('ignore_staff_working_days') ||
        firstTryErr.message.includes('schema cache'))
    ) {
      // Columns not added to Postgres table yet; omit them and update standard columns
      const fallbackData = { ...updateData };
      delete fallbackData.ignore_staff_working_days;
      delete fallbackData.custom_days_per_week;

      const { data: retryPeriod, error: retryErr } = await supabaseAdmin
        .from('exam_periods')
        .update(fallbackData)
        .eq('id', id)
        .select('*')
        .single();

      if (retryErr || !retryPeriod) {
        console.error('Error in fallback update:', retryErr);
        return NextResponse.json({ error: retryErr?.message || 'Failed to update exam period' }, { status: 500 });
      }

      updatedPeriod = {
        ...retryPeriod,
        ignore_staff_working_days: typeof ignore_staff_working_days === 'boolean' ? ignore_staff_working_days : false,
        custom_days_per_week: typeof custom_days_per_week === 'number' ? custom_days_per_week : 5,
      };
    } else {
      console.error('Error updating exam period:', firstTryErr);
      return NextResponse.json({ error: firstTryErr?.message || 'Failed to update exam period' }, { status: 500 });
    }

    // 2. Persist period rules in system_settings
    if (resolvedPatchPolicy || typeof ignore_staff_working_days === 'boolean' || typeof custom_days_per_week === 'number') {
      const { data: curRulesSetting } = await supabaseAdmin
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'period_rules')
        .maybeSingle();

      const existingRules = curRulesSetting?.setting_value || {};
      const updatedRules = {
        ...existingRules,
        [id]: {
          ...(existingRules[id] || {}),
          ...(resolvedPatchPolicy ? { availability_policy: resolvedPatchPolicy } : {}),
          ...(oral_exam_assignment_mode ? { oral_exam_assignment_mode } : {}),
          ...(typeof reserve_supervisors_target === 'number' ? { reserve_supervisors_target } : {}),
          ...(typeof reserve_assistants_target === 'number' ? { reserve_assistants_target } : {}),
          ...(typeof updateData.ignore_staff_working_days === 'boolean' ? { ignore_staff_working_days: updateData.ignore_staff_working_days } : {}),
          ...(typeof custom_days_per_week === 'number' ? { custom_days_per_week: updateData.custom_days_per_week } : {}),
        },
      };

      await supabaseAdmin.from('system_settings').upsert({
        setting_key: 'period_rules',
        setting_value: updatedRules,
        description: 'Working days rules and constraints per exam period',
      }, { onConflict: 'setting_key' });
    }

    // 3. If this period is currently active, sync system_settings
    if (updatedPeriod.is_active) {
      const { data: activeSetting } = await supabaseAdmin
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'active_exam_period')
        .maybeSingle();

      if (activeSetting?.setting_value) {
        await supabaseAdmin.from('system_settings').upsert({
          setting_key: 'active_exam_period',
          setting_value: {
            ...activeSetting.setting_value,
            period_name: updatedPeriod.name,
            semester_type: updatedPeriod.semester_type,
            start_date: updatedPeriod.start_date,
            end_date: updatedPeriod.end_date,
            academic_year: updatedPeriod.academic_year,
            availability_policy: resolvedPatchPolicy || updatedPeriod.availability_policy || 'respect_all_off_days',
            oral_exam_assignment_mode: oral_exam_assignment_mode || activeSetting.setting_value.oral_exam_assignment_mode || 'combined',
            reserve_supervisors_target: typeof reserve_supervisors_target === 'number' ? reserve_supervisors_target : activeSetting.setting_value.reserve_supervisors_target ?? 3,
            reserve_assistants_target: typeof reserve_assistants_target === 'number' ? reserve_assistants_target : activeSetting.setting_value.reserve_assistants_target ?? 3,
            ignore_staff_working_days: updatedPeriod.ignore_staff_working_days,
            custom_days_per_week: updatedPeriod.custom_days_per_week,
          },
          description: 'Active exam cycle and rules',
        }, { onConflict: 'setting_key' });
      }

      // Sync scheduling constraints
      if (resolvedPatchPolicy || typeof ignore_staff_working_days === 'boolean' || typeof custom_days_per_week === 'number' || oral_exam_assignment_mode || typeof reserve_supervisors_target === 'number') {
        const { data: curConstraints } = await supabaseAdmin
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'scheduling_constraints')
          .maybeSingle();

        const updatedConstraints = {
          ...(curConstraints?.setting_value || {}),
          ...(resolvedPatchPolicy ? { availability_policy: resolvedPatchPolicy } : {}),
          ...(oral_exam_assignment_mode ? { oral_exam_assignment_mode } : {}),
          ...(typeof reserve_supervisors_target === 'number' ? { reserve_supervisors_target } : {}),
          ...(typeof reserve_assistants_target === 'number' ? { reserve_assistants_target } : {}),
          ...(typeof updateData.ignore_staff_working_days === 'boolean' ? { ignore_staff_working_days: updateData.ignore_staff_working_days } : {}),
          ...(typeof custom_days_per_week === 'number' ? { custom_days_per_week: updateData.custom_days_per_week } : {}),
        };

        await supabaseAdmin.from('system_settings').upsert({
          setting_key: 'scheduling_constraints',
          setting_value: updatedConstraints,
          description: 'Global scheduling constraints and parameters',
        }, { onConflict: 'setting_key' });
      }
    }

    // 4. Log audit activity
    try {
      const supabaseAuth = createRouteHandlerClient({ cookies });
      const { data: { session } } = await supabaseAuth.auth.getSession();
      const userEmail = session?.user?.email || 'melkhodary@horus.edu.eg';

      await logActivity(supabaseAdmin, {
        action: 'PERIOD_CHANGE',
        tableName: 'exam_periods',
        recordId: id,
        summary: `Updated Exam Period details for "${updatedPeriod.name}"`,
        newValues: updatedPeriod,
        userEmail,
        userRole: 'Super Admin',
      });
    } catch (logErr) {
      console.warn('Failed to log period update activity:', logErr);
    }

    return NextResponse.json({ success: true, period: updatedPeriod });
  } catch (err: any) {
    console.error('Error in PATCH /api/exam-periods:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
