import { getCat } from './planning-utils.js';
import { _pvBuildDayPanelMarkup } from './planning-day-panel-markup.js';
import { _pvJumpToWeekAtTask } from './planning-lesson-plan-route.js';
import { _pvHasUnresolvedConflicts, _pvUpdateConflictBanner } from './planning-lesson-plan-conflicts.js';
import { _pvMirrorTaskToMilestone, _pvUnmirrorTask } from './planning-lesson-plan-mirror.js';
import { _pvAutoFillTime } from './planning-plan-view-dom-fx.js';
import { _pvFindFreeSlot } from './planning-plan-view-time-utils.js';
import {
    _pvBusyConflict, _pvShowConflictModal, _pvGetCachedGroupMemberName, _pvGetSuppressBusyWarning,
} from './planning-lesson-plan-busy-slots.js';
import { _normYMD } from './planning-wizard.js';
import { toast } from './planning-toast-esc.js';

// planning.js dosyasından çıkarıldı (Faz devamı — dev fonksiyon refactoru).
// pvGoalId/pvUnsaved planning.js'in module-seviye state'i; window.__getPvGoalId/
// __getPvUnsaved/__setPvUnsaved köprüleri zaten vardı. _pvIsLessonPlan/
// persistGoals/_pvRenderMainCal window.* üzerinden çağrılıyor (zaten köprülüydüler,
// _pvRenderMainCal artık planning-pv-main-cal.js'te tanımlı).

// ── Right: Gün Detayı ────────────────────
window._pvRenderDayPanel = _pvRenderDayPanel; // planning-wizard.js için
function _pvRenderDayPanel(g, dateStr) {
    const el = document.getElementById('pg-pv-day-panel');
    if (!el) return;
    if (!dateStr) {
        el.innerHTML = `<div class="pg-pv-day-empty">
            <div class="pg-pv-day-empty-icon">📅</div>
            <div class="pg-pv-day-empty-text">Bir güne tıkla</div>
            <div class="pg-pv-day-empty-sub">Takvimden bir güne tıklayınca o günün özeti burada görünür</div>
        </div>`;
        return;
    }

    const cat = getCat(g.category);
    _pvBuildDayPanelMarkup(el, g, dateStr, cat);
    _pvBindDayTaskActionEvents(el, g, dateStr, cat);
    _pvBindDayAddTaskForm(el, g, dateStr);
}

// _pvRenderDayPanel'in HTML-inşa fazı — veriyi hesaplayıp el.innerHTML'i doldurur.
// planning-day-panel-markup.js'te tanımlı, buradan import ediliyor.
// Aşağıdaki _pvBindDayTaskActionEvents/_pvBindDayAddTaskForm bu markup'ın ÜZERİNE
// event bağlar (sıra önemli: önce DOM'a yazılmalı ki querySelectorAll elemanları bulabilsin).

