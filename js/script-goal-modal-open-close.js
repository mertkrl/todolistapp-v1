const MAX_ACTIVE_GOALS = 5;

export function openGoalModal() {
    // Zihin Çöplüğü'nden "Detaylı Hedef Formunu Aç" ile gelinmediyse (normal
    // "+ Yeni Hedef" akışı) bekleyen bir dönüşüm id'si kalmış olabilir (örn.
    // önceki bir dönüştürme iptal edildiyse) — burada temizleniyor ki yanlışlıkla
    // alakasız bir zihin çöplüğü fikri silinmesin. script-convert-modal.js bu
    // çağrıdan HEMEN SONRA kendi id'sini set ediyor (bkz. o dosya).
    window.__pendingDumpConversionId = null;

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
    // editGoalInfo() (script-goal-modal.js) bu başlığı/butonu "Hedefi
    // Düzenle"/"Kaydet" olarak değiştiriyor — yeni hedef akışında
    // varsayılana döndürülmeli (bkz. oradaki not, 2026-08-06).
    const modalTitleEl = document.getElementById('goal-modal-title');
    if (modalTitleEl) modalTitleEl.textContent = 'Yeni Hedef';
    const saveBtnEl = document.getElementById('save-goal-btn');
    if (saveBtnEl) saveBtnEl.innerHTML = '<i class="fa-solid fa-check"></i> Oluştur';
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
