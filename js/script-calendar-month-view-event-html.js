// script-calendar-month-view.js'ten çıkarıldı: renderEvents'in HTML üretim
// yardımcıları (highlight kartları, alışkanlık bandı, görev/milestone timeline
// kartları) — hepsi kendi parametrelerine + import edilen ref getter'lara/
// window.escapeHtml/window.formatDateToString/monthNamesShort'a ihtiyaç duyuyor,
// paylaşılan mutable state'e dokunmuyor.
import { getGoalsRef, getTasksRef, getHabitsRef, getPriorityLabelsRef } from './script.js';

export function _evBuildHighlightHtml(highlightList) {
    let html = '';
   highlightList.forEach(hl => {
     const isCompleted = hl.data.completed;
     const hlDateStr = hl.date;
     const [d, m, y] = hlDateStr.split('-');
     const shortDate = `${parseInt(d)} ${window.monthNamesShort[parseInt(m)-1]} ${y}`;

     let parentBadgeHTML = '';
     if (hl.data.parentGoal) {
         const pg = getGoalsRef().find(g => String(g.id) === String(hl.data.parentGoal));
         if (pg) {
             parentBadgeHTML = `<span class="u-font-size-10px_background-rgba108922310p15_color-ha29bfe_p"><i class="fa-solid fa-mountain-sun"></i> ${window.escapeHtml(pg.title)}</span>`;
         }
     }

     html += `
     <li class="u-list-style-none_margin-bottom-16px">
         <div class="cal-highlight-card ${isCompleted ? 'cal-highlight-done' : ''}">
             <div class="cal-highlight-top">
                 <div class="cal-highlight-icon-wrap">
                     <i class="fa-solid fa-star"></i>
                 </div>
                 <div class="u-flex-1_min-width-0">
                     <div class="u-font-size-10px_font-weight-700_letter-spacing-1p5px_color-">✦ Günün Odak Hedefi</div>
                     <div class="cal-highlight-text u-font-size-15px_font-weight-700_line-height-1p4_word-break-" data-completed="${isCompleted ? '1' : '0'}">${hl.data.text}</div>
                     <div class="u-margin-top-8px_display-flex_gap-6px_flex-wrap-wrap_align-i">
                         <span class="u-font-size-10px_background-rgba2552552550p05_color-var-text"><i class="fa-regular fa-calendar u-margin-right-4px" ></i>${shortDate}</span>
                         ${parentBadgeHTML}
                         ${isCompleted ? '<span class="u-font-size-10px_background-rgba462131150p15_color-h2ed573_p"><i class="fa-solid fa-circle-check"></i> Tamamlandı</span>' : ''}
                     </div>
                 </div>
                 <button class="cal-highlight-check-btn ${isCompleted ? 'done' : ''}" data-action="toggle-highlight-task" data-date="${hlDateStr}" title="${isCompleted ? 'Geri al' : 'Tamamla'}">
                     ${isCompleted ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-regular fa-circle-check"></i>'}
                 </button>
             </div>
         </div>
     </li>`;
     });
    return html;
}

export function _evRenderHabitsBand(dayHabits, check, searchQuery) {
    // 2. ALIŞKANLIKLARI YATAY BANDA YAZDIR (YENİ)
    const calHabitsBand = document.getElementById('calendar-habits-band');
    const calHabitsList = document.getElementById('calendar-habits-list');

    if (calHabitsBand && calHabitsList) {
        if (dayHabits.length > 0 && searchQuery === '') {
            calHabitsBand.style.display = 'block';
            let habitsHTML = '';
            const todayStrForHabit = window.formatDateToString(new Date());

            dayHabits.forEach(habit => {
                const isCompleted = !!habit.history[check];
                const isFutureDate = check > todayStrForHabit;
                const clickAttr = isFutureDate ? '' : `data-action="toggle-habit-today" data-id="${habit.id}" data-date="${check}"`;

                let checkIcon = isCompleted ? '<i class="fa-solid fa-circle-check u-color-h2ed573_font-size-16px-2" ></i>' :
                               (isFutureDate ? '<i class="fa-solid fa-lock u-color-var-text-muted_opacity-0p6_font-size-16px" ></i>' : '<i class="fa-regular fa-circle u-color-var-text-muted_font-size-16px" ></i>');

                habitsHTML += `
                <div class="cal-habit-band-card ${isCompleted ? 'completed' : ''}" ${clickAttr} data-future="${isFutureDate ? '1' : '0'}">
                    <div>${checkIcon}</div>
                    <div class="cal-habit-band-name u-flex-1_overflow-hidden_text-overflow-ellipsis_white-space-" data-completed="${isCompleted ? '1' : '0'}">${window.escapeHtml(habit.name)}</div>
                </div>`;
            });
            calHabitsList.innerHTML = habitsHTML;
            calHabitsList.querySelectorAll('.cal-habit-band-card[data-future="1"]').forEach(el => {
                el.style.opacity = '0.6';
                el.style.cursor = 'not-allowed';
            });
            calHabitsList.querySelectorAll('.cal-habit-band-name').forEach(el => {
                if (el.dataset.completed === '1') {
                    el.style.textDecoration = 'line-through';
                    el.style.opacity = '0.7';
                } else {
                    el.style.color = '#fff';
                }
            });
        } else {
            calHabitsBand.style.display = 'none';
            calHabitsList.innerHTML = '';
        }
    }
}

