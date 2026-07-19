-- ### 026_notifications_realtime.sql
-- ============================================================
-- M26: notifications tablosunu Supabase Realtime'a ekle
--
-- notifications tablosu 002_social_foundation.sql'de oluşturuldu
-- ancak supabase_realtime yayınına eklenmemişti. Bu eksiklik
-- buddy_habit_deleted, mention, group_slot_open gibi bildirim
-- türlerinin gerçek zamanlı iletilmemesine neden oluyordu.
-- ============================================================

alter table public.notifications replica identity full;
alter publication supabase_realtime add table public.notifications;
