// ============================================================
// FOCUSAI SCRIPT-CALENDAR-SYNC-BRIDGE.JS
// script.js'ten çıkarılmış: görev/takvim depo senkronizasyonu ve
// planlama milestone'larının takvimle senkronizasyonu
// (syncTasksFromStorage, renderCalendarGlobal, syncMilestoneToCalendar,
// syncAllMilestonesToCalendar, getPlanningGoalsForDropdown).
// script.js'in window'a koyduğu ince sarmalayıcıları (__getTasksRef,
// __setTasksRef, __getCalendarEventsRef, __setCalendarEventsRef,
// __getRenderCalendarRef, __getRenderEventsRef) kullanır.
// script.js'ten SONRA yüklenir.
// ============================================================
import { getTasksRef, setTasksRef, getCalendarEventsRef, setCalendarEventsRef, getRenderCalendarRef, getRenderEventsRef } from './script.js';

export function syncTasksFromStorage() {
    const tasks = window.Store.tasks.get();
    const calendarEvents = window.Store.events.get();
    setTasksRef(tasks);
    setCalendarEventsRef(calendarEvents);
    let eventsFixed = false;
    tasks.forEach(t => {
        if (!t.date || !t.date.match(/^\d{4}-\d{2}-\d{2}$/)) return;
        const p = t.date.split('-');
        const ddmmyyyy = `${p[2]}-${p[1]}-${p[0]}`;
        t.date = ddmmyyyy;
        const oldKey = `${p[0]}-${p[1]}-${p[2]}`;
        const existing = (calendarEvents[oldKey] || []).find(e => e.id === t.id);
        if (existing) {
            calendarEvents[oldKey] = (calendarEvents[oldKey] || []).filter(e => e.id !== t.id);
            if (!calendarEvents[oldKey].length) delete calendarEvents[oldKey];
            if (!calendarEvents[ddmmyyyy]) calendarEvents[ddmmyyyy] = [];
            if (!calendarEvents[ddmmyyyy].find(e => e.id === t.id)) calendarEvents[ddmmyyyy].push(existing);
            eventsFixed = true;
        }
    });
    if (eventsFixed) {
        window.Store.tasks.set(tasks);
        window.Store.events.set(calendarEvents);
    }
}
window.syncTasksFromStorage = syncTasksFromStorage;

export function renderCalendarGlobal() {
    setTasksRef(window.Store.tasks.get());
    setCalendarEventsRef(window.Store.events.get());
    const renderCalendarRef = getRenderCalendarRef();
    const renderEventsRef = getRenderEventsRef();
    if (typeof renderCalendarRef === 'function') renderCalendarRef();
    if (typeof renderEventsRef === 'function') renderEventsRef();
    if (typeof window.renderTasks === 'function') window.renderTasks();
}
window.renderCalendarGlobal = renderCalendarGlobal;

export function syncMilestoneToCalendar(milestone, goalTitle, goalColor, action) {
    if (!milestone.due_date) return;
    const calendarEvents = getCalendarEventsRef();
    const _toDD = (d) => { if (!d) return d; const p = d.split('-'); return p.length === 3 && p[0].length === 4 ? `${p[2]}-${p[1]}-${p[0]}` : d; };
    const date = _toDD(milestone.due_date);
    const evId = 'ms_cal_' + milestone.id;
    if (calendarEvents[date]) {
        calendarEvents[date] = calendarEvents[date].filter(e => e.id !== evId);
        if (!calendarEvents[date].length) delete calendarEvents[date];
    }
    if (action === 'add' && !milestone.done && !milestone.start_time && !milestone.is_task_mirror && !milestone.task_mirror_id) {
        if (!calendarEvents[date]) calendarEvents[date] = [];
        calendarEvents[date].push({
            id: evId,
            text: '🚩 ' + milestone.title + ' (' + goalTitle + ')',
            timeStart: '09:00', timeEnd: '09:30',
            priority: 1,
            isMilestone: true,
            milestoneColor: goalColor,
        });
    }
    window.Store.events.set(calendarEvents);
    const renderCalendarRef = getRenderCalendarRef();
    const renderEventsRef = getRenderEventsRef();
    if (typeof renderCalendarRef === 'function') renderCalendarRef();
    if (typeof renderEventsRef === 'function') renderEventsRef();
}
window.syncMilestoneToCalendar = syncMilestoneToCalendar;

export function syncAllMilestonesToCalendar() {
    const calendarEvents = getCalendarEventsRef();
    for (const date in calendarEvents) {
        calendarEvents[date] = calendarEvents[date].filter(e => !e.isMilestone);
        if (!calendarEvents[date].length) delete calendarEvents[date];
    }
    const planningGoals = (typeof window.FocusStorage !== 'undefined')
        ? window.FocusStorage.get('planning_goals', [])
        : JSON.parse(localStorage.getItem('planning_goals') || '[]', window._safeJsonReviver);
    planningGoals.forEach(g => {
        if (g.status === 'archived') return;
        if (g.plan_mode === 'lesson-plan' && !g.lpa_id) return;
        (g.milestones || []).forEach(ms => {
            window.syncMilestoneToCalendar(ms, g.title, g.color, 'add');
        });
    });
}
window.syncAllMilestonesToCalendar = syncAllMilestonesToCalendar;

export function getPlanningGoalsForDropdown() {
    const pg = (typeof window.FocusStorage !== 'undefined')
        ? window.FocusStorage.get('planning_goals', [])
        : JSON.parse(localStorage.getItem('planning_goals') || '[]', window._safeJsonReviver);
    return pg.filter(g => g.status !== 'archived');
}
window.getPlanningGoalsForDropdown = getPlanningGoalsForDropdown;
