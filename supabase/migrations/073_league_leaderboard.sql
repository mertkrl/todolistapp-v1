-- ### 073_league_leaderboard.sql
-- Lig içi (global) mini-leaderboard: kullanıcının kendi ligindeki (Bronz..Elmas)
-- en iyi 20 kişiyi bu haftaki XP'ye göre sıralı döner. profiles tablosu zaten
-- "profiles_select_authenticated" politikasıyla (002_social_foundation.sql)
-- tüm authenticated kullanıcılara açık olduğu için burada kimlik gizliliği
-- kaygısı yok — bu fonksiyon sadece DB tarafında doğru/performanslı sıralama
-- (haftalık xp hesabı + limit) yapmak için var, RLS bypass etmiyor.

create or replace function public.get_league_weekly_leaderboard()
returns table (
  username text,
  display_name text,
  avatar_color text,
  custom_avatar text,
  weekly_xp integer,
  league smallint,
  is_me boolean
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_week      date := date_trunc('week', now() at time zone 'Europe/Istanbul')::date;
  v_my_league smallint;
begin
  if v_uid is null then
    return;
  end if;

  select p.league into v_my_league from public.profiles p where p.id = v_uid;

  if v_my_league is null then
    return;
  end if;

  return query
    select p.username,
           p.display_name,
           p.avatar_color,
           p.custom_avatar,
           greatest(0, coalesce(p.xp, 0) - coalesce(p.week_xp_base, 0))::integer as weekly_xp,
           p.league,
           (p.id = v_uid) as is_me
    from public.profiles p
    where p.league = v_my_league
      and p.week_start = v_week
    order by weekly_xp desc, p.username asc
    limit 20;
end;
$$;

grant execute on function public.get_league_weekly_leaderboard() to authenticated;
