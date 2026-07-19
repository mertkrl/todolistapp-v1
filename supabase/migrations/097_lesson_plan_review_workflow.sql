-- ### 097_lesson_plan_review_workflow.sql
-- ============================================================
-- Ders planı atama akışını genişletir: öğrenci artık sadece kabul/red değil,
-- "revize iste" de diyebiliyor (açıklama yazarak). Red durumunda kayıt 7 gün
-- "Reddedilenler" listesinde bekler, öğretmen o süre içinde tekrar gönderebilir
-- veya revize edip yeniden atayabilir; süre dolunca otomatik silinir.
--
-- planning_milestones'a start_time/end_time eklenir — öğretmenin planlama
-- takviminde saat saat oluşturduğu program artık senkronize olabilir (önceden
-- sadece tarih aralığı senkronize oluyordu, saatli içerik sadece öğretmenin
-- kendi cihazındaki local `tasks` dizisinde kalıyordu ve öğrenciye hiç ulaşmıyordu).
-- ============================================================

alter table public.planning_milestones
    add column if not exists start_time time,
    add column if not exists end_time time;

alter table public.lesson_plan_assignments
    add column if not exists student_note text,
    add column if not exists teacher_note text,
    add column if not exists expires_at timestamptz;

alter table public.lesson_plan_assignments drop constraint if exists lesson_plan_assignments_status_check;
alter table public.lesson_plan_assignments
    add constraint lesson_plan_assignments_status_check
    check (status in ('invited', 'accepted', 'rejected', 'revision_requested', 'completed'));

drop policy if exists "lpa_delete" on public.lesson_plan_assignments;
create policy "lpa_delete" on public.lesson_plan_assignments for delete using (
    teacher_id = auth.uid()
);
