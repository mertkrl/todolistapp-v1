// addMilestone/addSubtask/toggleSubtask/deleteSubtask/_deleteSubtaskWithUndo/
// toggleMilestone/deleteMilestone/milestoneToTask → planning.js'ten taşındı
// (Faz devamı). planning.js'ten ÖNCE yüklenir (bkz. inline-module-loader.js),
// bu yüzden window.* köprüleri tanımlanmadan önce çağrılabilir — sadece bu
// fonksiyonların kendisi çağrıldığında (init sonrası) bu köprüler zaten hazır
// olur. NOT: script.js'te de bambaşka bir "deleteMilestone" (goal-details
// bölümü) var — o modül-yerel bir tanım olduğu için isim çakışması yok,
// bilerek window'a bağlanmadı (sadece planning.js içi çağrı yerleri için).
import { msUid } from './planning-utils.js';
import { _recalcProgress, refreshDetailSummary } from './planning-goal-detail-render.js';
import { renderMilestoneList } from './planning-milestone-list-render.js';

export function addMilestone(goalId, data) {
    const g = window._pgGetGoals().find(g=>g.id===goalId);
    if (!g) return;
    if (!g.milestones) g.milestones = [];
    const ms = {
        id: msUid(), title: data.title.trim(),
        description: (data.description||'').trim(),
        due_date: data.due_date||'', done: false,
        order: g.milestones.length, subtasks: [],
        created_at: new Date().toISOString(),
    };
    g.milestones.push(ms);
    _recalcProgress(g); g._dirty = true;
    window.persistGoals(); window.render(); renderMilestoneList(goalId);
    window.toast('Milestone eklendi 🚩');
}
window.addMilestone = addMilestone;

export function addSubtask(goalId, msId, title) {
    const g  = window._pgGetGoals().find(x=>x.id===goalId);
    const ms = (g?.milestones||[]).find(m=>m.id===msId);
    if (!g||!ms||!title.trim()) return;
    if (!ms.subtasks) ms.subtasks = [];
    ms.subtasks.push({ id: msUid(), title: title.trim(), done: false });
    g._dirty = true;
    window.persistGoals(); renderMilestoneList(goalId);
}
window.addSubtask = addSubtask;

export function toggleSubtask(goalId, msId, stId) {
    const g  = window._pgGetGoals().find(x=>x.id===goalId);
    const ms = (g?.milestones||[]).find(m=>m.id===msId);
    const st = (ms?.subtasks||[]).find(s=>s.id===stId);
    if (!g||!ms||!st) return;
    st.done = !st.done;
    if (ms.subtasks.length > 0 && ms.subtasks.every(s=>s.done)) {
        ms.done = true; _recalcProgress(g);
        window.toast('Milestone tamamlandı! 🎉');
        window._sparkle(document.querySelector(`[data-msid="${msId}"] .pg-ms-check`));
        if (g.progress_pct === 100) setTimeout(() => window._goalComplete(g), 300);
    } else if (ms.done && ms.subtasks.some(s=>!s.done)) {
        ms.done = false; _recalcProgress(g);
    }
    g._dirty = true;
    window.persistGoals(); window.render(); renderMilestoneList(goalId); refreshDetailSummary(g);
}
window.toggleSubtask = toggleSubtask;

export function deleteSubtask(goalId, msId, stId) {
    const g  = window._pgGetGoals().find(x=>x.id===goalId);
    const ms = (g?.milestones||[]).find(m=>m.id===msId);
    if (!g||!ms) return;
    ms.subtasks = (ms.subtasks||[]).filter(s=>s.id!==stId);
    g._dirty = true;
    window.persistGoals(); renderMilestoneList(goalId);
}

