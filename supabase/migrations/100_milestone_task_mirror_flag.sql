-- ### 100_milestone_task_mirror_flag.sql
-- ============================================================
-- Öğretmen ders planı takviminde bir güne saat saat görev eklediğinde, bu artık
-- (099'dan beri) senkron olsun diye otomatik olarak bir "aşama" (milestone)
-- satırına aynalanıyor. Ama bu aynalama, gerçek bir "aşama" değil — sadece tek
-- bir takvim görevinin senkron kopyası. Client tarafında bunu ayırt etmek için
-- `task_mirror_id` alanı kullanılıyordu ama bu tamamen local bir alan olduğu
-- için Supabase'e hiç yazılmıyordu; öğrenci planı önizlediğinde/kabul ettiğinde
-- bu ayrım kayboluyor, aynalanmış görevler sahte birer "aşama" gibi görünüp her
-- biri farklı renkte bir aşama kutusu olarak çiziliyordu.
--
-- Bu kolon o ayrımı kalıcı hale getirir — artık senkronize olur, öğrenci
-- tarafında da aynı şekilde "bu bir aşama değil" olarak tanınır.
-- ============================================================

alter table public.planning_milestones
    add column if not exists is_task_mirror boolean not null default false;
