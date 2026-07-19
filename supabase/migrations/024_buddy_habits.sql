-- ### 024_buddy_habits.sql
-- ============================================================
-- M5e: Buddy Habits (Ortak Alışkanlık) Supabase'e taşınıyor
--
-- Firebase yolları:
--   buddy_habits/{pairId}/{habitId}
--   buddy_habit_invites/{targetUsername}/{habitId}
--   buddy_habit_responses/{fromUsername}/{habitId}
-- ============================================================

-- ─── buddy_habits ────────────────────────────────────────────
create table public.buddy_habits (
  id            text primary key,   -- UUID string (davetçi tarafından üretilir)
  pair_id       text not null,       -- buddyPairId(userA, userB) = [A,B].sort().join('__')
  name          text not null,
  icon          text not null default 'fa-star',
  target_days   int  not null default 21,
  category      text not null default 'genel',
  host_id       uuid not null references public.profiles(id) on delete cascade,
  guest_id      uuid not null references public.profiles(id) on delete cascade,
  host_username text not null,
  guest_username text not null,
  created_at    timestamptz not null default now()
);

alter table public.buddy_habits enable row level security;
alter table public.buddy_habits replica identity full;

create policy "bh_select" on public.buddy_habits for select using (
  host_id = auth.uid() or guest_id = auth.uid()
);
create policy "bh_insert" on public.buddy_habits for insert with check (
  host_id = auth.uid()
);
create policy "bh_update" on public.buddy_habits for update using (
  host_id = auth.uid() or guest_id = auth.uid()
);
create policy "bh_delete" on public.buddy_habits for delete using (
  host_id = auth.uid() or guest_id = auth.uid()
);

-- ─── buddy_habit_completions ─────────────────────────────────
create table public.buddy_habit_completions (
  habit_id  text not null references public.buddy_habits(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  day_key   text not null,  -- 'DD-MM-YYYY' (buddyDayKey formatı)
  primary key (habit_id, user_id, day_key)
);

alter table public.buddy_habit_completions enable row level security;
alter table public.buddy_habit_completions replica identity full;

create policy "bhc_select" on public.buddy_habit_completions for select using (
  exists (select 1 from public.buddy_habits bh where bh.id = habit_id and (bh.host_id = auth.uid() or bh.guest_id = auth.uid()))
);
create policy "bhc_insert" on public.buddy_habit_completions for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.buddy_habits bh where bh.id = habit_id and (bh.host_id = auth.uid() or bh.guest_id = auth.uid()))
);
create policy "bhc_delete" on public.buddy_habit_completions for delete using (
  user_id = auth.uid()
);

-- ─── buddy_habit_invites ─────────────────────────────────────
create table public.buddy_habit_invites (
  id           uuid primary key default gen_random_uuid(),
  habit_id     text not null,    -- davetçi tarafından üretilen habit UUID
  pair_id      text not null,
  from_id      uuid not null references public.profiles(id) on delete cascade,
  from_username text not null,
  from_name    text not null,
  from_color   text not null default '6c5ce7',
  to_id        uuid not null references public.profiles(id) on delete cascade,
  to_username  text not null,
  name         text not null,
  icon         text not null default 'fa-star',
  target_days  int  not null default 21,
  category     text not null default 'genel',
  created_at   timestamptz not null default now()
);

alter table public.buddy_habit_invites enable row level security;
alter table public.buddy_habit_invites replica identity full;

create policy "bhi_select" on public.buddy_habit_invites for select using (
  from_id = auth.uid() or to_id = auth.uid()
);
create policy "bhi_insert" on public.buddy_habit_invites for insert with check (
  from_id = auth.uid()
);
create policy "bhi_delete" on public.buddy_habit_invites for delete using (
  from_id = auth.uid() or to_id = auth.uid()
);

-- ─── buddy_habit_responses ───────────────────────────────────
create table public.buddy_habit_responses (
  id           uuid primary key default gen_random_uuid(),
  habit_id     text not null,
  pair_id      text not null,
  from_id      uuid not null references public.profiles(id) on delete cascade,  -- yanıtlayan
  from_username text not null,
  from_name    text not null,
  to_id        uuid not null references public.profiles(id) on delete cascade,  -- orijinal davetçi
  name         text not null,
  icon         text not null,
  target_days  int  not null,
  category     text not null,
  accepted     boolean not null,
  created_at   timestamptz not null default now()
);

alter table public.buddy_habit_responses enable row level security;
alter table public.buddy_habit_responses replica identity full;

create policy "bhr_select" on public.buddy_habit_responses for select using (
  from_id = auth.uid() or to_id = auth.uid()
);
create policy "bhr_insert" on public.buddy_habit_responses for insert with check (
  from_id = auth.uid()
);
create policy "bhr_delete" on public.buddy_habit_responses for delete using (
  from_id = auth.uid() or to_id = auth.uid()
);

-- ─── Realtime ────────────────────────────────────────────────
alter publication supabase_realtime add table public.buddy_habits;
alter publication supabase_realtime add table public.buddy_habit_completions;
alter publication supabase_realtime add table public.buddy_habit_invites;
alter publication supabase_realtime add table public.buddy_habit_responses;
