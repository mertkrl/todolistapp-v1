-- ### 107_group_weekly_class_average_batch.sql
-- ============================================================
-- Sınıf Paneli performans iyileştirmesi: kurumdaki kardeş sınıf
-- kartlarının haftalık ortalama odak dakikası, group_weekly_class_average
-- (080) ile sınıf başına AYRI bir RPC çağrısıyla (N+1) hesaplanıyordu.
-- Bu fonksiyon aynı sonucu TEK çağrıda, sınıf id dizisi alarak döner.
-- Güvenlik modeli aynı: her sınıf için ayrı ayrı auth.uid() üyelik
-- kontrolü yapılır (bir sınıfa üye olmayan kullanıcı o sınıfın satırını
-- görmez), group_weekly_member_stats (037/077) ile tutarlı.
-- ============================================================

create or replace function public.group_weekly_class_average_batch(p_group_ids uuid[])
returns table (group_id uuid, avg_minutes numeric, member_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start date;
begin
  v_week_start := date_trunc('week', now())::date;

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
