export function loadDailyHighlight() {
    const highlightSetupState = document.getElementById('highlight-setup-state');
    const highlightActiveState = document.getElementById('highlight-active-state');
    const highlightCompletedState = document.getElementById('highlight-completed-state');
    const highlightInput = document.getElementById('highlight-input');
    const highlightParentSelect = document.getElementById('highlight-parent-goal');
    const highlightDisplayText = document.getElementById('highlight-display-text');

    const todayStr = window.formatDateToString(new Date());
    let highlightHistory = window.FocusStorage.get('highlight_history', {});
    let todayHighlight = highlightHistory[todayStr];
    const goalCard = document.getElementById('td-goal-wrap');

    // NOT: .hidden class'ı global olarak `display: none !important` (bkz.
    // sohbet-3sutun-mimari.css) — bu yüzden görünürlük her zaman classList
    // ile de değiştirilmeli, sadece style.display yetmiyor (JS'in inline
    // style'ı !important karşısında kaybediyordu, "Belirle"ye basınca hedef
    // metni hiç görünmüyordu — kullanıcı bulgusu, 2026-08-06).
    if (!todayHighlight) {
        if(highlightSetupState) { highlightSetupState.style.display = 'flex'; highlightSetupState.classList.remove('hidden'); }
        if(highlightActiveState) { highlightActiveState.style.display = 'none'; highlightActiveState.classList.add('hidden'); }
        if(highlightCompletedState) { highlightCompletedState.style.display = 'none'; highlightCompletedState.classList.add('hidden'); }
        if(highlightInput) highlightInput.value = '';
        if(highlightParentSelect) highlightParentSelect.value = '';
        if(goalCard) goalCard.classList.remove('is-goal-complete');
    } else {
        if(highlightDisplayText) highlightDisplayText.textContent = todayHighlight.text;

        const completedDisplay = document.getElementById('highlight-completed-display');
        if(completedDisplay) completedDisplay.textContent = todayHighlight.text;

        if (todayHighlight.completed) {
            if(highlightSetupState) { highlightSetupState.style.display = 'none'; highlightSetupState.classList.add('hidden'); }
            if(highlightActiveState) { highlightActiveState.style.display = 'none'; highlightActiveState.classList.add('hidden'); }
            if(highlightCompletedState) { highlightCompletedState.style.display = 'flex'; highlightCompletedState.classList.remove('hidden'); }
            if(goalCard) goalCard.classList.add('is-goal-complete');
        } else {
            if(highlightSetupState) { highlightSetupState.style.display = 'none'; highlightSetupState.classList.add('hidden'); }
            if(highlightActiveState) { highlightActiveState.style.display = 'flex'; highlightActiveState.classList.remove('hidden'); }
            if(highlightCompletedState) { highlightCompletedState.style.display = 'none'; highlightCompletedState.classList.add('hidden'); }
            if(goalCard) goalCard.classList.remove('is-goal-complete');
        }
    }
    window.updateGlobalStreak();
}

export function toggleHighlightTask(dateStr = null) {
    const targetDate = dateStr || window.formatDateToString(new Date());
    let highlightHistory = window.FocusStorage.get('highlight_history', {});

    if(highlightHistory[targetDate]) {
        const willComplete = !highlightHistory[targetDate].completed;
        highlightHistory[targetDate].completed = willComplete;
        window.FocusStorage.set('highlight_history', highlightHistory); if(window.FocusSync) window.FocusSync.pushKey('highlight_history', highlightHistory);

        // Yeni Ana Hedef Sinerjisi
        window.__checkGoalHabitSynergy(highlightHistory[targetDate].parentGoal, targetDate, willComplete);

        if (targetDate === window.formatDateToString(new Date())) {
            loadDailyHighlight();
        }

        window.renderTasks();
        const renderCalendarRef = window.__getRenderCalendarRef();
        const renderEventsRef = window.__getRenderEventsRef();
        const renderStatisticsRef = window.__getRenderStatisticsRef();
        const renderSocialStatsRef = window.__getRenderSocialStatsRef();
        if(renderCalendarRef) renderCalendarRef();
        if(renderEventsRef) renderEventsRef();
        if(renderStatisticsRef && document.getElementById('istatistikler').classList.contains('active')) renderStatisticsRef();
        if(renderSocialStatsRef && document.getElementById('arkadaslar').classList.contains('active')) renderSocialStatsRef();
        // Hedef detay modali açıksa aksiyon planını güncelle
        const _hlParentGoal = highlightHistory[targetDate] && highlightHistory[targetDate].parentGoal;
        if (_hlParentGoal && typeof window.updateGoalDetailsUI === 'function') {
            const _hlModal = document.getElementById('goal-details-modal');
            const _hlModalId = document.getElementById('detail-active-goal-id');
            if (_hlModal && !_hlModal.classList.contains('hidden') && _hlModalId && String(_hlModalId.value) === String(_hlParentGoal)) {
                window.updateGoalDetailsUI(_hlParentGoal);
            }
        }

        if(willComplete && targetDate === window.formatDateToString(new Date())) {
            window.showPremiumModal({ title: 'Mükemmel İş!', message: 'Bugünün en önemli hedefini tamamladın. Geri kalan her şey artık daha kolay.', type: 'success' });
        }

        if (willComplete && window.FocusAISocial && typeof window.FocusAISocial.postActivity === 'function') {
            window.FocusAISocial.postActivity(`"${highlightHistory[targetDate].text}" günün öne çıkanını tamamladı 🌟`);
        }
    }
}

