-- ### 017_focus_challenges.sql
-- ============================================================
-- M4b: "Birlikte Odaklanma" (cowork challenge) Supabase'e taşınıyor.
--
-- Firebase'deki focusai_community/groups/{code}/challenges/{id}/...
-- yapısının karşılığı: focus_challenges + focus_challenge_participants.
-- Davet kartı mesajı messages.challenge_id ile challenge'a bağlanır,
-- mola sohbeti messages.scope_type='focus_session' kullanır (zaten
-- 003/011'de tanımlıydı).
-- ============================================================

create table public.focus_challenges (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups(id) on delete cascade,
  scope_type   text not null check (scope_type in ('group', 'group_channel', 'group_subchannel')),
  scope_id     uuid not null,
  created_by   uuid not null references public.profiles(id),
  duration     int not null,
  short_break  int not null,
  long_break   int not null,
  rounds       int not null,
  status       text not null default 'waiting' check (status in ('waiting', 'running', 'done')),
  started_at   timestamptz,
  paused       boolean not null default false,
  paused_at    timestamptz,
  created_at   timestamptz not null default now()
);

create index focus_challenges_group_idx on public.focus_challenges (group_id);

create table public.focus_challenge_participants (
  challenge_id uuid not null references public.focus_challenges(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  display_name text,
  joined_at    timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

-- ─── messages: davet kartını challenge'a bağla ───
alter table public.messages add column challenge_id uuid references public.focus_challenges(id) on delete set null;

-- ─── can_access_scope: 'focus_session' (mola sohbeti) ───
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
    when 'focus_session' then exists (
      select 1 from public.focus_challenge_participants fcp
      where fcp.challenge_id = p_scope_id and fcp.user_id = auth.uid()
    )
    else false
  end;
$$;

-- ─── RLS: focus_challenges ───
alter table public.focus_challenges enable row level security;
alter table public.focus_challenges replica identity full;

create policy "focus_challenges_select" on public.focus_challenges for select using (
  public.is_group_member(group_id, auth.uid())
  or exists (
    select 1 from public.focus_challenge_participants fcp
    where fcp.challenge_id = focus_challenges.id and fcp.user_id = auth.uid()
  )
);

create policy "focus_challenges_insert" on public.focus_challenges for insert with check (
  created_by = auth.uid() and public.is_group_member(group_id, auth.uid())
);

create policy "focus_challenges_update" on public.focus_challenges for update using (
  exists (
    select 1 from public.focus_challenge_participants fcp
    where fcp.challenge_id = focus_challenges.id and fcp.user_id = auth.uid()
  )
);

-- ─── RLS: focus_challenge_participants ───
alter table public.focus_challenge_participants enable row level security;
alter table public.focus_challenge_participants replica identity full;

create policy "focus_challenge_participants_select" on public.focus_challenge_participants for select using (
  public.can_access_scope('focus_session', challenge_id)
  or exists (
    select 1 from public.focus_challenges fc
    where fc.id = focus_challenge_participants.challenge_id and public.is_group_member(fc.group_id, auth.uid())
  )
);

create policy "focus_challenge_participants_insert" on public.focus_challenge_participants for insert with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.focus_challenges fc
    where fc.id = focus_challenge_participants.challenge_id and public.is_group_member(fc.group_id, auth.uid())
  )
);

create policy "focus_challenge_participants_delete" on public.focus_challenge_participants for delete using (
  user_id = auth.uid()
);

-- ─── Realtime ───
alter publication supabase_realtime add table public.focus_challenges;
alter publication supabase_realtime add table public.focus_challenge_participants;
