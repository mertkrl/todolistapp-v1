export function updateDailyProgress() {
    const circle = document.getElementById('daily-progress-circle');
    const progressText = document.getElementById('daily-progress-text');
    if(!progressText) return;

    const tasks = window.__getTasksRef();
    const todayStr = window.formatDateToString(new Date());
    const todayHabits = window.getHabitsForDate(todayStr);
    const todayTasks = tasks.filter(t => t.date === todayStr && !t.isLessonPlanDraft);

    let highlightHistory = window.FocusStorage.get('highlight_history', {});
    let highlightTotal = 0;
    let highlightCompleted = 0;

    if (highlightHistory[todayStr]) {
        highlightTotal = 1;
        if (highlightHistory[todayStr].completed) highlightCompleted = 1;
    }

    const totalTasks = todayTasks.length + todayHabits.length + highlightTotal;
    const completedTasks = todayTasks.filter(t => t.completed).length + todayHabits.filter(h => !!h.history[todayStr]).length + highlightCompleted;
    const percentage = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    if (circle) {
        const circumference = 175.9; // r=28, 2*π*28≈175.9
        circle.style.strokeDashoffset = circumference - (percentage / 100) * circumference;
    }

    // Mini donut (Tamamlanan kartı)
    const doneRing = document.getElementById('td-done-ring-circle');
    if (doneRing) {
        const dc = 113.1; // r=18, 2*π*18≈113.1
        doneRing.style.strokeDashoffset = dc - (percentage / 100) * dc;
    }

    const fill = document.getElementById('td-progress-fill');
    if (fill) {
        fill.style.width = percentage + '%';
    }

    progressText.textContent = `${percentage}%`;
    progressText.style.color = (percentage === 100 && totalTasks > 0) ? '#4ADE80' : '#ecc987';

    const ratio = document.getElementById('td-task-ratio');
    if (ratio) ratio.innerHTML = `${completedTasks}<span class="u-color-h6b665c"> / </span>${totalTasks}`;
    const totalCount = document.getElementById('td-total-count');
    if (totalCount) totalCount.textContent = `/ ${totalTasks}`;
}

export function updateStats() {
    const tasks = window.__getTasksRef();
    const pendingCountDisplay = document.getElementById('pending-count');
    const completedCountDisplay = document.getElementById('completed-count');

    const todayStr = window.formatDateToString(new Date());
    const todayHabits = window.getHabitsForDate(todayStr);
    const todayTasks = tasks.filter(t => t.date === todayStr && !t.isLessonPlanDraft);

    let highlightHistory = window.FocusStorage.get('highlight_history', {});
    let highlightTotal = 0;
    let highlightCompleted = 0;

    if (highlightHistory[todayStr]) {
        highlightTotal = 1;
        if (highlightHistory[todayStr].completed) highlightCompleted = 1;
    }

    const pending = todayTasks.filter(t => !t.completed).length + todayHabits.filter(h => !h.history[todayStr]).length + (highlightTotal - highlightCompleted);
    const completed = todayTasks.filter(t => t.completed).length + todayHabits.filter(h => !!h.history[todayStr]).length + highlightCompleted;

    const completedChip = completedCountDisplay ? completedCountDisplay.closest('.td-chip-done') : null;
    const pendingChip = pendingCountDisplay ? pendingCountDisplay.closest('.td-chip') : null;
    if (pendingChip) pendingChip.classList.toggle('td-chip-pending-active', pending > 0);
    window.animateCount(pendingCountDisplay, pending);
    window.animateCount(completedCountDisplay, completed, { celebrateChip: completedChip });
    updateDailyProgress();
    renderTodayGoalCard();
    renderTodayTaskSplit();

    // Görev bölümü meta: "X görev · HH:MM – HH:MM"
    const tasksMeta = document.getElementById('td-tasks-meta');
    if (tasksMeta) {
        const total = pending + completed;
        if (total > 0) {
            const times = todayTasks.map(t => t.timeStart).filter(Boolean).sort();
            const endTimes = todayTasks.map(t => t.timeEnd).filter(Boolean).sort();
            const firstTime = times[0] || null;
            const lastTime = endTimes[endTimes.length - 1] || null;
            tasksMeta.textContent = total + ' görev' + (firstTime && lastTime ? ' · ' + firstTime + ' – ' + lastTime : '');
        } else {
            tasksMeta.textContent = '';
        }
    }
}

