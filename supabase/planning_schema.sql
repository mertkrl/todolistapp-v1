-- ════════════════════════════════════════════
--  FocusAI — Planlama Modülü  (Faz 1 + 4)
--  Supabase SQL Schema
-- ════════════════════════════════════════════
--  Çalıştırma: Supabase Dashboard > SQL Editor > New Query > Paste > Run

-- ── planning_goals tablosu ───────────────────
create table if not exists planning_goals (
    id              text primary key,
    user_id         uuid references auth.users(id) on delete cascade not null,
    title           text not null,
    description     text default '',
    category        text default 'diger',
    color           text default '#a78bfa',
    deadline        date,
    priority        smallint default 2,
    status          text default 'active',
    progress_pct    smallint default 0,
    milestone_count smallint default 0,
    is_collaborative boolean default false,
    collab_room_id  text,
    created_at      timestamptz default now(),
    updated_at      timestamptz default now()
);

-- ── planning_milestones tablosu ──────────────
create table if not exists planning_milestones (
    id             text primary key,
    goal_id        text references planning_goals(id) on delete cascade not null,
    user_id        uuid references auth.users(id) on delete cascade not null,
    title          text not null,
    due_date       date,
    start_date     date,
    order_index    smallint default 0,
    done           boolean default false,
    auto_generated boolean default false,
    created_at     timestamptz default now(),
    updated_at     timestamptz default now()
);

-- ── collab_rooms tablosu (Faz 4) ─────────────
create table if not exists collab_rooms (
    id          text primary key,
    goal_id     text references planning_goals(id) on delete cascade not null,
    owner_id    uuid references auth.users(id) on delete cascade not null,
    invite_code         text unique not null,
    name                text default '',
    approval_threshold  text default 'majority',
    created_at          timestamptz default now()
);

-- ── collab_room_members tablosu (Faz 4) ──────
create table if not exists collab_room_members (
    room_id   text references collab_rooms(id) on delete cascade not null,
    user_id   uuid references auth.users(id) on delete cascade not null,
    role      text default 'editor',   -- owner | editor | viewer
    joined_at timestamptz default now(),
    primary key (room_id, user_id)
);

-- ── goal_dependencies tablosu (5.3) ─────────
create table if not exists goal_dependencies (
    id      text primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    "from"  text not null,
    "to"    text not null,
    unique (user_id, "from", "to")
);
alter table goal_dependencies enable row level security;
create policy "goal_deps_own" on goal_dependencies
    for all using (auth.uid() = user_id);
create index if not exists idx_goal_deps_user on goal_dependencies(user_id);

-- ── collab_comments tablosu (F1.3) ──────────
create table if not exists collab_comments (
    id           text primary key,
    room_id      text references collab_rooms(id) on delete cascade,
    ms_id        text not null,
    author_id    uuid references auth.users(id) on delete set null,
    author_name  text default '',
    author_color text default '#888',
    text         text not null,
    created_at   timestamptz default now()
);

-- ── RLS ──────────────────────────────────────
alter table planning_goals       enable row level security;
alter table planning_milestones  enable row level security;
alter table collab_rooms         enable row level security;
alter table collab_room_members  enable row level security;

-- planning_goals: sahibi her şeyi yapabilir, oda üyeleri okuyabilir
create policy "planning_goals_own" on planning_goals
    for all using (auth.uid() = user_id);

create policy "planning_goals_collab_read" on planning_goals
    for select using (
        id in (
            select cr.goal_id from collab_rooms cr
            join collab_room_members crm on crm.room_id = cr.id
            where crm.user_id = auth.uid()
        )
    );

-- planning_milestones: sahibi veya oda üyesi (editör/sahip)
create policy "planning_milestones_own" on planning_milestones
    for all using (auth.uid() = user_id);

create policy "planning_milestones_collab" on planning_milestones
    for all using (
        goal_id in (
            select cr.goal_id from collab_rooms cr
            join collab_room_members crm on crm.room_id = cr.id
            where crm.user_id = auth.uid() and crm.role in ('owner','editor')
        )
    );

-- collab_rooms: sahibi yönetir, üyeler okur
create policy "collab_rooms_owner" on collab_rooms
    for all using (auth.uid() = owner_id);

create policy "collab_rooms_member_read" on collab_rooms
    for select using (
        id in (select room_id from collab_room_members where user_id = auth.uid())
    );

-- collab_comments: oda üyeleri yorum yapabilir ve okuyabilir
alter table collab_comments enable row level security;

create policy "collab_comments_room_member" on collab_comments
    for all using (
        room_id in (
            select room_id from collab_room_members where user_id = auth.uid()
        )
        or author_id = auth.uid()
    );

-- collab_room_members: üyeler kendi satırlarını okur/siler, sahip hepsini yönetir
create policy "collab_members_own" on collab_room_members
    for all using (auth.uid() = user_id);

create policy "collab_members_owner_manage" on collab_room_members
    for all using (
        room_id in (select id from collab_rooms where owner_id = auth.uid())
    );

-- Davet kodu ile üye olmak için herkesin okuyabilmesi (code lookup)
create policy "collab_rooms_invite_lookup" on collab_rooms
    for select using (true);

-- ── Index'ler ────────────────────────────────
create index if not exists idx_planning_goals_user       on planning_goals(user_id);
create index if not exists idx_planning_goals_status     on planning_goals(status);
create index if not exists idx_planning_milestones_goal  on planning_milestones(goal_id);
create index if not exists idx_collab_rooms_goal         on collab_rooms(goal_id);
create index if not exists idx_collab_rooms_invite       on collab_rooms(invite_code);
create index if not exists idx_collab_members_room       on collab_room_members(room_id);
create index if not exists idx_collab_members_user       on collab_room_members(user_id);
create index if not exists idx_collab_comments_room      on collab_comments(room_id);
create index if not exists idx_collab_comments_ms        on collab_comments(ms_id);

-- ── updated_at tetikleyicileri ────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger planning_goals_updated_at
    before update on planning_goals for each row execute function update_updated_at();

create trigger planning_milestones_updated_at
    before update on planning_milestones for each row execute function update_updated_at();
