import { getCat } from './planning-utils.js';
import { _normYMD } from './planning-wizard.js';
import { _pvIsMirrorMs } from './planning-plan-view-time-utils.js';
import { _pvRecomputeUnresolvedConflicts } from './planning-lesson-plan-conflicts.js';
import { _pvIsBusyDay } from './planning-lesson-plan-busy-slots.js';
// ─── PLANVIEW ANA TAKVİM (AY GÖRÜNÜMÜ): VERİ HAZIRLAMA + HÜCRE HTML'İ ──────
// planning.js dosyasından çıkarıldı (Faz O devamı). _pvRenderMainCal'in kendisi
// pvWiz/pvActiveMsId/pvGoalId/pvCalView/goals gibi çok sayıda paylaşılan
// duruma bare eriştiği için ÇIKARILAMADI (bkz. faz notları) — ama onun saf
// veri-hazırlama (_pvComputeMainCalData) ve saf HTML-üretim (_pvBuildMainCalCellsHtml)
// katmanları SADECE pvCalYear/pvCalMonth/pvSelectedDate'e bağımlı, hepsinin de
// window.__getPvCalYear/__getPvCalMonth/__getPvSelectedDate köprüsü zaten var.
// FocusStorage → zaten global (window.FocusStorage), bare referans yeterli.

function _pvComputeMainCalData(g) {
    const pvCalYear  = window.__getPvCalYear();
    const pvCalMonth = window.__getPvCalMonth();
    const today    = new Date();
    const firstDay = new Date(pvCalYear, pvCalMonth, 1);
    const lastDate = new Date(pvCalYear, pvCalMonth + 1, 0).getDate();
    const startDow = (firstDay.getDay() + 6) % 7; // Monday-first
    const monthLbl = firstDay.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    const cat      = getCat(g.category);

    const msDateMap = {};
    (g.milestones || []).forEach(m => {
        if (!m.due_date || _pvIsMirrorMs(m)) return;
        const d = new Date(m.due_date);
        const key = d.toISOString().split('T')[0];
        msDateMap[key] = m;
    });

    const allTasks = FocusStorage.get('tasks', []);
    const taskMap  = {};
    allTasks.filter(t => String(t.parentGoal) === String(g.id)).forEach(t => {
        if (!t.date) return;
        const key = _normYMD(t.date); // normalize DD-MM-YYYY → YYYY-MM-DD
        if (!taskMap[key]) taskMap[key] = [];
        taskMap[key].push(t);
    });

    const dlDateStr = g.deadline ? new Date(g.deadline).toISOString().split('T')[0] : null;
    const dayNames  = ['Pt','Sa','Ça','Pe','Cu','Ct','Pz'];

    const conflictDates = g.lpa_id
        ? new Set(_pvRecomputeUnresolvedConflicts(g).flatMap(c => [_normYMD(c.lesson.date), _normYMD(c.own.date)]))
        : new Set();

    const RANGE_COLORS = ['#7c6eff','#ef476f','#06d6a0','#ffd166','#ff9f43','#60a5fa'];
    const rangeMap = {};
    (g.milestones || []).forEach((m, mi) => {
        if (_pvIsMirrorMs(m)) return;
        if (!m.start_date && !m.due_date) return;
        const start = m.start_date || m.due_date;
        const end   = m.due_date   || m.start_date;
        if (!start || !end) return;
        const rangeColor = RANGE_COLORS[mi % RANGE_COLORS.length];
        const s = new Date(start + 'T00:00:00');
        const e = new Date(end   + 'T00:00:00');
        for (let cur = new Date(s); cur <= e; cur.setDate(cur.getDate() + 1)) {
            const key = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
            rangeMap[key] = {
                ms: m, msIdx: mi, color: rangeColor,
                isStart: key === start,
                isEnd:   key === end,
            };
        }
    });

    return { today, firstDay, lastDate, startDow, monthLbl, cat, msDateMap, taskMap, dlDateStr, dayNames, conflictDates, rangeMap };
}
window._pvComputeMainCalData = _pvComputeMainCalData;

