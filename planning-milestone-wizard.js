// ─── PLANLAMA — HEDEF OLUŞTURMA SİHİRBAZI (5 Adım) ─────────────────────
// planning.js dosyasından çıkarıldı (Faz 2, 2026-07-20). Bireysel/ortak
// hedef oluşturmanın 5 adımlı sihirbazı: 1) temel bilgiler, 2) milestone
// sayısı/isimleri, 3) tarihleme (booking takvimi + mini gantt), 4) görev
// planlama (akordeon + günlük/haftalık/aylık takvim ızgarası), 5) özet +
// kaydet. Kendi modal state'i (wizardState, _wzCalYear, _wzCalMonth) bu
// dosyaya taşındı — planning.js'in başka hiçbir yerinde kullanılmıyordu.
//
// ÖNEMLİ: closeWizard/_wzNext/_wzBack planning.js'in init() fonksiyonunda
// SENKRON olarak addEventListener'a bağlanıyor, bu yüzden bu dosya
// index.html'de/inline-module-loader.js'de planning.js'ten ÖNCE
// yüklenmeli (bkz. Faz 2 metodolojisi — Bağımlılık Grafiği/Ders Planı
// Modalı/Realtime'da da aynı tuzak doğrulandı).
//
// Dış bağımlılıklar (planning.js'te kalıyor, window.* köprüsüyle açıldı):
// - goals → window._pgGetGoals() (referans — unshift/for-of çalışır,
//   bu modülde reassignment yok)
// - esc, toast, uid, persistGoals, render, openPlanView, openGoalModal → window.*
// - window.addGlobalTask / window.PlanningCollab / FocusStorage /
//   window.msUid / window.getCat / window.fmtDate / window.fmtShort →
//   zaten global
//
// Bu dosyanın İÇİNDEKİ tüm _wz* yardımcı fonksiyonları (adım render'ları,
// takvim çizimleri, vb.) birbirini DOĞRUDAN çağırır (window.* köprüsü
// gerekmez) — sadece planning.js'in dışarıdan çağırdığı openWizard/
// closeWizard/_wzNext/_wzBack window'a bağlanıyor.

import {
    _wzPlannerCalHTML, _wzAllDaysInRange, _wzWeekdaysInRange, _wzWeekendsInRange,
    _wzAllWeeksInRange, _wzAllMonthsInRange, _wzPlanToolbar, _wzDailyCalHTML,
    _wzWeeklyCalHTML, _wzMonthlyCalHTML, _wzBindPlannerCal,
} from './planning-milestone-wizard-cal.js';

export let wizardState  = null;
let _wzCalYear   = new Date().getFullYear();
let _wzCalMonth  = new Date().getMonth();

function openWizard() {
    const modal = document.getElementById('pg-wizard-modal');
    if (!modal) { window.openGoalModal(); return; }
    wizardState = {
        step: 1,
        goal: { title: '', category: 'egitim', priority: 2, deadline: '', motivation: '',
                work_days: [], hours_per_week: 5, context: {} },
        milestones: [],
        msDet: {},
        firstMsDetail: { hours_per_week: 5, resources: '', subtasks: [] },
        mode: 'solo',
        planMode: null,
        s4MsIdx: 0,
    };
    _wzCalYear  = new Date().getFullYear();
    _wzCalMonth = new Date().getMonth();
    modal.classList.remove('hidden');
    _wzRenderStep(1);
    setTimeout(() => document.getElementById('pg-wz-title')?.focus(), 150);
}
window.openWizard = openWizard;

function closeWizard() {
    document.getElementById('pg-wizard-modal')?.classList.add('hidden');
    wizardState = null;
}
window.closeWizard = closeWizard;

function _wzRenderStep(step, goingBack) {
    if (!wizardState) return;
    wizardState.step = step;

    // Step indicator dots
    document.querySelectorAll('.pg-wz-step-item').forEach(el => {
        const n = parseInt(el.dataset.wstep);
        el.classList.toggle('active', n === step);
        el.classList.toggle('done',   n < step);
    });
    document.querySelectorAll('.pg-wz-step-line').forEach((el, i) => {
        el.classList.toggle('done', i + 1 < step);
    });

    // Show body with direction-aware animation
    document.querySelectorAll('.pg-wz-step-body').forEach(el => {
        el.classList.remove('active', 'going-back');
    });
    const activeBody = document.getElementById('pg-wz-s' + step);
    if (activeBody) {
        activeBody.classList.add('active');
        if (goingBack) activeBody.classList.add('going-back');
    }

    // Counter
    const counter = document.getElementById('pg-wz-step-counter');
    if (counter) counter.textContent = 'ADIM ' + step + ' / 5';

    // Back button
    const backBtn = document.getElementById('pg-wz-back');
    if (backBtn) backBtn.style.visibility = step > 1 ? 'visible' : 'hidden';

    // Next button
    const nextBtn = document.getElementById('pg-wz-next');
    if (nextBtn) {
        nextBtn.innerHTML = step === 5
            ? '<i class="ti ti-rocket"></i> Başlat!'
            : 'İleri <i class="ti ti-arrow-right"></i>';
    }

    // Header sub
    const subs = [
        'Hedefini tanımla',
        'Dönüm noktalarına böl',
        'Tarihlere yerleştir',
        'İlk aşamayı detaylandır',
        'Her şey hazır!',
    ];
    const subEl = document.getElementById('pg-wz-header-sub');
    if (subEl) subEl.textContent = step + '. adım: ' + subs[step - 1];

    // Render content
    const renders = [null, _wzStep1Render, _wzStep2Render, _wzStep3Render, _wzStep4Render, _wzStep5Render];
    renders[step]?.();
}

function _wzValidate(step) {
    if (step === 1) {
        const title = document.getElementById('pg-wz-title')?.value.trim();
        if (!title) {
            window.toast('Hedef başlığı zorunludur');
            document.getElementById('pg-wz-title')?.focus();
            document.getElementById('pg-wz-title')?.classList.add('pg-wz-error-shake');
            setTimeout(() => document.getElementById('pg-wz-title')?.classList.remove('pg-wz-error-shake'), 500);
            return false;
        }
        wizardState.goal.title      = title;
        wizardState.goal.category   = document.getElementById('pg-wz-category')?.value || 'egitim';
        wizardState.goal.priority   = parseInt(document.getElementById('pg-wz-priority')?.value) || 2;
        wizardState.goal.deadline   = document.getElementById('pg-wz-deadline')?.value || '';
        wizardState.goal.motivation = document.getElementById('pg-wz-motivation')?.value.trim() || '';
        // Save mode
        wizardState.mode = document.querySelector('.pg-wz-mode-toggle-btn.selected')?.dataset.mode || 'solo';
        // Collab: block if no one has accepted yet
        if (wizardState.mode === 'collab') {
            const pending = JSON.parse(localStorage.getItem('_wz_pending_collab') || '{}');
            const session = wizardState._tempInviteCode ? pending[wizardState._tempInviteCode] : null;
            const hasAccepted = (session?.members || []).some(m => m.accepted) || wizardState._collabAccepted;
            if (!hasAccepted) {
                window.toast('Ortaklaşa modda en az bir kişinin daveti kabul etmesi gerekiyor 🤝');
                _wzRefreshCollabMembers();
                return false;
            }
        }
        return true;
    }
    if (step === 2) {
        _wzFlushMsInputs();
        // Boş kalan aşamaları otomatik isimlendir
        wizardState.milestones.forEach((m, i) => {
            if (!m.title.trim()) m.title = `Aşama ${i + 1}`;
        });
        if (!wizardState.milestones.length) {
            window.toast('En az bir aşama ekleyin');
            return false;
        }
        return true;
    }
    if (step === 3) {
        // Son milestone'u deadline'a kilitle (4. adıma geçmeden önce)
        const deadline = wizardState.goal.deadline;
        const msList   = wizardState.milestones;
        if (deadline && msList.length > 0) {
            msList[msList.length - 1].due_date = deadline;
        }
        return true;
    }
    if (step === 4) {
        // Flush current milestone criteria
        const curMs = wizardState.milestones[wizardState.s4MsIdx || 0];
        if (curMs) _wzFlushS4Details(curMs);
        return true;
    }
    return true;
}

function _wzNext() {
    if (!wizardState) return;
    if (!_wzValidate(wizardState.step)) return;
    if (wizardState.step < 5) _wzRenderStep(wizardState.step + 1, false);
    else _wzSave();
}
window._wzNext = _wzNext;

function _wzBack() {
    if (!wizardState || wizardState.step <= 1) return;
    _wzRenderStep(wizardState.step - 1, true);
}
window._wzBack = _wzBack;

// ── Step 1 ────────────────────────────────
function _wzStep1Render() {
    const g = wizardState.goal;

    // Title
    const titleInp = document.getElementById('pg-wz-title');
    if (titleInp) titleInp.value = g.title;
    _wzBindCharCounter();

    // Category cards
    _wzRenderCatCards(g.category);

    // Priority buttons
    _wzRenderPriorityBtns(g.priority);

    // Deadline quick buttons
    _wzRenderDeadlineQuick();

    // Deadline value — show today as default if empty
    const dlInp = document.getElementById('pg-wz-deadline');
    if (dlInp) {
        if (!g.deadline) {
            g.deadline = new Date().toISOString().split('T')[0];
            wizardState.goal.deadline = g.deadline;
        }
        dlInp.value = g.deadline;
        if (!dlInp._wzDeadlineBound) {
            dlInp._wzDeadlineBound = true;
            dlInp.addEventListener('change', () => {
                wizardState.goal.deadline = dlInp.value;
                _wzSyncDeadlineQuickSelected();
                _wzUpdateDurationHint(wizardState.goal.category);
            });
        }
    }

    // Motivation
    const motInp = document.getElementById('pg-wz-motivation');
    if (motInp) motInp.value = g.motivation || '';

    // Duration hint
    _wzUpdateDurationHint(g.category);

    // Bind info buttons (step 1)
    setTimeout(_wzBindInfoBtns, 0);

    // Mode toggle (solo / collab)
    const toggleBtns = document.querySelectorAll('.pg-wz-mode-toggle-btn');
    const currentMode = wizardState.mode || 'solo';
    toggleBtns.forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.mode === currentMode);
        if (!btn._wzModeBound) {
            btn._wzModeBound = true;
            btn.addEventListener('click', () => {
                toggleBtns.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                wizardState.mode = btn.dataset.mode;
                _wzUpdateModeHint();
            });
        }
    });
    _wzUpdateModeHint();
}

