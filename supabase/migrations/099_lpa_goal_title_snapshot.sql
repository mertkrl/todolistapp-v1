-- ### 099_lpa_goal_title_snapshot.sql
-- ============================================================
-- lesson_plan_assignments'a plan başlığının bir kopyası (goal_title) eklenir.
-- Öğrenci, kendi atama satırlarını listelerken planning_goals(title) join'i
-- kullanıyordu — ama planning_goals'ın RLS'i sadece sahibine (öğretmene) izin
-- verdiği için bu join öğrenci için hep boş dönüyordu. Atama anında başlığı
-- burada da saklamak, ek bir RPC/RLS istisnasına gerek kalmadan bu sorunu çözer.
-- ============================================================

alter table public.lesson_plan_assignments
    add column if not exists goal_title text;
