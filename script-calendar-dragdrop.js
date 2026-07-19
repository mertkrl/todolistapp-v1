// ============================================================
// FOCUSAI SCRIPT-CALENDAR-DRAGDROP.JS
// script.js'ten çıkarılmış takvim hücrelerine sürükle-bırak (drag & drop)
// entegrasyonu — hem normal görev taşımayı hem zihin çöplüğü fikirlerini
// takvime bırakmayı destekler. Artık ES module import'uyla script.js'in
// export ettiği ince sarmalayıcıları kullanıyor (window.X yerine).
// script.js'ten SONRA, orijinal DOMContentLoaded zamanlamasını korumak için
// kendi DOMContentLoaded sarmalayıcısında yüklenir.
// ============================================================
import {
    moveTaskToDate,
    renderCalendarGlobal,
    updateStats,
    convertDumpToTaskForDate,
    renderCalMindDump,
    getMindDumpsRef,
} from './script.js';

(function () {
'use strict';
document.addEventListener('DOMContentLoaded', () => {

     // ==========================================================================
     // YENİ: TAKVİM HÜCRELERİNE SÜRÜKLE-BIRAK (DRAG & DROP) ENTEGRASYONU
     // ==========================================================================
     const calendarDaysContainer = document.getElementById('calendar-days');
     
     if (calendarDaysContainer) {
         // Görev hücrenin üzerine geldiğinde
         calendarDaysContainer.addEventListener('dragover', (e) => {
             const dayEl = e.target.closest('.cal-day');
             if (dayEl) {
                 e.preventDefault(); // Sürüklemeye izin ver
                 dayEl.classList.add('drag-over');
             }
         });
 
         // Görev hücreden çıktığında
         calendarDaysContainer.addEventListener('dragleave', (e) => {
             const dayEl = e.target.closest('.cal-day');
             if (dayEl) {
                 dayEl.classList.remove('drag-over');
             }
         });
 
         // Görev hücreye bırakıldığında
         calendarDaysContainer.addEventListener('drop', (e) => {
            const dayEl = e.target.closest('.cal-day');
            if (dayEl) {
                e.preventDefault();
                dayEl.classList.remove('drag-over');
                // GÜNCELLEME: Hem normal görev sürüklemesini hem de zihin çöplüğü (taskId) verisini güvenle yakala
                const dumpId = e.dataTransfer.getData('taskId') || e.dataTransfer.getData('dumpId');
                // Hücrenin tarihini bulma garantisi (data-date yoksa onclick'ten tarihi çeker)
                let targetDate = dayEl.getAttribute('data-date');
                if (!targetDate && dayEl.getAttribute('onclick')) {
                    const match = dayEl.getAttribute('onclick').match(/['"]([^'"]+)['"]/);
                    if(match) targetDate = match[1];
                }
                if (dumpId && targetDate) {
                    // Eğer bu id bir zihin çöplüğü fikriyse dönüştür, yoksa normal görev taşıma fonksiyonunu çağır
                    const isDump = getMindDumpsRef().some(d => String(d.id) === String(dumpId));
                    if (isDump) {
                        convertDumpToTaskForDate(dumpId, targetDate);
                    } else {
                        moveTaskToDate(dumpId, targetDate);
                    }

                    // ANLIK SENKRONİZASYON: Sürükleme bittiği an takvimi ve listeleri zorla yenile
                    setTimeout(() => {
                        renderCalendarGlobal();
                        renderCalMindDump();
                        updateStats();
                    }, 100);
                }
            }
        });
     }

});
})();
