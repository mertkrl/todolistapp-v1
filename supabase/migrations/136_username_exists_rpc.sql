-- Kayıt formunda (app-login-gate.js) kullanıcı adı seçilirken "bu kullanıcı
-- adı zaten alınmış mı?" sorusuna cevap vermek için eklendi. Kayıt anında
-- henüz oturum yok (anon), ve profiles tablosunun select politikası
-- ("profiles_select_authenticated") sadece giriş yapmış kullanıcılara izin
-- veriyor — bu yüzden email_exists RPC'siyle aynı desende SECURITY DEFINER
-- bir fonksiyonla SADECE boolean döndürülüyor.
create or replace function public.username_exists(check_username text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where lower(username) = lower(check_username)
  );
$$;

revoke all on function public.username_exists(text) from public;
grant execute on function public.username_exists(text) to anon, authenticated;
