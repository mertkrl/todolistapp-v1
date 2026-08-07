// script-calendar-week-day-view-move-task.js
// script-calendar-week-day-view.js'ten çıkarıldı: sürükle-bırak ile görevi
// yeni tarih+saate taşıyan fonksiyon — sadece window.* köprülerine bağımlı,
// haftalık/günlük görünümün paylaşılan closure state'ine (_iqaEl, _calDragId
// vb.) dokunmuyor.
//
// NOT (dokunulmadı, sadece taşındı): bu fonksiyon içindeki `currentCalView`
// bare referansı script-calendar-week-day-view.js'te de tanımsızdı (window.*
// köprüsü yok, script-calendar-view-switch.js'in kullandığı
// window.__getCurrentCalView() deseninden farklı) — muhtemel ReferenceError,
// ayrı raporlandı.
export function premiumMoveTask(id, oldDate, newDate, newHour, snapMins) {
    const task = window.__getTasksRef().find(t => String(t.id) === String(id));
    if (!task) return;
    const oldDateStr = oldDate || task.date;
    snapMins = snapMins || 0;

    // Aynı konuma bırakıldıysa işlem yapma
    const oldStartM = window.timeToMins(task.timeStart || '12:00');
    if (oldDateStr === newDate && Math.floor(oldStartM / 60) === newHour && (oldStartM % 60) === snapMins) return;

    const newStartTotal = newHour * 60 + snapMins;
    const newStart = `${String(newHour).padStart(2,'0')}:${String(snapMins).padStart(2,'0')}`;
    const oldEndM = window.timeToMins(task.timeEnd || '13:00');
    const durMins = Math.max(30, oldEndM - oldStartM);
    const newEndTotal = Math.min(23 * 60 + 59, newStartTotal + durMins);
    const newEnd = `${String(Math.floor(newEndTotal / 60)).padStart(2,'0')}:${String(newEndTotal % 60).padStart(2,'0')}`;

    task.date = newDate;
    task.timeStart = newStart;
    task.timeEnd = newEnd;

    if (window.__getCalendarEventsRef()[oldDateStr]) {
        window.__getCalendarEventsRef()[oldDateStr] = window.__getCalendarEventsRef()[oldDateStr].filter(e => String(e.id) !== String(id));
        if (!window.__getCalendarEventsRef()[oldDateStr].length) delete window.__getCalendarEventsRef()[oldDateStr];
    }
    if (!window.__getCalendarEventsRef()[newDate]) window.__getCalendarEventsRef()[newDate] = [];
    window.__getCalendarEventsRef()[newDate] = window.__getCalendarEventsRef()[newDate].filter(e => String(e.id) !== String(id));
    window.__getCalendarEventsRef()[newDate].push({ id: task.id, text: task.text, timeStart: newStart, timeEnd: newEnd, priority: task.priority, parentHabit: task.parentHabit || '' });

    saveTasks();
    window.renderCalendar();
    const currentCalView = window.__getCurrentCalView();
    if (currentCalView === 'weekly') window.renderWeeklyView();
    else if (currentCalView === 'daily') window.renderDailyView();

    showPremiumModal({ title: 'Plan Taşındı 🗓️', message: `"${escapeHtml(task.text)}" → ${newDate} ${newStart} – ${newEnd}`, type: 'success' });
}

window.premiumMoveTask = premiumMoveTask;
