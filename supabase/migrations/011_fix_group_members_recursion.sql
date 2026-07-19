-- ### 011_fix_group_members_recursion.sql
-- ============================================================
-- M2d: group_members RLS policy'lerindeki "infinite recursion"
-- (42P17) hatasını düzeltir.
--
-- Sebep: group_members_select/insert/update/delete policy'leri
-- "group_members" tablosunun kendisine EXISTS ile referans veriyordu.
-- Bu, sadece grup özelliklerini değil messages/groups/group_channels
-- gibi group_members'a değen TÜM policy zincirlerini de bozuyordu
-- (örn. DM mesajı gönderme bile 500 dönüyordu).
--
-- Çözüm: group_members'a bakan kontrolleri SECURITY DEFINER
-- fonksiyonlara taşımak — bu fonksiyonlar RLS'i atlayarak doğrudan
-- tabloyu okur, böylece policy kendi kendini tekrar tetiklemez.
-- ============================================================

create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_user_id
  );
$$;

create or replace function public.group_member_role(p_group_id uuid, p_user_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.group_members
  where group_id = p_group_id and user_id = p_user_id;
$$;

grant execute on function public.is_group_member(uuid, uuid) to authenticated;
grant execute on function public.group_member_role(uuid, uuid) to authenticated;

-- ============================================================
-- group_members policy'lerini yeniden yaz (self-reference olmadan)
-- ============================================================

drop policy "group_members_select" on public.group_members;
create policy "group_members_select" on public.group_members for select using (
  user_id = auth.uid()
  or exists (select 1 from public.groups g where g.id = group_members.group_id and g.privacy = 'public')
  or public.is_group_member(group_members.group_id, auth.uid())
);

drop policy "group_members_insert" on public.group_members;
create policy "group_members_insert" on public.group_members for insert with check (
  user_id = auth.uid()
  or public.group_member_role(group_members.group_id, auth.uid()) in ('admin', 'moderator')
);

drop policy "group_members_update" on public.group_members;
create policy "group_members_update" on public.group_members for update using (
  public.group_member_role(group_members.group_id, auth.uid()) = 'admin'
);

drop policy "group_members_delete" on public.group_members;
create policy "group_members_delete" on public.group_members for delete using (
  user_id = auth.uid()
  or public.group_member_role(group_members.group_id, auth.uid()) in ('admin', 'moderator')
);

-- ============================================================
-- messages.scope_type check constraint'ine 'group_subchannel' eksikti
-- (007_group_channels.sql bu scope_type için RLS policy ekledi ama
-- constraint güncellenmemişti — alt-kanala mesaj insert edilemezdi)
-- ============================================================
alter table public.messages drop constraint messages_scope_type_check;
alter table public.messages add constraint messages_scope_type_check
  check (scope_type in ('dm', 'group', 'group_channel', 'group_subchannel', 'focus_session'));
