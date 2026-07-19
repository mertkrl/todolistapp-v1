-- ### 018_fix_focus_challenges_rls_recursion.sql
-- ============================================================
-- M4c fix: "infinite recursion detected in policy for relation
-- focus_challenges" (42P17).
--
-- Sebep: focus_challenges'in select/update policy'leri
-- focus_challenge_participants'a subquery yapıyor; o tablonun
-- select policy'si de focus_challenges'e subquery yapıyor.
-- RLS açıkken her policy diğerini tetikleyip sonsuz döngüye giriyor.
--
-- Çözüm: is_group_member gibi SECURITY DEFINER yardımcı fonksiyonlar
-- (RLS'i bypass eder) ile çapraz tablo kontrollerini policy'lerin
-- dışına taşımak.
-- ============================================================

create or replace function public.is_challenge_participant(p_challenge_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.focus_challenge_participants
    where challenge_id = p_challenge_id and user_id = p_user_id
  );
$$;

create or replace function public.is_challenge_group_member(p_challenge_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.focus_challenges fc
    where fc.id = p_challenge_id and public.is_group_member(fc.group_id, p_user_id)
  );
$$;

-- ─── can_access_scope: 'focus_session' artık is_challenge_participant kullanıyor ───
create or replace function public.can_access_scope(p_scope_type text, p_scope_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case p_scope_type
    when 'dm' then exists (
      select 1 from public.conversations c
      where c.id = p_scope_id and auth.uid() in (c.user_a, c.user_b)
    )
    when 'group' then exists (
      select 1 from public.group_members gm
      where gm.group_id = p_scope_id and gm.user_id = auth.uid()
    )
    when 'group_channel' then exists (
      select 1 from public.group_channels gc
      join public.group_members gm on gm.group_id = gc.group_id
      where gc.id = p_scope_id and gm.user_id = auth.uid()
    )
    when 'group_subchannel' then exists (
      select 1 from public.group_subchannels gs
      join public.group_channels gc on gc.id = gs.channel_id
      join public.group_members gm on gm.group_id = gc.group_id
      where gs.id = p_scope_id and gm.user_id = auth.uid()
    )
    when 'focus_session' then public.is_challenge_participant(p_scope_id, auth.uid())
    else false
  end;
$$;

-- ─── focus_challenges policy'lerini yeniden yaz ───
drop policy if exists "focus_challenges_select" on public.focus_challenges;
drop policy if exists "focus_challenges_update" on public.focus_challenges;

create policy "focus_challenges_select" on public.focus_challenges for select using (
  public.is_group_member(group_id, auth.uid())
  or public.is_challenge_participant(id, auth.uid())
);

create policy "focus_challenges_update" on public.focus_challenges for update using (
  public.is_challenge_participant(id, auth.uid())
);

-- ─── focus_challenge_participants policy'lerini yeniden yaz ───
drop policy if exists "focus_challenge_participants_select" on public.focus_challenge_participants;
drop policy if exists "focus_challenge_participants_insert" on public.focus_challenge_participants;

create policy "focus_challenge_participants_select" on public.focus_challenge_participants for select using (
  public.is_challenge_participant(challenge_id, auth.uid())
  or public.is_challenge_group_member(challenge_id, auth.uid())
);

create policy "focus_challenge_participants_insert" on public.focus_challenge_participants for insert with check (
  user_id = auth.uid()
  and public.is_challenge_group_member(challenge_id, auth.uid())
);
