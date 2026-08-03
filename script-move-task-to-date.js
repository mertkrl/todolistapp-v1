// script-move-task-to-date.js
// script.js'ten çıkarıldı: takvimde sürükle-bırak taşıma fonksiyonu
// moveTaskToDate. getTasksRef/getCalendarEventsRef state store'larından,
// showPremiumModal script-premium-modal.js'ten import edilir.

import { getTasksRef } from './state/tasks-store.js';
import { getCalendarEventsRef } from './state/calendar-events-store.js';
import { showPremiumModal } from './script-premium-modal.js';

// --- TAKVİMDE SÜRÜKLE BIRAK TAŞIMA FONKSİYONU ---
window.moveTaskToDate = function(id, newDateStr) {
    const taskIndex = getTasksRef().findIndex(t => String(t.id) === String(id));
    if (taskIndex === -1) return;

    const task = getTasksRef()[taskIndex];
    const oldDateStr = task.date;

    if (oldDateStr === newDateStr) return; // Aynı güne bırakıldıysa hiçbir şey yapma

    // 1. Ana listede tarihi güncelle
    task.date = newDateStr;

    // 2. Takvim Events (Hafıza) objesinden eski günden sil
    if(getCalendarEventsRef()[oldDateStr]) {
        getCalendarEventsRef()[oldDateStr] = getCalendarEventsRef()[oldDateStr].filter(e => String(e.id) !== String(id));
        if(getCalendarEventsRef()[oldDateStr].length === 0) delete getCalendarEventsRef()[oldDateStr];
    }

    // 3. Takvim Events objesinde yeni güne ekle
    if(!getCalendarEventsRef()[newDateStr]) getCalendarEventsRef()[newDateStr] = [];
    const evCopy = { id: task.id, text: task.text, timeStart: task.timeStart, timeEnd: task.timeEnd, priority: task.priority, parentHabit: task.parentHabit };
    if(task.weekStr) evCopy.weekStr = task.weekStr; // Haftalık plan bağlantısını koru
    getCalendarEventsRef()[newDateStr].push(evCopy);

    // Kaydet ve Ekranı Yenile
    window.saveTasks();
    window.renderTasks();
    window.renderCalendar();
    window.renderEvents();

    showPremiumModal({ title: 'Plan Taşındı 🗓️', message: 'Görev başarıyla yeni tarihine taşındı.', type: 'success' });
};
