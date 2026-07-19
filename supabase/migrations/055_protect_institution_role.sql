-- ### 055_protect_institution_role.sql
-- Freemium sohbet kapısı açığı (2026-07-03):
--
-- dcChatEnabled() sohbeti premium plana VEYA kurumsal role (student/teacher)
-- açıyor. Ancak kayıt modalında herkes kendi rolünü "öğrenci/öğretmen" olarak
-- seçebiliyordu ve institution_role kolonu sunucuda korunmuyordu — yani
-- ücretsiz bir kullanıcı hem arayüzden hem de doğrudan bir profiles UPDATE
-- isteğiyle kendine kurumsal rol atayıp sohbeti (ve 100 üyelik kurumsal grup
-- kapasitelerini) bedavaya açabiliyordu.
--
-- Bu migration:
--   1. Kendi kendine atanmış tüm student/teacher rollerini 'member'a çeker
--      (bugüne kadar rol atamanın TEK yolu kayıt ekranındaki serbest seçimdi;
--      gerçek kurum rolleri gerekiyorsa aşağıdaki örnekle SQL'den yeniden verilir).
--   2. institution_role'ü korumalı kolonlara ekler: istemci değiştiremez,
--      yalnızca focusai.server_write='on' bağlamındaki sunucu kodu / SQL yazabilir.
--
-- Rolü elle atamak için (service role / SQL editöründen):
--   select set_config('focusai.server_write', 'on', true);
--   update public.profiles set institution_role = 'teacher' where username = '...';

-- 1) Mevcut kendi kendine atanmış roller sıfırlanır.
--    (053'teki trigger institution_role'ü henüz korumadığı için bu UPDATE,
--     fonksiyon aşağıda değiştirilmeden ÖNCE sorunsuz çalışır.)
update public.profiles
   set institution_role = 'member'
 where institution_role in ('student', 'teacher');

-- 2) institution_role korumalı kolonlara eklenir.
--    053'teki fonksiyonun genişletilmiş hali (create or replace — 053'ü ezer).
create or replace function public.profiles_protect_columns()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('focusai.server_write', true), '') <> 'on' then
    new.xp               := old.xp;
    new.week_start       := old.week_start;
    new.week_xp_base     := old.week_xp_base;
    new.league           := old.league;
    new.plan             := old.plan;
    new.institution_role := old.institution_role;
  end if;
  return new;
end;
$$;
