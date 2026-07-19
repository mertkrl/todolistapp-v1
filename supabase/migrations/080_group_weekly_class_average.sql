-- ### 080_group_weekly_class_average.sql
-- ============================================================
-- Sınıf Paneli geliştirmesi: öğrencinin kendi haftalık odağını
-- sınıf ortalamasıyla karşılaştırabilmesi için salt agrega (kişi
-- bazlı veri sızdırmayan) bir RPC. group_weekly_member_stats (037)
-- ile aynı güvenlik modeli.
-- ============================================================

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

  v_week_start := date_trunc('week', now())::date;

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
