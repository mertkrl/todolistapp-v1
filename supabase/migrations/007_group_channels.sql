-- ### 007_group_channels.sql
-- ============================================================
-- M2b-3 Bölüm 2: Çoklu kanal / alt-kanal ağacı — group_channels,
-- group_subchannels + messages RLS (scope_type='group_channel'/'group_subchannel')
-- ============================================================

-- group_channels: kategori (eski groups/{code}/channels/{channelId})
create table public.group_channels (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  name        text not null,
  position    integer not null default 0,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now()
);

create index group_channels_group_idx on public.group_channels (group_id);

alter table public.group_channels enable row level security;

create policy "group_channels_select" on public.group_channels for select using (
  exists (select 1 from public.group_members gm where gm.group_id = group_channels.group_id and gm.user_id = auth.uid())
);

create policy "group_channels_insert" on public.group_channels for insert with check (
  exists (select 1 from public.group_members gm where gm.group_id = group_channels.group_id and gm.user_id = auth.uid() and gm.role = 'admin')
);

create policy "group_channels_update" on public.group_channels for update using (
  exists (select 1 from public.group_members gm where gm.group_id = group_channels.group_id and gm.user_id = auth.uid() and gm.role = 'admin')
);

create policy "group_channels_delete" on public.group_channels for delete using (
  exists (select 1 from public.group_members gm where gm.group_id = group_channels.group_id and gm.user_id = auth.uid() and gm.role = 'admin')
);

-- group_subchannels: alt-kanal/oda (eski .../subChannels/{subId})
create table public.group_subchannels (
  id          uuid primary key default gen_random_uuid(),
  channel_id  uuid not null references public.group_channels(id) on delete cascade,
  name        text not null,
  locked      boolean not null default false,
  position    integer not null default 0,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now()
);

create index group_subchannels_channel_idx on public.group_subchannels (channel_id);

alter table public.group_subchannels enable row level security;

create policy "group_subchannels_select" on public.group_subchannels for select using (
  exists (
    select 1 from public.group_channels gc join public.group_members gm on gm.group_id = gc.group_id
    where gc.id = group_subchannels.channel_id and gm.user_id = auth.uid()
  )
);

create policy "group_subchannels_insert" on public.group_subchannels for insert with check (
  exists (
    select 1 from public.group_channels gc join public.group_members gm on gm.group_id = gc.group_id
    where gc.id = group_subchannels.channel_id and gm.user_id = auth.uid() and gm.role = 'admin'
  )
);

create policy "group_subchannels_update" on public.group_subchannels for update using (
  exists (
    select 1 from public.group_channels gc join public.group_members gm on gm.group_id = gc.group_id
    where gc.id = group_subchannels.channel_id and gm.user_id = auth.uid() and gm.role = 'admin'
  )
);

create policy "group_subchannels_delete" on public.group_subchannels for delete using (
  exists (
    select 1 from public.group_channels gc join public.group_members gm on gm.group_id = gc.group_id
    where gc.id = group_subchannels.channel_id and gm.user_id = auth.uid() and gm.role = 'admin'
  )
);

-- ============================================================
-- messages: scope_type='group_channel' — kategorinin "genel" alt-sohbeti
-- (scope_id = group_channels.id)
-- ============================================================

create policy "messages_groupchannel_select" on public.messages for select using (
  scope_type = 'group_channel' and exists (
    select 1 from public.group_channels gc join public.group_members gm on gm.group_id = gc.group_id
    where gc.id = messages.scope_id and gm.user_id = auth.uid()
  )
);

create policy "messages_groupchannel_insert" on public.messages for insert with check (
  scope_type = 'group_channel' and sender_id = auth.uid() and exists (
    select 1 from public.group_channels gc join public.group_members gm on gm.group_id = gc.group_id
    where gc.id = messages.scope_id and gm.user_id = auth.uid()
  )
);

create policy "messages_groupchannel_update" on public.messages for update using (
  scope_type = 'group_channel' and sender_id = auth.uid()
);

create policy "messages_groupchannel_delete" on public.messages for delete using (
  scope_type = 'group_channel' and sender_id = auth.uid()
);

-- ============================================================
-- messages: scope_type='group_subchannel' (scope_id = group_subchannels.id)
-- kilitli odaya admin haricinde mesaj gönderilemez
-- ============================================================

create policy "messages_groupsubchannel_select" on public.messages for select using (
  scope_type = 'group_subchannel' and exists (
    select 1 from public.group_subchannels gs
    join public.group_channels gc on gc.id = gs.channel_id
    join public.group_members gm on gm.group_id = gc.group_id
    where gs.id = messages.scope_id and gm.user_id = auth.uid()
  )
);

create policy "messages_groupsubchannel_insert" on public.messages for insert with check (
  scope_type = 'group_subchannel' and sender_id = auth.uid() and exists (
    select 1 from public.group_subchannels gs
    join public.group_channels gc on gc.id = gs.channel_id
    join public.group_members gm on gm.group_id = gc.group_id
    where gs.id = messages.scope_id and gm.user_id = auth.uid()
      and (gs.locked = false or gm.role = 'admin')
  )
);

create policy "messages_groupsubchannel_update" on public.messages for update using (
  scope_type = 'group_subchannel' and sender_id = auth.uid()
);

create policy "messages_groupsubchannel_delete" on public.messages for delete using (
  scope_type = 'group_subchannel' and sender_id = auth.uid()
);

-- ============================================================
-- Realtime: kanal ağacı canlı güncellensin
-- ============================================================
alter publication supabase_realtime add table public.group_channels;
alter publication supabase_realtime add table public.group_subchannels;
