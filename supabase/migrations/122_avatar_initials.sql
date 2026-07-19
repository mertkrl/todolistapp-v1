-- ### 122_avatar_initials.sql
-- ============================================================
-- Ücretsiz kullanıcılar için fotoğraf yükleme premium'a özel oldu
-- (bkz. social.js avatarUploadEnabled). Ücretsiz kullanıcılar yerine
-- rengi (zaten vardı) ve avatarda gösterilen 2 harfi özelleştirebilir —
-- bu sütun boşsa displayName'den otomatik türetme aynen çalışmaya
-- devam eder, geriye dönük kırılma yok.
-- ============================================================

alter table public.profiles
  add column if not exists avatar_initials text;
