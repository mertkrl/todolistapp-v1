-- ### 008_group_announcements_audit.sql
-- ============================================================
-- M2b-4 Bölüm 1: Sabitlenmiş duyuru + denetim günlüğü
-- ============================================================

-- groups.announcement: eski groups/{code}/announcement
-- şekil: {text, setBy: uuid, setByName: text, timestamp: epoch_ms}
alter table public.groups add column if not exists announcement jsonb;

-- ============================================================
-- group_audit_log: eski groups/{code}/auditLog
-- ============================================================
create table public.group_audit_log (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  actor_id   uuid references public.profiles(id),
  type       text not null,
  detail     text,
  created_at timestamptz not null default now()
);

create index group_audit_log_group_idx on public.group_audit_log (group_id, created_at desc);

alter table public.group_audit_log enable row level security;

-- M2b-4 Bölüm 1: sadece grup adminleri görür/yazar (moderatör/özel rol Bölüm 2'de eklenecek)
create policy "group_audit_log_select" on public.group_audit_log for select using (
  exists (select 1 from public.group_members gm where gm.group_id = group_audit_log.group_id and gm.user_id = auth.uid() and gm.role = 'admin')
);

create policy "group_audit_log_insert" on public.group_audit_log for insert with check (
  actor_id = auth.uid()
  and exists (select 1 from public.group_members gm where gm.group_id = group_audit_log.group_id and gm.user_id = auth.uid() and gm.role = 'admin')
);

-- ============================================================
-- Realtime: "Geçmiş" sekmesi canlı güncellensin
-- ============================================================
alter publication supabase_realtime add table public.group_audit_log;
