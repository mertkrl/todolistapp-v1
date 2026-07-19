-- ### 105_classroom_admin_helper_and_target_rls.sql
-- ============================================================
-- İki düzeltme:
--
-- 1) Rol kontrolü standardizasyonu: sınıf gruplarında "Öğretmen" rolü
--    verilen üyeler (084 migration) group_members.role alanında literal
--    'admin' değil, group_custom_roles.id (uuid) taşıyor. Ama 044/085/093
--    migration'larındaki RLS politikaları hâlâ `gm.role = 'admin'` literal
--    string kontrolü yapıyor — bu yüzden kurucu olmayan bir öğretmen
--    (kurum admini tarafından sınıfa "Öğretmen" rolüyle eklenmiş biri)
--    ödev silme/güncelleme, şablon silme, not verme ve duyuru yayınlama
--    gibi işlemlerde RLS'e sessizce takılıyordu (buton tıklanıyor, hiçbir
--    şey olmuyor). `public.is_group_admin()` artık hem literal 'admin'
--    hem de manage_rooms=true olan özel rolleri (ör. "Öğretmen") kabul
--    ediyor.
--
-- 2) `classroom_assignments.target_user_ids` (082 migration) yalnızca
--    client tarafında filtreleniyordu; RLS select politikası tüm grup
--    üyelerine tüm satırları açıyordu. Artık hedefli bir ödev, yalnızca
--    hedef listesindeki öğrenciye, oluşturana ve sınıf yöneticisine
--    (öğretmene) görünüyor.
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
  );
$$;

grant execute on function public.is_group_admin(uuid, uuid) to authenticated;

-- ---- classroom_assignments -----------------------------------------------

drop policy if exists "assignments_select" on public.classroom_assignments;
create policy "assignments_select" on public.classroom_assignments for select using (
  created_by = auth.uid()
  or (
    exists (select 1 from public.group_members gm where gm.group_id = classroom_assignments.group_id and gm.user_id = auth.uid())
    and (
      target_user_ids is null
      or auth.uid() = any (target_user_ids)
      or public.is_group_admin(group_id, auth.uid())
    )
  )
);

drop policy if exists "assignments_update" on public.classroom_assignments;
create policy "assignments_update" on public.classroom_assignments for update using (
  created_by = auth.uid()
  or public.is_group_admin(group_id, auth.uid())
);

drop policy if exists "assignments_delete" on public.classroom_assignments;
create policy "assignments_delete" on public.classroom_assignments for delete using (
  created_by = auth.uid()
  or public.is_group_admin(group_id, auth.uid())
);

-- ---- assignment_submissions -----------------------------------------------

drop policy if exists "submissions_select" on public.assignment_submissions;
create policy "submissions_select" on public.assignment_submissions for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.classroom_assignments ca
    where ca.id = assignment_id and public.is_group_admin(ca.group_id, auth.uid())
  )
);

drop policy if exists "submissions_update_grade" on public.assignment_submissions;
create policy "submissions_update_grade" on public.assignment_submissions for update using (
  exists (
    select 1 from public.classroom_assignments ca
    where ca.id = assignment_submissions.assignment_id and public.is_group_admin(ca.group_id, auth.uid())
  )
);

-- ---- assignment_templates -----------------------------------------------

drop policy if exists "assignment_templates_delete" on public.assignment_templates;
create policy "assignment_templates_delete" on public.assignment_templates for delete using (
  created_by = auth.uid()
  or public.is_group_admin(group_id, auth.uid())
);

-- ---- group_announcement_log -----------------------------------------------

drop policy if exists "gal_insert" on public.group_announcement_log;
create policy "gal_insert" on public.group_announcement_log for insert with check (
  author_id = auth.uid()
  and public.is_group_admin(group_id, auth.uid())
);
