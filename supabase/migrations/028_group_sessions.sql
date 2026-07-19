-- ### 028_group_sessions.sql
-- Group Session Calendar migration
-- Replaces Firebase RTDB groups/{code}/sessions

create table public.group_sessions (
  id                   uuid primary key default gen_random_uuid(),
  group_id             uuid not null references public.groups(id) on delete cascade,
  title                text not null,
  session_date         date not null,
  session_time         time,
  duration             integer not null default 60,
  note                 text,
  created_by           uuid not null references public.profiles(id) on delete cascade,
  created_by_username  text not null,
  created_at           timestamptz not null default now()
);

create index group_sessions_group_idx on public.group_sessions (group_id);
create index group_sessions_date_idx  on public.group_sessions (session_date);

create table public.group_session_attendees (
  session_id  uuid not null references public.group_sessions(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  username    text not null,
  primary key (session_id, user_id)
);

-- Enable realtime
alter publication supabase_realtime add table public.group_sessions;
alter publication supabase_realtime add table public.group_session_attendees;

-- RLS
alter table public.group_sessions          enable row level security;
alter table public.group_session_attendees enable row level security;

-- group_sessions: members can read
create policy "Group members can view sessions"
  on public.group_sessions for select
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_sessions.group_id
        and gm.user_id = auth.uid()
    )
  );

-- group_sessions: members can insert
create policy "Group members can create sessions"
  on public.group_sessions for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.group_members gm
      where gm.group_id = group_sessions.group_id
        and gm.user_id = auth.uid()
    )
  );

-- group_sessions: creator can delete own
create policy "Session creator can delete"
  on public.group_sessions for delete
  using (created_by = auth.uid());

-- group_session_attendees: anyone (group member via sessions join) can view
create policy "View attendees"
  on public.group_session_attendees for select
  using (true);

-- group_session_attendees: users manage own attendance
create policy "Insert own attendance"
  on public.group_session_attendees for insert
  with check (user_id = auth.uid());

create policy "Delete own attendance"
  on public.group_session_attendees for delete
  using (user_id = auth.uid());
