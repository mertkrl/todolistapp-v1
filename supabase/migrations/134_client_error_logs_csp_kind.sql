-- ### 134_client_error_logs_csp_kind.sql
-- =====================================================================
-- AMAÇ (Faz: tam sistem denetimi — güvenlik/performans turu):
--   inline-error-net.js'e CSP ihlali otomatik tespiti eklendi
--   (document.addEventListener('securitypolicyviolation', ...)) — özellikle
--   index.html'deki style-src'de kullanılan 'unsafe-hashes' direktifinin
--   GERÇEK kullanıcı tarayıcılarında (özellikle eski Safari) desteklenip
--   desteklenmediğini konsolu izlemeden görebilmek için. Bu event yeni bir
--   kind='csp_violation' değeriyle client_error_logs'a rapor ediliyor —
--   ama 133_client_error_logs.sql'deki CHECK constraint sadece
--   ('error', 'unhandledrejection') kabul ediyordu, 'csp_violation' sessizce
--   REDDEDİLİRDİ (INSERT hatası, fetch().catch() ile yutulur, hiç fark
--   edilmez). Bu migration sadece izin verilen kind listesini genişletiyor,
--   başka hiçbir şey değişmiyor.
-- =====================================================================

alter table public.client_error_logs drop constraint if exists client_error_logs_kind_check;

alter table public.client_error_logs
  add constraint client_error_logs_kind_check
  check (kind in ('error', 'unhandledrejection', 'csp_violation'));
