-- ### 114_fix_ambiguous_user_id_regression.sql
-- ============================================================
-- 111_weekly_stats_tz_fix.sql, group_weekly_member_stats fonksiyonunu TR saat
-- dilimi düzeltmesi için "create or replace" ile yeniden yazarken, 108'de
-- düzeltilmiş olan üyelik kontrolündeki `user_id` niteleme (table-alias
-- qualification) düzeltmesini kaybetti — fonksiyon gövdesini 108-öncesi
-- unqualified haliyle geri getirdi:
--   where group_id = p_group_id and user_id = auth.uid()
-- Bu, `returns table (user_id uuid, ...)` OUT parametresiyle çakışarak yine
-- "column reference user_id is ambiguous" hatasına ve Sınıf Paneli'nin hiç
-- açılmamasına yol açtı (bkz. konsol hatası, 2026-07-11).
-- Düzeltme: 111'in TZ mantığını (Europe/Istanbul hafta sınırı) korurken,
-- üyelik kontrolündeki her iki sütunu da 108'deki gibi `gm.` takma adıyla
-- nitelendirmek.
-- ============================================================

create or replace function public.group_weekly_member_stats(p_group_id uuid)
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
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = auth.uid()
  ) then
    return;
  end if;

  v_week_start := date_trunc('week', now() at time zone 'Europe/Istanbul')::date;
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
