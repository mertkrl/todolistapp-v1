import { CATEGORIES, fmtDate, fmtShort, getCat, msUid } from './planning-utils.js';
import { _wzBindInfoBtns } from './planning-wizard-info-tooltip.js';
import {
    _wzRenderCapacityBar, _wzApplyCapacityColors, _wzRenderAccTaskItems,
    _wzApplyAccTaskItemColors, _wzApplyAccContentColors,
} from './planning-milestone-wizard-task-render.js';
import {
    _wzBindCharCounter, _wzRenderCatCards, _wzRenderPriorityBtns, _wzRenderDeadlineQuick,
    _wzSyncDeadlineQuickSelected, _wzUpdateDurationHint,
} from './planning-milestone-wizard-step1-form.js';
import {
    _wzGetMsRanges, _wzRenderBookingMonth, _wzRenderMiniGantt, _wzCheckConflicts,
} from './planning-milestone-wizard-step3-render.js';
import { _wzStep2Render, _wzFlushMsInputs } from './planning-milestone-wizard-step2-count.js';
import { _wzUpdateModeHint, _wzRefreshCollabMembers } from './planning-milestone-wizard-collab-invite.js';
import { _wzStep5Render, _wzSave } from './planning-milestone-wizard-step5-save.js';
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
    _wzWeeklyCalHTML, _wzMonthlyCalHTML, _wzBindPlannerCal, _wzApplyPlannerCalColors,
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

