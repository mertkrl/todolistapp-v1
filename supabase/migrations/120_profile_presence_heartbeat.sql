-- ### 120_profile_presence_heartbeat.sql
-- ============================================================
-- community-presence paylaşımlı Realtime presence kanalı kaldırılıyor:
-- her online kullanıcının aynı kanalda olması, bir kullanıcının her durum
-- değişiminin (odaklan/duraklat/durdur) o an online olan HERKESE anlık
-- broadcast edilmesi anlamına geliyordu (N kullanıcı -> N-1 mesaj/olay,
-- karesel büyüme). Supabase free tier'ın aylık realtime mesaj kotasına
-- bağlantı limitinden önce çarpma riski taşıyordu.
--
-- Çözüm: cw_room_heartbeat (075_cw_room_heartbeat.sql) ile aynı desen —
-- anlık broadcast yerine DB'ye periyodik heartbeat yazısı + istemcilerin
-- ilgilendiği kullanıcıları (arkadaşlar/grup/sınıf üyeleri) periyodik
-- polling ile okuması (bkz. social.js _refreshWatchedPresence).
-- ============================================================

alter table public.profiles
  add column if not exists is_focusing            boolean not null default false,
  add column if not exists focus_mode             text,
  add column if not exists gsc_session_id         text,
  add column if not exists waiting_for_session_id text;

-- p_gsc_session_id: kullanıcının odaklandığı grup seansı (varsa) — "şu an bu
-- seansa kimler odaklanıyor" görünümü için (bkz. social.js gscGetFocusingNow).
-- p_waiting_session_id: bekleme odasında olunan seans id'si (bkz. gscGetWaitingNow).
create or replace function public.presence_heartbeat(
  p_studying boolean,
  p_focus_mode text default null,
  p_gsc_session_id text default null,
  p_waiting_session_id text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set last_seen = now(),
      is_focusing = coalesce(p_studying, false),
      focus_mode = case when coalesce(p_studying, false) then p_focus_mode else null end,
      gsc_session_id = case when coalesce(p_studying, false) then p_gsc_session_id else null end,
      waiting_for_session_id = p_waiting_session_id
  where id = auth.uid();
$$;

grant execute on function public.presence_heartbeat(boolean, text, text, text) to authenticated;
