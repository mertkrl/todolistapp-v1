// Faz devamı: planning.js'teki kalan window-köprülü collab/hedef fonksiyonları
// buraya taşındı (_updateGoalCollabState, _applyInviteJoin,
// PlanningUnmirrorTaskGlobal, renderTodaySprintWidget, setPlanningMilestoneDone,
// togglePlanningMilestoneFromCalendar, persistGoals, uid, _pvIsLessonPlan).
// goals/pvWiz/pvUnsaved/pvGoalId/detailGoalId'a window.__get/__set köprüleri
// üzerinden erişiyor (planning.js'teki desenle aynı). Bu dosya planning.js'ten
// ÖNCE yüklenir (bkz. inline-module-loader.js), bu yöndeki statik import GÜVENLİ.
import { openPlanView } from './planning-open-plan-view.js';
import { _recalcProgress, refreshDetailSummary, _initDetailProgress } from './planning-goal-detail-render.js';
import { renderMilestoneList } from './planning-milestone-list-render.js';
import { fmtShort } from './planning-utils.js';
import { _pvRenderStepper } from './planning-plan-header.js';
import { _pvRenderMainCal } from './planning-pv-main-cal.js';
import { _syncDirty } from './planning-goal-load-sync.js';

function persistGoals() {
    const goals = window._pgGetGoals();
    if (typeof FocusStorage !== 'undefined')
        FocusStorage.set('planning_goals', goals);
    else
        localStorage.setItem('planning_goals', JSON.stringify(goals));
    // Plan görünümü açıkken bir ders planının aşama/başlık verisi değiştiyse "kaydedilmemiş" işaretle
    const pvGoalId = window.__getPvGoalId();
    if (pvGoalId) {
        const openGoal = goals.find(x => x.id === pvGoalId);
        if (openGoal?.plan_mode === 'lesson-plan') window.__setPvUnsaved(true);
    }
    _syncDirty();
    // Takvimi senkronize et
    if (typeof window.syncAllMilestonesToCalendar === 'function')
        window.syncAllMilestonesToCalendar();
    // 5.4 — Bugün widget'ını güncelle
    if (typeof window.renderTodaySprintWidget === 'function')
        window.renderTodaySprintWidget();
}
window.persistGoals = persistGoals;