// _pvRenderDayPanel'in event-bağlama fazı — _pvBuildDayPanelMarkup'ın yazdığı DOM
// üzerinde çalışır. cat sadece satır-içi düzenleme inputunun border rengi için gerekli.
// Gün Panelindeki görev kartlarının aksiyon butonları (çakışma atla/tamamla-
// onayla-sil-düzenle) — hepsi kendi data-attribute'ü üzerinden bağımsız çalışır.
function _pvBindDayTaskActionEvents(el, g, dateStr, cat) {
    const esc = window.esc;
    // Çakışma uyarı ikonu — haftalık görünümde ilgili saate atlar
    el.querySelectorAll('[data-conflict-jump]').forEach(icon => {
        icon.addEventListener('click', e => {
            e.stopPropagation();
            const tid = icon.dataset.conflictJump;
            const t = FocusStorage.get('tasks', []).find(x => x.id === tid);
            if (t) _pvJumpToWeekAtTask(g, t);
        });
    });

    // Toggle task done
    el.querySelectorAll('[data-dtcheck]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tid = btn.dataset.dtcheck;
            const tasks = FocusStorage.get('tasks', []);
            const t = tasks.find(x => x.id === tid);
            if (t) {
                t.completed = !t.completed;
                FocusStorage.set('tasks', tasks);
                if (typeof window.syncTasksFromStorage === 'function') window.syncTasksFromStorage();
                if (window.PlanningCollab?.channel)
                    window.PlanningCollab.broadcast('task_toggle', { taskId: tid, completed: t.completed, goalId: window.__getPvGoalId() });
                window.__setPvUnsaved(true);
            }
            _pvRenderDayPanel(g, dateStr);
        });
    });

    // ── Öneri 2: Approve pending task ────────────────────────
    el.querySelectorAll('[data-dtapprove]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tid = btn.dataset.dtapprove;
            const allT = FocusStorage.get('tasks', []);
            const t = allT.find(x => x.id === tid);
            if (!t) return;
            delete t._pending;
            FocusStorage.set('tasks', allT);
            if (typeof window.syncTasksFromStorage === 'function') window.syncTasksFromStorage();
            if (window.PlanningCollab?.channel)
                window.PlanningCollab.broadcast('task_approve', { taskId: tid, goalId: window.__getPvGoalId() });
            if (window.PlanningCollab?.isActive()) {
                const me2 = window.PlanningCollab._me();
                window.PlanningCollab._addActivity(window.PlanningCollab.roomId,
                    window.PlanningCollab._makeEntry(me2, 'approved', t.text));
                window.PlanningCollab._refreshActivityLog();
            }
            _pvRenderDayPanel(g, dateStr);
            window._pvRenderMainCal(g);
            toast('Görev onaylandı ✓', '#06d6a0');
        });
    });

    // Delete task
    el.querySelectorAll('[data-dtdel]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tid = btn.dataset.dtdel;
            const hadConflicts = _pvHasUnresolvedConflicts(g);
            // dateStr YYYY-MM-DD → DD-MM-YYYY (deleteGlobalTask expects DD-MM-YYYY)
            const [y, mo, dd] = dateStr.split('-');
            const dateDDMMYYYY = `${dd}-${mo}-${y}`;
            if (typeof window.deleteGlobalTask === 'function') {
                // tasks + calendarEvents + FocusStorage['events'] hepsini doğru temizler
                window.deleteGlobalTask(tid, dateDDMMYYYY);
            } else {
                const allT = FocusStorage.get('tasks', []);
                FocusStorage.set('tasks', allT.filter(x => x.id !== tid));
                if (typeof window.syncTasksFromStorage === 'function') window.syncTasksFromStorage();
            }
            if (window.PlanningCollab?.channel)
                window.PlanningCollab.broadcast('task_delete', { taskId: tid, goalId: window.__getPvGoalId() });
            _pvUnmirrorTask(g, tid);
            if (window._pvIsLessonPlan(g)) window.persistGoals(); else window.__setPvUnsaved(true);
            if (hadConflicts && !_pvHasUnresolvedConflicts(g)) toast('Tüm çakışmalar çözüldü ✓', '#06d6a0');
            _pvUpdateConflictBanner(g);
            _pvRenderDayPanel(g, dateStr);
            window._pvRenderMainCal(g);
        });
    });

    // Edit task (inline — metni input'a çeker, kaydedince günceller)
    el.querySelectorAll('[data-dtedit]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tid = btn.dataset.dtedit;
            const tasks = FocusStorage.get('tasks', []);
            const t = tasks.find(x => x.id === tid);
            if (!t) return;
            const row = btn.closest('[data-day-task]');
            const textEl = row?.querySelector('.pg-pv-task-text');
            if (!textEl) return;
            const oldText = t.text;
            textEl.innerHTML = `<input type="text" class="pg-pv-task-edit-inp u-flex-1_background-transparent_border-none_border-bottom-1p" value="${esc(oldText)}" >`;
            const inp = textEl.querySelector('input');
            if (inp) inp.style.borderBottomColor = cat.color;
            inp.focus(); inp.select();
            const save = () => {
                const newText = inp.value.trim();
                if (newText && newText !== oldText) {
                    t.text = newText;
                    FocusStorage.set('tasks', tasks);
                    if (typeof window.syncTasksFromStorage === 'function') window.syncTasksFromStorage();
                    if (typeof window.renderTasks === 'function') window.renderTasks();
                    if (String(t.parentGoal) === String(g.id)) _pvMirrorTaskToMilestone(g, t.id, t.text, _normYMD(t.date), t.timeStart, t.timeEnd);
                    if (window._pvIsLessonPlan(g)) window.persistGoals(); else window.__setPvUnsaved(true);
                }
                _pvRenderDayPanel(g, dateStr);
            };
            inp.addEventListener('blur', save);
            inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = oldText; inp.blur(); } });
        });
    });
}

