// Faz F: script.js'ten ayrıldı — Görev tamamlama ile bağlı Alışkanlık/Ana Hedef
// arasındaki otomatik "sinerji" senkronizasyonu (tik atınca alışkanlığı da tikle, vs).
//
// NOT: window.checkGoalSynergy adı script.js'te BAŞKA bir amaçla (hedef ilerleme
// yüzdesi senkronu, tek argümanlı) tekrar atanıyor — isim çakışmasını önlemek için
// bu modüldeki hedef-sinerji fonksiyonu window.__checkGoalHabitSynergy adıyla bridge'lenir.
//
// Bağımlılıklar:
// - window.__getHabitsRef() / window.__getTasksRef() (salt-okunur referans, script.js)
// - window.saveHabits, window.showPremiumModal, window.escapeHtml, window.renderGoals
// - window.__getRenderHabitsRef() (renderHabitsRef closure değişkeni, script.js)

window.checkSynergy = function checkSynergy(parentHabitId, dateStr, isCompleted) {
    if (!parentHabitId) return;
    const habits = window.__getHabitsRef();
    const tasks = window.__getTasksRef();
    const habit = habits.find(h => String(h.id) === String(parentHabitId));
    if (habit) {
        const renderHabitsRef = window.__getRenderHabitsRef ? window.__getRenderHabitsRef() : null;
        // Görev tamamlandıysa ve alışkanlık henüz tiklenmemişse tikle
        if (isCompleted && !habit.history[dateStr]) {
            habit.history[dateStr] = true;
            window.saveHabits();
            if (typeof renderHabitsRef === 'function') renderHabitsRef();

            setTimeout(() => {
                window.showPremiumModal({
                    title: 'Sinerji Aktif! ⚡',
                    message: `Harika! Bağlantılı görevi tamamladığın için "${window.escapeHtml(habit.name)}" alışkanlığının bugünkü adımı da otomatik tamamlandı.`,
                    type: 'success'
                });
            }, 1420);
        }
        // Görevdeki tik kaldırıldıysa (Acaba başka bitmiş görev var mı diye bak)
        else if (!isCompleted) {
            const otherTasksDone = tasks.some(t => String(t.parentHabit) === String(parentHabitId) && t.date === dateStr && t.completed);
            if (!otherTasksDone) {
                delete habit.history[dateStr];
                window.saveHabits();
                if (typeof renderHabitsRef === 'function') renderHabitsRef();
            }
        }
    }
};

window.__checkGoalHabitSynergy = function __checkGoalHabitSynergy(parentGoalId, dateStr, isCompleted) {
    if (!parentGoalId) return;
    const habits = window.__getHabitsRef();
    const tasks = window.__getTasksRef();

    // Bu hedefe (parentGoal) bağlı olan tüm alışkanlıkları bul
    const linkedHabits = habits.filter(h => h.parentGoals && h.parentGoals.includes(parentGoalId));

    let habitUpdated = false;
    linkedHabits.forEach(habit => {
        if (isCompleted && !habit.history[dateStr]) {
            habit.history[dateStr] = true;
            habitUpdated = true;

            window.showPremiumModal({
                title: 'Hedef Sinerjisi! 🎯',
                message: `Ana hedefin için bir adım attın! Buna bağlı olan "${window.escapeHtml(habit.name)}" alışkanlığın da bugünlük otomatik tamamlandı.`,
                type: 'success'
            });
        } else if (!isCompleted) {
            // Eğer görevin tiki kaldırıldıysa ve o hedefe/alışkanlığa bağlı BAŞKA tamamlanmış görev yoksa tiki geri al
            const otherTasksDoneForGoal = tasks.some(t => t.parentGoal === parentGoalId && t.date === dateStr && t.completed);
            const otherTasksDoneForHabit = tasks.some(t => t.parentHabit === habit.id && t.date === dateStr && t.completed);

            if (!otherTasksDoneForGoal && !otherTasksDoneForHabit) {
                delete habit.history[dateStr];
                habitUpdated = true;
            }
        }
    });

    if (habitUpdated) {
        window.saveHabits();
        const renderHabitsRef = window.__getRenderHabitsRef ? window.__getRenderHabitsRef() : null;
        if (renderHabitsRef) renderHabitsRef();
        if (typeof window.renderGoals === 'function') window.renderGoals();
    }
};
