// ============================================================
// FOCUSAI SCRIPT-DAY-DRAWER-CORE.JS
// script.js'ten çıkarılmış: Gün Detay Drawer (cal-day-drawer) açma/kapama,
// render orkestrasyonu, sürükle-bırak zaman takası ve saat popover'ı.
// script-day-drawer-render.js'in saf yardımcılarını (window.__cdd*) ve
// script.js'in window köprülerini (__getTasksRef, __getCalendarEventsRef,
// __getSelectedDateRef, saveTasks, renderTasks, hasTimeConflict,
// checkGoalDateBoundaries, getNextAvailableTimeSlot, addGlobalTask,
// showPremiumModal, parseSmartText, renderCalendar, renderEvents,
// updateStats, renderGoals, renderDaySummary, cddPopulateGoals,
// closeDayDrawer, switchCalView) kullanır — script.js önce yüklenir, bu
// dosya sonra (script-day-drawer-render.js ve script-day-summary-card.js
// desenini izler).
// _cddTimePopoverEl artık bare closure değişkeni değil,
// state/day-drawer-ui-store.js'te paylaşılan bir store — bu sayede bu
// fonksiyon kümesi script.js'in closure'ından tamamen ayrılabildi.
// ============================================================
import { getCddTimePopoverEl, setCddTimePopoverEl } from '../state/day-drawer-ui-store.js';

