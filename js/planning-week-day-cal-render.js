// ─── PLANVIEW HAFTALIK/GÜNLÜK SAAT GRİDİ RENDER + GEZİNME + SÜRÜKLE-BIRAK ──
// planning.js dosyasından çıkarıldı: ders planı takviminin hafta/gün
// görünümlerini çizen, aralarında gezinen ve görev sürükle-bırakını bağlayan
// fonksiyonlar. pvWeekCursor/pvDayCursor planning.js'in closure'ında kalıyor
// (başka bare call site'lar da onları kullanıyor) — window.__getPvWeekCursor/
// __setPvWeekCursor/__getPvDayCursor/__setPvDayCursor köprüleriyle erişiliyor.
// _pvRenderDayPanel planning.js'te kalıyor, bu dosyadan SONRA yüklendiği
// için window.* köprüsüyle çağrılıyor (bkz. inline-module-loader.js).
// _pvMoveTaskToSlot artık bu dosyaya taşındı (window._pvIsLessonPlan/
// window.persistGoals/window.FocusStorage/window._normYMD/window.toast
// köprülerini kullanıyor).
import { _pvCalSwitchInline, _pvBindCalSwitch, _pvHourGridHead, _pvTimeToMinLocal, _pvRenderTaskChips } from './planning-hourgrid-render.js';
import { _pvIsBusyHour, _pvBindBusyToggle } from './planning-lesson-plan-busy-slots.js';
import { _pvConflictHourSetFor, _pvHasUnresolvedConflicts, _pvUpdateConflictBanner, _pvIsDateLocked } from './planning-lesson-plan-conflicts.js';
import { _pvGoalTasksOn, _pvHighlightTaskInList } from './planning-plan-view-dom-fx.js';
import { _pvApplyTaskChipStyles, _pvMirrorTaskToMilestone } from './planning-lesson-plan-mirror.js';
import { _dstrLocal } from './planning-plan-view-time-utils.js';

const PVC_HOUR_START = 0, PVC_HOUR_END = 23;

let _pvDragTaskId = null;

function _pvSelectDay(g, dateStr) {
    window.__setPvSelectedDate(dateStr);
    const msForDate = (g.milestones || []).find(m =>
        m.start_date && m.due_date && dateStr >= m.start_date && dateStr <= m.due_date);
    if (msForDate) window.__setPvActiveMsId(msForDate.id);
    window._pvRenderDayPanel(g, dateStr);
    window._pvRenderStepper(g);
}

