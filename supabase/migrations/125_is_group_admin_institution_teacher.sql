-- ### 125_is_group_admin_institution_teacher.sql
-- ============================================================
-- 124_group_members_admin_rls_fix.sql, group_members UPDATE/DELETE'i
-- is_group_admin()'e taşıdı — ama şube ataması hâlâ sayfa yenilenince
-- geri dönüyordu. Sebep: is_group_admin() sadece group_members.role'e
-- (literal 'admin' veya manage_rooms=true özel rol) bakıyor. Ama
-- client (_isInstitutionalAdmin, social.js) bir kullanıcıyı sınıf
-- yöneticisi sayarken ÜÇÜNCÜ bir yol daha kabul ediyor:
-- profiles.institution_role = 'teacher' — bu, group_members'daki
-- role'den TAMAMEN BAĞIMSIZ, profil düzeyinde bir bayrak (078/044).
-- Bu bayrağa sahip bir öğretmenin belirli bir sınıf grubundaki
-- group_members.role'ü 'admin' olmayabilir (ör. 116 şube taşıma
-- sırasında satır 'admin' olmayan bir değerle oluşmuş olabilir) —
-- arayüz onu yönetici gibi gösterip işlemi "başarılı" gösteriyor,
-- ama RLS institution_role'ü hiç kontrol etmediği için satır
-- gerçekte değişmiyordu.
--
-- Çözüm: is_group_admin(), classroom/workplace tipi bir grup için,
-- kullanıcının profiles.institution_role = 'teacher' olması durumunu
-- da admin kabul eder — tıpkı client'ın zaten yaptığı gibi.
-- ============================================================

create or replace function public.is_group_admin(p_group_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_user_id
      and (
        gm.role = 'admin'
        or exists (
          select 1 from public.group_custom_roles gcr
          where gcr.id::text = gm.role
            and gcr.group_id = p_group_id
            and gcr.manage_rooms = true
        )
      )
  )
  or exists (
    select 1 from public.groups g
    join public.profiles p on p.id = p_user_id
    where g.id = p_group_id
      and g.classroom_type in ('classroom', 'workplace')
      and p.institution_role = 'teacher'
      and public.is_group_member(p_group_id, p_user_id)
  );
$$;

grant execute on function public.is_group_admin(uuid, uuid) to authenticated;
