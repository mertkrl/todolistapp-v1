-- ### 052_seasons.sql
-- FocusAI Faz C: Sezon sistemi (aylık dönemler)
--
-- Sezon = takvim ayı (Europe/Istanbul). Haftalar, week_start tarihinin ayına
-- göre sezona bağlanır. Sezon kapanışı lazy'dir: kullanıcı yeni ayda ilk kez
-- geldiğinde ensure_season() geçmiş ayların league_history kayıtlarını
-- season_results'a toplar ve yeni kapanan sezon(lar)ı döner — client bu
-- dönüşle sezon sonu ekranını gösterir. Yazma yalnızca definer fonksiyonda,
-- bu yüzden sezon sonuçları da hileye kapalıdır (051'in devamı).

create table if not exists public.season_results (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  season      text not null,                    -- 'YYYY-MM'
  total_xp    integer not null default 0,       -- sezondaki haftalık XP toplamı
  best_league smallint not null default 1,      -- sezonda ulaşılan en yüksek lig
  weeks       integer not null default 0,       -- lige işlenen hafta sayısı
  created_at  timestamptz not null default now(),
  unique (user_id, season)
);

create index if not exists season_results_user_idx on public.season_results (user_id, season desc);

alter table public.season_results enable row level security;

-- Profil kartları/rozetler için giriş yapmış herkes okuyabilir
-- (league_history_select ile aynı görünürlük modeli).
create policy "season_results_select" on public.season_results
  for select using (auth.uid() is not null);

create or replace function public.ensure_season()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_cur       text := to_char((now() at time zone 'Europe/Istanbul')::date, 'YYYY-MM');
  v_closed    jsonb := '[]'::jsonb;
  v_season_xp integer := 0;
  r           record;
begin
  if v_uid is null then return jsonb_build_object('error', 'auth'); end if;

  -- Geçmiş ayların kapanmamış sezonlarını kapat
  for r in
    select to_char(lh.week_start, 'YYYY-MM') as season,
           sum(lh.weekly_xp)::integer        as total_xp,
           max(lh.league)::smallint          as best_league,
           count(*)::integer                 as weeks
    from league_history lh
    where lh.user_id = v_uid
      and to_char(lh.week_start, 'YYYY-MM') < v_cur
      and not exists (
        select 1 from season_results sr
        where sr.user_id = v_uid and sr.season = to_char(lh.week_start, 'YYYY-MM')
      )
    group by 1
    order by 1
  loop
    insert into season_results (user_id, season, total_xp, best_league, weeks)
      values (v_uid, r.season, r.total_xp, r.best_league, r.weeks)
      on conflict (user_id, season) do nothing;
    v_closed := v_closed || jsonb_build_array(jsonb_build_object(
      'season', r.season, 'total_xp', r.total_xp,
      'best_league', r.best_league, 'weeks', r.weeks));
  end loop;

  -- Bu sezonun şimdiye kadar lige işlenmiş XP'si (içinde bulunulan hafta hariç —
  -- onu client canlı haftalık XP'den ekler)
  select coalesce(sum(weekly_xp), 0) into v_season_xp
    from league_history
    where user_id = v_uid and to_char(week_start, 'YYYY-MM') = v_cur;

  return jsonb_build_object('current', v_cur, 'season_xp', v_season_xp, 'closed', v_closed);
end;
$$;

grant execute on function public.ensure_season() to authenticated;
