// script-task-render-mutate-item-builder.js
// script-task-render-mutate.js'ten çıkarıldı: renderTasks'in her bir görev satırını
// üreten buildTaskListItem + ona bağlı sürükle-bırak (drag&drop) yeniden sıralama
// mantığı (_wireTaskItemDragDrop). draggedItemIndex modül-seviyeli sürükle-bırak
// state'i SADECE bu ikili tarafından okunup yazılıyordu (script-task-render-mutate.js'te
// başka hiçbir yerde kullanılmıyordu) — bu yüzden ikisi birlikte, kendi kapalı state'iyle
// buraya taşınabildi. saveTasks/renderTasks çağrıları window köprüsü üzerinden yapılıyor
// (ana dosya bunları window.saveTasks / window.renderTasks olarak yayınlıyor).
const taskCategoryLabels = { 'kisisel': 'Kişisel', 'is': 'İş', 'egitim': 'Eğitim', 'saglik': 'Sağlık' };
let draggedItemIndex = null;

// Görev satırının sürükle-bırak (yeniden sıralama) olaylarını bağlar.
function _wireTaskItemDragDrop(li, task, index, todayTasks, todayStr) {
    li.addEventListener('dragstart', function(e) {
        draggedItemIndex = index;
        setTimeout(() => this.classList.add('dragging'), 0);
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData('taskId', task.id); // ← EKSİK OLAN BU SATIRDI
        }
    });

    li.addEventListener('dragend', function() {
        this.classList.remove('dragging');
    });
    li.addEventListener('dragover', function(e) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    });
    li.addEventListener('dragenter', function(e) {
        e.preventDefault();
        if(index !== draggedItemIndex) this.classList.add('drag-over');
    });
    li.addEventListener('dragleave', function() {
        this.classList.remove('drag-over');
    });
    li.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('drag-over');

        // Eğer farklı bir sıraya bırakıldıysa yerlerini değiştir ve KAYDET
        if (draggedItemIndex !== null && draggedItemIndex !== index) {
            const draggedTask = todayTasks[draggedItemIndex];
            todayTasks.splice(draggedItemIndex, 1);
            todayTasks.splice(index, 0, draggedTask);

            // Ana görev listesini bu yeni sıralamaya göre güncelle
            let tasks = window.__getTasksRef();
            const otherTasks = tasks.filter(t => t.date !== todayStr);
            tasks = [...otherTasks, ...todayTasks];
            window.__setTasksRef(tasks);

            window.saveTasks(); // Değişikliği hafızaya kazı
        }
        draggedItemIndex = null;
        window.renderTasks();
    });
}

