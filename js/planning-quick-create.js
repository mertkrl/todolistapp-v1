// ═══════════════════════════════════════════
// HIZLI HEDEF OLUŞTUR
// planning.js dosyasından çıkarıldı (Faz 2, 2026-07-19 — yüksek risk grubu).
//
// _qcSave, çekirdek `goals` dizisine yazıyor (goals.unshift) — bu dizi
// planning.js'te kalıyor (yüzlerce başka yerde okunup yazılıyor), sadece
// getPgGoals() ile referans olarak alınıyor (dizi referans tipi
// olduğu için unshift/find gibi mutasyon metodları normal çalışıyor).
//
// Diğer bağımlılıklar (hepsi planning.js'te kalıyor, window.* köprüsüyle
// açıldı): uid, persistGoals, render, openPlanView (zaten açıktı), toast,
// openWizard, _qcStartCollab (Collab akışı — Collab Wait Overlay'e kadar
// uzandığı için kapsam dışı bırakıldı, sadece köprülendi).
import { getPgGoals, persistGoals, qcStartCollab, toast, uid, openPlanView } from './planning.js';

const QC_CATEGORIES = [
    { id: 'egitim',  label: 'Eğitim',  icon: '🧠', color: '#7c6eff' },
    { id: 'saglik',  label: 'Sağlık',  icon: '💪', color: '#ef476f' },
    { id: 'kariyer', label: 'Kariyer', icon: '💼', color: '#06d6a0' },
    { id: 'kisisel', label: 'Kişisel', icon: '🌱', color: '#ff9f43' },
    { id: 'diger',   label: 'Diğer',   icon: '✨', color: '#a78bfa' },
];

let _qcState = { category: 'egitim', deadline: '', mode: 'solo' };

function openQuickCreate(mode) {
    const overlay = document.getElementById('pg-quick-create-overlay');
    if (!overlay) { window.openWizard(); return; }

    // Full reset every time
    const today = new Date().toISOString().split('T')[0];
    _qcState = { category: 'egitim', deadline: today, mode: mode || 'solo' };

    // Clear title input
    const titleInp = document.getElementById('pg-qc-title');
    if (titleInp) { titleInp.value = ''; titleInp._qcBound = false; }

    // Reset date input
    const dateInp = document.getElementById('pg-qc-deadline');
    if (dateInp) {
        dateInp.value = today;
        dateInp.min   = today;
        dateInp._qcBound = false;
        if (dateInp._flatpickr) {
            dateInp._flatpickr.set('minDate', today);
            dateInp._flatpickr.setDate(today, true);
        }
    }

    // Reset quick-deadline buttons
    const dlRow = document.getElementById('pg-qc-dl-row');
    if (dlRow) { dlRow._qcBound = false; dlRow.innerHTML = ''; }

    // Reset char counter
    const charEl = document.getElementById('pg-qc-char');
    if (charEl) charEl.textContent = '0/80';

    // Reset event-bound flags for close/create/wizard buttons
    const closeBtn  = document.getElementById('pg-qc-close');
    const createBtn = document.getElementById('pg-qc-create-btn');
    if (closeBtn)  closeBtn._qcBound  = false;
    if (createBtn) { createBtn._qcBound = false; createBtn.disabled = false; }

    overlay.classList.remove('hidden');
    _qcRender();
    setTimeout(() => document.getElementById('pg-qc-title')?.focus(), 80);
}
window.openQuickCreate = openQuickCreate;

function closeQuickCreate() {
    document.getElementById('pg-quick-create-overlay')?.classList.add('hidden');
}
window.closeQuickCreate = closeQuickCreate;

