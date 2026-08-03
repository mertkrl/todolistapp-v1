-- ### rls_audit.sql — RLS (Row Level Security) denetim scripti
--
-- Bu bir migration DEĞİLDİR ve hiçbir şeyi değiştirmez (salt-okunur).
-- Supabase Dashboard → SQL Editor'e yapıştırıp çalıştır, ya da:
--   supabase db execute -f supabase/rls_audit.sql
--
-- Neden gerekli: migration dosyaları (132 adet) zaman içinde tablo
-- ekleyip RLS açıp policy yazıyor, ama hiçbiri "şu an production'da
-- gerçekten RLS açık mı / policy'ler doğru mu" sorusuna kesin cevap
-- vermiyor — bunu sadece canlı veritabanı kataloğu (pg_catalog) bilir.
-- Bu script migration geçmişini değil, VERİTABANININ ŞU ANKİ HALİNİ
-- sorgular. Düzenli aralıklarla (her migration sonrası, deploy öncesi)
-- çalıştırılması önerilir.
--
-- Çıktıyı okuma sırası: "durum" sütununda KRİTİK > DİKKAT > UYARI > BİLGİ
-- > OK sırasına göre en tehlikeliden en zararsıza sıralanır (sorgu zaten
-- bu sırayla döner). KRİTİK satır varsa önce onu düzelt.

-- ─────────────────────────────────────────────────────────
-- 1) Ana tablo: her public şema tablosu için RLS durumu + policy sayımı
-- ─────────────────────────────────────────────────────────
with base_tables as (
  select
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced_for_owner
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'          -- sadece normal tablolar (view/matview değil)
),
policy_counts as (
  select
    tablename as table_name,
    count(*) filter (where cmd = 'SELECT') as select_policies,
    count(*) filter (where cmd = 'INSERT') as insert_policies,
    count(*) filter (where cmd = 'UPDATE') as update_policies,
    count(*) filter (where cmd = 'DELETE') as delete_policies,
    count(*) filter (where cmd = 'ALL')    as catch_all_policies,
    count(*)                                as total_policies,
    count(*) filter (
      where btrim(coalesce(qual, ''))       = 'true'
         or btrim(coalesce(with_check, '')) = 'true'
    ) as unconditional_true_policies,
    count(*) filter (where roles::text like '%public%') as public_role_policies
  from pg_policies
  where schemaname = 'public'
  group by tablename
)
select
  bt.table_name,
  bt.rls_enabled,
  bt.rls_forced_for_owner,
  coalesce(pc.total_policies, 0)               as total_policies,
  coalesce(pc.select_policies, 0)               as "select",
  coalesce(pc.insert_policies, 0)               as insert,
  coalesce(pc.update_policies, 0)               as update,
  coalesce(pc.delete_policies, 0)               as delete,
  coalesce(pc.catch_all_policies, 0)            as catch_all,
  coalesce(pc.unconditional_true_policies, 0)   as unconditional_true,
  coalesce(pc.public_role_policies, 0)          as public_role_policies,
  case
    when not bt.rls_enabled then
      'KRİTİK: RLS KAPALI — tablo herhangi bir anon/authenticated istemciden tamamen açık'
    when coalesce(pc.unconditional_true_policies, 0) > 0 then
      'DİKKAT: en az bir policy koşulsuz true — auth.uid() / sahiplik kontrolü olmayabilir, USING/WITH CHECK ifadesini elle incele'
    when coalesce(pc.total_policies, 0) = 0 then
      'UYARI: RLS açık ama hiç policy yok — varsayılan olarak TÜM erişim reddedilir (fonksiyonel kırılma olabilir, güvenlik açığı değil)'
    when coalesce(pc.update_policies, 0) = 0 and coalesce(pc.catch_all_policies, 0) = 0 then
      'BİLGİ: bu tabloda UPDATE policy yok — kasıtlıysa (immutable/log tablosu) sorun değil, değilse eksik'
    when coalesce(pc.delete_policies, 0) = 0 and coalesce(pc.catch_all_policies, 0) = 0 then
      'BİLGİ: bu tabloda DELETE policy yok — kasıtlıysa sorun değil, değilse eksik'
    else 'OK'
  end as durum
from base_tables bt
left join policy_counts pc on pc.table_name = bt.table_name
order by
  case
    when not bt.rls_enabled then 0
    when coalesce(pc.unconditional_true_policies, 0) > 0 then 1
    when coalesce(pc.total_policies, 0) = 0 then 2
    when coalesce(pc.update_policies, 0) = 0 and coalesce(pc.catch_all_policies, 0) = 0 then 3
    when coalesce(pc.delete_policies, 0) = 0 and coalesce(pc.catch_all_policies, 0) = 0 then 3
    else 4
  end,
  bt.table_name;

-- ─────────────────────────────────────────────────────────
-- 2) Koşulsuz (true) ya da public role'e açık policy'lerin tam metni
--    — yukarıdaki tabloda "DİKKAT" görürsen bu USING/WITH CHECK
--    ifadelerini oku, gerçekten auth.uid() kontrolü var mı bak.
-- ─────────────────────────────────────────────────────────
select
  tablename    as table_name,
  policyname   as policy_name,
  cmd          as command,
  roles::text  as roles,
  qual         as using_expression,
  with_check   as with_check_expression
from pg_policies
where schemaname = 'public'
  and (
    btrim(coalesce(qual, ''))       = 'true'
    or btrim(coalesce(with_check, '')) = 'true'
    or roles::text like '%public%'
  )
order by tablename, policyname;

-- ─────────────────────────────────────────────────────────
-- 3) storage.objects (avatar/dosya yüklemeleri kullanılıyorsa) — bucket
--    bazlı policy kontrolü. Proje şu an avatar için ui-avatars.com (harici
--    servis) kullanıyor gibi görünüyor; storage bucket'ı varsa bu bölüm
--    onları da denetler, yoksa boş döner.
-- ─────────────────────────────────────────────────────────
select
  b.id as bucket_id,
  b.public as bucket_is_public,
  count(p.policyname) as policy_count
from storage.buckets b
left join pg_policies p
  on p.schemaname = 'storage' and p.tablename = 'objects'
group by b.id, b.public
order by b.id;

-- ─────────────────────────────────────────────────────────
-- 4) Özet sayaçlar — tek satırda genel sağlık durumu
-- ─────────────────────────────────────────────────────────
with base_tables as (
  select c.relname as table_name, c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
policy_counts as (
  select tablename as table_name, count(*) as total_policies
  from pg_policies where schemaname = 'public'
  group by tablename
)
select
  count(*) as toplam_tablo,
  count(*) filter (where not bt.rls_enabled) as rls_kapali_tablo,
  count(*) filter (where bt.rls_enabled and coalesce(pc.total_policies, 0) = 0) as policy_suz_tablo,
  count(*) filter (where bt.rls_enabled and coalesce(pc.total_policies, 0) > 0) as saglikli_tablo
from base_tables bt
left join policy_counts pc on pc.table_name = bt.table_name;
