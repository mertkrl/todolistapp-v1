-- ### 001_personal_data.sql
-- FocusAI -> Supabase Migration - Milestone 1 (Faz 0)
-- Personal data schema: tasks, goals, habits, calendar, journal, stats.
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).

create extension if not exists pgcrypto;

-- ============================================================
-- profiles  (1:1 with auth.users)
-- ============================================================
create table public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  username             text unique,
  display_name         text,
  avatar_color         text,
  app_theme            text not null default 'dark',
  tour_completed       boolean not null default false,
  timer_settings       jsonb not null default '{"pomodoro":25,"shortBreak":5,"longBreak":15}'::jsonb,
  weekly_planned       text,
  focus_minutes_total  integer not null default 0,
  imported_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ============================================================
-- goals
-- ============================================================
create table public.goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  title         text not null,
  description   text,
  deadline      date,
  category      text,
  status        text not null default 'active',
  focus_time    integer not null default 0,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index goals_user_idx on public.goals (user_id);

-- ============================================================
-- habit_categories  (composite PK preserves existing string ids)
-- ============================================================
create table public.habit_categories (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  id       text not null,
  name     text not null,
  color    text,
  primary key (user_id, id)
);

-- ============================================================
-- habits
-- ============================================================
create table public.habits (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  name         text not null,
  icon         text,
  target_days  integer,
  category     text,
  start_date   date,
  buddy        text,
  pair_id      text,
  history      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index habits_user_idx on public.habits (user_id);

-- ============================================================
-- habit_goals  (join table for habit.parentGoals[])
-- ============================================================
create table public.habit_goals (
  habit_id  uuid not null references public.habits(id) on delete cascade,
  goal_id   uuid not null references public.goals(id) on delete cascade,
  primary key (habit_id, goal_id)
);

-- ============================================================
-- tasks
-- ============================================================
create table public.tasks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  text             text not null,
  completed        boolean not null default false,
  priority         text,
  category         text,
  task_date        date not null,
  time_start       time,
  time_end         time,
  is_overnight     boolean not null default false,
  parent_habit_id  uuid references public.habits(id) on delete set null,
  parent_goal_id   uuid references public.goals(id) on delete set null,
  recurring        text,
  routine_id       text,
  week_str         text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index tasks_user_date_idx    on public.tasks (user_id, task_date);
create index tasks_user_routine_idx on public.tasks (user_id, routine_id);
create index tasks_user_week_idx    on public.tasks (user_id, week_str);

-- ============================================================
-- events  (calendar entries, same shape as tasks minus completed/recurring)
-- ============================================================
create table public.events (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  text             text not null,
  event_date       date not null,
  time_start       time,
  time_end         time,
  priority         text,
  is_overnight     boolean not null default false,
  parent_habit_id  uuid references public.habits(id) on delete set null,
  parent_goal_id   uuid references public.goals(id) on delete set null,
  routine_id       text,
  week_str         text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index events_user_date_idx on public.events (user_id, event_date);

-- ============================================================
-- journal_entries  (unifies reflection_history + focusai_reflections)
-- ============================================================
create table public.journal_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  entry_date   date not null,
  achieve      text,
  improve      text,
  completed    boolean not null default false,
  skipped      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, entry_date)
);

-- ============================================================
-- daily_stats  (unifies focus_history + category_focus + focus_hours)
-- ============================================================
create table public.daily_stats (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  stat_date          date not null,
  focus_minutes      integer not null default 0,
  category_minutes   jsonb not null default '{}'::jsonb,
  hourly_minutes     jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, stat_date)
);

-- ============================================================
-- daily_highlights  (unifies highlight_history)
-- ============================================================
create table public.daily_highlights (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  highlight_date  date not null,
  text            text,
  completed       boolean not null default false,
  achievement     text,
  contract_if     text,
  contract_then   text,
  parent_goal_id  uuid references public.goals(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, highlight_date)
);

-- ============================================================
-- mind_dumps
-- ============================================================
create table public.mind_dumps (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  text        text not null,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- mind_dump_conversions
-- ============================================================
create table public.mind_dump_conversions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  mind_dump_id     uuid,
  conversion_date  date,
  created_at       timestamptz not null default now()
);

-- ============================================================
-- Row Level Security: every table is "owner can do everything,
-- nobody else can see or touch it".
-- ============================================================
alter table public.profiles              enable row level security;
alter table public.goals                 enable row level security;
alter table public.habit_categories      enable row level security;
alter table public.habits                enable row level security;
alter table public.habit_goals           enable row level security;
alter table public.tasks                 enable row level security;
alter table public.events                enable row level security;
alter table public.journal_entries       enable row level security;
alter table public.daily_stats           enable row level security;
alter table public.daily_highlights      enable row level security;
alter table public.mind_dumps            enable row level security;
alter table public.mind_dump_conversions enable row level security;

create policy "own_profile_all" on public.profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

create policy "own_data_all" on public.goals for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own_data_all" on public.habit_categories for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own_data_all" on public.habits for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own_data_all" on public.tasks for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own_data_all" on public.events for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own_data_all" on public.journal_entries for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own_data_all" on public.daily_stats for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own_data_all" on public.daily_highlights for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own_data_all" on public.mind_dumps for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own_data_all" on public.mind_dump_conversions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- habit_goals has no user_id column; gate via the parent habit's owner.
create policy "own_data_all" on public.habit_goals for all
  using (exists (
    select 1 from public.habits h
    where h.id = habit_goals.habit_id and h.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.habits h
    where h.id = habit_goals.habit_id and h.user_id = auth.uid()
  ));

-- ============================================================
-- Auto-create a profile row whenever a new auth user signs up
-- ============================================================
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Keep updated_at current on every UPDATE
-- ============================================================
create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_profiles         before update on public.profiles         for each row execute function public.touch_updated_at();
create trigger touch_goals            before update on public.goals            for each row execute function public.touch_updated_at();
create trigger touch_habits           before update on public.habits           for each row execute function public.touch_updated_at();
create trigger touch_tasks            before update on public.tasks            for each row execute function public.touch_updated_at();
create trigger touch_events           before update on public.events           for each row execute function public.touch_updated_at();
create trigger touch_journal_entries  before update on public.journal_entries  for each row execute function public.touch_updated_at();
create trigger touch_daily_stats      before update on public.daily_stats      for each row execute function public.touch_updated_at();
create trigger touch_daily_highlights before update on public.daily_highlights for each row execute function public.touch_updated_at();
