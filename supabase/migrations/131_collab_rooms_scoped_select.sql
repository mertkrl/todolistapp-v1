-- ### 131_collab_rooms_scoped_select.sql
-- =====================================================================
-- SORUN:
--   033_fix_collab_rls_recursion.sql, collab_room_members <-> collab_rooms
--   arasındaki RLS recursion'ı çözerken collab_rooms SELECT politikasını
--   geçici olarak tamamen açmıştı:
--     USING (auth.uid() IS NOT NULL)
--   Bu, giriş yapmış HERHANGİ bir kullanıcının tüm collab_rooms satırlarını
--   (invite_code dahil) okuyabilmesi anlamına geliyordu — davet koduyla
--   katılım güvenliğini geçersiz kılıyordu.
--
-- ÇÖZÜM:
--   SELECT'i sahip veya mevcut üye ile sınırla. collab_room_members
--   üzerinden recursion olmaz çünkü orada owner_id sütunu zaten var (033).
--   Davet kodu ile katılım akışı artık doğrudan tablo SELECT'i yerine
--   ayrı bir RPC/edge function üzerinden yürütülmelidir.
-- =====================================================================

DROP POLICY IF EXISTS "collab_rooms_any_select" ON public.collab_rooms;

CREATE POLICY "collab_rooms_owner_or_member_select"
  ON public.collab_rooms
  FOR SELECT
  USING (
    owner_id = auth.uid()
    OR id IN (SELECT room_id FROM public.collab_room_members WHERE user_id = auth.uid())
  );