// deleteSubtask hiçbir onay/geri-al olmadan kalıcı siliyordu — _deleteGoalWithUndo
// ve _deleteMilestoneWithUndo'da zaten kullanılan geri-al (undo toast) desenini
// burada da uygulayıp tutarlı hale getiriyoruz.
export function _deleteSubtaskWithUndo(goalId, msId, stId) {
    const g  = window._pgGetGoals().find(x=>x.id===goalId);
    const ms = (g?.milestones||[]).find(m=>m.id===msId);
    const st = (ms?.subtasks||[]).find(s=>s.id===stId);
    if (!g||!ms||!st) return;
    const snapshot = JSON.parse(JSON.stringify(st));
    const order = (ms.subtasks||[]).findIndex(s=>s.id===stId);
    deleteSubtask(goalId, msId, stId);
    window.toast(`"${snapshot.text||snapshot.title||'Görev'}" silindi`, {
        undoFn: () => {
            const g2 = window._pgGetGoals().find(x=>x.id===goalId);
            const ms2 = (g2?.milestones||[]).find(m=>m.id===msId);
            if (!g2||!ms2) return;
            ms2.subtasks = ms2.subtasks||[];
            ms2.subtasks.splice(order>=0?order:ms2.subtasks.length, 0, snapshot);
            g2._dirty = true;
            window.persistGoals(); renderMilestoneList(goalId);
            window.toast('Geri alındı ↩');
        },
        undoLabel: 'Geri Al',
        duration: 4000,
    });
}
window._deleteSubtaskWithUndo = _deleteSubtaskWithUndo;

export function toggleMilestone(goalId, msId) {
    const g = window._pgGetGoals().find(g=>g.id===goalId);
    const ms = (g?.milestones||[]).find(m=>m.id===msId);
    if (!g || !ms) return;
    ms.done = !ms.done;
    _recalcProgress(g); g._dirty = true;
    window.persistGoals(); window.render();
    renderMilestoneList(goalId);
    refreshDetailSummary(g);
    if (ms.done) {
        window.toast('Milestone tamamlandı! 🎉');
        window._sparkle(document.querySelector(`[data-msid="${msId}"] .pg-ms-check`));
        if (g.progress_pct === 100) setTimeout(() => window._goalComplete(g), 300);
    }
    // Broadcast
    if (window.PlanningCollab?.channel) {
        window.PlanningCollab.broadcast('ms_toggle', { goalId, msId, done: ms.done });
    }
}
window.toggleMilestone = toggleMilestone;

export function deleteMilestone(goalId, msId) {
    const g = window._pgGetGoals().find(g=>g.id===goalId);
    if (!g) return;
    g.milestones = (g.milestones||[]).filter(m=>m.id!==msId);
    _recalcProgress(g); g._dirty = true;
    window.persistGoals(); window.render(); renderMilestoneList(goalId);
    // Bu milestone'un takvim event'ini doğrudan ID ile temizle (stale cache'e bağımlı kalma)
    const events = window.FocusStorage.get('events', {});
    const evId = 'ms_cal_' + msId;
    let evChanged = false;
    for (const date in events) {
        const before = events[date].length;
        events[date] = events[date].filter(e => e.id !== evId);
        if (events[date].length !== before) evChanged = true;
        if (!events[date].length) delete events[date];
    }
    if (evChanged) window.FocusStorage.set('events', events);
    if (typeof window.syncAllMilestonesToCalendar === 'function')
        window.syncAllMilestonesToCalendar();
    if (typeof window.renderCalendarGlobal === 'function')
        window.renderCalendarGlobal();
    if (typeof window.renderTodaySprintWidget === 'function')
        window.renderTodaySprintWidget();
    window.toast('Milestone silindi');
    // Broadcast
    if (window.PlanningCollab?.channel) {
        window.PlanningCollab.broadcast('ms_delete', { goalId, msId });
    }
}
window._pgDeleteMilestone = deleteMilestone;

export function milestoneToTask(goalId, msId) {
    const g  = window._pgGetGoals().find(g=>g.id===goalId);
    const ms = (g?.milestones||[]).find(m=>m.id===msId);
    if (!g||!ms) return;
    const date = ms.due_date || new Date().toISOString().split('T')[0];
    if (typeof window.addGlobalTask === 'function') {
        window.addGlobalTask(ms.title, g.priority||2, g.category||'', date, '09:00','10:00','', g.id);
        if (typeof window.renderTasksGlobal==='function') window.renderTasksGlobal();
    } else {
        const tasks = window.FocusStorage.get('tasks', []);
        tasks.push({ id:'task_'+Date.now(), text:ms.title, completed:false,
            priority:g.priority||2, category:g.category||'', date,
            timeStart:'09:00', timeEnd:'10:00', parentGoal:g.id, parentMilestone:ms.id });
        window.FocusStorage.set('tasks', tasks);
    }
    window.toast('Göreve dönüştürüldü ✓ — "Bugün" sekmesini kontrol et');
}
window.milestoneToTask = milestoneToTask;
