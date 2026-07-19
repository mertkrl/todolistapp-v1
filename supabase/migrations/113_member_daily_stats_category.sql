-- ### 113_member_daily_stats_category.sql
-- ============================================================
-- Bireysel kategori kırılımı: group_weekly_category_breakdown (094) sadece
-- SINIF GENELİNDE agrega veriyordu — bir öğrencinin "Ani Düşüş" veya "Efor
-- Karşılıksız" (focus_output_mismatch) anomalisinin HANGİ alanda yoğunlaştığı
-- (Matematik'e mi yoksa genele mi yayılmış) görünmüyordu (bkz. performans
-- analizi, 2026-07-11: "kök neden analizi" eksikliği). Yeni bir RPC yazmak
-- yerine, öğrenci raporunda (Rapor sekmesi, PDF) zaten kullanılan
-- group_member_daily_stats (096) fonksiyonuna category_minutes kolonu
-- eklendi — aynı çağrı, aynı yetki/gizlilik kontrolü, tek ek jsonb kolonu.
-- Dönüş tipi değiştiği için önce eski fonksiyon silinmeli.
-- ============================================================

drop function if exists public.group_member_daily_stats(uuid, uuid, date);
create function public.group_member_daily_stats(p_group_id uuid, p_user_id uuid, p_since date)
returns table (stat_date date, focus_minutes integer, category_minutes jsonb)
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
    select ds.stat_date, ds.focus_minutes, ds.category_minutes
    from public.daily_stats ds
    where ds.user_id = p_user_id and ds.stat_date >= p_since;
end;
$$;

grant execute on function public.group_member_daily_stats(uuid, uuid, date) to authenticated;

-- Bonus tutarlılık: group_weekly_category_breakdown (094) da aynı UTC hafta
-- sınırı sorununu taşıyordu (bkz. 111_weekly_stats_tz_fix.sql'deki kapsamlı
-- TZ birleştirmesi) — aynı taramada bu da düzeltildi.
create or replace function public.group_weekly_category_breakdown(p_group_id uuid)
returns table (category text, minutes integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start date;
begin
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
  ) then
    return;
  end if;

  v_week_start := date_trunc('week', now() at time zone 'Europe/Istanbul')::date;

  return query
    select cm.key as category, sum((cm.value)::numeric)::integer as minutes
    from public.group_members gm
    join public.daily_stats ds on ds.user_id = gm.user_id and ds.stat_date >= v_week_start
    cross join lateral jsonb_each_text(ds.category_minutes) as cm(key, value)
    where gm.group_id = p_group_id
    group by cm.key
    having sum((cm.value)::numeric) > 0
    order by minutes desc;
end;
$$;

grant execute on function public.group_weekly_category_breakdown(uuid) to authenticated;