// Bir görevi bırakılan hücreye taşır. O hücrede zaten (kendisi hariç) tek bir
// görev varsa, üst üste binmek yerine ikisinin yeri/saati DEĞİŞ TOKUŞ edilir.
function _pvMoveTaskToSlot(taskId, dateStr, hour, g) {
    const tasks = window.FocusStorage.get('tasks', []);
    const t = tasks.find(x => String(x.id) === String(taskId));
    if (!t) return;
    // Çözülmemiş çakışması olan günlerdeki görevler başka bir güne taşınamaz —
    // sadece aynı gün içinde saat değişebilir (bkz. _pvIsDateLocked).
    if (dateStr !== window._normYMD(t.date) && _pvIsDateLocked(g, window._normYMD(t.date))) {
        if (typeof window.toast === 'function') window.toast('Bu görev çakışma çözülene kadar sadece aynı gün içinde taşınabilir');
        return;
    }
    const targetDateDD = (() => { const [y,mo,dd] = dateStr.split('-'); return `${dd}-${mo}-${y}`; })();

    const occupants = tasks.filter(x =>
        String(x.id) !== String(taskId) && String(x.parentGoal) === String(g.id) &&
        window._normYMD(x.date) === dateStr && x.timeStart && Math.floor(_pvTimeToMinLocal(x.timeStart)/60) === hour
    );

    if (occupants.length === 1) {
        // Değiş tokuş: iki görev birbirinin tarih+saatini alır
        const other = occupants[0];
        const tDate = t.date, tStart = t.timeStart, tEnd = t.timeEnd;
        t.date = other.date; t.timeStart = other.timeStart; t.timeEnd = other.timeEnd;
        other.date = tDate; other.timeStart = tStart; other.timeEnd = tEnd;
        // Sadece bu plana ait görevler g.milestones'a aynalanır — öğrencinin kendi
        // (yabancı) görevi bu ders planının aşama listesine karışmamalı.
        if (String(t.parentGoal) === String(g.id)) _pvMirrorTaskToMilestone(g, t.id, t.text, window._normYMD(t.date), t.timeStart, t.timeEnd);
        if (String(other.parentGoal) === String(g.id)) _pvMirrorTaskToMilestone(g, other.id, other.text, window._normYMD(other.date), other.timeStart, other.timeEnd);
    } else {
        // Hedef boş (ya da belirsiz/çok sayıda) — sadece taşı, süresi korunur
        const durMin = Math.max(30, _pvTimeToMinLocal(t.timeEnd || t.timeStart) - _pvTimeToMinLocal(t.timeStart || '0:00'));
        const newStartMin = hour * 60;
        const newEndMin = Math.min(newStartMin + durMin, 23*60 + 59);
        t.timeStart = `${String(hour).padStart(2,'0')}:00`;
        t.timeEnd   = `${String(Math.floor(newEndMin/60)).padStart(2,'0')}:${String(newEndMin%60).padStart(2,'0')}`;
        t.date = targetDateDD;
        if (String(t.parentGoal) === String(g.id)) _pvMirrorTaskToMilestone(g, t.id, t.text, dateStr, t.timeStart, t.timeEnd);
    }
    window.FocusStorage.set('tasks', tasks);
    if (window._pvIsLessonPlan(g)) window.persistGoals();
    if (typeof window.syncTasksFromStorage === 'function') window.syncTasksFromStorage();
    if (typeof window.renderCalendarGlobal === 'function') window.renderCalendarGlobal();
}
window._pvMoveTaskToSlot = _pvMoveTaskToSlot;

function _pvBindHourGridDrag(el, g) {
    el.querySelectorAll('.pg-pv-hcal-chip[data-day-task]').forEach(chip => {
        chip.addEventListener('click', e => {
            e.stopPropagation();
            const dateStr = chip.closest('[data-cal-date]')?.dataset.calDate;
            if (dateStr) _pvSelectDay(g, dateStr);
            setTimeout(() => _pvHighlightTaskInList(chip.dataset.dayTask), dateStr ? 60 : 0);
        });
        chip.addEventListener('dragstart', e => {
            _pvDragTaskId = chip.dataset.dayTask;
            e.dataTransfer.effectAllowed = 'move';
            chip.classList.add('dragging');
        });
        chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
    });
    el.querySelectorAll('.pg-pv-hcal-cell').forEach(cell => {
        cell.addEventListener('dragover', e => { e.preventDefault(); cell.classList.add('drag-over'); });
        cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
        cell.addEventListener('drop', e => {
            e.preventDefault();
            cell.classList.remove('drag-over');
            if (!_pvDragTaskId) return;
            const hadConflicts = _pvHasUnresolvedConflicts(g);
            _pvMoveTaskToSlot(_pvDragTaskId, cell.dataset.calDate, parseInt(cell.dataset.hour), g);
            _pvDragTaskId = null;
            if (hadConflicts && !_pvHasUnresolvedConflicts(g)) toast('Tüm çakışmalar çözüldü ✓', '#06d6a0');
            _pvUpdateConflictBanner(g);
            window._pvRenderMainCal(g);
            window._pvRenderDayPanel(g, window.__getPvSelectedDate());
        });
    });
}

