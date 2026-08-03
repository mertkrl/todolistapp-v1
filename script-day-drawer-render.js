// ============================================================
// FOCUSAI SCRIPT-DAY-DRAWER-RENDER.JS
// script.js'ten çıkarılmış: Gün Detay Drawer'ının (cal-day-drawer) saf
// veri/HTML üretim yardımcıları — DOM'a sadece _cddUpdateProgressRing
// yazar, geri kalanı saf fonksiyon. window.renderDayDrawer bu fonksiyonları
// window.__cddComputeDayData vb. üzerinden çağırır (script.js önce yüklenir,
// bu dosya sonra; window köprüsü aynı script-day-summary-card.js desenini
// izler).
// script.js'in window'a koyduğu ince sarmalayıcıları (__getTasksRef,
// __getCalendarEventsRef, __getGoalsRef, getHabitsForDate, escapeHtml,
// FocusStorage) kullanır.
// ============================================================
import { getTasksRef, getCalendarEventsRef, getGoalsRef, getHabitsForDate } from './script.js';
import { timeToMins, formatDateToString } from './script-date-time-utils.js';
import { FocusStorage, escapeHtml } from './storage-manager.js';

(function () {
'use strict';

function _cddComputeDayData(dateStr) {
    const calendarEvents = getCalendarEventsRef();
    const dayEvents = (calendarEvents[dateStr] || [])
        .filter(e => !e.isLessonPlanDraft)
        .slice()
        .sort((a, b) => (a.timeStart || '').localeCompare(b.timeStart || ''));
    const dayHabits = getHabitsForDate(dateStr);
    const highlightHistory = FocusStorage.get('highlight_history', {});
    const highlight = highlightHistory[dateStr] || null;
    const total = dayEvents.length + dayHabits.length + (highlight ? 1 : 0);
    return { dayEvents, dayHabits, highlight, total };
}

function _cddUpdateProgressRing(dateStr, isFuture, dayEvents, dayHabits, highlight, total) {
    const tasks = getTasksRef();
    const ring       = document.getElementById('cdd-ring');
    const ringCircle = document.getElementById('cdd-ring-circle');
    const ringText   = document.getElementById('cdd-ring-text');
    if (ring && total > 0 && !isFuture) {
        const done =
            dayEvents.filter(ev => { const t = tasks.find(t => String(t.id) === String(ev.id)); return t && t.completed; }).length +
            dayHabits.filter(h => !!h.history[dateStr]).length +
            (highlight && highlight.completed ? 1 : 0);
        const pct = Math.round((done / total) * 100);
        ring.classList.add('visible');
        if (ringCircle) {
            ringCircle.style.strokeDashoffset = 100.5 - (pct / 100) * 100.5;
            ringCircle.style.stroke = pct === 100 ? '#2ed573' : '#ff9f43';
        }
        if (ringText) ringText.textContent = pct + '%';
    } else if (ring) {
        ring.classList.remove('visible');
    }
}

function _cddHighlightHtml(highlight) {
    if (!highlight) return '';
    return `<div class="cdd-section-label">✦ Odak Hedefi</div>
        <div class="cdd-highlight ${highlight.completed ? 'completed' : ''}">
            <i class="fa-solid fa-star"></i>
            <span class="u-flex-1_overflow-hidden_text-overflow-ellipsis_white-space--2">${highlight.text}</span>
            ${highlight.completed ? '<i class="fa-solid fa-check u-color-h2ed573_font-size-11px_flex-shrink-0" ></i>' : ''}
        </div>`;
}

function _cddTasksSectionHtml(dayEvents, isPast, dateStr) {
    if (!dayEvents.length) return '';
    const tasks = getTasksRef();
    const evDone  = dayEvents.filter(ev => { const t = tasks.find(t => String(t.id) === String(ev.id)); return t && t.completed; }).length;
    const evTotal = dayEvents.length;
    const evPct   = Math.round((evDone / evTotal) * 100);
    const usedMin = dayEvents.reduce((s, ev) => s + Math.max(0, timeToMins(ev.timeEnd || '10:00') - timeToMins(ev.timeStart || '09:00')), 0);
    const usedH   = Math.floor(usedMin / 60);
    const usedM   = usedMin % 60;
    const usedStr = usedH > 0 ? `${usedH}s ${usedM > 0 ? usedM + 'dk' : ''}`.trim() : `${usedM}dk`;
    const burnoutPct = Math.min(100, Math.round((usedMin / 480) * 100));
    const burnoutColor = burnoutPct >= 100 ? '#ff4757' : burnoutPct >= 75 ? '#ff9f43' : '#2ed573';

    let html = `
    <div class="cdd-tasks-header">
        <div class="cdd-tasks-top">
            <span class="cdd-tasks-label">Görevler</span>
            <div class="cdd-tasks-badges">
                <span class="cdd-badge-done">${evDone}/${evTotal} tamamlandı</span>
                <span class="cdd-badge-time" data-burnout-color="${burnoutColor}">
                    <i class="fa-regular fa-clock"></i> ${usedStr}
                    ${burnoutPct >= 100 ? '<i class="fa-solid fa-fire-flame-curved u-color-hff4757_margin-left-2px" title="Burnout riski!"></i>' : ''}
                </span>
            </div>
        </div>
        <div class="cdd-task-prog-track">
            <div class="cdd-task-prog-fill" data-w="${evPct}" data-bg="${evPct===100?'#2ed573':'#D4900E'}"></div>
        </div>
    </div>`;

    const pColors = { high: '#ff4757', medium: '#D4900E', low: '#00b894' };
    dayEvents.forEach(ev => {
        const t     = tasks.find(t => String(t.id) === String(ev.id));
        const done  = t && t.completed;
        const pColor = pColors[ev.priority || 'medium'];
        html += `
        <div class="cdd-event ${done ? 'completed' : ''}"
             data-p-color="${pColor}"
             ${isPast ? '' : 'draggable="true"'}
             data-ev-id="${ev.id}">
            ${isPast ? '' : `<div class="cdd-drag-handle" title="Sürükle"><i class="fa-solid fa-grip-vertical"></i></div>`}
            <div class="cdd-ev-left" data-action="cdd-toggle-task" data-id="${ev.id}" data-date="${dateStr}">
                <div class="cdd-ev-check ${done ? 'done' : ''}">
                    ${done ? '<i class="fa-solid fa-check"></i>' : ''}
                </div>
                <div class="cdd-ev-body">
                    <div class="cdd-ev-title">${ev.text}</div>
                    <div class="cdd-ev-time">${ev.timeStart || '--'} – ${ev.timeEnd || '--'}</div>
                </div>
            </div>
            <div class="cdd-ev-actions">
                ${isPast ? '' : `<button class="cdd-act-btn" title="Düzenle"
                    data-action="cdd-edit-task" data-id="${ev.id}">
                    <i class="fa-solid fa-pen"></i>
                </button>`}
                <button class="cdd-act-btn del" title="Sil"
                    data-action="cdd-delete-task" data-id="${ev.id}" data-date="${dateStr}">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        </div>`;
    });
    return html;
}

function _cddHabitsSectionHtml(dayHabits, dateStr, isFuture) {
    if (!dayHabits.length) return '';
    const habDone  = dayHabits.filter(h => !!h.history[dateStr]).length;
    const habTotal = dayHabits.length;

    let html = `
    <div class="cdd-tasks-header">
        <div class="cdd-tasks-top">
            <span class="cdd-tasks-label">Alışkanlıklar</span>
            <span class="cdd-badge-done">${habDone}/${habTotal} tamamlandı</span>
        </div>
        <div class="cdd-task-prog-track">
            <div class="cdd-task-prog-fill" data-w="${habTotal>0?Math.round((habDone/habTotal)*100):0}" data-bg="${habDone===habTotal&&habTotal>0?'#2ed573':'#a29bfe'}"></div>
        </div>
    </div>`;

    dayHabits.forEach(h => {
        const done = !!h.history[dateStr];

        const [hdd, hmm, hyyyy] = dateStr.split('-').map(Number);
        let streak = 0;
        let sd = new Date(hyyyy, hmm - 1, hdd);
        sd.setHours(0, 0, 0, 0);
        while (true) {
            const sds = formatDateToString(sd);
            if (h.history[sds]) { streak++; sd.setDate(sd.getDate() - 1); }
            else break;
        }

        const streakColor = streak >= 30 ? '#ff4757'
                          : streak >= 14 ? '#ff9f43'
                          : streak >= 7  ? '#fdcb6e'
                          : streak >= 3  ? '#a29bfe'
                          : '#636e72';
        const streakIcon = streak >= 30 ? 'fa-fire-flame-curved'
                         : streak >= 7  ? 'fa-fire'
                         : 'fa-seedling';

        let dotsHtml = '';
        for (let i = 6; i >= 0; i--) {
            const pd = new Date(hyyyy, hmm - 1, hdd - i);
            const pds = formatDateToString(pd);
            const filled = !!h.history[pds];
            const isToday = i === 0;
            dotsHtml += `<span class="cdd-hdot ${filled ? 'filled' : ''} ${isToday ? 'today' : ''}"
                title="${pd.toLocaleDateString('tr-TR',{day:'numeric',month:'short'})}"></span>`;
        }

        const toggleAttr = isFuture
            ? 'disabled title="Gelecek gün"'
            : `data-action="cdd-toggle-habit" data-id="${h.id}" data-date="${dateStr}"`;

        html += `
        <div class="cdd-habit-card ${done ? 'done' : ''} ${isFuture ? 'future' : ''}">
            <button class="cdd-habit-check-btn ${done ? 'done' : ''}" ${toggleAttr}>
                ${done ? '<i class="fa-solid fa-check"></i>' : ''}
            </button>
            <div class="cdd-habit-main">
                <div class="cdd-habit-name">${escapeHtml(h.name)}</div>
                <div class="cdd-habit-dots-row">${dotsHtml}</div>
            </div>
            <div class="cdd-habit-streak" data-color="${streakColor}" title="${streak} günlük seri">
                <i class="fa-solid ${streakIcon}"></i>
                <span>${streak}</span>
            </div>
        </div>`;
    });
    return html;
}

function cddPopulateGoals() {
    const sel = document.getElementById('cdd-goal-select');
    if (!sel) return;
    const goals = getGoalsRef();
    const active = goals.filter(g => !g.completed);
    sel.innerHTML = `<option value="">— Ana hedefe bağla (isteğe bağlı)</option>` +
        active.map(g => `<option value="${g.id}">${escapeHtml(g.title)}</option>`).join('');
}

window.__cddComputeDayData = _cddComputeDayData;
window.__cddUpdateProgressRing = _cddUpdateProgressRing;
window.__cddHighlightHtml = _cddHighlightHtml;
window.__cddTasksSectionHtml = _cddTasksSectionHtml;
window.__cddHabitsSectionHtml = _cddHabitsSectionHtml;
window.cddPopulateGoals = cddPopulateGoals;

})();
