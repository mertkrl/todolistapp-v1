-- ### 129_chat_files_scoped_rls.sql
-- =====================================================================
-- chat-files bucket'ının select/insert policy'leri sadece "giriş yapmış
-- olmak" kontrol ediyordu (bkz. 042_chat_storage_bucket.sql) — path'i
-- bilen/tahmin eden HERHANGİ bir giriş yapmış kullanıcı grup dosyalarını
-- okuyabilir/yazabilirdi. Path yapısı `${scopeType}/${scopeId}/dosya`
-- (bkz. social-chat-extras.js uploadChatFile, scopeType her zaman
-- 'group' | 'group_channel' | 'group_subchannel' — DM dosya paylaşımı
-- yok). Bu politika artık gerçek grup üyeliğini doğruluyor.
-- =====================================================================

drop policy if exists "chat_files_select" on storage.objects;
drop policy if exists "chat_files_upload" on storage.objects;

create policy "chat_files_select_scoped"
on storage.objects for select
using (
  bucket_id = 'chat-files'
  and auth.uid() is not null
  and (
    (
      (storage.foldername(storage.objects.name))[1] = 'group'
      and exists (
        select 1 from public.group_members gm
        where gm.group_id = ((storage.foldername(storage.objects.name))[2])::uuid
          and gm.user_id = auth.uid()
      )
    )
    or (
      (storage.foldername(storage.objects.name))[1] = 'group_channel'
      and exists (
        select 1 from public.group_channels gc
        join public.group_members gm on gm.group_id = gc.group_id
        where gc.id = ((storage.foldername(storage.objects.name))[2])::uuid
          and gm.user_id = auth.uid()
      )
    )
    or (
      (storage.foldername(storage.objects.name))[1] = 'group_subchannel'
      and exists (
        select 1 from public.group_subchannels gs
        join public.group_channels gc on gc.id = gs.channel_id
        join public.group_members gm on gm.group_id = gc.group_id
        where gs.id = ((storage.foldername(storage.objects.name))[2])::uuid
          and gm.user_id = auth.uid()
      )
    )
    -- assignment/assignment-submission path'leri (social-institution-panel.js) bu
    -- şemaya uymuyor — mevcut davranışı KIRMAMAK için eskisi gibi sadece
    -- auth.uid() is not null yeterli sayılır.
    or (storage.foldername(storage.objects.name))[1] in ('assignment', 'assignment-submission')
  )
);

create policy "chat_files_upload_scoped"
on storage.objects for insert
with check (
  bucket_id = 'chat-files'
  and auth.uid() is not null
  and (
    (
      (storage.foldername(storage.objects.name))[1] = 'group'
      and exists (
        select 1 from public.group_members gm
        where gm.group_id = ((storage.foldername(storage.objects.name))[2])::uuid
          and gm.user_id = auth.uid()
      )
    )
    or (
      (storage.foldername(storage.objects.name))[1] = 'group_channel'
      and exists (
        select 1 from public.group_channels gc
        join public.group_members gm on gm.group_id = gc.group_id
        where gc.id = ((storage.foldername(storage.objects.name))[2])::uuid
          and gm.user_id = auth.uid()
      )
    )
    or (
      (storage.foldername(storage.objects.name))[1] = 'group_subchannel'
      and exists (
        select 1 from public.group_subchannels gs
        join public.group_channels gc on gc.id = gs.channel_id
        join public.group_members gm on gm.group_id = gc.group_id
        where gs.id = ((storage.foldername(storage.objects.name))[2])::uuid
          and gm.user_id = auth.uid()
      )
    )
    or (storage.foldername(storage.objects.name))[1] in ('assignment', 'assignment-submission')
  )
);
