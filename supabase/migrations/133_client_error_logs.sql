-- ### 133_client_error_logs.sql
-- =====================================================================
-- AMAÇ (Faz L — hata izleme):
--   Üretimde bir kullanıcının tarayıcısında JS hatası/yakalanmamış
--   promise reddi olduğunda bunu görebilecek hiçbir mekanizma yoktu
--   (inline-error-net.js sadece console.warn ile logluyordu — kimse
--   izlemiyor). Bu tablo, istemci tarafındaki hataların minimal bir
--   özetini (mesaj, stack, sayfa yolu) toplar ki Dashboard → Table
--   Editor'den periyodik bakılabilsin. Sentry gibi ücretli/harici bir
--   servise ihtiyaç duymadan, mevcut Supabase projesi üzerinden.
--
-- GÜVENLİK/GİZLİLİK TASARIMI:
--   - Sadece INSERT policy var, SELECT/UPDATE/DELETE yok — hiçbir
--     istemci (anon ya da authenticated) başka birinin ya da kendi
--     hata kaydını OKUYAMAZ/DEĞİŞTİREMEZ/SİLEMEZ. Kayıtlara sadece
--     proje sahibi Dashboard'dan (RLS'i bypass eden service role ile)
--     erişebilir.
--   - `with check (true)` burada BİLİNÇLİ bir istisna: bu bir telemetri
--     tablosu, "kimin hatası" önemli değil, herkesin hata
--     bildirebilmesi gerekiyor. supabase/rls_audit.sql bu satırı
--     "DİKKAT: koşulsuz true" olarak işaretleyecek — bu YANLIŞ ALARM,
--     policy'nin isminden (`_insert_anyone`) tanınabilir olsun diye
--     böyle adlandırıldı.
--   - Kullanıcı kimliği/e-postası TUTULMUYOR; sadece rastgele bir
--     session_id (tarayıcıda üretilen, kişiye bağlanamayan) var.
--   - Alan uzunlukları CHECK constraint'lerle sınırlı — bir istemcinin
--     devasa payload'larla tabloyu şişirmesi güçleştiriliyor
--     (tam rate-limit değil, ama ucuz bir sınır).
-- =====================================================================

create table if not exists public.client_error_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('error', 'unhandledrejection')),
  message text not null check (char_length(message) <= 2000),
  stack text check (stack is null or char_length(stack) <= 8000),
  page_path text check (page_path is null or char_length(page_path) <= 300),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  session_id text check (session_id is null or char_length(session_id) <= 64)
);

comment on table public.client_error_logs is
  'İstemci tarafı JS hataları (Faz L hata izleme). Sadece INSERT — bilinçli tasarım, bkz. dosya başındaki not.';

alter table public.client_error_logs enable row level security;

create policy "client_error_logs_insert_anyone"
  on public.client_error_logs
  for insert
  to anon, authenticated
  with check (true);

create index if not exists client_error_logs_created_at_idx
  on public.client_error_logs (created_at desc);
