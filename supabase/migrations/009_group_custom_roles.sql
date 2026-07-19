-- ### 009_group_custom_roles.sql
-- ============================================================
-- M2b-4 Bölüm 2a: Özel roller + Moderatör izin override'ları
-- ============================================================

-- groups.builtin_role_overrides: eski groups/{id}/builtinRoleOverrides
-- şekil: { moderator: { manageRooms, kickMembers, lockRooms, assignRoles } }
alter table public.groups add column if not exists builtin_role_overrides jsonb;

-- ============================================================
-- group_custom_roles: eski groups/{id}/customRoles/{roleId}
-- ============================================================
create table public.group_custom_roles (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups(id) on delete cascade,
  name         text not null,
  color        text not null default '6c5ce7',
  manage_rooms boolean not null default false,
  kick_members boolean not null default false,
  lock_rooms   boolean not null default false,
  assign_roles boolean not null default false,
  priority     integer not null default 100,
  created_at   timestamptz not null default now()
);

create index group_custom_roles_group_idx on public.group_custom_roles (group_id);

alter table public.group_custom_roles enable row level security;

create policy "group_custom_roles_select" on public.group_custom_roles for select using (
  exists (select 1 from public.group_members gm where gm.group_id = group_custom_roles.group_id and gm.user_id = auth.uid())
);

create policy "group_custom_roles_insert" on public.group_custom_roles for insert with check (
  exists (select 1 from public.group_members gm where gm.group_id = group_custom_roles.group_id and gm.user_id = auth.uid() and gm.role = 'admin')
);

create policy "group_custom_roles_update" on public.group_custom_roles for update using (
  exists (select 1 from public.group_members gm where gm.group_id = group_custom_roles.group_id and gm.user_id = auth.uid() and gm.role = 'admin')
);

create policy "group_custom_roles_delete" on public.group_custom_roles for delete using (
  exists (select 1 from public.group_members gm where gm.group_id = group_custom_roles.group_id and gm.user_id = auth.uid() and gm.role = 'admin')
);

-- ============================================================
-- Realtime: rol rengi/adı/izinleri değişince üye listesi canlı güncellensin
-- ============================================================
alter publication supabase_realtime add table public.group_custom_roles;
