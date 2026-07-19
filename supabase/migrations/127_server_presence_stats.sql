-- ### 127_server_presence_stats.sql
-- Faz A'nın kapsamadığı açık: syncXP() (social.js) focus_streak,
-- completed_today ve completed_goals kolonlarını hâlâ doğrudan client'tan
-- profiles'a yazıyordu — konsoldan
--   supabase.from('profiles').update({focus_streak: 9999, completed_goals: 999})
-- ile liderlik tablosu/seri yarışı hile edilebiliyordu (051_server_xp.sql
-- sadece xp/week_start/week_xp_base/league kolonlarını korumaya almıştı).
--
-- Çözüm: 051'deki desenin aynısı.
--  1. profiles_protect_columns trigger'ı artık focus_streak, completed_today
--     ve completed_goals kolonlarını da korur.
--  2. sync_presence_stats(p_status) — SECURITY DEFINER RPC — bu üç değeri
--     sunucuda, kullanıcının kendi verisinden (xp_events, goals) yeniden
--     hesaplar ve server_write bayrağıyla yazar. Client artık sadece
--     current_status/last_seen/focus_min gönderir (focus_min hâlâ client
--     beyanı — 051'deki bilinen sınırla aynı, bu migration'ın kapsamı dışı).
-- ============================================================

create or replace function public.profiles_protect_columns()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('focusai.server_write', true), '') <> 'on' then
    new.xp              := old.xp;
    new.week_start       := old.week_start;
    new.week_xp_base     := old.week_xp_base;
    new.league           := old.league;
    new.focus_streak     := old.focus_streak;
    new.completed_today  := old.completed_today;
    new.completed_goals  := old.completed_goals;
  end if;
  return new;
end;
$$;

-- ============================================================
-- sync_presence_stats — focus_streak / completed_today / completed_goals'ı
-- sunucuda yeniden hesaplayıp yazar; ayrıca last_seen/current_status günceller.
-- ============================================================
create or replace function public.sync_presence_stats(p_status text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid            uuid := auth.uid();
  v_today          date := (now() at time zone 'Europe/Istanbul')::date;
  v_day            date;
  v_streak         integer := 0;
  v_completed_today integer;
  v_completed_goals integer;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'auth');
  end if;

  -- completed_today: bugün (İstanbul günü) tamamlanan görev olayları
  select count(*) into v_completed_today
    from xp_events
    where user_id = v_uid and kind = 'task'
      and (created_at at time zone 'Europe/Istanbul')::date = v_today;

  -- completed_goals: tamamlanmış hedef sayısı (goals tablosu tek doğru kaynak)
  select count(*) into v_completed_goals
    from goals
    where user_id = v_uid and status = 'completed';

  -- focus_streak: geriye doğru, o gün en az bir görev/alışkanlık olayı
  -- olan ardışık gün sayısı. Bugün henüz hiçbir şey yapılmamışsa bugün
  -- serinin kırılmasına sebep olmaz — dünden geriye sayılır.
  v_day := v_today;
  if not exists (
    select 1 from xp_events
    where user_id = v_uid and kind in ('task', 'habit')
      and (created_at at time zone 'Europe/Istanbul')::date = v_day
  ) then
    v_day := v_day - 1;
  end if;

  while exists (
    select 1 from xp_events
    where user_id = v_uid and kind in ('task', 'habit')
      and (created_at at time zone 'Europe/Istanbul')::date = v_day
  ) loop
    v_streak := v_streak + 1;
    v_day := v_day - 1;
  end loop;

  perform set_config('focusai.server_write', 'on', true);
  update profiles set
    last_seen        = now(),
    current_status    = coalesce(p_status, current_status),
    focus_streak      = v_streak,
    completed_today   = v_completed_today,
    completed_goals   = v_completed_goals
  where id = v_uid;

  return jsonb_build_object(
    'focus_streak', v_streak,
    'completed_today', v_completed_today,
    'completed_goals', v_completed_goals
  );
end;
$$;

grant execute on function public.sync_presence_stats(text) to authenticated;
