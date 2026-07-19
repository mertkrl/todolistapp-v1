-- ### 002_social_foundation.sql
-- FocusAI -> Supabase Migration - Milestone 2a (Sosyal Temel)
-- Identity bridge (profiles.username), friendships, blocks, notifications,
-- activity feed. Run this once in the Supabase SQL Editor.

-- ============================================================
-- profiles: sosyal alanlar (presence/leaderboard/durum)
-- ============================================================
alter table public.profiles
  add column if not exists custom_avatar       text,
  add column if not exists xp                  integer not null default 0,
  add column if not exists status              text not null default 'online',
  add column if not exists status_color        text not null default '#2ed573',
  add column if not exists status_text         text default '',
  add column if not exists current_status      text,
  add column if not exists completed_today     integer not null default 0,
  add column if not exists focus_min           integer not null default 0,
  add column if not exists focus_streak        integer not null default 0,
  add column if not exists completed_goals     integer not null default 0,
  add column if not exists last_seen           timestamptz,
  add column if not exists joined_community_at timestamptz;

-- Arkadaş arama, liderlik tablosu, grup üye listeleri vb. için: giriş yapmış
-- her kullanıcı tüm profilleri okuyabilir (insert/update/delete hala sadece
-- kendi satırı - own_profile_all politikası değişmedi).
create policy "profiles_select_authenticated" on public.profiles
  for select using (auth.uid() is not null);

-- ============================================================
-- friendships
-- ============================================================
create table public.friendships (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles(id) on delete cascade,
  addressee_id  uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);

create index friendships_addressee_idx on public.friendships (addressee_id, status);
create index friendships_requester_idx on public.friendships (requester_id, status);

alter table public.friendships enable row level security;

create policy "friendships_select" on public.friendships for select
  using (auth.uid() in (requester_id, addressee_id));

create policy "friendships_insert" on public.friendships for insert
  with check (auth.uid() = requester_id);

create policy "friendships_update" on public.friendships for update
  using (auth.uid() = addressee_id and status = 'pending')
  with check (auth.uid() = addressee_id and status = 'accepted');

create policy "friendships_delete" on public.friendships for delete
  using (auth.uid() in (requester_id, addressee_id));

-- ============================================================
-- user_blocks
-- ============================================================
create table public.user_blocks (
  blocker_id  uuid not null references public.profiles(id) on delete cascade,
  blocked_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

create policy "user_blocks_select" on public.user_blocks for select
  using (auth.uid() in (blocker_id, blocked_id));

create policy "user_blocks_insert" on public.user_blocks for insert
  with check (auth.uid() = blocker_id);

create policy "user_blocks_delete" on public.user_blocks for delete
  using (auth.uid() = blocker_id);

-- ============================================================
-- notifications
-- ============================================================
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null,
  payload     jsonb not null default '{}'::jsonb,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications_select" on public.notifications for select
  using (auth.uid() = user_id);

-- Başka kullanıcılar bana bildirim "gönderebilir" (örn. reaction) - insert
-- hedef kullanıcıdan bağımsız, sadece oturum açmış olmak yeterli.
create policy "notifications_insert" on public.notifications for insert
  with check (auth.uid() is not null);

create policy "notifications_update" on public.notifications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "notifications_delete" on public.notifications for delete
  using (auth.uid() = user_id);

-- ============================================================
-- activities (aktivite akışı)
-- ============================================================
create table public.activities (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  text        text not null,
  created_at  timestamptz not null default now()
);

create index activities_user_idx on public.activities (user_id, created_at desc);

alter table public.activities enable row level security;

-- Görünürlük: kendi aktivitelerin + kabul edilmiş arkadaşların, SADECE
-- arkadaşlık kabul tarihinden (accepted_at) sonraki aktiviteleri.
create policy "activities_select" on public.activities for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and f.accepted_at is not null
      and activities.created_at >= f.accepted_at
      and (
        (f.requester_id = auth.uid() and f.addressee_id = activities.user_id)
        or (f.addressee_id = auth.uid() and f.requester_id = activities.user_id)
      )
  )
);

create policy "activities_insert" on public.activities for insert
  with check (user_id = auth.uid());

create policy "activities_delete" on public.activities for delete
  using (user_id = auth.uid());

-- ============================================================
-- activity_reactions
-- ============================================================
create table public.activity_reactions (
  activity_id  uuid not null references public.activities(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  emoji        text not null,
  created_at   timestamptz not null default now(),
  primary key (activity_id, user_id)
);

alter table public.activity_reactions enable row level security;

-- Bir aktiviteyi görebilen herkes reaksiyonlarını da görebilir (activities
-- tablosunun kendi RLS'i alt sorguda otomatik uygulanır).
create policy "activity_reactions_select" on public.activity_reactions for select
  using (exists (select 1 from public.activities a where a.id = activity_id));

create policy "activity_reactions_insert" on public.activity_reactions for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.activities a where a.id = activity_id)
  );

create policy "activity_reactions_update" on public.activity_reactions for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "activity_reactions_delete" on public.activity_reactions for delete
  using (user_id = auth.uid());

-- ============================================================
-- Realtime: aktivite akışı (social.js subscribeActivity) bu tablolardaki
-- INSERT/UPDATE/DELETE'leri postgres_changes ile dinler.
-- ============================================================
alter publication supabase_realtime add table public.activities;
alter publication supabase_realtime add table public.activity_reactions;
