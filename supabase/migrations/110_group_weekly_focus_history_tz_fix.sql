-- ### 110_group_weekly_focus_history_tz_fix.sql
-- ============================================================
-- 109_group_weekly_focus_history.sql, "bu hafta"nın başlangıcını
-- date_trunc('week', now()) ile hesaplıyordu — now() bir timestamptz,
-- date_trunc bunu SESSION timezone'unda (genelde UTC) kesiyor. Türkiye
-- UTC+3 olduğundan, Pazar 00:00-03:00 (yerel saat) arası çalışan bir
-- öğrenci UTC hafta sınırına göre hâlâ "geçen hafta"ya yazılabiliyordu —
-- z-skor'un temel aldığı haftalık kovalardan biri birkaç saatlik kayma
-- yaşayabiliyordu. group_monthly_report (054/077) zaten aynı sorunu
-- "now() at time zone 'Europe/Istanbul'" ile çözmüştü; aynı düzeltme
-- burada da uygulanıyor. ds.stat_date zaten `date` tipi (timezone'suz,
-- yazıldığı andaki yerel takvim günü) olduğundan ONA dokunmuyoruz —
-- sadece "şu an hangi haftadayız" sorusunun cevabı düzeltiliyor.
-- ============================================================

create or replace function public.group_weekly_focus_history(p_group_id uuid, p_weeks_back integer default 8)
returns table (student_id uuid, week_start date, weekly_minutes integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start date;
begin
  if not exists (
    select 1 from public.group_members caller
    where caller.group_id = p_group_id
      and caller.user_id = auth.uid()
      and caller.role = 'admin'
  ) then
    return;
  end if;

  v_week_start := date_trunc('week', now() at time zone 'Europe/Istanbul')::date;

  return query
    select
      gm.user_id as student_id,
      date_trunc('week', ds.stat_date)::date as week_start,
      sum(ds.focus_minutes)::integer as weekly_minutes
    from public.group_members gm
    join public.profiles p on p.id = gm.user_id
    join public.daily_stats ds on ds.user_id = gm.user_id
    where gm.group_id = p_group_id
      and not p.stats_hidden_from_institution
      and ds.stat_date >= (v_week_start - (p_weeks_back * 7))
      and ds.stat_date < v_week_start + 7
    group by gm.user_id, date_trunc('week', ds.stat_date);
end;
$$;

grant execute on function public.group_weekly_focus_history(uuid, integer) to authenticated;
