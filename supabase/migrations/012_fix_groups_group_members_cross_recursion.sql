-- ### 012_fix_groups_group_members_cross_recursion.sql
-- ============================================================
-- M2d: groups <-> group_members arasındaki ÇAPRAZ RLS döngüsünü
-- (42P17) düzeltir.
--
-- 011'de group_members'in kendi kendine referansı düzeltildi, ama
-- group_members_select policy'si HALA "groups" tablosuna bakıyordu
-- (privacy='public' kontrolü için), ve groups_select policy'si de
-- "group_members"a bakıyor -> ikisi birbirini sonsuz çağırıyordu.
--
-- Çözüm: groups.privacy='public' kontrolünü de SECURITY DEFINER bir
-- fonksiyona taşı (RLS'i atlar, döngüyü kırar).
-- ============================================================

create or replace function public.is_group_public(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select privacy = 'public' from public.groups where id = p_group_id), false);
$$;

grant execute on function public.is_group_public(uuid) to authenticated;

drop policy "group_members_select" on public.group_members;
create policy "group_members_select" on public.group_members for select using (
  user_id = auth.uid()
  or public.is_group_public(group_members.group_id)
  or public.is_group_member(group_members.group_id, auth.uid())
);
