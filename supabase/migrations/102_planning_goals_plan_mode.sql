-- plan_mode/context alanları şimdiye kadar sadece client-side'da (localStorage) tutuluyordu,
-- planning_goals tablosunda hiç kolon karşılığı yoktu. Bu yüzden loadGoalsFromServer()'daki
-- merge ({...local, ...sg}) her sunucudan çekişte sg.plan_mode=undefined ile local değeri
-- eziyordu — ders planı kopyaları (öğrencinin kabul ettiği plan) sayfa yenilenince "bireysel
-- plan" görünümüne dönüyor, saat gridi/sürükle-bırak/çakışma uyarıları kayboluyordu.
alter table planning_goals add column if not exists plan_mode text;
alter table planning_goals add column if not exists context jsonb default '{}'::jsonb;
