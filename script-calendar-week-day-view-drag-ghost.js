// script-calendar-week-day-view-drag-ghost.js
// script-calendar-week-day-view.js'ten çıkarıldı: sürükleme "hayalet" görseli
// oluşturucu — sadece kendi parametrelerine ve window.escapeHtml'e ihtiyaç
// duyuyor, paylaşılan closure state'e (haftalık/günlük görünüm) bağımlı değil.
export function createCalDragGhost(text, timeStart, timeEnd, priority) {
    const ghost = document.createElement('div');
    ghost.className = `cal-drag-ghost ghost-${priority || 'medium'}`;
    const timeStr = timeStart ? `⏱ ${timeStart}${timeEnd ? ' → ' + timeEnd : ''}` : '';
    ghost.innerHTML = `
        <div class="ghost-bar"></div>
        <div class="ghost-time">${timeStr}</div>
        <div class="ghost-title">${window.escapeHtml(text)}</div>
        <i class="fa-solid fa-grip-dots-vertical ghost-icon"></i>`;
    document.body.appendChild(ghost);
    setTimeout(() => ghost.remove(), 0);
    return ghost;
}

window.createCalDragGhost = createCalDragGhost;
