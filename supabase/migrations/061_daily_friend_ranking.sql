-- ### 061_daily_friend_ranking.sql
-- Günlük mini rekabet: haftalık lig/sezon gibi büyük döngülerin yanına,
-- her gece kendiliğinden sıfırlanan, düşük riskli bir günlük sinyal ekler.
-- xp_events (051) zaten olay bazlı zaman damgalı olduğu için ayrı bir
-- snapshot/reset mekanizması gerekmiyor — sadece "bugün" (İstanbul günü)
-- filtresiyle sorgulanıyor.
--
-- get_daily_friend_ranking(): çağıran + kabul edilmiş arkadaşları arasında
-- bugünkü XP toplamına göre sıralı liste döner. security definer — RLS'i
-- bypass eder (arkadaşların xp_events'ini normalde okuyamazsın) ama yalnızca
-- friendships'te "accepted" ilişkisi olanları dahil eder.

create or replace function public.get_daily_friend_ranking()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Istanbul')::date;
  v_ids   uuid[];
  v_rows  jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'no_auth');
  end if;

  select array_agg(distinct fid) into v_ids
  from (
    select case when requester_id = v_uid then addressee_id else requester_id end as fid
    from public.friendships
    where status = 'accepted' and v_uid in (requester_id, addressee_id)
    union
    select v_uid
  ) f;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_rows
  from (
    select
      p.id as user_id,
      p.username,
      p.display_name,
      p.avatar_color,
      p.custom_avatar,
      coalesce(sum(e.amount), 0)::integer as today_xp,
      (p.id = v_uid) as is_me
    from public.profiles p
    left join public.xp_events e
      on e.user_id = p.id
      and (e.created_at at time zone 'Europe/Istanbul')::date = v_today
    where p.id = any(v_ids)
    group by p.id, p.username, p.display_name, p.avatar_color, p.custom_avatar
    order by today_xp desc, p.id = v_uid desc
    limit 20
  ) t;

  return jsonb_build_object('status', 'ok', 'rows', v_rows);
end;
$$;

grant execute on function public.get_daily_friend_ranking() to authenticated;
