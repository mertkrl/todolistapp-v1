-- ### 094_group_weekly_category_breakdown.sql
-- ============================================================
-- Sınıf Paneli'nde "hangi alana ne kadar zaman ayrılıyor" özeti için.
-- daily_stats.category_minutes (jsonb, örn. {"egitim": 45, "kariyer": 30})
-- zaten her kullanıcı için tutuluyor — bu RPC grup genelinde, bu hafta için
-- kategori bazında toplam dakikayı agrega eder. Kişiye özel değil, sınıf
-- toplamı döner (mahremiyet: tek tek öğrenci satırı yok, sadece toplam).
-- Not: Bu, uygulamanın genel yaşam-alanı kategorileridir (Eğitim/Kariyer/...),
-- ders bazlı (Matematik/Fizik/...) bir ayrım değildir — o ayrı bir etiketleme
-- özelliği gerektirir.
-- ============================================================

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

  v_week_start := date_trunc('week', now())::date;

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
