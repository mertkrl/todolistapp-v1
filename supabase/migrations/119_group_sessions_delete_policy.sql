-- ### 119_group_sessions_delete_policy.sql
-- ============================================================
-- Bug: "Seansı Sil" öğretmende/yönetici üyede çalışmıyordu. Sebep: 028'deki
-- DELETE policy yalnızca `created_by = auth.uid()` (gerçek oluşturan) izin
-- veriyordu — 118'de UPDATE policy'yi admin/moderator'a genişlettiğimiz
-- hâlde DELETE'i unutmuştuk. Bir yönetici, kendisinin oluşturmadığı bir
-- seansı silmeye çalışınca istek RLS tarafından sessizce 0 satır etkileyerek
-- "başarılı" görünüyor ama hiçbir şey silinmiyordu.
-- ============================================================

drop policy if exists "Session creator can delete" on public.group_sessions;

create policy "Session creator or manager can delete"
  on public.group_sessions for delete
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = group_sessions.group_id
        and gm.user_id = auth.uid()
        and gm.role in ('admin', 'moderator')
    )
  );
