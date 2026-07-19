// ============================================================
// FOCUSAI SCRIPT-TASK-END-QUESTION.JS
// script.js'ten çıkarılmış: "SÜRE SONU SORU VE KONFETİ İŞLEMLERİ".
// Odak süresi bitince kullanıcıya "görevi bitirdin mi?" sorusunu sorar;
// Evet denirse konfeti patlatır ve aktif görevi/alışkanlığı/günün
// hedefini otomatik tamamlar, Hayır denirse motive edici bir mesaj
// gösterir. Her iki durumda da bir sonraki mola moduna geçer.
// script.js'in window'a koyduğu ince sarmalayıcıları (__getActiveFocusTaskRef,
// __getTasksRef, __getHabitsRef, __nextBreakMode, fireConfetti,
// formatDateToString, toggleHighlightTask, toggleTask, toggleHabitFromToday,
// clearFocusMode, showPremiumModal) kullanır.
// script.js'ten SONRA, orijinal DOMContentLoaded zamanlamasını korumak
// için kendi DOMContentLoaded sarmalayıcısında yüklenir.
// ============================================================
(function () {
'use strict';
document.addEventListener('DOMContentLoaded', () => {

    const checkModal = document.getElementById('task-complete-check-modal');
    const taskYesBtn = document.getElementById('task-yes-btn');
    const taskNoBtn = document.getElementById('task-no-btn');

    if (taskYesBtn) {
        taskYesBtn.addEventListener('click', () => {
            checkModal.classList.add('hidden');
            if (typeof window.fireConfetti === 'function') window.fireConfetti(); // Konfetileri patlat
            // Görevi otomatik tamamla (Görev, Alışkanlık veya Ana Hedef)
            const activeFocusTask = window.__getActiveFocusTaskRef();
            if (activeFocusTask) {
                const todayStr = window.formatDateToString(new Date());
                if (activeFocusTask === 'highlight-task') {
                    window.toggleHighlightTask(todayStr); // Günün hedefini tamamla
                } else {
                    const tasks = window.__getTasksRef();
                    const t = tasks.find(x => String(x.id) === String(activeFocusTask));
                    if (t && !t.completed) {
                        window.toggleTask(activeFocusTask); // Normal görevi tamamla
                    } else {
                        const habits = window.__getHabitsRef();
                        const h = habits.find(x => String(x.id) === String(activeFocusTask));
                        if (h && !h.history[todayStr]) window.toggleHabitFromToday(activeFocusTask, todayStr); // Alışkanlığı tamamla
                    }
                }
                window.clearFocusMode(); // Seçiciyi sıfırla
            }
            document.querySelector(`.mode-btn[data-mode="${window.__nextBreakMode}"]`).click(); // Molaya geç
        });
    }

    if (taskNoBtn) {
        taskNoBtn.addEventListener('click', () => {
            checkModal.classList.add('hidden');
            window.showPremiumModal({ title: 'Pes Etmek Yok!', message: 'Ritmi bozma! Bir sonraki döngüde bu işi bitireceksin.', type: 'info' });
            document.querySelector(`.mode-btn[data-mode="${window.__nextBreakMode}"]`).click(); // Molaya geç
        });
    }

});
})();
