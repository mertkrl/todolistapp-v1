-- ### 051_server_xp.sql
-- FocusAI Faz A: Sunucu tarafı XP (anti-hile temeli)
--
-- Sorun: XP şimdiye kadar client'ta hesaplanıp profiles.xp'ye doğrudan
-- yazılıyordu — konsoldan tek satırla istenen XP yazılabiliyordu.
--
-- Çözüm:
--  1. xp_events: kullanıcı başına olay defteri (görev/alışkanlık/öne çıkan/odak).
--     Her olay benzersiz (user_id, kind, ref) — aynı görev iki kez XP vermez.
--  2. award_xp / award_xp_batch: XP miktarını SUNUCU belirler (client miktar
--     gönderemez), günlük tavanlar uygulanır, profiles.xp atomik güncellenir.
--  3. profiles.xp / week_start / week_xp_base / league kolonları trigger ile
--     korunur: client doğrudan UPDATE atarsa bu kolonlar sessizce eski değere
--     döner (mevcut istemciler kırılmaz), sadece SECURITY DEFINER fonksiyonlar
--     (transaction-yerel GUC bayrağıyla) yazabilir.
--  4. league_rollover: haftalık lig devrilmesi artık sunucuda hesaplanır
--     (client'ın kendi ligini/haftalık XP'sini beyan etmesi engellenir).
--  5. finalize_duel: düello sonuçları sunucuda hesaplanır; duels'in skor
--     kolonları da trigger ile korunur.
--
-- Bilinen sınır: odak dakikaları hâlâ client beyanıdır (seans bitince
-- awardFocus çağrılır). Tavanlar (olay başına 240 dk, günde 960 dk odak,
-- günde 80 görev olayı) kötüye kullanımın etkisini sınırlar; tam çözüm
-- sunucu taraflı seans doğrulaması ileriki iştir.

-- ============================================================
-- 1) xp_events — olay defteri
-- ============================================================
create table if not exists public.xp_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('task', 'habit', 'highlight', 'focus')),
  ref        text not null,
  amount     integer not null,
  minutes    integer,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref)
);

create index if not exists xp_events_user_time_idx on public.xp_events (user_id, created_at desc);

alter table public.xp_events enable row level security;

-- Sadece kendi olaylarını okuyabilir; yazma yalnızca definer fonksiyonlardan.
create policy "xp_events_select_own" on public.xp_events
  for select using (auth.uid() = user_id);

-- ============================================================
-- 2) profiles korumalı kolon trigger'ı
-- ============================================================
create or replace function public.profiles_protect_columns()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('focusai.server_write', true), '') <> 'on' then
    new.xp           := old.xp;
    new.week_start   := old.week_start;
    new.week_xp_base := old.week_xp_base;
    new.league       := old.league;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_columns_trg on public.profiles;
create trigger profiles_protect_columns_trg
  before update on public.profiles
  for each row execute function public.profiles_protect_columns();

-- ============================================================
-- 3) award_xp — tek olay işle (miktarı sunucu belirler)
-- ============================================================
create or replace function public.award_xp(p_kind text, p_ref text, p_minutes integer default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_today       date := (now() at time zone 'Europe/Istanbul')::date;
  v_amount      integer;
  v_minutes     integer := null;
  v_used_focus  integer;
  v_used_events integer;
  v_new_xp      integer;
  v_rows        integer;
begin
  if v_uid is null then
    return jsonb_build_object('awarded', 0, 'error', 'auth');
  end if;
  if p_ref is null or length(p_ref) = 0 or length(p_ref) > 120 then
    return jsonb_build_object('awarded', 0, 'error', 'bad_ref');
  end if;

  if p_kind = 'focus' then
    v_minutes := least(greatest(coalesce(p_minutes, 0), 0), 240);
    if v_minutes < 1 then
      return jsonb_build_object('awarded', 0, 'error', 'bad_minutes');
    end if;
    -- Günlük odak tavanı: 960 dk (İstanbul günü)
    select coalesce(sum(minutes), 0) into v_used_focus
      from xp_events
      where user_id = v_uid and kind = 'focus'
        and (created_at at time zone 'Europe/Istanbul')::date = v_today;
    v_minutes := least(v_minutes, greatest(0, 960 - v_used_focus));
    if v_minutes < 1 then
      return jsonb_build_object('awarded', 0, 'error', 'daily_cap');
    end if;
    v_amount := v_minutes * 2;
  elsif p_kind in ('task', 'habit', 'highlight') then
    -- Günlük olay tavanı: 80 görev/alışkanlık/öne çıkan olayı
    select count(*) into v_used_events
      from xp_events
      where user_id = v_uid and kind in ('task', 'habit', 'highlight')
        and (created_at at time zone 'Europe/Istanbul')::date = v_today;
    if v_used_events >= 80 then
      return jsonb_build_object('awarded', 0, 'error', 'daily_cap');
    end if;
    v_amount := case p_kind when 'task' then 10 when 'habit' then 15 else 20 end;
  else
    return jsonb_build_object('awarded', 0, 'error', 'bad_kind');
  end if;

  insert into xp_events (user_id, kind, ref, amount, minutes)
    values (v_uid, p_kind, p_ref, v_amount, v_minutes)
    on conflict (user_id, kind, ref) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    -- Mükerrer olay: XP verme ama başarı say (client kuyruğu temizlesin)
    select xp into v_new_xp from profiles where id = v_uid;
    return jsonb_build_object('awarded', 0, 'duplicate', true, 'xp', coalesce(v_new_xp, 0));
  end if;

  perform set_config('focusai.server_write', 'on', true);
  update profiles set xp = coalesce(xp, 0) + v_amount where id = v_uid returning xp into v_new_xp;

  return jsonb_build_object('awarded', v_amount, 'xp', v_new_xp);
end;
$$;

grant execute on function public.award_xp(text, text, integer) to authenticated;

-- ============================================================
-- 3b) award_xp_batch — client kuyruğu tek istekte boşaltır
-- ============================================================
create or replace function public.award_xp_batch(p_events jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ev      jsonb;
  v_res     jsonb;
  v_total   integer := 0;
  v_xp      integer := null;
  v_results jsonb := '[]'::jsonb;
begin
  if p_events is null or jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 100 then
    return jsonb_build_object('error', 'bad_batch');
  end if;

  for v_ev in select * from jsonb_array_elements(p_events) loop
    v_res := award_xp(
      v_ev ->> 'kind',
      v_ev ->> 'ref',
      coalesce((v_ev ->> 'minutes')::integer, 0)
    );
    v_total := v_total + coalesce((v_res ->> 'awarded')::integer, 0);
    if v_res ? 'xp' then v_xp := (v_res ->> 'xp')::integer; end if;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'ref', v_ev ->> 'ref',
      'kind', v_ev ->> 'kind',
      'ok', (v_res ? 'xp') or coalesce((v_res ->> 'error') in ('daily_cap', 'bad_minutes', 'bad_ref', 'bad_kind'), false)
    ));
  end loop;

  if v_xp is null then
    select xp into v_xp from profiles where id = auth.uid();
  end if;

  return jsonb_build_object('awarded', v_total, 'xp', coalesce(v_xp, 0), 'results', v_results);
