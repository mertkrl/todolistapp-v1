-- ### 021_cw_rooms.sql
-- ============================================================
-- M5d: "Birlikte Çalışalım" Odası (Room Modu) Supabase'e taşınıyor.
--
-- Firebase yolları:
--   focusai_community/cw_rooms/{roomId}/...
--   focusai_community/cw_invites/{targetUsername}
--   focusai_community/cw_declines/{hostUsername}
--
-- Karşılıklar:
--   cw_rooms — 2-kişilik odaklanma odası durumu
--   cw_invites — davet bildirimleri (status: 'pending' | 'declined')
-- ============================================================

-- ─── cw_rooms ───────────────────────────────────────────────
create table public.cw_rooms (
  id              text primary key,            -- host tarafından üretilen uuid string
  host_id         uuid not null references public.profiles(id) on delete cascade,
  host_username   text not null,
  host_name       text not null,
  host_color      text not null default '6c5ce7',
  guest_id        uuid references public.profiles(id) on delete set null,
  guest_username  text,
  guest_name      text,
  guest_color     text,
  active          boolean not null default true,
  started_at      timestamptz,
  paused          boolean not null default false,
  paused_at       timestamptz,
  focus_minutes   int not null default 25,
  break_minutes   int not null default 5,
  rounds          int not null default 4,
  host_task_id    text,
  host_task       text,
  guest_task_id   text,
  guest_task      text,
  linked_habit_id   text,
  linked_habit_name text,
  linked_pair_id    text,
  ended_by_id     uuid references public.profiles(id) on delete set null,
  ended_by_name   text,
  ended_at        timestamptz,
  restarting      boolean not null default false,
  restarted_by_id uuid references public.profiles(id) on delete set null,
  restarted_by_name text,
  restarted_at    timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.cw_rooms enable row level security;
alter table public.cw_rooms replica identity full;

create policy "cw_rooms_select" on public.cw_rooms for select using (
  host_id = auth.uid() or guest_id = auth.uid()
);
create policy "cw_rooms_insert" on public.cw_rooms for insert with check (
  host_id = auth.uid()
);
create policy "cw_rooms_update" on public.cw_rooms for update using (
  host_id = auth.uid() or guest_id = auth.uid()
);
create policy "cw_rooms_delete" on public.cw_rooms for delete using (
  host_id = auth.uid()
);

alter publication supabase_realtime add table public.cw_rooms;

-- ─── cw_invites ─────────────────────────────────────────────
create table public.cw_invites (
  id              uuid primary key default gen_random_uuid(),
  room_id         text not null,
  from_id         uuid not null references public.profiles(id) on delete cascade,
  from_username   text not null,
  from_name       text not null,
  from_color      text not null default '6c5ce7',
  to_id           uuid not null references public.profiles(id) on delete cascade,
  to_username     text not null,
  focus_minutes   int not null default 25,
  rounds          int not null default 4,
  linked_habit_id   text,
  linked_habit_name text,
  linked_pair_id    text,
  status          text not null default 'pending' check (status in ('pending', 'declined')),
  created_at      timestamptz not null default now()
);

alter table public.cw_invites enable row level security;
alter table public.cw_invites replica identity full;

create policy "cw_invites_select" on public.cw_invites for select using (
  from_id = auth.uid() or to_id = auth.uid()
);
create policy "cw_invites_insert" on public.cw_invites for insert with check (
  from_id = auth.uid()
);
create policy "cw_invites_update" on public.cw_invites for update using (
  to_id = auth.uid()   -- yalnızca davetli status güncelleyebilir
);
create policy "cw_invites_delete" on public.cw_invites for delete using (
  from_id = auth.uid() or to_id = auth.uid()
);

alter publication supabase_realtime add table public.cw_invites;
