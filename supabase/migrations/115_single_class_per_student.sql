-- ### 115_single_class_per_student.sql
-- ============================================================
-- Kural: bir öğrenci, aynı kurum (institution_id) içinde aynı anda yalnızca
-- BİR sınıfın (classroom_type='classroom' grubunun) üyesi olabilir. Şu ana
-- kadar bu kural yalnızca "Sınıf değiştir" (roster'daki dropdown) akışında
-- uygulanıyordu (eski üyelik silinip yenisi eklenerek) — ama öğrenci iki
-- FARKLI giriş noktasından (öğretmenin "kullanıcı adıyla ekle" özelliği VEYA
-- bir kurum davetini kabul etmesi) aynı anda birden fazla sınıfa üye
-- olabiliyordu, çünkü o iki yol "önce eski üyelikten çıkar" adımını hiç
-- yapmıyordu.
--
-- Çözüm: tek bir SECURITY DEFINER fonksiyonu (add_or_move_student_to_class)
-- — hedef grubun institution_id'sini bulur, aynı kurumdaki classroom_type
-- gruplarındaki TÜM mevcut üyeliklerini siler, sonra yeni gruba ekler.
-- Hem öğretmenin doğrudan ekleme özelliği (client, group_members.insert
-- yerine bu RPC'yi çağıracak şekilde güncellendi) hem de davet kabul RPC'si
-- (accept_institution_invite, aşağıda yeniden tanımlandı) bu tek fonksiyonu
-- kullanır — kural artık giriş noktasından bağımsız garanti altında.
-- ============================================================

create or replace function public.add_or_move_student_to_class(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_institution_id uuid;
  v_is_admin boolean;
begin
  select institution_id into v_institution_id from public.groups where id = p_group_id;

  -- Yetki kontrolü: çağıran kişi hedef grubun admin/moderatörü olmalı (öğrenci
  -- kendi kendini başka bir sınıfa "ekle"yemez — bu akış öğretmen tarafı içindir;
  -- öğrencinin kendi kabul akışı zaten accept_institution_invite'ta ayrıca ele alınır).
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = auth.uid() and gm.role in ('admin', 'moderator')
  ) into v_is_admin;
  if not v_is_admin then
    raise exception 'Bu işlem için yetkin yok.';
  end if;

  if v_institution_id is not null then
    delete from public.group_members gm
    using public.groups g
    where gm.group_id = g.id
      and g.institution_id = v_institution_id
      and g.classroom_type = 'classroom'
      and gm.user_id = p_user_id
      and gm.group_id <> p_group_id;
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (p_group_id, p_user_id, null)
  on conflict (group_id, user_id) do nothing;
end;
$$;

grant execute on function public.add_or_move_student_to_class(uuid, uuid) to authenticated;

-- accept_institution_invite (079): aynı kuralı davet-kabul akışına da uygula —
-- öğrenci kabul ettiğinde, aynı kurumdaki diğer sınıf üyelikleri otomatik silinir.
create or replace function public.accept_institution_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.institution_invites%rowtype;
  v_institution_id uuid;
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

  select institution_id into v_institution_id from public.groups where id = v_invite.group_id;
  if v_institution_id is not null then
    delete from public.group_members gm
    using public.groups g
    where gm.group_id = g.id
      and g.institution_id = v_institution_id
      and g.classroom_type = 'classroom'
      and gm.user_id = v_invite.invited_user_id
      and gm.group_id <> v_invite.group_id;
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_invite.group_id, v_invite.invited_user_id, null)
  on conflict do nothing;
end;
$$;

grant execute on function public.accept_institution_invite(uuid) to authenticated;
