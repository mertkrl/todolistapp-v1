// supabase-client.js'ten çıkarıldı: localStorage-şekli <-> Postgres satırı saf dönüştürücüler
// ve tarih formatı yardımcıları. Sadece kendi parametrelerine bağlı, modül-seviye
// paylaşılan senkronizasyon state'ine (client/session/timers) dokunmuyor.

export function ddmmyyyyToIso(s) {
        if (!s) return null;
        const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
        return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
    }

export function isoToDdmmyyyy(s) {
        if (!s) return null;
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
        return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
    }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v) {
        return typeof v === 'string' && UUID_RE.test(v);
    }

    // ============================================================
    // Satır dönüştürücüler (localStorage şekli -> Postgres satırı)
    // ============================================================
export function taskToRow(t, userId) {
        return {
            id: t.id,
            user_id: userId,
            text: t.text,
            completed: !!t.completed,
            priority: t.priority || null,
            category: t.category || null,
            task_date: ddmmyyyyToIso(t.date),
            time_start: t.timeStart || null,
            time_end: t.timeEnd || null,
            is_overnight: !!t.isOvernight,
            parent_habit_id: isUuid(t.parentHabit) ? t.parentHabit : null,
            parent_goal_id: isUuid(t.parentGoal) ? t.parentGoal : null,
            recurring: t.recurring || null,
            routine_id: t.routineId || null,
            week_str: t.weekStr || null,
        };
    }

export function flattenEvents(eventsObj, userId) {
        const rows = [];
        for (const dateKey in (eventsObj || {})) {
            const iso = ddmmyyyyToIso(dateKey);
            (eventsObj[dateKey] || []).forEach(e => {
                // Skip milestone marker events — they have non-UUID ids and are derived data
                if (e.isMilestone) return;
                rows.push({
                    id: e.id,
                    user_id: userId,
                    text: e.text,
                    event_date: iso,
                    time_start: e.timeStart || null,
                    time_end: e.timeEnd || null,
                    priority: e.priority || null,
                    is_overnight: !!e.isOvernight,
                    parent_habit_id: isUuid(e.parentHabit) ? e.parentHabit : null,
                    parent_goal_id: isUuid(e.parentGoal) ? e.parentGoal : null,
                    routine_id: e.routineId || null,
                    week_str: e.weekStr || null,
                });
            });
        }
        return rows;
    }

export function goalToRow(g, userId) {
        return {
            id: g.id,
            user_id: userId,
            title: g.title,
            description: g.desc || null,
            deadline: g.deadline || null,
            category: g.category || null,
            status: g.status || 'active',
            focus_time: g.focusTime || 0,
            completed_at: g.completedAt ? new Date(g.completedAt).toISOString() : null,
            created_at: g.createdAt ? new Date(g.createdAt).toISOString() : undefined,
            milestones: g.milestones || [],
        };
    }

export function habitToRow(h, userId) {
        return {
            id: h.id,
            user_id: userId,
            name: h.name,
            icon: h.icon || null,
            target_days: h.targetDays || null,
            category: h.category || null,
            start_date: ddmmyyyyToIso(h.startDate),
            buddy: h.buddy || null,
            pair_id: h.pairId || null,
            history: h.history || {},
            // parent_goals artık habits satırının kendisinde tutuluyor (tek atomik upsert) —
            // ayrı habit_goals tablosuna bağımlı iki aşamalı yazım, hard refresh'te aralarına
            // girip bağlantının kaybolmasına yol açıyordu.
            parent_goals: (h.parentGoals || []).filter(gid => isUuid(gid)),
        };
    }

export function habitCategoryToRow(c, userId) {
        return { user_id: userId, id: c.id, name: c.name, color: c.color || null };
    }

export function journalToRow(e, userId) {
        return {
            user_id: userId,
            entry_date: e.date,
            achieve: e.achieve || '',
            improve: e.improve || '',
            completed: !!e.completed,
            skipped: !!e.skipped,
        };
    }

    // ============================================================
    // Ters dönüştürücüler (Postgres satırı -> localStorage şekli)
    // ============================================================
export function rowToTask(r) {
        return {
            id: r.id,
            text: r.text,
            completed: !!r.completed,
            priority: r.priority || '',
            category: r.category || '',
            date: isoToDdmmyyyy(r.task_date),
            timeStart: r.time_start || '',
            timeEnd: r.time_end || '',
            isOvernight: !!r.is_overnight,
            parentHabit: r.parent_habit_id || '',
            parentGoal: r.parent_goal_id || '',
            recurring: r.recurring || '',
            routineId: r.routine_id || '',
            weekStr: r.week_str || '',
        };
    }

export function rowsToEvents(rows) {
        const eventsObj = {};
        (rows || []).forEach(r => {
            const dateKey = isoToDdmmyyyy(r.event_date);
            if (!eventsObj[dateKey]) eventsObj[dateKey] = [];
            eventsObj[dateKey].push({
                id: r.id,
                text: r.text,
                timeStart: r.time_start || '',
                timeEnd: r.time_end || '',
                priority: r.priority || '',
                parentHabit: r.parent_habit_id || '',
                parentGoal: r.parent_goal_id || '',
                isOvernight: !!r.is_overnight,
                routineId: r.routine_id || '',
                weekStr: r.week_str || '',
            });
        });
        return eventsObj;
    }

export function rowToGoal(r) {
        return {
            id: r.id,
            title: r.title,
            desc: r.description || '',
            deadline: r.deadline || '',
            category: r.category || '',
            status: r.status || 'active',
            focusTime: r.focus_time || 0,
            completedAt: r.completed_at ? new Date(r.completed_at).getTime() : undefined,
            createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
            milestones: Array.isArray(r.milestones) ? r.milestones : [],
        };
    }

export function rowsToHabits(habitRows, habitGoalRows) {
        const goalsByHabit = {};
        (habitGoalRows || []).forEach(hg => {
            if (!goalsByHabit[hg.habit_id]) goalsByHabit[hg.habit_id] = [];
            goalsByHabit[hg.habit_id].push(hg.goal_id);
        });
        return (habitRows || []).map(r => ({
            id: r.id,
            name: r.name,
            icon: r.icon || '',
            targetDays: r.target_days || 21,
            category: r.category || '',
            startDate: isoToDdmmyyyy(r.start_date),
            buddy: r.buddy || 'none',
            pairId: r.pair_id || undefined,
            // parent_goals sütunu (atomik, habits satırıyla birlikte yazılıyor) öncelikli;
            // sütun henüz migrate edilmemiş/boşsa eski habit_goals join tablosuna düş.
            parentGoals: (Array.isArray(r.parent_goals) && r.parent_goals.length > 0)
                ? r.parent_goals
                : (goalsByHabit[r.id] || []),
            history: r.history || {},
        }));
    }

export function rowToHabitCategory(r) {
        const cat = { id: r.id, name: r.name };
        if (r.color) cat.color = r.color;
        return cat;
    }

export function rowToJournalEntry(r) {
        return {
            date: r.entry_date,
            achieve: r.achieve || '',
            improve: r.improve || '',
            completed: !!r.completed,
            skipped: !!r.skipped,
        };
    }
