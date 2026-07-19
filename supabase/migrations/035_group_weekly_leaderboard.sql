-- ### 035_group_weekly_leaderboard.sql
-- FocusAI -> Supabase Migration 035: Haftalık (Pazartesi'de sıfırlanan) grup leaderboard'u.
-- daily_stats kişiye özel RLS'li bir tablo olduğu için grup üyelerinin haftalık
-- toplam odaklanma süresini SECURITY DEFINER bir fonksiyon üzerinden, sadece
-- caller'ın o grubun üyesi olduğu doğrulanarak, agrega (toplam) düzeyde döneriz.
-- Çağıran tarafa tek tek günlük satırlar değil, sadece user_id + dakika toplamı sızar.

create or replace function public.group_weekly_leaderboard(p_group_id uuid)
returns table (user_id uuid, weekly_minutes integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start date;
begin
  -- Çağıran kullanıcı bu grubun üyesi değilse hiçbir şey döndürme.
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
  ) then
    return;
  end if;

  -- Haftanın başlangıcı: Pazartesi (ISO hafta).
  v_week_start := date_trunc('week', now())::date;

  return query
    select ds.user_id, coalesce(sum(ds.focus_minutes), 0)::integer as weekly_minutes
    from public.daily_stats ds
    where ds.stat_date >= v_week_start
      and ds.user_id in (
        select gm.user_id from public.group_members gm where gm.group_id = p_group_id
      )
    group by ds.user_id;
end;
$$;

grant execute on function public.group_weekly_leaderboard(uuid) to authenticated;
