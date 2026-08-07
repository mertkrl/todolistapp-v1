import { _normYMD } from './planning-wizard.js';
import { _pvTimeToMin } from './planning-plan-view-time-utils.js';
import { _lpaOverlap, _pvRecomputeUnresolvedConflicts } from './planning-lesson-plan-conflicts.js';
import { getCurrentUser } from '../state/current-user-store.js';
// planning.js dosyasından çıkarıldı (Faz O devamı). _pvRenderDayPanel'in HTML-inşa
// fazı — sadece pvReadOnly/pvReadOnlyShowOwnTasks (window.__getPvReadOnly/
// __getPvReadOnlyShowOwnTasks köprüsü zaten var) ve parametre olarak gelen g/dateStr/cat'e
// bağımlı, event bağlama _pvBindDayTaskActionEvents/_pvBindDayAddTaskForm ayrı kalıyor.
// esc/FocusStorage → zaten global (window.esc, window.FocusStorage), bare referans yeterli.

function _pvBuildDayPanelMarkup(el, g, dateStr, cat) {
    const esc = window.esc;
    const dateObj  = new Date(dateStr + 'T00:00:00');
    const dayName  = dateObj.toLocaleDateString('tr-TR', { weekday: 'long' });
    const dateLbl  = dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    const today    = new Date().toISOString().split('T')[0];
    const isToday  = dateStr === today;

    const ms = (g.milestones || []).find(m => m.due_date === dateStr);

    let allTasks = FocusStorage.get('tasks', []);
    const dayTasks = g.lpa_id
        ? allTasks.filter(t => _normYMD(t.date) === dateStr)
        : allTasks.filter(t => _normYMD(t.date) === dateStr && String(t.parentGoal) === String(g.id));
    dayTasks.sort((a, b) => {
        if (!a.timeStart && !b.timeStart) return 0;
        if (!a.timeStart) return 1;
        if (!b.timeStart) return -1;
        return _pvTimeToMin(a.timeStart) - _pvTimeToMin(b.timeStart);
    });
    const conflictTaskIds = g.lpa_id
        ? new Set(_pvRecomputeUnresolvedConflicts(g).flatMap(c => [c.lesson.id, c.own.id]))
        : new Set();

    const DAILY_LIMIT_MIN = 480;
    const occupiedMins = new Set();
    allTasks
        .filter(t => _normYMD(t.date) === dateStr && t.timeStart && t.timeEnd && !t._pending
                  && String(t.parentGoal) === String(g.id))
        .forEach(t => {
            const s = _pvTimeToMin(t.timeStart);
            const e = _pvTimeToMin(t.timeEnd);
            for (let m = s; m < e; m++) occupiedMins.add(m);
        });
    const usedMin = occupiedMins.size;
    const pct      = Math.min(100, Math.round(usedMin / DAILY_LIMIT_MIN * 100));
    const isFull   = pct >= 100;
    const remMin   = Math.max(0, DAILY_LIMIT_MIN - usedMin);
    const isPremiumUser = getCurrentUser()?.plan === 'premium'
        || ['student', 'teacher'].includes(getCurrentUser()?.institutionRole);
    const barColor = isFull ? (isPremiumUser ? '#ff9f43' : '#ff4757') : pct >= 75 ? '#ff9f43' : '#06d6a0';
    const usedH    = Math.floor(usedMin / 60), usedM = usedMin % 60;
    const remH     = Math.floor(remMin / 60),  remM  = remMin % 60;
    const usedLbl  = usedM ? `${usedH}s ${usedM}dk` : `${usedH}s`;
    const blocksAdd = isFull && !isPremiumUser;
    const remLbl   = isFull ? 'Dolu' : (remM ? `${remH}s ${remM}dk` : `${remH}s`);
    const segsHtml = Array.from({length:8},(_,i)=>
        `<div class="pg-pv-capacity-seg u-flex-1_height-3px_border-radius-2px" data-seg-on="${i<Math.min(8,Math.floor(usedMin/60)) ? '1' : '0'}" ></div>`
    ).join('');
    const capacityLabel = isPremiumUser ? 'Yoğunluk' : 'Kapasite';
    const capacityWarnIcon = isFull
        ? (isPremiumUser
            ? `<span class="pg-pv-capacity-warn-icon u-font-size-10px" data-warn-color="#ff9f43" title="Bu gün yoğun planlanmış — küçük bir mola iyi gelebilir 🌙">🌙</span>`
            : `<span class="pg-pv-capacity-warn-icon u-font-size-10px" data-warn-color="#ff4757" title="Bu gün dolu — yeni görev eklenemez">🔥</span>`)
        : '';
    const capacityHtml = `
        <div class="u-display-flex_align-items-center_gap-8px_margin-10px08px_pa">
            <span class="u-font-size-10px_color-var-text-mutedh888_white-space-nowrap">${capacityLabel}</span>
            <div class="u-flex-1_display-flex_gap-2px">${segsHtml}</div>
            <span class="pg-pv-capacity-used-lbl u-font-size-10px_font-weight-600_white-space-nowrap_flex-shr" >${usedLbl} / 8s${(isFull && !isPremiumUser) ? '' : ` · ${remLbl} kaldı`}</span>
            ${capacityWarnIcon}
        </div>`;


    let typingHtml = '';
    let typers = [];
    if (window.PlanningCollab?.isActive()) {
        const peerState = window.PlanningCollab.getPeerState();
        typers = Object.values(peerState).filter(p => p.typingDay === dateStr);
        if (typers.length) {
            typingHtml = `<div class="pg-pv-typing-indicator">
                ${typers.map((p,pIdx) => `<span class="pg-pv-typing-avatar" data-typer-idx="${pIdx}">${esc((p.name||'?').slice(0,2).toUpperCase())}</span>`).join('')}
                <span class="pg-pv-typing-text">${typers.map(p=>esc(p.name)).join(', ')} yazıyor</span>
                <span class="pg-pv-typing-dots"><span></span><span></span><span></span></span>
            </div>`;
        }
    }

    const isOwner = (window.PlanningCollab?.myRole || 'owner') === 'owner';
    const approvalOn = window.PlanningCollab?.isActive() && window.PlanningCollab?.isApprovalRequired();

    const tasksHtml = dayTasks.length
        ? dayTasks.map(t => {
            const isPending = !!t._pending;
            const addedBy   = t._addedBy;
            const addedByBadge = addedBy
                ? `<span class="pg-pv-task-mini-avatar" data-added-by-id="${esc(t.id)}" data-name="${esc(addedBy.name)} ekledi">${esc((addedBy.name||'?').slice(0,2).toUpperCase())}</span>`
                : '';
            const pendingActions = isPending && isOwner
                ? `<button class="pg-pv-task-act-btn approve" data-dtapprove="${t.id}" title="Onayla"><i class="ti ti-check"></i></button>
                   <button class="pg-pv-task-act-btn danger" data-dtdel="${t.id}" title="Reddet"><i class="ti ti-x"></i></button>`
                : (!isPending
                    ? `<button class="pg-pv-task-act-btn" data-dtedit="${t.id}" title="Düzenle"><i class="ti ti-pencil"></i></button>
                       <button class="pg-pv-task-act-btn danger" data-dtdel="${t.id}" title="Sil"><i class="ti ti-trash"></i></button>`
                    : `<span class="pg-pv-task-pending-badge"><i class="ti ti-clock"></i> Onay bekleniyor</span>`);
            const timeHtml = t.timeStart
                ? `<span class="pg-pv-task-time">${(t.timeStart||'').slice(0,5)}${t.timeEnd ? `–${t.timeEnd.slice(0,5)}` : ''}</span>`
                : '';
            const isConflict = conflictTaskIds.has(t.id);
            return `
            <div class="pg-pv-day-task-row${t.completed ? ' done' : ''}${isPending ? ' pg-pv-task-pending' : ''}${isConflict ? ' pg-pv-day-task-row-conflict' : ''}" data-day-task="${t.id}">
                <div class="pg-pv-day-task-check${t.completed ? ' done' : ''}${isPending ? ' disabled' : ''}" ${isPending ? '' : `data-dtcheck="${t.id}"`}>${t.completed ? '✓' : ''}</div>
                ${timeHtml}
                <span class="pg-pv-task-text">${esc(t.text)}</span>
                ${addedByBadge}
                ${isConflict ? `<i class="ti ti-alert-triangle pg-pv-day-task-conflict-jump" data-conflict-jump="${t.id}" title="Çakışan saat — haftalık görünümde göster"></i>` : ''}
                <div class="pg-pv-task-actions">${pendingActions}</div>
            </div>`;
        }).join('')
        : `<div class="pg-pv-day-no-tasks">Bu gün için görev yok</div>`;

    const msSubsHtml = ms && (ms.subtasks||[]).length ? `
        <div class="pg-pv-day-section">
            <div class="pg-pv-day-section-label"><i class="ti ti-checklist"></i> Aşama Alt Görevleri</div>
            <div class="pg-pv-day-tasks-list">
                ${(ms.subtasks||[]).map(s => `
                    <div class="pg-pv-day-task-row${s.done ? ' done' : ''}">
                        <div class="pg-pv-day-task-check${s.done ? ' done' : ''}">${s.done ? '✓' : ''}</div>
                        <span>${esc(s.title)}</span>
                    </div>`).join('')}
            </div>
        </div>` : '';

    let ownTasksHtml = '';
    const pvReadOnly = window.__getPvReadOnly();
    const pvReadOnlyShowOwnTasks = window.__getPvReadOnlyShowOwnTasks();
    if (pvReadOnly && pvReadOnlyShowOwnTasks) {
        const ownTasks = allTasks.filter(t => _normYMD(t.date) === dateStr && String(t.parentGoal) !== String(g.id) && !String(t.id).startsWith('lpa_prev_task_'));
        ownTasksHtml = `
        <div class="pg-pv-day-section pg-pv-own-tasks-section">
            <div class="pg-pv-day-section-label"><i class="ti ti-user"></i> Bu Gün İçin Kendi Programın</div>
            <div class="pg-pv-day-tasks-list">
                ${ownTasks.length ? ownTasks.map(t => {
                    const conflict = t.timeStart && t.timeEnd && dayTasks.some(dt => dt.timeStart && dt.timeEnd && _lpaOverlap(t.timeStart, t.timeEnd, dt.timeStart, dt.timeEnd));
                    const timeHtml2 = t.timeStart ? `<span class="pg-pv-task-time">${t.timeStart}${t.timeEnd ? '–' + t.timeEnd : ''}</span>` : '';
                    return `
                    <div class="pg-pv-day-task-row pg-pv-own-task-row${conflict ? ' conflict' : ''}">
                        ${timeHtml2}
                        <span class="pg-pv-task-text">${esc(t.text)}</span>
                        ${conflict ? '<span class="pg-pv-own-task-conflict-badge" title="Öğretmeninin planıyla saat çakışıyor"><i class="ti ti-alert-triangle"></i> Çakışıyor</span>' : ''}
                    </div>`;
                }).join('') : '<div class="pg-pv-day-no-tasks">Bu gün için kendi görevin yok.</div>'}
            </div>
        </div>`;
    }

    el.innerHTML = `
        <div class="pg-pv-day-header">
            <div class="pg-pv-day-date-big">${isToday ? 'Bugün' : dateLbl}</div>
            <div class="pg-pv-day-date-sub">
                <span>${isToday ? dateLbl : dayName}</span>
            </div>
        </div>

        ${capacityHtml}

        <div class="pg-pv-day-section u-margin-top-12px" >
            <div class="pg-pv-day-section-label"><i class="ti ti-list-check"></i> Günün Görevleri</div>
            ${typingHtml}
            <div class="pg-pv-day-tasks-list" id="pg-pv-day-tasks-list">${tasksHtml}</div>
        </div>

        ${ownTasksHtml}

        ${msSubsHtml}

        ${blocksAdd ? '' : `<div class="pg-pv-day-add-task pg-pv-day-add-task-lp" id="pg-pv-day-add-task">
            <div class="pg-pv-day-add-row">
                <input type="text" class="pg-pv-day-add-inp" id="pg-pv-day-add-inp"
                    placeholder="Görev ekle… (Enter)" autocomplete="off" maxlength="60">
                <button class="pg-pv-day-add-btn" id="pg-pv-day-add-btn">+ Ekle</button>
            </div>
            <div class="pg-pv-day-add-char" id="pg-pv-day-add-char">0/60</div>
            <div class="pg-pv-day-detail-panel" id="pg-pv-day-detail-panel">
                <div class="pg-pv-day-detail-row">
                    <label class="pg-pv-day-detail-label"><i class="ti ti-clock"></i></label>
                    <div class="pg-pv-day-detail-time-row">
                        <input type="time" class="pg-pv-day-time-inp" id="pg-pv-day-time-start" value="09:00">
                        <span class="pg-pv-day-time-sep">–</span>
                        <input type="time" class="pg-pv-day-time-inp" id="pg-pv-day-time-end" value="10:00">
                    </div>
                </div>
            </div>
        </div>`}`;

    el.querySelectorAll('[data-seg-on]').forEach(seg => {
        seg.style.background = seg.dataset.segOn === '1' ? barColor : 'rgba(128,128,128,.15)';
    });
    const usedLblEl = el.querySelector('.pg-pv-capacity-used-lbl');
    if (usedLblEl) usedLblEl.style.color = barColor;
    const warnIconEl = el.querySelector('.pg-pv-capacity-warn-icon');
    if (warnIconEl) warnIconEl.style.color = warnIconEl.dataset.warnColor;
    typers.forEach((p, pIdx) => {
        const avEl = el.querySelector(`[data-typer-idx="${pIdx}"]`);
        if (avEl) avEl.style.background = p.color||'#888';
    });
    dayTasks.forEach(t => {
        if (!t._addedBy) return;
        const avEl = el.querySelector(`[data-added-by-id="${CSS.escape(String(t.id))}"]`);
        if (avEl) avEl.style.background = t._addedBy.color||'#888';
    });
}

window._pvBuildDayPanelMarkup = _pvBuildDayPanelMarkup;
export { _pvBuildDayPanelMarkup };
