-- ### 104_group_schedule_draft_publish.sql
-- ============================================================
-- Ders Programı — taslak/yayınla akışı. Şimdiye kadar group_class_schedule
-- satırları eklenir eklenmez tüm sınıf tarafından görünüyordu. Bu migration
-- bir "program" (group_schedule_programs) kavramı ekler: öğretmen dersleri
-- taslak halde ekleyip düzenler, "Yayınla" deyince o program sınıfa
-- tanımlanmış olur (status='published') ve önceki yayındaki program
-- otomatik arşivlenir (tek seferde 1 aktif/yayınlanmış program).
-- ============================================================

create table public.group_schedule_programs (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups(id) on delete cascade,
  name         text not null default 'Ders Programı',
  status       text not null default 'draft' check (status in ('draft','published','archived')),
  created_by   uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  published_at timestamptz
);

create index group_schedule_programs_group_idx on public.group_schedule_programs (group_id, status);

alter table public.group_schedule_programs enable row level security;

create policy "gsp_select" on public.group_schedule_programs for select using (
  (status = 'published' and exists (
    select 1 from public.group_members gm where gm.group_id = group_schedule_programs.group_id and gm.user_id = auth.uid()
  ))
  or created_by = auth.uid()
);

create policy "gsp_insert" on public.group_schedule_programs for insert with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.group_members gm
    where gm.group_id = group_schedule_programs.group_id and gm.user_id = auth.uid() and gm.role = 'admin'
  )
);

create policy "gsp_update" on public.group_schedule_programs for update using (
  created_by = auth.uid()
  and exists (
    select 1 from public.group_members gm
    where gm.group_id = group_schedule_programs.group_id and gm.user_id = auth.uid() and gm.role = 'admin'
  )
) with check (
  created_by = auth.uid()
);

create policy "gsp_delete" on public.group_schedule_programs for delete using (
  created_by = auth.uid()
  and exists (
    select 1 from public.group_members gm
    where gm.group_id = group_schedule_programs.group_id and gm.user_id = auth.uid() and gm.role = 'admin'
  )
);

alter publication supabase_realtime add table public.group_schedule_programs;

-- ── group_class_schedule: program_id ekle, mevcut satırları arkaya dönük
-- uyumlu tutmak için var olan her grubun satırlarını tek bir "yayınlanmış"
-- programa taşı.
alter table public.group_class_schedule add column program_id uuid references public.group_schedule_programs(id) on delete cascade;

do $$
declare
  g record;
  new_program_id uuid;
begin
  for g in (select distinct group_id, created_by from public.group_class_schedule where program_id is null) loop
    insert into public.group_schedule_programs (group_id, name, status, created_by, published_at)
    values (g.group_id, 'Ders Programı', 'published', g.created_by, now())
    returning id into new_program_id;

    update public.group_class_schedule
    set program_id = new_program_id
    where group_id = g.group_id and program_id is null;
  end loop;
end $$;

-- Eski, program_id'siz satırlar RLS'de görünmesin diye select politikası program
-- üzerinden kontrol ediyor; artık program_id zorunlu.
alter table public.group_class_schedule alter column program_id set not null;

drop policy if exists "gcs_select" on public.group_class_schedule;
drop policy if exists "gcs_insert" on public.group_class_schedule;
drop policy if exists "gcs_delete" on public.group_class_schedule;

create policy "gcs_select" on public.group_class_schedule for select using (
  exists (
    select 1 from public.group_schedule_programs p
    where p.id = group_class_schedule.program_id
      and (
        (p.status = 'published' and exists (
          select 1 from public.group_members gm where gm.group_id = p.group_id and gm.user_id = auth.uid()
        ))
        or p.created_by = auth.uid()
      )
  )
);

create policy "gcs_insert" on public.group_class_schedule for insert with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.group_schedule_programs p
    where p.id = group_class_schedule.program_id
      and p.created_by = auth.uid()
      and exists (
        select 1 from public.group_members gm
        where gm.group_id = p.group_id and gm.user_id = auth.uid() and gm.role = 'admin'
      )
  )
);

create policy "gcs_delete" on public.group_class_schedule for delete using (
  exists (
    select 1 from public.group_schedule_programs p
    where p.id = group_class_schedule.program_id
      and p.created_by = auth.uid()
      and exists (
        select 1 from public.group_members gm
        where gm.group_id = p.group_id and gm.user_id = auth.uid() and gm.role = 'admin'
      )
  )
);
