-- ### 020_break_chat_and_challenge_cleanup.sql
-- ============================================================
-- M4d: Mola sohbeti (focus_session scope) + davet kartı silme
-- ============================================================

-- 1) focus_session scope'undaki mesajlar için INSERT izni
--    (mola sohbeti: scope_type='focus_session', scope_id=challenge_id)
--    can_access_scope('focus_session', scope_id) zaten is_challenge_participant
--    kontrolünü yapıyor — bu yüzden sadece mevcut scope listesine 'focus_session'
--    eklenmiş olması yeterli (003'te zaten tanımlı).
--    Ancak INSERT policy 'group_subchannel' ile sınırlıysa burada genişletilir:
drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages for insert with check (
  sender_id = auth.uid()
  and public.can_access_scope(scope_type, scope_id)
);

-- 2) davet kartı silme (migration 019 ile aynı, tekrar çalıştırılabilir)
drop policy if exists "messages_delete_challenge_participant" on public.messages;
create policy "messages_delete_challenge_participant" on public.messages for delete using (
  challenge_id is not null
  and (
    public.is_challenge_participant(challenge_id, auth.uid())
    or public.is_challenge_group_member(challenge_id, auth.uid())
  )
);

-- 3) focus_session mesajlarını okuma izni (mola sohbeti SELECT)
--    Mevcut "messages_select" policy can_access_scope kullandığı için
--    is_challenge_participant true ise zaten erişim var. Değişiklik gerekmez.

-- 4) focus_challenges_update: "son katılımcı ayrılırken status='done' yapamıyor"
--    sorununa alternatif server-side guard olarak grup üyeleri de update edebilir.
drop policy if exists "focus_challenges_update" on public.focus_challenges;
create policy "focus_challenges_update" on public.focus_challenges for update using (
  public.is_challenge_participant(id, auth.uid())
  or public.is_group_member(group_id, auth.uid())
);
