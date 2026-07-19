-- ### 014_message_pins_realtime.sql
-- ============================================================
-- M2d: message_pins tablosu realtime publication'a eklenmemişti
-- (003_social_messaging.sql'de unutulmuş) -- bu yüzden mesaj
-- sabitleme/kaldırma DB'ye yazılıyor ama dm-pins-{conversationId}
-- kanalı hiçbir postgres_changes olayı almıyor, arayüz güncellenmiyordu.
-- ============================================================
alter publication supabase_realtime add table public.message_pins;
