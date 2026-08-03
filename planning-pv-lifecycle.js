import { _pvRenderHeader } from './planning-plan-header.js';
import { loadGoals, loadGoalsFromServer } from './planning-goal-load-sync.js';
import { loadDependencies } from './planning-dependency-graph.js';
import { openPlanView } from './planning-open-plan-view.js';
import { _subscribeRealtime, _checkDeadlineNotifications } from './planning-realtime.js';
import {
    _pgSetupFilterControls, _pgSetupGoalCreationModals,
    _pgSetupDetailAndMilestonePanel, _pgSetupEscAndFinalBindings
} from './planning-init-setup.js';
import { _pvHasUnresolvedConflicts, _pvShowUnresolvedConflictModal } from './planning-lesson-plan-conflicts.js';
import { _pvBindQuickAddMs } from './planning-quick-add-ms.js';

function _pvExplicitSave(g) {
    const goals = window._pgGetGoals();
    const live = goals.find(x => x.id === g.id);
    if (live) live._dirty = true;
    window.persistGoals();
    window.__setPvUnsaved(false);
    _pvRenderHeader(live || g);
    window.toast('Plan kaydedildi ✓', '#06d6a0');
}
window._pvExplicitSave = _pvExplicitSave; // planning-plan-header.js için

function closePlanView() {
    document.getElementById('pg-plan-view')?.classList.add('hidden');
    document.body.style.overflow = '';
    window.__setPvGoalId(null);
    window.__setPvActiveMsId(null);
    localStorage.removeItem('pg_pv_last_goal');
    // Collab kanalını kapat
    if (window.PlanningCollab?.isActive()) {
        window.PlanningCollab.leaveRoom();
    }
    // Salt okunur önizleme kapanıyorsa geçici sahte hedefi VE onun için yazılan
    // geçici görevleri (bkz. _toggleLessonPlanPreview) temizle — kalıcı değiller.
    if (window.__getPvReadOnly()) {
        const tempId = window.__getPvReadOnlyTempId();
        if (tempId) {
            window._pgSetGoals(window._pgGetGoals().filter(x => x.id !== tempId));
            const remainingTasks = FocusStorage.get('tasks', []).filter(t => t.parentGoal !== tempId);
            FocusStorage.set('tasks', remainingTasks);
            if (typeof window.syncTasksFromStorage === 'function') window.syncTasksFromStorage();
            if (typeof window.renderCalendarGlobal === 'function') window.renderCalendarGlobal();
        }
        window.__setPvReadOnly(false);
        window.__setPvReadOnlyTempId(null);
        window.__setPvReadOnlyShowOwnTasks(false);
    }
}
window.closePlanView = closePlanView;

function _pvInitBindings() {
    // Not: DOM click event'ini _pvHandleExitClick'e olduğu gibi vermemek lazım —
    // Event nesnesi her zaman "truthy" olduğundan bypassConflictCheck parametresine
    // sızıp çakışma kontrolünü atlatırdı, bkz. aşağıdaki sarmalayıcı ok fonksiyonları.
    document.getElementById('pg-pv-back')?.addEventListener('click', () => window._pvHandleExitClick());
    document.getElementById('pg-pv-close')?.addEventListener('click', () => window._pvHandleExitClick());
    document.getElementById('pg-pv-edit-goal')?.addEventListener('click', () => {
        const pvGoalId = window.__getPvGoalId();
        if (!pvGoalId) return;
        const g = window._pgGetGoals().find(x => x.id === pvGoalId);
        // closePlanView() pvGoalId'i null'a çeker — modal başlığının "Hedefi Düzenle"
        // yerine yanlışlıkla "Yeni Hedef" olarak açılmaması için id'yi önce yakala.
        const doEdit = () => { const gid = pvGoalId; closePlanView(); window.openGoalModal(gid); };
        if (_pvHasUnresolvedConflicts(g)) {
            _pvShowUnresolvedConflictModal({ onLeave: doEdit });
            return;
        }
        doEdit();
    });
    document.getElementById('pg-pv-seq-check')?.addEventListener('change', e => {
        window.__setPvSeqMode(e.target.checked);
        const g = window._pgGetGoals().find(x => x.id === window.__getPvGoalId());
        if (g) window._pvRenderStepper(g);
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && window.__getPvGoalId()) window._pvHandleExitClick();
    });
    _pvBindQuickAddMs();
}
window._pvInitBindings = _pvInitBindings; // planning-init-setup.js için (Faz J devamı)

function init() {
    loadGoals();
    loadDependencies();
    // Hard reset sonrası PlanView'i geri aç
    const lastGoalId = localStorage.getItem('pg_pv_last_goal');
    if (lastGoalId && window._pgGetGoals().find(g => g.id === lastGoalId)) {
        setTimeout(() => openPlanView(lastGoalId), 300);
    }
    // 4.1 — Server'dan güncel veriyi çek (arka planda)
    setTimeout(loadGoalsFromServer, 600);
    // 4.2 — Realtime subscription
    setTimeout(_subscribeRealtime, 1200);
    // 4.3 — Bildirim izni + deadline taraması
    setTimeout(window._requestNotificationPermission, 3000);
    setTimeout(_checkDeadlineNotifications, 4000);
    setInterval(_checkDeadlineNotifications, 3600000); // Saatte bir kontrol

    _pgSetupFilterControls();
    _pgSetupGoalCreationModals();
    _pgSetupDetailAndMilestonePanel();
    _pgSetupEscAndFinalBindings();
}
window.initPlanningModule = init;

export { _pvExplicitSave, closePlanView, _pvInitBindings, init };
