-- ### 050_duels.sql
-- FocusAI Faz 3b: 1v1 Haftalık XP Düellosu
-- İki arkadaş aynı hafta içinde haftalık XP üzerinden yarışır.
-- Sonuçlandırma client tarafında lazy yapılır (hafta bittikten sonra
-- taraflardan biri geldiğinde): skorlar profiles/league_history'den okunur.

create table if not exists public.duels (
  id             uuid primary key default gen_random_uuid(),
  challenger_id  uuid not null references public.profiles(id) on delete cascade,
  opponent_id    uuid not null references public.profiles(id) on delete cascade,
  week_start     date not null,               -- yarışılan haftanın pazartesisi
  status         text not null default 'pending'
                 check (status in ('pending', 'active', 'declined', 'finished')),
  challenger_xp  integer,                     -- finalize'da doldurulur
  opponent_xp    integer,
  winner_id      uuid references public.profiles(id),  -- null = berabere
  created_at     timestamptz not null default now(),
  responded_at   timestamptz,
  check (challenger_id <> opponent_id)
);

-- Aynı rakiple aynı hafta tek düello (reddedilenler engellemesin diye partial index)
create unique index if not exists duels_pair_week_idx
  on public.duels (least(challenger_id, opponent_id), greatest(challenger_id, opponent_id), week_start)
  where status in ('pending', 'active');

create index if not exists duels_challenger_idx on public.duels (challenger_id, status);
create index if not exists duels_opponent_idx   on public.duels (opponent_id, status);

alter table public.duels enable row level security;
alter table public.duels replica identity full;

create policy "duels_select" on public.duels
  for select using (auth.uid() in (challenger_id, opponent_id));

create policy "duels_insert" on public.duels
  for insert with check (auth.uid() = challenger_id and status = 'pending');

-- Rakip kabul/red eder; hafta bitince taraflardan biri sonucu yazar.
create policy "duels_update" on public.duels
  for update using (auth.uid() in (challenger_id, opponent_id))
  with check (auth.uid() in (challenger_id, opponent_id));

create policy "duels_delete" on public.duels
  for delete using (auth.uid() = challenger_id and status = 'pending');

-- Realtime yayını (davet/kabul/sonuç bildirimleri için)
alter publication supabase_realtime add table public.duels;
