-- ### 015_messages_replica_identity_full.sql
-- ============================================================
-- M2d: mesaj silme karşı tarafa düşmüyordu.
--
-- Sebep: messages/message_pins tablolarının REPLICA IDENTITY'si
-- varsayılan (sadece primary key). RLS açıkken Supabase Realtime,
-- bir DELETE event'ini bir kullanıcıya göndermeden önce o satırın
-- SELECT policy'sini "old record" üzerinden değerlendirir. "old
-- record"da sadece "id" varsa (scope_id, sender_id vs. yok), policy
-- değerlendirilemez ve event o kullanıcıya hiç gönderilmez.
--
-- Çözüm: REPLICA IDENTITY FULL ile "old record" tüm sütunları
-- içersin, böylece DELETE event'leri RLS policy'lerine göre doğru
-- şekilde dağıtılabilsin.
-- ============================================================
alter table public.messages replica identity full;
alter table public.message_pins replica identity full;
