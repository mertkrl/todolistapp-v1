-- ### 025_e2e_public_key.sql
-- ============================================================
-- M5 Fix: E2E public key Supabase profiles tablosuna taşınıyor.
--
-- Firebase yolu: focusai_community/users/{username}/e2ePublicKey
-- Karşılık: profiles.e2e_public_key (jsonb)
--
-- Bu sayede Firebase olmadan da DM şifreli mesajlar çözülebilir.
-- ============================================================

alter table public.profiles
  add column if not exists e2e_public_key jsonb;
