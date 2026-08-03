import { getCat } from './planning-utils.js';
import { _normYMD } from './planning-wizard.js';
import { _pvTimeToMin, _pvFmtDuration, _pvWeekTotalMins } from './planning-plan-view-time-utils.js';
import { _pvRenderStepper } from './planning-plan-header.js';
import { _pvBroadcastWizState } from './planning-wizard.js';
// planning.js dosyasından çıkarıldı (Faz O devamı). pvWiz/pvActiveMsId/pvGoalId/goals
// hepsi window.__getPvWiz/__setPvWiz, window.__getPvActiveMsId/__setPvActiveMsId,
// window.__getPvGoalId, window._pgGetGoals köprüleri üzerinden erişiliyor; persistGoals/
// toast/esc/_pvRenderMainCal zaten window üzerinden köprülü (bkz. planning-wizard.js
// üst yorumu). FocusStorage → zaten global (window.FocusStorage), bare referans yeterli.

function _pvRenderPlanSummary(g, container) {
    const esc = window.esc;
    const cat    = getCat(g.category);
    const msList = g.milestones || [];
    const allTasks = FocusStorage.get('tasks', []).filter(t => String(t.parentGoal) === String(g.id));
    const goalTasks = allTasks.filter(t => {
        const d = _normYMD(t.date);
        return msList.some(m => d >= (m.start_date||'') && d <= (m.due_date||'')) || true;
    });

    let totalMins = 0;
    goalTasks.forEach(t => {
        if (t.timeStart && t.timeEnd) {
            const d = _pvTimeToMin(t.timeEnd) - _pvTimeToMin(t.timeStart);
            if (d > 0) totalMins += d;
        }
    });

    const msRows = msList.map((m, i) => {
        const mTasks = allTasks.filter(t => { const d = _normYMD(t.date); return d >= (m.start_date||'') && d <= (m.due_date||''); });
        const mMins  = _pvWeekTotalMins(allTasks, m.start_date||'', m.due_date||'');
        const dur    = _pvFmtDuration(mMins);
        return `<div class="pvwiz-summary-ms-row">
            <span class="pvwiz-summary-ms-num">${i+1}</span>
            <span class="pvwiz-summary-ms-title">${esc(m.title.slice(0,22))}</span>
            <span class="pvwiz-summary-ms-stat">${mTasks.length} görev${dur ? ' · ' + dur : ''}</span>
        </div>`;
    }).join('');

    const totalDur = _pvFmtDuration(totalMins);

    container.innerHTML = `<div class="pvwiz-chat pvwiz-summary" id="pvwiz-summary">
        <div class="pvwiz-summary-glow"></div>
        <div class="pvwiz-summary-icon">${cat.icon}</div>
        <div class="pvwiz-summary-title">Harika! 🎉</div>
        <div class="pvwiz-summary-sub">"${esc(g.title.slice(0,30))}" hedefin planlandı</div>
        <div class="pvwiz-summary-stats">
            <div class="pvwiz-summary-stat-card">
                <div class="pvwiz-summary-stat-val">${goalTasks.length}</div>
                <div class="pvwiz-summary-stat-lbl">Toplam Görev</div>
            </div>
            <div class="pvwiz-summary-stat-card">
                <div class="pvwiz-summary-stat-val">${msList.length}</div>
                <div class="pvwiz-summary-stat-lbl">Aşama</div>
            </div>
            ${totalDur ? `<div class="pvwiz-summary-stat-card">
                <div class="pvwiz-summary-stat-val">${totalDur}</div>
                <div class="pvwiz-summary-stat-lbl">Toplam Süre</div>
            </div>` : ''}
        </div>
        <div class="pvwiz-summary-ms-list">${msRows}</div>
        <button class="pvwiz-plan-next-ms-btn u-margin-top-12px" id="pvwiz-summary-done" >
            <i class="ti ti-rocket"></i> Başla!
        </button>
    </div>`;

    container.querySelectorAll('.pvwiz-summary-ms-num').forEach(el => {
        el.style.background = `color-mix(in srgb,${cat.color} 18%,transparent)`;
        el.style.color = cat.color;
    });
    const _glow = container.querySelector('.pvwiz-summary-glow');
    if (_glow) _glow.style.background = cat.color;
    container.querySelectorAll('.pvwiz-summary-stat-val').forEach(el => { el.style.color = cat.color; });
    container.querySelector('#pvwiz-summary-done')?.style.setProperty('--wiz-color', cat.color);

    container.querySelector('#pvwiz-summary-done')?.addEventListener('click', () => {
        const pvWiz = window.__getPvWiz();
        pvWiz.step   = 'done';
        window.__setPvActiveMsId(msList[0]?.id || null);
        const gFinal = window._pgGetGoals().find(x => x.id === window.__getPvGoalId());
        if (gFinal) gFinal._dirty = true;
        window.persistGoals();
        _pvBroadcastWizState();
        const gDone = gFinal || g;
        _pvRenderStepper(gDone);
        window._pvRenderMainCal(gDone);
        window.toast('🚀 Haydi başlayalım!');
    });
}

window._pvRenderPlanSummary = _pvRenderPlanSummary;
export { _pvRenderPlanSummary };
