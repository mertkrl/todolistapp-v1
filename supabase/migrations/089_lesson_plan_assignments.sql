-- Ders planı atamalarının kalıcı takibi (öğretmen: kime atandı, durumu, ilerlemesi).
create table if not exists public.lesson_plan_assignments (
  id               uuid primary key default gen_random_uuid(),
  goal_id          text not null references public.planning_goals(id) on delete cascade,
  group_id         uuid not null references public.groups(id) on delete cascade,
  teacher_id       uuid not null references public.profiles(id) on delete cascade,
  student_id       uuid not null references public.profiles(id) on delete cascade,
  status           text not null default 'invited' check (status in ('invited', 'accepted', 'rejected', 'completed')),
  progress_pct     integer not null default 0,
  deadline         timestamptz,
  assigned_at      timestamptz not null default now(),
  responded_at     timestamptz,
  completed_at     timestamptz,
  reminder_sent_at timestamptz,
  reminder_count   integer not null default 0,
  unique (goal_id, student_id)
);

create index if not exists lesson_plan_assignments_group_idx on public.lesson_plan_assignments (group_id, goal_id);
create index if not exists lesson_plan_assignments_teacher_idx on public.lesson_plan_assignments (teacher_id);
create index if not exists lesson_plan_assignments_student_idx on public.lesson_plan_assignments (student_id);

alter table public.lesson_plan_assignments enable row level security;

create policy "lpa_select" on public.lesson_plan_assignments for select using (
  teacher_id = auth.uid() or student_id = auth.uid()
);

create policy "lpa_insert" on public.lesson_plan_assignments for insert with check (
  teacher_id = auth.uid()
  and exists (
    select 1 from public.group_members gm
    where gm.group_id = lesson_plan_assignments.group_id and gm.user_id = auth.uid() and gm.role = 'admin'
  )
);

create policy "lpa_update" on public.lesson_plan_assignments for update using (
  teacher_id = auth.uid() or student_id = auth.uid()
);
