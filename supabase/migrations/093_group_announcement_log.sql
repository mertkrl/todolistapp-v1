-- ### 093_group_announcement_log.sql
-- ============================================================
-- Kurumsal (sınıf/işyeri) gruplarda "Duyuru Geçmişi" kartı için.
-- `groups.announcement` tek bir güncel duyuruyu tutar (üzerine yazılır);
-- bu tablo her yeni duyuruyu kalıcı bir geçmiş olarak ayrıca saklar.
-- group_audit_log'dan farklı olarak TÜM grup üyeleri okuyabilir
-- (audit log yalnızca admin'e açık) — duyuru öğrenciye de görünmeli.
-- ============================================================

create table if not exists public.group_announcement_log (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  text        text not null,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  author_name text,
  created_at  timestamptz not null default now()
);

create index if not exists group_announcement_log_group_idx
  on public.group_announcement_log (group_id, created_at desc);

alter table public.group_announcement_log enable row level security;

create policy "gal_select" on public.group_announcement_log for select using (
  exists (
    select 1 from public.group_members gm
    where gm.group_id = group_announcement_log.group_id and gm.user_id = auth.uid()
  )
);

create policy "gal_insert" on public.group_announcement_log for insert with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.group_members gm
    where gm.group_id = group_announcement_log.group_id
      and gm.user_id = auth.uid()
      and gm.role = 'admin'
  )
);

alter publication supabase_realtime add table public.group_announcement_log;
