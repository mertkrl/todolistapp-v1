// planning-milestone-wizard-step2-count.js
// planning-milestone-wizard.js'ten çıkarıldı (Faz H devamı, 2. tur): Adım 2
// (dönüm noktası sayısı + isimleri) render/flush/liste yardımcıları. wizardState'e
// sadece PROPERTY bazlı erişiyor (reassignment yok), bu yüzden ana dosyadaki
// `export let wizardState` canlı binding'i üzerinden güvenle okunup/mutate edilebiliyor.
import { getCat, msUid } from './planning-utils.js';
import { wizardState } from './planning-milestone-wizard.js';
import { _wzBindInfoBtns } from './planning-wizard-info-tooltip.js';

// ── Milestone ikonları (sıra bazlı) ──────
const MS_ICONS = ['🚀','📌','🎯','⚡','🏆','🌟','💡','🔥','📍','⭐'];

export function _wzStep2Render() {
    _wzRenderCountSelector();
    _wzRenderMsNameInputs();
    setTimeout(_wzBindInfoBtns, 0);
}

function _wzRenderCountSelector() {
    const el = document.getElementById('pg-wz-count-selector');
    if (!el) return;
    // İlk açılışta varsayılan 3 aşama
    if (!wizardState.milestones.length) _wzEnsureMilestoneCount(3);

    const redraw = () => {
        const current = wizardState.milestones.length;
        el.innerHTML = [2, 3, 4, 5, 6, 7, 8].map(n =>
            `<button type="button" class="pg-wz-count-btn${n === current ? ' active' : ''}" data-count="${n}">${n}</button>`
        ).join('');
    };
    redraw();

    // Event delegation — daha sağlam
    if (!el._wzCountBound) {
        el._wzCountBound = true;
        el.addEventListener('click', e => {
            const btn = e.target.closest('.pg-wz-count-btn');
            if (!btn) return;
            _wzFlushMsInputs();
            _wzEnsureMilestoneCount(parseInt(btn.dataset.count));
            redraw();
            _wzRenderMsNameInputs();
        });
    }
}

function _wzEnsureMilestoneCount(n) {
    const current = wizardState.milestones.length;
    if (n > current) {
        for (let i = current; i < n; i++) {
            wizardState.milestones.push({
                id: msUid(), title: '', icon: MS_ICONS[i % MS_ICONS.length],
                _tpl: null, due_date: '', _weeks: 4,
            });
        }
    } else if (n < current) {
        wizardState.milestones.splice(n);
    }
}

export function _wzFlushMsInputs() {
    document.querySelectorAll('[data-ms-title-inp]').forEach(inp => {
        const idx = parseInt(inp.dataset.msTitleInp);
        if (wizardState.milestones[idx] !== undefined)
            wizardState.milestones[idx].title = inp.value;
    });
}

function _wzRenderMsNameInputs() {
    const el = document.getElementById('pg-wz-ms-inputs');
    if (!el) return;
    const cat = getCat(wizardState.goal.category);
    el.innerHTML = wizardState.milestones.map((m, i) => `
        <div class="pg-wz-ms-inp-row">
            <div class="pg-wz-ms-inp-num">${i + 1}</div>
            <span class="pg-wz-ms-inp-icon">${m.icon}</span>
            <input type="text" class="premium-input pg-wz-ms-title-inp"
                data-ms-title-inp="${i}"
                value="${window.esc(m.title)}"
                placeholder="Aşama ${i + 1} adı..."
                maxlength="60">
        </div>`
    ).join('');
    el.querySelectorAll('.pg-wz-ms-inp-num').forEach(numEl => {
        numEl.style.background = cat.color + '18';
        numEl.style.color = cat.color;
    });
    el.querySelectorAll('[data-ms-title-inp]').forEach(inp => {
        inp.addEventListener('input', () => {
            const idx = parseInt(inp.dataset.msTitleInp);
            if (wizardState.milestones[idx] !== undefined)
                wizardState.milestones[idx].title = inp.value;
        });
    });
    // Focus first empty
    const firstEmpty = el.querySelector('.pg-wz-ms-title-inp');
    if (firstEmpty && !firstEmpty.value) setTimeout(() => firstEmpty.focus(), 80);
}

// NOT: aşağıdaki fonksiyon hiçbir yerden çağrılmıyor (pre-existing, taşımadan
// önce de aynıydı) — muhtemelen _wzRenderMsNameInputs akışına geçilmeden önceki
// eski bir liste-tabanlı UI'nin kalıntısı. Davranış birebir korunarak taşındı.
function _wzRenderMsList() {
    const el     = document.getElementById('pg-wz-ms-list');
    const empty  = document.getElementById('pg-wz-ms-empty');
    const badge  = document.getElementById('pg-wz-ms-count-wrap');
    const ms     = wizardState.milestones;
    if (!el) return;

    // Count badge
    if (badge) {
        badge.innerHTML = ms.length
            ? `<div class="pg-wz-ms-count-badge"><i class="ti ti-flag-3"></i> ${ms.length} dönüm noktası seçildi</div>`
            : '';
    }

    if (!ms.length) {
        el.innerHTML = '';
        if (empty) empty.style.display = '';
        return;
    }
    if (empty) empty.style.display = 'none';

    el.innerHTML = ms.map((m, i) => `
        <div class="pg-wz-ms-item" data-wid="${m.id}">
            <div class="pg-wz-ms-num">${i + 1}</div>
            <div class="pg-wz-ms-icon">${m.icon}</div>
            <div class="pg-wz-ms-item-title">${window.esc(m.title)}</div>
            <div class="pg-wz-ms-item-actions">
                ${i > 0 ? `<button class="pg-icon-btn pg-wz-ms-up" data-wid="${m.id}" title="Yukarı" type="button"><i class="ti ti-arrow-up"></i></button>` : ''}
                ${i < ms.length - 1 ? `<button class="pg-icon-btn pg-wz-ms-dn" data-wid="${m.id}" title="Aşağı" type="button"><i class="ti ti-arrow-down"></i></button>` : ''}
                <button class="pg-icon-btn pg-wz-ms-del" data-wid="${m.id}" title="Kaldır" type="button"><i class="ti ti-x"></i></button>
            </div>
        </div>`
    ).join('');

    el.querySelectorAll('.pg-wz-ms-up').forEach(btn => btn.addEventListener('click', () => {
        const idx = ms.findIndex(m => m.id === btn.dataset.wid);
        if (idx > 0) { [ms[idx - 1], ms[idx]] = [ms[idx], ms[idx - 1]]; _wzRenderMsList(); }
    }));
    el.querySelectorAll('.pg-wz-ms-dn').forEach(btn => btn.addEventListener('click', () => {
        const idx = ms.findIndex(m => m.id === btn.dataset.wid);
        if (idx < ms.length - 1) { [ms[idx], ms[idx + 1]] = [ms[idx + 1], ms[idx]]; _wzRenderMsList(); }
    }));
    el.querySelectorAll('.pg-wz-ms-del').forEach(btn => btn.addEventListener('click', () => {
        const idx = ms.findIndex(m => m.id === btn.dataset.wid);
        if (idx !== -1) {
            const removed = ms.splice(idx, 1)[0];
            if (removed._tpl) {
                document.querySelector(`.pg-wz-chip[data-tpl="${removed._tpl}"]`)?.classList.remove('selected');
            }
            _wzRenderMsList();
        }
    }));
}
