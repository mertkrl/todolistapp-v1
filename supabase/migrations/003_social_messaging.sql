-- ### 003_social_messaging.sql
-- FocusAI -> Supabase Migration - Milestone 2b-1 (Birebir Mesajlaşma / DM)
-- conversations, messages (birleşik - DM şimdi, grup/oda M2b-3'te), message_reads,
-- message_pins. Run this once in the Supabase SQL Editor.

-- ============================================================
-- conversations: iki kullanıcı arasındaki DM kanalı
-- ============================================================
create table public.conversations (
  id            uuid primary key default gen_random_uuid(),
  user_a        uuid not null references public.profiles(id) on delete cascade,
  user_b        uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'accepted' check (status in ('pending', 'accepted')),
  requested_by  uuid not null references public.profiles(id),
  created_at    timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);

alter table public.conversations enable row level security;

create policy "conversations_select" on public.conversations for select
  using (auth.uid() in (user_a, user_b));

create policy "conversations_insert" on public.conversations for insert
  with check (auth.uid() in (user_a, user_b) and requested_by = auth.uid());

-- DM isteğini kabul etme: sadece istek SAHİBİ OLMAYAN taraf pending->accepted yapabilir
create policy "conversations_update" on public.conversations for update
  using (auth.uid() in (user_a, user_b) and status = 'pending' and requested_by <> auth.uid())
  with check (status = 'accepted');

-- isteği reddetme / sohbeti silme: her iki taraf da silebilir
create policy "conversations_delete" on public.conversations for delete
  using (auth.uid() in (user_a, user_b));

-- ============================================================
-- messages: tüm sohbet türleri için birleşik tablo
-- (DM şimdi, grup/oda/kanal M2b-3'te scope_type='group'/'group_channel' eklenecek)
-- ============================================================
create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  scope_type  text not null check (scope_type in ('dm', 'group', 'group_channel', 'focus_session')),
  scope_id    uuid not null,
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  text        text,
  enc         jsonb,
  reply_to    uuid references public.messages(id) on delete set null,
  mentions    uuid[] not null default '{}',
  edited      boolean not null default false,
  created_at  timestamptz not null default now()
);

create index messages_scope_idx on public.messages (scope_type, scope_id, created_at desc);

alter table public.messages enable row level security;

create policy "messages_select_dm" on public.messages for select using (
  scope_type = 'dm' and exists (
    select 1 from public.conversations c
    where c.id = messages.scope_id and auth.uid() in (c.user_a, c.user_b)
  )
);

create policy "messages_insert_dm" on public.messages for insert with check (
  sender_id = auth.uid()
  and scope_type = 'dm'
  and exists (
    select 1 from public.conversations c
    where c.id = scope_id
      and auth.uid() in (c.user_a, c.user_b)
      and (
        c.status = 'accepted'
        or (c.status = 'pending' and c.requested_by = auth.uid()
            and not exists (select 1 from public.messages m2 where m2.scope_id = c.id))
      )
  )
);

create policy "messages_update_own" on public.messages for update
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());

create policy "messages_delete_own" on public.messages for delete
  using (sender_id = auth.uid());

-- ============================================================
-- message_reads: okundu bilgisi (kişi/konuşma başına tek timestamp)
-- ============================================================
create table public.message_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.message_reads enable row level security;

create policy "message_reads_select" on public.message_reads for select using (
  exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b))
);

create policy "message_reads_insert" on public.message_reads for insert with check (user_id = auth.uid());

create policy "message_reads_update" on public.message_reads for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- message_pins: sabitlenen DM mesajları
-- ============================================================
create table public.message_pins (
  message_id      uuid primary key references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  pinned_by       uuid not null references public.profiles(id),
  created_at      timestamptz not null default now()
);

alter table public.message_pins enable row level security;

create policy "message_pins_select" on public.message_pins for select using (
  exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b))
);

create policy "message_pins_insert" on public.message_pins for insert with check (
  pinned_by = auth.uid()
  and exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b))
);

create policy "message_pins_delete" on public.message_pins for delete using (
  exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b))
);

-- ============================================================
-- Realtime: DM sohbeti (social.js openDcDmRoom / recent conversations)
-- bu tablolardaki INSERT/UPDATE/DELETE'leri postgres_changes ile dinler.
-- ============================================================
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.message_reads;
