// ─── PLANVIEW COLLAB (GERÇEK ZAMANLI ORTAK PLANLAMA) DİNLEYİCİLERİ ─────────
// planning.js'in openPlanView fonksiyonundan çıkarıldı (Faz H devamı, dev
// fonksiyon refactoru). Eskiden openPlanView'in içinde tek bir ~160 satırlık
// nesne literaliydi; kendi başına _pvBuildCollabHandlers() adında ayrı bir
// fonksiyona bölünmüştü (bkz. o dönemin yorumu) ve module-seviye pvGoalId/
// goals/pvWiz/pvSelectedDate'e bare erişiyordu — parametre almıyordu.
// Bu dosyaya taşınabilmesi için o state'lerin hepsi planning.js'te zaten
// mevcut olan window.__get/__set köprüleriyle okunuyor/yazılıyor.
import { _pvRenderHeader, _pvRenderStepper } from './planning-plan-header.js';
import { _pvUpdateOverallProgress } from './planning-plan-view-dom-fx.js';
import { _pvUpdateActivityFeed } from './planning-ghost-toast.js';
import { _recalcProgress } from './planning-goal-detail-render.js';

// openPlanView'in Collab (gerçek zamanlı ortak planlama) olay dinleyicileri —
// hepsi module-seviye pvGoalId/goals'a bare erişiyor, parametre gerekmiyor.
// Faz S devamı, dev fonksiyon refactoru: eskiden openPlanView'in içinde
// tek bir ~160 satırlık nesne literaliydi.
export function _pvBuildCollabHandlers() {
    return {
            onMilestoneChange: (type, payload) => {
                const pvGoalId = window.__getPvGoalId();
                const goals = window._pgGetGoals();
                const gLive = goals.find(x => x.id === pvGoalId);
                if (!gLive) return;
                if (type === 'toggle' && payload.msId) {
                    const ms = (gLive.milestones || []).find(m => m.id === payload.msId);
                    if (ms) { ms.done = payload.done; _recalcProgress(gLive); gLive._dirty = true; window.persistGoals(); }
                } else if (type === 'add' && payload.milestone) {
                    gLive.milestones = gLive.milestones || [];
                    if (!gLive.milestones.find(m => m.id === payload.milestone.id)) {
                        gLive.milestones.push(payload.milestone);
                        gLive._dirty = true;
                        window.persistGoals();
                    }
                } else if (type === 'delete' && payload.msId) {
                    gLive.milestones = (gLive.milestones || []).filter(m => m.id !== payload.msId);
                    _recalcProgress(gLive);
                    gLive._dirty = true;
                    window.persistGoals();
                } else if (type === 'batch_set' && payload.milestones) {
                    gLive.milestones = payload.milestones;
                    _recalcProgress(gLive);
                    gLive._dirty = true;
                    window.persistGoals();
                } else if (type === 'update' && payload.msId) {
                    const ms = (gLive.milestones || []).find(m => m.id === payload.msId);
                    if (ms) { Object.assign(ms, payload.fields); gLive._dirty = true; window.persistGoals(); }
                }
                window._pvRender(gLive);
                window.render();
            },
            onTaskChange: (type, payload) => {
                let tasks = FocusStorage.get('tasks', []);
                let events = FocusStorage.get('events', {});
                let changed = false;

                // Helper: sync a task into calendarEvents so the sidebar calendar shows it
                const _syncEvent = (task) => {
                    if (!task.date) return;
                    if (!events[task.date]) events[task.date] = [];
                    if (!events[task.date].find(e => e.id === task.id)) {
                        events[task.date].push({
                            id: task.id, text: task.text,
                            timeStart: task.timeStart, timeEnd: task.timeEnd,
                            priority: task.priority, parentGoal: task.parentGoal,
                            parentHabit: task.parentHabit || '', isOvernight: task.isOvernight || false,
                        });
                    }
                };
                const _removeEvent = (taskId) => {
                    Object.keys(events).forEach(d => {
                        events[d] = (events[d] || []).filter(e => e.id !== taskId);
                    });
                };

                if (type === 'add' && payload.task) {
                    if (!tasks.find(t => t.id === payload.task.id)) {
                        const newTask = {
                            ...payload.task,
                            ...(payload.user_name ? { _addedBy: { name: payload.user_name, color: payload.user_color || '#888' } } : {})
                        };
                        tasks.push(newTask);
                        _syncEvent(newTask);
                        changed = true;
                    }
                } else if (type === 'pending' && payload.task) {
                    if (!tasks.find(t => t.id === payload.task.id)) {
                        const newTask = { ...payload.task, _pending: true,
                            _addedBy: { name: payload.user_name, color: payload.user_color } };
                        tasks.push(newTask);
                        // pending görevler onaylanana kadar sidebar'da gözükmesin
                        changed = true;
                    }
                } else if (type === 'approve' && payload.taskId) {
                    const t = tasks.find(x => x.id === payload.taskId);
                    if (t && t._pending) { delete t._pending; _syncEvent(t); changed = true; }
                } else if (type === 'reject' && payload.taskId) {
                    _removeEvent(payload.taskId);
                    const before = tasks.length;
                    tasks = tasks.filter(t => t.id !== payload.taskId);
                    changed = tasks.length !== before;
                } else if (type === 'delete' && payload.taskId) {
                    _removeEvent(payload.taskId);
                    const before = tasks.length;
                    tasks = tasks.filter(t => t.id !== payload.taskId);
                    changed = tasks.length !== before;
                } else if (type === 'toggle' && payload.taskId) {
                    const t = tasks.find(x => x.id === payload.taskId);
                    if (t) { t.completed = payload.completed; changed = true; }
                } else if (type === 'sync' && payload.tasks) {
                    payload.tasks.forEach(incoming => {
                        if (!tasks.find(t => t.id === incoming.id)) {
                            tasks.push(incoming);
                            if (!incoming._pending) _syncEvent(incoming);
                            changed = true;
                        }
                    });
                }
                if (changed) {
                    FocusStorage.set('tasks', tasks);
                    FocusStorage.set('events', events);
                    if (typeof window.syncTasksFromStorage === 'function') window.syncTasksFromStorage();
                    // Sidebar calendar must reflect the new task immediately
                    if (typeof window.renderCalendarGlobal === 'function') window.renderCalendarGlobal();
                }
                const pvGoalId = window.__getPvGoalId();
                const goals = window._pgGetGoals();
                const gLive = goals.find(x => x.id === pvGoalId);
                if (gLive) { window._pvRenderDayPanel(gLive, window.__getPvSelectedDate()); window._pvRenderMainCal(gLive); }
                if (typeof window.renderTasks === 'function') window.renderTasks();
                // Ghost toast — sadece karşı taraftan gelen olaylarda göster
                if (payload.user_name && window.PlanningCollab) {
                    const actionLabels = { add:'görev ekledi', pending:'görev önerdi', delete:'görevi sildi', toggle:'görevi tamamladı', approve:'görevi onayladı', reject:'görevi reddetti' };
                    _pvUpdateActivityFeed({
                        user_name: payload.user_name,
                        user_color: payload.user_color || '#888',
                        action: type,
                        action_label: actionLabels[type] || type,
                        target: payload.task?.text || payload.taskText || '',
                        created_at: new Date().toISOString(),
                    });
                }
            },
            onProgressChange: (payload) => {
                const pvGoalId = window.__getPvGoalId();
                const goals = window._pgGetGoals();
                const gLive = goals.find(x => x.id === pvGoalId);
                if (!gLive) return;
                gLive.progress_pct = payload.pct;
                gLive._dirty = true;
                window.persistGoals();
                _pvRenderHeader(gLive);
                _pvUpdateOverallProgress(gLive);
                window.render();
            },
            onPresenceChange: () => {
                window.PlanningCollab._renderPresence();
                const pvGoalId = window.__getPvGoalId();
                const goals = window._pgGetGoals();
                const gLive = goals.find(x => x.id === pvGoalId);
                if (gLive) {
                    window._pvRenderMainCal(gLive);
                    const pvSelectedDate = window.__getPvSelectedDate();
                    if (pvSelectedDate) window._pvRenderDayPanel(gLive, pvSelectedDate);
                }
            },
            onStartPlanning: () => {},
            onWizState: (payload) => {
                const pvGoalId = window.__getPvGoalId();
                if (payload.goalId !== pvGoalId) return;
                window.__setPvWiz(payload.wiz);
                const goals = window._pgGetGoals();
                const gLive = goals.find(x => x.id === pvGoalId);
                if (gLive) {
                    _pvRenderStepper(gLive);
                    window._pvRenderMainCal(gLive);
                }
            },
    };
}