function _pvBindHourGridNav(el, g, stepDays) {
    el.querySelector('#pg-pv-mcal-prev')?.addEventListener('click', () => {
        const cursor = window.__getPvCalView() === 'week' ? window.__getPvWeekCursor() : window.__getPvDayCursor();
        cursor.setDate(cursor.getDate() - stepDays);
        window._pvRenderMainCal(g);
    });
    el.querySelector('#pg-pv-mcal-next')?.addEventListener('click', () => {
        const cursor = window.__getPvCalView() === 'week' ? window.__getPvWeekCursor() : window.__getPvDayCursor();
        cursor.setDate(cursor.getDate() + stepDays);
        window._pvRenderMainCal(g);
    });
    el.querySelector('#pg-pv-mcal-today')?.addEventListener('click', () => {
        if (window.__getPvCalView() === 'week') window.__setPvWeekCursor(new Date()); else window.__setPvDayCursor(new Date());
        window._pvRenderMainCal(g);
    });
    el.querySelectorAll('[data-day-task]').forEach(chip => {
        chip.addEventListener('click', e => { e.stopPropagation(); _pvSelectDay(g, chip.closest('[data-cal-date]')?.dataset.calDate || _dstrLocal(window.__getPvDayCursor())); });
    });
    _pvBindBusyToggle(el, g);
}

function _pvRenderWeekCal(g) {
    const el = document.getElementById('pg-pv-main-cal');
    if (!el) return;
    const cursor = window.__getPvWeekCursor() || new Date();
    window.__setPvWeekCursor(cursor);
    const start = new Date(cursor); start.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
    const dayNames = ['Pt','Sa','Ça','Pe','Cu','Ct','Pz'];
    const todayStr = _dstrLocal(new Date());

    const dayCols = Array.from({length:7}, (_,i) => { const d = new Date(start); d.setDate(start.getDate()+i); return d; });

    let headerCells = '<div class="pg-pv-hcal-corner"></div>';
    dayCols.forEach((d,i) => {
        const dateStr = _dstrLocal(d);
        headerCells += `<div class="pg-pv-hcal-daycol-head${dateStr===todayStr?' today':''}">${dayNames[i]}<br>${d.getDate()}</div>`;
    });

    const conflictHours = _pvConflictHourSetFor(g);
    let rows = '';
    for (let h = PVC_HOUR_START; h <= PVC_HOUR_END; h++) {
        rows += `<div class="pg-pv-hcal-hourlabel">${String(h).padStart(2,'0')}:00</div>`;
        dayCols.forEach(d => {
            const dateStr = _dstrLocal(d);
            const tasks = _pvGoalTasksOn(g, dateStr).filter(t => t.timeStart && Math.floor(_pvTimeToMinLocal(t.timeStart)/60) === h);
            const busy = _pvIsBusyHour(dateStr, h);
            const conflict = conflictHours.has(`${dateStr}|${h}`);
            rows += `<div class="pg-pv-hcal-cell${busy?' pg-pv-hcal-cell-busy':''}${conflict?' pg-pv-hcal-cell-conflict':''}" data-cal-date="${dateStr}" data-hour="${h}" title="${conflict?'Çakışan saat — düzenlemen gerekiyor':(busy?'Öğrenci bu saatte dolu':'')}">
                ${conflict ? '<i class="ti ti-alert-triangle pg-pv-hcal-cell-conflict-icon"></i>' : (busy ? '<i class="ti ti-lock pg-pv-hcal-cell-busy-icon"></i>' : '')}
                ${_pvRenderTaskChips(tasks, g)}
            </div>`;
        });
    }

    const endD = new Date(start); endD.setDate(start.getDate() + 6);
    const label = `${start.getDate()} ${start.toLocaleDateString('tr-TR',{month:'short'})} – ${endD.getDate()} ${endD.toLocaleDateString('tr-TR',{month:'short'})}`;

    el.innerHTML = _pvHourGridHead(label, g) + `
        <div class="pg-pv-hcal-wrap">
            <div class="pg-pv-hcal-grid pg-pv-hcal-grid-week">${headerCells}${rows}</div>
        </div>`;
    _pvApplyTaskChipStyles(el);

    _pvBindHourGridNav(el, g, 7);
    _pvBindCalSwitch(el, g);
    _pvBindHourGridDrag(el, g);
    el.querySelectorAll('.pg-pv-hcal-cell').forEach(cell => {
        cell.addEventListener('click', e => {
            if (e.target.closest('[data-day-task]')) return;
            _pvSelectDay(g, cell.dataset.calDate);
            setTimeout(() => {
                const startInp = document.getElementById('pg-pv-day-time-start');
                const endInp   = document.getElementById('pg-pv-day-time-end');
                if (startInp) { startInp.value = `${String(cell.dataset.hour).padStart(2,'0')}:00`; }
                if (endInp)   { endInp.value = `${String(Math.min(parseInt(cell.dataset.hour)+1,23)).padStart(2,'0')}:00`; }
                document.getElementById('pg-pv-day-add-inp')?.focus();
            }, 50);
        });
    });
}

