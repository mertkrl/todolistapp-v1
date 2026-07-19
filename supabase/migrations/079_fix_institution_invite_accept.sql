-- ### 079_fix_institution_invite_accept.sql
-- ============================================================
-- Bugfix: davet kabul edilince "new row violates row-level security
-- policy for table institution_invites" hatası.
--
-- Sebep: 076'daki institution_invites_update politikasının WITH CHECK
-- kısmı yalnızca status='rejected'/'cancelled' geçişine izin veriyordu;
-- accept_institution_invite() fonksiyonu status='accepted' yazmaya
-- çalışınca (SECURITY DEFINER olsa da) bu politika işlemi reddediyor
-- ve tüm fonksiyon transaction'ı (group_members insert dahil) rollback
-- oluyordu.
--
-- Fix: politikayı 'accepted'i de kabul edecek şekilde genişletiyoruz
-- VE group_members_insert'e, kabul edilmiş bir davete sahip öğrencinin
-- kendini ekleyebileceği açık bir dal ekliyoruz — böylece akış,
-- SECURITY DEFINER bypass davranışına güvenmeden salt RLS ile de çalışır.
-- ============================================================

drop policy if exists "institution_invites_update" on public.institution_invites;
create policy "institution_invites_update" on public.institution_invites for update using (
  invited_user_id = auth.uid() or invited_by = auth.uid()
) with check (
  status in ('accepted', 'rejected', 'cancelled')
);

drop policy if exists "group_members_insert" on public.group_members;
create policy "group_members_insert" on public.group_members for insert with check (
  (
    user_id = auth.uid()
    and not exists (
      select 1 from public.groups g where g.id = group_members.group_id and g.classroom_type = 'classroom'
    )
  )
  -- Grubun kurucusu (öğretmen) kendini classroom tipi grupta da ekleyebilir
  or (
    user_id = auth.uid()
    and exists (select 1 from public.groups g where g.id = group_members.group_id and g.created_by = auth.uid())
  )
  -- Kabul edilmiş bir kurum daveti varsa öğrenci kendini ekleyebilir
  or (
    user_id = auth.uid()
    and exists (
      select 1 from public.institution_invites ii
      where ii.group_id = group_members.group_id and ii.invited_user_id = auth.uid() and ii.status = 'accepted'
    )
  )
  or exists (
    select 1 from public.group_members gm
    where gm.group_id = group_members.group_id and gm.user_id = auth.uid() and gm.role in ('admin', 'moderator')
  )
);

-- Fonksiyonu, önce daveti kabul edilmiş işaretleyip SONRA group_members'a
-- ekleyecek sırayla yeniden yazıyoruz (yukarıdaki yeni policy dalının
-- aynı transaction içinde görebilmesi için sıra önemli).
create or replace function public.accept_institution_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.institution_invites%rowtype;
begin
  select * into v_invite from public.institution_invites where id = p_invite_id for update;

  if v_invite.id is null then
    raise exception 'Davet bulunamadı.';
  end if;
  if v_invite.invited_user_id <> auth.uid() then
    raise exception 'Bu davet sana ait değil.';
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'Bu davet artık geçerli değil.';
  end if;

  update public.institution_invites
    set status = 'accepted', responded_at = now()
    where id = p_invite_id;

  insert into public.group_members (group_id, user_id, role)
  values (v_invite.group_id, v_invite.invited_user_id, null)
  on conflict do nothing;
end;
$$;

grant execute on function public.accept_institution_invite(uuid) to authenticated;
