-- ### 087_fix_collab_members_read_asymmetry.sql
-- =====================================================================
-- SORUN:
--   collab_room_members üzerinde SELECT için sadece iki politika vardı:
--     - collab_members_own:          auth.uid() = user_id        (sadece kendi satırı)
--     - collab_members_owner_manage: owner_id = auth.uid()       (sahip -> tüm satırlar)
--
--   Bu yüzden planning.js._notifyCollabMembersGoalDeleted() odadaki
--   TÜM üyeleri çekmeye çalıştığında:
--     - Oda SAHİBİ (X) silince -> kendi satırı hariç herkesi görebiliyor -> diğer üyelere (Y) bildirim GİDİYOR.
--     - Sıradan bir ÜYE (Y) silince -> RLS yüzünden sadece KENDİ satırını görebiliyor,
--       filtrelemeden sonra 0 satır kalıyor -> sahibe (X) bildirim GİTMİYOR.
--
--   Sonuç: silme bildirimi sadece sahip sildiğinde işliyordu, üye sildiğinde
--   sessizce yutuluyordu.
--
-- ÇÖZÜM:
--   Bir üyenin, üyesi olduğu odalardaki TÜM üye satırlarını okuyabilmesini
--   sağlayan bir SELECT politikası ekle (aynı tablo üzerinden alt sorgu -
--   collab_rooms'a çapraz bağımlılık yok, bu yüzden 033'teki döngü sorunu
--   burada tekrarlanmıyor).
-- =====================================================================

CREATE POLICY "collab_members_room_read"
  ON public.collab_room_members
  FOR SELECT
  USING (
    room_id IN (
      SELECT room_id FROM public.collab_room_members WHERE user_id = auth.uid()
    )
  );
