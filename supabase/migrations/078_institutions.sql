-- ### 078_institutions.sql
-- ============================================================
-- Kurum/okul kaydı: "institution_name" artık serbest bir metin
-- olarak değil, o öğretmene ait tekil bir `institutions` satırına
-- bağlanır. Bir öğretmen aynı isimde ikinci bir kurum açamaz;
-- sınıf grupları o kuruma referansla oluşur.
-- ============================================================

create table public.institutions (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (owner_id, name)
);

create index institutions_owner_idx on public.institutions (owner_id);

alter table public.groups
  add column if not exists institution_id uuid references public.institutions(id) on delete set null;

create index groups_institution_id_idx on public.groups (institution_id);

alter table public.institutions enable row level security;

-- Görme: kurum sahibi veya o kuruma bağlı bir grubun üyesi
create policy "institutions_select" on public.institutions for select using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.groups g
    join public.group_members gm on gm.group_id = g.id
    where g.institution_id = institutions.id and gm.user_id = auth.uid()
  )
);

-- Oluşturma: yalnızca öğretmen rolündeki kullanıcı, kendi adına
create policy "institutions_insert" on public.institutions for insert with check (
  owner_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.institution_role in ('teacher', 'admin'))
);

-- Silme: yalnızca sahibi
create policy "institutions_delete" on public.institutions for delete using (owner_id = auth.uid());
