-- ### 047_faz3_features.sql
-- ============================================================
-- FAZ 3: Gelişmiş Sohbet Araçları
-- Mesaj düzenleme logu + Analitik hazırlığı
-- ============================================================

-- Mesaj düzenleme geçmişi
-- Şema: [{ text, edited_at }]
alter table public.messages
  add column if not exists edit_history jsonb;

-- Verimlilik analitikleri için index (zaman serisi sorguları)
create index if not exists profiles_focus_min_idx on public.profiles (focus_min desc);
create index if not exists profiles_xp_idx        on public.profiles (xp desc);

-- Mesaj iletme: forwarded_from kolonu (zaten varsa skip)
-- messages tablosunda text ve forwardedFrom zaten var; Supabase tarafında
-- forwardedFrom bilgisi attachments veya text içinde taşınıyordu.
-- Temiz bir çözüm için ayrı kolon ekle:
alter table public.messages
  add column if not exists forwarded_from text;  -- iletilen mesajın orijinal sahibi

-- Analitik için günlük aktivite özeti view'ı
create or replace view public.v_member_analytics as
select
  p.id,
  p.username,
  p.display_name,
  p.avatar_color,
  p.institution_role,
  p.xp,
  p.focus_min,
  p.completed_today,
  p.focus_streak,
  p.completed_goals,
  p.last_seen
from public.profiles p
where p.username is not null;
