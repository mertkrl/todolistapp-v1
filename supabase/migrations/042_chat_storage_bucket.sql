-- ### 042_chat_storage_bucket.sql
-- ============================================================
-- FAZ 1 EK: Dosya Paylaşımı — Storage Bucket + Policy
-- Supabase Dashboard > SQL Editor'da çalıştır
-- ============================================================

-- Bucket oluştur (zaten varsa atla)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-files',
  'chat-files',
  false,
  15728640,   -- 15 MB
  array[
    'image/jpeg','image/png','image/gif','image/webp','image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/zip'
  ]
)
on conflict (id) do nothing;

-- Giriş yapmış kullanıcılar dosya yükleyebilir
create policy "chat_files_upload"
on storage.objects for insert
with check (
  bucket_id = 'chat-files'
  and auth.uid() is not null
);

-- Giriş yapmış kullanıcılar dosyaları görebilir
create policy "chat_files_select"
on storage.objects for select
using (
  bucket_id = 'chat-files'
  and auth.uid() is not null
);

-- Sadece dosyayı yükleyen kullanıcı silebilir
create policy "chat_files_delete"
on storage.objects for delete
using (
  bucket_id = 'chat-files'
  and owner = auth.uid()
);
