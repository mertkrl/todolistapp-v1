-- ### 111_weekly_stats_tz_fix.sql
-- ============================================================
-- 110_group_weekly_focus_history_tz_fix.sql, "bu hafta" başlangıcını
-- date_trunc('week', now()) yerine date_trunc('week', now() at time zone
-- 'Europe/Istanbul') ile hesaplayacak şekilde düzeltmişti (group_monthly_report
-- - 054/077 - ile aynı desen). O sırada aynı UTC sorununu taşıyan diğer
-- "haftalık" RPC'ler bilinçli olarak kapsam dışı bırakılmıştı:
--   - group_weekly_member_stats (037/077) — Performans tablosundaki
--     "Odak (bu hafta)" kolonunun ve prev_week_minutes'in kaynağı
--   - group_weekly_class_average (080) — öğrencinin "Sınıf Ortalaması" KPI'ı
--   - group_weekly_class_average_batch (107) — kardeş sınıf kartları
-- Sonuç: 109/110 (z-skor temel verisi) artık TR saatine göre hafta
-- sınırı kullanırken, tablodaki "bu hafta" dakikası ve sınıf ortalaması
-- hâlâ UTC hafta sınırı kullanıyordu — aynı ekranda İKİ FARKLI "bu hafta"
-- tanımı bir arada duruyordu (bkz. performans analizi, 2026-07-11).
-- Bu migration üçünü de aynı deseni (Europe/Istanbul) getirip tek bir
-- "hafta" tanımında birleştiriyor. Sadece v_week_start hesabı değişiyor,
-- fonksiyonların geri kalanı (gizlilik mantığı, dönüş tipi, güvenlik
-- kontrolleri) birebir aynı — davranışsal risk yok.
-- ============================================================

-- group_weekly_member_stats (037/077)
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
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
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

-- group_weekly_class_average (080)
create or replace function public.group_weekly_class_average(p_group_id uuid)
returns table (avg_minutes numeric, member_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start date;
begin
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
  ) then
    return;
  end if;

  v_week_start := date_trunc('week', now() at time zone 'Europe/Istanbul')::date;

  return query
    select
      coalesce(avg(m.weekly_minutes), 0)::numeric as avg_minutes,
      count(*)::integer as member_count
    from (
      select gm.user_id,
        coalesce(sum(ds.focus_minutes) filter (where ds.stat_date >= v_week_start), 0) as weekly_minutes
      from public.group_members gm
      left join public.daily_stats ds on ds.user_id = gm.user_id and ds.stat_date >= v_week_start
      where gm.group_id = p_group_id
      group by gm.user_id
    ) m;
end;
$$;

grant execute on function public.group_weekly_class_average(uuid) to authenticated;

-- group_weekly_class_average_batch (107)
create or replace function public.group_weekly_class_average_batch(p_group_ids uuid[])
returns table (group_id uuid, avg_minutes numeric, member_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start date;
begin
  v_week_start := date_trunc('week', now() at time zone 'Europe/Istanbul')::date;

  return query
    select
      gm.group_id,
      coalesce(avg(m.weekly_minutes), 0)::numeric as avg_minutes,
      count(*)::integer as member_count
    from public.group_members gm
    join lateral (
      select coalesce(sum(ds.focus_minutes) filter (where ds.stat_date >= v_week_start), 0) as weekly_minutes
      from public.daily_stats ds
      where ds.user_id = gm.user_id and ds.stat_date >= v_week_start
    ) m on true
    where gm.group_id = any(p_group_ids)
      and exists (
        select 1 from public.group_members self
        where self.group_id = gm.group_id and self.user_id = auth.uid()
      )
    group by gm.group_id;
end;
$$;

grant execute on function public.group_weekly_class_average_batch(uuid[]) to authenticated;
