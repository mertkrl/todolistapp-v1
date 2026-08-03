-- ### 132_collab_room_lookup_by_code_rpc.sql
-- =====================================================================
-- SORUN:
--   131_collab_rooms_scoped_select.sql, collab_rooms SELECT'ini sahip/
--   üye ile sınırladı (doğru karar — bkz. 131). Ama collab.js'teki
--   joinByCode() henüz üye OLMAYAN bir kullanıcı için doğrudan
--   `collab_rooms.select('*').eq('invite_code', code)` çağırıyor
--   (bkz. collab.js satır 167) — artık RLS bu satırı gösterMEZ,
--   davet koduyla katılma akışı kırılır.
--
-- ÇÖZÜM:
--   SECURITY DEFINER bir RPC: sadece kod eşleşirse, katılım için
--   gereken minimum alanları (id, goal_id, owner_id, name) döndürür.
--   Tüm tabloyu açmadan "kodu bilen katılabilir" davranışını korur.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.lookup_collab_room_by_code(p_code text)
RETURNS TABLE (id text, goal_id text, owner_id uuid, name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cr.id, cr.goal_id, cr.owner_id, cr.name
  FROM public.collab_rooms cr
  WHERE cr.invite_code = upper(trim(p_code))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_collab_room_by_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.lookup_collab_room_by_code(text) TO authenticated;