function _pvBuildMainCalCellsHtml(calData) {
    const esc = window.esc;
    const pvCalYear      = window.__getPvCalYear();
    const pvCalMonth     = window.__getPvCalMonth();
    const pvSelectedDate = window.__getPvSelectedDate();
    const { today, lastDate, startDow, cat, msDateMap, taskMap, dlDateStr, conflictDates, rangeMap } = calData;
    const prevMonthLast = new Date(pvCalYear, pvCalMonth, 0).getDate();
    let cells = '';
    for (let i = 0; i < startDow; i++) {
        const d = prevMonthLast - startDow + 1 + i;
        const prevY = pvCalMonth === 0 ? pvCalYear - 1 : pvCalYear;
        const prevM = pvCalMonth === 0 ? 12 : pvCalMonth;
        const dateStr = `${prevY}-${String(prevM).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        cells += `<div class="pg-pv-main-cal-cell other-month past">
            <div class="pg-pv-main-cal-day-num">${d}</div>
        </div>`;
    }

    const todayStr = today.toISOString().split('T')[0];

    for (let d = 1; d <= lastDate; d++) {
        const dateStr  = `${pvCalYear}-${String(pvCalMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const isToday  = dateStr === todayStr;
        const isPast   = dateStr < todayStr;
        const isSel    = dateStr === pvSelectedDate;
        const ms       = msDateMap[dateStr];
        const dayTasks = taskMap[dateStr] || [];
        const isDl     = dateStr === dlDateStr;
        const rangeInfo = rangeMap[dateStr];
        const isBusyDay = !isPast && _pvIsBusyDay(dateStr);
        const isConflictDay = !isPast && conflictDates.has(dateStr);

        const taskN = dayTasks.length;
        let heatBg = '';
        if (taskN >= 1 && !isPast && !rangeInfo) {
            const alpha = Math.min(0.08 + taskN * 0.07, 0.45);
            heatBg = `color-mix(in srgb,${cat.color} ${Math.round(alpha*100)}%,transparent)`;
        }

        let extraCls = '';
        if (isToday)  extraCls += ' today';
        if (isPast)   extraCls += ' past';
        if (isSel)    extraCls += ' selected';
        if (isDl)     extraCls += ' deadline-day';
        if (ms)       extraCls += ' ms-day';
        if (taskN)    extraCls += ' has-tasks';
        if (isBusyDay) extraCls += ' pg-pv-cal-day-busy';
        if (isConflictDay) extraCls += ' pg-pv-cal-day-conflict';
        if (taskN >= 1 && !isPast && !rangeInfo) extraCls += ' heat-day';

        let rangeColorAttr = '';
        let rangeEdge  = '';
        if (rangeInfo) {
            extraCls  += ' ms-range';
            if (rangeInfo.isStart && rangeInfo.isEnd) extraCls += ' range-only';
            else if (rangeInfo.isStart) extraCls += ' range-start';
            else if (rangeInfo.isEnd)   extraCls += ' range-end';
            else                        extraCls += ' range-mid';
            rangeColorAttr = ` data-range-color="${esc(rangeInfo.color)}"`;
            if (rangeInfo.isEnd && rangeInfo.ms.title) {
                rangeEdge = `<div class="pg-pv-range-end-label" data-edge-color="${esc(rangeInfo.color)}">${esc(rangeInfo.ms.title.slice(0,12))}</div>`;
            }
        }

        const dotsHtml = ms
            ? `<div class="pg-pv-main-cal-dot" title="${esc(ms.title)}"></div>`
            : '';

        const msLabel = (ms && !rangeInfo?.isEnd)
            ? `<div class="pg-pv-main-cal-ms-label">${esc(ms.title.slice(0,14))}</div>`
            : '';

        const taskCount = dayTasks.length
            ? `<div class="pg-pv-main-cal-task-count">${dayTasks.length} görev</div>`
            : '';

        const heatAttr = heatBg ? ` data-heat-bg="${esc(heatBg)}"` : '';
        const cellStyle = `${rangeColorAttr}${heatAttr}`;

        if (isPast) {
            cells += `<div class="pg-pv-main-cal-cell${extraCls}" ${cellStyle}>
                <div class="pg-pv-main-cal-day-num">${d}</div>
                ${rangeEdge}
                <div class="pg-pv-main-cal-dots">${dotsHtml}</div>
            </div>`;
        } else {
            cells += `<div class="pg-pv-main-cal-cell${extraCls}" data-cal-date="${dateStr}" ${cellStyle} ${isConflictDay ? 'title="Bu günde saat çakışması var"' : (isBusyDay ? 'title="Öğrenci bu gün dolu"' : '')}>
                <div class="pg-pv-main-cal-day-num">${d}</div>
                ${isConflictDay ? '<i class="ti ti-alert-triangle pg-pv-cal-day-conflict-icon"></i>' : (isBusyDay ? '<i class="ti ti-lock pg-pv-cal-day-busy-icon"></i>' : '')}
                ${rangeEdge || msLabel}
                ${taskCount}
                <div class="pg-pv-main-cal-dots">${dotsHtml}</div>
            </div>`;
        }
    }

    const totalCells = startDow + lastDate;
    const remaining  = totalCells % 7 ? 7 - (totalCells % 7) : 0;
    const nextY = pvCalMonth === 11 ? pvCalYear + 1 : pvCalYear;
    const nextM = pvCalMonth === 11 ? 0 : pvCalMonth + 1;
    for (let d = 1; d <= remaining; d++) {
        const dateStr = `${nextY}-${String(nextM+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const isPastNext = dateStr < todayStr;
        cells += `<div class="pg-pv-main-cal-cell other-month${isPastNext ? ' past' : ''}" ${isPastNext ? '' : `data-jump-date="${dateStr}" data-jump-year="${nextY}" data-jump-month="${nextM}"`}>
            <div class="pg-pv-main-cal-day-num">${d}</div>
        </div>`;
    }
    return cells;
}
window._pvBuildMainCalCellsHtml = _pvBuildMainCalCellsHtml;

export { _pvComputeMainCalData, _pvBuildMainCalCellsHtml };
