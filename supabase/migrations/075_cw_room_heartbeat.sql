-- ### 075_cw_room_heartbeat.sql
-- ============================================================
-- cw_rooms.active + cw_room_members sayısı, kullanıcı sekmeyi hard
-- refresh/kapat ile terk ettiğinde GÜNCELLENMİYOR — satırlar DB'de
-- "aktif ve dolu" görünmeye devam ediyor. Test aşamasında sürekli
-- hard refresh yapıldığında bu, sohbette asla kaybolmayan "hayalet"
-- odaklanma davetlerine yol açıyor.
--
-- Çözüm: odaklanma arayüzü açıkken client periyodik olarak
-- last_seen_at'i günceller (bkz. social.js _cwStartHeartbeat).
-- Davet kartı, son heartbeat üzerinden makul bir süre (40sn) geçtiyse
-- odayı "terk edilmiş" sayıp kendini otomatik temizler — sekme aktif
-- kaldığı sürece heartbeat sürekli tazelendiği için gerçek oturumlar
-- asla bu şekilde silinmez.
-- ============================================================

alter table public.cw_rooms add column if not exists last_seen_at timestamptz not null default now();

-- Bu migration'dan önce oluşturulmuş (heartbeat hiç almamış) satırları
-- oluşturulma zamanlarına geri çek — hemen "bayat" sayılıp temizlensinler.
update public.cw_rooms set last_seen_at = created_at where last_seen_at > created_at;

create or replace function public.get_cw_room_invite_status(p_room_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active boolean;
  v_created_at timestamptz;
  v_last_seen_at timestamptz;
  v_count int;
begin
  select active, created_at, last_seen_at into v_active, v_created_at, v_last_seen_at
    from public.cw_rooms where id = p_room_id;
  if v_active is null then
    return jsonb_build_object('found', false, 'active', false, 'count', 0, 'created_at', null, 'last_seen_at', null);
  end if;

  select count(*) into v_count from public.cw_room_members where room_id = p_room_id;

  return jsonb_build_object(
    'found', true,
    'active', v_active,
    'count', v_count,
    'created_at', v_created_at,
    'last_seen_at', v_last_seen_at
  );
end;
$$;

grant execute on function public.get_cw_room_invite_status(text) to authenticated;

create or replace function public.cw_room_heartbeat(p_room_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.cw_rooms set last_seen_at = now()
  where id = p_room_id and public.is_cw_room_member(p_room_id, auth.uid());
$$;

grant execute on function public.cw_room_heartbeat(text) to authenticated;
