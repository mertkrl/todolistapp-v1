-- ### 034_milestone_start_date.sql
-- Add start_date column to planning_milestones for calendar range coloring
alter table planning_milestones
    add column if not exists start_date date;
