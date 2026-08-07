// Takvim listesi içi reorder + tamamlama animasyonu (Faz H2, script.js'ten
// çıkarıldı). Yalnızca closure state'i `calendarEvents` diziyi YERİNDE (splice)
// mutasyona uğratıyor, yeniden atama yapmıyor — bu yüzden var olan
// window.__getCalendarEventsRef() salt-okunur köprüsü extraction için yeterli
// (setter'a gerek yok).
export function initCalEventListDnD(dateStr) {
    const list = document.getElementById('event-list');
    if (!list) return;

    // TAMAMLAMA ANİMASYONU — checkbox tıklamalarını yakala
    list.querySelectorAll('.tc-checkbox').forEach(cb => {
        cb.addEventListener('click', function() {
            const li = cb.closest('.cal-event-item');
            if (!li) return;
            li.classList.add('completing');
            setTimeout(() => li.classList.remove('completing'), 420);
        }, { once: false });
    });

    // AYNI GÜN İÇİ REORDER
    const items = Array.from(list.querySelectorAll('.cal-event-item[draggable="true"]'));
    let dragSrc = null;
    let dragSrcId = null;

    items.forEach(item => {
        // dragstart
        item.addEventListener('dragstart', function(e) {
            dragSrc = item;
            dragSrcId = e.dataTransfer.getData('taskId');
            setTimeout(() => item.classList.add('dragging'), 0);
            // Premium ghost
            const calendarEvents = window.__getCalendarEventsRef();
            const evData = (calendarEvents[dateStr] || []).find(x => String(x.id) === String(dragSrcId));
            if (evData) {
                const ghost = window.createCalDragGhost(evData.text, evData.timeStart, evData.timeEnd, evData.priority);
                e.dataTransfer.setDragImage(ghost, 110, 28);
            }
        });

        // dragend
        item.addEventListener('dragend', function() {
            item.classList.remove('dragging');
            items.forEach(i => i.classList.remove('drag-over-above', 'drag-over-below'));
            dragSrc = null;
        });

        // dragover — yukarı mı aşağı mı belirle
        item.addEventListener('dragover', function(e) {
            if (!dragSrc || dragSrc === item) return;
            e.preventDefault();
            e.stopPropagation();
            const rect = item.getBoundingClientRect();
            items.forEach(i => i.classList.remove('drag-over-above', 'drag-over-below'));
            item.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drag-over-above' : 'drag-over-below');
        });

        // dragleave
        item.addEventListener('dragleave', function() {
            item.classList.remove('drag-over-above', 'drag-over-below');
        });

        // drop — listedeki sırayı güncelle
        item.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation(); // Takvim günü drop'una geçmesin
            item.classList.remove('drag-over-above', 'drag-over-below');

            const draggedId = e.dataTransfer.getData('taskId');
            if (!draggedId || !dragSrc || dragSrc === item) return;

            const calendarEvents = window.__getCalendarEventsRef();
            const evList = calendarEvents[dateStr];
            if (!evList) return;

            const fromIdx = evList.findIndex(ev => String(ev.id) === String(draggedId));

            // Hedef item'ın id'sini checkbox onclick'ten çıkar
            const targetCb = item.querySelector('.tc-checkbox');
            if (!targetCb) return;
            const targetMatch = (targetCb.getAttribute('onclick') || '').match(/'([^']+)'/);
            if (!targetMatch) return;
            const toIdx = evList.findIndex(ev => String(ev.id) === String(targetMatch[1]));

            if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

            // Yukarı mı aşağı mı bırakıldı?
            const rect = item.getBoundingClientRect();
            let insertIdx = (e.clientY < rect.top + rect.height / 2) ? toIdx : toIdx + 1;
            if (fromIdx < insertIdx) insertIdx--;

            const [moved] = evList.splice(fromIdx, 1);
            evList.splice(insertIdx, 0, moved);

            window.saveTasks();
            window.renderEvents();
        });
    });
}
window.initCalEventListDnD = (dateStr) => initCalEventListDnD(dateStr);
