-- ### 057_focus_session_verification.sql
-- Faz A'da (051) bilinen sınır kapatılıyor: "odak dakikaları hâlâ client
-- beyanıdır" — konsoldan `FocusXP.awardFocus(240)` çağırarak hiç odaklanmadan
-- XP üretilebiliyordu (award_xp'nin 'focus' kolu, client'ın bildirdiği dakikayı
-- doğrudan kabul ediyordu, sadece günlük/olay başına tavanla sınırlıyordu).
--
-- Çözüm: odak seansı artık sunucuda zaman damgalanıyor.
--  1. start_focus_session()  — seans başlarken çağrılır, started_at SUNUCU
--     saatiyle kaydedilir (client bunu geriye alamaz).
--  2. finish_focus_session(session_id, claimed_minutes) — seans bitince
--     çağrılır; ödüllendirilen dakika = min(client'ın beyanı, now()-started_at
--     GERÇEK GEÇEN SÜRE) — yani client artık gerçekte beklemediği bir süreyi
--     asla XP'ye çeviremez. İç uygulama: mevcut award_xp('focus', ...) çağrılır,
--     böylece 051'deki tekilleştirme (ref) ve tavan mantığı aynen korunur.
--  3. award_xp artık 'focus' kolunda `focusai.focus_verified` GUC bayrağını
--     zorunlu kılıyor — bu bayrak SADECE finish_focus_session içinden
--     (transaction-yerel) set edilir. Yani client artık award_xp/award_xp_batch'i
--     doğrudan 'focus' kind'ıyla çağırıp XP üretemez.
--
-- Bilinen kalan sınır: sekmeyi gerçekten açık bırakıp hiçbir şey yapmadan
-- beklemek hâlâ mümkün (elapsed süre gerçek olsa da "çalışmak" değildir) —
-- bu davranışsal bir sınır, teknik bir açık değil; günlük tavan (960 dk,
-- 051) etkisini sınırlar.

-- ============================================================
-- 1) focus_sessions — seans zaman damgası defteri
-- ============================================================
create table if not exists public.focus_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  status          text not null default 'active' check (status in ('active', 'finished')),
  claimed_minutes integer,
  awarded_minutes integer,
  created_at      timestamptz not null default now()
);

create index if not exists focus_sessions_user_active_idx on public.focus_sessions (user_id, status);

alter table public.focus_sessions enable row level security;

-- Sadece kendi seans geçmişini okuyabilir; insert/update yalnızca definer fonksiyonlardan.
create policy "focus_sessions_select_own" on public.focus_sessions
  for select using (auth.uid() = user_id);

-- ============================================================
-- 2) start_focus_session — seans başlangıcını sunucu saatiyle damgalar
-- ============================================================
create or replace function public.start_focus_session()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_id         uuid;
  v_open_count integer;
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;

  -- Terk edilmiş (hiç bitirilmeden sekme kapatılmış) eski seansları temizle —
  -- sınırsız "active" satır birikmesin.
  update public.focus_sessions
    set status = 'finished', ended_at = now(), awarded_minutes = 0
    where user_id = v_uid and status = 'active' and started_at < now() - interval '6 hours';

  select count(*) into v_open_count from public.focus_sessions
    where user_id = v_uid and status = 'active';
  if v_open_count >= 5 then
    raise exception 'too many open focus sessions';
  end if;

  insert into public.focus_sessions (user_id) values (v_uid) returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.start_focus_session() to authenticated;

-- ============================================================
-- 3) finish_focus_session — ödül = min(beyan, gerçek geçen süre)
-- ============================================================
create or replace function public.finish_focus_session(p_session_id uuid, p_claimed_minutes integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_started_at   timestamptz;
  v_elapsed_min  integer;
  v_awarded_min  integer;
  v_award_result jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('awarded', 0, 'error', 'auth');
  end if;

  select started_at into v_started_at
    from public.focus_sessions
    where id = p_session_id and user_id = v_uid and status = 'active'
    for update;

  if v_started_at is null then
    return jsonb_build_object('awarded', 0, 'error', 'session_not_found');
  end if;

  v_elapsed_min := floor(extract(epoch from (now() - v_started_at)) / 60);
  -- İstemcinin beyanı yalnızca bir ÜST SINIR — gerçek geçen dakikayı asla aşamaz.
  v_awarded_min := least(greatest(coalesce(p_claimed_minutes, 0), 0), greatest(v_elapsed_min, 0));

  update public.focus_sessions
    set status = 'finished', ended_at = now(),
        claimed_minutes = p_claimed_minutes, awarded_minutes = v_awarded_min
    where id = p_session_id;

  if v_awarded_min < 1 then
    return jsonb_build_object('awarded', 0, 'error', 'too_short', 'elapsed_minutes', v_elapsed_min);
  end if;

  perform set_config('focusai.focus_verified', 'on', true);
  v_award_result := award_xp('focus', 'focus_session:' || p_session_id::text, v_awarded_min);

  return v_award_result || jsonb_build_object('elapsed_minutes', v_elapsed_min, 'awarded_minutes', v_awarded_min);
end;
$$;

grant execute on function public.finish_focus_session(uuid, integer) to authenticated;

-- ============================================================
-- 4) award_xp — 'focus' kolu artık doğrulanmış seans şart koşar
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
    -- 057: 'focus' XP'si artık yalnızca finish_focus_session() üzerinden,
    -- sunucu tarafı zaman damgasıyla doğrulanmış olarak verilebilir.
    if coalesce(current_setting('focusai.focus_verified', true), '') <> 'on' then
      return jsonb_build_object('awarded', 0, 'error', 'focus_requires_session');
    end if;
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
-- 5) award_xp_batch — 'focus_requires_session' hatasını "işlendi" say
--    (client eski kuyruktaki 'focus' olaylarını sonsuz denemez, sessizce düşer)
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
      'ok', (v_res ? 'xp') or coalesce((v_res ->> 'error') in ('daily_cap', 'bad_minutes', 'bad_ref', 'bad_kind', 'focus_requires_session'), false)
    ));
  end loop;

  if v_xp is null then
    select xp into v_xp from profiles where id = auth.uid();
  end if;

  return jsonb_build_object('awarded', v_total, 'xp', coalesce(v_xp, 0), 'results', v_results);
end;
$$;

grant execute on function public.award_xp_batch(jsonb) to authenticated;