export function renderTodayGoalCard() {
    const card = document.getElementById('today-goal-card');
    if (!card) return;
    card.style.display = 'none';
    return;
    const todayStr = window.formatDateToString(new Date());
    const highlightHistory = window.FocusStorage.get('highlight_history', {});
    const todayHighlight = highlightHistory[todayStr];
    if (!todayHighlight) {
        card.style.display = 'none';
        return;
    }
    card.style.display = 'flex';
    const isCompleted = todayHighlight.completed;
    const icon = isCompleted ? '✅' : '🎯';
    const tagColor = isCompleted
       ? { color: 'var(--g)', background: 'var(--g10,rgba(74,222,128,.1))', borderColor: 'rgba(74,222,128,.2)' }
       : { color: 'var(--a,#ff9f43)', background: 'rgba(255,159,67,.1)', borderColor: 'rgba(255,159,67,.2)' };
    const tagText = isCompleted ? 'Tamamlandı' : 'Günün Odağı';
    card.innerHTML = `
        <div class="u-font-size-26px_flex-shrink-0">${icon}</div>
        <div class="u-flex-1_min-width-0">
            <div class="u-font-size-11px_font-weight-600_letter-spacing-p5px_color-v">Günün Hedefi</div>
            <div class="today-goal-text u-font-size-14px_font-weight-600_line-height-1p4_color-hfff" >${window.escapeHtml(todayHighlight.text || '')}</div>
        </div>
        <span class="today-goal-tag u-padding-3px10px_border-radius-20px_font-size-11px_font-wei-2" >${tagText}</span>`;
   const _tgText = card.querySelector('.today-goal-text');
   if (_tgText && isCompleted) { _tgText.style.textDecoration = 'line-through'; _tgText.style.opacity = '.6'; }
   const _tgTag = card.querySelector('.today-goal-tag');
   if (_tgTag) {
       _tgTag.style.color = tagColor.color;
       _tgTag.style.background = tagColor.background;
       _tgTag.style.borderColor = tagColor.borderColor;
   }
}

export function renderTodayTaskSplit() {
    const tasks = window.__getTasksRef();
    const pendingList = document.getElementById('today-pending-list');
    const completedList = document.getElementById('today-completed-list');
    const pendingHd = document.getElementById('today-pending-hd');
    const completedHd = document.getElementById('today-completed-hd');
    if (!pendingList || !completedList) return;
    const todayStr = window.formatDateToString(new Date());
    const todayTasks = tasks.filter(t => t.date === todayStr && !t.isLessonPlanDraft);
    const pending = todayTasks.filter(t => !t.completed);
    const completed = todayTasks.filter(t => t.completed);
    if (pendingHd) pendingHd.textContent = `⏳ Bekleyen (${pending.length})`;
    if (completedHd) completedHd.textContent = `✅ Tamamlanan (${completed.length})`;
   const taskItem = (t) => `<div data-action="toggle-today-task" data-id="${t.id}" class="u-display-flex_align-items-center_gap-8px_padding-5px0_curso">
       <div class="today-split-checkbox u-width-16px_height-16px_border-radius-4px_display-flex_alig" >
           ${t.completed ? '✓' : ''}</div>
       <span class="today-split-text u-font-size-12px_color-hfff" >${window.escapeHtml(t.text)}</span>
   </div>`;
   const applyTaskItemStyles = (container, list) => {
       const rows = container.querySelectorAll(':scope > div[data-action="toggle-today-task"]');
       rows.forEach((row, i) => {
           const t = list[i];
           if (!t) return;
           const cb = row.querySelector('.today-split-checkbox');
           if (cb) {
               cb.style.border = t.completed ? '1.5px solid var(--g,#2ed573)' : '1.5px solid rgba(255,255,255,0.2)';
               cb.style.background = t.completed ? 'var(--g,#2ed573)' : 'transparent';
           }
           const txt = row.querySelector('.today-split-text');
           if (txt) {
               txt.style.textDecoration = t.completed ? 'line-through' : '';
               txt.style.opacity = t.completed ? '.5' : '';
           }
       });
   };
   pendingList.innerHTML = pending.length ? pending.map(taskItem).join('') : '<div class="u-font-size-12px_color-var-text-muted_padding-6px0">Tüm görevler tamamlandı 🎉</div>';
   completedList.innerHTML = completed.length ? completed.map(taskItem).join('') : '<div class="u-font-size-12px_color-var-text-muted_padding-6px0">Henüz tamamlanan yok</div>';
   applyTaskItemStyles(pendingList, pending);
   applyTaskItemStyles(completedList, completed);
    if (!pendingList.dataset.delegated) {
        pendingList.dataset.delegated = '1';
        pendingList.addEventListener('click', (e) => {
            const el = e.target.closest('[data-action="toggle-today-task"]');
            if (el) window.toggleTask(el.dataset.id);
        });
    }
    if (!completedList.dataset.delegated) {
        completedList.dataset.delegated = '1';
        completedList.addEventListener('click', (e) => {
            const el = e.target.closest('[data-action="toggle-today-task"]');
            if (el) window.toggleTask(el.dataset.id);
        });
    }
}
