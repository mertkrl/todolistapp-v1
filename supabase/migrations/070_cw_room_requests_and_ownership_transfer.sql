-- ### 070_cw_room_requests_and_ownership_transfer.sql
-- ============================================================
-- 1) cw_rooms.allow_requests — owner katılımcıların Duraklat/Başlat/
--    Sonraki Aşama İSTEĞİ göndermesini tamamen kapatabilsin (kapalıysa
--    guest'e bu butonlar hiç gösterilmez).
-- 2) transfer_cw_room_ownership RPC — owner tamamen ayrılınca sahipliği
--    başka bir üyeye devreder. Doğrudan `update cw_room_members set
--    role='owner' where user_id=<başkası>` RLS'de reddediliyordu çünkü
--    cw_room_members_update policy'si sadece `user_id = auth.uid()`
--    (kendi satırın) için izin veriyor — başkasının satırını
--    güncelleyemezsin. security definer bir RPC ile bypass ediyoruz.
-- ============================================================

alter table public.cw_rooms add column if not exists allow_requests boolean not null default true;

create or replace function public.transfer_cw_room_ownership(p_room_id text, p_new_owner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_owner boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select exists(
    select 1 from public.cw_room_members
    where room_id = p_room_id and user_id = v_uid and role = 'owner'
  ) into v_is_owner;

  if not v_is_owner then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;

  if not exists(select 1 from public.cw_room_members where room_id = p_room_id and user_id = p_new_owner_id) then
    return jsonb_build_object('ok', false, 'error', 'target_not_member');
  end if;

  update public.cw_room_members set role = 'owner' where room_id = p_room_id and user_id = p_new_owner_id;
  update public.cw_room_members set role = 'guest' where room_id = p_room_id and user_id = v_uid;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.transfer_cw_room_ownership(text, uuid) to authenticated;
