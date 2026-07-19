-- ### 027_cleanup_duplicate_invites.sql
-- ============================================================
-- M27: Birikmiş tekrar eden buddy_habit_invites kayıtlarını temizle
--
-- Aynı (from_id, to_id) çifti için birden fazla davet kaydı
-- varsa sadece en yeni olanı bırak, diğerlerini sil.
-- Bu migration bir kez çalıştırılır; sonraki davetler artık
-- uygulama tarafında tekilleştiriliyor.
-- ============================================================

delete from public.buddy_habit_invites
where id not in (
    select distinct on (from_id, to_id) id
    from public.buddy_habit_invites
    order by from_id, to_id, created_at desc
);
