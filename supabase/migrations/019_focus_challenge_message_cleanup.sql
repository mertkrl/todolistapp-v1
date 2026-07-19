-- ### 019_focus_challenge_message_cleanup.sql
-- ============================================================
-- M4c fix: "Oturumu Bitir" / oturum biter bitmez sohbetteki davet
-- kartı (messages.challenge_id dolu olan satır) silinmeli.
--
-- Sebep: mevcut "messages_delete_own" politikası sadece mesajı
-- gönderen kişinin (sender_id = auth.uid()) silmesine izin veriyor.
-- Ancak oturumu bitiren/son ayrılan kişi davetin sahibi olmayabilir
-- (örn. davet eden kişi ayrılmış, diğer katılımcı oturumu bitiriyor).
--
-- Çözüm: challenge_id dolu olan mesajlar için, o challenge'a
-- katılımcı olan herkesin silebilmesine izin veren ek bir
-- permissive policy ekle.
-- ============================================================

-- Not: "son ayrılan" katılımcı, mesajı silmeden önce kendi
-- focus_challenge_participants satırını silmiş olabilir — bu durumda
-- is_challenge_participant artık false döner. Bu yüzden grup üyeliği
-- de (is_challenge_group_member) yeterli kabul edilir.
create policy "messages_delete_challenge_participant" on public.messages for delete using (
  challenge_id is not null
  and (
    public.is_challenge_participant(challenge_id, auth.uid())
    or public.is_challenge_group_member(challenge_id, auth.uid())
  )
);
