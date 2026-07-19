-- ### 085_classroom_assignment_teacher_ux.sql
-- ============================================================
-- Öğretmen tarafı ödev geliştirmeleri:
--  - Öncelik alanı (normal/önemli/acil)
--  - Notlandırma + öğretmen geri bildirimi (teslim başına)
--  - Ödev şablonları (tekrar eden ödevleri hızlıca yeniden kullanma)
-- ============================================================

alter table public.classroom_assignments
  add column if not exists priority text not null default 'normal'
    check (priority in ('normal', 'important', 'urgent')),
  add column if not exists attachment jsonb;

comment on column public.classroom_assignments.attachment is
  'Ek dosya bilgisi (chat-files bucket''ında saklanır): {name, size, type, bucket_path}';

alter table public.assignment_submissions
  add column if not exists grade integer check (grade is null or (grade >= 0 and grade <= 100)),
  add column if not exists teacher_feedback text;

comment on column public.assignment_submissions.grade is 'Öğretmen tarafından verilen 0-100 arası puan (opsiyonel)';
comment on column public.assignment_submissions.teacher_feedback is 'Öğretmenin teslime yazdığı geri bildirim (opsiyonel)';

-- Ödev şablonları — öğretmen bir ödevi şablon olarak kaydedip başka sınıflarda/haftalarda yeniden kullanabilir
create table public.assignment_templates (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  created_by  uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  description text default '',
  priority    text not null default 'normal' check (priority in ('normal', 'important', 'urgent')),
  created_at  timestamptz not null default now()
);

create index assignment_templates_group_idx on public.assignment_templates (group_id, created_at desc);

alter table public.assignment_templates enable row level security;

create policy "assignment_templates_select" on public.assignment_templates for select using (
  exists (select 1 from public.group_members gm where gm.group_id = assignment_templates.group_id and gm.user_id = auth.uid())
);
create policy "assignment_templates_insert" on public.assignment_templates for insert with check (
  created_by = auth.uid()
  and exists (select 1 from public.group_members gm where gm.group_id = assignment_templates.group_id and gm.user_id = auth.uid())
);
create policy "assignment_templates_delete" on public.assignment_templates for delete using (
  created_by = auth.uid()
  or exists (select 1 from public.group_members gm where gm.group_id = assignment_templates.group_id and gm.user_id = auth.uid() and gm.role = 'admin')
);

-- Teslim tablosunda grade/teacher_feedback güncellemesi yalnızca sınıf yöneticisine (öğretmene) açık
create policy "submissions_update_grade" on public.assignment_submissions for update using (
  exists (
    select 1 from public.classroom_assignments ca
    join public.group_members gm on gm.group_id = ca.group_id
    where ca.id = assignment_submissions.assignment_id and gm.user_id = auth.uid() and gm.role = 'admin'
  )
);

alter publication supabase_realtime add table public.assignment_templates;
