// ============================================================
// FOCUSAI SCRIPT-GOAL-DELETE-PROMPT.JS
// script.js'ten çıkarılmış: promptDeleteGoal — bir hedef silinmeye
// çalışıldığında bağlı görev/alışkanlık varsa gösterilen "hepsini sil /
// sadece hedefi sil" onay modalı. tasks/goals/habits/calendarEvents artık
// gerçek store'larda yaşadığı için (state/*.js) gerçek import ile erişiyor;
// renderCalendarRef/renderEventsRef script.js'in modül-içi callback
// referansları olduğundan (gerçek store yok) script.js'in zaten kurduğu
// window.__getRenderCalendarRef/__getRenderEventsRef köprüleri üzerinden
// okunuyor (bkz. script-task-render-mutate.js, script-habit-sync.js aynı
// deseni kullanıyor). script.js'ten SONRA yüklenir.
// ============================================================
import { getGoalsRef } from '../state/goals-store.js';
import { getTasksRef, setTasksRef } from '../state/tasks-store.js';
import { getHabitsRef, setHabitsRef } from '../state/habits-store.js';
import { getCalendarEventsRef } from '../state/calendar-events-store.js';
import { saveHabits } from './script-habit-category-modal.js';

export function promptDeleteGoal(goalId) {
    const goal = getGoalsRef().find(g => String(g.id) === String(goalId));
    if(!goal) return;

    const modal = document.getElementById('goal-delete-modal');

    // Güvenlik Önlemi: Eğer HTML'de özel modal yoksa, çökme! Standart silme ekranını aç.
    if (!modal) {
        window.deleteGoal(goalId);
        return;
    }

    const linkedTasks = getTasksRef().filter(t => String(t.parentGoal) === String(goalId) && !t.isMilestone);
    const linkedHabits = getHabitsRef().filter(h => h.parentGoals && h.parentGoals.includes(String(goalId)));

    if(linkedTasks.length === 0 && linkedHabits.length === 0) {
        window.deleteGoal(goalId);
        return;
    }

    document.getElementById('orphan-task-count').textContent = linkedTasks.length;
    document.getElementById('orphan-habit-count').textContent = linkedHabits.length;
    modal.classList.remove('hidden');

    document.getElementById('btn-del-goal-all').onclick = () => {
        // 1. Takvimdeki bağlantılı etkinlikleri de bul ve tamamen sil
        for(let date in getCalendarEventsRef()) {
            getCalendarEventsRef()[date] = getCalendarEventsRef()[date].filter(e => String(e.parentGoal) !== String(goalId));
            if(getCalendarEventsRef()[date].length === 0) delete getCalendarEventsRef()[date];
        }

        // 2. Ana görevlerden ve alışkanlıklardan tamamen sil
        setTasksRef(getTasksRef().filter(t => String(t.parentGoal) !== String(goalId)));
        setHabitsRef(getHabitsRef().filter(h => !(h.parentGoals && h.parentGoals.includes(String(goalId)))));

        window.saveTasks(); saveHabits();

        // 3. Değişikliklerin anında yansıması için ekranları yenile
        window.renderTasks();
        if (typeof window.__getRenderEventsRef === 'function' && typeof window.__getRenderEventsRef() === 'function') window.__getRenderEventsRef()();
        if (typeof window.__getRenderCalendarRef === 'function' && typeof window.__getRenderCalendarRef() === 'function') window.__getRenderCalendarRef()();

        window.deleteGoal(goalId);
        modal.classList.add('hidden');
    };

    document.getElementById('btn-del-goal-only').onclick = () => {
        // 1. Takvimdeki etkinliklerin sadece ana hedef bağını kopar (kendilerini silme)
        for(let date in getCalendarEventsRef()) {
            getCalendarEventsRef()[date].forEach(e => {
                if(String(e.parentGoal) === String(goalId)) e.parentGoal = '';
            });
        }

        // 2. Ana görev ve alışkanlıkların bağını kopar
        getTasksRef().forEach(t => { if(String(t.parentGoal) === String(goalId)) t.parentGoal = ''; });
        getHabitsRef().forEach(h => {
            if(h.parentGoals) h.parentGoals = h.parentGoals.filter(gid => String(gid) !== String(goalId));
        });

        window.saveTasks(); saveHabits();

        // 3. Değişikliklerin anında yansıması için ekranları yenile
        window.renderTasks();
        if (typeof window.__getRenderEventsRef === 'function' && typeof window.__getRenderEventsRef() === 'function') window.__getRenderEventsRef()();
        if (typeof window.__getRenderCalendarRef === 'function' && typeof window.__getRenderCalendarRef() === 'function') window.__getRenderCalendarRef()();

        window.deleteGoal(goalId);
        modal.classList.add('hidden');
    };

    document.getElementById('btn-del-goal-cancel').onclick = () => modal.classList.add('hidden');
}

window.promptDeleteGoal = promptDeleteGoal;
