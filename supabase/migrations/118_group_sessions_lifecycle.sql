-- ### 118_group_sessions_lifecycle.sql
-- ============================================================
-- Grup ders seansları için durum makinesi (scheduled/live/cancelled/completed)
-- + bekleme odası akışı: yetkili (seans sahibi veya grup admini) oturumu
-- başlatana kadar katılımcılar bekler, süresi dolarsa otomatik iptal olur.
--
-- Ayrıca kritik bir eksik giderilir: group_sessions ve
-- group_session_attendees için hiç UPDATE RLS policy'si yoktu (028/029/
-- 038/039'da yok), ama kod zaten .update() çağırıyordu (seans düzenleme,
-- check-in) — bu satırlar RLS tarafından sessizce engelleniyordu.
-- ============================================================

alter table public.group_sessions
  add column if not exists status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'cancelled', 'completed')),
  add column if not exists started_at timestamptz;

-- group_sessions: seans sahibi veya "seans yönetebilir" rolündeki üye
-- (admin/moderator — client'taki BUILTIN_ROLE_PERMS.manageSessions ile aynı sınır)
-- güncelleyebilir: düzenleme + durum geçişleri (live/cancelled/completed).
create policy "Session creator or manager can update"
  on public.group_sessions for update
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = group_sessions.group_id
        and gm.user_id = auth.uid()
        and gm.role in ('admin', 'moderator')
    )
  )
  with check (
    created_by = auth.uid()
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = group_sessions.group_id
        and gm.user_id = auth.uid()
        and gm.role in ('admin', 'moderator')
    )
  );

-- group_session_attendees: kullanıcı kendi katılım satırını güncelleyebilir
-- (check-in / bekleme odasına giriş zaman damgası)
create policy "Update own attendance"
  on public.group_session_attendees for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