export function initDailyHighlightWidget() {
    const highlightInput = document.getElementById('highlight-input');
    const highlightParentSelect = document.getElementById('highlight-parent-goal');
    const saveHighlightBtn = document.getElementById('save-highlight-btn');
    const completeHighlightBtn = document.getElementById('complete-highlight-btn');
    const editHighlightBtn = document.getElementById('edit-highlight-btn');
    const deleteHighlightBtn = document.getElementById('delete-highlight-btn');

    const powerupBtn = document.getElementById('powerup-highlight-btn');
    const contractModal = document.getElementById('contract-modal');
    const cancelContractBtn = document.getElementById('cancel-contract-btn');
    const saveContractBtn = document.getElementById('save-contract-btn');
    const contractIfInput = document.getElementById('contract-if');
    const contractThenInput = document.getElementById('contract-then');

    if(powerupBtn) {
        powerupBtn.addEventListener('click', () => {
            if(contractModal) {
                contractModal.classList.remove('hidden');
                if(contractIfInput) contractIfInput.value = '';
                if(contractThenInput) contractThenInput.value = '';
                if(contractIfInput) contractIfInput.focus();
            }
        });
    }

    if(cancelContractBtn) {
        cancelContractBtn.addEventListener('click', () => {
            if(contractModal) contractModal.classList.add('hidden');
        });
    }

    if(saveContractBtn) {
        saveContractBtn.addEventListener('click', () => {
            const ifText = contractIfInput ? contractIfInput.value.trim() : '';
            const thenText = contractThenInput ? contractThenInput.value.trim() : '';

            if(ifText === "" || thenText === "") {
                window.showPremiumModal({ title: 'Eksik Alan', message: 'Lütfen hem "Eğer" hem de "O Zaman" kısımlarını doldurun.', type: 'warning' });
                return;
            }

            const todayStr = window.formatDateToString(new Date());
            let highlightHistory = window.FocusStorage.get('highlight_history', {});

            if(highlightHistory[todayStr]) {
                highlightHistory[todayStr].contract = { ifText: ifText, thenText: thenText };
                window.FocusStorage.set('highlight_history', highlightHistory); if(window.FocusSync) window.FocusSync.pushKey('highlight_history', highlightHistory);

                if(contractModal) contractModal.classList.add('hidden');
                loadDailyHighlight();

                window.showPremiumModal({
                    title: 'Sözleşme İmzalandı ⚡',
                    message: 'Kişisel sözleşmeni başarıyla oluşturdun. Artık ertelemek için hiçbir bahanen yok!',
                    type: 'success'
                });
            }
        });
    }

    if(saveHighlightBtn) {
        saveHighlightBtn.addEventListener('click', () => {
            const text = highlightInput.value.trim();
            const parentGoal = highlightParentSelect ? highlightParentSelect.value : "";
            if (text === "") return;

            const todayStr = window.formatDateToString(new Date());
            let highlightHistory = window.FocusStorage.get('highlight_history', {});

            highlightHistory[todayStr] = { text: text, completed: false, parentGoal: parentGoal };
            window.FocusStorage.set('highlight_history', highlightHistory); if(window.FocusSync) window.FocusSync.pushKey('highlight_history', highlightHistory);

            loadDailyHighlight();
            // Hedef belirlendi — vurgu parlaması
            const goalText = document.getElementById('highlight-display-text');
            if (goalText) {
                goalText.classList.remove('glowing');
                requestAnimationFrame(() => requestAnimationFrame(() => goalText.classList.add('glowing')));
                setTimeout(() => goalText.classList.remove('glowing'), 1050);
            }
            window.renderTasks();
            const renderCalendarRef = window.__getRenderCalendarRef();
            const renderEventsRef = window.__getRenderEventsRef();
            const renderStatisticsRef = window.__getRenderStatisticsRef();
            const renderSocialStatsRef = window.__getRenderSocialStatsRef();
            if(renderCalendarRef) renderCalendarRef();
            if(renderEventsRef) renderEventsRef();
            if(renderStatisticsRef && document.getElementById('istatistikler').classList.contains('active')) renderStatisticsRef();
            if(renderSocialStatsRef && document.getElementById('arkadaslar').classList.contains('active')) renderSocialStatsRef();
            // Hedef detay modali açıksa ve kaydedilen günün hedefi bu hedefe bağlıysa aksiyon planını güncelle
            if (parentGoal && typeof window.updateGoalDetailsUI === 'function') {
                const _gModal = document.getElementById('goal-details-modal');
                const _gModalId = document.getElementById('detail-active-goal-id');
                if (_gModal && !_gModal.classList.contains('hidden') && _gModalId && String(_gModalId.value) === String(parentGoal)) {
                    window.updateGoalDetailsUI(parentGoal);
                }
            }

            window.showPremiumModal({ title: 'Hedef Kilitlendi', message: 'Günün en önemli görevine odaklan. Başarılar!', type: 'success' });
        });
    }

    if(completeHighlightBtn) {
        completeHighlightBtn.addEventListener('click', () => {
            window.toggleHighlightTask();
        });
    }

    const undoHighlightBtn = document.getElementById('undo-highlight-btn');
    if(undoHighlightBtn) {
        undoHighlightBtn.addEventListener('click', () => {
            window.toggleHighlightTask();
        });
    }

    if(editHighlightBtn) {
        editHighlightBtn.addEventListener('click', () => {
            const todayStr = window.formatDateToString(new Date());
            let highlightHistory = window.FocusStorage.get('highlight_history', {});
            let todayHighlight = highlightHistory[todayStr];

            if(todayHighlight && !todayHighlight.completed) {
                const textToEdit = todayHighlight.text;
                const parentToEdit = todayHighlight.parentGoal || "";

                delete highlightHistory[todayStr];
                window.FocusStorage.set('highlight_history', highlightHistory); if(window.FocusSync) window.FocusSync.pushKey('highlight_history', highlightHistory);

                loadDailyHighlight();
                window.renderTasks();
                const renderCalendarRef = window.__getRenderCalendarRef();
                const renderEventsRef = window.__getRenderEventsRef();
                const renderStatisticsRef = window.__getRenderStatisticsRef();
                const renderSocialStatsRef = window.__getRenderSocialStatsRef();
                if(renderCalendarRef) renderCalendarRef();
                if(renderEventsRef) renderEventsRef();
                if(renderStatisticsRef && document.getElementById('istatistikler').classList.contains('active')) renderStatisticsRef();
                if(renderSocialStatsRef && document.getElementById('arkadaslar').classList.contains('active')) renderSocialStatsRef();

                if(highlightInput) {
                    highlightInput.value = textToEdit;
                    if(highlightParentSelect) highlightParentSelect.value = parentToEdit;
                    highlightInput.focus();
                }
            }
        });
    }

    if(deleteHighlightBtn) {
        deleteHighlightBtn.addEventListener('click', () => {
            window.showPremiumModal({
                title: 'Hedefi Sil',
                message: 'Bugünün ana hedefini silmek istediğinize emin misiniz?',
                type: 'warning',
                showCancel: true,
                confirmText: 'Sil',
                onConfirm: () => {
                    const todayStr = window.formatDateToString(new Date());
                    let highlightHistory = window.FocusStorage.get('highlight_history', {});
                    delete highlightHistory[todayStr];
                    window.FocusStorage.set('highlight_history', highlightHistory); if(window.FocusSync) window.FocusSync.pushKey('highlight_history', highlightHistory);

                    loadDailyHighlight();
                    window.renderTasks();
                    const renderCalendarRef = window.__getRenderCalendarRef();
                    const renderEventsRef = window.__getRenderEventsRef();
                    const renderStatisticsRef = window.__getRenderStatisticsRef();
                    const renderSocialStatsRef = window.__getRenderSocialStatsRef();
                    if(renderCalendarRef) renderCalendarRef();
                    if(renderEventsRef) renderEventsRef();
                    if(renderStatisticsRef && document.getElementById('istatistikler').classList.contains('active')) renderStatisticsRef();
                    if(renderSocialStatsRef && document.getElementById('arkadaslar').classList.contains('active')) renderSocialStatsRef();
                }
            });
        });
    }

    loadDailyHighlight();
}

window.loadDailyHighlight = loadDailyHighlight;
window.toggleHighlightTask = toggleHighlightTask;
