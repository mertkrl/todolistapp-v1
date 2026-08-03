import { getCat } from './planning-utils.js';
import { _pvFmtHM } from './planning-plan-view-time-utils.js';
import { _pvBusyToggleBtn } from './planning-lesson-plan-busy-slots.js';
// ─── PLANVIEW SAAT-GRİDİ (HAFTA/GÜN GÖRÜNÜMLERİ): SAF HTML-ÜRETİM YARDIMCILARI ──
// planning.js dosyasından çıkarıldı (Faz O devamı). Bu fonksiyonlar sadece
// pvCalView (window.__getPvCalView/__setPvCalView köprüsü) ve goals
// (window._pgGetGoals()) gibi zaten köprülü paylaşılan duruma bağımlı —
// kendi DOM elementi cache'lemiyorlar (dışarıdan `el` parametresi alıyorlar).

const PVC_ROW_H = 60;

export function _pvCalSwitchInline(g) {
    if (!window._pvIsLessonPlan(g)) return '';
    const pvCalView = window.__getPvCalView();
    const views = [['month','Aylık'],['week','Haftalık'],['day','Günlük']];
    return views.map(([v,label]) =>
        `<button type="button" class="pg-pv-main-cal-today-btn pg-pv-cal-view-btn${pvCalView===v?' active':''}" data-view="${v}">${label}</button>`).join('');
}

export function _pvBindCalSwitch(el, g) {
    el.querySelectorAll('.pg-pv-cal-view-btn').forEach(btn => {
        btn.addEventListener('click', () => { window.__setPvCalView(btn.dataset.view); window._pvRenderMainCal(g); });
    });
}

export function _pvHourGridHead(label, g) {
    return `<div class="pg-pv-main-cal-nav">
        <div class="u-display-flex_align-items-center_gap-8px">
            <button class="pg-pv-main-cal-nav-btn" id="pg-pv-mcal-prev"><i class="ti ti-chevron-left"></i></button>
            <div class="pg-pv-main-cal-month">${label}</div>
            <button class="pg-pv-main-cal-nav-btn" id="pg-pv-mcal-next"><i class="ti ti-chevron-right"></i></button>
        </div>
        <div class="u-display-flex_gap-6px_align-items-center">
            ${_pvCalSwitchInline(g)}
            <button class="pg-pv-main-cal-today-btn" id="pg-pv-mcal-today">Bugün</button>
            ${_pvBusyToggleBtn(g)}
        </div>
    </div>`;
}

export function _pvTimeToMinLocal(t) { const [h,m] = (t||'0:00').split(':').map(Number); return h*60+(m||0); }

// Aynı saat diliminde birden fazla görev varsa yan yana sütunlara böl —
// ana Takvim sekmesindeki çakışma çözümüyle aynı mantık, üst üste binmesinler.
export function _pvTaskChip(t, g, col, colTotal) {
    const esc = window.esc;
    const goals = window._pgGetGoals();
    col = col || 0; colTotal = colTotal || 1;
    // Öğrencinin kendi takvimi olarak açılan ders planı görünümünde (g.lpa_id) bu plana
    // ait olmayan görevler de gösteriliyor — onları kendi hedeflerinin renginde çiz ki
    // "bu ders" ile "kendi görevim" birbirinden ayırt edilebilsin.
    const isForeign = g.lpa_id && String(t.parentGoal) !== String(g.id);
    let cat = getCat(g.category);
    if (isForeign) {
        const ownerGoal = goals.find(x => String(x.id) === String(t.parentGoal));
        cat = getCat(ownerGoal?.category);
    }
    const s = _pvTimeToMinLocal(t.timeStart), e = _pvTimeToMinLocal(t.timeEnd || t.timeStart);
    // Chip bir tek saatlik hücrenin İÇİNE ekleniyor — top, o hücrenin başından
    // itibaren geçen dakikaya göre olmalı (günün başından itibaren değil).
    const top = Math.max(0, (s % 60) / 60 * PVC_ROW_H);
    const height = Math.max(20, (e - s) / 60 * PVC_ROW_H);
    const timeLbl = [_pvFmtHM(t.timeStart), _pvFmtHM(t.timeEnd)].filter(Boolean).join('–');
    const colW = 100 / colTotal;
    const gap  = colTotal > 1 ? 2 : 3;
    return `<div class="pg-pv-hcal-chip${t.completed?' done':''}${isForeign?' pg-pv-hcal-chip-foreign':''}" data-day-task="${t.id}" draggable="true"
        data-chip-top="${top}" data-chip-height="${height}" data-chip-left="calc(${col*colW}% + ${gap}px)" data-chip-width="calc(${colW}% - ${gap*2}px)"
        data-chip-color="${esc(cat.color)}" data-chip-mix="${t.completed?10:16}"
        title="${esc(t.text)}${timeLbl?' · '+timeLbl:''}${isForeign?' (kendi görevin)':''}">
        <span class="pg-pv-hcal-chip-text">${isForeign?'<i class="ti ti-user u-font-size-9px_margin-right-2px_opacity-p7" ></i>':''}${esc(t.text)}</span>
        ${height>=34 && colTotal===1 ? `<span class="pg-pv-hcal-chip-time">${timeLbl}</span>` : ''}
    </div>`;
}

export function _pvRenderTaskChips(tasks, g) {
    return tasks.map((t, i) => _pvTaskChip(t, g, i, tasks.length)).join('');
}
