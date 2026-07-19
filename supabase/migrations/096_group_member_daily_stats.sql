-- ### 096_group_member_daily_stats.sql
-- ============================================================
-- Sınıf/Ekip Paneli "Rapor" sekmesi (PDF) için: belirli bir üyenin son
-- N günlük odaklanma verisini (stat_date, focus_minutes) döner. daily_stats
-- tablosunun RLS'i sadece "user_id = auth.uid()" satırlarına izin verdiğinden
-- (bkz. 037/077'deki group_weekly_member_stats gibi RPC'ler), yönetici başka
-- bir üyenin raporunu oluştururken doğrudan tablo sorgusu boş dönerdi — bu
-- fonksiyon SECURITY DEFINER ile o kısıtı, sadece grup yöneticisi (veya
-- kullanıcının kendisi) için, aynı gizlilik anahtarına (stats_hidden_from_institution,
-- bkz. 077) saygı göstererek aşıyor.
-- ============================================================

create or replace function public.group_member_daily_stats(p_group_id uuid, p_user_id uuid, p_since date)
returns table (stat_date date, focus_minutes integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_is_self boolean;
  v_hidden boolean;
begin
  v_is_self := (p_user_id = auth.uid());

  select exists (
    select 1 from public.group_members caller
    where caller.group_id = p_group_id
      and caller.user_id = auth.uid()
      and caller.role = 'admin'
  ) into v_is_admin;

  if not v_is_self and not v_is_admin then
    return;
  end if;

  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = p_user_id
  ) then
    return;
  end if;

  select coalesce(p.stats_hidden_from_institution, false) into v_hidden
  from public.profiles p where p.id = p_user_id;

  if v_hidden and not v_is_self then
    return;
  end if;

  return query
    select ds.stat_date, ds.focus_minutes
    from public.daily_stats ds
    where ds.user_id = p_user_id and ds.stat_date >= p_since;
end;
$$;

grant execute on function public.group_member_daily_stats(uuid, uuid, date) to authenticated;
