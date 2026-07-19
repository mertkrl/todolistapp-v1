-- ### 084_classroom_default_roles.sql
-- ============================================================
-- Sınıf/ders grubu kurulunca otomatik "Öğretmen" (tüm yetkiler) ve
-- "Öğrenci" (yetkisiz) özel rolleri oluşturuluyor (bkz. social.js
-- createGroupSupabase). Bu migration, davet kabul edilince öğrencinin
-- otomatik olarak "Öğrenci" rolüne atanmasını sağlıyor.
-- ============================================================

create or replace function public.accept_institution_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.institution_invites%rowtype;
  v_student_role_id uuid;
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

  select id into v_student_role_id
    from public.group_custom_roles
    where group_id = v_invite.group_id and name = 'Öğrenci'
    limit 1;

  insert into public.group_members (group_id, user_id, role)
  values (v_invite.group_id, v_invite.invited_user_id, v_student_role_id::text)
  on conflict do nothing;
end;
$$;

grant execute on function public.accept_institution_invite(uuid) to authenticated;
