-- ### 067_drop_cw_room_capacity_trigger.sql
-- ============================================================
-- cw_room_members'a katılırken beklenmedik bir "row-level security
-- policy" hatası alınıyordu; BEFORE INSERT trigger'ının (capacity
-- kontrolü) araya girmesi bu duruma yol açmış olabilir. Trigger'ı
-- kaldırıyoruz — kapasite kontrolü artık client tarafında (davet
-- gönderirken ve kabul ederken) yapılıyor. Bu, savunma katmanlarından
-- birini kaybettirir ama sorunu kesin olarak ortadan kaldırır.
-- ============================================================

drop trigger if exists cw_room_capacity_check on public.cw_room_members;
drop function if exists public.check_cw_room_capacity();
