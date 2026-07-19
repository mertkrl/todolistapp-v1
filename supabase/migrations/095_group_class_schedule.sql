-- ### 095_group_class_schedule.sql
-- ============================================================
-- Sınıf Paneli — "Ders Programı": öğretmenin haftalık, tekrarlayan
-- ders programını (örn. Pazartesi 09:00-09:40 Matematik) girebildiği,
-- tüm sınıfın salt-okunur görebildiği basit bir tablo.
-- ============================================================

create table if not exists public.group_class_schedule (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0 = Pazartesi ... 6 = Pazar
  time_start  time not null,
  time_end    time not null,
  subject     text not null,
  location    text,
  created_by  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists group_class_schedule_group_idx
  on public.group_class_schedule (group_id, day_of_week, time_start);

alter table public.group_class_schedule enable row level security;

create policy "gcs_select" on public.group_class_schedule for select using (
  exists (
    select 1 from public.group_members gm
    where gm.group_id = group_class_schedule.group_id and gm.user_id = auth.uid()
  )
);

create policy "gcs_insert" on public.group_class_schedule for insert with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.group_members gm
    where gm.group_id = group_class_schedule.group_id and gm.user_id = auth.uid() and gm.role = 'admin'
  )
);

create policy "gcs_delete" on public.group_class_schedule for delete using (
  exists (
    select 1 from public.group_members gm
    where gm.group_id = group_class_schedule.group_id and gm.user_id = auth.uid() and gm.role = 'admin'
  )
);

alter publication supabase_realtime add table public.group_class_schedule;