end;
$$;

grant execute on function public.award_xp_batch(jsonb) to authenticated;

-- ============================================================
-- 4) league_rollover — haftalık lig devrilmesi sunucuda
-- ============================================================
-- 049'daki client-taraflı rollover'ın yerini alır. Eşikler social.js
-- LEAGUE_PROMOTE_XP / LEAGUE_DEMOTE_XP ile aynı tutulmalıdır.
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
    v_league := v_league - 1; v_result := 'demote';
  end if;

  insert into league_history (user_id, week_start, weekly_xp, league, result)
    values (v_uid, p.week_start, v_weekly, v_league, v_result)
    on conflict (user_id, week_start) do nothing;

  update profiles set week_start = v_week, week_xp_base = coalesce(p.xp, 0), league = v_league where id = v_uid;

  return jsonb_build_object('status', 'rolled', 'result', v_result,
    'weekly_xp', v_weekly, 'old_league', v_old_league, 'league', v_league,
    'week_start', v_week, 'base', coalesce(p.xp, 0), 'xp', coalesce(p.xp, 0));
end;
$$;

grant execute on function public.league_rollover() to authenticated;

-- Rollover artık definer fonksiyonda — client'ın league_history yazma izni kaldırılır.
drop policy if exists "league_history_insert" on public.league_history;

-- ============================================================
-- 5) Düello skorları: korumalı kolonlar + sunucuda sonuçlandırma
-- ============================================================
create or replace function public.duels_protect_columns()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('focusai.server_write', true), '') <> 'on' then
    new.challenger_xp := old.challenger_xp;
    new.opponent_xp   := old.opponent_xp;
    new.winner_id     := old.winner_id;
    if new.status = 'finished' and old.status <> 'finished' then
      new.status := old.status;  -- client 'finished' yazamaz; finalize_duel kullan
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists duels_protect_columns_trg on public.duels;
create trigger duels_protect_columns_trg
  before update on public.duels
  for each row execute function public.duels_protect_columns();

create or replace function public.finalize_duel(p_duel_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_week   date := date_trunc('week', now() at time zone 'Europe/Istanbul')::date;
  d        record;
  v_cxp    integer;
  v_oxp    integer;
  v_winner uuid;
begin
  if v_uid is null then return jsonb_build_object('status', 'error', 'error', 'auth'); end if;

  select * into d from duels
    where id = p_duel_id and status = 'active'
      and v_uid in (challenger_id, opponent_id)
    for update;
  if not found then return jsonb_build_object('status', 'noop'); end if;
  if d.week_start >= v_week then return jsonb_build_object('status', 'not_expired'); end if;

  -- Skor: profil hâlâ o haftadaysa canlı fark, devrilmişse league_history, o da yoksa 0
  select case when pr.week_start = d.week_start
              then greatest(0, coalesce(pr.xp, 0) - coalesce(pr.week_xp_base, 0))
              else coalesce((select lh.weekly_xp from league_history lh
                             where lh.user_id = d.challenger_id and lh.week_start = d.week_start), 0)
         end into v_cxp
    from profiles pr where pr.id = d.challenger_id;

  select case when pr.week_start = d.week_start
              then greatest(0, coalesce(pr.xp, 0) - coalesce(pr.week_xp_base, 0))
              else coalesce((select lh.weekly_xp from league_history lh
                             where lh.user_id = d.opponent_id and lh.week_start = d.week_start), 0)
         end into v_oxp
    from profiles pr where pr.id = d.opponent_id;

  v_winner := case when v_cxp = v_oxp then null
                   when v_cxp > v_oxp then d.challenger_id
                   else d.opponent_id end;

  perform set_config('focusai.server_write', 'on', true);
  update duels set status = 'finished', challenger_xp = v_cxp, opponent_xp = v_oxp, winner_id = v_winner
    where id = p_duel_id;

  return jsonb_build_object('status', 'finalized',
    'challenger_xp', v_cxp, 'opponent_xp', v_oxp, 'winner_id', v_winner);
end;
$$;

grant execute on function public.finalize_duel(uuid) to authenticated;
