-- ### 092_group_student_weekly_load.sql
-- ============================================================
-- Öğretmenin sınıfındaki öğrencilerin GERÇEK haftalık ders yükünü
-- (tüm kaynaklardan — okul, dershane, kişisel planlar; hepsi aynı
-- `tasks` tablosunda) haftalık kovalar halinde görmesi için salt-agrega
-- RPC. "Ceza değil farkındalık" çerçevesi: sadece toplam dakika ve
-- kapasite-üstü (8s+) gün sayısı döner — içerik/başlık YOK.
-- Sadece p_group_id'de admin (öğretmen) rolündeki çağıran kullanabilir.
-- ============================================================

create or replace function public.group_student_weekly_load(p_group_id uuid, p_weeks_back integer default 3)
returns table (student_id uuid, week_start date, total_minutes integer, overloaded_days integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.group_members caller
    where caller.group_id = p_group_id
      and caller.user_id = auth.uid()
      and caller.role = 'admin'
  ) then
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

grant execute on function public.group_student_weekly_load(uuid, integer) to authenticated;
