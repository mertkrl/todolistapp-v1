import { fmtDate, getCat, progressRing } from './planning-utils.js';
// ─── HEDEF DETAY PANELİ: İLERLEME HESAPLAMA + ÖZET RENDER ─────────────────
// planning.js dosyasından çıkarıldı (Faz O, altıncı dilim): hedef detay
// panelinin (goal card açılınca görünen panel — PlanView'in DIŞINDA, ana
// "Hedefler" sekmesindeki) ilerleme yüzdesi hesaplama ve özet render
// fonksiyonları. Hiçbiri planning.js'in goals/dependencies gibi paylaşılan
// durumuna dokunmuyor — parametre olarak verilen `g` (goal) nesnesini
// okuyup (bazen üzerine yazıp) DOM'u güncelliyorlar.
//
// window.refreshDetailSummary/window._initDetailProgress/window._recalcProgress
// köprüleri KORUNDU — planning-realtime.js bunları window.* üzerinden çağırıyor
// (bkz. o dosyanın üst yorumu). `esc` planning.js'te kalıyor (çok geniş
// kullanımlı bir çekirdek yardımcı, bu turda dokunulmadı) — bu yüzden burada
// window.esc üzerinden çağrılıyor.

function _recalcProgress(g) {
    const ms = g.milestones || [];
    if (ms.length > 0) g.progress_pct = Math.round(ms.filter(m=>m.done).length / ms.length * 100);
    if (g.progress_pct === 100 && ms.length > 0) g.status = 'completed';
    else if (g.status === 'completed' && g.progress_pct < 100) g.status = 'active';
}
window._recalcProgress = _recalcProgress;

function refreshDetailSummary(g) {
    const esc = window.esc;
    const el=document.getElementById('pg-dp-summary'); if (!el) return;
    const cat=getCat(g.category), st=window.STATUS_META[g.status]||window.STATUS_META.active, pct=g.progress_pct||0;
    const ms=g.milestones||[];
    el.innerHTML=`
    <div class="pg-dp-goal-top">
        <div>
            <span class="pg-cat-badge u-font-size-11px_padding-2px8px_border-radius-5px_display-in" >${cat.icon} ${cat.label}</span>
            <h2 class="pg-dp-goal-title">${esc(g.title)}</h2>
        </div>
        ${progressRing(pct,cat.color)}
    </div>
    ${g.description?`<p class="pg-dp-goal-desc">${esc(g.description)}</p>`:''}
    <div class="pg-dp-goal-meta">
        <span class="pg-dp-meta-item pg-dp-status-item">● ${st.label}</span>
        ${g.deadline?`<span class="pg-dp-meta-item"><i class="ti ti-calendar-due"></i> ${fmtDate(g.deadline)}</span>`:''}
        ${ms.length>0?`<span class="pg-dp-meta-item"><i class="ti ti-flag-3"></i> ${ms.filter(m=>m.done).length}/${ms.length} milestone</span>`:''}
    </div>`;
    const _catBadge = el.querySelector('.pg-cat-badge');
    if (_catBadge) {
        _catBadge.style.background = `${cat.color}22`;
        _catBadge.style.color = cat.color;
        _catBadge.style.border = `1px solid ${cat.color}44`;
    }
    const _statusItem = el.querySelector('.pg-dp-status-item');
    if (_statusItem) _statusItem.style.color = st.color;
}
window.refreshDetailSummary = refreshDetailSummary;

function _initDetailProgress(g) {
    const fill=document.getElementById('pg-dp-pfill');
    const pctEl=document.getElementById('pg-dp-ppct');
    const slider=document.getElementById('pg-dp-slider');
    const sliderV=document.getElementById('pg-dp-slider-val');
    const manualWrap=document.getElementById('pg-dp-manual-wrap');
    const autoLabel=document.getElementById('pg-dp-auto-label');
    const cat=getCat(g.category), pct=g.progress_pct||0;
    const hasMilestones=(g.milestones||[]).length>0;

    if (fill)   { fill.style.width=pct+'%'; fill.style.background=cat.color; }
    if (pctEl)  pctEl.textContent=pct+'%';
    if (slider) slider.value=pct;
    if (sliderV) sliderV.textContent=pct+'%';

    // Milestone varsa slider'ı gizle, otomatik mod etiketi göster
    if (manualWrap) manualWrap.style.display = hasMilestones ? 'none' : '';
    if (autoLabel)  autoLabel.style.display  = hasMilestones ? ''     : 'none';
    if (autoLabel) {
        autoLabel.innerHTML = `<i class="ti ti-robot"></i> Otomatik · Milestone tamamlandıkça güncellenir`;
        const _robotIcon = autoLabel.querySelector('.ti-robot');
        if (_robotIcon) _robotIcon.style.color = cat.color;
    }
}
window._initDetailProgress = _initDetailProgress;

// Faz O: gerçek export (planning.js bu dosyadan ÖNCE yüklendiği için güvenli
// — bkz. inline-module-loader.js).
export { _recalcProgress, refreshDetailSummary, _initDetailProgress };
