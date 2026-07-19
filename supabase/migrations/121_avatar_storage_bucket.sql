-- ### 121_avatar_storage_bucket.sql
-- ============================================================
-- profiles.custom_avatar artık ham base64 data-URL DEĞİL, bu bucket'a
-- yüklenen küçültülmüş görselin public URL'i olacak (bkz. social.js
-- _resizeImageToBlob + setup-avatar kaydet akışı). Amaç: her toplu
-- .select(custom_avatar) sorgusunun (leaderboard, grup/sınıf üye
-- listeleri vb.) tam boyutlu görseli DB'den yeniden çekmesini önlemek —
-- egress kotasını (free tier 5GB/ay) gereksiz yere tüketiyordu.
--
-- chat-files bucket'ından (042_chat_storage_bucket.sql) farkı: bu bucket
-- PUBLIC — avatar sık/anlık render edildiği için her okumada signed URL
-- yeniden imzalamaya gerek yok, sabit public URL doğrudan kullanılabilir.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  1048576,   -- 1 MB (istemci tarafı küçültme sonrası bolca yeterli)
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

-- Kullanıcı sadece kendi klasörüne (path: {userId}/avatar.jpg) yükleyebilir/güncelleyebilir
create policy "avatars_upload_own"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatars_update_own"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Public bucket zaten anonim okumaya izin verir; tutarlılık için açık policy
create policy "avatars_select_public"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "avatars_delete_own"
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
