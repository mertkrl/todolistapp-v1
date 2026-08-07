-- Uygulama giriş kapısının (app-login-gate.js) e-posta adımından hemen sonra
-- "bu e-posta kayıtlı mı?" sorusuna cevap vermek için eklendi. auth.users
-- tablosu anon key ile doğrudan sorgulanamıyor (Supabase güvenlik kısıtı),
-- bu yüzden SECURITY DEFINER bir fonksiyonla SADECE boolean döndürülüyor —
-- başka hiçbir kullanıcı verisi (id, oluşturulma tarihi, vb.) sızdırılmıyor.
create or replace function public.email_exists(check_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users
    where lower(email) = lower(check_email)
  );
$$;

revoke all on function public.email_exists(text) from public;
grant execute on function public.email_exists(text) to anon, authenticated;
