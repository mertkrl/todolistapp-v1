// ─── DERS PLANI ÇAKIŞMA YÖNLENDİRME + MİLESTONE FORM KAYDI ─────────────────
// planning.js dosyasından çıkarıldı (Faz H "son duvar" turu). _lpaRouteToConflictEdit/
// _pvJumpToMonth/_pvJumpToWeekAtTask/saveMsForm — goals/pvCalYear/pvCalMonth/
// pvCalView/pvWeekCursor/detailGoalId gibi planning.js'in paylaşılan durumuna
// window.__get/__set köprüleri üzerinden erişiyor. planning.js'ten ÖNCE
// yüklenir (bkz. inline-module-loader.js).
import { _pvSelectDay } from './planning-week-day-cal-render.js';
import { _pvTimeToMin } from './planning-plan-view-time-utils.js';
import { hideMsForm } from './planning-plan-view-dom-fx.js';

export function _pvJumpToMonth(g, dateStr) {
    const [y, mo] = dateStr.split('-').map(Number);
    window.__setPvCalYear(y);
    window.__setPvCalMonth(mo - 1);
    window.__setPvCalView('month');
    // Önce seç (pvSelectedDate'i günceller), sonra ay gridini çiz — böylece hücre
    // "selected" vurgusuyla doğru günde açılır (bkz. _pvRenderMainCal isSel kontrolü).
    _pvSelectDay(g, dateStr);
    window._pvRenderMainCal(g);
}
window._pvJumpToMonth = _pvJumpToMonth;

// "Günün Görevleri" listesindeki çakışma uyarı ikonuna tıklayınca haftalık görünümde
// ilgili günün/saatin olduğu hücreye atlar (o hücre zaten pg-pv-hcal-cell-conflict ile
// yanıp söner, bkz. _pvConflictHourSetFor).
export function _pvJumpToWeekAtTask(g, t) {
    const dateStr = window._normYMD(t.date);
    const [y, mo, dd] = dateStr.split('-').map(Number);
    window.__setPvCalView('week');
    window.__setPvWeekCursor(new Date(y, mo - 1, dd));
    window._pvRenderMainCal(g);
    _pvSelectDay(g, dateStr);
    setTimeout(() => {
        const hour = t.timeStart ? Math.floor(_pvTimeToMin(t.timeStart) / 60) : null;
        const cell = hour !== null ? document.querySelector(`.pg-pv-hcal-cell[data-cal-date="${dateStr}"][data-hour="${hour}"]`) : null;
        cell?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
}
window._pvJumpToWeekAtTask = _pvJumpToWeekAtTask;

export function _lpaRouteToConflictEdit(newGoalId, conflicts) {
    const g = window._pgGetGoals().find(x => x.id === newGoalId);
    if (!g || typeof window.openPlanView !== 'function') return;
    const firstDate = conflicts.map(c => c.ms.due_date).find(Boolean);
    window.openPlanView(newGoalId);
    // Direkt hafta/gün saat gridine değil, aylık görünüme atla — kullanıcı önce
    // "Günün Görevleri" panelinden hangi günlerde çakışma olduğuna baksın, oradan
    // bir çakışan göreve tıklayıp haftalık görünüme geçsin (bkz. _pvJumpToWeekAtTask).
    if (firstDate) setTimeout(() => _pvJumpToMonth(g, firstDate), 60);
    window.toast('Çakışan saatleri düzenleyebilirsin — görevler sadece aynı gün içinde taşınabilir');
}
window._lpaRouteToConflictEdit = _lpaRouteToConflictEdit;

export function saveMsForm() {
    const title=(document.getElementById('pg-ms-title')?.value||'').trim();
    if (!title) { document.getElementById('pg-ms-title')?.focus(); return; }
    window.addMilestone(window._pgGetDetailGoalId(), {
        title,
        description: document.getElementById('pg-ms-desc')?.value||'',
        due_date:    document.getElementById('pg-ms-date')?.value||'',
    });
    hideMsForm();
}
window.saveMsForm = saveMsForm;
