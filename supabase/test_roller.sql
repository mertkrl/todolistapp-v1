-- ### test_roller.sql — TEST İÇİN PROFİL/ROL GEÇİŞLERİ
-- Bu dosya migration DEĞİLDİR. Supabase SQL Editor'de ihtiyaç duyduğun
-- bloğu seçip çalıştır. <KULLANICI_ADI> kısmını kendi kullanıcı adınla değiştir.
--
-- ÖNEMLİ: plan (053) ve institution_role (055) kolonları trigger ile
-- korunur — koruma bayrağı (focusai.server_write) olmadan yapılan update
-- SESSİZCE geri alınır, SQL Editor'den bile. O yüzden TÜM blokları
-- begin/commit'li halleriyle OLDUĞU GİBİ çalıştır.
--
-- Her değişiklikten sonra uygulamada SAYFAYI YENİLE (profil girişte okunur).

-- ─────────────────────────────────────────────────────────
-- 1) BİREYSEL ÜCRETSİZ görünüm (sohbet yok, salt Arena, 1 grup/10 üye)
-- ─────────────────────────────────────────────────────────
begin;
select set_config('focusai.server_write', 'on', true);
update public.profiles
  set plan = 'free', institution_role = 'member'
  where username = '<KULLANICI_ADI>';
commit;

-- ─────────────────────────────────────────────────────────
-- 2) BİREYSEL PREMIUM görünüm (sohbet açık, 5 grup/30 üye)
-- ─────────────────────────────────────────────────────────
begin;
select set_config('focusai.server_write', 'on', true);
update public.profiles
  set plan = 'premium', institution_role = 'member'
  where username = '<KULLANICI_ADI>';
commit;

-- ─────────────────────────────────────────────────────────
-- 3) ÖĞRETMEN görünümü (sohbet + Sınıf Paneli; classroom tipi grupta
--    kurucu/admin olman gerekir — grup oluştururken "Sınıf" tipini seç)
-- ─────────────────────────────────────────────────────────
begin;
select set_config('focusai.server_write', 'on', true);
update public.profiles
  set institution_role = 'teacher'
  where username = '<KULLANICI_ADI>';
commit;

-- ─────────────────────────────────────────────────────────
-- 4) ÖĞRENCİ görünümü (sohbet açık, sınıf grubunda ödevleri görür/teslim eder)
-- ─────────────────────────────────────────────────────────
begin;
select set_config('focusai.server_write', 'on', true);
update public.profiles
  set institution_role = 'student'
  where username = '<KULLANICI_ADI>';
commit;

-- ─────────────────────────────────────────────────────────
-- Kontrol: hesabın şu anki durumu
-- ─────────────────────────────────────────────────────────
select username, plan, institution_role, xp, league, week_start
from public.profiles
where username = '<KULLANICI_ADI>';
