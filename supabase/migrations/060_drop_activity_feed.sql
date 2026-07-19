-- ### 060_drop_activity_feed.sql
-- Aktivite akışı (Kullanıcı Aktivitesi kartı) 2026-07-03'te arayüzden, sonra
-- 2026-07-04'te postActivity/subscribeActivity/renderActivityFeed dahil tüm
-- kod tabanından kaldırıldı (kullanıcı kararı — kart görünürlüğü zaten yoktu,
-- yazma da anlamsız hale gelmişti). Bu migration artık hiçbir yerden
-- kullanılmayan 'activities' ve 'activity_reactions' tablolarını düşürür.
--
-- DİKKAT: Bu geri alınamaz bir işlemdir — tablolardaki geçmiş aktivite/tepki
-- verisi kalıcı olarak silinir. Kod tarafında (social.js) bu tablolara hiçbir
-- okuma/yazma kalmadığı doğrulanmıştır.

drop table if exists public.activity_reactions;
drop table if exists public.activities;
