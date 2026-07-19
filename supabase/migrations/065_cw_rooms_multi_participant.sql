-- ### 065_cw_rooms_multi_participant.sql
-- ============================================================
-- "Birlikte Odaklanma" odasını sabit 2 kişilik (host/guest) modelden
-- N-katılımcılı modele geçirir. Ücretsiz planda kapasite hâlâ 2
-- (regresyon yok); ücretli planlarda (premium/kurumsal) daha kalabalık
-- odalar açılabilir — kapasite oda oluşturulurken snapshot'lanır
-- (bkz. GROUP_LIMITS/getMyGroupLimits deseni, gruplardaki maxMembers).
-- ============================================================

-- ─── cw_room_members ────────────────────────────────────────
create table public.cw_room_members (
  room_id      text not null references public.cw_rooms(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  username     text not null,
  display_name text not null,
  color        text not null default '6c5ce7',
  role         text not null default 'guest' check (role in ('owner','guest')),
  task_id      text,
  task_text    text,
  joined_at    timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.cw_room_members enable row level security;
alter table public.cw_room_members replica identity full;

-- Mevcut aktif/eski oda satırlarını host/guest kolonlarından üye tablosuna taşı
insert into public.cw_room_members (room_id, user_id, username, display_name, color, role, task_id, task_text, joined_at)
select id, host_id, host_username, host_name, host_color, 'owner', host_task_id, host_task, created_at
from public.cw_rooms
where host_id is not null
on conflict (room_id, user_id) do nothing;

insert into public.cw_room_members (room_id, user_id, username, display_name, color, role, task_id, task_text, joined_at)
select id, guest_id, guest_username, guest_name, guest_color, 'guest', guest_task_id, guest_task, coalesce(started_at, created_at)
from public.cw_rooms
where guest_id is not null
on conflict (room_id, user_id) do nothing;

-- ─── cw_rooms: oda-seviyesi kolonlara indirge ───────────────
-- Eski policy'ler host_id/guest_id'ye bağımlı — kolonları düşürmeden önce kaldırılmalı.
drop policy if exists "cw_rooms_select" on public.cw_rooms;
drop policy if exists "cw_rooms_insert" on public.cw_rooms;
drop policy if exists "cw_rooms_update" on public.cw_rooms;
drop policy if exists "cw_rooms_delete" on public.cw_rooms;

alter table public.cw_rooms add column if not exists created_by uuid references public.profiles(id) on delete cascade;
update public.cw_rooms set created_by = host_id where created_by is null;
alter table public.cw_rooms alter column created_by set not null;

alter table public.cw_rooms add column if not exists max_participants int not null default 2;

alter table public.cw_rooms
  drop column if exists host_id,
  drop column if exists host_username,
  drop column if exists host_name,
  drop column if exists host_color,
  drop column if exists guest_id,
  drop column if exists guest_username,
  drop column if exists guest_name,
  drop column if exists guest_color,
  drop column if exists host_task_id,
  drop column if exists host_task,
  drop column if exists guest_task_id,
  drop column if exists guest_task;

-- ─── RLS: cw_rooms (üyelik üzerinden) ────────────────────────
create policy "cw_rooms_select" on public.cw_rooms for select using (
  exists (select 1 from public.cw_room_members m where m.room_id = cw_rooms.id and m.user_id = auth.uid())
);
create policy "cw_rooms_insert" on public.cw_rooms for insert with check (
  created_by = auth.uid()
);
create policy "cw_rooms_update" on public.cw_rooms for update using (
  exists (select 1 from public.cw_room_members m where m.room_id = cw_rooms.id and m.user_id = auth.uid())
);
create policy "cw_rooms_delete" on public.cw_rooms for delete using (
  created_by = auth.uid()
);

-- ─── RLS + kapasite kontrolü: cw_room_members ────────────────
create or replace function public.check_cw_room_capacity()
returns trigger as $$
declare
  current_count int;
  cap int;
begin
  select max_participants into cap from public.cw_rooms where id = new.room_id;
  if cap is null then
    return new; -- oda bulunamadıysa FK zaten reddedecek
  end if;
  select count(*) into current_count from public.cw_room_members where room_id = new.room_id;
  if current_count >= cap then
    raise exception 'cw_room_full';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists cw_room_capacity_check on public.cw_room_members;
create trigger cw_room_capacity_check
  before insert on public.cw_room_members
  for each row execute function public.check_cw_room_capacity();

create policy "cw_room_members_select" on public.cw_room_members for select using (
  exists (select 1 from public.cw_room_members m2 where m2.room_id = cw_room_members.room_id and m2.user_id = auth.uid())
);
create policy "cw_room_members_insert" on public.cw_room_members for insert with check (
  user_id = auth.uid()
);
create policy "cw_room_members_update" on public.cw_room_members for update using (
  user_id = auth.uid()
);
create policy "cw_room_members_delete" on public.cw_room_members for delete using (
  user_id = auth.uid()
  or exists (select 1 from public.cw_rooms r where r.id = cw_room_members.room_id and r.created_by = auth.uid())
);

alter publication supabase_realtime add table public.cw_room_members;

-- ─── cw_invites: birden fazla davetliye izin ver ─────────────
-- Şema zaten to_id başına bir satır (çoklu davet = çoklu insert), değişiklik gerekmiyor.
