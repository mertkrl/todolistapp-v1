-- ### 068_cw_room_join_rpc.sql
-- ============================================================
-- cw_room_members'a doğrudan INSERT/upsert, RLS'nin açıklanamayan
-- bir şekilde reddetmesine (42501) yol açıyordu — trigger kaldırılmasına
-- rağmen sorun sürdü. Katılma işlemini security definer bir RPC'ye
-- taşıyoruz: hem RLS karmaşıklığını bypass eder hem de kapasite
-- kontrolünü tek atomik operasyonda (elevated privilege ile, guest
-- henüz üye olmadan ÖNCE bile) güvenilir şekilde yapabiliriz.
-- ============================================================

create or replace function public.join_cw_room(
  p_room_id text,
  p_username text,
  p_display_name text,
  p_color text default '6c5ce7'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap int;
  v_count int;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select max_participants into v_cap from public.cw_rooms where id = p_room_id;
  if v_cap is null then
    return jsonb_build_object('ok', false, 'error', 'room_not_found');
  end if;

  select count(*) into v_count from public.cw_room_members where room_id = p_room_id;

  -- Zaten üyeyse (yeniden katılma) kapasite kontrolüne takılmasın
  if not exists (select 1 from public.cw_room_members where room_id = p_room_id and user_id = v_uid) then
    if v_count >= v_cap then
      return jsonb_build_object('ok', false, 'error', 'cw_room_full');
    end if;
  end if;

  insert into public.cw_room_members (room_id, user_id, username, display_name, color, role)
  values (p_room_id, v_uid, p_username, p_display_name, p_color, 'guest')
  on conflict (room_id, user_id) do update
    set username = excluded.username, display_name = excluded.display_name, color = excluded.color;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.join_cw_room(text, text, text, text) to authenticated;
