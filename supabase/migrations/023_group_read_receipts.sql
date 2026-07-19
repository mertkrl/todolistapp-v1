-- ### 023_group_read_receipts.sql
-- ============================================================
-- M5c: Grup/Kanal Okundu Bilgisi Tablosu
--
-- Firebase yolu: focusai_community/group_meta/{chatPath}/lastRead/{username}
-- Karşılık: group_read_receipts (scope_type/scope_id/user_id/last_read_at)
--
-- Yazıyor... göstergesi için DB'ye gerek yok — broadcast kanalı kullanılıyor.
-- ============================================================

create table public.group_read_receipts (
  scope_type   text not null,
  scope_id     uuid not null,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (scope_type, scope_id, user_id)
);

alter table public.group_read_receipts enable row level security;
alter table public.group_read_receipts replica identity full;

-- Gruba/kanala erişimi olan herkes okundu bilgisini görebilir
create policy "grr_select" on public.group_read_receipts for select using (
  public.can_access_scope(scope_type, scope_id)
);

-- Sadece kendine ait satırı ekleyebilir/güncelleyebilir
create policy "grr_insert" on public.group_read_receipts for insert with check (
  user_id = auth.uid() and public.can_access_scope(scope_type, scope_id)
);

create policy "grr_update" on public.group_read_receipts for update using (
  user_id = auth.uid()
) with check (user_id = auth.uid());

create policy "grr_delete" on public.group_read_receipts for delete using (
  user_id = auth.uid()
);

alter publication supabase_realtime add table public.group_read_receipts;
