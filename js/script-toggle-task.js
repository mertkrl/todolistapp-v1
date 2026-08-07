import { getTasksRef } from '../state/tasks-store.js';
import { getHabitsRef } from '../state/habits-store.js';
import { getGoalsRef } from '../state/goals-store.js';
import { getActiveFocusTaskRef } from '../state/active-focus-task-store.js';
import { saveHabits } from './script-habit-category-modal.js';
import { showPremiumModal } from './script-premium-modal.js';

export function toggleTask(id) {
    const task = getTasksRef().find(t => String(t.id) === String(id));
    if(task) {
        const willComplete = !task.completed;
        const habitsSnapBeforeToggle = willComplete ? JSON.parse(JSON.stringify(getHabitsRef())) : null;
        task.completed = willComplete;

        if (willComplete) {
            const _snapTaskId = task.id;
            const _snapTaskText = task.text;
            const _snapHabits = habitsSnapBeforeToggle;
            setTimeout(() => window.showUndoToast(`"${_snapTaskText}" tamamlandı ✓`, () => {
                const t = getTasksRef().find(x => String(x.id) === String(_snapTaskId));
                if (t) t.completed = false;
                if (_snapHabits) getHabitsRef().splice(0, getHabitsRef().length, ..._snapHabits);
                saveHabits(); window.saveTasks(); window.renderTasks(); window.renderGoals();
                if (typeof window.__getRenderHabitsRef === 'function' && typeof window.__getRenderHabitsRef() === 'function') window.__getRenderHabitsRef()();
                if (typeof window.__getRenderEventsRef === 'function' && typeof window.__getRenderEventsRef() === 'function') window.__getRenderEventsRef()();
            }), 0);

            const _burstEl = document.querySelector(`[onclick*="toggleTask('${id}')"]`);
            if (_burstEl) { const _r = _burstEl.getBoundingClientRect(); window.microBurst(_r.left + _r.width / 2, _r.top + _r.height / 2); }

            if (window.FocusAISocial && typeof window.FocusAISocial.postActivity === 'function') {
                window.FocusAISocial.postActivity(`"${task.text}" görevini tamamladı ✅`);
            }
        }

        // 1. KLASİK SİNERJİ: Görev doğrudan bir alışkanlığın alt göreviyse
        // (willComplete=false için de çağrılmalı, yoksa görev geri alındığında
        // bağlı alışkanlığın tiki hiç kalkmıyordu — kalıcı desync.)
        if (task.parentHabit) {
            window.checkSynergy(task.parentHabit, task.date, willComplete);
        }

        // 2. YENİ HEDEF SİNERJİSİ: Görev bir Ana Hedef'e bağlıysa
        if (task.parentGoal) {
            let habitUpdated = false;

            getHabitsRef().forEach(habit => {
                // Eğer bu alışkanlığın hedefleri arasında, görevin bağlı olduğu hedef varsa:
                if (habit.parentGoals && habit.parentGoals.includes(String(task.parentGoal))) {

                    if (willComplete && !habit.history[task.date]) {
                        // Görev tamamlandıysa alışkanlığı da tamamla
                        habit.history[task.date] = true;
                        habitUpdated = true;
                    }
                    else if (!willComplete) {
                        // Görev iptal edildiyse, bu hedefe/alışkanlığa bağlı BUGÜN bitmiş BAŞKA görev var mı kontrol et
                        const otherTasksDone = getTasksRef().some(t =>
                            t.id !== task.id &&
                            t.date === task.date &&
                            t.completed &&
                            ((t.parentGoal && habit.parentGoals.includes(String(t.parentGoal))) || t.parentHabit === habit.id)
                        );

                        // Başka bitmiş görev yoksa alışkanlığın tikini geri al
                        if (!otherTasksDone) {
                            delete habit.history[task.date];
                            habitUpdated = true;
                        }
                    }
                }
            });

            // Eğer bir alışkanlık otomatik tamamlandıysa kaydet ve bildirim göster
            if (habitUpdated) {
                saveHabits();
                if (willComplete) {
                    showPremiumModal({
                        title: 'Zincirleme Reaksiyon! ⚡',
                        message: `"${window.escapeHtml(task.text)}" görevini başardığın için aynı hedefe hizmet eden alışkanlığın da otomatik tamamlandı!`,
                        type: 'success'
                    });
                }
            }
        }
        // Eski "tek tek ileri atma" mantığı kaldırıldı, artık Akıllı Rutin Dağıtıcısı (addSmartTask) kullanılıyor.

        if (getActiveFocusTaskRef() === String(id) && task.completed) window.clearFocusMode();
        window.saveTasks();

        // YENİ: Hedef ilerlemesini anlık güncelle
        if(task.parentGoal) window.checkGoalSynergy(task.parentGoal);

        // MİLESTONE SENKRON: Görev tamamlanma durumu milestone ile senkron çalışır
        if (task.parentMilestone && task.parentGoal) {
            const parentGoal = getGoalsRef().find(g => String(g.id) === String(task.parentGoal));
            if (parentGoal && parentGoal.milestones) {
                const ms = parentGoal.milestones.find(m => String(m.id) === String(task.parentMilestone));
                if (ms) {
                    const msLinkedTasks = getTasksRef().filter(t => String(t.parentMilestone) === String(ms.id) && String(t.parentGoal) === String(task.parentGoal));
                    const allDone = msLinkedTasks.length > 0 && msLinkedTasks.every(t => t.completed);
                    if (allDone && !ms.completed) {
                        // Tüm görevler tamamlandı → milestone'u tamamla
                        ms.completed = true;
                        window.Store.getGoalsRef().set(getGoalsRef()); if(window.FocusSync) window.FocusSync.pushKey('getGoalsRef()', getGoalsRef());
                        showPremiumModal({
                            title: 'Dönüm Noktası Aşıldı! 🏁',
                            message: `"${window.escapeHtml(ms.text)}" dönüm noktasına ulaştın! Tüm bağlı görevleri tamamladın.`,
                            type: 'success'
                        });
                        if (window.FocusAISocial && typeof window.FocusAISocial.postActivity === 'function') {
                            window.FocusAISocial.postActivity(`"${ms.text}" dönüm noktasına ulaştı 🏁`);
                        }
                    } else if (!allDone && ms.completed) {
                        // En az bir görev tamamlanmadı → milestone'u geri al
                        ms.completed = false;
                        window.Store.getGoalsRef().set(getGoalsRef()); if(window.FocusSync) window.FocusSync.pushKey('getGoalsRef()', getGoalsRef());
                    }
                }
            }
        }

        // F1.1 — Planlama modülü (planning.js) milestone sync
        if (task.parentMilestone && String(task.parentMilestone).startsWith('ms_') &&
            task.parentGoal     && String(task.parentGoal).startsWith('pg_') &&
            typeof window.setPlanningMilestoneDone === 'function') {
            window.setPlanningMilestoneDone(task.parentGoal, task.parentMilestone, willComplete);
        }

        window.renderTasks(); // Arayüzü anında günceller (Alışkanlık tiki burada anında görünür)
        window.renderGoals();
        window.updateGlobalStreak();
        // Hedef detay modali açıksa milestone listesini de güncelle
        const _toggleModal = document.getElementById('goal-details-modal');
        const _toggleGoalId = document.getElementById('detail-active-goal-id');
        if (_toggleModal && !_toggleModal.classList.contains('hidden') && _toggleGoalId && _toggleGoalId.value && typeof window.updateGoalDetailsUI === 'function') {
            window.updateGoalDetailsUI(_toggleGoalId.value);
        }
        if (typeof window.__getRenderEventsRef === 'function' && typeof window.__getRenderEventsRef() === 'function') window.__getRenderEventsRef()();
        if (typeof window.__getRenderStatisticsRef === 'function' && typeof window.__getRenderStatisticsRef() === 'function' && document.getElementById('istatistikler').classList.contains('active')) window.__getRenderStatisticsRef()();
        if (typeof window.__getRenderSocialStatsRef === 'function' && typeof window.__getRenderSocialStatsRef() === 'function' && document.getElementById('arkadaslar').classList.contains('active')) window.__getRenderSocialStatsRef()();
        if (typeof window.renderHabits === 'function') {
            window.renderHabits();
        }
    }
}

window.toggleTask = toggleTask;