// ── Info Tooltip Sistemi → planning-wizard-info-tooltip.js dosyasına taşındı ──────────────

function _wzUpdateModeHint() {
    const hint = document.getElementById('pg-wz-mode-toggle-hint');
    if (hint) {
        if (wizardState?.mode === 'collab') {
            hint.textContent = 'Arkadaşlarınla gerçek zamanlı birlikte takip edin';
            hint.style.color = '#7c6eff';
        } else {
            hint.textContent = 'Kendi planını kendi hızında ilerlet';
            hint.style.color = '#555';
        }
    }
    const invArea = document.getElementById('pg-wz-collab-invite-area');
    if (invArea) {
        if (wizardState?.mode === 'collab') { invArea.classList.add('visible'); _wzInitCollabInvite(); }
        else invArea.classList.remove('visible');
    }
}

// ── Wizard Collab Invite ─────────────────
function _wzInitCollabInvite() {
    if (wizardState._collabInviteInit) {
        _wzRefreshCollabMembers();
        return;
    }
    wizardState._collabInviteInit = true;

    // Generate a temporary invite code stored in wizardState
    if (!wizardState._tempInviteCode) {
        wizardState._tempInviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
        // Store pending collab session in localStorage so others can "join" via invite flow
        const pending = JSON.parse(localStorage.getItem('_wz_pending_collab') || '{}');
        pending[wizardState._tempInviteCode] = {
            code: wizardState._tempInviteCode,
            created: Date.now(),
            members: [],
        };
        localStorage.setItem('_wz_pending_collab', JSON.stringify(pending));
    }

    const codeBox = document.getElementById('pg-wz-collab-code-box');
    if (codeBox) codeBox.textContent = wizardState._tempInviteCode;

    const copyBtn = document.getElementById('pg-wz-collab-copy-btn');
    if (copyBtn && !copyBtn._wzBound) {
        copyBtn._wzBound = true;
        copyBtn.addEventListener('click', () => {
            const url = window.location.href.split('?')[0] + '?collab_invite=' + wizardState._tempInviteCode;
            navigator.clipboard.writeText(url).then(() => {
                copyBtn.textContent = 'Kopyalandı!';
                setTimeout(() => { copyBtn.textContent = 'Kopyala'; }, 1800);
            }).catch(() => {
                copyBtn.textContent = wizardState._tempInviteCode;
            });
        });
    }

    const refreshBtn = document.getElementById('pg-wz-collab-refresh-btn');
    if (refreshBtn && !refreshBtn._wzBound) {
        refreshBtn._wzBound = true;
        refreshBtn.addEventListener('click', _wzRefreshCollabMembers);
    }

    _wzRefreshCollabMembers();
}

function _wzRefreshCollabMembers() {
    const listEl = document.getElementById('pg-wz-collab-members-list');
    if (!listEl || !wizardState?._tempInviteCode) return;
    const pending = JSON.parse(localStorage.getItem('_wz_pending_collab') || '{}');
    const session = pending[wizardState._tempInviteCode] || { members: [] };
    const members = session.members || [];
    if (!members.length) {
        listEl.innerHTML = '<div style="font-size:12px;color:#555;">Henüz katılan yok…</div>';
    } else {
        listEl.innerHTML = members.map(m => `
            <div class="pg-wz-collab-member-item">
                <div class="pg-wz-collab-member-avatar">${window.esc((m.name||'?')[0].toUpperCase())}</div>
                <span>${window.esc(m.name || m.email || 'Kullanıcı')}</span>
                <span class="pg-wz-collab-member-status ${m.accepted ? 'accepted' : 'pending'}">
                    ${m.accepted ? 'Kabul etti' : 'Bekleniyor'}
                </span>
            </div>`).join('');
    }
    // Also check via Supabase if available
    if (wizardState?._wzRoomId && window.PlanningCollab?.getMembers) {
        window.PlanningCollab.getMembers(wizardState._wzRoomId).then(dbMembers => {
            if (dbMembers?.length > 1) {
                // At least one non-owner member joined
                wizardState._collabAccepted = true;
                const members = dbMembers.filter(m => m.role !== 'owner');
                listEl.innerHTML = members.map(m => `
                    <div class="pg-wz-collab-member-item">
                        <div class="pg-wz-collab-member-avatar">${(m.user_id||'?')[0].toUpperCase()}</div>
                        <span>${window.esc(m.user_id)}</span>
                        <span class="pg-wz-collab-member-status accepted">Kabul etti</span>
                    </div>`).join('');
            }
        }).catch(() => {});
    }
}

