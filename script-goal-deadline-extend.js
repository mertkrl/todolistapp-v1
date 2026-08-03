// ============================================================
// FOCUSAI SCRIPT-GOAL-DEADLINE-EXTEND.JS
// script.js'ten çıkarılmış: "SÜRESİ DOLAN HEDEFİ AKTİFE GERİ TAŞIMA (Süreyi Uzat)".
// Süresi dolmuş (expired) bir hedefin bitiş tarihini uzatıp tekrar aktif
// hâle getirme (extendGoalDeadline / saveExtendedDeadline) ve bir hedefi
// hızlıca tamamlanmış olarak işaretleme (quickCompleteGoal) akışlarını
// içerir. script.js'in window'a koyduğu ince sarmalayıcıları
// (__getGoalsRef, __getTasksRef, Store, showPremiumModal, renderGoals,
// toInputDate, formatDateToString, fireConfetti) kullanır.
// script.js'ten SONRA, orijinal DOMContentLoaded zamanlamasını korumak
// için kendi DOMContentLoaded sarmalayıcısında yüklenir.
// ============================================================
import { getGoalsRef, getTasksRef, showPremiumModal } from './script.js';
import { toInputDate, formatDateToString } from './script-date-time-utils.js';
import { renderGoals } from './script-goal-modal.js';

(function () {
'use strict';
document.addEventListener('DOMContentLoaded', () => {

    window.extendGoalDeadline = function(goalId) {
        const goals = getGoalsRef();
        const goal = goals.find(g => String(g.id) === String(goalId));
        if (!goal || goal.status !== 'expired') return;

        document.getElementById('extend-goal-id').value = goal.id;
        const deadlineEl = document.getElementById('extend-deadline-input');
        // Yeni tarih önerisi: bugünden 7 gün sonrası
        const suggested = new Date();
        suggested.setDate(suggested.getDate() + 7);
        if (deadlineEl._flatpickr) {
            deadlineEl._flatpickr.set('minDate', 'today');
            deadlineEl._flatpickr.setDate(suggested);
        } else {
            deadlineEl.value = toInputDate(formatDateToString(suggested));
        }
        document.getElementById('extend-deadline-modal').classList.remove('hidden');
    }

    window.saveExtendedDeadline = function() {
        const goals = getGoalsRef();
        const goalId = document.getElementById('extend-goal-id').value;
        const goal = goals.find(g => String(g.id) === String(goalId));
        if (!goal) return;

        const rawDeadline = document.getElementById('extend-deadline-input').value;
        if (!rawDeadline) {
            showPremiumModal({ title: 'Hata', message: 'Lütfen yeni bir bitiş tarihi seçin.', type: 'warning' });
            return;
        }

        // Flatpickr'dan gelen d-m-Y formatını YYYY-MM-DD formatına çevir
        let newDeadline = rawDeadline;
        if (rawDeadline.includes('-')) {
            const parts = rawDeadline.split('-');
            if (parts[0].length === 2) {
                newDeadline = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }

        const [ny, nm, nd] = newDeadline.split('-');
        const newDeadlineDate = new Date(ny, nm - 1, nd);
        newDeadlineDate.setHours(23, 59, 59, 999);
        if (newDeadlineDate < new Date()) {
            showPremiumModal({ title: 'Geçersiz Tarih', message: 'Yeni bitiş tarihi bugünden önce olamaz.', type: 'warning' });
            return;
        }

        goal.deadline = newDeadline;
        goal.status = 'active';
        delete goal.completedAt;
        window.Store.goals.set(goals);

        document.getElementById('extend-deadline-modal').classList.add('hidden');
        renderGoals();

        showPremiumModal({ title: 'Süre Uzatıldı! 🚀', message: `"${goal.title}" hedefi tekrar Aktif Hedefler'e taşındı. Yeni bitiş tarihi: ${newDeadlineDate.toLocaleDateString('tr-TR')}.`, type: 'success' });
    }

    window.quickCompleteGoal = function(goalId) {
        const goals = getGoalsRef();
        const tasks = getTasksRef();
        const goal = goals.find(g => String(g.id) === String(goalId));
        if (!goal) return;

        const pendingTasks = tasks.filter(t => t.parentGoal === goalId && !t.completed);

        // Hatalı cümle düzeltildi ve daha mantıklı hale getirildi
        const warningText = pendingTasks.length > 0
            ? `⚠️ Bu hedefe bağlı <strong class="u-color-hff9f43">${pendingTasks.length} aktif görev</strong> var. Yine de hedefi tamamlamak istiyor musunuz?`
            : 'Bu ana hedefi başarıyla tamamlandı (Başarı) olarak işaretlemek istiyor musunuz?';

            showPremiumModal({
                title: 'Hedefi Tamamla 🏆',
                message: warningText,
                type: pendingTasks.length > 0 ? 'warning' : 'info',
                showCancel: true,
                confirmText: 'Evet, Tamamla',
                onConfirm: () => {
                    goal.status = 'completed';
                    goal.completedAt = Date.now();
                    window.Store.goals.set(goals);

                    if (typeof window.fireConfetti === 'function') window.fireConfetti();
                    renderGoals();

                    if (window.FocusAISocial && typeof window.FocusAISocial.postActivity === 'function') {
                        window.FocusAISocial.postActivity(`"${goal.title}" hedefini başarıyla tamamladı 🏆`);
                    }

                    // Başarı mesajı
                    setTimeout(() => {
                        showPremiumModal({
                            title: 'Tebrikler! 🏆',
                            message: 'Hedef başarıyla tamamlandı ve otomatik olarak Başarılarım arşivine taşındı.',
                            type: 'success'
                        });
                    }, 400);
                }
            });
        };

});
})();
