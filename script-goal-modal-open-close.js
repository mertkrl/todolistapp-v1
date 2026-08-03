const MAX_ACTIVE_GOALS = 5;

export function openGoalModal() {
    const goals = window.__getGoalsRef();
    const goalModal = document.getElementById('goal-modal');
    const activeGoalCount = goals.filter(g => g.status !== 'completed' && g.status !== 'expired').length;
    if (activeGoalCount >= MAX_ACTIVE_GOALS) {
        window.showPremiumModal({
            title: 'Odağını Koru 🎯',
            message: `Aynı anda en fazla ${MAX_ACTIVE_GOALS} aktif ana hedef belirleyebilirsin. Çok sayıda hedef aynı anda motivasyonu dağıtır ve hiçbirini tam anlamıyla bitiremezsin. Yeni bir vizyon eklemeden önce mevcut hedeflerinden birini tamamla ya da arşivle.`,
            type: 'warning'
        });
        return;
    }
    goalModal.classList.remove('hidden');
    if(document.getElementById('edit-goal-id')) document.getElementById('edit-goal-id').value = '';
    document.getElementById('goal-title-input').value = '';
    document.getElementById('goal-desc-input').value = '';
    const _deadlineEl = document.getElementById('goal-deadline-input');
   if (_deadlineEl._flatpickr) { _deadlineEl._flatpickr.setDate(new Date()); }
   else { _deadlineEl.value = window.toInputDate(window.formatDateToString(new Date())); }
}
export function closeGoalModal() {
    document.getElementById('goal-modal').classList.add('hidden');
}
