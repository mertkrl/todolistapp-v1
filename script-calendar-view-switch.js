// ============================================================
// FOCUSAI SCRIPT-CALENDAR-VIEW-SWITCH.JS
// script.js'ten çıkarılmış: Takvim Aylık/Haftalık/Günlük görünüm
// değiştirme (switchCalView), unified başlık güncelleme
// (updateCalUnifiedTitle) ve unified prev/next/today navigasyonu.
// currentCalView artık bare closure değişkeni değil,
// window.__getCurrentCalView/__setCurrentCalView köprüsü üzerinden
// paylaşılan state — script.js'in DOMContentLoaded'ında tanımlanır.
// script.js'in window köprülerini (__getCurrentDateRef/__setCurrentDateRef,
// __getSelectedDateRef/__setSelectedDateRef, monthNames, monthNamesShort,
// getWeekStart, closeDayDrawer, renderCalendar, renderEvents,
// renderWeeklyView, renderDailyView) kullanır — script.js önce yüklenir,
// bu dosya sonra (script-day-drawer-core.js desenini izler).
// ============================================================

(function () {
'use strict';

function updateCalUnifiedTitle() {
    const el = document.getElementById('cal-unified-title');
    const monthYearDisplay = document.getElementById('month-year-display');
    const currentDate = window.__getCurrentDateRef();
    const selectedDate = window.__getSelectedDateRef();

    // Üst kısımdaki Ay/Yıl başlığını her halükarda senkronize et
    if (monthYearDisplay && currentDate) {
        monthYearDisplay.textContent = `${window.monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }

    if (!el) return;
    const currentCalView = window.__getCurrentCalView();
    if (currentCalView === 'monthly') {
        el.textContent = `${window.monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    } else if (currentCalView === 'weekly') {
        const ws = window.getWeekStart(selectedDate);
        const we = new Date(ws); we.setDate(we.getDate() + 6);
        el.textContent = `${ws.getDate()} ${window.monthNamesShort[ws.getMonth()]} – ${we.getDate()} ${window.monthNamesShort[we.getMonth()]} ${we.getFullYear()}`;
    } else {
        el.textContent = selectedDate.toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    }
}

function switchCalView(view) {
    window.__setCurrentCalView(view);
    document.querySelectorAll('.cal-view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));

    // Görünüm değişince drawer'ı kapat
    window.closeDayDrawer();

    // Seçili günü yeni görünüme taşı: selectedDate her zaman bağlam kaynağı
    window.__setCurrentDateRef(new Date(window.__getSelectedDateRef()));

    const prevPanel = document.querySelector('.cal-view-panel.active');
    const nextPanel = document.getElementById('cal-view-' + view);

    if (!nextPanel || prevPanel === nextPanel) {
        // Aynı panel — sadece yenile
        updateCalUnifiedTitle();
        if (view === 'monthly') { window.renderCalendar(); window.renderEvents(); }
        else if (view === 'weekly') window.renderWeeklyView();
        else window.renderDailyView();
        return;
    }

    // Mevcut paneli fade-out yap
    if (prevPanel) {
        prevPanel.classList.add('cal-panel-leaving');
        setTimeout(() => {
            prevPanel.classList.remove('active', 'cal-panel-leaving');
            prevPanel.style.display = 'none';
        }, 150);
    }

    // Yeni paneli kısa gecikme sonrası fade-in yap
    setTimeout(() => {
        nextPanel.classList.remove('hidden');
        nextPanel.style.display = 'flex';
        // Tarayıcıya bir frame ver, sonra animasyonu tetikle
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                nextPanel.classList.add('active', 'cal-panel-entering');
                setTimeout(() => nextPanel.classList.remove('cal-panel-entering'), 220);
            });
        });
        updateCalUnifiedTitle();
        if (view === 'monthly') { window.renderCalendar(); window.renderEvents(); }
        else if (view === 'weekly') window.renderWeeklyView();
        else window.renderDailyView();
    }, 120);
}

function calUnifiedPrev() {
    const currentCalView = window.__getCurrentCalView();
    if (currentCalView === 'monthly') {
        const currentDate = window.__getCurrentDateRef();
        currentDate.setMonth(currentDate.getMonth() - 1);
        window.renderCalendar();
    }
    else if (currentCalView === 'weekly') {
        let selectedDate = new Date(window.__getSelectedDateRef());
        selectedDate.setDate(selectedDate.getDate() - 7);
        window.__setSelectedDateRef(selectedDate);
        window.__setCurrentDateRef(new Date(selectedDate)); // Üst tarafı senkronize etmek için
        window.renderWeeklyView();
    }
    else {
        let selectedDate = new Date(window.__getSelectedDateRef());
        selectedDate.setDate(selectedDate.getDate() - 1);
        window.__setSelectedDateRef(selectedDate);
        window.__setCurrentDateRef(new Date(selectedDate)); // Üst tarafı senkronize etmek için
        window.renderDailyView();
    }
    updateCalUnifiedTitle();
}

function calUnifiedNext() {
    const currentCalView = window.__getCurrentCalView();
    if (currentCalView === 'monthly') {
        const currentDate = window.__getCurrentDateRef();
        currentDate.setMonth(currentDate.getMonth() + 1);
        window.renderCalendar();
    }
    else if (currentCalView === 'weekly') {
        let selectedDate = new Date(window.__getSelectedDateRef());
        selectedDate.setDate(selectedDate.getDate() + 7);
        window.__setSelectedDateRef(selectedDate);
        window.__setCurrentDateRef(new Date(selectedDate)); // Üst tarafı senkronize etmek için
        window.renderWeeklyView();
    }
    else {
        let selectedDate = new Date(window.__getSelectedDateRef());
        selectedDate.setDate(selectedDate.getDate() + 1);
        window.__setSelectedDateRef(selectedDate);
        window.__setCurrentDateRef(new Date(selectedDate)); // Üst tarafı senkronize etmek için
        window.renderDailyView();
    }
    updateCalUnifiedTitle();
}

function calUnifiedToday() {
    const t = new Date();
    window.__setCurrentDateRef(new Date(t));
    window.__setSelectedDateRef(new Date(t));
    updateCalUnifiedTitle();
    const currentCalView = window.__getCurrentCalView();
    if (currentCalView === 'monthly') { window.renderCalendar(); window.renderEvents(); }
    else if (currentCalView === 'weekly') window.renderWeeklyView();
    else window.renderDailyView();
}

window.updateCalUnifiedTitle = updateCalUnifiedTitle;
window.switchCalView = switchCalView;
window.calUnifiedPrev = calUnifiedPrev;
window.calUnifiedNext = calUnifiedNext;
window.calUnifiedToday = calUnifiedToday;

// Sadece geçerli bir görünüm değerine (data-view) sahip butonların tıklanmasını sağla
document.querySelectorAll('.cal-view-btn').forEach(btn => {
    if (btn.dataset.view) {
        btn.addEventListener('click', () => switchCalView(btn.dataset.view));
    }
});
const _calPrev = document.getElementById('cal-unified-prev');
const _calNext = document.getElementById('cal-unified-next');
const _calToday = document.getElementById('cal-unified-today');
if (_calPrev) _calPrev.addEventListener('click', calUnifiedPrev);
if (_calNext) _calNext.addEventListener('click', calUnifiedNext);
if (_calToday) _calToday.addEventListener('click', calUnifiedToday);

})();
