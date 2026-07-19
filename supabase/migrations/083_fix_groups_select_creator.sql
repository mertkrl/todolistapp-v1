-- ### 083_fix_groups_select_creator.sql
-- ============================================================
-- Bug: Sınıf/Ders veya İş Yeri/Ekip grubu oluşturulurken "new row
-- violates row-level security policy for table groups" hatası.
--
-- Sebep: 082 öncesi bir turda eklenen "kurumsal (classroom/workplace)
-- gruplarda erişim türü otomatik 'private'" özelliği bu bug'ı açığa
-- çıkardı. createGroupSupabase() `.insert({...}).select().single()`
-- kullanıyor; PostgREST, INSERT ... RETURNING için satırın SELECT
-- policy'sini de sağlamasını şart koşuyor (aynı kalıp 063'te
-- focus_challenges için de yaşanmıştı). groups_select (004):
--   privacy = 'public' OR group_members'da üye
-- private bir grup insert edilirken kurucu henüz group_members'a
-- eklenmemiş (o ayrı bir sonraki sorgu) → hiçbir koşul sağlanmıyor
-- → RETURNING reddediliyor ve 42501 fırlıyor.
--
-- Çözüm (063'teki ile aynı desen): created_by = auth.uid() koşulunu
-- ekle — kurucu üyelik/gizlilik durumundan bağımsız her zaman kendi
-- grubunu görebilsin.
-- ============================================================

drop policy if exists "groups_select" on public.groups;
create policy "groups_select" on public.groups for select using (
  created_by = auth.uid()
  or privacy = 'public'
  or exists (select 1 from public.group_members gm where gm.group_id = groups.id and gm.user_id = auth.uid())
);
