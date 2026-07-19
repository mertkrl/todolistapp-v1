-- ### 106_classroom_admin_helper_extend.sql
-- ============================================================
-- 105'te eklenen public.is_group_admin() helper'ını, aynı literal
-- `role = 'admin'` kalıbını taşıyan diğer sınıf-paneli tablo/fonksiyonlarına
-- da uygular: lesson_plan_assignments (089), lesson_plan_student_busy_slots
-- (091), group_student_weekly_load (092), group_class_schedule (095),
-- group_member_daily_stats (096), group_schedule_programs (104).
--
-- Bu tablolarda da aynı sessiz-hata sınıfı var: kurum admini tarafından
-- bir sınıfa sonradan "Öğretmen" özel rolüyle eklenen (kurucu/owner
-- olmayan) bir öğretmen, ders planı atama, ders programı taslağı
-- oluşturma/yayınlama, öğrenci yük/istatistik RPC'lerini çağırma gibi
-- işlemlerde literal 'admin' kontrolüne takılıp sessizce başarısız
-- oluyordu — hatta program/ders satırının kendi oluşturduğu (created_by
-- = auth.uid()) durumlarda bile.
-- ============================================================

-- ---- lesson_plan_assignments -----------------------------------------------

drop policy if exists "lpa_insert" on public.lesson_plan_assignments;
create policy "lpa_insert" on public.lesson_plan_assignments for insert with check (
  teacher_id = auth.uid()
  and public.is_group_admin(group_id, auth.uid())
);

-- ---- lesson_plan_student_busy_slots (function) -----------------------------

create or replace function public.lesson_plan_student_busy_slots(p_student_id uuid, p_group_id uuid)
returns table (task_date date, time_start time, time_end time, is_overnight boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_group_admin(p_group_id, auth.uid())
     or not exists (
       select 1 from public.group_members target
       where target.group_id = p_group_id and target.user_id = p_student_id
     )
  then
    return;
  end if;

  return query
    select t.task_date, t.time_start, t.time_end, t.is_overnight
    from public.tasks t
    where t.user_id = p_student_id
      and t.task_date is not null
      and t.time_start is not null
      and t.time_end is not null;
end;
$$;

-- ---- group_student_weekly_load (function) ----------------------------------

create or replace function public.group_student_weekly_load(p_group_id uuid, p_weeks_back integer default 3)
returns table (student_id uuid, week_start date, total_minutes integer, overloaded_days integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_group_admin(p_group_id, auth.uid()) then
    return;
  end if;

  return query
    with student_tasks as (
      select
        t.user_id,
        t.task_date,
        case
          when t.is_overnight or t.time_end < t.time_start
            then extract(epoch from (t.time_end - t.time_start + interval '24 hours')) / 60
          else extract(epoch from (t.time_end - t.time_start)) / 60
        end as duration_min
      from public.tasks t
      join public.group_members gm
        on gm.user_id = t.user_id and gm.group_id = p_group_id
      where t.task_date >= (current_date - (p_weeks_back * 7))
        and t.time_start is not null
        and t.time_end is not null
    ),
    daily as (
      select user_id, task_date, sum(greatest(duration_min, 0)) as day_minutes
      from student_tasks
      group by user_id, task_date
    )
    select
      user_id,
      date_trunc('week', task_date)::date as week_start,
      sum(day_minutes)::integer as total_minutes,
      count(*) filter (where day_minutes >= 480)::integer as overloaded_days
    from daily
    group by user_id, date_trunc('week', task_date)::date;
end;
$$;

-- ---- group_member_daily_stats (function) ------------------------------------

create or replace function public.group_member_daily_stats(p_group_id uuid, p_user_id uuid, p_since date)
returns table (stat_date date, focus_minutes integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_is_self boolean;
  v_hidden boolean;
begin
  v_is_self := (p_user_id = auth.uid());
  v_is_admin := public.is_group_admin(p_group_id, auth.uid());

  if not v_is_self and not v_is_admin then
    return;
  end if;

  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = p_user_id
  ) then
    return;
  end if;

  select coalesce(p.stats_hidden_from_institution, false) into v_hidden
  from public.profiles p where p.id = p_user_id;

  if v_hidden and not v_is_self then
    return;
  end if;

  return query
    select ds.stat_date, ds.focus_minutes
    from public.daily_stats ds
    where ds.user_id = p_user_id and ds.stat_date >= p_since;
end;
$$;

-- ---- group_class_schedule ---------------------------------------------------

drop policy if exists "gcs_insert" on public.group_class_schedule;
create policy "gcs_insert" on public.group_class_schedule for insert with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.group_schedule_programs p
    where p.id = group_class_schedule.program_id
      and p.created_by = auth.uid()
      and public.is_group_admin(p.group_id, auth.uid())
  )
);

drop policy if exists "gcs_delete" on public.group_class_schedule;
create policy "gcs_delete" on public.group_class_schedule for delete using (
  exists (
    select 1 from public.group_schedule_programs p
    where p.id = group_class_schedule.program_id
      and p.created_by = auth.uid()
      and public.is_group_admin(p.group_id, auth.uid())
  )
);

-- ---- group_schedule_programs -------------------------------------------------

drop policy if exists "gsp_insert" on public.group_schedule_programs;
create policy "gsp_insert" on public.group_schedule_programs for insert with check (
  created_by = auth.uid()
  and public.is_group_admin(group_id, auth.uid())
);

drop policy if exists "gsp_update" on public.group_schedule_programs;
create policy "gsp_update" on public.group_schedule_programs for update using (
  created_by = auth.uid()
  and public.is_group_admin(group_id, auth.uid())
) with check (
  created_by = auth.uid()
);

drop policy if exists "gsp_delete" on public.group_schedule_programs;
create policy "gsp_delete" on public.group_schedule_programs for delete using (
  created_by = auth.uid()
  and public.is_group_admin(group_id, auth.uid())
);
