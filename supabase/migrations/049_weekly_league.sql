-- ### 049_weekly_league.sql
-- FocusAI Faz 2: Haftalık Lig Sistemi
-- Haftalık XP = profiles.xp - week_xp_base (hafta başında alınan anlık görüntü).
-- Hafta devrilmesi client tarafında lazy yapılır (ensureWeeklyLeague):
-- yeni haftada geçen haftanın sonucu league_history'ye yazılır, lig
-- yükselme/düşme uygulanır ve week_xp_base güncellenir.

-- ============================================================
-- profiles: lig alanları
-- ============================================================
alter table public.profiles
  add column if not exists week_start   date,
  add column if not exists week_xp_base integer not null default 0,
  add column if not exists league       smallint not null default 1;

-- ============================================================
-- league_history: biten haftaların sonuçları
-- ============================================================
create table if not exists public.league_history (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  weekly_xp  integer not null default 0,
  league     smallint not null,           -- hafta SONUNDAKİ (yeni) lig
  result     text not null check (result in ('promote', 'stay', 'demote')),
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create index if not exists league_history_user_idx on public.league_history (user_id, week_start desc);

alter table public.league_history enable row level security;

-- Liderlik/profil kartları için giriş yapmış herkes okuyabilir
-- (profiles_select_authenticated ile aynı görünürlük modeli).
create policy "league_history_select" on public.league_history
  for select using (auth.uid() is not null);

-- Sadece kendi satırını yazabilir (client-side rollover)
create policy "league_history_insert" on public.league_history
  for insert with check (auth.uid() = user_id);
