-- ### 112_classroom_perf_snapshots.sql
-- ============================================================
-- Performans ölçme sisteminin en büyük eksiği: her bakışta SADECE anlık
-- bir kesit vardı (bkz. performans analizi, 2026-07-11) — bir öğrenci
-- "Destek Önerilir" rozeti aldıktan bir hafta sonra öğretmen tekrar
-- baktığında "geçen hafta da böyleydi, düzeldi mi kötüleşti mi" sorusuna
-- cevap yoktu. Gerçek bir cron/scheduled-job altyapısı kurmak (ör.
-- Supabase Edge Function + pg_cron) bu ortamdan yapılamayacağı için,
-- pragmatik bir yaklaşım: öğretmen Performans sekmesini her açtığında
-- İSTEMCİ, o haftanın (Pazartesi başlangıçlı, TR saati) satırını UPSERT
-- eder. Aynı hafta içinde tekrar tekrar açılması sadece o haftanın
-- satırını GÜNCELLER (week_start aynı kaldığı sürece geçmiş bozulmaz),
-- hafta değiştiğinde yeni bir satır oluşur — bu da haftalık "an" kesitler
-- zinciri oluşturur, gerçek bir cron kadar hassas olmasa da (öğretmen o
-- hafta hiç panele bakmazsa o haftanın kesiti oluşmaz) sıfır ek altyapı
-- gerektirir.
-- ============================================================

create table if not exists public.classroom_perf_snapshots (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  pct integer,             -- o haftaki ödev tamamlama % (buildPerfRows 'all' periyoduyla hesaplanır)
  assigned integer,        -- o haftaki güvenilirlik bağlamı için (kaç ödev üzerinden)
  support_flag boolean not null default false,
  anomaly text,            -- 'focus_drop_z' | 'focus_drop' | 'assignment_decline' | 'focus_output_mismatch' | null
  created_at timestamptz not null default now(),
  unique (group_id, user_id, week_start)
);

alter table public.classroom_perf_snapshots enable row level security;

-- Sadece o sınıfın admini (öğretmeni) kendi sınıfının kesitlerini
-- görebilir/yazabilir — group_student_weekly_load (092) ile aynı yetki
-- deseni. Öğrenciye YOK: bu tablo öğretmenin "değişim izleme" aracı,
-- öğrencinin kendi Kendi Aynan paneli zaten kendi verisine ayrıca erişiyor.
create policy "classroom_perf_snapshots_admin_select" on public.classroom_perf_snapshots
  for select using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = classroom_perf_snapshots.group_id
        and gm.user_id = auth.uid()
        and gm.role = 'admin'
    )
  );

create policy "classroom_perf_snapshots_admin_upsert" on public.classroom_perf_snapshots
  for insert with check (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = classroom_perf_snapshots.group_id
        and gm.user_id = auth.uid()
        and gm.role = 'admin'
    )
  );

create policy "classroom_perf_snapshots_admin_update" on public.classroom_perf_snapshots
  for update using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = classroom_perf_snapshots.group_id
        and gm.user_id = auth.uid()
        and gm.role = 'admin'
    )
  );

create index if not exists classroom_perf_snapshots_lookup
  on public.classroom_perf_snapshots (group_id, week_start desc, user_id);