function _qcRender() {
    // Category chips
    const catRow = document.getElementById('pg-qc-cat-row');
    if (catRow) {
        catRow.innerHTML = QC_CATEGORIES.map(c => `
            <div class="pg-qc-cat-chip${c.id === _qcState.category ? ' selected' : ''}"
                data-qc-cat="${c.id}">
                <span>${c.icon}</span> ${c.label}
            </div>`).join('');
        catRow.querySelectorAll('.pg-qc-cat-chip').forEach(chip => {
            const cat = QC_CATEGORIES.find(c => c.id === chip.dataset.qcCat);
            if (cat) chip.style.setProperty('--cat-color', cat.color);
            chip.addEventListener('click', () => {
                catRow.querySelectorAll('.pg-qc-cat-chip').forEach(c => c.classList.remove('selected'));
                chip.classList.add('selected');
                _qcState.category = chip.dataset.qcCat;
                document.getElementById('pg-qc-category').value = _qcState.category;
            });
        });
    }

    // Deadline quick buttons
    const dlRow = document.getElementById('pg-qc-dl-row');
    if (dlRow && !dlRow._qcBound) {
        dlRow._qcBound = true;
        const opts = [
            { label: '1 Ay', months: 1 }, { label: '3 Ay', months: 3 },
            { label: '6 Ay', months: 6 }, { label: '1 Yıl', months: 12 },
        ];
        dlRow.innerHTML = opts.map(o =>
            `<button class="pg-qc-dl-btn" data-months="${o.months}" type="button">${o.label}</button>`
        ).join('');
        dlRow.querySelectorAll('.pg-qc-dl-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const d = new Date();
                d.setMonth(d.getMonth() + parseInt(btn.dataset.months));
                const dateStr = d.toISOString().split('T')[0];
                const dateInp = document.getElementById('pg-qc-deadline');
                if (dateInp) {
                    dateInp.value = dateStr;
                    if (dateInp._flatpickr) dateInp._flatpickr.setDate(dateStr, true);
                }
                _qcState.deadline = dateStr;
                dlRow.querySelectorAll('.pg-qc-dl-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        });
    }

    // Date input — today as default + min = today
    const dateInp = document.getElementById('pg-qc-deadline');
    if (dateInp) {
        const today = new Date().toISOString().split('T')[0];
        dateInp.min = today;
        if (dateInp._flatpickr) dateInp._flatpickr.set('minDate', today);
        if (!dateInp.value) {
            dateInp.value = today;
            if (dateInp._flatpickr) dateInp._flatpickr.setDate(today, true);
        }
        if (!dateInp._qcBound) {
            dateInp._qcBound = true;
            dateInp.addEventListener('change', () => {
                _qcState.deadline = dateInp.value;
                document.querySelectorAll('.pg-qc-dl-btn').forEach(b => b.classList.remove('selected'));
            });
        }
    }

    // Char counter
    const titleInp = document.getElementById('pg-qc-title');
    const charEl   = document.getElementById('pg-qc-char');
    if (titleInp && charEl && !titleInp._qcBound) {
        titleInp._qcBound = true;
        titleInp.addEventListener('input', () => {
            const len = titleInp.value.length;
            charEl.textContent = len + '/80';
            charEl.style.color = len > 70 ? '#f87171' : '#444';
        });
        titleInp.addEventListener('keydown', e => {
            if (e.key === 'Enter') _qcSave();
        });
    }

    // Close btn
    const closeBtn = document.getElementById('pg-qc-close');
    if (closeBtn && !closeBtn._qcBound) {
        closeBtn._qcBound = true;
        closeBtn.addEventListener('click', closeQuickCreate);
    }

    // Overlay backdrop click
    const overlay = document.getElementById('pg-quick-create-overlay');
    if (overlay && !overlay._qcBound) {
        overlay._qcBound = true;
        overlay.addEventListener('click', e => { if (e.target === overlay) closeQuickCreate(); });
    }

    // Create button — text depends on mode
    const createBtn = document.getElementById('pg-qc-create-btn');
    if (createBtn) {
        if (_qcState.mode === 'collab') {
            createBtn.innerHTML = '🤝 Davet Gönder <i class="ti ti-arrow-right"></i>';
        } else {
            createBtn.innerHTML = 'Başlat <i class="ti ti-arrow-right"></i>';
        }
        if (!createBtn._qcBound) {
            createBtn._qcBound = true;
            createBtn.addEventListener('click', _qcSave);
        }
    }

    // Collab mode badge in header
    const qcSub = document.querySelector('.pg-qc-sub');
    if (qcSub) {
        qcSub.innerHTML = _qcState.mode === 'collab'
            ? '<span class="pg-qc-collab-badge">🤝 Ortaklaşa Mod</span>'
            : 'Neyi başarmak istiyorsun?';
    }

}
window._qcRender = _qcRender;

function _qcSave() {
    const titleInp = document.getElementById('pg-qc-title');
    const title    = titleInp?.value.trim();
    if (!title) {
        titleInp?.classList.add('error');
        titleInp?.focus();
        setTimeout(() => titleInp?.classList.remove('error'), 500);
        toast('Hedef başlığı zorunludur');
        return;
    }

    const cat     = QC_CATEGORIES.find(c => c.id === _qcState.category) || QC_CATEGORIES[0];
    const newGoal = {
        id: uid(), title,
        description: '',
        category: cat.id, color: cat.color,
        deadline: _qcState.deadline || '', priority: 2,
        status: 'active', progress_pct: 0, milestones: [],
        work_days: [], hours_per_week: 5, context: {},
        created_at: new Date().toISOString(), _dirty: true,
    };

    if (_qcState.mode === 'collab') {
        // Collab modda hedef _pending_collab ile kaydedilir — DB FK'si sağlanır
        // ama render()'da gösterilmez; davet kabul edilince aktif hale gelir
        newGoal._pending_collab = true;
        getPgGoals().unshift(newGoal);
        persistGoals();
        closeQuickCreate();
        qcStartCollab(newGoal);
    } else {
        getPgGoals().unshift(newGoal);
        persistGoals();
        window.render();
        closeQuickCreate();
        toast('Hedef oluşturuldu! 🎯');
        setTimeout(() => openPlanView(newGoal.id), 250);
    }
}
window._qcSave = _qcSave;
