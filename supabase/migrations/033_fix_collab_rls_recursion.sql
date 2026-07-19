-- ### 033_fix_collab_rls_recursion.sql
-- =====================================================================
-- 033_fix_collab_rls_recursion.sql
--
-- SORUN:
--   collab_rooms_member_read  → collab_room_members sorguluyor
--   collab_members_owner_manage → collab_rooms sorguluyor
--   → Döngüsel bağımlılık → 500 Internal Server Error
--
-- ÇÖZÜM:
--   1) collab_room_members tablosuna owner_id sütunu ekle
--   2) Döngü yaratan politikaları owner_id üzerinden yeniden yaz
--   3) collab_rooms için invite_code lookup'ı temiz bir şekilde açık tut
-- =====================================================================

-- 1. owner_id sütunu ekle (mevcut satırlar NULL kalacak, sonra doldurulacak)
ALTER TABLE public.collab_room_members
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Mevcut üyelerin owner_id'sini collab_rooms tablosundan doldur
UPDATE public.collab_room_members crm
SET owner_id = cr.owner_id
FROM public.collab_rooms cr
WHERE cr.id = crm.room_id;

-- 3. Döngü yaratan eski politikaları kaldır
DROP POLICY IF EXISTS "collab_rooms_member_read"       ON public.collab_rooms;
DROP POLICY IF EXISTS "collab_members_owner_manage"    ON public.collab_room_members;
DROP POLICY IF EXISTS "collab_rooms_invite_lookup"     ON public.collab_rooms;

-- 4. collab_rooms: invite_code lookup + sahip erişimi (collab_room_members sorgulamadan)
--    Herhangi bir authenticated kullanıcı davet kodu araması için okuyabilir
CREATE POLICY "collab_rooms_any_select"
  ON public.collab_rooms
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 5. collab_room_members: sahip yönetimi döngüsüz — owner_id üzerinden
CREATE POLICY "collab_members_owner_manage"
  ON public.collab_room_members
  FOR ALL
  USING (owner_id = auth.uid());

-- 6. collab_room_members: üye INSERT için — kendi kaydını ekleyebilir
--    (davet kodu ile katılım için)
DROP POLICY IF EXISTS "collab_members_join" ON public.collab_room_members;
CREATE POLICY "collab_members_join"
  ON public.collab_room_members
  FOR INSERT
  WITH CHECK (user_id = auth.uid());
