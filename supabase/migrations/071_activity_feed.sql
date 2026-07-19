-- ### 071_activity_feed.sql
-- Aktivite akışını yeniden kurar (060'ta kaldırılmıştı — sebep: kart hiç
-- görünür değildi, UI entegrasyonu eksikti). Bu sefer okuma/yazma tamamen
-- security definer RPC'ler üzerinden yapılır (bkz. 061_daily_friend_ranking.sql
-- deseni), tabloya doğrudan client erişimi yok — RLS "deny all" olarak kalır.
--
-- log_activity(): çağıran kullanıcı adına bir satır ekler.
-- get_friend_activity_feed(): çağıran + kabul edilmiş arkadaşlarının
-- (arkadaş olmayan/engelli kullanıcılar hariç) son N aktivitesini,
-- profil bilgileriyle birlikte döner.

create table if not exists public.activities (
    id bigint generated always as identity primary key,
    user_id uuid not null references public.profiles(id) on delete cascade,
    type text not null,
    message text not null,
    created_at timestamptz not null default now()
);

create index if not exists activities_user_id_created_at_idx
    on public.activities (user_id, created_at desc);

alter table public.activities enable row level security;
-- Kasıtlı olarak hiçbir select/insert policy yok: tüm erişim aşağıdaki
-- security definer fonksiyonlar üzerinden.

create or replace function public.log_activity(p_message text, p_type text default 'generic')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or p_message is null or length(trim(p_message)) = 0 then
    return;
  end if;
  insert into public.activities (user_id, type, message)
  values (v_uid, coalesce(p_type, 'generic'), left(trim(p_message), 300));

  -- Akış tablosunun sınırsız büyümesini önlemek için kullanıcı başına
  -- en eski satırları budar (her insert'te ucuz bir bakım).
  delete from public.activities
  where user_id = v_uid
    and id not in (
      select id from public.activities
      where user_id = v_uid
      order by created_at desc
      limit 50
    );
end;
$$;

grant execute on function public.log_activity(text, text) to authenticated;

create or replace function public.get_friend_activity_feed(p_limit int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_ids  uuid[];
  v_rows jsonb;
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
      a.id,
      a.message,
      a.type,
      a.created_at,
      p.id as user_id,
      p.username,
      p.display_name,
      p.avatar_color,
      p.custom_avatar,
      (p.id = v_uid) as is_me
    from public.activities a
    join public.profiles p on p.id = a.user_id
    where a.user_id = any(v_ids)
    order by a.created_at desc
    limit greatest(1, least(coalesce(p_limit, 30), 50))
  ) t;

  return jsonb_build_object('status', 'ok', 'rows', v_rows);
end;
$$;

grant execute on function public.get_friend_activity_feed(int) to authenticated;
