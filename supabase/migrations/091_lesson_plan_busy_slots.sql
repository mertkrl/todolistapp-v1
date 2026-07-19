-- ### 091_lesson_plan_busy_slots.sql
-- ============================================================
-- Kişiye özel ders planlaması yaparken öğretmenin öğrencinin
-- dolu saat aralıklarını (SADECE saat/tarih, içerik/başlık YOK)
-- görebilmesi için salt-agrega RPC. Sadece p_student_id ile aynı
-- grupta admin (öğretmen) rolündeki çağıran kullanabilir.
-- ============================================================

create or replace function public.lesson_plan_student_busy_slots(p_student_id uuid, p_group_id uuid)
returns table (task_date date, time_start time, time_end time, is_overnight boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.group_members caller
    join public.group_members target
      on target.group_id = caller.group_id
     and target.user_id = p_student_id
    where caller.group_id = p_group_id
      and caller.user_id = auth.uid()
      and caller.role = 'admin'
  ) then
    return;
  end if;

  return query
    select t.task_date, t.time_start, t.time_end, t.is_overnight
    from public.tasks t
    where t.user_id = p_student_id
      and t.task_date is not null
      and t.time_start is not null
      and t.time_end is not null;
end;
$$;

grant execute on function public.lesson_plan_student_busy_slots(uuid, uuid) to authenticated;
