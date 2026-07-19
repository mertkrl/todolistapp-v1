-- ### 044_faz2_classroom.sql
-- ============================================================
-- FAZ 2-2: Sınıf / Çalışma Alanı Yönetimi
-- groups tablosunu eğitim kurumu için genişlet
-- ============================================================

-- Gruba kurum bilgileri ekle
alter table public.groups
  add column if not exists institution_name text,          -- "Atatürk Lisesi", "FocusAI Akademi"
  add column if not exists classroom_type   text default 'general'  -- 'general' | 'classroom' | 'workplace'
    check (classroom_type in ('general', 'classroom', 'workplace')),
  add column if not exists grade_level      text,          -- "9-A", "10. Sınıf", "Muhasebe"
  add column if not exists max_members      integer default 100;

-- Kurum arama için index
create index if not exists groups_institution_idx on public.groups (institution_name);
create index if not exists groups_classroom_type_idx on public.groups (classroom_type);

-- Ödev tablosu — mesajdan veya doğrudan oluşturulan ödevler
create table public.classroom_assignments (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references public.groups(id) on delete cascade,
  created_by      uuid not null references public.profiles(id) on delete cascade,
  title           text not null,
  description     text default '',
  due_date        timestamptz,
  from_message_id uuid references public.messages(id) on delete set null,
  status          text not null default 'active' check (status in ('active', 'closed')),
  created_at      timestamptz not null default now()
);

create index assignments_group_idx on public.classroom_assignments (group_id, created_at desc);

alter table public.classroom_assignments enable row level security;

create policy "assignments_select" on public.classroom_assignments for select using (
  exists (select 1 from public.group_members gm where gm.group_id = classroom_assignments.group_id and gm.user_id = auth.uid())
);
create policy "assignments_insert" on public.classroom_assignments for insert with check (
  created_by = auth.uid()
  and exists (select 1 from public.group_members gm where gm.group_id = classroom_assignments.group_id and gm.user_id = auth.uid())
);
create policy "assignments_update" on public.classroom_assignments for update using (
  created_by = auth.uid()
  or exists (select 1 from public.group_members gm where gm.group_id = classroom_assignments.group_id and gm.user_id = auth.uid() and gm.role = 'admin')
);
create policy "assignments_delete" on public.classroom_assignments for delete using (
  created_by = auth.uid()
  or exists (select 1 from public.group_members gm where gm.group_id = classroom_assignments.group_id and gm.user_id = auth.uid() and gm.role = 'admin')
);

-- Ödev teslim tablosu
create table public.assignment_submissions (
  assignment_id uuid not null references public.classroom_assignments(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  note          text default '',
  submitted_at  timestamptz not null default now(),
  primary key (assignment_id, user_id)
);

alter table public.assignment_submissions enable row level security;

create policy "submissions_select" on public.assignment_submissions for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.classroom_assignments ca
    join public.group_members gm on gm.group_id = ca.group_id
    where ca.id = assignment_id and gm.user_id = auth.uid() and gm.role = 'admin'
  )
);
create policy "submissions_insert" on public.assignment_submissions for insert with check (user_id = auth.uid());
create policy "submissions_delete" on public.assignment_submissions for delete using (user_id = auth.uid());

-- Realtime
alter publication supabase_realtime add table public.classroom_assignments;
alter publication supabase_realtime add table public.assignment_submissions;
