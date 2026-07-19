-- ### 058_friend_challenges.sql
-- Grup-dışı meydan okuma: "Birlikte Odaklanma" (focus_challenges) şimdiye
-- kadar bir grup üyeliği ZORUNLU kılıyordu (group_id not null, tüm RLS
-- kontrolleri is_group_member üzerinden). Grubu olmayan ama arkadaşı olan
-- kullanıcı Arena'da meydan okuma başlatamıyordu — cold-start/darboğaz sorunu.
--
-- Çözüm: group_id NULLABLE olur, yeni scope_type='friends' eklenir, ve
-- doğrudan arkadaş davetlerini tutan focus_challenge_invites tablosu ile
-- katılım/erişim izinleri grup üyeliğine ek olarak "davet edildim mi?" ile de
-- açılır. Mevcut grup akışı (group_id dolu satırlar) davranışsal olarak
-- DEĞİŞMEDİ — sadece group_id null olan satırlar için yeni bir yol eklendi.

-- ============================================================
-- 1) focus_challenges: group_id/scope_id nullable, 'friends' scope_type
-- ============================================================
alter table public.focus_challenges alter column group_id drop not null;
alter table public.focus_challenges alter column scope_id drop not null;

alter table public.focus_challenges drop constraint if exists focus_challenges_scope_type_check;
alter table public.focus_challenges add constraint focus_challenges_scope_type_check
  check (scope_type in ('group', 'group_channel', 'group_subchannel', 'friends'));

-- ============================================================
-- 2) focus_challenge_invites — doğrudan arkadaş daveti defteri
-- ============================================================
create table if not exists public.focus_challenge_invites (
  challenge_id    uuid not null references public.focus_challenges(id) on delete cascade,
  invited_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (challenge_id, invited_user_id)
);

create index if not exists focus_challenge_invites_user_idx on public.focus_challenge_invites (invited_user_id);

alter table public.focus_challenge_invites enable row level security;
alter table public.focus_challenge_invites replica identity full;

create policy "focus_challenge_invites_select" on public.focus_challenge_invites for select using (
  invited_user_id = auth.uid()
  or exists (select 1 from public.focus_challenges fc where fc.id = challenge_id and fc.created_by = auth.uid())
);

create policy "focus_challenge_invites_insert" on public.focus_challenge_invites for insert with check (
  exists (select 1 from public.focus_challenges fc where fc.id = challenge_id and fc.created_by = auth.uid())
);

alter publication supabase_realtime add table public.focus_challenge_invites;

-- ============================================================
-- 3) is_challenge_invited — RLS yardımcı fonksiyonu
-- ============================================================
create or replace function public.is_challenge_invited(p_challenge_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.focus_challenge_invites
    where challenge_id = p_challenge_id and invited_user_id = p_user_id
  );
$$;

-- ============================================================
-- 4) focus_challenges — insert/select politikaları grupsuz satırları kabul etsin
-- ============================================================
drop policy if exists "focus_challenges_insert" on public.focus_challenges;
create policy "focus_challenges_insert" on public.focus_challenges for insert with check (
  created_by = auth.uid()
  and (group_id is null or public.is_group_member(group_id, auth.uid()))
);

drop policy if exists "focus_challenges_select" on public.focus_challenges;
create policy "focus_challenges_select" on public.focus_challenges for select using (
  (group_id is not null and public.is_group_member(group_id, auth.uid()))
  or public.is_challenge_participant(id, auth.uid())
  or public.is_challenge_invited(id, auth.uid())
);

-- ============================================================
-- 5) focus_challenge_participants — davetli veya yaratan da katılabilsin/görsün
-- ============================================================
drop policy if exists "focus_challenge_participants_insert" on public.focus_challenge_participants;
create policy "focus_challenge_participants_insert" on public.focus_challenge_participants for insert with check (
  user_id = auth.uid()
  and (
    public.is_challenge_group_member(challenge_id, auth.uid())
    or public.is_challenge_invited(challenge_id, auth.uid())
    or exists (select 1 from public.focus_challenges fc where fc.id = challenge_id and fc.created_by = auth.uid())
  )
);

drop policy if exists "focus_challenge_participants_select" on public.focus_challenge_participants;
create policy "focus_challenge_participants_select" on public.focus_challenge_participants for select using (
  public.is_challenge_participant(challenge_id, auth.uid())
  or public.is_challenge_group_member(challenge_id, auth.uid())
  or public.is_challenge_invited(challenge_id, auth.uid())
);
