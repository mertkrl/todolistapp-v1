-- ### 081_institution_weekly_digest.sql
-- ============================================================
-- Öğretmen gözünden geliştirme: panel reaktif değildi, öğretmen
-- girmeden hiçbir uyarı almıyordu. Sunucu tarafı cron kurmadan
-- (bu projede daha önce 038'de olduğu gibi bilinçli olarak
-- tercih edilmemiş), "Kurumum" panelini her açtığında haftada bir
-- kez otomatik özet bildirimi üreten bir marker tablosu ekliyoruz.
-- ============================================================

create table public.institution_weekly_digests (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null references public.groups(id) on delete cascade,
  week_start     date not null,
  inactive_count integer not null default 0,
  created_at     timestamptz not null default now(),
  unique (group_id, week_start)
);

alter table public.institution_weekly_digests enable row level security;

create policy "institution_weekly_digests_select" on public.institution_weekly_digests for select using (
  exists (
    select 1 from public.group_members gm
    where gm.group_id = institution_weekly_digests.group_id and gm.user_id = auth.uid() and gm.role in ('admin', 'moderator')
  )
);

create policy "institution_weekly_digests_insert" on public.institution_weekly_digests for insert with check (
  exists (
    select 1 from public.group_members gm
    where gm.group_id = institution_weekly_digests.group_id and gm.user_id = auth.uid() and gm.role in ('admin', 'moderator')
  )
);
