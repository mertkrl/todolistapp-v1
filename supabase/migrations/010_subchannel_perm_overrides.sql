-- ### 010_subchannel_perm_overrides.sql
-- ============================================================
-- M2b-4 Bölüm 2c: Alt-kanal bazlı izin istisnaları (permOverrides)
-- ============================================================

alter table public.group_subchannels add column perm_overrides jsonb not null default '{}'::jsonb;

-- Kilitli alt-kanala mesaj gönderme: admin VEYA bu oda için
-- perm_overrides[rol].lockRooms = true olan roller de yazabilir
drop policy "messages_groupsubchannel_insert" on public.messages;
create policy "messages_groupsubchannel_insert" on public.messages for insert with check (
  scope_type = 'group_subchannel' and sender_id = auth.uid() and exists (
    select 1 from public.group_subchannels gs
    join public.group_channels gc on gc.id = gs.channel_id
    join public.group_members gm on gm.group_id = gc.group_id
    where gs.id = messages.scope_id and gm.user_id = auth.uid()
      and (
        gs.locked = false
        or gm.role = 'admin'
        or coalesce((gs.perm_overrides -> coalesce(gm.role, 'member') ->> 'lockRooms')::boolean, false)
      )
  )
);
