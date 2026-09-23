-- ### 138_function_search_path_hardening.sql
-- Supabase Security Advisor uyarısı: "Function Search Path Mutable" —
-- touch_updated_at, update_updated_at, profiles_protect_columns,
-- duels_protect_columns fonksiyonlarının search_path'i sabitlenmemiş.
--
-- RİSK: search_path sabitlenmemiş bir fonksiyon, çağrıldığı oturumun o
-- anki search_path ayarına göre "public.foo()" gibi şema-nitelenmemiş
-- adları çözer. Bir saldırgan (ör. bir trigger'ı tetikleyen bir INSERT/
-- UPDATE üzerinden) search_path'i değiştirip kendi şemasında aynı isimde
-- kötü niyetli bir fonksiyon/tablo tanımlarsa, bu trigger fonksiyonları
-- o sahte tanımı çağırabilir. Bu fonksiyonlar zaten sadece pg_catalog'un
-- yerleşik fonksiyonlarını (now(), coalesce(), current_setting()) ve NEW/OLD
-- kayıt alanlarını kullanıyor — davranışları DEĞİŞMİYOR, sadece hangi
-- şemadan ad çözümleneceği artık sabit.
--
-- ALTER FUNCTION ... SET search_path yalnızca fonksiyonun metadata'sını
-- günceller, gövdesini yeniden tanımlamaya gerek yok.
alter function public.touch_updated_at()          set search_path = public, pg_temp;
alter function public.profiles_protect_columns()   set search_path = public, pg_temp;
alter function public.duels_protect_columns()      set search_path = public, pg_temp;

-- update_updated_at() migration geçmişinde bulunamadı (muhtemelen Supabase
-- SQL Editor'den elle oluşturulmuş, repo'ya migration olarak düşmemiş).
-- İmzası touch_updated_at() ile aynı desende (parametresiz trigger
-- fonksiyonu) varsayılıyor — eğer gerçek imza farklıysa (ör. parametre
-- alıyorsa) bu satır "function does not exist" hatasıyla başarısız olur,
-- diğer üç ALTER FUNCTION satırını etkilemez.
alter function public.update_updated_at()          set search_path = public, pg_temp;