(function () {
'use strict';

function closeDayDrawer() {
    const drawer = document.getElementById('cal-day-drawer');
    if (drawer) drawer.classList.remove('open');
}
window.closeDayDrawer = closeDayDrawer;

function openDayDrawer(dateStr) {
    const drawer = document.getElementById('cal-day-drawer');
    if (!drawer) return;

    const todayStr = window.formatDateToString(new Date());
    const isPast   = dateStr < todayStr;

    const addForm = drawer.querySelector('.cdd-add-form');
    if (addForm) addForm.style.display = isPast ? 'none' : '';

    let badge = drawer.querySelector('.cdd-readonly-badge');
    if (isPast) {
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'cdd-readonly-badge';
            badge.innerHTML = '<i class="fa-solid fa-lock"></i> Geçmiş gün — yalnızca görüntüleme';
            const qa = drawer.querySelector('.cdd-quick-add');
            if (qa) qa.parentNode.insertBefore(badge, qa.nextSibling);
        }
        badge.style.display = '';
    } else {
        if (badge) badge.style.display = 'none';
    }

    drawer.classList.add('open');
    window.cddPopulateGoals();
    renderDayDrawer(dateStr);

    const cddTS = document.getElementById('cdd-time-start');
    const cddTE = document.getElementById('cdd-time-end');
    if (cddTS && cddTE && !isPast) {
        const nextSlot = window.getNextAvailableTimeSlot(dateStr);
        cddTS.value = nextSlot.start;
        cddTE.value = nextSlot.end;
    }

    window.renderDaySummary(dateStr);
}
window.openDayDrawer = openDayDrawer;

function _cddWireDragAndDrop(content, dateStr) {
    let cddDragSrcId = null;

    content.querySelectorAll('.cdd-event[data-ev-id][draggable="true"]').forEach(card => {
        card.addEventListener('dragstart', e => {
            cddDragSrcId = card.dataset.evId;
            card.classList.add('cdd-dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', cddDragSrcId);
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('cdd-dragging');
            content.querySelectorAll('.cdd-event').forEach(c => {
                c.classList.remove('cdd-drag-over', 'cdd-drag-above', 'cdd-drag-below');
            });
        });

        card.addEventListener('dragover', e => {
            e.preventDefault();
            if (card.dataset.evId === cddDragSrcId) return;
            e.dataTransfer.dropEffect = 'move';
            content.querySelectorAll('.cdd-event').forEach(c =>
                c.classList.remove('cdd-drag-over', 'cdd-drag-above', 'cdd-drag-below'));
            const rect = card.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            card.classList.add(e.clientY < midY ? 'cdd-drag-above' : 'cdd-drag-below');
            card.classList.add('cdd-drag-over');
        });

        card.addEventListener('dragleave', () => {
            card.classList.remove('cdd-drag-over', 'cdd-drag-above', 'cdd-drag-below');
        });

        card.addEventListener('drop', e => {
            e.preventDefault();
            const dstId = card.dataset.evId;
            if (!cddDragSrcId || cddDragSrcId === dstId) return;
            cddSwapTaskTimes(cddDragSrcId, dstId, dateStr);
        });
    });
}

function renderDayDrawer(dateStr) {
    const [dd, mm, yyyy] = dateStr.split('-');
    const date = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
    const todayStr = window.formatDateToString(new Date());
    const isFuture = dateStr > todayStr;
    const isPast   = dateStr < todayStr;

    const weekdayEl = document.getElementById('cdd-weekday');
    const dateEl    = document.getElementById('cdd-date');
    if (weekdayEl) weekdayEl.textContent = date.toLocaleDateString('tr-TR', { weekday: 'long' });
    if (dateEl)    dateEl.textContent    = date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

    const { dayEvents, dayHabits, highlight, total } = window.__cddComputeDayData(dateStr);

    window.__cddUpdateProgressRing(dateStr, isFuture, dayEvents, dayHabits, highlight, total);

    const content = document.getElementById('cdd-content');
    if (!content) return;

    if (total === 0) {
        const emptyMsg = isFuture
            ? 'Bu güne henüz plan eklenmemiş.<br><span class="u-font-size-11px_opacity-0p6">Hızlı ekle alanını kullanabilirsin.</span>'
            : isPast
                ? 'Bu gün için kayıtlı plan yok.'
                : 'Bugün için plan bulunamadı.<br><span class="u-font-size-11px_opacity-0p6">Hızlı ekle alanını kullanabilirsin.</span>';
        content.innerHTML = `<div class="cdd-empty">
            <div class="cdd-empty-icon">${isPast ? '📖' : '📅'}</div>
            <div class="cdd-empty-text">${emptyMsg}</div>
        </div>`;
        return;
    }

    const html = window.__cddHighlightHtml(highlight)
        + window.__cddTasksSectionHtml(dayEvents, isPast, dateStr)
        + window.__cddHabitsSectionHtml(dayHabits, dateStr, isFuture);

    content.innerHTML = html;

    content.querySelectorAll('.cdd-badge-time[data-burnout-color]').forEach(el => {
        el.style.color = el.dataset.burnoutColor;
    });
    content.querySelectorAll('.cdd-task-prog-fill[data-w]').forEach(el => {
        el.style.width = el.dataset.w + '%';
        el.style.background = el.dataset.bg;
    });
    content.querySelectorAll('.cdd-event[data-p-color]').forEach(el => {
        el.style.borderLeftColor = el.dataset.pColor;
    });
    content.querySelectorAll('.cdd-habit-streak[data-color]').forEach(el => {
        el.style.color = el.dataset.color;
    });

    _cddWireDragAndDrop(content, dateStr);
}
window.renderDayDrawer = renderDayDrawer;

function cddSwapTaskTimes(srcId, dstId, dateStr) {
    const tasks = window.__getTasksRef();
    const srcTask = tasks.find(t => String(t.id) === String(srcId));
    const dstTask = tasks.find(t => String(t.id) === String(dstId));
    if (!srcTask || !dstTask) return;

    const tmpStart = srcTask.timeStart, tmpEnd = srcTask.timeEnd;
    srcTask.timeStart = dstTask.timeStart;
    srcTask.timeEnd   = dstTask.timeEnd;
    dstTask.timeStart = tmpStart;
    dstTask.timeEnd   = tmpEnd;

    const calendarEvents = window.__getCalendarEventsRef();
    const dateEvs = calendarEvents[dateStr] || [];
    const srcEv = dateEvs.find(e => String(e.id) === String(srcId));
    const dstEv = dateEvs.find(e => String(e.id) === String(dstId));
    if (srcEv && dstEv) {
        const ts = srcEv.timeStart, te = srcEv.timeEnd;
        srcEv.timeStart = dstEv.timeStart; srcEv.timeEnd = dstEv.timeEnd;
        dstEv.timeStart = ts;              dstEv.timeEnd = te;
    }

    window.saveTasks();
    window.renderDayDrawer(dateStr);
    window.renderCalendar();
    if (typeof window.renderTasks === 'function') window.renderTasks();
}

const _cddTStart = document.getElementById('cdd-time-start');
const _cddTEnd   = document.getElementById('cdd-time-end');
if (_cddTStart && _cddTEnd) {
    _cddTStart.addEventListener('change', () => {
        _cddTEnd.value = window.addOneHour(_cddTStart.value);
    });
}

function cddCloseTimePopover() {
    const popEl = getCddTimePopoverEl();
    if (popEl) {
        popEl.remove();
        setCddTimePopoverEl(null);
        document.removeEventListener('mousedown', cddTimePopoverOutsideClick, true);
    }
}

function cddTimePopoverOutsideClick(e) {
    const popEl = getCddTimePopoverEl();
    if (popEl && !popEl.contains(e.target) && e.target.id !== 'cdd-time-start' && e.target.id !== 'cdd-time-end') {
        cddCloseTimePopover();
    }
}

function cddOpenTimePopover(inputEl) {
    cddCloseTimePopover();
    const pop = document.createElement('div');
    pop.className = 'cdd-time-popover';
    const currentVal = inputEl.value;
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 15) {
            const t = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            const item = document.createElement('div');
            item.className = 'cdd-time-popover-item' + (t === currentVal ? ' active' : '');
            item.textContent = t;
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                inputEl.value = t;
                inputEl.dispatchEvent(new Event('change'));
                cddCloseTimePopover();
            });
            pop.appendChild(item);
        }
    }
    document.body.appendChild(pop);
    const r = inputEl.getBoundingClientRect();
    pop.style.left = r.left + 'px';
    pop.style.top = (r.bottom + 4) + 'px';
    setCddTimePopoverEl(pop);
    const activeItem = pop.querySelector('.cdd-time-popover-item.active');
    if (activeItem) activeItem.scrollIntoView({ block: 'center' });
    setTimeout(() => document.addEventListener('mousedown', cddTimePopoverOutsideClick, true), 0);
}
if (_cddTStart) _cddTStart.addEventListener('click', () => cddOpenTimePopover(_cddTStart));
if (_cddTEnd) _cddTEnd.addEventListener('click', () => cddOpenTimePopover(_cddTEnd));

