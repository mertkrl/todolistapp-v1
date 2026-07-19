-- ### 124_group_members_admin_rls_fix.sql
-- ============================================================
-- group_members UPDATE/DELETE politikaları (011_fix_group_members_recursion)
-- hâlâ role = 'admin' (silme için ayrıca 'moderator') literal string
-- kontrolü yapıyordu. Ama 084/105 migration'larından beri sınıf
-- gruplarında öğretmenler group_members.role alanında literal 'admin'
-- DEĞİL, group_custom_roles.id (uuid, ör. "Öğretmen" rolü) taşıyabiliyor.
--
-- Sonuç: arayüzde sınıf yöneticisi gibi görünen (isClassAdmin=true) ama
-- group_members.role'ü literal 'admin' olmayan bir öğretmen için:
--   - öğrenciyi bir şubeye atama (group_members.class_section_id UPDATE)
--   - öğrenciyi sınıftan çıkarma (group_members DELETE)
-- RLS'e sessizce takılıyordu — Supabase UPDATE/DELETE, satır RLS'ten
-- geçmediğinde HATA DÖNDÜRMEZ, sadece 0 satır etkiler. Client optimistic
-- olarak günceller ve "başarılı" toast'ı gösterir, ama sayfa yenilenince
-- (Supabase'ten taze veri çekilince) değişiklik hiç olmamış gibi görünür.
--
-- public.is_group_admin() (105) zaten hem literal 'admin' hem de
-- manage_rooms=true özel rolleri kapsıyor — group_members politikalarını
-- buna taşıyoruz.
-- ============================================================

drop policy "group_members_update" on public.group_members;
create policy "group_members_update" on public.group_members for update using (
  public.is_group_admin(group_members.group_id, auth.uid())
);

drop policy "group_members_delete" on public.group_members;
create policy "group_members_delete" on public.group_members for delete using (
  user_id = auth.uid()
  or public.is_group_admin(group_members.group_id, auth.uid())
);
