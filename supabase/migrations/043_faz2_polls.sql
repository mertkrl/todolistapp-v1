-- ### 043_faz2_polls.sql
-- ============================================================
-- FAZ 2-1: Anket (Poll) Sistemi
-- ============================================================

-- Anket tablosu — bir mesaja bağlı veya bağımsız olabilir
create table public.polls (
  id           uuid primary key default gen_random_uuid(),
  scope_type   text not null,           -- 'group' | 'group_channel' | 'group_subchannel' | 'dm'
  scope_id     uuid not null,
  created_by   uuid not null references public.profiles(id) on delete cascade,
  question     text not null,
  options      jsonb not null,          -- ["Seçenek A", "Seçenek B", ...]
  is_anonymous boolean not null default false,
  is_multiple  boolean not null default false,  -- çoklu seçim
  ends_at      timestamptz,             -- null = süresiz
  created_at   timestamptz not null default now()
);

create index polls_scope_idx on public.polls (scope_type, scope_id, created_at desc);

alter table public.polls enable row level security;

create policy "polls_select" on public.polls for select using (
  public.can_access_scope(scope_type, scope_id)
);
create policy "polls_insert" on public.polls for insert with check (
  created_by = auth.uid() and public.can_access_scope(scope_type, scope_id)
);
create policy "polls_delete" on public.polls for delete using (
  created_by = auth.uid()
);

-- Oy tablosu
create table public.poll_votes (
  poll_id        uuid not null references public.polls(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  option_indices integer[] not null,    -- seçilen seçenek indeksleri
  voted_at       timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create index poll_votes_poll_idx on public.poll_votes (poll_id);

alter table public.poll_votes enable row level security;
alter table public.poll_votes replica identity full;

create policy "poll_votes_select" on public.poll_votes for select using (
  exists (select 1 from public.polls p where p.id = poll_id and public.can_access_scope(p.scope_type, p.scope_id))
);
create policy "poll_votes_insert" on public.poll_votes for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.polls p where p.id = poll_id and public.can_access_scope(p.scope_type, p.scope_id))
);
create policy "poll_votes_update" on public.poll_votes for update using (user_id = auth.uid());
create policy "poll_votes_delete" on public.poll_votes for delete using (user_id = auth.uid());

-- messages tablosuna poll_id referansı ekle (anket mesajı tipi için)
alter table public.messages add column if not exists poll_id uuid references public.polls(id) on delete set null;

-- Realtime
alter publication supabase_realtime add table public.polls;
alter publication supabase_realtime add table public.poll_votes;
