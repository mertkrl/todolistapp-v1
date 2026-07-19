-- ### 029_rls_security_fixes.sql
-- =====================================================================
-- 029_rls_security_fixes.sql
-- 3 RLS güvenlik açığı kapatılıyor:
--   1) notifications INSERT — herhangi bir kullanıcıya bildirim gönderilebiliyordu
--   2) buddy_habit_invites UPDATE — davet edilen kullanıcı kabul/red edemiyordu
--   3) group_session_attendees SELECT — tüm kullanıcılar katılımcı listesini görebiliyordu
-- =====================================================================

-- 1. NOTIFICATIONS INSERT — user_id kısıtlaması ekleniyor
-- Eski policy: auth.uid() is not null (herkes herkese bildirim gönderebilirdi)
-- Yeni policy: user_id = auth.uid() (sadece kendi adına bildirim oluşturulabilir)
-- NOT: Sunucu tarafı (Supabase Functions / trigger) bildirim göndermesi için
--      service_role kullanıldığı varsayılıyor — o zaten RLS'yi bypass eder.
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert"
  ON public.notifications
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 2. BUDDY_HABIT_INVITES UPDATE — davet edilen kullanıcı kabul/red edebilmeli
DROP POLICY IF EXISTS "buddy_habit_invites_update" ON public.buddy_habit_invites;
CREATE POLICY "buddy_habit_invites_update"
  ON public.buddy_habit_invites
  FOR UPDATE
  USING (to_id = auth.uid())
  WITH CHECK (to_id = auth.uid());

-- 3. GROUP_SESSION_ATTENDEES SELECT — sadece grup üyeleri görebilmeli
-- Eski policy: using (true)  — herkes görebiliyordu
DROP POLICY IF EXISTS "View attendees" ON public.group_session_attendees;
CREATE POLICY "Group members can view attendees"
  ON public.group_session_attendees
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.group_sessions gs
      JOIN public.group_members gm ON gm.group_id = gs.group_id
      WHERE gs.id = session_id
        AND gm.user_id = auth.uid()
    )
  );
