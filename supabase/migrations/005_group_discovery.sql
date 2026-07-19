-- ### 005_group_discovery.sql
-- ============================================================
-- M2b-2 Bölüm 2: Keşfet (Discover) + Kaydedilenler
-- ============================================================

-- group_saved: eski users/{u}/saved_groups/{code}
create table public.group_saved (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  saved_at timestamptz not null default now(),
  notified boolean not null default false,
  primary key (user_id, group_id)
);

alter table public.group_saved enable row level security;

create policy "group_saved_all" on public.group_saved for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
