-- ### 013_fix_messages_insert_dm_recursion.sql
-- ============================================================
-- M2d: messages_insert_dm policy'sindeki "infinite recursion"
-- (42P17) hatasını düzeltir.
--
-- Sebep: messages_insert_dm'in WITH CHECK ifadesi, "messages"
-- tablosuna (kendi tablosuna) bir alt-sorgu yapıyordu:
--   not exists (select 1 from public.messages m2 where m2.scope_id = c.id)
-- Postgres, bir tablonun INSERT policy'si kendi tablosuna alt-sorgu
-- yapınca -- mantıksal sonsuz döngü olmasa da -- bunu güvenlik
-- amaçlı "infinite recursion detected in policy for relation messages"
-- hatasıyla reddediyor.
--
-- Çözüm: bu kontrolü SECURITY DEFINER fonksiyona taşı (RLS'i atlar,
-- policy genişletmesi sırasında messages'a tekrar policy uygulanmaz).
-- ============================================================

create or replace function public.conversation_has_messages(p_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(select 1 from public.messages where scope_id = p_conversation_id);
$$;

grant execute on function public.conversation_has_messages(uuid) to authenticated;

drop policy "messages_insert_dm" on public.messages;
create policy "messages_insert_dm" on public.messages for insert with check (
  sender_id = auth.uid()
  and scope_type = 'dm'
  and exists (
    select 1 from public.conversations c
    where c.id = scope_id
      and auth.uid() in (c.user_a, c.user_b)
      and (
        c.status = 'accepted'
        or (c.status = 'pending' and c.requested_by = auth.uid()
            and not public.conversation_has_messages(c.id))
      )
  )
);
