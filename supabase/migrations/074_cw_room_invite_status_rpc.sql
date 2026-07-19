-- ### 074_cw_room_invite_status_rpc.sql
-- ============================================================
-- Grup sohbetine gönderilen "birlikte odaklan" davet kartı (bkz.
-- social.js _renderDcCwRoomInviteCard), odanın hâlâ aktif olup
-- olmadığını ve kaç kişinin içeride olduğunu göstermek için
-- cw_rooms/cw_room_members'ı doğrudan select ediyordu. Ancak
-- 066_fix_cw_room_members_rls_recursion.sql'deki RLS policy'leri
-- bu tabloları yalnızca ODANIN ÜYESİ olan kullanıcılara açıyor —
-- daveti henüz kabul etmemiş (odaya hiç katılmamış) kişiler için
-- select boş/null dönüyor ve kart "geçersiz" sanılıp anında
-- sohbetten siliniyordu. Çözüm: join_cw_room'daki gibi security
-- definer bir RPC ile RLS'yi bypass edip sadece gereken özeti
-- (active, count) döndürmek.
-- ============================================================

create or replace function public.get_cw_room_invite_status(p_room_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active boolean;
  v_created_at timestamptz;
  v_count int;
begin
  select active, created_at into v_active, v_created_at from public.cw_rooms where id = p_room_id;
  if v_active is null then
    return jsonb_build_object('found', false, 'active', false, 'count', 0, 'created_at', null);
  end if;

  select count(*) into v_count from public.cw_room_members where room_id = p_room_id;

  return jsonb_build_object('found', true, 'active', v_active, 'count', v_count, 'created_at', v_created_at);
end;
$$;

grant execute on function public.get_cw_room_invite_status(text) to authenticated;
