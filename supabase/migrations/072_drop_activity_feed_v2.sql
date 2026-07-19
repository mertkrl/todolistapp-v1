-- ### 072_drop_activity_feed_v2.sql
-- Aktivite akışı (071_activity_feed.sql ile kurulmuştu) 2026-07-05'te ikinci
-- kez ve kesin olarak kaldırıldı (kullanıcı kararı). Kod tarafında (social.js)
-- postActivity yeniden no-op'a döndürüldü, "Akış" sekmesi/#activity-feed-list
-- index.html'den çıkarıldı. Bu migration 071'in oluşturduğu her şeyi düşürür.

drop function if exists public.get_friend_activity_feed(int);
drop function if exists public.log_activity(text, text);
drop table if exists public.activities;
