-- ### 030_daily_goal.sql
-- Faz 5: profiles tablosuna daily_goal kolonu ekle
-- Bugünün aktif günlük hedefini (highlight) profilde tut
alter table public.profiles
  add column if not exists daily_goal text default '';
