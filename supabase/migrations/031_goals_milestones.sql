-- ### 031_goals_milestones.sql
-- Goals tablosuna milestones JSONB sütunu ekle
-- Dönüm noktaları (milestones) goals objesi içinde nested olarak saklanır.
-- Bu sütun, senkronizasyon sırasında milestone verilerinin kaybolmasını önler.

alter table public.goals add column if not exists milestones jsonb not null default '[]'::jsonb;
