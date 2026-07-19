-- ### 116_group_class_sections.sql
-- ============================================================
-- Faz 1 — "Şube" (class section) veri modeli: bir okul/kurum TEK bir grup
-- olarak var olur (ör. "Bakırköy Lisesi"); öğrenciler bu tek grubun
-- ÜYESİ olur, "sınıf" artık ayrı bir grup değil, bu grubun İÇİNDEKİ bir
-- etikettir (ör. "9-A", "10-B"). Bu, önceki "her sınıf ayrı grup"
-- (institution_id ile bağlı kardeş gruplar) modelinden kasıtlı bir
-- kopuştur — o model gerçek kullanım şekliyle (bkz. performans analizi
-- tartışması, 2026-07-11) örtüşmüyordu ve tekrarlayan kafa karışıklığına
-- (Sınıflar/Öğrenciler'de "kurum kendisi bir sınıfmış gibi görünüyor",
-- Gruplar listesinde sınıfların sızması vb.) yol açıyordu.
--
-- Bu migration:
--   1. group_class_sections: bir grubun içindeki şube tanımları.
--   2. group_members.class_section_id: her üyenin hangi şubede olduğu
--      (null = henüz şubelenmemiş / "Sınıfsız").
--   3. Veri taşıma: aynı institution_id'yi paylaşan ESKİ kardeş sınıf
--      gruplarının (institutions/078, "Yeni Sınıf" akışı) üyelerini, o
--      kurumun EN ESKİ classroom_type grubuna (yeni "tek grup" olacak)
--      şube olarak taşır. Eski kardeş gruplar SİLİNMEZ (veri kaybı
--      olmasın diye) — sadece artık kullanılmayan, boşalmış kalıntılar
--      olarak kalırlar; öğretmen isterse elle silebilir.
-- ============================================================

create table public.group_class_sections (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  name        text not null,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  unique (group_id, name)
);

create index group_class_sections_group_idx on public.group_class_sections (group_id);

alter table public.group_class_sections enable row level security;

create policy "group_class_sections_select" on public.group_class_sections for select using (
  exists (select 1 from public.group_members gm where gm.group_id = group_class_sections.group_id and gm.user_id = auth.uid())
);
create policy "group_class_sections_insert" on public.group_class_sections for insert with check (
  exists (select 1 from public.group_members gm where gm.group_id = group_class_sections.group_id and gm.user_id = auth.uid() and gm.role in ('admin', 'moderator'))
);
create policy "group_class_sections_update" on public.group_class_sections for update using (
  exists (select 1 from public.group_members gm where gm.group_id = group_class_sections.group_id and gm.user_id = auth.uid() and gm.role in ('admin', 'moderator'))
);
create policy "group_class_sections_delete" on public.group_class_sections for delete using (
  exists (select 1 from public.group_members gm where gm.group_id = group_class_sections.group_id and gm.user_id = auth.uid() and gm.role in ('admin', 'moderator'))
);

alter table public.group_members
  add column if not exists class_section_id uuid references public.group_class_sections(id) on delete set null;

create index group_members_class_section_idx on public.group_members (class_section_id);

-- ── Veri taşıma: eski kardeş-grup sınıflarını şubeye çevir ──
do $$
declare
  inst record;
  primary_group_id uuid;
  sib record;
  new_section_id uuid;
  sib_member record;
begin
  for inst in (select id from public.institutions) loop
    -- Bu kurumun en eski classroom_type grubu = yeni "tek grup" (öğrencilerin asıl üyesi olacağı yer)
    select id into primary_group_id from public.groups
      where institution_id = inst.id and classroom_type = 'classroom'
      order by created_at asc limit 1;
    if primary_group_id is null then
      continue;
    end if;

    for sib in (
      select id, name, created_by from public.groups
      where institution_id = inst.id and classroom_type = 'classroom' and id <> primary_group_id
    ) loop
      -- Bu kardeş sınıfın adını, ana grupta bir şube olarak oluştur (aynı isimde zaten varsa onu kullan)
      select id into new_section_id from public.group_class_sections
        where group_id = primary_group_id and name = sib.name;
      if new_section_id is null then
        insert into public.group_class_sections (group_id, name, created_by)
        values (primary_group_id, sib.name, sib.created_by)
        returning id into new_section_id;
      end if;

      -- Bu kardeş sınıftaki her (admin olmayan) üyeyi ana gruba, bu şube etiketiyle taşı
      for sib_member in (
        select user_id from public.group_members
        where group_id = sib.id and (role is distinct from 'admin')
      ) loop
        insert into public.group_members (group_id, user_id, role, class_section_id)
        values (primary_group_id, sib_member.user_id, null, new_section_id)
        on conflict (group_id, user_id) do update set class_section_id = excluded.class_section_id;
      end loop;
    end loop;
  end loop;
end $$;
