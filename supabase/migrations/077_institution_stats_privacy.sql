-- ### 077_institution_stats_privacy.sql
-- ============================================================
-- Öğrenci, kurumsal (classroom) sınıf panelindeki performans
-- tablosundan kendi istatistiklerini öğretmenden gizleyebilir.
-- ============================================================

alter table public.profiles
  add column if not exists stats_hidden_from_institution boolean not null default false;

-- group_weekly_member_stats (037): gizleyen üyenin satırı görünür kalır ama
-- sayısal alanlar null döner + is_hidden = true; kendi verisine her zaman erişebilir.
-- Dönüş tipi (kolon seti) değiştiği için önce eski fonksiyon silinmeli.
drop function if exists public.group_weekly_member_stats(uuid);
create function public.group_weekly_member_stats(p_group_id uuid)
returns table (user_id uuid, weekly_minutes integer, active_days integer, prev_week_minutes integer, is_hidden boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start date;
  v_prev_week_start date;
begin
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
  ) then
    return;
  end if;

  v_week_start := date_trunc('week', now())::date;
  v_prev_week_start := v_week_start - interval '7 days';

  return query
    select
      gm.user_id,
      case when p.stats_hidden_from_institution and gm.user_id <> auth.uid() then null
        else coalesce(sum(ds.focus_minutes) filter (where ds.stat_date >= v_week_start), 0)::integer end as weekly_minutes,
      case when p.stats_hidden_from_institution and gm.user_id <> auth.uid() then null
        else count(distinct ds.stat_date) filter (where ds.stat_date >= v_week_start and ds.focus_minutes > 0)::integer end as active_days,
      case when p.stats_hidden_from_institution and gm.user_id <> auth.uid() then null
        else coalesce(sum(ds.focus_minutes) filter (where ds.stat_date >= v_prev_week_start and ds.stat_date < v_week_start), 0)::integer end as prev_week_minutes,
      (p.stats_hidden_from_institution and gm.user_id <> auth.uid()) as is_hidden
    from public.group_members gm
    join public.profiles p on p.id = gm.user_id
    left join public.daily_stats ds on ds.user_id = gm.user_id and ds.stat_date >= v_prev_week_start
    where gm.group_id = p_group_id
    group by gm.user_id, p.stats_hidden_from_institution;
end;
$$;

grant execute on function public.group_weekly_member_stats(uuid) to authenticated;

-- group_monthly_report (054): aynı gizlilik kuralı
drop function if exists public.group_monthly_report(uuid);
create function public.group_monthly_report(p_group_id uuid)
returns table (user_id uuid, total_minutes integer, active_days integer, is_hidden boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_start date;
begin
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
  ) then
    return;
  end if;

  v_month_start := date_trunc('month', (now() at time zone 'Europe/Istanbul'))::date;

  return query
    select
      gm.user_id,
      case when p.stats_hidden_from_institution and gm.user_id <> auth.uid() then null
        else coalesce(sum(ds.focus_minutes), 0)::integer end as total_minutes,
      case when p.stats_hidden_from_institution and gm.user_id <> auth.uid() then null
        else count(distinct ds.stat_date) filter (where ds.focus_minutes > 0)::integer end as active_days,
      (p.stats_hidden_from_institution and gm.user_id <> auth.uid()) as is_hidden
    from public.group_members gm
    join public.profiles p on p.id = gm.user_id
    left join public.daily_stats ds on ds.user_id = gm.user_id and ds.stat_date >= v_month_start
    where gm.group_id = p_group_id
    group by gm.user_id, p.stats_hidden_from_institution;
end;
$$;

grant execute on function public.group_monthly_report(uuid) to authenticated;
