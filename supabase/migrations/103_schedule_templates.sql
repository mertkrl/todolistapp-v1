-- ### 103_schedule_templates.sql
-- Ders Programı şablonları: bir öğretmenin sınıfa bağlı olmadan önceden hazırlayıp,
-- yeni bir sınıf açıldığında tek tıkla uygulayabileceği haftalık program taslakları.
-- group_class_schedule (095) sınıfa bağlı zorunlu group_id istediği için şablonlar
-- ayrı, sahibi (owner) bazlı bir tabloda tutulur; uygulanınca slotlar
-- group_class_schedule'a kopyalanır.

create table public.schedule_templates (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
create index schedule_templates_owner_idx on public.schedule_templates (owner_id);

alter table public.schedule_templates enable row level security;
create policy "schedule_templates_owner_all" on public.schedule_templates for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table public.schedule_template_slots (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.schedule_templates(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  time_start  time not null,
  time_end    time not null,
  subject     text not null,
  created_at  timestamptz not null default now()
);
create index schedule_template_slots_template_idx on public.schedule_template_slots (template_id);

alter table public.schedule_template_slots enable row level security;
create policy "schedule_template_slots_owner_all" on public.schedule_template_slots for all
  using (exists (select 1 from public.schedule_templates t where t.id = template_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from public.schedule_templates t where t.id = template_id and t.owner_id = auth.uid()));

alter publication supabase_realtime add table public.schedule_templates;
alter publication supabase_realtime add table public.schedule_template_slots;
