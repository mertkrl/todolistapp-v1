-- ### 059_focus_session_heartbeat.sql
-- 057'de bilinçli olarak kapsam dışı bırakılan sınır kapatılıyor: "sekmeyi
-- gerçekten açık bırakıp hiçbir şey yapmadan beklemek" — çünkü finish_focus_session
-- ödülü yalnızca DUVAR SAATİ geçen süreyle sınırlıyordu (client hiç etkileşimde
-- bulunmasa da elapsed süre gerçekti, dolayısıyla XP kazanılabiliyordu).
--
-- Çözüm: istemci, gerçek kullanıcı etkileşimi (fare/klavye/dokunma) olduğu VE
-- sekme görünür/odaklı olduğu sürece periyodik "heartbeat" gönderir
-- (bkz. script.js/social.js — FocusXP.heartbeat). Sunucu her heartbeat'te
-- yalnızca iki heartbeat arasındaki gerçek süreyi (90 sn tavanlı, tek seferde
-- büyük sıçrama olmasın diye) `active_seconds`e ekler. finish_focus_session artık
-- ödülü min(beyan, gerçek geçen süre, active_seconds + 3 dk tolerans) olarak
-- hesaplıyor — 3 dk tolerans, ilk heartbeat'ten önceki başlangıç ve seansın son
-- (heartbeat'siz kalan) parçası için makul bir pay.
--
-- Heartbeat hiç gelmezse (offline/eski istemci) active_seconds=0 kalır ve ödül
-- en fazla ~3 dk'ya düşer — bu, "iddia var ama etkileşim yok" durumunu maksimum
-- tavan olarak sınırlar; gerçek kısa seanslar zaten elapsed süre tavanıyla
-- korunuyordu.

alter table public.focus_sessions
  add column if not exists active_seconds integer not null default 0,
  add column if not exists last_heartbeat_at timestamptz;

-- ============================================================
-- heartbeat_focus_session — istemci gerçek etkileşim gördüğünde çağırır
-- ============================================================
create or replace function public.heartbeat_focus_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_started timestamptz;
  v_last    timestamptz;
  v_delta   integer;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'auth');
  end if;

  select started_at, coalesce(last_heartbeat_at, started_at)
    into v_started, v_last
    from public.focus_sessions
    where id = p_session_id and user_id = v_uid and status = 'active'
    for update;

  if v_started is null then
    return jsonb_build_object('ok', false, 'error', 'session_not_found');
  end if;

  -- Aralık başına en fazla 90 sn sayılır (istemci ~45 sn'de bir çağırır);
  -- sekme uzun süre arka planda kalıp uyanınca tek heartbeat büyük bir
  -- boşluğu birden saymasın diye tavanlanır.
  v_delta := least(greatest(extract(epoch from (now() - v_last))::integer, 0), 90);

  update public.focus_sessions
    set active_seconds = active_seconds + v_delta,
        last_heartbeat_at = now()
    where id = p_session_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.heartbeat_focus_session(uuid) to authenticated;

-- ============================================================
-- finish_focus_session — ödül artık active_seconds ile de sınırlı
-- ============================================================
create or replace function public.finish_focus_session(p_session_id uuid, p_claimed_minutes integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid            uuid := auth.uid();
  v_started_at     timestamptz;
  v_active_seconds integer;
  v_elapsed_min    integer;
  v_active_min     integer;
  v_awarded_min    integer;
  v_award_result   jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('awarded', 0, 'error', 'auth');
  end if;

  select started_at, coalesce(active_seconds, 0)
    into v_started_at, v_active_seconds
    from public.focus_sessions
    where id = p_session_id and user_id = v_uid and status = 'active'
    for update;

  if v_started_at is null then
    return jsonb_build_object('awarded', 0, 'error', 'session_not_found');
  end if;

  v_elapsed_min := floor(extract(epoch from (now() - v_started_at)) / 60);
  -- Etkileşim tavanı: gerçek heartbeat'lerle biriken aktif süre + 3 dk tolerans
  -- (ilk heartbeat öncesi + son heartbeat sonrası kısımlar için).
  v_active_min := floor((v_active_seconds + 180) / 60.0);
  -- İstemcinin beyanı; üç sınırdan en küçüğü geçerli: beyan, gerçek geçen süre,
  -- gerçek etkileşimle doğrulanmış süre.
  v_awarded_min := least(
    greatest(coalesce(p_claimed_minutes, 0), 0),
    greatest(v_elapsed_min, 0),
    greatest(v_active_min, 0)
  );

  update public.focus_sessions
    set status = 'finished', ended_at = now(),
        claimed_minutes = p_claimed_minutes, awarded_minutes = v_awarded_min
    where id = p_session_id;

  if v_awarded_min < 1 then
    return jsonb_build_object('awarded', 0, 'error', 'too_short',
      'elapsed_minutes', v_elapsed_min, 'active_minutes', v_active_min);
  end if;

  perform set_config('focusai.focus_verified', 'on', true);
  v_award_result := award_xp('focus', 'focus_session:' || p_session_id::text, v_awarded_min);

  return v_award_result || jsonb_build_object(
    'elapsed_minutes', v_elapsed_min, 'active_minutes', v_active_min, 'awarded_minutes', v_awarded_min
  );
end;
$$;

grant execute on function public.finish_focus_session(uuid, integer) to authenticated;
