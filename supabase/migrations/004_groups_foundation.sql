-- ### 004_groups_foundation.sql
-- FocusAI -> Supabase Migration - Milestone 2b-2 (Bölüm 1: Gruplar Temel)
-- groups, group_members, group_pending_members, group_leave_log + profiles.last_group_created_at.
-- Run this once in the Supabase SQL Editor.

-- ============================================================
-- groups: bir grubun ana kaydı (eski groups/{code})
-- ============================================================
create table public.groups (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  name             text not null,
  description      text,
  weekly_goal      integer not null default 0,
  privacy          text not null default 'public' check (privacy in ('public', 'private')),
  category         text,
  require_approval boolean not null default false,
  created_by       uuid not null references public.profiles(id),
  created_at       timestamptz not null default now()
);

create index groups_code_idx on public.groups (code);
create index groups_created_by_idx on public.groups (created_by);

alter table public.groups enable row level security;

-- ============================================================
-- group_members: eski groups/{code}/members/{username}
-- ============================================================
create table public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text, -- null = 'member' (varsayılan); 'admin' | 'moderator' | custom rol id (M2b-4)
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id);

-- ============================================================
-- groups RLS policy'leri (group_members tablosu oluştuktan sonra,
-- çünkü groups_select/groups_update group_members'a referans veriyor)
-- ============================================================

-- herkese açık gruplar herkese görünür; private gruplar sadece üyelere
create policy "groups_select" on public.groups for select using (
  privacy = 'public'
  or exists (select 1 from public.group_members gm where gm.group_id = groups.id and gm.user_id = auth.uid())
);

create policy "groups_insert" on public.groups for insert with check (created_by = auth.uid());

create policy "groups_update" on public.groups for update using (
  exists (select 1 from public.group_members gm where gm.group_id = groups.id and gm.user_id = auth.uid() and gm.role = 'admin')
);

create policy "groups_delete" on public.groups for delete using (created_by = auth.uid());

alter table public.group_members enable row level security;

create policy "group_members_select" on public.group_members for select using (
  user_id = auth.uid()
  or exists (select 1 from public.groups g where g.id = group_members.group_id and g.privacy = 'public')
  or exists (select 1 from public.group_members gm2 where gm2.group_id = group_members.group_id and gm2.user_id = auth.uid())
);

create policy "group_members_insert" on public.group_members for insert with check (
  user_id = auth.uid()
  or exists (select 1 from public.group_members gm where gm.group_id = group_members.group_id and gm.user_id = auth.uid() and gm.role in ('admin', 'moderator'))
);

create policy "group_members_update" on public.group_members for update using (
  exists (select 1 from public.group_members gm where gm.group_id = group_members.group_id and gm.user_id = auth.uid() and gm.role = 'admin')
);

create policy "group_members_delete" on public.group_members for delete using (
  user_id = auth.uid()
  or exists (select 1 from public.group_members gm where gm.group_id = group_members.group_id and gm.user_id = auth.uid() and gm.role in ('admin', 'moderator'))
);

-- ============================================================
-- group_pending_members: eski groups/{code}/pendingMembers/{username} (requireApproval)
-- ============================================================
create table public.group_pending_members (
  group_id     uuid not null references public.groups(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  requested_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.group_pending_members enable row level security;

create policy "group_pending_select" on public.group_pending_members for select using (
  user_id = auth.uid()
  or exists (select 1 from public.group_members gm where gm.group_id = group_pending_members.group_id and gm.user_id = auth.uid() and gm.role in ('admin', 'moderator'))
);

create policy "group_pending_insert" on public.group_pending_members for insert with check (user_id = auth.uid());

create policy "group_pending_delete" on public.group_pending_members for delete using (
  user_id = auth.uid()
  or exists (select 1 from public.group_members gm where gm.group_id = group_pending_members.group_id and gm.user_id = auth.uid() and gm.role in ('admin', 'moderator'))
);

-- ============================================================
-- group_leave_log: eski users/{u}/group_leave_cooldowns/{code} (rejoin cooldown)
-- ============================================================
create table public.group_leave_log (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  left_at  timestamptz not null default now(),
  primary key (user_id, group_id)
);

alter table public.group_leave_log enable row level security;

create policy "group_leave_log_all" on public.group_leave_log for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- create cooldown: eski users/{u}/group_create_cooldown -> profiles üzerine kolon
-- ============================================================
alter table public.profiles add column if not exists last_group_created_at timestamptz;

-- ============================================================
-- Realtime: "My Groups" listesi / grup detay paneli üye listesi
-- bu tablolardaki INSERT/UPDATE/DELETE'leri postgres_changes ile dinler.
-- ============================================================
alter publication supabase_realtime add table public.groups;
alter publication supabase_realtime add table public.group_members;
