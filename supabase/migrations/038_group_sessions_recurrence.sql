-- ### 038_group_sessions_recurrence.sql
-- FocusAI -> Supabase Migration 038: Tekrarlayan grup seansları.
-- Sunucu tarafında cron/scheduled function kurmak yerine, "Her hafta tekrarla"
-- işaretlendiğinde client birkaç haftalık satırı tek seferde oluşturuyor ve
-- hepsini aynı recurrence_group_id ile etiketliyor — toplu silme/görsel ayrım için.

alter table public.group_sessions
  add column if not exists recurrence_group_id uuid;

create index if not exists group_sessions_recurrence_idx
  on public.group_sessions (recurrence_group_id);
