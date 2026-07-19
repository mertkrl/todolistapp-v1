-- Ödevleri çok adımlı hale getirir ("Ders Planı" artık ayrı bir sistem değil,
-- classroom_assignments'ın adımlı/uzun-soluklu bir türü).
alter table public.classroom_assignments
  add column if not exists steps jsonb;

alter table public.assignment_templates
  add column if not exists steps jsonb;

create table if not exists public.assignment_step_progress (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.classroom_assignments(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  step_id       text not null,
  done          boolean not null default false,
  done_at       timestamptz,
  unique (assignment_id, user_id, step_id)
);

create index if not exists assignment_step_progress_asg_idx on public.assignment_step_progress (assignment_id);
create index if not exists assignment_step_progress_user_idx on public.assignment_step_progress (user_id);

alter table public.assignment_step_progress enable row level security;

create policy "asp_select" on public.assignment_step_progress for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.classroom_assignments ca
    join public.group_members gm on gm.group_id = ca.group_id
    where ca.id = assignment_step_progress.assignment_id and gm.user_id = auth.uid()
  )
);

create policy "asp_insert" on public.assignment_step_progress for insert with check ( user_id = auth.uid() );
create policy "asp_update" on public.assignment_step_progress for update using ( user_id = auth.uid() );