function _pvRenderDayCal(g) {
    const el = document.getElementById('pg-pv-main-cal');
    if (!el) return;
    const cursor = window.__getPvDayCursor() || new Date();
    window.__setPvDayCursor(cursor);
    const dateStr = _dstrLocal(cursor);
    const label = cursor.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
    const tasks = _pvGoalTasksOn(g, dateStr);
    const conflictHours = _pvConflictHourSetFor(g);

    let rows = '';
    for (let h = PVC_HOUR_START; h <= PVC_HOUR_END; h++) {
        const hourTasks = tasks.filter(t => t.timeStart && Math.floor(_pvTimeToMinLocal(t.timeStart)/60) === h);
        const busy = _pvIsBusyHour(dateStr, h);
        const conflict = conflictHours.has(`${dateStr}|${h}`);
        rows += `<div class="pg-pv-hcal-hourlabel">${String(h).padStart(2,'0')}:00</div>
            <div class="pg-pv-hcal-cell${busy?' pg-pv-hcal-cell-busy':''}${conflict?' pg-pv-hcal-cell-conflict':''}" data-cal-date="${dateStr}" data-hour="${h}" title="${conflict?'Çakışan saat — düzenlemen gerekiyor':(busy?'Öğrenci bu saatte dolu':'')}">
                ${conflict ? '<i class="ti ti-alert-triangle pg-pv-hcal-cell-conflict-icon"></i>' : (busy ? '<i class="ti ti-lock pg-pv-hcal-cell-busy-icon"></i>' : '')}
                ${_pvRenderTaskChips(hourTasks, g)}
            </div>`;
    }

    el.innerHTML = _pvHourGridHead(label, g) + `
        <div class="pg-pv-hcal-wrap">
            <div class="pg-pv-hcal-grid pg-pv-hcal-grid-day">${rows}</div>
        </div>`;
    _pvApplyTaskChipStyles(el);

    _pvBindHourGridNav(el, g, 1);
    _pvBindCalSwitch(el, g);
    _pvBindHourGridDrag(el, g);
    el.querySelectorAll('.pg-pv-hcal-cell').forEach(cell => {
        cell.addEventListener('click', e => {
            if (e.target.closest('[data-day-task]')) return;
            setTimeout(() => {
                const startInp = document.getElementById('pg-pv-day-time-start');
                const endInp   = document.getElementById('pg-pv-day-time-end');
                if (startInp) { startInp.value = `${String(cell.dataset.hour).padStart(2,'0')}:00`; }
                if (endInp)   { endInp.value = `${String(Math.min(parseInt(cell.dataset.hour)+1,23)).padStart(2,'0')}:00`; }
                document.getElementById('pg-pv-day-add-inp')?.focus();
            }, 50);
        });
    });
    _pvSelectDay(g, dateStr);
}

window._pvSelectDay = _pvSelectDay;
window._pvRenderWeekCal = _pvRenderWeekCal;
window._pvRenderDayCal = _pvRenderDayCal;
window._pvBindHourGridDrag = _pvBindHourGridDrag;
window._pvBindHourGridNav = _pvBindHourGridNav;

export { _pvSelectDay, _pvRenderWeekCal, _pvRenderDayCal, _pvBindHourGridDrag, _pvBindHourGridNav };
