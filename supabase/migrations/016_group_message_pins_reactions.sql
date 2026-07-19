-- ### 016_group_message_pins_reactions.sql
-- ============================================================
-- M2d: Grup kanallarında mesaj sabitleme ve tepki (reaction)
-- özellikleri çalışmıyordu çünkü:
--   - message_pins tablosu sadece DM (conversation_id) destekliyordu
--   - mesaj tepkileri için Supabase'de hiç tablo yoktu (Firebase'de
--     kalmıştı, Supabase grup/DM mesajlarına bağlanmıyordu)
-- ============================================================

-- ─── Ortak yetki kontrolü: kullanıcı bu scope'a (dm/group/...) erişebilir mi? ───
create or replace function public.can_access_scope(p_scope_type text, p_scope_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case p_scope_type
    when 'dm' then exists (
      select 1 from public.conversations c
      where c.id = p_scope_id and auth.uid() in (c.user_a, c.user_b)
    )
    when 'group' then exists (
      select 1 from public.group_members gm
      where gm.group_id = p_scope_id and gm.user_id = auth.uid()
    )
    when 'group_channel' then exists (
      select 1 from public.group_channels gc
      join public.group_members gm on gm.group_id = gc.group_id
      where gc.id = p_scope_id and gm.user_id = auth.uid()
    )
    when 'group_subchannel' then exists (
      select 1 from public.group_subchannels gs
      join public.group_channels gc on gc.id = gs.channel_id
      join public.group_members gm on gm.group_id = gc.group_id
      where gs.id = p_scope_id and gm.user_id = auth.uid()
    )
    else false
  end;
$$;

-- ─── message_pins: gruplara/kanallara genişlet ───
alter table public.message_pins alter column conversation_id drop not null;
alter table public.message_pins add column scope_type text;
alter table public.message_pins add column scope_id uuid;
alter table public.message_pins add constraint message_pins_scope_chk check (
  (conversation_id is not null and scope_type is null and scope_id is null)
  or (conversation_id is null and scope_type is not null and scope_id is not null)
);

drop policy if exists "message_pins_select" on public.message_pins;
drop policy if exists "message_pins_insert" on public.message_pins;
drop policy if exists "message_pins_delete" on public.message_pins;

create policy "message_pins_select" on public.message_pins for select using (
  (conversation_id is not null and exists (
    select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b)
  ))
  or (scope_type is not null and public.can_access_scope(scope_type, scope_id))
);

create policy "message_pins_insert" on public.message_pins for insert with check (
  pinned_by = auth.uid() and (
    (conversation_id is not null and exists (
      select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b)
    ))
    or (scope_type is not null and public.can_access_scope(scope_type, scope_id))
  )
);

create policy "message_pins_delete" on public.message_pins for delete using (
  (conversation_id is not null and exists (
    select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b)
  ))
  or (scope_type is not null and public.can_access_scope(scope_type, scope_id))
);

-- ─── message_reactions: mesajlara emoji tepkisi ───
create table public.message_reactions (
  message_id  uuid not null references public.messages(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  scope_type  text not null,
  scope_id    uuid not null,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index message_reactions_scope_idx on public.message_reactions (scope_type, scope_id);

alter table public.message_reactions enable row level security;
alter table public.message_reactions replica identity full;

create policy "message_reactions_select" on public.message_reactions for select using (
  public.can_access_scope(scope_type, scope_id)
);

create policy "message_reactions_insert" on public.message_reactions for insert with check (
  user_id = auth.uid()
  and public.can_access_scope(scope_type, scope_id)
  and exists (
    select 1 from public.messages m
    where m.id = message_id and m.scope_type = scope_type and m.scope_id = scope_id
  )
);

create policy "message_reactions_update" on public.message_reactions for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "message_reactions_delete" on public.message_reactions for delete
  using (user_id = auth.uid());

alter publication supabase_realtime add table public.message_reactions;
