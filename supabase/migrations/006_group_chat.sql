-- ### 006_group_chat.sql
-- ============================================================
-- M2b-3 Bölüm 1: Grup sohbeti ("genel" kanal) — messages RLS
-- ============================================================
-- messages tablosu (003_social_messaging.sql) scope_type='group' değerini
-- zaten kabul ediyor; bu migration sadece o scope için RLS policy ekler.

create policy "messages_group_select" on public.messages for select using (
  scope_type = 'group' and exists (
    select 1 from public.group_members gm
    where gm.group_id = messages.scope_id and gm.user_id = auth.uid()
  )
);

create policy "messages_group_insert" on public.messages for insert with check (
  scope_type = 'group' and sender_id = auth.uid() and exists (
    select 1 from public.group_members gm
    where gm.group_id = messages.scope_id and gm.user_id = auth.uid()
  )
);

create policy "messages_group_update" on public.messages for update using (
  scope_type = 'group' and sender_id = auth.uid()
);

create policy "messages_group_delete" on public.messages for delete using (
  scope_type = 'group' and sender_id = auth.uid()
);
