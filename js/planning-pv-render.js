import { _pvUpdateOverallProgress } from './planning-plan-view-dom-fx.js';

export function _pvRender(g) {
    document.getElementById('pg-plan-view')?.classList.toggle('pg-pv-readonly', window.__getPvReadOnly());
    window._pvRenderHeader(g);
    window._pvRenderStepper(g);
    window._pvRenderMainCal(g);
    window._pvRenderDayPanel(g, window.__getPvSelectedDate());
    _pvUpdateOverallProgress(g);
}
window._pvRender = _pvRender;