export function _evBuildEventsHtml(dayEvents, check) {
     return dayEvents.map((ev) => {
         // F1.2 — Planlama milestone event'leri özel render
         if (ev.isMilestone) {
             const msId = ev.id.replace('ms_cal_', '');
             const mColor = ev.milestoneColor || '#a78bfa';
             const planningGoals = (typeof FocusStorage !== 'undefined')
                 ? FocusStorage.get('planning_goals', [])
                 : JSON.parse(localStorage.getItem('planning_goals') || '[]', window._safeJsonReviver);
             let msDone = false;
             for (const g of planningGoals) {
                 const ms = (g.milestones || []).find(m => m.id === msId);
                 if (ms) { msDone = !!ms.done; break; }
             }
             return `
             <li class="cal-event-item${msDone ? ' completed' : ''}" data-ms-color="${mColor}">
                 <div class="tc-time-pill" data-ms-color-text="${mColor}">
                     <i class="fa-solid fa-flag-checkered"></i> Milestone
                 </div>
                 <div class="timeline-card" data-ms-color-border33="${mColor}">
                     <div class="tc-glow-bar" data-ms-color-bg="${mColor}"></div>
                     <div class="tc-inner">
                         <div class="tc-checkbox${msDone ? ' tc-checked' : ''}" data-ms-checkbox-color="${mColor}" data-ms-done="${msDone ? '1' : '0'}"
                              data-action="toggle-planning-milestone" data-id="${ev.id}">
                             ${msDone ? '<i class="fa-solid fa-check"></i>' : ''}
                         </div>
                         <div class="tc-content">
                             <div class="tc-title${msDone ? ' tc-done' : ''}" data-ms-done="${msDone ? '1' : '0'}">${ev.text}</div>
                             <div class="tc-meta">
                                 <span class="tc-badge" data-ms-color-badge="${mColor}"><i class="fa-solid fa-flag-checkered"></i> Dönüm Noktası</span>
                                 <span class="tc-badge u-cursor-pointer_opacity-p6" data-action="switch-tab-planlama">Planlamaya Git →</span>
                             </div>
                         </div>
                     </div>
                 </div>
             </li>`;
         }

         const globalTask = getTasksRef().find(t => String(t.id) === String(ev.id));
         const isCompleted = globalTask ? globalTask.completed : false;

         const evTimeStart = ev.timeStart || ev.time || "12:00";
         const evTimeEnd = ev.timeEnd || "13:00";
         const evPriority = ev.priority || "medium";
         const priorityLabel = getPriorityLabelsRef()[evPriority] || "Orta";

         const evDate = (globalTask && globalTask.date) ? globalTask.date : (ev._searchDate || check);
         const [d, m, y] = evDate.split('-'); // GÜNCELLEME: d, m, y sırasına alındı
         const shortDate = `${parseInt(d)} ${window.monthNamesShort[parseInt(m)-1]}`;

         let parentBadgeHTML = '';
         if (ev.parentHabit) {
             const ph = getHabitsRef().find(h => String(h.id) === String(ev.parentHabit));
             if (ph) parentBadgeHTML = `<span class="parent-habit-badge u-font-size-10px_padding-2px8px" ><i class="fa-solid fa-bullseye"></i> ${window.escapeHtml(ph.name)}</span>`;
         }

         const priorityColors = { 'high': '#ff4757', 'medium': '#ff9f43', 'low': '#2ed573' };
         const pColor = priorityColors[evPriority] || '#ff9f43';

         return `
         <li class="cal-event-item priority-${evPriority}${isCompleted ? ' completed' : ''}" draggable="true" data-drag-id="${ev.id}">
             <div class="tc-time-pill">
                 <i class="fa-regular fa-clock"></i> ${evTimeStart} <span class="tc-sep">→</span> ${evTimeEnd}
             </div>
             <div class="timeline-card">
                 <div class="tc-glow-bar"></div>
                 <div class="tc-inner">
                     <div class="tc-checkbox${isCompleted ? ' tc-checked' : ''}" data-action="toggle-task" data-id="${ev.id}">
                         ${isCompleted ? '<i class="fa-solid fa-check"></i>' : ''}
                     </div>
                     <div class="tc-content">
                         <div class="tc-title${isCompleted ? ' tc-done' : ''}">${ev.text}</div>
                         <div class="tc-meta">
                             <span class="tc-badge tc-prio-${evPriority}"><i class="fa-solid fa-circle-dot"></i> ${priorityLabel}</span>
                             <span class="tc-badge tc-badge-date"><i class="fa-regular fa-calendar"></i> ${shortDate}</span>
                             ${ev.parentHabit ? (() => { const ph = getHabitsRef().find(h => String(h.id) === String(ev.parentHabit)); return ph ? `<span class="tc-badge tc-badge-goal"><i class="fa-solid fa-bullseye"></i> ${window.escapeHtml(ph.name)}</span>` : ''; })() : ''}
                         </div>
                     </div>
                     <div class="tc-actions">
                         <i class="fa-solid fa-grip-vertical tc-drag-icon" title="Sürükle & Taşı"></i>
                         <button class="tc-edit-btn" data-action="edit-task" data-id="${ev.id}" title="Düzenle" aria-label="Düzenle"><i class="fa-solid fa-pen"></i></button>
                         <button class="tc-del-btn" data-action="delete-task" data-id="${ev.id}" data-date="${evDate}" title="Sil" aria-label="Sil"><i class="fa-solid fa-trash-can"></i></button>
                     </div>
                 </div>
             </div>
         </li>`;
     }).join('');
}
