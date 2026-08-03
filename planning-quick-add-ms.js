import { msUid } from './planning-utils.js';
import { _recalcProgress } from './planning-goal-detail-render.js';

// PlanView içi "hızlı aşama ekle" formu (_pvBindQuickAddMs/_pvSaveQuickMs)
// → planning.js'ten taşındı. planning.js'ten ÖNCE yüklenir (bkz.
// inline-module-loader.js), bu yüzden window.* köprüleri tanımlanmadan önce
// çağrılabilir — sadece bu fonksiyonların kendisi çağrıldığında (init sonrası)
// bu köprüler zaten hazır olur.
export function _pvBindQuickAddMs() {
    const addBtn   = document.getElementById('pg-pv-add-ms-btn');
    const form     = document.getElementById('pg-pv-quick-add-ms');
    const cancelBtn= document.getElementById('pg-pv-ms-cancel');
    const saveBtn  = document.getElementById('pg-pv-ms-save');
    const inp      = document.getElementById('pg-pv-ms-inp');

    addBtn?.addEventListener('click', () => {
        form.classList.toggle('is-hidden', !form.classList.contains('is-hidden'));
        const g = window._pgGetGoals().find(x => x.id === window.__getPvGoalId());
        document.getElementById('pg-pv-ms-time-row')?.classList.toggle('hidden', !window._pvIsLessonPlan(g));
        if (!form.classList.contains('is-hidden')) inp?.focus();
    });
    cancelBtn?.addEventListener('click', () => { form.classList.add('is-hidden'); if(inp)inp.value=''; });
    saveBtn?.addEventListener('click',  _pvSaveQuickMs);
    inp?.addEventListener('keydown', e => { if (e.key === 'Enter') _pvSaveQuickMs(); });
}
window._pvBindQuickAddMs = _pvBindQuickAddMs;

export function _pvSaveQuickMs() {
    const g   = window._pgGetGoals().find(x => x.id === window.__getPvGoalId());
    if (!g) return;
    const inp  = document.getElementById('pg-pv-ms-inp');
    const dateInp = document.getElementById('pg-pv-ms-date');
    const startTimeInp = document.getElementById('pg-pv-ms-start-time');
    const endTimeInp   = document.getElementById('pg-pv-ms-end-time');
    const title = inp?.value.trim();
    if (!title) { inp?.focus(); return; }
    if (window._pvIsLessonPlan(g) && !dateInp?.value) { dateInp?.focus(); window.toast('Ders hangi güne planlanacak?'); return; }
    if (!g.milestones) g.milestones = [];
    const newMs = { id: msUid(), title, description: '', due_date: dateInp?.value || '',
        done: false, order: g.milestones.length, subtasks: [], created_at: new Date().toISOString() };
    if (window._pvIsLessonPlan(g)) {
        newMs.start_time = startTimeInp?.value || '';
        newMs.end_time   = endTimeInp?.value || '';
    }
    g.milestones.push(newMs);
    _recalcProgress(g); g._dirty = true;
    window.persistGoals(); window.render();
    if (inp) inp.value = '';
    if (startTimeInp) startTimeInp.value = '';
    if (endTimeInp) endTimeInp.value = '';
    if (dateInp) dateInp.value = '';
    document.getElementById('pg-pv-quick-add-ms').classList.add('is-hidden');
    window.__setPvActiveMsId(newMs.id);
    window._pvRender(g);
    window.toast('Aşama eklendi 🚩');
    if (window.PlanningCollab?.channel) {
        window.PlanningCollab.broadcast('ms_add', { goalId: g.id, milestone: newMs });
    }
}
window._pvSaveQuickMs = _pvSaveQuickMs;