export function buildTaskListItem(task, index, todayTasks, todayStr) {
        const habits = window.__getHabitsRef();
        const goals = window.__getGoalsRef();
        const li = document.createElement('li');
        const isHabitTask = !!task.parentHabit;
       li.className = `task-item ${task.completed ? 'completed' : ''} ${task.isMilestone ? 'milestone-task' : isHabitTask ? 'habit-task' : `priority-${task.priority || 'medium'}`}`;
        li.draggable = true;

        const cat = task.category || 'kisisel';
        const catDisplay = taskCategoryLabels[cat] || 'Kişisel';
        const tStart = (task.timeStart || "09:00").substring(0, 5);
        const tEnd = (task.timeEnd || "10:00").substring(0, 5);

        // Alışkanlık etiketi artık sadece "Alışkanlık" değil, alışkanlığın adını
        // gösteriyor (2026-08-06, profesyonel/tutarlı görünüm için) — bağlı
        // alışkanlık bulunamazsa (silinmiş olabilir) genel metne düşer.
        const parentHabitInfo = isHabitTask ? habits.find(h => String(h.id) === String(task.parentHabit)) : null;
        const habitTagLabel = parentHabitInfo ? escapeHtml(parentHabitInfo.name) : 'Alışkanlık';

        let milestoneBadgeHTML = '';
        if (task.isMilestone) {
            milestoneBadgeHTML = `<span class="parent-habit-badge u-color-h74b9ff_border-color-rgba91322270p4_background-rgba9" ><i class="fa-solid fa-flag-checkered u-margin-right-4px" ></i>Dönüm Noktası</span>`;
        }

        let goalOptionsHTML = '<option value="">🎯 Hedefsiz</option>';
        goals.forEach(g => {
            const isSelected = task.parentGoal === g.id ? 'selected' : '';
            goalOptionsHTML += `<option value="${g.id}" ${isSelected}>${escapeHtml(g.title)}</option>`;
        });

        // --- Hiyerarşik Yol Haritası (Breadcrumb) Rozeti ---
        const breadcrumbHTML = window.__buildTaskBreadcrumbHtml(task);
        // ----------------------------------------------

                         const prioColorMap = { high: '#d98a6a', medium: '#d9b16a', low: '#8d887c' };
        const dotColor = task.isMilestone ? '#74b9ff' : isHabitTask ? '#c88ce6' : (prioColorMap[task.priority || 'medium'] || '#d9b16a');

        li.innerHTML = `
            <div class="tl-time-col">
                <span class="tl-time-start">${tStart}</span>
                <span class="tl-time-end">${tEnd}</span>
            </div>
            <div class="tl-rail">
                <span class="tl-rail-line"></span>
                <span class="tl-rail-dot"></span>
                <span class="tl-rail-line"></span>
            </div>
            <div class="tl-card">
                <div class="tl-card-inner">
                    <div class="task-checkbox" data-action="toggle-task" data-id="${task.id}"></div>
                    <div class="task-left">
                        <span class="task-text" data-action="toggle-task" data-id="${task.id}">${escapeHtml(task.text)}</span>
                        <div class="task-meta">
                            ${isHabitTask
                                ? `<span class="task-category-tag tag-habit"><i class="fa-solid fa-leaf u-margin-right-4px" ></i>${habitTagLabel}</span>`
                                : `<span class="task-category-tag tag-${cat}">${catDisplay}</span>`}
                            <span class="u-width-3px_height-3px_border-radius-50pct_background-rgba25"></span>
                            <span class="u-display-inline-flex_align-items-center_gap-5px_font-size-1"><span class="tl-prio-dot u-width-6px_height-6px_border-radius-50pct_flex-shrink-0_dis" ></span>${task.priority === 'high' ? 'Yüksek' : task.priority === 'low' ? 'Düşük' : 'Orta'}</span>
                            <span class="u-width-3px_height-3px_border-radius-50pct_background-rgba25"></span>
                            <span class="u-font-variant-numeric-tabular-nums_font-size-11p5px_color-v">${tStart}–${tEnd}</span>
                            ${task.recurring ? `<span class="task-time-badge u-color-ha29bfe_border-color-rgba1621552540p3_margin-left-2p" ><i class="fa-solid fa-rotate"></i> ${{daily:'Her Gün', weekdays:'Hafta İçi', weekly:'Her Hafta', monthly:'Her Ay'}[task.recurring]}</span>` : ''}
                            ${breadcrumbHTML}
                        </div>
                    </div>
                    <div class="task-item-right">
                        <select class="mini-goal-select" data-action="change-task-goal" data-id="${task.id}">
                            ${goalOptionsHTML}
                        </select>
                        <div class="task-actions">
                            ${!task.completed ? `<button class="edit-btn" data-action="edit-task" data-id="${task.id}" title="Görevi Düzenle" aria-label="Görevi Düzenle"><i class="fa-solid fa-pen"></i></button>` : ''}
                            ${!task.completed ? `<button class="focus-btn" data-action="focus-task" data-id="${task.id}" title="Bu Göreve Odaklan" aria-label="Bu Göreve Odaklan"><i class="fa-solid fa-crosshairs"></i></button>` : ''}
                            <button class="delete-btn" data-action="delete-task" data-id="${task.id}" data-date="${task.date}"><i class="fa-solid fa-trash-can"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        const _tlRailDot = li.querySelector('.tl-rail-dot');
        if (_tlRailDot) _tlRailDot.style.borderColor = dotColor;
        const _tlPrioDot = li.querySelector('.tl-prio-dot');
        if (_tlPrioDot) _tlPrioDot.style.background = dotColor;

        _wireTaskItemDragDrop(li, task, index, todayTasks, todayStr);

        return li;
}
