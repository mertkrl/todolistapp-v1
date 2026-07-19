-- ### 066_fix_cw_room_members_rls_recursion.sql
-- ============================================================
-- 065'teki "cw_room_members_select" policy'si kendi tablosuna
-- (cw_room_members) self-join yapıyordu — Postgres bunu RLS
-- sonsuz döngüsü olarak algılayıp cw_rooms/cw_room_members
-- üzerindeki TÜM sorguları 500 hatasıyla reddediyordu
-- ("infinite recursion detected in policy").
--
-- Çözüm: security definer bir yardımcı fonksiyon (RLS'yi
-- bypass ederek üyeliği kontrol eder) ve policy'leri buna göre
-- yeniden yaz — Supabase'in önerdiği standart desen.
-- ============================================================

create or replace function public.is_cw_room_member(p_room_id text, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.cw_room_members m
    where m.room_id = p_room_id and m.user_id = p_user_id
  );
$$;

grant execute on function public.is_cw_room_member(text, uuid) to authenticated;

-- ─── cw_room_members: self-join yerine yardımcı fonksiyon ───
drop policy if exists "cw_room_members_select" on public.cw_room_members;
create policy "cw_room_members_select" on public.cw_room_members for select using (
  public.is_cw_room_member(room_id, auth.uid())
);

-- ─── cw_rooms: aynı yardımcı fonksiyonu kullan (cw_room_members'a
-- olan cross-table bağımlılık, düzeltilmeden önce de recursion'ı
-- tetikliyordu) ───
drop policy if exists "cw_rooms_select" on public.cw_rooms;
create policy "cw_rooms_select" on public.cw_rooms for select using (
  public.is_cw_room_member(id, auth.uid())
);

drop policy if exists "cw_rooms_update" on public.cw_rooms;
create policy "cw_rooms_update" on public.cw_rooms for update using (
  public.is_cw_room_member(id, auth.uid())
);
