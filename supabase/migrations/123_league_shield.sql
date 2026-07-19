-- ### 123_league_shield.sql
-- Lig sistemine "koruma kalkanı" mantığı: bir ligde henüz ilk haftasını
-- geçiren kullanıcı (geçen hafta o lige TERFİ etmişse) o hafta düşme eşiğinin
-- altında kalsa bile bir alt lige düşürülmez — sadece "stay" (shielded) sayılır.
-- Amaç: pozitif rekabet — yeni terfi eden birinin ilk kötü haftasında hemen
-- cezalandırılıp "düştün" hissi yaşamasını önlemek (bkz. social.js ensureWeeklyLeague
-- demote mesajı, aynı 2026-07-13 kararıyla yumuşatıldı).
create or replace function public.league_rollover()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_week       date := date_trunc('week', now() at time zone 'Europe/Istanbul')::date;
  v_promote    integer[] := array[400, 500, 600, 700];  -- Bronz→Platin eşikleri; Elmas son lig
  v_demote     integer := 150;
  p            record;
  v_weekly     integer;
  v_old_league smallint;
  v_league     smallint;
  v_result     text := 'stay';
  v_shielded   boolean := false;
  v_last       record;
begin
  if v_uid is null then return jsonb_build_object('error', 'auth'); end if;

  select xp, week_start, week_xp_base, league into p from profiles where id = v_uid;
  if not found then return jsonb_build_object('error', 'no_profile'); end if;

  v_league := coalesce(p.league, 1);

  perform set_config('focusai.server_write', 'on', true);

  if p.week_start is null then
    update profiles set week_start = v_week, week_xp_base = coalesce(p.xp, 0), league = v_league where id = v_uid;
    return jsonb_build_object('status', 'init', 'week_start', v_week,
      'base', coalesce(p.xp, 0), 'xp', coalesce(p.xp, 0), 'league', v_league);
  end if;

  if p.week_start >= v_week then
    return jsonb_build_object('status', 'same_week', 'week_start', p.week_start,
      'base', coalesce(p.week_xp_base, 0), 'xp', coalesce(p.xp, 0), 'league', v_league);
  end if;

  -- Hafta devrildi: geçen haftanın sonucunu uygula
  v_weekly := greatest(0, coalesce(p.xp, 0) - coalesce(p.week_xp_base, 0));
  v_old_league := v_league;
  if v_league < 5 and v_weekly >= v_promote[v_league] then
    v_league := v_league + 1; v_result := 'promote';
  elsif v_league > 1 and v_weekly < v_demote then
    -- Koruma kalkanı: bu lige en son terfiyle girdiyse (bir önceki tamamlanan
    -- haftanın sonucu promote + o hafta sonundaki lig = şu anki lig), bir kerelik
    -- düşme muafiyeti uygula.
    select league, result into v_last from league_history
      where user_id = v_uid order by week_start desc limit 1;
    if found and v_last.result = 'promote' and v_last.league = v_league then
      v_result := 'stay'; v_shielded := true;
    else
      v_league := v_league - 1; v_result := 'demote';
    end if;
  end if;

  insert into league_history (user_id, week_start, weekly_xp, league, result)
    values (v_uid, p.week_start, v_weekly, v_league, v_result)
    on conflict (user_id, week_start) do nothing;

  update profiles set week_start = v_week, week_xp_base = coalesce(p.xp, 0), league = v_league where id = v_uid;

  return jsonb_build_object('status', 'rolled', 'result', v_result, 'shielded', v_shielded,
    'weekly_xp', v_weekly, 'old_league', v_old_league, 'league', v_league,
    'week_start', v_week, 'base', coalesce(p.xp, 0), 'xp', coalesce(p.xp, 0));
end;
$$;

grant execute on function public.league_rollover() to authenticated;
