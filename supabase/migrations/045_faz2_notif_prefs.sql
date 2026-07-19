-- ### 045_faz2_notif_prefs.sql
-- ============================================================
-- FAZ 2-3: Bildirim Tercihleri (DND + Kanal Bazlı)
-- ============================================================

-- Kullanıcı başına bildirim tercihleri
create table public.notification_preferences (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  dnd_enabled    boolean not null default false,
  dnd_start      time,                 -- DND başlangıç saati (örn: 22:00)
  dnd_end        time,                 -- DND bitiş saati (örn: 08:00)
  -- Kanal bazlı tercihler: { "scope_type:scope_id": "all"|"mentions"|"none" }
  channel_levels jsonb not null default '{}'::jsonb,
  updated_at     timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "notif_prefs_select" on public.notification_preferences for select using (user_id = auth.uid());
create policy "notif_prefs_insert" on public.notification_preferences for insert with check (user_id = auth.uid());
create policy "notif_prefs_update" on public.notification_preferences for update using (user_id = auth.uid());

-- Günlük özet geçmişi (isteğe bağlı kayıt)
create table public.daily_summaries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  group_id    uuid references public.groups(id) on delete set null,
  did_today   text not null,
  obstacle    text default '',
  tomorrow    text default '',
  message_id  uuid references public.messages(id) on delete set null,
  created_at  date not null default current_date,
  unique (user_id, created_at)   -- günde bir özet
);

create index daily_summaries_user_idx on public.daily_summaries (user_id, created_at desc);
create index daily_summaries_group_idx on public.daily_summaries (group_id, created_at desc);

alter table public.daily_summaries enable row level security;

create policy "daily_summaries_select" on public.daily_summaries for select using (
  user_id = auth.uid()
  or (group_id is not null and exists (
    select 1 from public.group_members gm where gm.group_id = daily_summaries.group_id and gm.user_id = auth.uid()
  ))
);
create policy "daily_summaries_insert" on public.daily_summaries for insert with check (user_id = auth.uid());
create policy "daily_summaries_update" on public.daily_summaries for update using (user_id = auth.uid());
