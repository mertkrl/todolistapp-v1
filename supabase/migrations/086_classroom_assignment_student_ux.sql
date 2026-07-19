-- ### 086_classroom_assignment_student_ux.sql
-- ============================================================
-- Öğrenci tarafı ödev geliştirmeleri:
--  - Teslime dosya/fotoğraf eki
--  - Geç teslim tespiti için submitted_at zaten var, ek alan gerekmiyor
-- ============================================================

alter table public.assignment_submissions
  add column if not exists attachment jsonb;

comment on column public.assignment_submissions.attachment is
  'Öğrencinin teslime eklediği dosya (chat-files bucket''ında saklanır): {name, size, type, bucket_path}';
