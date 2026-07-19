-- ### 037_group_weekly_member_stats.sql
-- FocusAI -> Supabase Migration 037: Çoklu metrik rozetler için grup üyesi haftalık
-- detay istatistikleri (aktif gün sayısı + önceki haftaya göre değişim).
-- group_weekly_leaderboard (035) ile aynı güvenlik modeli: SECURITY DEFINER + grup
-- üyeliği doğrulaması, daily_stats kişiye özel RLS'li olduğu için gerekli.

create or replace function public.group_weekly_member_stats(p_group_id uuid)
returns table (user_id uuid, weekly_minutes integer, active_days integer, prev_week_minutes integer)
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
      coalesce(sum(ds.focus_minutes) filter (where ds.stat_date >= v_week_start), 0)::integer as weekly_minutes,
      count(distinct ds.stat_date) filter (where ds.stat_date >= v_week_start and ds.focus_minutes > 0)::integer as active_days,
      coalesce(sum(ds.focus_minutes) filter (where ds.stat_date >= v_prev_week_start and ds.stat_date < v_week_start), 0)::integer as prev_week_minutes
    from public.group_members gm
    left join public.daily_stats ds on ds.user_id = gm.user_id and ds.stat_date >= v_prev_week_start
    where gm.group_id = p_group_id
    group by gm.user_id;
end;
$$;

grant execute on function public.group_weekly_member_stats(uuid) to authenticated;
