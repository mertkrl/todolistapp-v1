// script-data-sync-refresh.js
// script.js'ten çıkarıldı: Supabase'ten veri çekildikten sonra (giriş / sayfa
// açılışı) in-memory verileri ve arayüzü yenileyen _syncAllFromStorage +
// arkadaş silme temizliği sonrası habits dizisini senkronize eden
// _syncHabitsFromStorage. render*Ref değişkenlerine script.js'in
// window.__getRenderXRef() getter köprüleri üzerinden erişilir.

import { setHabitCategoriesRef, getHabitCategoriesRef } from '../state/habit-categories-store.js';
import { setMindDumpsRef } from '../state/mind-dumps-store.js';
import { setCalendarEventsRef } from '../state/calendar-events-store.js';
import { setTasksRef } from '../state/tasks-store.js';
import { setGoalsRef } from '../state/goals-store.js';
import { setHabitsRef } from '../state/habits-store.js';
import { setTotalFocusMinutes } from '../state/total-focus-minutes-store.js';

// social.js'in arkadaş silme temizliği yaptıktan sonra in-memory diziyi senkronize eder
window._syncHabitsFromStorage = function() {
    setHabitsRef(Store.habits.get());
    setTimeout(function() {
        if (typeof window.renderTodayTab === 'function') window.renderTodayTab();
        if (typeof window.renderHabits   === 'function') window.renderHabits();
    }, 0);
};

// Supabase'ten veri çekildikten sonra (giriş / sayfa açılışı) in-memory verileri ve arayüzü yeniler
window._syncAllFromStorage = function() {
    setTasksRef(Store.tasks.get());
    setCalendarEventsRef(Store.events.get());
    setHabitCategoriesRef(FocusStorage.get('habit_categories', getHabitCategoriesRef()));
    setGoalsRef(Store.goals.get());
    setHabitsRef(Store.habits.get());
    setMindDumpsRef(Store.mind_dumps.get());
    setTotalFocusMinutes(FocusStorage.get('focus_minutes', 0) || 0);

    // setTimeout(0): DOM const'ları (taskList, habitList vb.) tanımlanmadan önce
    // render fonksiyonları çağrılırsa TDZ hatası alınır; defer ile güvene al
    setTimeout(function() {
        if (typeof window.renderTodayTab    === 'function') window.renderTodayTab();
        if (typeof window.renderTasks       === 'function') window.renderTasks();
        if (typeof window.renderGoals       === 'function') window.renderGoals();
        if (typeof window.renderHabits      === 'function') window.renderHabits();
        if (typeof window.renderJournal     === 'function') window.renderJournal();
        if (typeof window.renderMindDumps   === 'function') window.renderMindDumps();
        const renderCalendarRef = window.__getRenderCalendarRef ? window.__getRenderCalendarRef() : null;
        if (typeof renderCalendarRef === 'function') renderCalendarRef();
        const renderEventsRef = window.__getRenderEventsRef ? window.__getRenderEventsRef() : null;
        if (typeof renderEventsRef === 'function') renderEventsRef();
        const renderHabitsRef = window.__getRenderHabitsRef ? window.__getRenderHabitsRef() : null;
        if (typeof renderHabitsRef === 'function') renderHabitsRef();
        const renderStatisticsRef = window.__getRenderStatisticsRef ? window.__getRenderStatisticsRef() : null;
        if (typeof renderStatisticsRef === 'function') renderStatisticsRef();
        const renderJournalRef = window.__getRenderJournalRef ? window.__getRenderJournalRef() : null;
        if (typeof renderJournalRef === 'function') renderJournalRef();
        const renderMindDumpsRef = window.__getRenderMindDumpsRef ? window.__getRenderMindDumpsRef() : null;
        if (typeof renderMindDumpsRef === 'function') renderMindDumpsRef();
        if (typeof window.renderTodayGoalCard === 'function') window.renderTodayGoalCard();
        if (typeof window.renderTodayTaskSplit === 'function') window.renderTodayTaskSplit();
    }, 0);
};
window.addEventListener('focusai:data-synced', window._syncAllFromStorage);
