-- ### 032_notifications_cross_user_insert.sql
-- =====================================================================
-- 032_notifications_cross_user_insert.sql
-- 029'da notifications INSERT politikası "user_id = auth.uid()" olarak
-- kısıtlandı. Bu yaklaşım buddy_habit bildirimleri, plan davetleri gibi
-- çapraz kullanıcı bildirimlerini kırdı.
-- Çözüm: Politikayı orijinal haline döndür — kimliği doğrulanmış her
-- kullanıcı başka birine bildirim gönderebilir.
-- =====================================================================

DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;

CREATE POLICY "notifications_insert"
  ON public.notifications
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
