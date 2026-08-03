import { _recalcProgress, refreshDetailSummary, _initDetailProgress } from './planning-goal-detail-render.js';
import { renderMilestoneList } from './planning-milestone-list-render.js';
import { hideMsForm } from './planning-plan-view-dom-fx.js';
import { openPlanView } from './planning-open-plan-view.js';
// planning.js dosyasından çıkarıldı (Faz devamı — dev fonksiyon refactoru).
// goals/detailGoalId planning.js'in module-seviye state'i; window._pgGetGoals/
// window._pgGetDetailGoalId/window._pgSetDetailGoalId köprüleri zaten vardı.
// render/persistGoals → zaten window üzerinden köprülü (window.render,
// window.persistGoals). _renderDepPanel hiçbir yerde tanımlı değil (planning.js'te
// de öyleydi) — bu ÖNCEDEN VAR OLAN ölü/kırık referans, davranış korunarak
// olduğu gibi taşındı.

window.openDetailPanel = (goalId) => openDetailPanel(goalId); // Faz 6: planning-misc-widgets.js için
function openDetailPanel(goalId) {
    const goals = window._pgGetGoals();
    const g = goals.find(g => g.id === goalId); if (!g) return;
    window._pgSetDetailGoalId(goalId);
    refreshDetailSummary(g); renderMilestoneList(goalId); _initDetailProgress(g);
    document.getElementById('pg-detail-panel')?.classList.add('open');
    document.getElementById('pg-detail-overlay')?.classList.add('open');

    // 5.3 — Dependency panel doldur (_renderDepPanel hiçbir yerde tanımlı
    // değil, önceden var olan kırık referans — çağrı güvenli hale getirildi)
    if (typeof window._renderDepPanel === 'function') window._renderDepPanel(goalId);

    // Collab: kanala bağlan + bölümü render et
    if (window.PlanningCollab) {
        if (g.collab_room_id) {
            window.PlanningCollab.joinRoom(g.collab_room_id, g.id, g.my_role || 'owner');
        }
        window.PlanningCollab.renderCollabSection(g);
        window.PlanningCollab.setHandlers({
            onMilestoneChange: (type, payload) => {
                const gLive = goals.find(x => x.id === goalId);
                if (gLive) {
                    if (type === 'toggle' && payload.msId) {
                        const ms = (gLive.milestones || []).find(m => m.id === payload.msId);
                        if (ms) { ms.done = payload.done; _recalcProgress(gLive); gLive._dirty = true; window.persistGoals(); }
                    } else if (type === 'add' && payload.milestone) {
                        gLive.milestones = gLive.milestones || [];
                        if (!gLive.milestones.find(m => m.id === payload.milestone.id)) {
                            gLive.milestones.push(payload.milestone); gLive._dirty = true; window.persistGoals();
                        }
                    } else if (type === 'delete' && payload.msId) {
                        gLive.milestones = (gLive.milestones || []).filter(m => m.id !== payload.msId);
                        _recalcProgress(gLive); gLive._dirty = true; window.persistGoals();
                    } else if (type === 'batch_set' && payload.milestones) {
                        gLive.milestones = payload.milestones; _recalcProgress(gLive); gLive._dirty = true; window.persistGoals();
                    } else if (type === 'update' && payload.msId) {
                        const ms = (gLive.milestones || []).find(m => m.id === payload.msId);
                        if (ms) { Object.assign(ms, payload.fields); gLive._dirty = true; window.persistGoals(); }
                    }
                }
                renderMilestoneList(goalId);
                refreshDetailSummary(goals.find(x => x.id === goalId) || g);
                window.render();
            },
            onProgressChange: (payload) => {
                const idx = goals.findIndex(x=>x.id===goalId);
                if (idx!==-1) { goals[idx].progress_pct = payload.pct; window.persistGoals(); window.render(); window.refreshDetailPanel(); }
            },
            onStartPlanning: (payload) => {
                if (payload.goalId === goalId) {
                    closeDetailPanel();
                    setTimeout(() => openPlanView(payload.goalId), 150);
                }
            },
            onPresenceChange: () => {},
        });
    }
}

function closeDetailPanel() {
    window._pgSetDetailGoalId(null);
    document.getElementById('pg-detail-panel')?.classList.remove('open');
    document.getElementById('pg-detail-overlay')?.classList.remove('open');
    hideMsForm();
    if (window.PlanningCollab) window.PlanningCollab.leaveRoom();
}
window.closeDetailPanel = closeDetailPanel; // planning-init-setup.js için (Faz J devamı)

function refreshDetailPanel() {
    const detailGoalId = window._pgGetDetailGoalId();
    if (!detailGoalId) return;
    const g = window._pgGetGoals().find(g => g.id === detailGoalId); if (!g) return;
    refreshDetailSummary(g); _initDetailProgress(g);
}
window.refreshDetailPanel = refreshDetailPanel; // planning-goal-crud.js için (Faz devamı)

export { openDetailPanel, closeDetailPanel, refreshDetailPanel };
