// planning-milestone-wizard-step1-form.js
// planning-milestone-wizard.js'ten çıkarıldı (Faz H/O devamı): Adım 1'deki form
// kontrolleri — başlık karakter sayacı, kategori kartları, öncelik butonları,
// hızlı bitiş tarihi seçici + süre ipucu. Bu fonksiyonlar SADECE birbirini çağırır
// ve wizardState.goal alanlarını okuyup yazar — wizardState canlı binding (export let)
// ile ana dosyadan import ediliyor (planning-milestone-wizard-cal.js'teki desenle aynı),
// gerçek ES modül olduğu için reassignment otomatik yansır, window.* köprüsü gerekmez.
// window.CATEGORIES zaten global olduğu için olduğu gibi bırakıldı.
import { wizardState } from './planning-milestone-wizard.js';

export function _wzBindCharCounter() {
    const inp   = document.getElementById('pg-wz-title');
    const count = document.getElementById('pg-wz-char-count');
    if (!inp || !count) return;
    const update = () => {
        const len = inp.value.length;
        count.textContent = len + '/80';
        count.style.color = len > 70 ? '#f87171' : len > 50 ? '#ffd166' : '#555';
    };
    update();
    if (!inp._wzCharBound) {
        inp._wzCharBound = true;
        inp.addEventListener('input', update);
    }
}

export function _wzRenderCatCards(currentCat) {
    const grid = document.getElementById('pg-wz-cat-grid');
    if (!grid) return;
    grid.innerHTML = window.CATEGORIES.map(cat => `
        <div class="pg-wz-cat-card${cat.id === currentCat ? ' selected' : ''}"
            data-cat="${cat.id}">
            <div class="pg-wz-cat-card-icon">${cat.icon}</div>
            <div class="pg-wz-cat-card-label">${cat.label}</div>
        </div>`
    ).join('');

    grid.querySelectorAll('.pg-wz-cat-card').forEach(card => {
        const catData = window.CATEGORIES.find(c => c.id === card.dataset.cat);
        if (catData) card.style.setProperty('--cat-color', catData.color);
    });

    grid.querySelectorAll('.pg-wz-cat-card').forEach(card => {
        card.addEventListener('click', () => {
            grid.querySelectorAll('.pg-wz-cat-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            const catId = card.dataset.cat;
            const hiddenInp = document.getElementById('pg-wz-category');
            if (hiddenInp) hiddenInp.value = catId;
            wizardState.goal.category = catId;
            _wzUpdateDurationHint(catId);
        });
    });
}

export function _wzRenderPriorityBtns(current) {
    const row = document.getElementById('pg-wz-priority-row');
    if (!row) return;
    const priorities = [
        { val: 1, label: 'Yüksek', emoji: '🔴', color: '#ef476f' },
        { val: 2, label: 'Orta',   emoji: '🟡', color: '#ffd166' },
        { val: 3, label: 'Düşük',  emoji: '🟢', color: '#4ade80' },
    ];
    row.innerHTML = priorities.map(p => `
        <button class="pg-wz-pri-btn${p.val === current ? ' selected' : ''}"
            data-pri="${p.val}" type="button">
            ${p.emoji} ${p.label}
        </button>`
    ).join('');
    row.querySelectorAll('.pg-wz-pri-btn').forEach(btn => {
        const p = priorities.find(pp => pp.val === parseInt(btn.dataset.pri));
        if (p) btn.style.setProperty('--pri-color', p.color);
    });
    row.querySelectorAll('.pg-wz-pri-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            row.querySelectorAll('.pg-wz-pri-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            const val = parseInt(btn.dataset.pri);
            const hiddenInp = document.getElementById('pg-wz-priority');
            if (hiddenInp) hiddenInp.value = val;
            wizardState.goal.priority = val;
        });
    });
}

export function _wzRenderDeadlineQuick() {
    const row = document.getElementById('pg-wz-deadline-quick');
    if (!row) return;
    const options = [
        { label: '1 Ay',  months: 1 },
        { label: '3 Ay',  months: 3 },
        { label: '6 Ay',  months: 6 },
        { label: '1 Yıl', months: 12 },
        { label: '2 Yıl', months: 24 },
    ];
    if (!row._wzBound) {
        row._wzBound = true;
        row.innerHTML = options.map(o =>
            `<button class="pg-wz-dl-btn" data-months="${o.months}" type="button">${o.label}</button>`
        ).join('');
        row.querySelectorAll('.pg-wz-dl-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const d = new Date();
                d.setMonth(d.getMonth() + parseInt(btn.dataset.months));
                const dateStr = d.toISOString().split('T')[0];
                const dateInp = document.getElementById('pg-wz-deadline');
                if (dateInp) { dateInp.value = dateStr; wizardState.goal.deadline = dateStr; }
                row.querySelectorAll('.pg-wz-dl-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                _wzUpdateDurationHint(wizardState.goal.category);
            });
        });
    }
    // Sync selected state with current deadline value
    _wzSyncDeadlineQuickSelected();
}

export function _wzSyncDeadlineQuickSelected() {
    const row = document.getElementById('pg-wz-deadline-quick');
    const deadline = wizardState?.goal?.deadline;
    if (!row || !deadline) return;
    const options = [
        { months: 1 }, { months: 3 }, { months: 6 }, { months: 12 }, { months: 24 },
    ];
    row.querySelectorAll('.pg-wz-dl-btn').forEach((btn, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() + options[i].months);
        const expected = d.toISOString().split('T')[0];
        btn.classList.toggle('selected', expected === deadline);
    });
}

export function _wzUpdateDurationHint(cat) {
    const hints = {
        egitim: '· Önerilen: 6-12 ay',
        saglik: '· Önerilen: 3-6 ay',
        kariyer: '· Önerilen: 6-18 ay',
        finans: '· Önerilen: 12-24 ay',
        kisisel: '· Önerilen: 1-6 ay',
        diger: '· Önerilen: 1-6 ay',
    };
    const el = document.getElementById('pg-wz-duration-hint');
    if (el) el.textContent = hints[cat] || '';
}
