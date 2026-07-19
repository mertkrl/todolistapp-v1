-- ### 048_message_rate_limit.sql
-- ============================================================
-- Faz 1-4: Sunucu tarafı mesaj hız sınırı (rate limit)
--
-- İstemcideki _throttleAction sadece tarayıcıda çalışıyor ve
-- atlatılabilir. Bu trigger sınırı veritabanına taşır:
--   * 10 saniyede en fazla 15 mesaj
--   * 60 saniyede en fazla 60 mesaj
-- Sınır aşılırsa insert 'rate_limit' hatasıyla reddedilir;
-- istemci bu mesajı yakalayıp kullanıcıya toast gösterir.
--
-- Not: sender_id üzerinde zaman bazlı sorgu için ek index eklenir.
-- ============================================================

create index if not exists messages_sender_time_idx
  on public.messages (sender_id, created_at desc);

create or replace function public.enforce_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_10s int;
  v_last_60s int;
begin
  select count(*) into v_last_10s
    from public.messages
   where sender_id = new.sender_id
     and created_at > now() - interval '10 seconds';

  if v_last_10s >= 15 then
    raise exception 'rate_limit: cok hizli mesaj gonderiyorsun, birkac saniye bekle'
      using errcode = 'P0001';
  end if;

  select count(*) into v_last_60s
    from public.messages
   where sender_id = new.sender_id
     and created_at > now() - interval '60 seconds';

  if v_last_60s >= 60 then
    raise exception 'rate_limit: dakikada en fazla 60 mesaj gonderebilirsin'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_message_rate_limit on public.messages;
create trigger trg_message_rate_limit
  before insert on public.messages
  for each row execute function public.enforce_message_rate_limit();
