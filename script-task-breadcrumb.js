// ============================================================
// FOCUSAI SCRIPT-TASK-BREADCRUMB.JS
// script.js'ten çıkarılmış: görev listesi satırlarındaki "ana hedef /
// dönüm noktası / alışkanlık" breadcrumb rozetinin saf HTML üretimi.
// DOM'a dokunmaz, sadece string döner. script.js'in window'a koyduğu
// __getGoalsRef/__getHabitsRef ile FocusStorage/escapeHtml'i kullanır
// (script-day-drawer-render.js ile aynı köprü deseni).
// ============================================================
import { getGoalsRef, getHabitsRef } from './script.js';
import { FocusStorage, escapeHtml } from './storage-manager.js';

(function () {
'use strict';

function _buildTaskBreadcrumbHtml(task) {
    let breadcrumbParts = [];
    const goals = getGoalsRef();
    const habits = getHabitsRef();

    // 1. Ana Hedef — önce eski goals sistemini, sonra planning_goals modülünü kontrol et
    if (task.parentGoal) {
        let parentGoalInfo = goals.find(g => String(g.id) === String(task.parentGoal));
        if (!parentGoalInfo && String(task.parentGoal).startsWith('pg_')) {
            // Planning modülü hedefi
            const _pg = (typeof FocusStorage !== 'undefined')
                ? FocusStorage.get('planning_goals', [])
                : JSON.parse(localStorage.getItem('planning_goals') || '[]', window._safeJsonReviver);
            parentGoalInfo = _pg.find(g => g.id === task.parentGoal);
        }
        if (parentGoalInfo) {
            breadcrumbParts.push(`<span title="Ana Hedef" class="u-display-inline-flex_align-items-center_gap-5px_color-hfeca"><i class="fa-solid fa-mountain-sun"></i> ${escapeHtml(parentGoalInfo.title)}</span>`);

            // 2. Dönüm Noktası
            if (task.parentMilestone) {
                const milestones = parentGoalInfo.milestones || [];
                // Eski sistem: ms.text | Planlama modülü: ms.title
                const milestoneInfo = milestones.find(m => String(m.id) === String(task.parentMilestone));
                if (milestoneInfo) {
                    const msLabel = milestoneInfo.title || milestoneInfo.text || '';
                    breadcrumbParts.push(`<span title="Dönüm Noktası" class="u-display-inline-flex_align-items-center_gap-5px_color-h0984"><i class="fa-solid fa-flag-checkered"></i> ${escapeHtml(msLabel)}</span>`);
                }
            }
        }
    }

    // 3. Alışkanlık
    if (task.parentHabit) {
        const habitInfo = (typeof habits !== 'undefined') ? habits.find(h => String(h.id) === String(task.parentHabit)) : null;
        if (habitInfo) {
            // Alışkanlık ismini güvenli şekilde alıyoruz
            const habitName = habitInfo.title || habitInfo.text || habitInfo.name || "Alışkanlık";
            breadcrumbParts.push(`<span title="Bağlı Alışkanlık" class="u-display-inline-flex_align-items-center_gap-5px_color-hc88c"><i class="fa-solid fa-leaf"></i> ${escapeHtml(habitName)}</span>`);
        }
    }

    if (!breadcrumbParts.length) return '';
    // Aralarına şık bir ok işareti (chevron-right) ekleyerek birleştiriyoruz
    const joinedParts = breadcrumbParts.join('<i class="fa-solid fa-chevron-right u-color-rgba2552552550p2_font-size-10px_margin-04px" ></i>');
    return `<div class="u-flex-basis-100pct_height-0"></div>
        <div class="task-breadcrumb-badge u-display-inline-flex_align-items-center_background-rgba0000" >
            ${joinedParts}
        </div>`;
}

window.__buildTaskBreadcrumbHtml = _buildTaskBreadcrumbHtml;

})();
