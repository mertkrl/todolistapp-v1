// Hedef Ödülü (Kilitli Sistem) UI mantığı — script.js'in openGoalDetails
// fonksiyonundan çıkarıldı. goal ve dört DOM elemanı parametre olarak
// alınır (closure yerine); goals dizisi ve Store için window köprüleri
// (window.__getGoalsRef, window.Store) kullanılır.
export function setupGoalRewardUI(goal, rewardInput, saveRewardBtn, editRewardBtn, deleteRewardBtn) {
    function updateRewardUIState() {
        if (goal.reward && goal.reward.trim() !== '') {
            rewardInput.disabled = true;
            rewardInput.style.opacity = '0.6';
            saveRewardBtn.style.display = 'none';
            editRewardBtn.style.display = 'inline-flex';
            deleteRewardBtn.style.display = 'inline-flex';
        } else {
            rewardInput.value = '';
            rewardInput.disabled = false;
            rewardInput.style.opacity = '1';
            saveRewardBtn.style.display = 'inline-flex';
            editRewardBtn.style.display = 'none';
            deleteRewardBtn.style.display = 'none';
        }
    }

    updateRewardUIState();

    saveRewardBtn.onclick = () => {
        const val = rewardInput.value.trim();
        if (val) {
            goal.reward = val;
            window.Store.goals.set(window.__getGoalsRef());
            updateRewardUIState();
            window.renderGoals(); // Ana sayfadaki kartı da anlık günceller
            window.showPremiumModal({ title: 'Ödül Kilitlendi 🔒', message: 'Hedefe ulaştığında bu ödül senin olacak. Şimdi çalışmaya dön!', type: 'success' });
        }
    };

    editRewardBtn.onclick = () => {
        rewardInput.disabled = false;
        rewardInput.style.opacity = '1';
        rewardInput.focus();
        saveRewardBtn.style.display = 'inline-flex';
        editRewardBtn.style.display = 'none';
        deleteRewardBtn.style.display = 'none';
    };

    deleteRewardBtn.onclick = () => {
        window.showPremiumModal({
            title: 'Ödülü Kaldır 🗑️',
            message: 'Bu hedefe belirlediğin ödülü silmek istediğine emin misin?',
            type: 'warning',
            showCancel: true,
            confirmText: 'Evet, Sil',
            onConfirm: () => {
                goal.reward = '';
                window.Store.goals.set(window.__getGoalsRef());
                updateRewardUIState();
                window.renderGoals(); // Ana sayfadaki kartı da anlık günceller
            }
        });
    };
}
