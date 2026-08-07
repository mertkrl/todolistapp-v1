// script-statistics-heatmap.js
// script-statistics.js'ten çıkarıldı: renderStatistics'in Isı Haritası
// bölümü — sadece kendi parametresine (highlightHistory) ve dışa açık
// köprülere (getTasksRef/formatDateToString/window.escapeHtml/
// window.monthNames*) bağımlı, script-statistics.js'teki diğer 3 render
// yardımcısıyla paylaşılan mutable state yok.
import { getTasksRef } from './script.js';
import { formatDateToString } from './script-date-time-utils.js';

export function renderFocusHeatmap(highlightHistory) {
    const heatmapEl = document.getElementById('focus-heatmap');
    const monthsEl = document.getElementById('heatmap-months');
    if (!heatmapEl) return;
    const tasksByDay = {};
    getTasksRef().filter(t => t.completed).forEach(t => {
        if (t.date) tasksByDay[t.date] = (tasksByDay[t.date] || 0) + 1;
    });
    Object.entries(highlightHistory).filter(([,h]) => h.completed).forEach(([ds]) => {
        tasksByDay[ds] = (tasksByDay[ds] || 0) + 1;
    });

    const totalDays = 140; // 20 hafta * 7 gün — kutu boyutu aynı kalsın, sağdaki boşluk daha fazla haftayla dolsun
    const cells = [];
    const monthLabels = [];
    let lastMonth = -1;

    // Yedek ay isimleri listesi (Hata önleyici altyapı)
    const fallbackMonthsShort = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const activeMonthNamesShort = typeof window.monthNamesShort !== 'undefined' ? window.monthNamesShort : fallbackMonthsShort;

   // 1. ADIM: 10 sütunu dikey tarayıp ayların başlangıç koordinatlarını üst satıra hizalama
   const numCols = totalDays / 7; // 70 / 7 = 10
   for (let col = 0; col < numCols; col++) {
    // Her sütunun en üstündeki günün i indeksini buluyoruz
    const i = (totalDays - 1) - (col * 7);
    const dCol = new Date();
    dCol.setDate(dCol.getDate() - i);
    const currentMonth = dCol.getMonth();

    if (col === 0 || currentMonth !== lastMonth) {
        const mName = activeMonthNamesShort[currentMonth];
        const percentLeft = (col / numCols) * 100;
        monthLabels.push(`<span class="heatmap-month-label" data-left="${percentLeft}">${mName}</span>`);
        lastMonth = currentMonth;
    }
}
    if (monthsEl) {
        monthsEl.innerHTML = monthLabels.join('');
        monthsEl.querySelectorAll('.heatmap-month-label').forEach(el => {
            el.style.left = el.dataset.left + '%';
        });
    }

    // 2. ADIM: Isı haritası kutucuklarını (hücreleri) oluşturma
    for (let i = totalDays - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
        const ds = formatDateToString(d);
        const count = tasksByDay[ds] || 0;

        // Sıfır görev varsa seviye 0, diğer durumlarda yoğunluğa göre seviye ataması
        const level = count === 0 ? 0 : count === 1 ? 1 : count <= 2 ? 2 : count <= 4 ? 3 : count <= 6 ? 4 : 5;
        const label = `${d.getDate()} ${activeMonthNamesShort[d.getMonth()]}: ${count} görev`;
        cells.push(`<div class="hm-day" data-level="${level}" title="${label}" data-date="${ds}"></div>`);
    }
    heatmapEl.innerHTML = cells.join('');

    // 3. ADIM: Isı Haritası Hücrelerine Tıklama Dinleyicisi
    heatmapEl.querySelectorAll('.hm-day').forEach(cell => {
        cell.addEventListener('click', () => {
            const clickedDate = cell.getAttribute('data-date');

            heatmapEl.querySelectorAll('.hm-day').forEach(c => c.classList.remove('active-heatmap-day'));
            cell.classList.add('active-heatmap-day');

            const dayTasks = getTasksRef().filter(t => t.date === clickedDate && t.completed);

            let dayHighlightText = "";
            if (highlightHistory[clickedDate] && highlightHistory[clickedDate].completed) {
                dayHighlightText = highlightHistory[clickedDate].text;
            }

            const detailsPanel = document.getElementById('heatmap-day-details');
            const detailsDate = document.getElementById('heatmap-details-date');
            const detailsContent = document.getElementById('heatmap-details-content');

            if (detailsPanel && detailsDate && detailsContent) {
                const [d, m, y] = clickedDate.split('-'); // GÜNCELLEME: d, m, y sırasına alındı
                const fallbackMonthsFull = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
                const activeFullMonths = typeof window.monthNames !== 'undefined' ? window.monthNames : fallbackMonthsFull;

                detailsDate.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> ${parseInt(d)} ${activeFullMonths[parseInt(m)-1]} ${y} Tarihinin Özeti`;

                let htmlContent = "";

                if (dayHighlightText) {
                    htmlContent += `
                        <div class="heatmap-mini-task u-border-left-3pxsolidhff9f43_background-rgba255159670p03" >
                            <i class="fa-solid fa-star u-color-hff9f43-2" ></i>
                            <span class="u-font-weight-600_color-hfff">[Ana Hedef] ${dayHighlightText}</span>
                        </div>`;
                }

                if (dayTasks.length > 0) {
                    dayTasks.forEach(t => {
                        htmlContent += `
                            <div class="heatmap-mini-task">
                                <i class="fa-solid fa-circle-check"></i>
                                <span>${escapeHtml(t.text)}</span>
                                <span class="heatmap-mini-task-time"><i class="fa-regular fa-clock"></i> ${t.timeStart || '09:00'} - ${t.timeEnd || '10:00'}</span>
                            </div>`;
                    });
                }

                if (!dayHighlightText && dayTasks.length === 0) {
                    htmlContent = `<div class="u-text-align-center_padding-15px_color-var-text-muted_font-s"><i class="fa-solid fa-mug-hot u-margin-right-6px" ></i> Bu tarihte tamamlanmış bir aktivite bulunmuyor.</div>`;
                }

                detailsContent.innerHTML = htmlContent;
                detailsPanel.style.display = 'block';
            }
        });
    });
}