function uid()   { return 'pg_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }
window.uid = uid;

function _pvIsLessonPlan(g) { return g?.plan_mode === 'lesson-plan'; }
window._pvIsLessonPlan = _pvIsLessonPlan;

// ── Collab bridge fonksiyonları ───────────
// collab.js tarafından çağrılır
window._updateGoalCollabState = function(goalId, fields) {
    const goals = window._pgGetGoals();
    const g = goals.find(g=>g.id===goalId);
    if (!g) return;
    Object.assign(g, fields);
    g._dirty = true;
    persistGoals();
    window.render();
};

window._applyInviteJoin = async function(result) {
    // result: { roomId, goalId, role }
    const goals = window._pgGetGoals();
    let g = goals.find(x => x.id === result.goalId);

    if (!g && window.FocusSupabase) {
        // Goal local'de yok — sunucudan çek
        try {
            const { data: row } = await window.FocusSupabase
                .from('planning_goals')
                .select('*')
                .eq('id', result.goalId)
                .maybeSingle();
            if (row) {
                // Milestone'ları da çek
                const { data: ms } = await window.FocusSupabase
                    .from('planning_milestones')
                    .select('*')
                    .eq('goal_id', result.goalId)
                    .order('order_index');
                g = {
                    ...row,
                    milestones:    (ms || []),
                    collab_room_id: result.roomId,
                    my_role:        result.role,
                    _dirty:         false,
                };
                goals.unshift(g);
                persistGoals();
                window.render();
            }
        } catch(e) {
            console.warn('[_applyInviteJoin] fetch error:', e);
        }
    } else if (g) {
        g.collab_room_id = result.roomId;
        g.my_role        = result.role;
        g._dirty         = true;
        persistGoals();
        window.render();
    }

    // Realtime kanalına bağlan ve start_planning sinyalini bekle
    if (g && window.PlanningCollab) {
        try {
            await window.PlanningCollab.joinRoom(result.roomId, result.goalId, result.role);
        } catch (e) {
            console.warn('[FocusAI] PlanningCollab.joinRoom:', e);
            return;
        }
        window.PlanningCollab.setHandlers({
            onStartPlanning: (payload) => {
                if (payload.goalId === result.goalId) {
                    window.toast('Planlama başlatıldı! 🚀');
                    setTimeout(() => openPlanView(result.goalId), 300);
                }
            },
            onMilestoneChange: (type, payload) => {
                const gLive = window._pgGetGoals().find(x => x.id === result.goalId);
                if (!gLive) return;
                if (type === 'toggle' && payload.msId) {
                    const ms = (gLive.milestones || []).find(m => m.id === payload.msId);
                    if (ms) { ms.done = payload.done; _recalcProgress(gLive); gLive._dirty = true; persistGoals(); }
                } else if (type === 'add' && payload.milestone) {
                    gLive.milestones = gLive.milestones || [];
                    if (!gLive.milestones.find(m => m.id === payload.milestone.id)) {
                        gLive.milestones.push(payload.milestone); gLive._dirty = true; persistGoals();
                    }
                } else if (type === 'delete' && payload.msId) {
                    gLive.milestones = (gLive.milestones || []).filter(m => m.id !== payload.msId);
                    _recalcProgress(gLive); gLive._dirty = true; persistGoals();
                } else if (type === 'batch_set' && payload.milestones) {
                    gLive.milestones = payload.milestones; _recalcProgress(gLive); gLive._dirty = true; persistGoals();
                } else if (type === 'update' && payload.msId) {
                    const ms = (gLive.milestones || []).find(m => m.id === payload.msId);
                    if (ms) { Object.assign(ms, payload.fields); gLive._dirty = true; persistGoals(); }
                }
                window.render();
            },
            onTaskChange: (type, payload) => {
                let tasks = FocusStorage.get('tasks', []);
                let changed = false;
                if (type === 'add' && payload.task) {
                    if (!tasks.find(t => t.id === payload.task.id)) { tasks.push(payload.task); changed = true; }
                } else if (type === 'delete' && payload.taskId) {
                    const before = tasks.length;
                    tasks = tasks.filter(t => t.id !== payload.taskId);
                    changed = tasks.length !== before;
                } else if (type === 'toggle' && payload.taskId) {
                    const t = tasks.find(x => x.id === payload.taskId);
                    if (t) { t.completed = payload.completed; changed = true; }
                } else if (type === 'sync' && payload.tasks) {
                    payload.tasks.forEach(incoming => {
                        if (!tasks.find(t => t.id === incoming.id)) { tasks.push(incoming); changed = true; }
                    });
                }
                if (changed) {
                    FocusStorage.set('tasks', tasks);
                    if (typeof window.syncTasksFromStorage === 'function') window.syncTasksFromStorage();
                }
                if (typeof window.renderTasks === 'function') window.renderTasks();
            },
            onProgressChange: (payload) => {
                const gLive = window._pgGetGoals().find(x => x.id === result.goalId);
                if (!gLive) return;
                gLive.progress_pct = payload.pct; gLive._dirty = true; persistGoals(); window.render();
            },
            onPresenceChange: () => { window.PlanningCollab._renderPresence(); },
            onWizState: (payload) => {
                if (payload.goalId !== result.goalId) return;
                window.__setPvWiz(payload.wiz);
                const gLive = window._pgGetGoals().find(x => x.id === result.goalId);
                if (gLive) { _pvRenderStepper(gLive); _pvRenderMainCal(gLive); }
            },
        });
    }

    return g; // caller navigate edecek
};

// Genel takvim/gündelik görünümden (plan-view dışından) silinen bir görev, bir
// ders planının aynalanmış (mirrored) milestone'una karşılık geliyorsa, o milestone
// da temizlenmezse plan tekrar açıldığında/yeniden atandığında "hayalet görev" olarak
// geri gelebiliyordu. script.js:deleteGlobalTask bu fonksiyonu çağırarak senkronize eder.
window.PlanningUnmirrorTaskGlobal = function(taskId) {
    let changed = false;
    (window._pgGetGoals() || []).forEach(g => {
        if (!_pvIsLessonPlan(g)) return;
        const before = (g.milestones || []).length;
        g.milestones = (g.milestones || []).filter(m => m.task_mirror_id !== String(taskId) && m.task_mirror_id !== taskId);
        if (g.milestones.length !== before) { g._dirty = true; changed = true; }
    });
    if (changed) persistGoals();
};

// 5.4 — "Bugün" sekmesi sprint widget
window.renderTodaySprintWidget = function() {
    const widget   = document.getElementById('today-sprint-widget');
    const listEl   = document.getElementById('tsw-list');
    const progWrap = document.getElementById('tsw-progress-wrap');
    if (!widget || !listEl) return;

    if (!listEl._delegatedClickBound) {
        listEl._delegatedClickBound = true;
        listEl.addEventListener('click', (e) => {
            const el = e.target.closest('[data-action="toggle-sprint-milestone"]');
            if (!el) return;
            if (typeof window.setPlanningMilestoneDone === 'function') {
                window.setPlanningMilestoneDone(el.dataset.goalId, el.dataset.msId, el.dataset.done === 'true');
            }
            window.renderTodaySprintWidget();
        });
    }

    const { start, end } = (typeof _weekRange === 'function') ? _weekRange(0) : (() => {
        const now = new Date(), dow = now.getDay(), diff = dow===0?-6:1-dow;
        const mon = new Date(now); mon.setDate(now.getDate()+diff); mon.setHours(0,0,0,0);
        const sun = new Date(mon); sun.setDate(mon.getDate()+6); sun.setHours(23,59,59,999);
        return { start: mon, end: sun };
    })();

    // plan_mode==='lesson-plan' && !lpa_id: öğretmenin başka bir öğrenci için henüz
    // atamadığı ders planı taslağı — şablonlar gibi bu widget'ta görünmemeli.
    const items = [];
    window._pgGetGoals().filter(g => g.status !== 'archived' && !g.context?.isTemplate
        && !(g.plan_mode === 'lesson-plan' && !g.lpa_id)).forEach(g => {
        (g.milestones || []).forEach(ms => {
            if (!ms.due_date) return;
            const d = new Date(ms.due_date);
            if (d >= start && d <= end) items.push({ ms, goal: g });
        });
    });

    if (!items.length) { widget.style.display = 'none'; return; }
    widget.style.display = '';

    items.sort((a,b) => a.ms.due_date.localeCompare(b.ms.due_date));
    const done  = items.filter(x => x.ms.done).length;
    const pct   = Math.round(done / items.length * 100);

    if (progWrap) {
        progWrap.innerHTML = `
        <div class="tsw-prog-track"><div class="tsw-prog-fill"></div></div>
        <span class="tsw-prog-label">${done}/${items.length}</span>`;
        const fillEl = progWrap.querySelector('.tsw-prog-fill');
        if (fillEl) fillEl.style.width = pct + '%';
    }

    const _tswSlice = items.slice(0, 5);
    listEl.innerHTML = _tswSlice.map(({ ms, goal }) => {
        return `<div class="tsw-item${ms.done?' done':''}">
            <div class="tsw-check${ms.done?' done':''}"
                data-action="toggle-sprint-milestone" data-goal-id="${goal.id}" data-ms-id="${ms.id}" data-done="${!ms.done}">
                ${ms.done ? '✓' : ''}
            </div>
            <div class="tsw-body">
                <div class="tsw-ms-title${ms.done?' done':''}">${window.esc(ms.title)}</div>
                <div class="tsw-goal-name">${window.esc(goal.title)}</div>
            </div>
            <span class="tsw-date">${fmtShort(ms.due_date)}</span>
        </div>`;
    }).join('');

    _tswSlice.forEach(({ ms, goal }) => {
        const cat = goal.category || 'diger';
        const catColors = { egitim:'#7c6eff', saglik:'#ef476f', kariyer:'#06d6a0',
            finans:'#ffd166', kisisel:'#ff9f43', diger:'#a78bfa' };
        const color = catColors[cat] || '#a78bfa';
        const itemEl = listEl.querySelector(`[data-ms-id="${CSS.escape(String(ms.id))}"]`);
        if (!itemEl) return;
        if (ms.done) { itemEl.style.background = color; itemEl.style.borderColor = color; }
        else { itemEl.style.borderColor = color; }
        const nameEl = itemEl.parentElement?.querySelector('.tsw-goal-name');
        if (nameEl) nameEl.style.color = color;
    });

    if (items.length > 5) {
        listEl.innerHTML += `<div class="u-text-align-center_font-size-11px_color-h555_padding-6px">+${items.length-5} milestone daha...</div>`;
    }
};

// F1.1 — Görev tamamlama → milestone durumu güncelle (script.js çağırır)
window.setPlanningMilestoneDone = function(goalId, msId, done) {
    const goals = window._pgGetGoals();
    const g  = goals.find(g => g.id === goalId);
    const ms = (g?.milestones || []).find(m => m.id === msId);
    if (!g || !ms || ms.done === done) return;
    ms.done = done;
    _recalcProgress(g);
    g._dirty = true;
    persistGoals();
    window.render();
    if (typeof window.renderPlanningStats === 'function') window.renderPlanningStats();
    if (window._pgGetDetailGoalId() === goalId) {
        renderMilestoneList(goalId);
        refreshDetailSummary(g);
        _initDetailProgress(g);
    }
    if (done) window.toast('Milestone tamamlandı! 🎉');
};

// F1.2 — Takvim milestone event'i tıklanınca planning modülünü güncelle
window.togglePlanningMilestoneFromCalendar = function(calEvId) {
    const msId = calEvId.replace('ms_cal_', '');
    let foundGoal = null, foundMs = null;
    for (const g of window._pgGetGoals()) {
        const ms = (g.milestones || []).find(m => m.id === msId);
        if (ms) { foundGoal = g; foundMs = ms; break; }
    }
    if (!foundGoal || !foundMs) return;
    foundMs.done = !foundMs.done;
    _recalcProgress(foundGoal);
    foundGoal._dirty = true;
    persistGoals(); // persistGoals → syncAllMilestonesToCalendar zinciri takvimi günceller
    window.render();
    if (window._pgGetDetailGoalId() === foundGoal.id) {
        renderMilestoneList(foundGoal.id);
        refreshDetailSummary(foundGoal);
        _initDetailProgress(foundGoal);
    }
    if (foundMs.done) window.toast('Milestone tamamlandı! 🎉');
};

export { persistGoals, uid, _pvIsLessonPlan };