// Gün Panelindeki saat aralığı + "yeni görev ekle" formu (yazıyor... broadcast'i
// ve çakışma kontrolü dahil).
function _pvBindDayAddTaskForm(el, g, dateStr) {
    // Saat aralığı paneli artık her modda (bireysel/ortaklaşa/ders planı) her zaman
    // görünür ve doğrudan doldurulur — ayrı aç/kapa butonu ve öncelik seçimi kaldırıldı,
    // görsel arayüz tüm hedef türlerinde birebir aynı olsun diye.
    const detailOpen = true;
    _pvAutoFillTime(dateStr);

    // Time-start change → auto-set end = start + 1h
    const startInp = el.querySelector('#pg-pv-day-time-start');
    const endInp   = el.querySelector('#pg-pv-day-time-end');
    startInp?.addEventListener('change', () => {
        const [h, m] = startInp.value.split(':').map(Number);
        const endH = Math.min(h + 1, 22);
        endInp.value = `${String(endH).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    });

    // ── Öneri 1: Typing broadcast ─────────────────────────────
    const _sendTyping = (() => {
        let _t = null;
        return () => {
            clearTimeout(_t);
            if (window.PlanningCollab?.isActive()) {
                const me = window.PlanningCollab._me();
                window.PlanningCollab.broadcast('typing', { dateStr, user_name: me.name, user_color: me.color });
            }
        };
    })();

    // Add new task
    const addInp = el.querySelector('#pg-pv-day-add-inp');
    const addBtn = el.querySelector('#pg-pv-day-add-btn');
    const addCharEl = el.querySelector('#pg-pv-day-add-char');
    addInp?.addEventListener('input', _sendTyping);
    if (addCharEl && addInp) {
        addInp.addEventListener('input', () => {
            const max = parseInt(addInp.getAttribute('maxlength')) || 100;
            addCharEl.textContent = `${addInp.value.length}/${max}`;
            addCharEl.classList.toggle('pg-pv-day-add-char-max', addInp.value.length >= max);
        });
    }
    const doAdd  = () => {
        const text = addInp?.value.trim();
        if (!text) return;

        let timeStart, timeEnd;
        if (detailOpen && startInp?.value) {
            // User manually set times
            timeStart = startInp.value;
            timeEnd   = endInp?.value || window._pvAddHour(startInp.value);
        } else {
            // Auto-find next free 1-hour slot
            const tasks = FocusStorage.get('tasks', []);
            const slot  = _pvFindFreeSlot(tasks, dateStr);
            timeStart   = slot.start;
            timeEnd     = slot.end;
        }

        const proceedAdd = () => {
        const pri = parseInt(el.querySelector('.pg-pv-day-pri-btn.selected')?.dataset.pri) || (g.priority || 2);

        // addGlobalTask expects DD-MM-YYYY (the app's internal date format)
        const [y, mo, dd] = dateStr.split('-');
        const dateDDMMYYYY = `${dd}-${mo}-${y}`;

        const newTaskId = 'dt_' + Date.now() + '_' + Math.random().toString(36).slice(2,5);
        let createdTaskId = newTaskId;
        // ── Öneri 2: Onay gerektiren durum ─────────────────────
        const collabActive = window.PlanningCollab?.isActive();
        const needsApproval = collabActive && window.PlanningCollab.isApprovalRequired() && window.PlanningCollab.myRole !== 'owner';
        const me = collabActive ? window.PlanningCollab._me() : null;
        const pvGoalId = window.__getPvGoalId();

        // Öğretmen henüz bir öğrenciye ATANMAMIŞ (lpa_id yok) bir ders planı üzerinde
        // çalışıyorsa — yani sadece plan taslağını kuruyorsa — görev yine gerçek `tasks`
        // deposuna yazılır (plan-editörünün kendi Gün Paneli/takvimi bunu okuyarak
        // çalışıyor), ama `isLessonPlanDraft` bayrağıyla işaretlenir ki öğretmenin KENDİ
        // "Bugün"/Takvim görünümlerinde (script.js) bu satırlar gizlenip sızıntı önlensin.
        const isLessonPlanAuthoring = window._pvIsLessonPlan(g) && !g.lpa_id;
        const draftFlag = isLessonPlanAuthoring ? { isLessonPlanDraft: true } : {};

        if (typeof window.addGlobalTask === 'function') {
            window.addGlobalTask(text, pri, g.category || '', dateDDMMYYYY, timeStart, timeEnd, '', pvGoalId);
            // Retrieve the just-added task to broadcast it
            const allT = FocusStorage.get('tasks', []);
            let added = allT.filter(t => t.text === text && t.parentGoal === pvGoalId && _normYMD(t.date) === dateStr).slice(-1)[0];
            if (added) {
                createdTaskId = added.id;
                if (needsApproval) {
                    // Mark as pending locally
                    added._pending = true;
                    added._addedBy = { id: me.id, name: me.name, color: me.color };
                }
                if (isLessonPlanAuthoring) {
                    Object.assign(added, draftFlag);
                    // calendarEvents ayrı bir depoda tutuluyor (tasks'tan bağımsız kopya) —
                    // ana takvim görünümü oradan okuyor, o yüzden aynı bayrak orada da işaretlenmeli.
                    const events = FocusStorage.get('events', {});
                    const dayEvents = events[dateDDMMYYYY] || [];
                    const ev = dayEvents.find(e => String(e.id) === String(added.id));
                    if (ev) { ev.isLessonPlanDraft = true; FocusStorage.set('events', events); }
                }
                if (needsApproval || isLessonPlanAuthoring) {
                    FocusStorage.set('tasks', allT);
                    if (typeof window.syncTasksFromStorage === 'function') window.syncTasksFromStorage();
                }
                if (window.PlanningCollab?.channel) {
                    const eventName = needsApproval ? 'task_pending' : 'task_add';
                    window.PlanningCollab.broadcast(eventName, {
                        task: added, user_name: me?.name, user_color: me?.color
                    });
                }
                if (!needsApproval && collabActive && me) {
                    window.PlanningCollab._addActivity(window.PlanningCollab.roomId,
                        window.PlanningCollab._makeEntry(me, 'task_add', text));
                    window.PlanningCollab._refreshActivityLog();
                }
            }
        } else {
            const newTask = { id: newTaskId, text, completed: false, date: dateDDMMYYYY,
                priority: pri, category: g.category || '', parentGoal: pvGoalId, timeStart, timeEnd,
                ...draftFlag,
                ...(needsApproval ? { _pending: true, _addedBy: { id: me.id, name: me.name, color: me.color } } : {}) };
            const tasks = FocusStorage.get('tasks', []);
            tasks.push(newTask);
            FocusStorage.set('tasks', tasks);
            if (window.PlanningCollab?.channel) {
                const eventName = needsApproval ? 'task_pending' : 'task_add';
                window.PlanningCollab.broadcast(eventName, { task: newTask, user_name: me?.name, user_color: me?.color });
            }
        }
        if (typeof window.renderTasks === 'function') window.renderTasks();
        if (typeof window.renderCalendarGlobal === 'function') window.renderCalendarGlobal();
        addInp.value = '';
        if (addCharEl) { addCharEl.textContent = `0/${addInp.getAttribute('maxlength') || 100}`; addCharEl.classList.remove('pg-pv-day-add-char-max'); }
        // Reset detail panel
        if (startInp) startInp.value = '09:00';
        if (endInp)   endInp.value   = '10:00';
        _pvMirrorTaskToMilestone(g, createdTaskId, text, dateStr, timeStart, timeEnd);
        if (window._pvIsLessonPlan(g)) window.persistGoals(); else window.__setPvUnsaved(true);
        _pvRenderDayPanel(g, dateStr);
        window._pvRenderMainCal(g);
        };

        if (window._pvIsLessonPlan(g) && !_pvGetSuppressBusyWarning()) {
            const conflict = _pvBusyConflict(dateStr, timeStart, timeEnd);
            if (conflict) {
                const studentName = conflict.student_id
                    ? _pvGetCachedGroupMemberName(conflict.student_id)
                    : null;
                _pvShowConflictModal({ timeStart, timeEnd, studentName, onConfirm: proceedAdd });
                return;
            }
        }
        proceedAdd();
    };
    addBtn?.addEventListener('click', doAdd);
    addInp?.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
}

export { _pvRenderDayPanel, _pvBindDayTaskActionEvents, _pvBindDayAddTaskForm };
