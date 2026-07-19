-- ### 117_schedule_programs_by_section.sql
-- ============================================================
-- Faz 2 — Ders Programı artık grup başına değil, ŞUBE başına (116'daki
-- group_class_sections). Önceden bir "sınıf" = ayrı bir grup olduğundan
-- group_schedule_programs.group_id tek başına yeterliydi; artık aynı
-- grupta birden çok şube olabildiğinden, hangi programın hangi şubeye
-- ait olduğunu ayırt etmek için class_section_id eklenir.
-- class_section_id = null → "Genel" program (hiçbir şubeye atanmamış
-- öğrenciler + şube ayrımı yapmayan öğretmenler için).
-- ============================================================

alter table public.group_schedule_programs
  add column if not exists class_section_id uuid references public.group_class_sections(id) on delete cascade;

create index if not exists group_schedule_programs_section_idx
  on public.group_schedule_programs (group_id, class_section_id, status);

-- Görme politikası: öğrenci sadece KENDİ şubesinin (veya class_section_id null olan
-- "Genel") yayınlanmış programını görebilir — önceki politika grup üyeliği yeterliydi,
-- bu da bir öğrencinin başka bir şubenin programını görmesine izin veriyordu.
drop policy if exists "gsp_select" on public.group_schedule_programs;
create policy "gsp_select" on public.group_schedule_programs for select using (
  created_by = auth.uid()
  or (
    status = 'published'
    and exists (
      select 1 from public.group_members gm
      where gm.group_id = group_schedule_programs.group_id and gm.user_id = auth.uid()
        and (
          group_schedule_programs.class_section_id is null
          or gm.class_section_id = group_schedule_programs.class_section_id
        )
    )
  )
);
