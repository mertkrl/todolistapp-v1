-- ### 063_fix_friend_challenge_creator_select.sql
-- ============================================================
-- Bug: Arkadaş (grupsuz) meydan okuma oluşturma 403 (RLS) ile
-- patlıyordu — "new row violates row-level security policy for
-- table focus_challenges".
--
-- Sebep: social.js _cwSendInviteFriendsSupabase, focus_challenges'e
-- .insert({...}).select().single() ile satır ekliyor. Postgres,
-- INSERT ... RETURNING için satırın SELECT policy'sini de sağlaması
-- gerektiğini şart koşuyor. group_id=null olan (arkadaş) challenge'da
-- oluşturan kullanıcı henüz focus_challenge_participants/invites'a
-- eklenmemiş (bu insert'lerden SONRA yapılıyor), bu yüzden mevcut
-- focus_challenges_select policy'sindeki hiçbir koşul (group üyeliği /
-- katılımcı / davetli) satırı henüz görünür kılmıyor → RETURNING
-- reddediliyor ve 42501 fırlatılıyor.
--
-- Çözüm: "created_by = auth.uid()" koşulunu select ve update
-- policy'lerine ekle — oluşturan kişi her zaman kendi challenge'ını
-- görebilsin/güncelleyebilsin (grup/katılımcı/davet durumundan bağımsız).
-- ============================================================

drop policy if exists "focus_challenges_select" on public.focus_challenges;
create policy "focus_challenges_select" on public.focus_challenges for select using (
  created_by = auth.uid()
  or (group_id is not null and public.is_group_member(group_id, auth.uid()))
  or public.is_challenge_participant(id, auth.uid())
  or public.is_challenge_invited(id, auth.uid())
);

drop policy if exists "focus_challenges_update" on public.focus_challenges;
create policy "focus_challenges_update" on public.focus_challenges for update using (
  created_by = auth.uid()
  or public.is_challenge_participant(id, auth.uid())
  or public.is_group_member(group_id, auth.uid())
);
