-- ### 053_user_plan.sql
-- FocusAI Freemium modeli: profiles.plan ('free' | 'premium')
--
-- Model (2026-07-02 kararı):
--   Ücretsiz : grup kurma ✓ (1 grup, 10 üye), Arena ✓, mola sohbeti ✓, sohbet ✗
--   Premium  : + sohbet bölümü, 5 grup, 30 üye
--   Kurumsal : (institution_role student/teacher) + sınıf paneli, 100 üye
--
-- Ödeme entegrasyonu bilinçli olarak SONRAYA bırakıldı — o gelene kadar plan
-- alanı SQL'den elle atanır (örn. update profiles set plan='premium' where ...).
-- Üye kapasitesi grubun max_members kolonuna (044) kurulma anında yazılır;
-- katılım kontrolü grubun kendi kapasitesine bakar (kuranın planı belirler).

alter table public.profiles
  add column if not exists plan text not null default 'free'
    check (plan in ('free', 'premium'));

-- plan, korumalı kolonlara eklenir: client kendi kendini premium yapamaz.
-- 051'deki fonksiyonun genişletilmiş hali (create or replace — 051'i ezer);
-- 051 uygulanmadan çalıştırılırsa da kendi kendine yeterlidir.
create or replace function public.profiles_protect_columns()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('focusai.server_write', true), '') <> 'on' then
    new.xp           := old.xp;
    new.week_start   := old.week_start;
    new.week_xp_base := old.week_xp_base;
    new.league       := old.league;
    new.plan         := old.plan;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_columns_trg on public.profiles;
create trigger profiles_protect_columns_trg
  before update on public.profiles
  for each row execute function public.profiles_protect_columns();