function _wzBindCharCounter() {
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

function _wzRenderCatCards(currentCat) {
    const grid = document.getElementById('pg-wz-cat-grid');
    if (!grid) return;
    grid.innerHTML = window.CATEGORIES.map(cat => `
        <div class="pg-wz-cat-card${cat.id === currentCat ? ' selected' : ''}"
            data-cat="${cat.id}" style="--cat-color:${cat.color};">
            <div class="pg-wz-cat-card-icon">${cat.icon}</div>
            <div class="pg-wz-cat-card-label">${cat.label}</div>
        </div>`
    ).join('');

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

function _wzRenderPriorityBtns(current) {
    const row = document.getElementById('pg-wz-priority-row');
    if (!row) return;
    const priorities = [
        { val: 1, label: 'Yüksek', emoji: '🔴', color: '#ef476f' },
        { val: 2, label: 'Orta',   emoji: '🟡', color: '#ffd166' },
        { val: 3, label: 'Düşük',  emoji: '🟢', color: '#4ade80' },
    ];
    row.innerHTML = priorities.map(p => `
        <button class="pg-wz-pri-btn${p.val === current ? ' selected' : ''}"
            data-pri="${p.val}" style="--pri-color:${p.color};" type="button">
            ${p.emoji} ${p.label}
        </button>`
    ).join('');
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

function _wzRenderDeadlineQuick() {
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

function _wzSyncDeadlineQuickSelected() {
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

function _wzUpdateDurationHint(cat) {
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

// ── Step 2 ────────────────────────────────
// ── Milestone ikonları (sıra bazlı) ──────
const MS_ICONS = ['🚀','📌','🎯','⚡','🏆','🌟','💡','🔥','📍','⭐'];

function _wzStep2Render() {
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
                id: window.msUid(), title: '', icon: MS_ICONS[i % MS_ICONS.length],
                _tpl: null, due_date: '', _weeks: 4,
            });
        }
    } else if (n < current) {
        wizardState.milestones.splice(n);
    }
}

function _wzFlushMsInputs() {
    document.querySelectorAll('[data-ms-title-inp]').forEach(inp => {
        const idx = parseInt(inp.dataset.msTitleInp);
        if (wizardState.milestones[idx] !== undefined)
            wizardState.milestones[idx].title = inp.value;
    });
}

function _wzRenderMsNameInputs() {
    const el = document.getElementById('pg-wz-ms-inputs');
    if (!el) return;
    const cat = window.getCat(wizardState.goal.category);
    el.innerHTML = wizardState.milestones.map((m, i) => `
        <div class="pg-wz-ms-inp-row">
            <div class="pg-wz-ms-inp-num" style="background:${cat.color}18;color:${cat.color};">${i + 1}</div>
            <span class="pg-wz-ms-inp-icon">${m.icon}</span>
            <input type="text" class="premium-input pg-wz-ms-title-inp"
                data-ms-title-inp="${i}"
                value="${window.esc(m.title)}"
                placeholder="Aşama ${i + 1} adı..."
                maxlength="60">
        </div>`
    ).join('');
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

// ── Step 3 ────────────────────────────────
// ── Adım 3 — Booking Takvimi ─────────────
// Her dönüm noktası için ayrı renk paleti
const MS_RANGE_COLORS = [
    '#7c6eff', '#ef476f', '#06d6a0', '#ffd166',
    '#ff9f43', '#60a5fa', '#f472b6', '#34d399',
];

let _wzS3ActiveMs = 0;

// Dönüm noktalarının tarih aralıklarını hesapla
function _wzGetMsRanges() {
    const today    = new Date(); today.setHours(0,0,0,0);
    const deadline = wizardState.goal.deadline;
    const msList   = wizardState.milestones;
    const lastIdx  = msList.length - 1;
    const ranges   = [];

    msList.forEach((ms, i) => {
        const isLast = i === lastIdx;

        if (isLast && deadline) {
            // Son milestone: ancak önceki tüm milestone'ların tarihi bilindiyse aralığı çiz
            // (tek milestone ise başlangıç = bugün, o da olur)
            const prev = lastIdx > 0 ? msList[lastIdx - 1] : null;
            if (lastIdx > 0 && !prev?.due_date) return; // önceki henüz seçilmedi

            const start = prev?.due_date
                ? (() => { const d = new Date(prev.due_date); d.setDate(d.getDate() + 1); d.setHours(0,0,0,0); return d; })()
                : new Date(today);
            const end = new Date(deadline); end.setHours(0,0,0,0);
            if (start <= end) {
                ranges.push({ msIdx: i, ms, start, end, isLast: true, color: MS_RANGE_COLORS[i % MS_RANGE_COLORS.length] });
            }
            return;
        }

        // Ara milestone'lar: sadece due_date seçilmişse aralık çiz
        if (!ms.due_date) return;

        const prevWithDate = msList.slice(0, i).reverse().find(m => m.due_date);
        let start;
        if (prevWithDate?.due_date) {
            start = new Date(prevWithDate.due_date);
            start.setDate(start.getDate() + 1);
            start.setHours(0,0,0,0);
        } else {
            start = new Date(today);
        }
        const end = new Date(ms.due_date); end.setHours(0,0,0,0);
        if (start <= end) {
            ranges.push({ msIdx: i, ms, start, end, isLast: false, color: MS_RANGE_COLORS[i % MS_RANGE_COLORS.length] });
        }
    });
    return ranges;
}

function _wzStep3Render() {
    const deadline = wizardState.goal.deadline;
    const msList   = wizardState.milestones;
    const lastIdx  = msList.length - 1;

    // ÖNEMLİ: Son milestone'a burada due_date ATAMA.
    // Önceki milestone'lar seçildikçe son aralık otomatik belirir.
    // due_date sadece validate(3)'te set edilir.

    // Aktif = deadline varsa son hariç, yoksa hepsi seçilebilir
    const skipLast = !!deadline;
    const firstUnassigned = msList.findIndex((m, i) =>
        !m.due_date && (skipLast ? i < lastIdx : true)
    );
    _wzS3ActiveMs = firstUnassigned !== -1 ? firstUnassigned : 0;

    // Takvim her zaman bugünden (planın başlangıcından) açılır
    _wzCalYear  = new Date().getFullYear();
    _wzCalMonth = new Date().getMonth();

    _wzDrawBookingCal();
    _wzDrawBookingMsList();
    _wzRenderMiniGantt();
    _wzCheckConflicts();
}

function _wzDrawBookingCal() {
    const el = document.getElementById('pg-wz-booking-cal');
    if (!el) return;
    const m2yr = _wzCalMonth === 11 ? _wzCalYear + 1 : _wzCalYear;
    const m2mo = (_wzCalMonth + 1) % 12;
    const ranges = _wzGetMsRanges();

    el.innerHTML = `
        <div class="pg-wz-bcal-wrap">
            <div class="pg-wz-bcal-nav">
                <button class="pg-icon-btn pg-wz-bcal-prev-btn" type="button"><i class="ti ti-chevron-left"></i></button>
                <span class="pg-wz-bcal-nav-label">${new Date(_wzCalYear, _wzCalMonth).toLocaleDateString('tr-TR',{month:'long',year:'numeric'})} — ${new Date(m2yr, m2mo).toLocaleDateString('tr-TR',{month:'long',year:'numeric'})}</span>
                <button class="pg-icon-btn pg-wz-bcal-next-btn" type="button"><i class="ti ti-chevron-right"></i></button>
            </div>
            <div class="pg-wz-bcal-months">
                ${_wzRenderBookingMonth(_wzCalYear, _wzCalMonth, ranges)}
                ${_wzRenderBookingMonth(m2yr, m2mo, ranges)}
            </div>
        </div>`;

    el.querySelector('.pg-wz-bcal-prev-btn')?.addEventListener('click', () => {
        _wzCalMonth--; if (_wzCalMonth < 0) { _wzCalMonth = 11; _wzCalYear--; }
        _wzDrawBookingCal();
    });
    el.querySelector('.pg-wz-bcal-next-btn')?.addEventListener('click', () => {
        _wzCalMonth++; if (_wzCalMonth > 11) { _wzCalMonth = 0; _wzCalYear++; }
        _wzDrawBookingCal();
    });

    el.querySelectorAll('.pg-wz-bcal-day[data-date]').forEach(cell => {
        cell.addEventListener('click', () => {
            const dateStr = cell.dataset.date;
            if (!dateStr) return;
            const lastIdx  = wizardState.milestones.length - 1;
            const deadline = wizardState.goal.deadline;
            // Deadline varsa son milestone kilitli, yoksa o da seçilebilir
            if (deadline && _wzS3ActiveMs >= lastIdx) return;

            const ms = wizardState.milestones[_wzS3ActiveMs];
            if (!ms) return;

            // Aynı tarihe tekrar tıklanırsa seçimi kaldır
            if (ms.due_date === dateStr) {
                ms.due_date = '';
            } else {
                ms.due_date = dateStr;
                // Sonraki atanmamış milestone'a geç (son hariç)
                const nxt = wizardState.milestones.findIndex(
                    (m, i) => i > _wzS3ActiveMs && !m.due_date && (deadline ? i < lastIdx : true)
                );
                if (nxt !== -1) _wzS3ActiveMs = nxt;
            }
            _wzDrawBookingCal();
            _wzDrawBookingMsList();
            _wzRenderMiniGantt();
            _wzCheckConflicts();
        });
    });
}

function _wzRenderBookingMonth(year, month, ranges) {
    const today        = new Date(); today.setHours(0,0,0,0);
    const deadlineStr  = wizardState.goal.deadline;
    const deadlineDate = deadlineStr ? (() => { const d = new Date(deadlineStr); d.setHours(0,0,0,0); return d; })() : null;
    const firstDay = new Date(year, month, 1);
    const lastDate = new Date(year, month + 1, 0).getDate();
    const startDow = (firstDay.getDay() + 6) % 7; // Pzt=0
    const label    = firstDay.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    const dayHdrs  = ['Pt','Sa','Ça','Pe','Cu','Ct','Pz'];
    const deadlineDay = (() => {
        if (!deadlineStr) return null;
        const d = new Date(deadlineStr);
        return (d.getFullYear() === year && d.getMonth() === month) ? d.getDate() : null;
    })();

    let cells = '';
    // Boş hücreler (haftanın başına kadar)
    for (let i = 0; i < startDow; i++) cells += '<div class="pg-wz-bcal-day empty"></div>';

    for (let d = 1; d <= lastDate; d++) {
        const dateStr        = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const dateObj        = new Date(year, month, d);
        const isPast         = dateObj < today;
        const isAfterDl      = deadlineDate && dateObj > deadlineDate; // deadline sonrası
        const isOutOfRange   = isPast || isAfterDl;                    // seçilemeyen gün
        const isToday        = dateObj.getTime() === today.getTime();
        const dow            = (dateObj.getDay() + 6) % 7; // Pzt=0, Paz=6

        // Hangi aralıkta?
        let rng = null;
        for (const r of ranges) {
            if (dateObj >= r.start && dateObj <= r.end) { rng = r; break; }
        }

        let inlineStyle = '';
        let extraHtml   = '';
        let cls = 'pg-wz-bcal-day';
        if (isToday)    cls += ' today';
        if (isPast)     cls += ' past';
        if (isAfterDl)  cls += ' past'; // aynı görsel: soluk, tıklanamaz

        if (rng) {
            const isRangeStart = dateObj.getTime() === rng.start.getTime();
            const isRangeEnd   = dateObj.getTime() === rng.end.getTime();
            const isRowStart   = dow === 0; // Pazartesi
            const isRowEnd     = dow === 6; // Pazar

            // Kenar yuvarlamaları: aralık başı/sonu veya satır başı/sonu
            const roundL = isRangeStart || isRowStart;
            const roundR = isRangeEnd   || isRowEnd;
            let br;
            if (roundL && roundR) br = '8px';
            else if (roundL)      br = '8px 0 0 8px';
            else if (roundR)      br = '0 8px 8px 0';
            else                  br = '0';

            // Aralık sonu (due date): daha koyu, rozet göster
            const bgAlpha = isRangeEnd ? 'bb' : '2e';
            inlineStyle = `background:${rng.color}${bgAlpha};border-radius:${br};`;

            if (isRangeEnd) {
                cls += ' bcal-range-end';
                extraHtml = `<div class="pg-wz-bcal-ms-badge" style="background:${rng.color};">${rng.msIdx + 1}</div>`;
            }
            if (isRangeStart && !isRangeEnd) {
                cls += ' bcal-range-start';
                extraHtml = `<div class="pg-wz-bcal-range-flag" style="background:${rng.color};"></div>`;
            }
        } else if (deadlineDay === d) {
            cls += ' deadline';
            extraHtml = '<div class="pg-wz-bcal-dl-dot"></div>';
        }

        // Aktif aşamanın due date'i = imleç çerçevesi
        const activeMs = wizardState.milestones[_wzS3ActiveMs];
        if (activeMs?.due_date === dateStr) cls += ' active-ms';

        cells += `<div class="${cls}"${!isOutOfRange ? ` data-date="${dateStr}" role="button"` : ''} style="${inlineStyle}">
            <span class="pg-wz-bcal-d-num" style="${rng?.end.getTime()===dateObj.getTime()?`color:#fff;font-weight:800;`:''}">${d}</span>
            ${extraHtml}
        </div>`;
    }

    return `<div class="pg-wz-bcal-month">
        <div class="pg-wz-bcal-month-label">${label}</div>
        <div class="pg-wz-bcal-grid">
            ${dayHdrs.map(h=>`<div class="pg-wz-bcal-day-hdr">${h}</div>`).join('')}
            ${cells}
        </div>
    </div>`;
}

function _wzDrawBookingMsList() {
    const el       = document.getElementById('pg-wz-booking-ms-list');
    if (!el) return;
    const msList   = wizardState.milestones;
    const lastIdx  = msList.length - 1;
    const deadline = wizardState.goal.deadline; // "YYYY-MM-DD" string

    const hasDeadline = !!deadline;

    // Her milestone için başlangıç/bitiş tarih string'ini hesapla
    function getMsStartEnd(i) {
        // Başlangıç: i=0 ise bugün, değilse önceki milestone'un bitiş+1
        let startStr;
        if (i === 0) {
            startStr = new Date().toISOString().split('T')[0];
        } else {
            const prev = msList[i - 1];
            if (prev.due_date) {
                const d = new Date(prev.due_date);
                d.setDate(d.getDate() + 1);
                startStr = d.toISOString().split('T')[0];
            } else {
                startStr = null;
            }
        }
        // Bitiş: deadline varsa son milestone otomatik deadline, diğerleri due_date
        const endStr = (i === lastIdx && hasDeadline) ? deadline : msList[i].due_date;
        return { startStr, endStr };
    }

    // Tümü seçildi mi? (deadline varsa son hariç, yoksa hepsi)
    const allSet = hasDeadline
        ? msList.slice(0, lastIdx).every(m => m.due_date)
        : msList.every(m => m.due_date);
    let hint = '';
    if (allSet) {
        hint = `<div class="pg-wz-bms-hint done"><i class="ti ti-check"></i> Tüm bitiş tarihleri seçildi</div>`;
    } else {
        const activeMs = msList[_wzS3ActiveMs];
        const color    = MS_RANGE_COLORS[_wzS3ActiveMs % MS_RANGE_COLORS.length];
        hint = `<div class="pg-wz-bms-hint" style="border-color:${color}44;color:${color};">
            <i class="ti ti-calendar-event"></i>
            <strong>${window.esc(activeMs?.icon || '')} ${window.esc(activeMs?.title || '')}</strong> için bitiş tarihini seçin
        </div>`;
    }

    el.innerHTML = hint + `<div class="pg-wz-bms-chips">` +
        msList.map((m, i) => {
            const color      = MS_RANGE_COLORS[i % MS_RANGE_COLORS.length];
            const isLast     = i === lastIdx;
            const isAutoLast = isLast && hasDeadline; // kilitli son milestone
            const isActive   = (i === _wzS3ActiveMs) && !isAutoLast;
            const { startStr, endStr } = getMsStartEnd(i);

            // Aralık etiketi
            const startLabel = startStr ? window.fmtShort(startStr) : '—';
            const endLabel   = endStr   ? window.fmtShort(endStr)   : 'seçilmedi';
            const rangeLabel = `${startLabel} → ${endLabel}`;
            const hasDate    = !!endStr;

            return `<div class="pg-wz-bms-chip${isActive ? ' active' : ''}${hasDate ? ' assigned' : ''}${isAutoLast ? ' last-ms' : ''}"
                 data-bms="${i}"
                 style="border-color:${isActive ? color : isAutoLast ? color+'55' : 'rgba(255,255,255,.08)'};
                        background:${isActive ? color+'18' : isAutoLast ? color+'0a' : 'rgba(255,255,255,.03)'};">
                <span class="pg-wz-bms-num" style="background:${color}22;color:${color};">${i + 1}</span>
                <span class="pg-wz-bms-icon">${m.icon}</span>
                <div class="pg-wz-bms-body">
                    <span class="pg-wz-bms-title">${window.esc(m.title)}</span>
                    <span class="pg-wz-bms-range" style="color:${hasDate ? color : '#444'};">${rangeLabel}</span>
                </div>
                ${isAutoLast ? `<span class="pg-wz-bms-last-tag" style="color:${color};background:${color}18;">🏁 Otomatik</span>` : ''}
                ${isActive ? `<span class="pg-wz-bms-active-dot" style="background:${color};"></span>` : ''}
            </div>`;
        }).join('') + `</div>`;

    el.querySelectorAll('[data-bms]').forEach(chip => {
        const idx = parseInt(chip.dataset.bms);
        // Deadline varsa son milestone kilitli
        if (hasDeadline && idx >= lastIdx) return;
        chip.addEventListener('click', () => {
            _wzS3ActiveMs = idx;
            _wzDrawBookingCal();
            _wzDrawBookingMsList();
        });
    });
}

function _wzRenderMsDates() {
    const el = document.getElementById('pg-wz-ms-dates');
    if (!el) return;
    const cat = window.getCat(wizardState.goal.category);
    el.innerHTML = wizardState.milestones.map((m, i) => `
        <div class="pg-wz-ms-date-row">
            <div class="pg-wz-ms-date-num" style="background:${cat.color}18;border-color:${cat.color}44;color:${cat.color};">${i + 1}</div>
            <div class="pg-wz-ms-date-info">
                <div class="pg-wz-ms-date-title">
                    <span>${m.icon}</span>${window.esc(m.title)}
                </div>
                <input type="date" class="premium-input pg-wz-ms-date-inp"
                    id="pg-wz-ms-date-${m.id}" value="${m.due_date || ''}">
            </div>
        </div>`
    ).join('');

    el.querySelectorAll('.pg-wz-ms-date-inp').forEach(inp => {
        inp.addEventListener('change', () => {
            const msId  = inp.id.replace('pg-wz-ms-date-', '');
            const found = wizardState.milestones.find(m => m.id === msId);
            if (found) {
                found.due_date = inp.value;
                _wzDrawMiniCal();
                _wzRenderMiniGantt();
                _wzCheckConflicts();
            }
        });
    });
}

function _wzDrawMiniCal() {
    const el = document.getElementById('pg-wz-mini-cal');
    if (!el) return;

    const today    = new Date();
    const firstDay = new Date(_wzCalYear, _wzCalMonth, 1);
    const lastDate = new Date(_wzCalYear, _wzCalMonth + 1, 0).getDate();
    const startDow = (firstDay.getDay() + 6) % 7;
    const monthLabel = firstDay.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

    const msDates = {};
    wizardState.milestones.forEach(m => {
        if (!m.due_date) return;
        const d = new Date(m.due_date);
        if (d.getFullYear() === _wzCalYear && d.getMonth() === _wzCalMonth)
            msDates[d.getDate()] = m;
    });
    const deadlineD = (() => {
        if (!wizardState.goal.deadline) return null;
        const d = new Date(wizardState.goal.deadline);
        return d.getFullYear() === _wzCalYear && d.getMonth() === _wzCalMonth ? d.getDate() : null;
    })();

    const dayHdrs = ['Pt','Sa','Ça','Pe','Cu','Ct','Pz'];
    let cells = '';
    for (let i = 0; i < startDow; i++) cells += '<div class="pg-wz-cal-cell" style="opacity:0;"></div>';
    for (let d = 1; d <= lastDate; d++) {
        const isToday = d === today.getDate() && _wzCalYear === today.getFullYear() && _wzCalMonth === today.getMonth();
        const isMsDay = !!msDates[d];
        const isDl    = deadlineD === d;
        const ms      = msDates[d];
        cells += `<div class="pg-wz-cal-cell${isToday ? ' today' : ''}${isMsDay ? ' ms-day' : ''}${isDl ? ' deadline-day' : ''}"${ms ? ` title="${window.esc(ms.icon + ' ' + ms.title)}"` : ''}>
            ${d}${isMsDay ? '<div class="pg-wz-cal-ms-dot"></div>' : ''}
        </div>`;
    }

    el.innerHTML = `
        <div class="pg-wz-cal-nav">
            <button class="pg-icon-btn" id="pg-wz-cal-prev" type="button"><i class="ti ti-chevron-left"></i></button>
            <div class="pg-wz-cal-month-label">${monthLabel}</div>
            <button class="pg-icon-btn" id="pg-wz-cal-next" type="button"><i class="ti ti-chevron-right"></i></button>
        </div>
        <div class="pg-wz-cal-grid">
            ${dayHdrs.map(d => `<div class="pg-wz-cal-day-hdr">${d}</div>`).join('')}
            ${cells}
        </div>`;

    el.querySelector('#pg-wz-cal-prev')?.addEventListener('click', () => {
        _wzCalMonth--;
        if (_wzCalMonth < 0) { _wzCalMonth = 11; _wzCalYear--; }
        _wzDrawMiniCal();
    });
    el.querySelector('#pg-wz-cal-next')?.addEventListener('click', () => {
        _wzCalMonth++;
        if (_wzCalMonth > 11) { _wzCalMonth = 0; _wzCalYear++; }
        _wzDrawMiniCal();
    });
}

function _wzRenderMiniGantt() {
    const el       = document.getElementById('pg-wz-gantt-preview');
    if (!el) return;
    const deadline = wizardState.goal.deadline ? new Date(wizardState.goal.deadline) : null;
    const today    = new Date();
    const ms       = wizardState.milestones.filter(m => m.due_date);
    if (!deadline || !ms.length) { el.style.display = 'none'; return; }
    el.style.display = '';

    const totalDays = Math.max(1, Math.ceil((deadline - today) / 86400000));
    const cat = window.getCat(wizardState.goal.category);

    const markers = ms.map(m => {
        const days = Math.ceil((new Date(m.due_date) - today) / 86400000);
        const pct  = Math.max(2, Math.min(97, (days / totalDays) * 100));
        return { ...m, pct };
    });

    el.innerHTML = `
        <div class="pg-wz-gantt-label"><i class="ti ti-timeline" style="color:${cat.color};"></i> Zaman Çizelgesi — ${ms.length} dönüm noktası</div>
        <div class="pg-wz-gantt-track">
            <div class="pg-wz-gantt-bg"></div>
            <div class="pg-wz-gantt-today-mark"></div>
            <div class="pg-wz-gantt-deadline-mark"></div>
            ${markers.map(m => `
                <div class="pg-wz-gantt-marker" style="left:${m.pct}%;">
                    <div class="pg-wz-gantt-marker-dot" style="background:${cat.color};color:${cat.color};"></div>
                    <div class="pg-wz-gantt-marker-label">${m.icon} ${window.esc(m.title.length > 10 ? m.title.slice(0, 9) + '…' : m.title)}</div>
                </div>`).join('')}
        </div>
        <div class="pg-wz-gantt-dates">
            <span>Bugün</span>
            <span>${deadline.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>`;
}

function _wzCheckConflicts() {
    const warnEl = document.getElementById('pg-wz-conflict-warn');
    if (!warnEl) return;
    const conflicts = [];
    wizardState.milestones.forEach(m => {
        if (!m.due_date) return;
        for (const g of window._pgGetGoals()) {
            for (const existMs of (g.milestones || [])) {
                if (existMs.due_date === m.due_date && !existMs.done) {
                    conflicts.push(`"${window.esc(m.title)}" tarihi, "${window.esc(existMs.title)}" ile aynı gün`);
                }
            }
        }
    });
    if (conflicts.length) {
        warnEl.style.display = '';
        warnEl.innerHTML = `<i class="ti ti-alert-triangle"></i> ${conflicts[0]}${conflicts.length > 1 ? ' (+' + (conflicts.length - 1) + ' daha)' : ''}`;
    } else {
        warnEl.style.display = 'none';
    }
}

// ── Adım 4 — Görev Planla (Accordion) ────────────────────────
function _wzStep4Render() {
    if (!wizardState.planMode) {
        _wzRenderGranSelector();
    } else {
        _wzRenderMilestoneAccordion();
    }
    setTimeout(_wzBindInfoBtns, 0);
}

// ① Granülasyon seçimi — anlamlı: seçince taslak oluşturur
function _wzRenderGranSelector() {
    const header = document.getElementById('pg-wz-s4-ms-header');
    if (header) header.innerHTML = '';
    document.getElementById('pg-wz-s4-cal-panel')?.style.setProperty('display','none');
    document.getElementById('pg-wz-s4-ms-dots')?.style.setProperty('display','none');
    document.getElementById('pg-wz-s4-prev')?.style.setProperty('display','none');
    document.getElementById('pg-wz-s4-next')?.style.setProperty('display','none');

    const taskArea = document.getElementById('pg-wz-s4-task-area');
    if (!taskArea) return;

    const msWithDates = wizardState.milestones.filter(m => m.due_date).length;
    taskArea.innerHTML = `
        <div class="pg-wz-step-intro">
            <div class="pg-wz-step-icon">⚡</div>
            <div><h3>Çalışma Planı</h3><p>Seçiminize göre her dönüm noktası için otomatik görev taslağı oluşturulur. İstediğiniz gibi düzenleyebilirsiniz.</p></div>
        </div>
        <label class="pg-wz-label" style="margin-bottom:12px;display:block;">Nasıl planlamak istersiniz?</label>
        <div class="pg-wz-gran-btns">
            <button type="button" class="pg-wz-gran-btn" data-gran="daily">
                <div class="pg-wz-gran-icon">📅</div>
                <div class="pg-wz-gran-label">Gün gün</div>
                <div class="pg-wz-gran-desc">Günlük çalışma görevleri</div>
            </button>
            <button type="button" class="pg-wz-gran-btn" data-gran="weekly">
                <div class="pg-wz-gran-icon">📆</div>
                <div class="pg-wz-gran-label">Haftalık</div>
                <div class="pg-wz-gran-desc">Hafta hafta iş planı</div>
            </button>
            <button type="button" class="pg-wz-gran-btn" data-gran="monthly">
                <div class="pg-wz-gran-icon">🗓️</div>
                <div class="pg-wz-gran-label">Aylık</div>
                <div class="pg-wz-gran-desc">Ay bazında planla</div>
            </button>
        </div>
        ${msWithDates > 0 ? `<div class="pg-wz-gran-hint"><i class="ti ti-sparkles"></i> ${msWithDates} dönüm noktası için otomatik taslak oluşturulacak</div>` : ''}`;

    taskArea.querySelectorAll('.pg-wz-gran-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            taskArea.querySelectorAll('.pg-wz-gran-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            wizardState.planMode = btn.dataset.gran;
            // ④ Akıllı taslak: tüm tarihli milestone'lara otomatik görev üret
            wizardState.milestones.forEach((ms, idx) => {
                if (ms.due_date) _wzAutoGenerateTasks(ms, idx, btn.dataset.gran);
            });
            setTimeout(() => _wzRenderMilestoneAccordion(), 150);
        });
    });
}

// ④ Granülasyona + milestone süresine göre akıllı görev taslağı üret
function _wzAutoGenerateTasks(ms, idx, mode) {
    if (!ms.due_date) return;
    const prevMs    = wizardState.milestones[idx - 1];
    const startRaw  = prevMs?.due_date ? new Date(prevMs.due_date) : new Date();
    const start     = new Date(startRaw);
    if (prevMs) start.setDate(start.getDate() + 1);
    start.setHours(0,0,0,0);
    const end = new Date(ms.due_date); end.setHours(0,0,0,0);
    if (end < start) return;

    if (!wizardState.msDet[ms.id])
        wizardState.msDet[ms.id] = { criteria:'', subtasks:[], resources:'', expanded:false, planned_units:[] };
    const det = wizardState.msDet[ms.id];
    det.subtasks = [];

    if (mode === 'daily') {
        const cur = new Date(start); let n = 0;
        while (cur <= end && n < 30) {
            const ds = cur.toISOString().split('T')[0];
            det.subtasks.push({ id: window.msUid(), title: `Çalışma — ${window.fmtShort(ds)}`, done: false, date: ds });
            cur.setDate(cur.getDate() + 1); n++;
        }
    } else if (mode === 'weekly') {
        const cur = new Date(start);
        const dow = cur.getDay(); cur.setDate(cur.getDate() - (dow === 0 ? 6 : dow - 1));
        let wn = 1;
        while (cur <= end) {
            const ws = new Date(cur); const we = new Date(cur); we.setDate(we.getDate() + 6);
            const actualEnd = we > end ? end : we;
            det.subtasks.push({ id: window.msUid(), title: `Hafta ${wn}: ${window.fmtShort(ws.toISOString().split('T')[0])} – ${window.fmtShort(actualEnd.toISOString().split('T')[0])}`, done: false, date: ws.toISOString().split('T')[0] });
            cur.setDate(cur.getDate() + 7); wn++;
        }
    } else if (mode === 'monthly') {
        let cur = new Date(start.getFullYear(), start.getMonth(), 1);
        let mn = 1;
        while (cur <= end) {
            det.subtasks.push({ id: window.msUid(), title: `${mn}. Ay — ${cur.toLocaleDateString('tr-TR', {month:'long', year:'numeric'})}`, done: false, date: `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-01` });
            cur.setMonth(cur.getMonth() + 1); mn++;
        }
    }
}

// ⑤ Tüm milestone'ları accordion'da göster
function _wzRenderMilestoneAccordion() {
    const cat = window.getCat(wizardState.goal.category);

    // Nav butonlarını gizle (accordion navigation'ı yer alıyor)
    document.getElementById('pg-wz-s4-prev')?.style.setProperty('display','none');
    document.getElementById('pg-wz-s4-next')?.style.setProperty('display','none');
    document.getElementById('pg-wz-s4-ms-dots')?.style.setProperty('display','none');
    document.getElementById('pg-wz-s4-cal-panel')?.style.setProperty('display','none');

    // Header: mod chip + değiştir
    const header = document.getElementById('pg-wz-s4-ms-header');
    const modeMap = { daily:'📅 Gün gün', weekly:'📆 Haftalık', monthly:'🗓️ Aylık' };
    if (header) {
        header.innerHTML = `
            <div class="pg-wz-s4-header-top">
                <span class="pg-wz-s4-mode-chip">${modeMap[wizardState.planMode] || ''}</span>
                <button class="pg-wz-s4-change-gran" type="button">Değiştir</button>
            </div>`;
        header.querySelector('.pg-wz-s4-change-gran')?.addEventListener('click', () => {
            wizardState.planMode = null;
            _wzRenderGranSelector();
        });
    }

    // Accordion
    const taskArea = document.getElementById('pg-wz-s4-task-area');
    if (!taskArea) return;

    wizardState.milestones.forEach(ms => {
        if (!wizardState.msDet[ms.id])
            wizardState.msDet[ms.id] = { criteria:'', subtasks:[], resources:'', expanded:false, planned_units:[] };
    });

    taskArea.innerHTML = wizardState.milestones.map((ms, idx) => {
        const det  = wizardState.msDet[ms.id];
        const subs = det.subtasks || [];
        return `<div class="pg-wz-acc-item${idx === 0 ? ' open' : ''}" data-acc-idx="${idx}">
            <div class="pg-wz-acc-header" data-acc-toggle="${idx}" role="button" tabindex="0">
                <span class="pg-wz-acc-num" style="background:${cat.color}18;color:${cat.color};">${idx+1}</span>
                <span class="pg-wz-acc-icon">${ms.icon}</span>
                <div class="pg-wz-acc-info">
                    <span class="pg-wz-acc-name" style="color:${cat.color};">${window.esc(ms.title)}</span>
                    <span class="pg-wz-acc-due">${ms.due_date ? window.fmtShort(ms.due_date) : '—'}</span>
                </div>
                <div class="pg-wz-acc-badges">
                    ${subs.length > 0 ? `<span class="pg-wz-acc-count" style="background:${cat.color}22;color:${cat.color};">${subs.length} görev</span>` : ''}
                    ${det.criteria ? `<span class="pg-wz-acc-crit-badge">✓</span>` : ''}
                </div>
                <i class="ti ti-chevron-down pg-wz-acc-chevron" aria-hidden="true"></i>
            </div>
            <div class="pg-wz-acc-body">
                <div class="pg-wz-acc-content" id="pg-wz-acc-content-${idx}"></div>
            </div>
        </div>`;
    }).join('');

    // Accordion toggle
    taskArea.querySelectorAll('[data-acc-toggle]').forEach(hdr => {
        hdr.addEventListener('click', () => {
            const idx  = parseInt(hdr.dataset.accToggle);
            const item = hdr.closest('.pg-wz-acc-item');
            const wasOpen = item.classList.contains('open');
            item.classList.toggle('open', !wasOpen);
            if (!wasOpen) _wzRenderAccContent(idx, cat);
        });
    });

    // İlk milestone'u aç ve içeriğini render et
    _wzRenderAccContent(0, cat);
}

// Accordion içeriği: başarı kriteri + yük özeti + görev alanı
function _wzRenderAccContent(idx, cat) {
    const contentEl = document.getElementById(`pg-wz-acc-content-${idx}`);
    if (!contentEl) return;
    const ms   = wizardState.milestones[idx];
    const det  = wizardState.msDet[ms?.id] || {};
    const subs = det.subtasks || [];
    const suggestions = window.SUBTASK_SUGGESTIONS[wizardState.goal.category] || [];

    // ⑥ Yük hesapla
    const prevMs   = wizardState.milestones[idx - 1];
    const startRaw = prevMs?.due_date ? new Date(prevMs.due_date) : new Date();
    const msStart  = new Date(startRaw); if (prevMs) msStart.setDate(msStart.getDate() + 1); msStart.setHours(0,0,0,0);
    const msEnd    = ms.due_date ? new Date(ms.due_date) : null;
    const totalDays  = msEnd ? Math.max(1, Math.ceil((msEnd - msStart) / 86400000)) : 0;
    const datedCount = subs.filter(s => s.date).length;

    contentEl.innerHTML = `
        <div class="pg-wz-s4-criteria-wrap">
            <label class="pg-wz-s4-criteria-label">
                <i class="ti ti-checkbox" aria-hidden="true"></i> Başarı kriteri
                <span class="pg-wz-opt">ne zaman tamamlanmış sayılır?</span>
                <button class="pg-wz-info-btn" data-info="criteria" type="button"><i class="ti ti-info-circle"></i></button>
            </label>
            <input type="text" class="premium-input pg-wz-s4-criteria-inp"
                value="${window.esc(det.criteria||'')}"
                placeholder="Örn: A1 sınavını geçtim, ilk prototip çalışıyor...">
        </div>
        ${totalDays > 0 ? `<div class="pg-wz-s4-workload">
            <span><i class="ti ti-checklist" aria-hidden="true"></i> ${subs.length} görev</span>
            ${datedCount > 0 ? `<span style="color:#60a5fa;"><i class="ti ti-calendar-check" aria-hidden="true"></i> ${datedCount} tarihli</span>` : ''}
            <span><i class="ti ti-calendar" aria-hidden="true"></i> ${totalDays} günlük aralık</span>
            ${subs.length > 0 && totalDays > 0 ? `<span style="color:${cat.color};"><i class="ti ti-chart-bar" aria-hidden="true"></i> ${Math.round((datedCount/totalDays)*100)}% kapsama</span>` : ''}
        </div>` : ''}
        <div class="pg-wz-s4-task-section">
            <div class="pg-wz-s4-task-section-label">
                <i class="ti ti-checklist" style="color:${cat.color};" aria-hidden="true"></i>
                Görevler
            </div>
            ${_wzRenderCapacityBar(subs, cat)}
            ${suggestions.length ? `<div class="pg-wz-s4-suggestions">
                ${suggestions.map(s => `<div class="pg-wz-s4-sug-chip${subs.some(st=>st.title===s)?' selected':''}"
                    data-sug="${window.esc(s)}"
                    style="${subs.some(st=>st.title===s)?`background:${cat.color}20;border-color:${cat.color};color:${cat.color};`:''}">
                    ${window.esc(s)}
                </div>`).join('')}
            </div>` : ''}
            <div class="pg-wz-s4-task-input-row">
                <input type="text" class="pg-wz-s4-task-inp" placeholder="Görev ekle... (Enter)" autocomplete="off" maxlength="100">
                <input type="date" class="pg-wz-s4-task-date-inp"
                    title="Tarih seç (isteğe bağlı)"
                    ${msEnd ? `max="${ms.due_date}"` : ''}
                    ${msStart ? `min="${msStart.toISOString().split('T')[0]}"` : ''}>
                <div class="pg-wz-s4-task-time-row">
                    <input type="time" class="pg-wz-s4-task-time-inp" title="Başlangıç saati (isteğe bağlı)" data-time="start">
                    <span class="pg-wz-s4-task-time-sep">–</span>
                    <input type="time" class="pg-wz-s4-task-time-inp" title="Bitiş saati (isteğe bağlı)" data-time="end">
                </div>
                <button class="pg-wz-s4-add-task-btn" type="button" style="background:${cat.color};">
                    <i class="ti ti-plus" aria-hidden="true"></i> Ekle
                </button>
            </div>
            <div class="pg-wz-s4-task-charcount"><span class="pg-wz-s4-task-charcount-val">0</span>/100</div>
            <div class="pg-wz-s4-task-list">${_wzRenderAccTaskItems(subs, cat)}</div>
        </div>`;

    _wzBindAccContent(contentEl, ms, det, cat, idx);
    setTimeout(_wzBindInfoBtns, 0);
}

// "Bugün" gün-paneliyle aynı Yoğunluk çubuğu — tarihli görevlerin toplam gün
// aralığına oranını 8 segmentli bir çubukla gösterir (bkz. _pvRenderDayPanel).
function _wzRenderCapacityBar(subs, cat) {
    const total = subs.length;
    if (!total) return '';
    const doneCount = subs.filter(s => s.done).length;
    const pct = Math.round((doneCount / total) * 100);
    const filledSegs = Math.min(8, Math.round((doneCount / total) * 8));
    const segsHtml = Array.from({length:8},(_,i)=>
        `<div class="pg-wz-s4-capacity-seg" style="${i<filledSegs?`background:${cat.color};`:''}"></div>`
    ).join('');
    return `
        <div class="pg-wz-s4-capacity-row">
            <span class="pg-wz-s4-capacity-label">İlerleme</span>
            <div class="pg-wz-s4-capacity-segs">${segsHtml}</div>
            <span class="pg-wz-s4-capacity-val" style="color:${cat.color};">${doneCount} / ${total} · %${pct}</span>
        </div>`;
}

function _wzRenderAccTaskItems(subs, cat) {
    if (!subs.length) return `<div class="pg-wz-s4-task-empty"><i class="ti ti-clipboard" aria-hidden="true"></i> Henüz görev yok</div>`;
    return subs.map((st, i) => `
        <div class="pg-wz-s4-task-item${st.done?' done':''}">
            <div class="pg-wz-s4-task-check${st.done?' done':''}" data-check="${i}"
                style="${st.done?`background:${cat.color};border-color:${cat.color};`:`border-color:${cat.color}66;`}">
                ${st.done?`<i class="ti ti-check" style="color:#fff;font-size:11px;" aria-hidden="true"></i>`:''}
            </div>
            ${st.timeStart ? `<span class="pg-wz-s4-task-time-badge">${st.timeStart}${st.timeEnd ? `–${st.timeEnd}` : ''}</span>` : ''}
            <span class="pg-wz-s4-task-title">${window.esc(st.title)}</span>
            ${st.date ? `<span class="pg-wz-s4-task-date-badge" style="color:${cat.color};background:${cat.color}18;">${window.fmtShort(st.date)}</span>` : ''}
            <button class="pg-wz-s4-task-del" data-del="${i}" type="button"><i class="ti ti-x" aria-hidden="true"></i></button>
        </div>`
    ).join('');
}

function _wzBindAccContent(el, ms, det, cat, idx) {
    // Başarı kriteri
    el.querySelector('.pg-wz-s4-criteria-inp')?.addEventListener('input', e => {
        if (wizardState.msDet[ms.id]) wizardState.msDet[ms.id].criteria = e.target.value;
        _wzRefreshAccHeader(idx, cat);
    });
    // Öneri chipler
    el.querySelectorAll('[data-sug]').forEach(chip => {
        chip.addEventListener('click', () => {
            const title = chip.dataset.sug;
            const subs  = wizardState.msDet[ms.id].subtasks;
            const i     = subs.findIndex(s => s.title === title);
            if (i !== -1) subs.splice(i, 1);
            else subs.push({ id: window.msUid(), title, done: false, date: '' });
            _wzRenderAccContent(idx, cat);
        });
    });
    // ② Tarihli + saatli görev ekleme (bkz. "Bugün" gün panelindeki 09:00-10:00 seçiciler)
    const inp      = el.querySelector('.pg-wz-s4-task-inp');
    const dateInp  = el.querySelector('.pg-wz-s4-task-date-inp');
    const startInp = el.querySelector('.pg-wz-s4-task-time-inp[data-time="start"]');
    const endInp   = el.querySelector('.pg-wz-s4-task-time-inp[data-time="end"]');
    const addBtn   = el.querySelector('.pg-wz-s4-add-task-btn');
    const charCountEl = el.querySelector('.pg-wz-s4-task-charcount-val');
    const addTask = () => {
        const val  = inp?.value.trim();
        if (!val) return;
        const date      = dateInp?.value || '';
        const timeStart = startInp?.value || '';
        const timeEnd   = endInp?.value || '';
        wizardState.msDet[ms.id].subtasks.push({ id: window.msUid(), title: val, done: false, date, timeStart, timeEnd });
        inp.value = ''; if (dateInp) dateInp.value = ''; if (startInp) startInp.value = ''; if (endInp) endInp.value = '';
        if (charCountEl) charCountEl.textContent = '0';
        _wzRefreshAccTaskList(el, ms, det, cat, idx);
        inp.focus();
    };
    inp?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } });
    inp?.addEventListener('input', () => { if (charCountEl) charCountEl.textContent = String(inp.value.length); });
    addBtn?.addEventListener('click', addTask);
    inp?.focus();
    // Görev check + sil
    el.querySelector('.pg-wz-s4-task-list')?.addEventListener('click', e => {
        const check = e.target.closest('[data-check]');
        const del   = e.target.closest('[data-del]');
        const subs  = wizardState.msDet[ms.id].subtasks;
        if (check) { const i = parseInt(check.dataset.check); if (subs[i]) { subs[i].done = !subs[i].done; _wzRefreshAccTaskList(el, ms, det, cat, idx); } }
        if (del)   { const i = parseInt(del.dataset.del);   subs.splice(i, 1); _wzRenderAccContent(idx, cat); }
    });
}

function _wzRefreshAccTaskList(el, ms, det, cat, idx) {
    const list = el.querySelector('.pg-wz-s4-task-list');
    if (list) list.innerHTML = _wzRenderAccTaskItems(det.subtasks || [], cat);
    // Yoğunluk/İlerleme çubuğunu güncelle
    const capRow = el.querySelector('.pg-wz-s4-capacity-row');
    const capHtml = _wzRenderCapacityBar(det.subtasks || [], cat);
    if (capRow) {
        if (capHtml) capRow.outerHTML = capHtml;
        else capRow.remove();
    } else if (capHtml) {
        el.querySelector('.pg-wz-s4-task-section-label')?.insertAdjacentHTML('afterend', capHtml);
    }
    // Yük özeti güncelle
    const datedCount = (det.subtasks||[]).filter(s=>s.date).length;
    const wl = el.querySelector('.pg-wz-s4-workload');
    if (wl) {
        const items = wl.querySelectorAll('span');
        if (items[0]) items[0].innerHTML = `<i class="ti ti-checklist" aria-hidden="true"></i> ${det.subtasks.length} görev`;
    }
    _wzRefreshAccHeader(idx, cat);
}

function _wzRefreshAccHeader(idx, cat) {
    const hdr = document.querySelector(`[data-acc-toggle="${idx}"]`);
    if (!hdr) return;
    const ms  = wizardState.milestones[idx];
    const det = wizardState.msDet[ms?.id] || {};
    const badge = hdr.querySelector('.pg-wz-acc-badges');
    if (badge) badge.innerHTML = `
        ${det.subtasks?.length > 0 ? `<span class="pg-wz-acc-count" style="background:${cat.color}22;color:${cat.color};">${det.subtasks.length} görev</span>` : ''}
        ${det.criteria ? `<span class="pg-wz-acc-crit-badge">✓</span>` : ''}`;
}

// (Not: burada bir önceki _wzFlushS4Details tanımı vardı — orijinal planning.js'te
// aynı isimli ikinci bir tanım daha vardı (aşağıda) ve fonksiyon hoisting'i
// nedeniyle o zaten geçersiz kılıyordu; ES modülünde duplicate top-level function
// declaration SyntaxError verdiği için bu ölü/no-op ilk tanım kaldırıldı.)

function _wzRenderMsPlanner(idx) {
    wizardState.s4MsIdx = idx;
    const ms  = wizardState.milestones[idx];
    if (!ms) return;
    const cat = window.getCat(wizardState.goal.category);
    if (!wizardState.msDet[ms.id])
        wizardState.msDet[ms.id] = { criteria: '', subtasks: [], resources: '', expanded: false, planned_units: [] };
    const det = wizardState.msDet[ms.id];

    // Nav butonlarını görünür yap (granülasyon ekranında gizlenebilir)
    const prevBtnEl = document.getElementById('pg-wz-s4-prev');
    const nextBtnEl = document.getElementById('pg-wz-s4-next');
    if (prevBtnEl) prevBtnEl.style.visibility = idx > 0 ? 'visible' : 'hidden';
    if (nextBtnEl) nextBtnEl.style.visibility = 'visible';

    // ── Header ──────────────────────────────────────
    const modeMap  = { daily: '📅 Gün gün', weekly: '📆 Haftalık', monthly: '🗓️ Aylık' };
    const modeLabel = modeMap[wizardState.planMode] || '';
    const header = document.getElementById('pg-wz-s4-ms-header');
    if (header) {
        header.innerHTML = `
            <div class="pg-wz-s4-header-top">
                <span class="pg-wz-s4-mode-chip">${modeLabel}</span>
                <button class="pg-wz-s4-change-gran" type="button">Değiştir</button>
            </div>
            <div class="pg-wz-s4-ms-info">
                <span class="pg-wz-s4-ms-num" style="background:${cat.color}18;color:${cat.color};">${idx+1}/${wizardState.milestones.length}</span>
                <span class="pg-wz-s4-ms-icon">${ms.icon}</span>
                <div class="pg-wz-s4-ms-title-wrap">
                    <span class="pg-wz-s4-ms-name" style="color:${cat.color};">${window.esc(ms.title)}</span>
                    ${ms.due_date ? `<span class="pg-wz-s4-ms-due"><i class="ti ti-calendar"></i> ${window.fmtDate(ms.due_date)}</span>` : ''}
                </div>
                <button class="pg-wz-s4-cal-toggle-btn" id="pg-wz-s4-cal-toggle" type="button">
                    <i class="ti ti-calendar-stats"></i> Takvimde Gör
                </button>
            </div>`;
        header.querySelector('.pg-wz-s4-change-gran')?.addEventListener('click', () => {
            wizardState.planMode = null;
            const calPanel = document.getElementById('pg-wz-s4-cal-panel');
            if (calPanel) calPanel.style.display = 'none';
            _wzRenderGranSelector();
        });
        header.querySelector('#pg-wz-s4-cal-toggle')?.addEventListener('click', () => {
            const panel = document.getElementById('pg-wz-s4-cal-panel');
            if (!panel) return;
            const open = panel.style.display === '';
            if (open) {
                panel.style.display = 'none';
                header.querySelector('#pg-wz-s4-cal-toggle').innerHTML = '<i class="ti ti-calendar-stats"></i> Takvimde Gör';
            } else {
                panel.style.display = '';
                const calWrap = document.getElementById('pg-wz-s4-cal-wrap');
                if (calWrap) {
                    calWrap.innerHTML = _wzPlannerCalHTML(ms, idx, cat, det);
                }
                header.querySelector('#pg-wz-s4-cal-toggle').innerHTML = '<i class="ti ti-x"></i> Kapat';
            }
        });
    }

    // ── Görev ekleme alanı ──────────────────────────
    const taskArea = document.getElementById('pg-wz-s4-task-area');
    if (taskArea) {
        const suggestions = window.SUBTASK_SUGGESTIONS[wizardState.goal.category] || [];
        const subtasks    = det.subtasks || [];

        taskArea.innerHTML = `
            <!-- Başarı kriteri -->
            <div class="pg-wz-s4-criteria-wrap">
                <label class="pg-wz-s4-criteria-label">
                    <i class="ti ti-checkbox"></i> Başarı kriteri
                    <span class="pg-wz-opt">· bu aşamayı ne zaman tamamlamış sayılacaksın?</span>
                    <button class="pg-wz-info-btn" data-info="criteria" type="button"><i class="ti ti-info-circle"></i></button>
                </label>
                <input type="text" class="premium-input pg-wz-s4-criteria-inp" id="pg-wz-s4-criteria"
                    value="${window.esc(det.criteria || '')}"
                    placeholder="Örn: İlk prototip çalışıyor, A1 sınavını geçtim...">
            </div>
            <!-- Hızlı görev ekleme -->
            <div class="pg-wz-s4-task-section">
                <div class="pg-wz-s4-task-section-label">
                    <i class="ti ti-checklist" style="color:${cat.color};"></i>
                    Görevler
                    ${subtasks.length > 0 ? `<span class="pg-wz-s4-task-count" style="background:${cat.color}22;color:${cat.color};">${subtasks.length}</span>` : ''}
                </div>
                <!-- Öneri chipler -->
                ${suggestions.length ? `<div class="pg-wz-s4-suggestions">
                    ${suggestions.map(s => `<div class="pg-wz-s4-sug-chip${subtasks.some(st=>st.title===s)?' selected':''}"
                        data-sug="${window.esc(s)}"
                        style="${subtasks.some(st=>st.title===s)?`background:${cat.color}20;border-color:${cat.color};color:${cat.color};`:''}">
                        ${window.esc(s)}
                    </div>`).join('')}
                </div>` : ''}
                <!-- Görev girişi -->
                <div class="pg-wz-s4-task-input-row">
                    <input type="text" class="pg-wz-s4-task-inp" id="pg-wz-s4-task-inp"
                        placeholder="Görev ekle ve Enter'a bas..."
                        autocomplete="off" maxlength="100">
                    <button class="pg-wz-s4-add-task-btn" id="pg-wz-s4-add-btn" type="button" style="background:${cat.color};">
                        <i class="ti ti-plus"></i>
                    </button>
                </div>
                <!-- Görev listesi -->
                <div class="pg-wz-s4-task-list" id="pg-wz-s4-task-list">
                    ${subtasks.length === 0
                        ? `<div class="pg-wz-s4-task-empty"><i class="ti ti-clipboard"></i> Henüz görev yok</div>`
                        : subtasks.map((st, i) => `
                            <div class="pg-wz-s4-task-item${st.done?' done':''}" data-stidx="${i}">
                                <div class="pg-wz-s4-task-check${st.done?' done':''}" data-check="${i}"
                                    style="${st.done?`background:${cat.color};border-color:${cat.color};`:`border-color:${cat.color}66;`}">
                                    ${st.done?'<i class="ti ti-check" style="color:#fff;font-size:11px;"></i>':''}
                                </div>
                                <span class="pg-wz-s4-task-title">${window.esc(st.title)}</span>
                                <button class="pg-wz-s4-task-del" data-del="${i}" type="button">
                                    <i class="ti ti-x"></i>
                                </button>
                            </div>`).join('')
                    }
                </div>
            </div>`;

        _wzBindS4TaskArea(taskArea, ms, det, cat, idx);
        setTimeout(_wzBindInfoBtns, 0);
    }

    // ── İlerleme noktaları ───────────────────────────
    const dots = document.getElementById('pg-wz-s4-ms-dots');
    if (dots) {
        dots.innerHTML = wizardState.milestones.map((m, i) => {
            const d    = wizardState.msDet[m.id];
            const done = !!(d?.criteria || d?.subtasks?.length);
            return `<div class="pg-wz-s4-dot${i===idx?' active':''}${done?' done':''}"
                style="${i===idx?`background:${cat.color};box-shadow:0 0 0 3px ${cat.color}33;`:''}"></div>`;
        }).join('');
    }

    // ── Nav butonları ────────────────────────────────
    const prevBtn = document.getElementById('pg-wz-s4-prev');
    const nextBtn = document.getElementById('pg-wz-s4-next');
    const isLast  = idx === wizardState.milestones.length - 1;
    if (prevBtn) {
        prevBtn.style.visibility = idx > 0 ? 'visible' : 'hidden';
        prevBtn.onclick = () => { _wzFlushS4Details(ms); _wzRenderMsPlanner(idx - 1); };
    }
    if (nextBtn) {
        nextBtn.innerHTML = isLast
            ? '<i class="ti ti-check"></i> Tamamlandı'
            : 'Sonraki <i class="ti ti-arrow-right"></i>';
        nextBtn.classList.toggle('pg-wz-s4-nav-done', isLast);
        nextBtn.onclick = () => { _wzFlushS4Details(ms); if (!isLast) _wzRenderMsPlanner(idx + 1); };
    }

    // Takvim paneli kapat (aşama geçişinde)
    const calPanel = document.getElementById('pg-wz-s4-cal-panel');
    if (calPanel) calPanel.style.display = 'none';
}

function _wzBindS4TaskArea(area, ms, det, cat, idx) {
    // Başarı kriteri
    area.querySelector('#pg-wz-s4-criteria')?.addEventListener('input', e => {
        if (wizardState.msDet[ms.id]) wizardState.msDet[ms.id].criteria = e.target.value;
        _wzUpdateS4Dots(idx, cat);
    });

    // Öneri chip'leri
    area.querySelectorAll('.pg-wz-s4-sug-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const title = chip.dataset.sug;
            const subs  = wizardState.msDet[ms.id].subtasks;
            const i     = subs.findIndex(s => s.title === title);
            if (i !== -1) {
                subs.splice(i, 1);
            } else {
                subs.push({ id: window.msUid(), title, done: false });
            }
            _wzRenderMsPlanner(idx);
        });
    });

    // Görev ekleme — input + buton
    const inp    = area.querySelector('#pg-wz-s4-task-inp');
    const addBtn = area.querySelector('#pg-wz-s4-add-btn');
    const addTask = () => {
        const val = inp?.value.trim();
        if (!val) return;
        wizardState.msDet[ms.id].subtasks.push({ id: window.msUid(), title: val, done: false });
        inp.value = '';
        _wzRenderS4TaskList(idx, cat);
        inp.focus();
    };
    inp?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } });
    addBtn?.addEventListener('click', addTask);
    inp?.focus();

    // Görev listesi — tik + sil
    area.addEventListener('click', e => {
        const check = e.target.closest('[data-check]');
        const del   = e.target.closest('[data-del]');
        const subs  = wizardState.msDet[ms.id].subtasks;
        if (check) {
            const i = parseInt(check.dataset.check);
            if (subs[i]) { subs[i].done = !subs[i].done; _wzRenderS4TaskList(idx, cat); }
        }
        if (del) {
            const i = parseInt(del.dataset.del);
            subs.splice(i, 1);
            // Chip seçimini de güncelle
            _wzRenderMsPlanner(idx);
        }
    });
}

function _wzRenderS4TaskList(idx, cat) {
    const ms   = wizardState.milestones[idx];
    const det  = wizardState.msDet[ms?.id];
    const list = document.getElementById('pg-wz-s4-task-list');
    if (!list || !det) return;
    const subs = det.subtasks || [];
    list.innerHTML = subs.length === 0
        ? `<div class="pg-wz-s4-task-empty"><i class="ti ti-clipboard"></i> Henüz görev yok</div>`
        : subs.map((st, i) => `
            <div class="pg-wz-s4-task-item${st.done?' done':''}" data-stidx="${i}">
                <div class="pg-wz-s4-task-check${st.done?' done':''}" data-check="${i}"
                    style="${st.done?`background:${cat.color};border-color:${cat.color};`:`border-color:${cat.color}66;`}">
                    ${st.done?'<i class="ti ti-check" style="color:#fff;font-size:11px;"></i>':''}
                </div>
                <span class="pg-wz-s4-task-title">${window.esc(st.title)}</span>
                <button class="pg-wz-s4-task-del" data-del="${i}" type="button"><i class="ti ti-x"></i></button>
            </div>`).join('');

    // Sayacı güncelle
    const counter = document.querySelector('.pg-wz-s4-task-count');
    if (counter) { counter.textContent = subs.length; counter.style.display = subs.length > 0 ? '' : 'none'; }
    _wzUpdateS4Dots(idx, cat);
}

function _wzUpdateS4Dots(idx, cat) {
    const dots = document.getElementById('pg-wz-s4-ms-dots');
    if (!dots) return;
    dots.querySelectorAll('.pg-wz-s4-dot').forEach((dot, i) => {
        const m2 = wizardState.milestones[i];
        const d2 = wizardState.msDet[m2?.id];
        dot.classList.toggle('done', !!(d2?.criteria || d2?.subtasks?.length));
    });
}

function _wzFlushS4Details(ms) {
    const val = document.getElementById('pg-wz-s4-criteria')?.value || '';
    if (wizardState.msDet[ms.id]) wizardState.msDet[ms.id].criteria = val;
}

function _wzUpdateHoursDisplay(hours) {
    const display = document.getElementById('pg-wz-hours-display');
    const effort  = document.getElementById('pg-wz-effort-indicator');
    if (display) display.textContent = hours + ' saat/hafta';
    if (effort) {
        const h = parseInt(hours);
        if (h <= 5)       effort.innerHTML = '🟢 Rahat bir tempo';
        else if (h <= 15) effort.innerHTML = '🟡 Dengeli bir tempo';
        else if (h <= 25) effort.innerHTML = '🟠 Yoğun bir tempo';
        else               effort.innerHTML = '🔴 Çok yoğun — sürdürülebilir mi?';
    }
}

function _wzCalcTime() {
    const hours    = parseInt(document.getElementById('pg-wz-hours-per-week')?.value || document.getElementById('pg-wz-hours-slider')?.value) || 0;
    const deadline = wizardState?.goal?.deadline;
    const el       = document.getElementById('pg-wz-time-calc');
    if (!el) return;
    if (deadline && hours > 0) {
        const days       = Math.max(1, Math.ceil((new Date(deadline) - new Date()) / 86400000));
        const weeks      = Math.ceil(days / 7);
        const totalHours = weeks * hours;
        const workDays   = (wizardState?.goal?.work_days || []).length;
        const dayStr     = workDays > 0 ? ` · haftada ${workDays} gün` : '';
        el.textContent   = `≈ Toplam ~${totalHours} saat (${weeks} hafta × ${hours} saat${dayStr})`;
    } else {
        el.textContent = '';
    }
}

function _wzRenderSubtasks() {
    const el   = document.getElementById('pg-wz-subtasks-list');
    const subs = wizardState?.firstMsDetail.subtasks || [];
    if (!el) return;
    el.innerHTML = subs.map(s => `
        <div class="pg-wz-subtask-item">
            <i class="ti ti-check"></i>
            <span>${window.esc(s.title)}</span>
            <button class="pg-icon-btn" data-del-sub="${s.id}" type="button"><i class="ti ti-x"></i></button>
        </div>`).join('');
    el.querySelectorAll('[data-del-sub]').forEach(btn => {
        btn.addEventListener('click', () => {
            wizardState.firstMsDetail.subtasks = wizardState.firstMsDetail.subtasks.filter(s => s.id !== btn.dataset.delSub);
            // Uncheck suggestion chip if it exists
            const sub = wizardState.firstMsDetail.subtasks;
            document.querySelectorAll('.pg-wz-st-sug').forEach(chip => {
                chip.classList.toggle('selected', sub.some(s => s.title === chip.dataset.sug));
            });
            _wzRenderSubtasks();
        });
    });
}

// ── Step 5 ────────────────────────────────
function _wzStep5Render() {
    const { goal, milestones, firstMsDetail } = wizardState;
    const cat = window.getCat(goal.category);

    // Celebration sub text
    const subEl = document.getElementById('pg-wz-celebration-sub');
    if (subEl) {
        subEl.textContent = `${cat.icon} ${goal.title} · ${milestones.length} aşama · ${goal.deadline ? window.fmtDate(goal.deadline) + ' hedef tarihi' : 'Esnek takvim'}`;
    }

    // Summary
    const msDet = wizardState.msDet || {};
    const totalSubs = milestones.reduce((s, m) => s + ((msDet[m.id]?.subtasks || []).length), 0);
    const workDays  = goal.work_days || [];
    const dayNames  = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

    const sumEl = document.getElementById('pg-wz-summary');
    if (sumEl) {
        sumEl.innerHTML = `
        <div class="pg-wz-summary-card" style="--summary-color:${cat.color};">
            <div class="pg-wz-summary-row">
                <span class="pg-wz-summary-label">Hedef</span>
                <span class="pg-wz-summary-val">${cat.icon} ${window.esc(goal.title)}</span>
            </div>
            ${goal.deadline ? `<div class="pg-wz-summary-row">
                <span class="pg-wz-summary-label">Son Tarih</span>
                <span class="pg-wz-summary-val">${window.fmtDate(goal.deadline)}</span>
            </div>` : ''}
            <div class="pg-wz-summary-row">
                <span class="pg-wz-summary-label">Dönüm Noktaları</span>
                <span class="pg-wz-summary-val">${milestones.length} aşama</span>
            </div>
            <div class="pg-wz-summary-ms-list">
                ${milestones.map(m => `<div class="pg-wz-summary-ms-item">
                    ${m.icon} ${window.esc(m.title)}
                    ${m.due_date ? `<span class="pg-wz-summary-ms-date">· ${window.fmtShort(m.due_date)}</span>` : ''}
                    ${msDet[m.id]?.criteria ? `<span class="pg-wz-summary-ms-date" style="color:#4ade80;"> ✓ ${window.esc(msDet[m.id].criteria)}</span>` : ''}
                </div>`).join('')}
            </div>
            ${workDays.length ? `<div class="pg-wz-summary-row">
                <span class="pg-wz-summary-label">Çalışma Günleri</span>
                <span class="pg-wz-summary-val">${workDays.length} gün/hafta · ${[...workDays].sort((a,b)=>a===0?1:b===0?-1:a-b).map(d=>dayNames[d]).join(', ')}</span>
            </div>` : ''}
            ${goal.hours_per_week ? `<div class="pg-wz-summary-row">
                <span class="pg-wz-summary-label">Haftalık Süre</span>
                <span class="pg-wz-summary-val">${goal.hours_per_week} saat/hafta</span>
            </div>` : ''}
            ${totalSubs ? `<div class="pg-wz-summary-row">
                <span class="pg-wz-summary-label">Toplam Alt Görev</span>
                <span class="pg-wz-summary-val">${totalSubs} hazır</span>
            </div>` : ''}
        </div>`;
    }

    // Collab info — adım 1'de seçilen moda göre göster
    const ci = document.getElementById('pg-wz-collab-info');
    if (ci) ci.style.display = (wizardState.mode || 'solo') === 'collab' ? '' : 'none';
}

// ── Wizard Save ───────────────────────────
function _wzSave() {
    if (!wizardState) return;
    const { goal, milestones, firstMsDetail, mode } = wizardState;
    const cat = window.getCat(goal.category);

    const newGoal = {
        id: window.uid(), title: goal.title.trim(),
        description: goal.motivation || '',
        category: goal.category, color: cat.color,
        deadline: goal.deadline || '', priority: goal.priority,
        status: 'active', progress_pct: 0, milestones: [],
        work_days: goal.work_days || [],
        hours_per_week: goal.hours_per_week || 5,
        context: goal.context || {},
        plan_mode: wizardState.planMode || null,
        created_at: new Date().toISOString(), _dirty: true,
    };

    const msDet = wizardState.msDet || {};
    milestones.forEach((m, i) => {
        const det = msDet[m.id] || {};
        newGoal.milestones.push({
            id: m.id, title: m.title.trim(),
            description: det.resources || '',
            due_date: m.due_date || '', done: false, order: i,
            criteria: det.criteria || '',
            subtasks: (det.subtasks || []).map(s => ({ ...s })),
            planned_units: det.planned_units || [],
            created_at: new Date().toISOString(),
        });
    });

    window._pgGetGoals().unshift(newGoal);
    window.persistGoals();
    window.render();

    // ② Tarihli görevleri global görev sistemine aktar (Bugün sekmesinde görünsün)
    // st.date is YYYY-MM-DD; addGlobalTask expects DD-MM-YYYY
    const _ymToDD = (d) => { if (!d) return ''; const p = d.split('-'); return p.length === 3 && p[0].length === 4 ? `${p[2]}-${p[1]}-${p[0]}` : d; };
    newGoal.milestones.forEach(m => {
        (m.subtasks || []).forEach(st => {
            if (!st.date) return;
            const dateDDMMYYYY = _ymToDD(st.date);
            // Sihirbazın 4. adımında (Görev Planla) kullanıcı bir saat aralığı seçtiyse
            // onu kullan — seçmediyse eskisi gibi 09:00-10:00 varsayılanına düş.
            const timeStart = st.timeStart || '09:00';
            const timeEnd   = st.timeEnd   || '10:00';
            if (typeof window.addGlobalTask === 'function') {
                window.addGlobalTask(st.title, newGoal.priority || 2, newGoal.category || '', dateDDMMYYYY, timeStart, timeEnd, '', newGoal.id);
            } else {
                const tasks = FocusStorage.get('tasks', []);
                tasks.push({ id: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2,5), text: st.title, completed: false, priority: newGoal.priority || 2, category: newGoal.category || '', date: dateDDMMYYYY, timeStart, timeEnd, parentGoal: newGoal.id });
                FocusStorage.set('tasks', tasks);
            }
        });
    });

    closeWizard();
    window.toast('Hedef oluşturuldu! 🎯');

    setTimeout(() => {
        window.openPlanView(newGoal.id);
        if (mode === 'collab' && window.PlanningCollab) {
            setTimeout(() => window.PlanningCollab._handleEnableCollab(newGoal), 800);
        }
    }, 350);
}
