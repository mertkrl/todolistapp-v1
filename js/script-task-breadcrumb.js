// ============================================================
// FOCUSAI SCRIPT-TASK-BREADCRUMB.JS
// script.js'ten çıkarılmış: görev listesi satırlarındaki "ana hedef /
// dönüm noktası / alışkanlık" breadcrumb rozetinin saf HTML üretimi.
// DOM'a dokunmaz, sadece string döner. script.js'in window'a koyduğu
// __getGoalsRef/__getHabitsRef ile FocusStorage/escapeHtml'i kullanır
// (script-day-drawer-render.js ile aynı köprü deseni).
// ============================================================
import { getGoalsRef } from './script.js';
import { FocusStorage, escapeHtml } from './storage-manager.js';

(function () {
'use strict';

function _buildTaskBreadcrumbHtml(task) {
    let breadcrumbParts = [];
    const goals = getGoalsRef();

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

    // 3. Alışkanlık — burada ARTIK gösterilmiyor: alışkanlık adı zaten görev
    // kartındaki kategori etiketinde gösteriliyor (bkz.
    // script-task-render-mutate-item-builder.js habitTagLabel, 2026-08-06),
    // burada da tekrar etmek aynı bilgiyi iki kez göstermek olurdu.

    if (!breadcrumbParts.length) return '';
    // Aralarına şık bir ok işareti (chevron-right) ekleyerek birleştiriyoruz
    const joinedParts = breadcrumbParts.join('<i class="fa-solid fa-chevron-right u-color-rgba2552552550p2_font-size-10px_margin-04px" ></i>');
    // GERÇEK BUG DÜZELTMESİ (2026-08-06): önceden zorla yeni bir satıra
    // (u-flex-basis-100pct_height-0 spacer'ı + kendi margin-top:8px'i olan
    // ayrı bir blok) itiliyordu — bu da göreve ana hedef bağlanınca kartın
    // görünür şekilde aşağı doğru büyümesine sebep oluyordu. Artık ayrı bir
    // satır ZORLAMIYOR — .task-meta'nın İÇİNE, mevcut nokta-ayraçlı çiplerin
    // yanına, aynı satıra ekleniyor (script-task-render-mutate-item-builder.js
    // tarafından .task-meta'nın içine yerleştiriliyor). .task-meta zaten
    // flex-wrap:wrap olduğu için sadece gerçekten sığmadığında satır atlıyor,
    // çoğu görevde kart boyutu hiç değişmiyor.
    return `<span class="u-width-3px_height-3px_border-radius-50pct_background-rgba25"></span>
        <span class="task-breadcrumb-badge-inline">${joinedParts}</span>`;
}

window.__buildTaskBreadcrumbHtml = _buildTaskBreadcrumbHtml;

})();
