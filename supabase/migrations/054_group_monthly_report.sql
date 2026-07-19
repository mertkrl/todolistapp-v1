-- ### 054_group_monthly_report.sql
-- FocusAI Kurumsal Panel: aylık performans raporu
-- Öğretmen/yönetici için üye başına BU AYIN toplam odak dakikası + aktif gün
-- sayısı. 035/037 ile aynı güvenlik modeli: daily_stats kişiye özel RLS'li
-- olduğundan SECURITY DEFINER + grup üyeliği doğrulaması; sadece agrega döner.

create or replace function public.group_monthly_report(p_group_id uuid)
returns table (user_id uuid, total_minutes integer, active_days integer)
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
    select ds.user_id,
           coalesce(sum(ds.focus_minutes), 0)::integer as total_minutes,
           count(distinct ds.stat_date) filter (where ds.focus_minutes > 0)::integer as active_days
    from public.daily_stats ds
    where ds.stat_date >= v_month_start
      and ds.user_id in (
        select gm.user_id from public.group_members gm where gm.group_id = p_group_id
      )
    group by ds.user_id;
end;
$$;

grant execute on function public.group_monthly_report(uuid) to authenticated;
