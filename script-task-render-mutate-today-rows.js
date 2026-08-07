// script-task-render-mutate-today-rows.js
// script-task-render-mutate.js'ten çıkarıldı: renderTasks'in "Bugün" görev
// listesindeki tek satırlık widget'ları — her biri saf DOM üretimi, dışarıdan
// sadece todayStr/global veri alır, kendi #task-list'e ekler. Paylaşılan mutable
// state'e (draggedItemIndex vb.) dokunmuyor. Davranış birebir aynı, sadece konum
// değişti.

function _taskListEl() {
    return document.getElementById('task-list');
}

// FocusStorage'daki günün en önemli hedefi ("highlight") satırını görev
// listesinin başına ekler — sadece bugün için bir tane böyle kayıt varsa görünür.
export function renderHighlightGoalRow(todayStr) {
    const goals = window.__getGoalsRef();
    let highlightHistory = FocusStorage.get('highlight_history', {});
    const todayHighlight = highlightHistory[todayStr];
    if (!todayHighlight) return;

    let parentBadgeHTML = '';
    if (todayHighlight.parentGoal) {
        const pg = goals.find(g => String(g.id) === String(todayHighlight.parentGoal));
        if (pg) {
            parentBadgeHTML = `<span class="task-category-tag u-background-rgba108922310p1_color-var-primary-color_border-" ><i class="fa-solid fa-bullseye"></i> ${escapeHtml(pg.title)}</span>`;
        }
    }

    const hlLi = document.createElement('li');
    hlLi.className = `task-item highlight-task ${todayHighlight.completed ? 'completed' : ''}`;

    hlLi.innerHTML = `
        <div class="tl-time-col">
            <i class="fa-solid fa-star u-color-hff9f43_font-size-13px" title="Günün En Önemli 1 Şeyi"></i>
        </div>
        <div class="tl-rail">
            <span class="tl-rail-line"></span>
            <span class="tl-rail-dot u-border-color-hff9f43" ></span>
            <span class="tl-rail-line"></span>
        </div>
        <div class="tl-card">
            <div class="tl-card-inner u-border-color-rgba255159670p25_background-rgba255159670p04" >
                <div class="task-checkbox" data-action="toggle-highlight-task" data-date="${todayStr}"></div>
                <div class="task-left">
                    <span class="task-text" data-action="toggle-highlight-task" data-date="${todayStr}">${escapeHtml(todayHighlight.text)}</span>
                    <div class="task-meta">
                        <span class="task-category-tag u-background-rgba255159670p15_color-hff9f43_border-1pxsolidr" ><i class="fa-solid fa-star u-margin-right-4px" ></i>GÜNÜN HEDEFİ</span>
                        ${parentBadgeHTML}
                    </div>
                </div>
            </div>
        </div>
    `;
    _taskListEl().appendChild(hlLi);
}

// classroom_assignments (social.js, window.FocusAssignments) sistemin geri kalanıyla
// burada senkronlanır: normal görevlerden ayırt edilsin diye kendi ikonu/rengi var ve
// tıklanınca ilgili grubun Ödevler sekmesine götürür (checkbox ile tamamlanmaz).
export function renderTodayAssignmentRows(todayStr) {
    const taskList = _taskListEl();
    const todayAssignments = (window.FocusAssignments?.items || []).filter(a => {
        if (a.done || !a.due_date) return false;
        return window.formatDateToString(new Date(a.due_date)) === todayStr;
    });
    todayAssignments.forEach(a => {
        const overdue = new Date(a.due_date) < new Date();
        const asgColor = overdue ? '#ff6b6b' : '#a29bfe';
        const li = document.createElement('li');
        li.className = 'task-item';
        li.style.borderLeftColor = asgColor;
        li.style.background = `linear-gradient(90deg, ${overdue ? 'rgba(255, 107, 107, 0.05)' : 'rgba(162, 155, 254, 0.05)'} 0%, transparent 100%)`;
        li.style.cursor = 'pointer';
        li.innerHTML = `
            <div class="task-left">
                <i class="fa-solid fa-clipboard-list asg-icon u-margin-right-5px-2" title="Sınıf Ödevi"></i>
                <div class="task-checkbox asg-checkbox u-cursor-pointer" ></div>
                <span class="task-text">${escapeHtml(a.title)}</span>
                <div class="u-flex-basis-100pct_height-0"></div>
                <div class="task-meta">
                    <span class="task-category-tag asg-tag">${overdue ? 'ÖDEV · SÜRESİ GEÇTİ' : 'ÖDEV'}</span>
                    ${a.groupName ? `<span class="task-category-tag u-background-rgba108922310p1_color-var-primary-color_border-" >${escapeHtml(a.groupName)}</span>` : ''}
                </div>
            </div>
        `;
        const _asgIcon = li.querySelector('.asg-icon');
        if (_asgIcon) _asgIcon.style.color = asgColor;
        const _asgCheckbox = li.querySelector('.asg-checkbox');
        if (_asgCheckbox) _asgCheckbox.style.borderColor = asgColor;
        const _asgTag = li.querySelector('.asg-tag');
        if (_asgTag) {
            _asgTag.style.background = overdue ? 'rgba(255, 107, 107, 0.15)' : 'rgba(162, 155, 254, 0.15)';
            _asgTag.style.color = asgColor;
            _asgTag.style.border = overdue ? '1px solid rgba(255, 107, 107, 0.3)' : '1px solid rgba(162, 155, 254, 0.3)';
        }
        li.addEventListener('click', () => {
            if (typeof window.switchTab === 'function') window.switchTab('arkadaslar');
            if (typeof window.dcOpenAssignmentTab === 'function') window.dcOpenAssignmentTab(a.groupCode);
        });
        taskList.appendChild(li);
    });
}
