import { getCat } from './planning-utils.js';
// ─── PLANVIEW İLERLEME ÇUBUĞU + KUTLAMA EFEKTİ + KÜÇÜK DOM YARDIMCILARI ────
// planning.js dosyasından çıkarıldı (Faz O, dördüncü + altıncı dilim): bir
// dizi bağımsız DOM-efekti/yardımcı fonksiyonu. Hiçbiri planning.js'in
// goals/dependencies gibi paylaşılan durumuna dokunmuyor.
import { _pvFindFreeSlot } from './planning-plan-view-time-utils.js';

function _pvUpdateOverallProgress(g) {
    const el  = document.getElementById('pg-pv-overall-progress');
    if (!el) return;
    const ms  = g.milestones || [];
    const cat = getCat(g.category);
    const pct = g.progress_pct || 0;
    const done = ms.filter(m => m.done).length;
    el.innerHTML = `
        <div class="pg-pv-overall-label">
            <span>Genel İlerleme</span>
            <span class="pg-pv-overall-count">${done}/${ms.length} · ${pct}%</span>
        </div>
        <div class="pg-pv-overall-track">
            <div class="pg-pv-overall-fill"></div>
        </div>`;
    el.querySelector('.pg-pv-overall-count').style.color = cat.color;
    const fillEl = el.querySelector('.pg-pv-overall-fill');
    fillEl.style.width = pct + '%';
    fillEl.style.background = cat.color;
}

function _pvCelebrate(full) {
    const colors = ['#ffd166','#4ade80','#7c6eff','#ef476f','#60a5fa','#D4900E'];
    for (let i = 0; i < (full ? 16 : 8); i++) {
        const p = document.createElement('div');
        p.className = 'pg-pv-sparkle';
        const x = Math.random() * window.innerWidth;
        const y = full ? Math.random() * window.innerHeight : window.innerHeight * 0.4 + Math.random() * 200;
        const size = 6 + Math.random() * 8;
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        p.style.width = size + 'px';
        p.style.height = size + 'px';
        p.style.background = colors[i%colors.length];
        p.style.animation = 'pg-pv-sparkle-anim .8s ease forwards';
        p.style.transformOrigin = 'center';
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 900);
    }
}

// ── Milestone hızlı-ekleme formu aç/kapat (Hedef Detay Paneli, PlanView değil) ──
// Faz O altıncı dilimde eklendi — bu dosyaya taşınan diğerleriyle aynı
// sınıftan (DOM-only, closure state'e dokunmuyor).
function showMsForm() {
    const form=document.getElementById('pg-ms-form'); if (!form) return;
    form.classList.remove('hidden');
    const inp=document.getElementById('pg-ms-title');
    if (inp) { inp.value=''; setTimeout(()=>inp.focus(), 80); }
    const desc=document.getElementById('pg-ms-desc'); if (desc) desc.value='';
    const dateEl=document.getElementById('pg-ms-date'); if (dateEl) dateEl.value='';
}

function hideMsForm() { document.getElementById('pg-ms-form')?.classList.add('hidden'); }

// g.lpa_id varsa (öğrencinin kabul ettiği ders planı) o günün TÜM kendi
// görevlerini döndürür (kendi çakışmasını görebilsin), yoksa sadece bu
// hedefe ait görevleri.
function _pvGoalTasksOn(g, dateStr) {
    const all = FocusStorage.get('tasks', []);
    if (g.lpa_id) return all.filter(t => _normYMD(t.date) === dateStr);
    return all.filter(t => String(t.parentGoal) === String(g.id) && _normYMD(t.date) === dateStr);
}

function _pvHighlightTaskInList(taskId) {
    const row = document.querySelector(`#pg-pv-day-tasks-list [data-day-task="${taskId}"]`);
    if (!row) return;
    row.classList.remove('pg-pv-task-pulse');
    void row.offsetWidth; // reflow — animasyonu yeniden tetikler
    row.classList.add('pg-pv-task-pulse');
    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function _pvAutoFillTime(dateStr) {
    const tasks = FocusStorage.get('tasks', []);
    const slot  = _pvFindFreeSlot(tasks, dateStr);
    const startInp = document.getElementById('pg-pv-day-time-start');
    const endInp   = document.getElementById('pg-pv-day-time-end');
    const hint     = document.getElementById('pg-pv-day-auto-hint');
    if (startInp) startInp.value = slot.start;
    if (endInp)   endInp.value   = slot.end;
    if (hint)     hint.style.display = '';
}

// ── Stub: keep old names callable (no-op) ─
function _pvRenderCenter() {}
function _pvRenderTeam() {}

// Faz O: gerçek export (planning.js bu dosyadan ÖNCE yüklendiği için güvenli
// — bkz. inline-module-loader.js).
export {
    _pvUpdateOverallProgress, _pvCelebrate, showMsForm, hideMsForm,
    _pvGoalTasksOn, _pvHighlightTaskInList, _pvAutoFillTime,
    _pvRenderCenter, _pvRenderTeam
};
