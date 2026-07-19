-- ### 022_friendships_realtime.sql
-- ============================================================
-- M5a: Arkadaşlık Sistemi Realtime etkinleştirme
--
-- friendships tablosu 002_social_foundation.sql'de oluşturulmuştu.
-- Bu migration:
--   1. Realtime yayınına ekler (INSERT/UPDATE/DELETE bildirimleri)
--   2. replica identity full — UPDATE/DELETE'de eski satır değerleri
--      de gönderilir (old.status → pending→accepted geçişini tespit etmek için)
-- ============================================================

alter table public.friendships replica identity full;
alter publication supabase_realtime add table public.friendships;
