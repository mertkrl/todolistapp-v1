-- ### 109_group_weekly_focus_history.sql
-- ============================================================
-- Sınıf Paneli > Performans, z-skor bazlı anomali tespiti için her üyenin
-- SON N HAFTALIK odak dakikası geçmişine ihtiyaç duyuyor. Mevcut
-- group_weekly_member_stats (037/077) sadece bu hafta + geçen haftayı
-- (2 nokta) döndürüyor — bu, "geçen haftaya göre %60 düştü" gibi SABİT
-- eşiklerin ötesine geçip "bu öğrencinin KENDİ geçmişine göre normal
-- dalgalanma sınırının dışına çıktı mı" sorusunu cevaplamaya yetmiyor.
-- Bu RPC, her üye için haftalık kovalar halinde odak dakikası döndürür;
-- client tarafında ortalama+std sapma hesaplanıp z-skor üretilir.
-- Sadece p_group_id'de admin (öğretmen) rolündeki çağıran kullanabilir
-- (group_student_weekly_load - 092 - ile aynı yetki deseni).
-- Gizlilik: group_weekly_member_stats (077) ile aynı kural — öğrenci
-- stats_hidden_from_institution işaretlediyse o üyenin satırları hiç
-- dönmez (kendi hesaplamasını client zaten kendi verisiyle yapabilir,
-- burası öğretmen tarafı için).
-- ============================================================

create or replace function public.group_weekly_focus_history(p_group_id uuid, p_weeks_back integer default 8)
returns table (student_id uuid, week_start date, weekly_minutes integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.group_members caller
    where caller.group_id = p_group_id
      and caller.user_id = auth.uid()
      and caller.role = 'admin'
  ) then
    return;
  end if;

  return query
    select
      gm.user_id as student_id,
      date_trunc('week', ds.stat_date)::date as week_start,
      sum(ds.focus_minutes)::integer as weekly_minutes
    from public.group_members gm
    join public.profiles p on p.id = gm.user_id
    join public.daily_stats ds on ds.user_id = gm.user_id
    where gm.group_id = p_group_id
      and not p.stats_hidden_from_institution
      and ds.stat_date >= (date_trunc('week', now())::date - (p_weeks_back * 7))
      and ds.stat_date < date_trunc('week', now())::date + 7
    group by gm.user_id, date_trunc('week', ds.stat_date);
end;
$$;

grant execute on function public.group_weekly_focus_history(uuid, integer) to authenticated;