function cddQuickAdd() {
    const inp    = document.getElementById('cdd-quick-input');
    const pri    = document.getElementById('cdd-quick-priority');
    const tSEl   = document.getElementById('cdd-time-start');
    const tEEl   = document.getElementById('cdd-time-end');
    const goalEl = document.getElementById('cdd-goal-select');
    if (!inp || !inp.value.trim()) {
        inp && inp.focus();
        return;
    }

    const smart    = window.parseSmartText(inp.value.trim());
    const text     = smart.cleanText || inp.value.trim();
    const priority = pri    ? pri.value    : 'medium';
    const tStart   = (smart.parsedTime) || (tSEl ? tSEl.value : '09:00');
    const tEnd     = tEEl  ? tEEl.value   : window.addOneHour(tStart);
    const goalId   = goalEl ? goalEl.value : '';
    const ds       = window.formatDateToString(window.__getSelectedDateRef());
    const sMins    = window.timeToMins(tStart);
    const eMins    = window.timeToMins(tEnd);

    if (eMins <= sMins) {
        window.showPremiumModal({ title: 'Geçersiz Saat', message: 'Bitiş saati başlangıç saatinden sonra olmalı.', type: 'warning' });
        return;
    }

    if (window.hasTimeConflict(ds, sMins, eMins)) {
        window.showPremiumModal({ title: 'Zaman Çakışması', message: `${tStart}–${tEnd} aralığında zaten bir planın var.`, type: 'warning' });
        return;
    }

    const calendarEvents = window.__getCalendarEventsRef();
    const usedMin = (calendarEvents[ds] || []).reduce((s, ev) =>
        s + Math.max(0, window.timeToMins(ev.timeEnd || '10:00') - window.timeToMins(ev.timeStart || '09:00')), 0);
    if (usedMin + Math.max(0, eMins - sMins) > 480) {
        window.showPremiumModal({ title: 'Kapasite Uyarısı! 🔥', message: 'Bu güne 8 saatten fazla görev yığdın. Hedeflerini diğer günlere dağıt.', type: 'warning' });
        return;
    }

    if (goalId && !window.checkGoalDateBoundaries(goalId, ds)) return;

    window.addGlobalTask(text, priority, 'is', ds, tStart, tEnd, '', goalId);

    inp.value = '';
    const nextSlot = window.getNextAvailableTimeSlot(ds, eMins - sMins || 60);
    if (tSEl) tSEl.value = nextSlot.start;
    if (tEEl) tEEl.value = nextSlot.end;
    if (goalEl) goalEl.value = '';

    window.renderDayDrawer(ds);
    window.renderDaySummary(ds);
    window.renderCalendar();
    window.renderEvents();
    if (typeof window.renderTasks  === 'function') window.renderTasks();
    if (typeof window.updateStats  === 'function') window.updateStats();
    if (typeof window.renderGoals  === 'function') window.renderGoals();
}

const _cddClose   = document.getElementById('cdd-close');
const _cddQBtn    = document.getElementById('cdd-quick-btn');
const _cddQInp    = document.getElementById('cdd-quick-input');
const _cddOpenDay = document.getElementById('cdd-open-daily');
if (_cddClose)   _cddClose.addEventListener('click', () => window.closeDayDrawer());
if (_cddQBtn)    _cddQBtn.addEventListener('click', cddQuickAdd);
if (_cddQInp)    _cddQInp.addEventListener('keypress', e => { if (e.key === 'Enter') cddQuickAdd(); });
if (_cddOpenDay) _cddOpenDay.addEventListener('click', () => { window.closeDayDrawer(); window.switchCalView('daily'); });

})();
