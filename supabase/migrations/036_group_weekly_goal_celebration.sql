-- ### 036_group_weekly_goal_celebration.sql
-- FocusAI -> Supabase Migration 036: Haftalık grup hedefi tamamlanınca tek seferlik
-- "ekip başarısı" kutlaması — tüm üyelere bildirim gönderir.
-- groups_update RLS policy'si sadece grup sahibine update izni verdiği için (004),
-- herhangi bir üyenin "kazanan" claim'i atabilmesi için SECURITY DEFINER fonksiyon kullanılıyor.

alter table public.groups
  add column if not exists weekly_goal_celebrated_at timestamptz;

create or replace function public.claim_group_weekly_celebration(
  p_group_id uuid,
  p_total_minutes integer,
  p_weekly_goal integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start date;
  v_group_name text;
  v_claimed boolean := false;
begin
  -- Çağıran bu grubun üyesi değilse hiçbir şey yapma.
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
  ) then
    return false;
  end if;

  v_week_start := date_trunc('week', now())::date;

  -- Atomik "kazanan tek client" claim'i: bu haftanın kutlaması daha önce
  -- yapılmamışsa şimdi yapılmış say, true dön. Aynı anda birden çok client
  -- denese bile UPDATE satır kilidi sayesinde yalnızca biri true alır.
  update public.groups
    set weekly_goal_celebrated_at = now()
    where id = p_group_id
      and (weekly_goal_celebrated_at is null or weekly_goal_celebrated_at < v_week_start)
    returning name into v_group_name;

  if v_group_name is not null then
    v_claimed := true;

    insert into public.notifications (user_id, type, payload)
    select gm.user_id, 'group_goal_reached', jsonb_build_object(
      'groupId', p_group_id,
      'groupName', v_group_name,
      'totalMinutes', p_total_minutes,
      'weeklyGoal', p_weekly_goal
    )
    from public.group_members gm
    where gm.group_id = p_group_id;
  end if;

  return v_claimed;
end;
$$;

grant execute on function public.claim_group_weekly_celebration(uuid, integer, integer) to authenticated;
