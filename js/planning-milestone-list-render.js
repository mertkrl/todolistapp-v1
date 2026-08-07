import { fmtDate } from './planning-utils.js';

let _msBound = false;

export function renderMilestoneList(goalId) {
    const goals = window._pgGetGoals();
    const g = goals.find(g=>g.id===goalId);
    const el = document.getElementById('pg-ms-list');
    if (!el||!g) return;
    const ms = g.milestones||[];
    if (ms.length===0) {
        el.innerHTML=`<div class="pg-ms-empty"><i class="ti ti-flag-off"></i>Henüz milestone yok.<br>Yukarıdan ekleyebilirsin.</div>`;
        return;
    }
    const isCollab = !!(g.collab_room_id && window.PlanningCollab?.isActive());
    el.innerHTML=ms.map(m=>{
        const dlLabel=m.due_date?fmtDate(m.due_date):'';
        const extras = typeof window.PlanningCollabMsExtras === 'function'
            ? window.PlanningCollabMsExtras(m.id, m.title)
            : '';
        const subs = m.subtasks||[];
        const subsDone = subs.filter(s=>s.done).length;
        const subsHTML = subs.length ? `
            <div class="pg-subtask-list">
                ${subs.map(s=>`<div class="pg-subtask-item${s.done?' done':''}">
                    <div class="pg-subtask-check${s.done?' done':''}" data-st-toggle="${s.id}" data-msid="${m.id}" data-gid="${goalId}"></div>
                    <span class="pg-subtask-title">${window.esc(s.title)}</span>
                    <button class="pg-subtask-del" data-st-del="${s.id}" data-msid="${m.id}" data-gid="${goalId}">×</button>
                </div>`).join('')}
            </div>` : '';
        return `<div class="pg-ms-item${m.done?' done':''}" data-msid="${m.id}" draggable="true">
            <div class="pg-ms-drag-handle" title="Sırala"><i class="ti ti-grip-vertical"></i></div>
            <div class="pg-ms-check${m.done?' done':''}" data-ms-toggle="${m.id}" data-gid="${goalId}" title="${m.done?'Geri al':'Tamamla'}"></div>
            <div class="pg-ms-body">
                <div class="pg-ms-title">${window.esc(m.title)}</div>
                ${m.description?`<div class="pg-ms-desc">${window.esc(m.description)}</div>`:''}
                <div class="pg-ms-meta">
                    ${dlLabel?`<span class="pg-ms-date-label"><i class="ti ti-calendar"></i> ${dlLabel}</span>`:''}
                    ${subs.length?`<span class="pg-ms-subtask-counter"><i class="ti ti-checklist"></i> ${subsDone}/${subs.length}</span>`:''}
                </div>
                ${subsHTML}
                <div class="pg-subtask-add-row">
                    <input type="text" class="pg-subtask-input" data-ms-st-inp="${m.id}" placeholder="+ Alt adım ekle..." maxlength="100">
                </div>
                ${extras}
            </div>
            <div class="pg-ms-actions">
                <button class="pg-ms-btn task-btn" data-ms-task="${m.id}" data-gid="${goalId}" title="Göreve Dönüştür"><i class="ti ti-arrow-right"></i></button>
                <button class="pg-ms-btn del-btn"  data-ms-del="${m.id}"  data-gid="${goalId}" title="Sil"><i class="ti ti-trash"></i></button>
            </div>
        </div>`;
    }).join('');
    _bindMilestoneEvents(el);
    _bindMilestoneDragSort(el, goalId);
    if (typeof window.PlanningCollabBindMsExtras === 'function')
        window.PlanningCollabBindMsExtras(el);
}
window.renderMilestoneList = renderMilestoneList;

function _bindMilestoneDragSort(el, goalId) {
    let dragSrc = null;
    el.addEventListener('dragstart', e => {
        dragSrc = e.target.closest('.pg-ms-item');
        if (!dragSrc) return;
        e.dataTransfer.effectAllowed = 'move';
        dragSrc.classList.add('pg-ms-dragging');
    });
    el.addEventListener('dragover', e => {
        e.preventDefault();
        const over = e.target.closest('.pg-ms-item');
        if (!over || over === dragSrc) return;
        e.dataTransfer.dropEffect = 'move';
        const rect = over.getBoundingClientRect();
        const after = e.clientY > rect.top + rect.height / 2;
        el.insertBefore(dragSrc, after ? over.nextSibling : over);
    });
    el.addEventListener('dragend', e => {
        if (!dragSrc) return;
        dragSrc.classList.remove('pg-ms-dragging');
        dragSrc = null;
        // DOM sıralamasını goals dizisine yansıt
        const goals = window._pgGetGoals();
        const g = goals.find(x=>x.id===goalId);
        if (!g) return;
        const newOrder = [...el.querySelectorAll('.pg-ms-item[data-msid]')].map(row => row.dataset.msid);
        g.milestones = newOrder.map((id,i) => {
            const ms = g.milestones.find(m=>m.id===id);
            if (ms) ms.order = i;
            return ms;
        }).filter(Boolean);
        g._dirty = true;
        window.persistGoals();
    });
}

function _bindMilestoneEvents(el) {
    // el her seferinde aynı #pg-ms-list DOM node'u, innerHTML değişiyor ama node sabit
    if (_msBound) return;
    _msBound = true;
    el.addEventListener('click', e => {
        const tog   = e.target.closest('[data-ms-toggle]');
        const task  = e.target.closest('[data-ms-task]');
        const del   = e.target.closest('[data-ms-del]');
        const stTog = e.target.closest('[data-st-toggle]');
        const stDel = e.target.closest('[data-st-del]');
        if (tog)   window.toggleMilestone(tog.dataset.gid, tog.dataset.msToggle);
        if (task)  window.milestoneToTask(task.dataset.gid, task.dataset.msTask);
        if (del)   window._deleteMilestoneWithUndo(del.dataset.gid, del.dataset.msDel);
        if (stTog) window.toggleSubtask(stTog.dataset.gid, stTog.dataset.msid, stTog.dataset.stToggle);
        if (stDel) window._deleteSubtaskWithUndo(stDel.dataset.gid, stDel.dataset.msid, stDel.dataset.stDel);
    });
    el.addEventListener('keydown', e => {
        const inp = e.target.closest('[data-ms-st-inp]');
        if (!inp || e.key !== 'Enter') return;
        const goals = window._pgGetGoals();
        const msId = inp.dataset.msStInp;
        const goalId = goals.find(g=>(g.milestones||[]).some(m=>m.id===msId))?.id;
        if (goalId && inp.value.trim()) { window.addSubtask(goalId, msId, inp.value); inp.value=''; }
    });
}
