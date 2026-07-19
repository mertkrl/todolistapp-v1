-- ### 088_fix_collab_members_recursion.sql
-- =====================================================================
-- SORUN (087'nin kendisinin yol açtığı regresyon):
--   087'de collab_room_members için eklenen "collab_members_room_read" politikası
--   kendi tablosuna alt sorguyla referans veriyordu:
--
--     room_id IN (SELECT room_id FROM collab_room_members WHERE user_id = auth.uid())
--
--   Postgres RLS, bir politikanın WHERE/subquery'sinde AYNI tabloyu tekrar
--   sorgulaması durumunda o alt sorgu için de aynı politikaları (kendisi dahil)
--   yeniden değerlendirir → sonsuz döngü → "infinite recursion detected in
--   policy for relation collab_room_members" → istemci tarafında 500 hatası.
--
--   Bu 500, planning_goals tablosunun "planning_goals_collab_read" politikası
--   üzerinden collab_room_members'a join attığı HER select'i de kırdı — yani
--   planlama sekmesindeki hedefleri çekmek bile başarısız oluyordu, bu da
--   davet kabul akışının "Geçersiz davet kodu" ile başarısız olmasına neden
--   olan asıl tetikleyiciydi.
--
-- ÇÖZÜM:
--   Self-join yerine SECURITY DEFINER bir fonksiyon kullan. Bu fonksiyon
--   RLS'i bypass ederek üyelik kontrolü yapar, dolayısıyla politika
--   içinde çağrıldığında recursion oluşmaz (Supabase'in resmi olarak
--   önerdiği "membership check function" deseni).
-- =====================================================================

DROP POLICY IF EXISTS "collab_members_room_read" ON public.collab_room_members;

CREATE OR REPLACE FUNCTION public.is_collab_room_member(p_room_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.collab_room_members
    WHERE room_id = p_room_id AND user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_collab_room_member(text) TO authenticated;

CREATE POLICY "collab_members_room_read"
  ON public.collab_room_members
  FOR SELECT
  USING ( public.is_collab_room_member(room_id) );
