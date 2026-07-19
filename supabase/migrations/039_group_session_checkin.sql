-- ### 039_group_session_checkin.sql
-- FocusAI -> Supabase Migration 039: Seans check-in (gerçek katılım takibi).
-- RSVP ("Varım") sadece niyet; "Şimdi Başla" butonuna basıldığında bu satır
-- check_in edilmiş sayılır, böylece "katılım oranı" gerçek bir sinyale dayanır.

alter table public.group_session_attendees
  add column if not exists checked_in_at timestamptz;
