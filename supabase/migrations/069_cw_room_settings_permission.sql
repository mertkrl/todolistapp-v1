-- ### 069_cw_room_settings_permission.sql
-- ============================================================
-- Oda sahibinin "diğer katılımcılar da ayarları değiştirebilsin"
-- iznini açıp kapatabilmesi için tek kolon. RLS'de ek değişiklik
-- gerekmiyor (cw_rooms_update zaten her üyeye izin veriyor) —
-- bu tamamen client tarafında buton görünürlüğünü kontrol eden
-- bir bayrak.
-- ============================================================

alter table public.cw_rooms add column if not exists settings_open_to_all boolean not null default false;
