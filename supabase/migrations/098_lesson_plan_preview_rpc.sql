-- ### 098_lesson_plan_preview_rpc.sql
-- ============================================================
-- "İncele" (salt okunur önizleme) ve "Kabul Et" akışları, öğrencinin
-- ÖĞRETMENİN planning_goals/planning_milestones satırlarını doğrudan
-- SELECT edebilmesini gerektiriyordu. Bu tabloların RLS'i (diğer kişisel
-- veri tabloları gibi, bkz. 001_personal_data.sql "own_data_all" deseni)
-- sadece "user_id = auth.uid()" satırlarına izin veriyor — yani öğrenci
-- öğretmenin planını hiçbir zaman okuyamıyordu ("Plan yüklenemedi" hatası
-- ve "Bu planda henüz aşama yok" boş sonucu buradan geliyordu).
--
-- Bu RPC, çağıranın ya planın SAHİBİ (öğretmen) ya da o plan için bir
-- lesson_plan_assignments kaydı olan taraf (öğretmen veya öğrenci) olması
-- şartıyla, RLS'i SECURITY DEFINER ile güvenli biçimde aşıp planı + tüm
-- aşamalarını tek bir JSON nesnesi olarak döner.
-- ============================================================

create or replace function public.lesson_plan_preview(p_goal_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean;
  v_result jsonb;
begin
  select
    exists (select 1 from public.planning_goals g where g.id = p_goal_id and g.user_id = auth.uid())
    or exists (
      select 1 from public.lesson_plan_assignments lpa
      where lpa.goal_id = p_goal_id and (lpa.teacher_id = auth.uid() or lpa.student_id = auth.uid())
    )
  into v_allowed;

  if not v_allowed then
    return null;
  end if;

  select to_jsonb(g.*) into v_result
  from public.planning_goals g
  where g.id = p_goal_id;

  if v_result is null then
    return null;
  end if;

  v_result := v_result || jsonb_build_object(
    'milestones', coalesce((
      select jsonb_agg(to_jsonb(m.*) order by m.order_index)
      from public.planning_milestones m
      where m.goal_id = p_goal_id
    ), '[]'::jsonb)
  );

  return v_result;
end;
$$;

grant execute on function public.lesson_plan_preview(text) to authenticated;
