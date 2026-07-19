-- ### 056_global_percentile.sql
-- Cold-start çözümü: arkadaşı/grubu olmayan kullanıcılar için de anlamlı bir
-- pozitif rekabet sinyali. TÜM kullanıcılar arasında (isim/kimlik ifşa etmeden,
-- yalnızca "kullanıcıların %X'inden fazla odaklandın" biçiminde) haftalık XP
-- yüzdelik dilimi döner. security definer olduğu için RLS'i bypass eder,
-- profiles tablosundaki xp/week_xp_base sütunlarını aggregate ederek okur —
-- çağırana başka hiçbir kullanıcının kimliğini veya ham verisini döndürmez.

create or replace function public.get_global_weekly_percentile()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_week         date := date_trunc('week', now() at time zone 'Europe/Istanbul')::date;
  v_my_xp        integer;
  v_total_active integer;
  v_beats        integer;
  v_percentile   integer;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'no_auth');
  end if;

  select greatest(0, coalesce(xp, 0) - coalesce(week_xp_base, 0))
    into v_my_xp
    from profiles
    where id = v_uid and week_start = v_week;

  v_my_xp := coalesce(v_my_xp, 0);

  select count(*) into v_total_active
    from profiles
    where week_start = v_week
      and greatest(0, coalesce(xp, 0) - coalesce(week_xp_base, 0)) > 0;

  -- Küçük örneklemde yüzdelik anlamsız/utandırıcı olabilir (ör. "%0'ın üstündesin").
  if v_total_active < 5 then
    return jsonb_build_object('status', 'insufficient_data', 'total_active', v_total_active);
  end if;

  if v_my_xp <= 0 then
    return jsonb_build_object('status', 'no_activity', 'total_active', v_total_active);
  end if;

  select count(*) into v_beats
    from profiles
    where week_start = v_week
      and greatest(0, coalesce(xp, 0) - coalesce(week_xp_base, 0)) < v_my_xp;

  v_percentile := round((v_beats::numeric / v_total_active) * 100);

  return jsonb_build_object(
    'status', 'ok',
    'weekly_xp', v_my_xp,
    'total_active', v_total_active,
    'beats', v_beats,
    'percentile', v_percentile
  );
end;
$$;

grant execute on function public.get_global_weekly_percentile() to authenticated;
