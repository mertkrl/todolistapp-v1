-- ### 046_channel_type.sql
-- ============================================================
-- Kanal Tipi: channel_type kolonu
-- is_announcement boolean'ı tam enum'a yükselt
-- ============================================================

alter table public.group_subchannels
  add column if not exists channel_type text not null default 'chat'
    check (channel_type in ('chat', 'announcement'));

-- Mevcut is_announcement = true olanları 'announcement' tipine taşı
update public.group_subchannels
  set channel_type = 'announcement'
  where is_announcement = true and channel_type = 'chat';

-- Mesaj insert RLS'ini channel_type ile güncelle
drop policy if exists "messages_groupsubchannel_insert" on public.messages;
create policy "messages_groupsubchannel_insert" on public.messages for insert with check (
  scope_type = 'group_subchannel' and sender_id = auth.uid() and exists (
    select 1 from public.group_subchannels gs
    join public.group_channels gc on gc.id = gs.channel_id
    join public.group_members gm on gm.group_id = gc.group_id
    join public.profiles p on p.id = auth.uid()
    where gs.id = messages.scope_id and gm.user_id = auth.uid()
      and (
        gs.locked = false
          or gm.role = 'admin'
          or coalesce((gs.perm_overrides -> coalesce(gm.role, 'member') ->> 'lockRooms')::boolean, false)
      )
      and (
        gs.channel_type != 'announcement'
          or gm.role = 'admin'
          or p.institution_role = 'teacher'
          or p.institution_role = 'admin'
      )
  )
);
