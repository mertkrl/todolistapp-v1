-- ### 101_lpa_student_delete_rejected.sql
-- ============================================================
-- Öğrenci, reddettiği bir ders planı isteğini artık 7 gün beklemeden,
-- istediği zaman kendi listesinden silebilsin. Önceki "lpa_delete" politikası
-- sadece öğretmenin kendi attığı kayıtları silmesine izin veriyordu.
-- ============================================================

drop policy if exists "lpa_delete" on public.lesson_plan_assignments;
create policy "lpa_delete" on public.lesson_plan_assignments for delete using (
    teacher_id = auth.uid()
    or (student_id = auth.uid() and status = 'rejected')
);
