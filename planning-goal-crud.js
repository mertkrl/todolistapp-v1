// addGoal/updateGoal/deleteGoal/toggleArchive/updateGoalProgress/handleGoalSubmit
// → planning.js'ten taşındı (Faz devamı). planning.js'ten ÖNCE yüklenir (bkz.
// inline-module-loader.js), bu yüzden window.* köprüleri tanımlanmadan önce
// çağrılabilir — sadece bu fonksiyonların kendisi çağrıldığında (init sonrası)
// bu köprüler zaten hazır olur.
// ÖNEMLİ: script-goal-modal.js zaten farklı bir "goal" kavramı için
// window.deleteGoal kullanıyor — isim çakışmasını önlemek için planlama
// hedefinin silme fonksiyonu window._pgDeleteGoal olarak köprülenir (bkz.
// planning.js'teki çağrı yerleri).
import { getCat } from './planning-utils.js';
import { _purgeGoalTasks } from './planning-goal-sync-cleanup.js';
import { getCurrentUser } from './state/current-user-store.js';

export function addGoal(data) {
    const cat = getCat(data.category);
    window._pgGetGoals().unshift({
        id: window.uid(), title: data.title.trim(),
        description: (data.description||'').trim(),
        category: data.category||'diger', color: cat.color,
        deadline: data.deadline||'', priority: parseInt(data.priority)||2,
        status: 'active', progress_pct: 0, milestones: [],
        created_at: new Date().toISOString(), _dirty: true,
    });
    window.persistGoals(); window.render(); window.toast('Hedef eklendi! 🎯');
}
window.addGoal = addGoal;

export function updateGoal(id, data) {
    const goals = window._pgGetGoals();
    const idx = goals.findIndex(g=>g.id===id);
    if (idx===-1) return;
    const cat = getCat(data.category);
    goals[idx] = { ...goals[idx], ...data, color: cat.color, _dirty: true };
    window.persistGoals(); window.render(); window.toast('Hedef güncellendi ✓');
}
window.updateGoal = updateGoal;

export function deleteGoal(id) {
    const goals = window._pgGetGoals();
    // Kart çıkış animasyonu
    const card = document.querySelector(`.pg-card[data-id="${id}"]`);
    const doDelete = () => {
        const deletedGoal = goals.find(g=>g.id===id);
        const msIds = (deletedGoal?.milestones||[]).map(m=>m.id);
        window._pgSetGoals(goals.filter(g=>g.id!==id));
        window.persistGoals(); window.render();
        _purgeGoalTasks(id, msIds);
        if (typeof window.syncAllMilestonesToCalendar === 'function')
            window.syncAllMilestonesToCalendar();
        if (typeof window.renderCalendarGlobal === 'function')
            window.renderCalendarGlobal();
        if (window._pgGetDetailGoalId()===id) window.closeDetailPanel();
        if (window.__getPvGoalId()===id) window.closePlanView();
        if (typeof window.renderTodaySprintWidget === 'function')
            window.renderTodaySprintWidget();
        if (window.FocusSupabase && getCurrentUser())
            window.FocusSupabase.from('planning_goals').delete().eq('id',id).then(()=>{});
    };
    if (card) {
        card.classList.add('pg-card-exiting');
        setTimeout(doDelete, 220);
    } else {
        doDelete();
    }
}
window._pgDeleteGoal = deleteGoal;

export function toggleArchive(id) {
    const g = window._pgGetGoals().find(g=>g.id===id);
    if (!g) return;
    if (g.status==='archived') {
        // Aktife al — tamamlanmışsa "tamamlandı" durumunu korur, arşivleme onu silmez
        g.status = g.progress_pct===100 ? 'completed' : 'active';
    } else {
        g.status = 'archived';
    }
    g._dirty = true;
    window.persistGoals(); window.render();
    window.toast(g.status==='archived' ? 'Arşivlendi' : 'Aktife alındı');
}
window.toggleArchive = toggleArchive;

export function updateGoalProgress(id, pct) {
    const g = window._pgGetGoals().find(g=>g.id===id);
    if (!g) return;
    g.progress_pct = Math.max(0, Math.min(100, pct));
    if (g.progress_pct===100) g.status='completed';
    else if (g.status==='completed') g.status='active';
    g._dirty = true;
    window.persistGoals(); window.render(); window.refreshDetailPanel();
}
window.updateGoalProgress = updateGoalProgress;

export function openGoalModal(editId) {
    window.__setEditingId(editId||null);
    const modal=document.getElementById('pg-goal-modal'); if (!modal) return;
    if (editId) {
        const g=window._pgGetGoals().find(g=>g.id===editId); if (!g) return;
        document.getElementById('pg-goal-title').value=g.title;
        document.getElementById('pg-goal-desc').value=g.description||'';
        document.getElementById('pg-goal-category').value=g.category;
        document.getElementById('pg-goal-priority').value=g.priority||2;
        document.getElementById('pg-goal-deadline').value=g.deadline||'';
        document.getElementById('pg-modal-title').textContent='Hedefi Düzenle';
    } else {
        document.getElementById('pg-goal-form').reset();
        document.getElementById('pg-modal-title').textContent='Yeni Hedef';
    }
    modal.classList.remove('hidden');
    setTimeout(()=>document.getElementById('pg-goal-title')?.focus(), 120);
}
// planning-milestone-wizard.js'in modal DOM'u bulamazsa (#pg-wizard-modal
// yoksa) düştüğü basit fallback için köprü.
window.openGoalModal = openGoalModal;

export function closeGoalModal() {
    document.getElementById('pg-goal-modal')?.classList.add('hidden');
    window.__setEditingId(null);
}
window.closeGoalModal = closeGoalModal;

export function handleGoalSubmit(e) {
    e.preventDefault();
    const title=document.getElementById('pg-goal-title').value.trim();
    if (!title) { document.getElementById('pg-goal-title').focus(); return; }
    const data={
        title,
        description: document.getElementById('pg-goal-desc').value,
        category:    document.getElementById('pg-goal-category').value,
        priority:    document.getElementById('pg-goal-priority').value,
        deadline:    document.getElementById('pg-goal-deadline').value,
    };
    if (window.__getEditingId()) updateGoal(window.__getEditingId(), data); else addGoal(data);
    window.closeGoalModal();
}
window.handleGoalSubmit = handleGoalSubmit;
