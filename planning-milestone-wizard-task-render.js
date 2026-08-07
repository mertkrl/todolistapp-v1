// planning-milestone-wizard.js'ten çıkarıldı: Adım 4 akordeon görev listesi/kapasite
// çubuğu için saf HTML üretici + renk uygulayıcı yardımcı fonksiyonlar. Hepsi sadece
// kendi parametreleri (subs/cat/root/contentEl) üzerinde çalışır, wizardState'e dokunmaz.
import { fmtShort } from './planning-utils.js';

export function _wzRenderCapacityBar(subs, cat) {
    const total = subs.length;
    if (!total) return '';
    const doneCount = subs.filter(s => s.done).length;
    const pct = Math.round((doneCount / total) * 100);
    const filledSegs = Math.min(8, Math.round((doneCount / total) * 8));
    const segsHtml = Array.from({length:8},(_,i)=>
        `<div class="pg-wz-s4-capacity-seg${i<filledSegs?' filled':''}"></div>`
    ).join('');
    return `
        <div class="pg-wz-s4-capacity-row">
            <span class="pg-wz-s4-capacity-label">İlerleme</span>
            <div class="pg-wz-s4-capacity-segs">${segsHtml}</div>
            <span class="pg-wz-s4-capacity-val">${doneCount} / ${total} · %${pct}</span>
        </div>`;
}

export function _wzApplyCapacityColors(root, cat) {
    root.querySelectorAll('.pg-wz-s4-capacity-seg.filled').forEach(seg => { seg.style.background = cat.color; });
    const valEl = root.querySelector('.pg-wz-s4-capacity-val');
    if (valEl) valEl.style.color = cat.color;
}

export function _wzRenderAccTaskItems(subs, cat) {
    if (!subs.length) return `<div class="pg-wz-s4-task-empty"><i class="ti ti-clipboard" aria-hidden="true"></i> Henüz görev yok</div>`;
    return subs.map((st, i) => `
        <div class="pg-wz-s4-task-item${st.done?' done':''}">
            <div class="pg-wz-s4-task-check${st.done?' done':''}" data-check="${i}">
                ${st.done?`<i class="ti ti-check u-color-hfff_font-size-11px" aria-hidden="true"></i>`:''}
            </div>
            ${st.timeStart ? `<span class="pg-wz-s4-task-time-badge">${st.timeStart}${st.timeEnd ? `–${st.timeEnd}` : ''}</span>` : ''}
            <span class="pg-wz-s4-task-title">${window.esc(st.title)}</span>
            ${st.date ? `<span class="pg-wz-s4-task-date-badge">${fmtShort(st.date)}</span>` : ''}
            <button class="pg-wz-s4-task-del" data-del="${i}" type="button"><i class="ti ti-x" aria-hidden="true"></i></button>
        </div>`
    ).join('');
}

export function _wzApplyAccTaskItemColors(root, cat) {
    root.querySelectorAll('.pg-wz-s4-task-check').forEach(chk => {
        if (chk.classList.contains('done')) {
            chk.style.background = cat.color;
            chk.style.borderColor = cat.color;
        } else {
            chk.style.borderColor = cat.color + '66';
        }
    });
    root.querySelectorAll('.pg-wz-s4-task-date-badge').forEach(badge => {
        badge.style.color = cat.color;
        badge.style.background = cat.color + '18';
    });
}

export function _wzApplyAccContentColors(contentEl, cat, subs) {
    const covEl = contentEl.querySelector('.pg-wz-s4-workload-cov');
    if (covEl) covEl.style.color = cat.color;
    const iconEl = contentEl.querySelector('.pg-wz-s4-task-section-label > i');
    if (iconEl) iconEl.style.color = cat.color;
    const addBtn = contentEl.querySelector('.pg-wz-s4-add-task-btn');
    if (addBtn) addBtn.style.background = cat.color;
    contentEl.querySelectorAll('.pg-wz-s4-sug-chip').forEach(chip => {
        if (chip.classList.contains('selected')) {
            chip.style.background = cat.color + '20';
            chip.style.borderColor = cat.color;
            chip.style.color = cat.color;
        }
    });
    _wzApplyCapacityColors(contentEl, cat);
    _wzApplyAccTaskItemColors(contentEl, cat);
}