export function closeWizard() {
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
            const pending = JSON.parse(localStorage.getItem('_wz_pending_collab') || '{}', window._safeJsonReviver);
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

// ── Wizard Collab Invite ── planning-milestone-wizard-collab-invite.js'e çıkarıldı (Faz H devamı, 2. tur).

// ── Step 2 ── planning-milestone-wizard-step2-count.js'e çıkarıldı (Faz H devamı, 2. tur).

// ── Step 3 ────────────────────────────────
// ── Adım 3 — Booking Takvimi ─────────────
// Her dönüm noktası için ayrı renk paleti
export const MS_RANGE_COLORS = [
    '#7c6eff', '#ef476f', '#06d6a0', '#ffd166',
    '#ff9f43', '#60a5fa', '#f472b6', '#34d399',
];

export let _wzS3ActiveMs = 0;

// Dönüm noktalarının tarih aralıklarını hesapla
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

    el.querySelectorAll('.pg-wz-bcal-day[data-bg-color]').forEach(dayEl => {
        dayEl.style.background = dayEl.dataset.bgColor;
        dayEl.style.borderRadius = dayEl.dataset.br;
    });
    el.querySelectorAll('.pg-wz-bcal-ms-badge[data-badge-color]').forEach(badgeEl => {
        badgeEl.style.background = badgeEl.dataset.badgeColor;
    });
    el.querySelectorAll('.pg-wz-bcal-range-flag[data-flag-color]').forEach(flagEl => {
        flagEl.style.background = flagEl.dataset.flagColor;
    });
    el.querySelectorAll('.pg-wz-bcal-d-num[data-endnum="1"]').forEach(numEl => {
        numEl.style.color = '#fff';
        numEl.style.fontWeight = '800';
    });

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
    let hintColor = '';
    if (allSet) {
        hint = `<div class="pg-wz-bms-hint done"><i class="ti ti-check"></i> Tüm bitiş tarihleri seçildi</div>`;
    } else {
        const activeMs = msList[_wzS3ActiveMs];
        hintColor      = MS_RANGE_COLORS[_wzS3ActiveMs % MS_RANGE_COLORS.length];
        hint = `<div class="pg-wz-bms-hint">
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
            const startLabel = startStr ? fmtShort(startStr) : '—';
            const endLabel   = endStr   ? fmtShort(endStr)   : 'seçilmedi';
            const rangeLabel = `${startLabel} → ${endLabel}`;
            const hasDate    = !!endStr;

            return `<div class="pg-wz-bms-chip${isActive ? ' active' : ''}${hasDate ? ' assigned' : ''}${isAutoLast ? ' last-ms' : ''}"
                 data-bms="${i}">
                <span class="pg-wz-bms-num">${i + 1}</span>
                <span class="pg-wz-bms-icon">${m.icon}</span>
                <div class="pg-wz-bms-body">
                    <span class="pg-wz-bms-title">${window.esc(m.title)}</span>
                    <span class="pg-wz-bms-range">${rangeLabel}</span>
                </div>
                ${isAutoLast ? `<span class="pg-wz-bms-last-tag">🏁 Otomatik</span>` : ''}
                ${isActive ? `<span class="pg-wz-bms-active-dot"></span>` : ''}
            </div>`;
        }).join('') + `</div>`;

    const hintEl = el.querySelector('.pg-wz-bms-hint:not(.done)');
    if (hintEl && hintColor) {
        hintEl.style.borderColor = hintColor + '44';
        hintEl.style.color = hintColor;
    }

    el.querySelectorAll('[data-bms]').forEach(chip => {
        const idx        = parseInt(chip.dataset.bms);
        const color      = MS_RANGE_COLORS[idx % MS_RANGE_COLORS.length];
        const isAutoLast = idx === lastIdx && hasDeadline;
        const isActive   = (idx === _wzS3ActiveMs) && !isAutoLast;
        const { endStr } = getMsStartEnd(idx);
        const hasDate    = !!endStr;

        chip.style.borderColor = isActive ? color : isAutoLast ? color + '55' : 'rgba(255,255,255,.08)';
        chip.style.background  = isActive ? color + '18' : isAutoLast ? color + '0a' : 'rgba(255,255,255,.03)';
        const numEl = chip.querySelector('.pg-wz-bms-num');
        if (numEl) { numEl.style.background = color + '22'; numEl.style.color = color; }
        const rangeEl = chip.querySelector('.pg-wz-bms-range');
        if (rangeEl) rangeEl.style.color = hasDate ? color : '#444';
        const lastTagEl = chip.querySelector('.pg-wz-bms-last-tag');
        if (lastTagEl) { lastTagEl.style.color = color; lastTagEl.style.background = color + '18'; }
        const activeDotEl = chip.querySelector('.pg-wz-bms-active-dot');
        if (activeDotEl) activeDotEl.style.background = color;
    });

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
    const cat = getCat(wizardState.goal.category);
    el.innerHTML = wizardState.milestones.map((m, i) => `
        <div class="pg-wz-ms-date-row">
            <div class="pg-wz-ms-date-num">${i + 1}</div>
            <div class="pg-wz-ms-date-info">
                <div class="pg-wz-ms-date-title">
                    <span>${m.icon}</span>${window.esc(m.title)}
                </div>
                <input type="date" class="premium-input pg-wz-ms-date-inp"
                    id="pg-wz-ms-date-${m.id}" value="${m.due_date || ''}">
            </div>
        </div>`
    ).join('');

    el.querySelectorAll('.pg-wz-ms-date-num').forEach(numEl => {
        numEl.style.background = cat.color + '18';
        numEl.style.borderColor = cat.color + '44';
        numEl.style.color = cat.color;
    });

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
    for (let i = 0; i < startDow; i++) cells += '<div class="pg-wz-cal-cell u-opacity-0" ></div>';
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
    document.getElementById('pg-wz-s4-cal-panel')?.classList.add('is-hidden');
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
        <label class="pg-wz-label u-margin-bottom-12px_display-block" >Nasıl planlamak istersiniz?</label>
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
            det.subtasks.push({ id: msUid(), title: `Çalışma — ${fmtShort(ds)}`, done: false, date: ds });
            cur.setDate(cur.getDate() + 1); n++;
        }
    } else if (mode === 'weekly') {
        const cur = new Date(start);
        const dow = cur.getDay(); cur.setDate(cur.getDate() - (dow === 0 ? 6 : dow - 1));
        let wn = 1;
        while (cur <= end) {
            const ws = new Date(cur); const we = new Date(cur); we.setDate(we.getDate() + 6);
            const actualEnd = we > end ? end : we;
            det.subtasks.push({ id: msUid(), title: `Hafta ${wn}: ${fmtShort(ws.toISOString().split('T')[0])} – ${fmtShort(actualEnd.toISOString().split('T')[0])}`, done: false, date: ws.toISOString().split('T')[0] });
            cur.setDate(cur.getDate() + 7); wn++;
        }
    } else if (mode === 'monthly') {
        let cur = new Date(start.getFullYear(), start.getMonth(), 1);
        let mn = 1;
        while (cur <= end) {
            det.subtasks.push({ id: msUid(), title: `${mn}. Ay — ${cur.toLocaleDateString('tr-TR', {month:'long', year:'numeric'})}`, done: false, date: `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-01` });
            cur.setMonth(cur.getMonth() + 1); mn++;
        }
    }
}

// ⑤ Tüm milestone'ları accordion'da göster
function _wzRenderMilestoneAccordion() {
    const cat = getCat(wizardState.goal.category);

    // Nav butonlarını gizle (accordion navigation'ı yer alıyor)
    document.getElementById('pg-wz-s4-prev')?.style.setProperty('display','none');
    document.getElementById('pg-wz-s4-next')?.style.setProperty('display','none');
    document.getElementById('pg-wz-s4-ms-dots')?.style.setProperty('display','none');
    document.getElementById('pg-wz-s4-cal-panel')?.classList.add('is-hidden');

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
                <span class="pg-wz-acc-num">${idx+1}</span>
                <span class="pg-wz-acc-icon">${ms.icon}</span>
                <div class="pg-wz-acc-info">
                    <span class="pg-wz-acc-name">${window.esc(ms.title)}</span>
                    <span class="pg-wz-acc-due">${ms.due_date ? fmtShort(ms.due_date) : '—'}</span>
                </div>
                <div class="pg-wz-acc-badges">
                    ${subs.length > 0 ? `<span class="pg-wz-acc-count">${subs.length} görev</span>` : ''}
                    ${det.criteria ? `<span class="pg-wz-acc-crit-badge">✓</span>` : ''}
                </div>
                <i class="ti ti-chevron-down pg-wz-acc-chevron" aria-hidden="true"></i>
            </div>
            <div class="pg-wz-acc-body">
                <div class="pg-wz-acc-content" id="pg-wz-acc-content-${idx}"></div>
            </div>
        </div>`;
    }).join('');

    taskArea.querySelectorAll('.pg-wz-acc-num').forEach(el2 => {
        el2.style.background = cat.color + '18';
        el2.style.color = cat.color;
    });
    taskArea.querySelectorAll('.pg-wz-acc-name').forEach(el2 => { el2.style.color = cat.color; });
    taskArea.querySelectorAll('.pg-wz-acc-count').forEach(el2 => {
        el2.style.background = cat.color + '22';
        el2.style.color = cat.color;
    });

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
            ${datedCount > 0 ? `<span class="u-color-h60a5fa"><i class="ti ti-calendar-check" aria-hidden="true"></i> ${datedCount} tarihli</span>` : ''}
            <span><i class="ti ti-calendar" aria-hidden="true"></i> ${totalDays} günlük aralık</span>
            ${subs.length > 0 && totalDays > 0 ? `<span class="pg-wz-s4-workload-cov"><i class="ti ti-chart-bar" aria-hidden="true"></i> ${Math.round((datedCount/totalDays)*100)}% kapsama</span>` : ''}
        </div>` : ''}
        <div class="pg-wz-s4-task-section">
            <div class="pg-wz-s4-task-section-label">
                <i class="ti ti-checklist" aria-hidden="true"></i>
                Görevler
            </div>
            ${_wzRenderCapacityBar(subs, cat)}
            ${suggestions.length ? `<div class="pg-wz-s4-suggestions">
                ${suggestions.map(s => `<div class="pg-wz-s4-sug-chip${subs.some(st=>st.title===s)?' selected':''}"
                    data-sug="${window.esc(s)}">
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
                <button class="pg-wz-s4-add-task-btn" type="button">
                    <i class="ti ti-plus" aria-hidden="true"></i> Ekle
                </button>
            </div>
            <div class="pg-wz-s4-task-charcount"><span class="pg-wz-s4-task-charcount-val">0</span>/100</div>
            <div class="pg-wz-s4-task-list">${_wzRenderAccTaskItems(subs, cat)}</div>
        </div>`;

    _wzApplyAccContentColors(contentEl, cat, subs);
    _wzBindAccContent(contentEl, ms, det, cat, idx);
    setTimeout(_wzBindInfoBtns, 0);
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
            else subs.push({ id: msUid(), title, done: false, date: '' });
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
        wizardState.msDet[ms.id].subtasks.push({ id: msUid(), title: val, done: false, date, timeStart, timeEnd });
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
    if (list) { list.innerHTML = _wzRenderAccTaskItems(det.subtasks || [], cat); _wzApplyAccTaskItemColors(list, cat); }
    // Yoğunluk/İlerleme çubuğunu güncelle
    const capRow = el.querySelector('.pg-wz-s4-capacity-row');
    const capHtml = _wzRenderCapacityBar(det.subtasks || [], cat);
    if (capRow) {
        if (capHtml) { capRow.outerHTML = capHtml; _wzApplyCapacityColors(el, cat); }
        else capRow.remove();
    } else if (capHtml) {
        el.querySelector('.pg-wz-s4-task-section-label')?.insertAdjacentHTML('afterend', capHtml);
        _wzApplyCapacityColors(el, cat);
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
    if (badge) {
        badge.innerHTML = `
            ${det.subtasks?.length > 0 ? `<span class="pg-wz-acc-count">${det.subtasks.length} görev</span>` : ''}
            ${det.criteria ? `<span class="pg-wz-acc-crit-badge">✓</span>` : ''}`;
        const countEl = badge.querySelector('.pg-wz-acc-count');
        if (countEl) { countEl.style.background = cat.color + '22'; countEl.style.color = cat.color; }
    }
}

// (Not: burada bir önceki _wzFlushS4Details tanımı vardı — orijinal planning.js'te
// aynı isimli ikinci bir tanım daha vardı (aşağıda) ve fonksiyon hoisting'i
// nedeniyle o zaten geçersiz kılıyordu; ES modülünde duplicate top-level function
// declaration SyntaxError verdiği için bu ölü/no-op ilk tanım kaldırıldı.)

// _wzRenderMsPlanner'dan ayrılan: aşama başlığı + takvim-göster panelini render eder.
// Faz S devamı, dev fonksiyon refactoru.
function _wzRenderMsHeader(idx, ms, cat) {
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
                <span class="pg-wz-s4-ms-num">${idx+1}/${wizardState.milestones.length}</span>
                <span class="pg-wz-s4-ms-icon">${ms.icon}</span>
                <div class="pg-wz-s4-ms-title-wrap">
                    <span class="pg-wz-s4-ms-name">${window.esc(ms.title)}</span>
                    ${ms.due_date ? `<span class="pg-wz-s4-ms-due"><i class="ti ti-calendar"></i> ${fmtDate(ms.due_date)}</span>` : ''}
                </div>
                <button class="pg-wz-s4-cal-toggle-btn" id="pg-wz-s4-cal-toggle" type="button">
                    <i class="ti ti-calendar-stats"></i> Takvimde Gör
                </button>
            </div>`;
        const msNumEl = header.querySelector('.pg-wz-s4-ms-num');
        if (msNumEl) { msNumEl.style.background = cat.color + '18'; msNumEl.style.color = cat.color; }
        const msNameEl = header.querySelector('.pg-wz-s4-ms-name');
        if (msNameEl) msNameEl.style.color = cat.color;
        header.querySelector('.pg-wz-s4-change-gran')?.addEventListener('click', () => {
            wizardState.planMode = null;
            const calPanel = document.getElementById('pg-wz-s4-cal-panel');
            if (calPanel) calPanel.classList.add('is-hidden');
            _wzRenderGranSelector();
        });
        header.querySelector('#pg-wz-s4-cal-toggle')?.addEventListener('click', () => {
            const panel = document.getElementById('pg-wz-s4-cal-panel');
            if (!panel) return;
            const open = !panel.classList.contains('is-hidden');
            if (open) {
                panel.classList.add('is-hidden');
                header.querySelector('#pg-wz-s4-cal-toggle').innerHTML = '<i class="ti ti-calendar-stats"></i> Takvimde Gör';
            } else {
                panel.classList.remove('is-hidden');
                const calWrap = document.getElementById('pg-wz-s4-cal-wrap');
                if (calWrap) {
                    calWrap.innerHTML = _wzPlannerCalHTML(ms, idx, cat, det);
                    _wzApplyPlannerCalColors(calWrap, cat);
                }
                header.querySelector('#pg-wz-s4-cal-toggle').innerHTML = '<i class="ti ti-x"></i> Kapat';
            }
        });
    }
}

// _wzRenderMsPlanner'dan ayrılan: başarı kriteri + görev ekleme alanını render eder.
// Faz S devamı, dev fonksiyon refactoru.
function _wzRenderMsTaskArea(ms, det, cat, idx) {
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
                    <i class="ti ti-checklist"></i>
                    Görevler
                    ${subtasks.length > 0 ? `<span class="pg-wz-s4-task-count">${subtasks.length}</span>` : ''}
                </div>
                <!-- Öneri chipler -->
                ${suggestions.length ? `<div class="pg-wz-s4-suggestions">
                    ${suggestions.map(s => `<div class="pg-wz-s4-sug-chip${subtasks.some(st=>st.title===s)?' selected':''}"
                        data-sug="${window.esc(s)}">
                        ${window.esc(s)}
                    </div>`).join('')}
                </div>` : ''}
                <!-- Görev girişi -->
                <div class="pg-wz-s4-task-input-row">
                    <input type="text" class="pg-wz-s4-task-inp" id="pg-wz-s4-task-inp"
                        placeholder="Görev ekle ve Enter'a bas..."
                        autocomplete="off" maxlength="100">
                    <button class="pg-wz-s4-add-task-btn" id="pg-wz-s4-add-btn" type="button">
                        <i class="ti ti-plus"></i>
                    </button>
                </div>
                <!-- Görev listesi -->
                <div class="pg-wz-s4-task-list" id="pg-wz-s4-task-list">
                    ${subtasks.length === 0
                        ? `<div class="pg-wz-s4-task-empty"><i class="ti ti-clipboard"></i> Henüz görev yok</div>`
                        : subtasks.map((st, i) => `
                            <div class="pg-wz-s4-task-item${st.done?' done':''}" data-stidx="${i}">
                                <div class="pg-wz-s4-task-check${st.done?' done':''}" data-check="${i}">
                                    ${st.done?'<i class="ti ti-check u-color-hfff_font-size-11px" ></i>':''}
                                </div>
                                <span class="pg-wz-s4-task-title">${window.esc(st.title)}</span>
                                <button class="pg-wz-s4-task-del" data-del="${i}" type="button">
                                    <i class="ti ti-x"></i>
                                </button>
                            </div>`).join('')
                    }
                </div>
            </div>`;

        _wzApplyMsTaskAreaColors(taskArea, cat);
        _wzBindS4TaskArea(taskArea, ms, det, cat, idx);
        setTimeout(_wzBindInfoBtns, 0);
    }
}

// Faz CSP: _wzRenderMsTaskArea'nın yerleştirdiği tüm dinamik style="..." değerlerini
// (kategori rengine bağlı) doğrudan .style özellik ataması ile uygular.
function _wzApplyMsTaskAreaColors(taskArea, cat) {
    const iconEl = taskArea.querySelector('.pg-wz-s4-task-section-label > i');
    if (iconEl) iconEl.style.color = cat.color;
    const countEl = taskArea.querySelector('.pg-wz-s4-task-count');
    if (countEl) { countEl.style.background = cat.color + '22'; countEl.style.color = cat.color; }
    taskArea.querySelectorAll('.pg-wz-s4-sug-chip.selected').forEach(chip => {
        chip.style.background = cat.color + '20';
        chip.style.borderColor = cat.color;
        chip.style.color = cat.color;
    });
    const addBtn = taskArea.querySelector('#pg-wz-s4-add-btn');
    if (addBtn) addBtn.style.background = cat.color;
    taskArea.querySelectorAll('.pg-wz-s4-task-check').forEach(chk => {
        if (chk.classList.contains('done')) {
            chk.style.background = cat.color;
            chk.style.borderColor = cat.color;
        } else {
            chk.style.borderColor = cat.color + '66';
        }
    });
}

function _wzRenderMsPlanner(idx) {
    wizardState.s4MsIdx = idx;
    const ms  = wizardState.milestones[idx];
    if (!ms) return;
    const cat = getCat(wizardState.goal.category);
    if (!wizardState.msDet[ms.id])
        wizardState.msDet[ms.id] = { criteria: '', subtasks: [], resources: '', expanded: false, planned_units: [] };
    const det = wizardState.msDet[ms.id];

    // Nav butonlarını görünür yap (granülasyon ekranında gizlenebilir)
    const prevBtnEl = document.getElementById('pg-wz-s4-prev');
    const nextBtnEl = document.getElementById('pg-wz-s4-next');
    if (prevBtnEl) prevBtnEl.style.visibility = idx > 0 ? 'visible' : 'hidden';
    if (nextBtnEl) nextBtnEl.style.visibility = 'visible';

    _wzRenderMsHeader(idx, ms, cat);


    _wzRenderMsTaskArea(ms, det, cat, idx);


    // ── İlerleme noktaları ───────────────────────────
    const dots = document.getElementById('pg-wz-s4-ms-dots');
    if (dots) {
        dots.innerHTML = wizardState.milestones.map((m, i) => {
            const d    = wizardState.msDet[m.id];
            const done = !!(d?.criteria || d?.subtasks?.length);
            return `<div class="pg-wz-s4-dot${i===idx?' active':''}${done?' done':''}"></div>`;
        }).join('');
        dots.querySelectorAll('.pg-wz-s4-dot.active').forEach(dotEl => {
            dotEl.style.background = cat.color;
            dotEl.style.boxShadow = `0 0 0 3px ${cat.color}33`;
        });
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
    if (calPanel) calPanel.classList.add('is-hidden');
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
                subs.push({ id: msUid(), title, done: false });
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
        wizardState.msDet[ms.id].subtasks.push({ id: msUid(), title: val, done: false });
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
                <div class="pg-wz-s4-task-check${st.done?' done':''}" data-check="${i}">
                    ${st.done?'<i class="ti ti-check u-color-hfff_font-size-11px" ></i>':''}
                </div>
                <span class="pg-wz-s4-task-title">${window.esc(st.title)}</span>
                <button class="pg-wz-s4-task-del" data-del="${i}" type="button"><i class="ti ti-x"></i></button>
            </div>`).join('');
    list.querySelectorAll('.pg-wz-s4-task-check').forEach(chk => {
        if (chk.classList.contains('done')) {
            chk.style.background = cat.color;
            chk.style.borderColor = cat.color;
        } else {
            chk.style.borderColor = cat.color + '66';
        }
    });

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

// ── Step 5 + Save ── planning-milestone-wizard-step5-save.js'e çıkarıldı (Faz H devamı, 2. tur).
