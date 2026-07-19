-- ### 062_group_mini_tournament.sql
-- Grup içi mini-turnuva (premium özellik): grup hedefinin yanına, kısa süreli
-- (1-14 gün), katılımı isteğe bağlı bir "kim önde bitirecek" yarışması ekler.
-- Haftalık lig/sezon gibi büyük döngülerden farklı olarak grup İÇİNDE, seçilen
-- üyeler arasında, kısa bir pencerede koşar. Diğer lazy-rollover mekanizmalarıyla
-- (duello/lig/sezon) aynı desen: bitiş zamanı geçmişse ilk okuyan sonuçlandırır.
--
-- Premium kapısı: yalnızca premium/kurumsal kullanıcılar turnuva BAŞLATABİLİR
-- (profiles.plan='premium' veya institution_role in student/teacher) — katılım
-- serbest, grubun tüm üyeleri (planı ne olursa olsun) katılabilir.

create table if not exists public.group_tournaments (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  created_by  uuid not null references public.profiles(id),
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null,
  status      text not null default 'active' check (status in ('active', 'finished')),
  winner_id   uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

-- Bir grupta aynı anda tek aktif turnuva (yeni turnuva ancak öncekisi bitince açılabilir).
create unique index if not exists group_tournaments_one_active_idx
  on public.group_tournaments (group_id) where status = 'active';

create index if not exists group_tournaments_group_idx on public.group_tournaments (group_id, created_at desc);

alter table public.group_tournaments enable row level security;

create policy "group_tournaments_select" on public.group_tournaments
  for select using (exists (
    select 1 from public.group_members gm where gm.group_id = group_tournaments.group_id and gm.user_id = auth.uid()
  ));

-- insert/update yalnızca definer fonksiyonlardan (start/join/finalize) yapılır.

create table if not exists public.group_tournament_participants (
  tournament_id uuid not null references public.group_tournaments(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  joined_at     timestamptz not null default now(),
  start_xp      integer not null,
  final_xp      integer,
  primary key (tournament_id, user_id)
);

alter table public.group_tournament_participants enable row level security;

create policy "group_tournament_participants_select" on public.group_tournament_participants
  for select using (exists (
    select 1 from public.group_tournaments gt
    join public.group_members gm on gm.group_id = gt.group_id
    where gt.id = group_tournament_participants.tournament_id and gm.user_id = auth.uid()
  ));

alter publication supabase_realtime add table public.group_tournaments;
alter publication supabase_realtime add table public.group_tournament_participants;

-- ============================================================
-- start_group_tournament — premium/kurumsal kullanıcı başlatır, kendini
-- ilk katılımcı olarak ekler.
-- ============================================================
create or replace function public.start_group_tournament(p_group_id uuid, p_days integer default 3)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_days  integer := least(greatest(coalesce(p_days, 3), 1), 14);
  v_xp    integer;
  v_id    uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'auth');
  end if;

  if not exists (select 1 from public.group_members where group_id = p_group_id and user_id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'not_a_member');
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_uid and (plan = 'premium' or institution_role in ('student', 'teacher'))
  ) then
    return jsonb_build_object('ok', false, 'error', 'premium_required');
  end if;

  if exists (select 1 from public.group_tournaments where group_id = p_group_id and status = 'active') then
    return jsonb_build_object('ok', false, 'error', 'already_active');
  end if;

  select coalesce(xp, 0) into v_xp from public.profiles where id = v_uid;

  insert into public.group_tournaments (group_id, created_by, ends_at)
    values (p_group_id, v_uid, now() + (v_days || ' days')::interval)
    returning id into v_id;

  insert into public.group_tournament_participants (tournament_id, user_id, start_xp)
    values (v_id, v_uid, v_xp);

  return jsonb_build_object('ok', true, 'tournament_id', v_id);
end;
$$;

grant execute on function public.start_group_tournament(uuid, integer) to authenticated;

-- ============================================================
-- join_group_tournament — grubun herhangi bir üyesi (planı fark etmez) katılır
-- ============================================================
create or replace function public.join_group_tournament(p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_group_id uuid;
  v_status   text;
  v_xp       integer;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'auth');
  end if;

  select group_id, status into v_group_id, v_status
    from public.group_tournaments where id = p_tournament_id;

  if v_group_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'finished');
  end if;
  if not exists (select 1 from public.group_members where group_id = v_group_id and user_id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'not_a_member');
  end if;

  select coalesce(xp, 0) into v_xp from public.profiles where id = v_uid;

  insert into public.group_tournament_participants (tournament_id, user_id, start_xp)
    values (p_tournament_id, v_uid, v_xp)
    on conflict (tournament_id, user_id) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.join_group_tournament(uuid) to authenticated;

-- ============================================================
-- get_group_tournament — aktif/son turnuvayı + katılımcı sıralamasını döner;
-- bitiş zamanı geçmişse lazy olarak sonuçlandırır (ilk okuyan sonuçlandırır).
-- ============================================================
create or replace function public.get_group_tournament(p_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_t       record;
  v_winner  uuid;
  v_rows    jsonb;
begin
  if v_uid is null or not exists (
    select 1 from public.group_members where group_id = p_group_id and user_id = v_uid
  ) then
    return jsonb_build_object('status', 'no_access');
  end if;

  select * into v_t from public.group_tournaments
    where group_id = p_group_id
    order by created_at desc limit 1;

  if v_t.id is null then
    return jsonb_build_object('status', 'none');
  end if;

  -- Lazy sonuçlandırma: süresi dolmuş ama hâlâ 'active' ise burada bitir.
  if v_t.status = 'active' and v_t.ends_at <= now() then
    update public.group_tournament_participants gtp
      set final_xp = greatest(0, coalesce(p.xp, 0) - gtp.start_xp)
      from public.profiles p
      where gtp.tournament_id = v_t.id and p.id = gtp.user_id;

    select user_id into v_winner
      from public.group_tournament_participants
      where tournament_id = v_t.id
      order by final_xp desc nulls last, user_id
      limit 1;

    update public.group_tournaments
      set status = 'finished', winner_id = v_winner
      where id = v_t.id;

    v_t.status := 'finished';
    v_t.winner_id := v_winner;
  end if;

  select coalesce(jsonb_agg(row_to_json(t) order by t.rank_xp desc), '[]'::jsonb) into v_rows
  from (
    select
      gtp.user_id,
      p.username, p.display_name, p.avatar_color, p.custom_avatar,
      case when v_t.status = 'finished' then coalesce(gtp.final_xp, 0)
           else greatest(0, coalesce(p.xp, 0) - gtp.start_xp) end as rank_xp,
      (gtp.user_id = v_uid) as is_me
    from public.group_tournament_participants gtp
    join public.profiles p on p.id = gtp.user_id
    where gtp.tournament_id = v_t.id
  ) t;

  return jsonb_build_object(
    'status', 'ok',
    'tournament_id', v_t.id,
    'tournament_status', v_t.status,
    'ends_at', v_t.ends_at,
    'winner_id', v_t.winner_id,
    'i_joined', exists (select 1 from public.group_tournament_participants where tournament_id = v_t.id and user_id = v_uid),
    'rows', v_rows
  );
end;
$$;

grant execute on function public.get_group_tournament(uuid) to authenticated;
