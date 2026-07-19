-- ### 041_chat_phase1.sql
-- ============================================================
-- FAZ 1: Gelişmiş Sohbet Sistemi — Chat Phase 1
-- 1. Kurumsal Rol Sistemi (teacher/student)
-- 2. Duyuru Kanalı (is_announcement)
-- 3. Dosya Eki Desteği (attachments)
-- 4. Full-Text Search Index
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. PROFİL: Kurumsal Rol (institution_role)
-- ────────────────────────────────────────────────────────────
-- Kullanıcının genel platform rolü: admin/teacher/student/member
-- NOT: group_members.role (admin/moderator/member) grup-içi rol,
--      bu sütun kullanıcının platform genelindeki kurumsal rolüdür.
alter table public.profiles
  add column if not exists institution_role text not null default 'member'
    check (institution_role in ('admin', 'teacher', 'student', 'member'));

-- Öğretmen/öğrenci rozeti için index
create index if not exists profiles_institution_role_idx on public.profiles (institution_role);

-- ────────────────────────────────────────────────────────────
-- 2. ALT-KANAL: Duyuru Kanalı Tipi (is_announcement)
-- ────────────────────────────────────────────────────────────
-- Duyuru kanallarına sadece grup adminleri VEYA teacher rolündekiler mesaj yazabilir
alter table public.group_subchannels
  add column if not exists is_announcement boolean not null default false;

-- Mevcut group_subchannel mesaj ekleme politikasını duyuru kontrolü ile güncelle
drop policy if exists "messages_groupsubchannel_insert" on public.messages;
create policy "messages_groupsubchannel_insert" on public.messages for insert with check (
  scope_type = 'group_subchannel' and sender_id = auth.uid() and exists (
    select 1 from public.group_subchannels gs
    join public.group_channels gc on gc.id = gs.channel_id
    join public.group_members gm on gm.group_id = gc.group_id
    join public.profiles p on p.id = auth.uid()
    where gs.id = messages.scope_id and gm.user_id = auth.uid()
      and (
        -- Kilitli oda kontrolü
        (gs.locked = false
          or gm.role = 'admin'
          or coalesce((gs.perm_overrides -> coalesce(gm.role, 'member') ->> 'lockRooms')::boolean, false)
        )
        -- Duyuru kanalı kontrolü: sadece grup admini veya platform öğretmeni yazabilir
        and (
          gs.is_announcement = false
          or gm.role = 'admin'
          or p.institution_role = 'teacher'
          or p.institution_role = 'admin'
        )
      )
  )
);

-- ────────────────────────────────────────────────────────────
-- 3. MESAJLAR: Dosya Eki (attachments)
-- ────────────────────────────────────────────────────────────
-- Attachments JSONB şeması:
-- [{ url, name, size, type, bucket_path }]
alter table public.messages
  add column if not exists attachments jsonb;

-- Ekli mesajları bulmak için index
create index if not exists messages_attachments_idx on public.messages
  using gin(attachments)
  where attachments is not null;

-- ────────────────────────────────────────────────────────────
-- 4. MESAJLAR: Full-Text Search (FTS)
-- ────────────────────────────────────────────────────────────
-- Türkçe destek için 'simple' config kullanıyoruz (turkish yoksa)
-- Metin araması için GIN index — büyük gruplarda hız kritik
create index if not exists messages_text_fts_idx on public.messages
  using gin(to_tsvector('simple', coalesce(text, '')));

-- Scope bazlı arama için composite index
create index if not exists messages_scope_created_idx on public.messages
  (scope_type, scope_id, created_at desc)
  where text is not null;

-- ────────────────────────────────────────────────────────────
-- 5. SUPABASE STORAGE: chat-files bucket
-- ────────────────────────────────────────────────────────────
-- NOT: Bucket oluşturma Supabase Dashboard > Storage'dan yapılmalı.
-- Bucket adı: 'chat-files'
-- Public: false (signed URL kullan)
-- Aşağıdaki policy SQL Editor'da bucket oluşturduktan SONRA çalıştır:

-- insert into storage.buckets (id, name, public) values ('chat-files', 'chat-files', false)
-- on conflict (id) do nothing;

-- create policy "chat_files_upload" on storage.objects for insert
--   with check (bucket_id = 'chat-files' and auth.uid() is not null);

-- create policy "chat_files_select" on storage.objects for select
--   using (bucket_id = 'chat-files' and auth.uid() is not null);

-- create policy "chat_files_delete" on storage.objects for delete
--   using (bucket_id = 'chat-files' and owner = auth.uid());

-- ────────────────────────────────────────────────────────────
-- 6. GÜVENLİK: group_members teacher/student RLS
-- ────────────────────────────────────────────────────────────
-- Öğretmenler grup yöneticisi olmasa da duyuru kanalı yazabilmeli —
-- bu yukarıdaki messages_groupsubchannel_insert policy'sinde ele alındı.
-- Ek olarak group_members.role'u teacher'a çıkarma için yardımcı fonksiyon:

create or replace function public.get_user_institution_role(p_user_id uuid)
returns text
language sql stable security definer
set search_path = public
as $$
  select institution_role from public.profiles where id = p_user_id;
$$;

-- ────────────────────────────────────────────────────────────
-- 7. REALTIME: Yeni sütunların canlı güncellemelerde gözükmesi
-- ────────────────────────────────────────────────────────────
-- group_subchannels zaten realtime'da — is_announcement değişince
-- renderSupabaseChannelGroup yeniden render edilecek (mevcut listener)

-- ════════════════════════════════════════════════════════════
-- ÖZET:
-- profiles.institution_role  → 'member' | 'student' | 'teacher' | 'admin'
-- group_subchannels.is_announcement → duyuru kanalı kilidi
-- messages.attachments → [{ url, name, size, type, bucket_path }]
-- messages_text_fts_idx → Supabase FTS araması için GIN index
-- ════════════════════════════════════════════════════════════
