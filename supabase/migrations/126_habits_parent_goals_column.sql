-- habit_goals join tablosu, alışkanlık satırı ile ayrı bir yazma adımı gerektiriyordu.
-- Hard refresh, bu iki yazma arasında araya girince (biri gidip diğeri gitmeyince)
-- "ana hedef bağlantısı kayboluyor" hatasına yol açıyordu. parentGoals'ı doğrudan
-- habits satırının kendisine taşıyarak tek bir atomik upsert'e indiriyoruz.
alter table public.habits
  add column if not exists parent_goals jsonb not null default '[]'::jsonb;

-- Mevcut habit_goals verisini yeni sütuna taşı (varsa).
update public.habits h
set parent_goals = coalesce((
  select jsonb_agg(hg.goal_id)
  from public.habit_goals hg
  where hg.habit_id = h.id
), '[]'::jsonb)
where exists (select 1 from public.habit_goals hg where hg.habit_id = h.id);
