// ─── ALIŞKANLIK DÜZENLEME MODALI ────────────────────────────────────────
// script.js dosyasından çıkarıldı (Faz 2, 2026-07-20). Alışkanlık adını ve
// bağlı hedeflerini düzenleme modalı (openEditHabitModal/kaydet/kapat).
//
// NOT: Bu, ilk tahmin edilen "Alışkanlık düzenleme/ödüller" kümesinin sadece
// temiz/bağımsız kısmıdır. Hemen ardından gelen "Hedef Detay Odası (Komuta
// Merkezi)" — updateGoalDetailsUI, ödül UI state'i (updateRewardUIState onun
// İÇİNDE nested), openGoalDetails, checkGoalSynergy, promptDeleteGoal — aslında
// haftalık/günlük takvim ızgarası event delegation'ıyla (weekly-grid-inner/
// daily-timeline-grid) ve çekirdek görev/hedef state'iyle o kadar iç içe ki
// bu, ayrı ve çok daha büyük/riskli "Takvim" kümesinin (#10) bir parçası —
// BİLİNÇLİ OLARAK çıkarılmadı.
//
// Dış bağımlılıklar (script.js'te kalıyor, Faz G'de gerçek import'a çevrildi):
// - habits → getHabitsRef() (salt-okunur, sadece .find + obje
//   mutasyonu, reassignment yok)
// - saveHabits, populateParentHabitSelects, renderHabits → script.js'ten import
// - renderGoals → script-goal-modal.js'ten import
// - showPremiumModal → script.js'ten import
//
// editHabitModal/closeEditHabitBtn/cancelEditHabitBtn/saveEditHabitBtn DOM
// referansları köprü yerine burada TEKRAR sorgulanıyor (basit
// document.getElementById — çapraz dosya bağımlılığından daha basit).

import { getHabitsRef, saveHabits, renderHabits, populateParentHabitSelects, showPremiumModal } from './script.js';
import { renderGoals } from './script-goal-modal.js';

const editHabitModal = document.getElementById('edit-habit-modal');
const closeEditHabitBtn = document.getElementById('close-edit-habit-btn');
const cancelEditHabitBtn = document.getElementById('cancel-edit-habit-btn');
const saveEditHabitBtn = document.getElementById('save-edit-habit-btn');

window.openEditHabitModal = function(id) {
    const habit = getHabitsRef().find(h => String(h.id) === String(id));
    if(!habit) return;

    document.getElementById('edit-habit-id').value = habit.id;
    document.getElementById('edit-habit-name').value = habit.name;

    window.tempEditHabitGoals = habit.parentGoals || [];
    populateParentHabitSelects(); // Seçimleri UI'a yansıt

    editHabitModal.classList.remove('hidden');
}

function closeEditHabitModalFunc() {
    if(editHabitModal) editHabitModal.classList.add('hidden');
}

if(closeEditHabitBtn) closeEditHabitBtn.addEventListener('click', closeEditHabitModalFunc);
if(cancelEditHabitBtn) cancelEditHabitBtn.addEventListener('click', closeEditHabitModalFunc);

if(saveEditHabitBtn) {
    saveEditHabitBtn.addEventListener('click', () => {
        const id = document.getElementById('edit-habit-id').value;
        const newName = document.getElementById('edit-habit-name').value.trim();
        const pillsContainer = document.getElementById('edit-habit-goal-pills');
        const selectedGoals = pillsContainer ? Array.from(pillsContainer.querySelectorAll('.goal-pill.selected')).map(p => p.dataset.val) : [];

        const habit = getHabitsRef().find(h => String(h.id) === String(id));
        if(habit && newName) {
            habit.name = newName;
            habit.parentGoals = selectedGoals;

            saveHabits();
            renderHabits();
            renderGoals(); // Bağlı hedefleri hemen tekrar hesapla
            closeEditHabitModalFunc();

            showPremiumModal({ title: 'Güncellendi', message: 'Alışkanlık başarıyla yeniden yapılandırıldı!', type: 'success' });
        }
    });
}
