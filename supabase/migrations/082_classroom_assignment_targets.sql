-- ### 082_classroom_assignment_targets.sql
-- ============================================================
-- Ödev verirken öğretmenin belirli öğrencileri seçebilmesi için:
-- target_user_ids null ise ödev tüm sınıfa, doluysa yalnızca
-- listedeki üyelere görünür/atanmış sayılır.
-- ============================================================

alter table public.classroom_assignments
  add column if not exists target_user_ids uuid[];

comment on column public.classroom_assignments.target_user_ids is
  'null = tüm sınıfa; doluysa yalnızca bu user_id listesine atanmış ödev';
