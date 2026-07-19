-- ### 076_institution_invites.sql
-- ============================================================
-- Kurum/okul davet sistemi: classroom_type='classroom' gruplarına
-- artık serbest katılım yok — sadece öğretmenin gönderdiği davet
-- kabul edilerek üye olunabilir.
-- ============================================================

create table public.institution_invites (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references public.groups(id) on delete cascade,
  invited_by       uuid not null references public.profiles(id) on delete cascade,
  invited_user_id  uuid not null references public.profiles(id) on delete cascade,
  status           text not null default 'pending'
                     check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at       timestamptz not null default now(),
  responded_at     timestamptz
);

create index institution_invites_group_idx on public.institution_invites (group_id, status);
create index institution_invites_invited_user_idx on public.institution_invites (invited_user_id, status);

-- Aynı kişiye aynı grup için birden fazla bekleyen davet gönderilemez
create unique index institution_invites_unique_pending
  on public.institution_invites (group_id, invited_user_id)
  where status = 'pending';

alter table public.institution_invites enable row level security;

-- Görme: davet edilen, daveti gönderen veya o grubun admin/moderatörü
create policy "institution_invites_select" on public.institution_invites for select using (
  invited_user_id = auth.uid()
  or invited_by = auth.uid()
  or exists (
    select 1 from public.group_members gm
    where gm.group_id = institution_invites.group_id and gm.user_id = auth.uid() and gm.role in ('admin', 'moderator')
  )
);

-- Davet gönderme: yalnızca öğretmen rolündeki ve ilgili grubun admin/moderatörü olan kullanıcı,
-- yalnızca classroom tipi gruplar için, kendi adına (invited_by = auth.uid())
create policy "institution_invites_insert" on public.institution_invites for insert with check (
  invited_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.institution_role in ('teacher', 'admin')
  )
  and exists (
    select 1 from public.groups g
    join public.group_members gm on gm.group_id = g.id
    where g.id = institution_invites.group_id
      and g.classroom_type = 'classroom'
      and gm.user_id = auth.uid()
      and gm.role in ('admin', 'moderator')
  )
);

-- Reddetme/iptal: davet edilen kişi 'rejected', gönderen kişi 'cancelled' yapabilir
create policy "institution_invites_update" on public.institution_invites for update using (
  invited_user_id = auth.uid() or invited_by = auth.uid()
) with check (
  status in ('rejected', 'cancelled')
);

-- Bildirim: yeni davet oluşunca davet edilen kullanıcıya bildirim düşer
create or replace function public.institution_invite_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_name text;
  v_inviter_name text;
begin
  select name into v_group_name from public.groups where id = new.group_id;
  select coalesce(display_name, username) into v_inviter_name from public.profiles where id = new.invited_by;

  insert into public.notifications (user_id, type, payload)
  values (
    new.invited_user_id,
    'institution_invite',
    jsonb_build_object(
      'inviteId', new.id,
      'groupId', new.group_id,
      'groupName', v_group_name,
      'fromName', v_inviter_name
    )
  );
  return new;
end;
$$;

create trigger institution_invite_notify_trg
  after insert on public.institution_invites
  for each row execute function public.institution_invite_notify();

-- Kabul: SECURITY DEFINER fonksiyon — davet edilen kişi kendi davetini kabul eder,
-- fonksiyon group_members'a ekler (classroom gruplarında self-join RLS'i bilerek engellendiği için
-- bu akış tek resmi giriş yoludur).
create or replace function public.accept_institution_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.institution_invites%rowtype;
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

  insert into public.group_members (group_id, user_id, role)
  values (v_invite.group_id, v_invite.invited_user_id, null)
  on conflict do nothing;

  update public.institution_invites
    set status = 'accepted', responded_at = now()
    where id = p_invite_id;
end;
$$;

grant execute on function public.accept_institution_invite(uuid) to authenticated;

-- classroom tipi gruplara artık serbest self-join yok — yalnızca davet kabulüyle (yukarıdaki
-- fonksiyon üzerinden, RLS'i bypass ederek) veya mevcut admin/moderatör ekleme yetkisiyle girilir.
drop policy if exists "group_members_insert" on public.group_members;
create policy "group_members_insert" on public.group_members for insert with check (
  (
    user_id = auth.uid()
    and not exists (
      select 1 from public.groups g where g.id = group_members.group_id and g.classroom_type = 'classroom'
    )
  )
  -- Grubun kurucusu (öğretmen) kendini classroom tipi grupta da ekleyebilir
  or (
    user_id = auth.uid()
    and exists (select 1 from public.groups g where g.id = group_members.group_id and g.created_by = auth.uid())
  )
  or exists (
    select 1 from public.group_members gm
    where gm.group_id = group_members.group_id and gm.user_id = auth.uid() and gm.role in ('admin', 'moderator')
  )
);

-- Realtime (bildirim benzeri anlık teslimat için)
alter publication supabase_realtime add table public.institution_invites;
