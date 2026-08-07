import { _pvRenderWeekCal, _pvRenderDayCal } from './planning-week-day-cal-render.js';
import { _pvComputeMainCalData, _pvBuildMainCalCellsHtml } from './planning-main-cal-render.js';
import { _pvCalSwitchInline, _pvBindCalSwitch } from './planning-hourgrid-render.js';
import { _pvBusyToggleBtn, _pvBindBusyToggle } from './planning-lesson-plan-busy-slots.js';
import { _pvWizAssignDate } from './planning-wizard.js';

// planning.js dosyasından çıkarıldı (Faz devamı — dev fonksiyon refactoru).
// pvCalView/pvCalYear/pvCalMonth/pvSelectedDate/pvWiz/pvActiveMsId/goals/pvGoalId
// planning.js'in module-seviye state'i; hepsi zaten window.__get/__set ve
// window._pg* köprüleri üzerinden erişilebilir durumdaydı. _pvIsLessonPlan/
// _pvRenderDayPanel window.* üzerinden çağrılıyor (_pvRenderDayPanel artık
// planning-day-panel-events.js'te tanımlı).

window._pvRenderMainCal = _pvRenderMainCal; // planning-wizard.js için
function _pvRenderMainCal(g) {
    const el = document.getElementById('pg-pv-main-cal');
    if (!el) return;

    const pvCalView = window.__getPvCalView();
    if (window._pvIsLessonPlan(g) && pvCalView === 'week') return _pvRenderWeekCal(g);
    if (window._pvIsLessonPlan(g) && pvCalView === 'day')  return _pvRenderDayCal(g);

    const esc = window.esc;
    const calData = _pvComputeMainCalData(g);
    const { today, monthLbl, dayNames, cat } = calData;
    const cells = _pvBuildMainCalCellsHtml(calData);

    el.innerHTML = `
        <div class="pg-pv-main-cal-nav">
            <div class="u-display-flex_align-items-center_gap-8px">
                <button class="pg-pv-main-cal-nav-btn" id="pg-pv-mcal-prev"><i class="ti ti-chevron-left"></i></button>
                <div class="pg-pv-main-cal-month">${monthLbl}</div>
                <button class="pg-pv-main-cal-nav-btn" id="pg-pv-mcal-next"><i class="ti ti-chevron-right"></i></button>
            </div>
            <div class="u-display-flex_gap-6px_align-items-center">
                ${_pvCalSwitchInline(g)}
                <button class="pg-pv-main-cal-today-btn" id="pg-pv-mcal-today">Bugün</button>
                ${_pvBusyToggleBtn(g)}
            </div>
        </div>
        <div class="pg-pv-main-cal-grid">
            ${dayNames.map(d => `<div class="pg-pv-main-cal-hdr">${d}</div>`).join('')}
            ${cells}
        </div>`;

    el.querySelectorAll('.pg-pv-main-cal-dot').forEach(dot => { dot.style.background = cat.color; });
    el.querySelectorAll('.pg-pv-main-cal-ms-label').forEach(lbl => {
        lbl.style.color = cat.color;
        lbl.style.background = `color-mix(in srgb,${cat.color} 12%,transparent)`;
    });
    el.querySelectorAll('[data-range-color]').forEach(cell => {
        cell.style.setProperty('--range-color', cell.dataset.rangeColor);
    });
    el.querySelectorAll('[data-heat-bg]').forEach(cell => {
        cell.style.setProperty('--heat-bg', cell.dataset.heatBg);
    });
    el.querySelectorAll('[data-edge-color]').forEach(edge => {
        edge.style.color = edge.dataset.edgeColor;
    });

    _pvBindCalSwitch(el, g);
    _pvBindBusyToggle(el, g);
    el.querySelector('#pg-pv-mcal-prev')?.addEventListener('click', () => {
        let pvCalMonth = window.__getPvCalMonth(), pvCalYear = window.__getPvCalYear();
        pvCalMonth--; if (pvCalMonth < 0) { pvCalMonth = 11; pvCalYear--; }
        window.__setPvCalMonth(pvCalMonth); window.__setPvCalYear(pvCalYear);
        _pvRenderMainCal(g);
    });
    el.querySelector('#pg-pv-mcal-next')?.addEventListener('click', () => {
        let pvCalMonth = window.__getPvCalMonth(), pvCalYear = window.__getPvCalYear();
        pvCalMonth++; if (pvCalMonth > 11) { pvCalMonth = 0; pvCalYear++; }
        window.__setPvCalMonth(pvCalMonth); window.__setPvCalYear(pvCalYear);
        _pvRenderMainCal(g);
    });
    // Wizard dates mode: show pulsing overlay hint on calendar
    const pvWiz = window.__getPvWiz();
    if (pvWiz?.step === 'dates') {
        const hint = document.createElement('div');
        hint.className = 'pvwiz-cal-overlay-hint';
        const g2 = window._pgGetGoals().find(x => x.id === window.__getPvGoalId()) || g;
        const cur = g2.milestones?.[pvWiz.dateIdx || 0];
        hint.innerHTML = `<i class="ti ti-hand-click"></i> <strong>${cur ? esc(cur.title.slice(0,22)) : ''}</strong> için tarih seç`;
        el.style.position = 'relative';
        el.appendChild(hint);
    }

    el.querySelector('#pg-pv-mcal-today')?.addEventListener('click', () => {
        window.__setPvCalYear(today.getFullYear());
        window.__setPvCalMonth(today.getMonth());
        const sel = today.toISOString().split('T')[0];
        window.__setPvSelectedDate(sel);
        _pvRenderMainCal(g);
        window._pvRenderDayPanel(g, sel);
    });

    // ── Öneri 1: Peer cursor overlays ───────────────────────
    if (window.PlanningCollab?.isActive()) {
        const peerState = window.PlanningCollab.getPeerState();
        Object.values(peerState).forEach(peer => {
            if (!peer.cursorDay) return;
            const peerCell = el.querySelector(`[data-cal-date="${peer.cursorDay}"]`);
            if (!peerCell) return;
            if (!peerCell.querySelector('.pg-pv-peer-cursor')) {
                const ov = document.createElement('div');
                ov.className = 'pg-pv-peer-cursor';
                ov.style.setProperty('--peer-color', peer.color || '#888');
                ov.title = `${peer.name} bu günde`;
                ov.innerHTML = `<span class="pg-pv-peer-avatar">${esc((peer.name||'?').slice(0,2).toUpperCase())}</span>`;
                peerCell.appendChild(ov);
            }
        });
    }

    el.querySelectorAll('[data-cal-date]').forEach(cell => {
        cell.addEventListener('click', () => {
            const dateStr = cell.dataset.calDate;
            const pvWiz2 = window.__getPvWiz();
            // If wizard is in dates step, route click there
            if (pvWiz2?.step === 'dates') {
                _pvWizAssignDate(g, dateStr);
                return;
            }
            window.__setPvSelectedDate(dateStr);
            el.querySelectorAll('[data-cal-date]').forEach(c => c.classList.remove('selected'));
            cell.classList.add('selected');
            // Sync stepper: activate the milestone whose range contains this date
            const msForDate = (g.milestones || []).find(m =>
                m.start_date && m.due_date &&
                dateStr >= m.start_date && dateStr <= m.due_date
            );
            if (msForDate) window.__setPvActiveMsId(msForDate.id);
            window._pvRenderDayPanel(g, dateStr);
            window._pvRenderStepper(g);
            // ── Öneri 1: Kursor günü broadcast ──────────────
            if (window.PlanningCollab?.isActive()) {
                const me = window.PlanningCollab._me();
                window.PlanningCollab.broadcast('cursor_day', {
                    dateStr, user_name: me.name, user_color: me.color
                });
            }
        });
    });

    // Next-month trailing cells — jump to next month
    el.querySelectorAll('[data-jump-date]').forEach(cell => {
        cell.style.cursor = 'pointer';
        cell.addEventListener('click', () => {
            window.__setPvCalYear(parseInt(cell.dataset.jumpYear));
            window.__setPvCalMonth(parseInt(cell.dataset.jumpMonth));
            window.__setPvSelectedDate(cell.dataset.jumpDate);
            _pvRenderMainCal(g);
            window._pvRenderDayPanel(g, cell.dataset.jumpDate);
        });
    });
}

export { _pvRenderMainCal };
