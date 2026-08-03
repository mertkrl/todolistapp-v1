// ============================================================
// FOCUSAI SCRIPT-TASK-RENDER-MUTATE.JS
// script.js'ten çıkarılmış: Bugün sekmesi görev listesi render'ı
// (renderTasks, renderHighlightGoalRow, renderTodayAssignmentRows,
// buildTaskListItem, _wireTaskItemDragDrop) ve görev mutasyon
// fonksiyonları (saveTasks, addGlobalTask, changeTaskGoal,
// deleteGlobalTask). script.js'in window köprülerini (__getTasksRef/
// __setTasksRef, __getCalendarEventsRef, __getGoalsRef, __getHabitsRef,
// __getRenderCalendarRef/__getRenderEventsRef/__getRenderStatisticsRef/
// __getRenderSocialStatsRef/__getRenderBuddyHabitsRef, updateStats,
// renderGoals, showPremiumModal, __buildTaskBreadcrumbHtml) ve
// script-habit-render-mutate.js'in window.renderHabitRows köprüsünü
// kullanır — script.js önce yüklenir, bu dosya sonra.
// ============================================================
(function () {
'use strict';

const taskList = document.getElementById('task-list');
const taskCategoryLabels = { 'kisisel': 'Kişisel', 'is': 'İş', 'egitim': 'Eğitim', 'saglik': 'Sağlık' };
let draggedItemIndex = null;

function saveTasks() {
    const tasks = window.__getTasksRef();
    const calendarEvents = window.__getCalendarEventsRef();
    Store.tasks.set(tasks);
    Store.events.set(calendarEvents);

    // YENİ EKLENEN: Görevler her eklendiğinde/değiştiğinde Ana Hedefler sayacını anında güncelle
    if (typeof window.renderGoals === 'function') {
        window.renderGoals();
    }
}
window.saveTasks = saveTasks;

function addGlobalTask(text, priority, category, date, start, end, parentHabit = "", parentGoal = "", recurring = "", routineId = "") {
    const tasks = window.__getTasksRef();
    const calendarEvents = window.__getCalendarEventsRef();
    const goals = window.__getGoalsRef();
    const id = generateId();
    const isOvernight = window.timeToMins(end) < window.timeToMins(start);

    // Görevin tarihine göre hangi dönüm noktasına düştüğünü otomatik bul
    let parentMilestone = "";
    if (parentGoal && date) {
        const goal = goals.find(g => String(g.id) === String(parentGoal));
        if (goal && Array.isArray(goal.milestones)) {
            // Tarihi YYYY-MM-DD'ye normalize et (app DD-MM-YYYY, milestone YYYY-MM-DD saklar)
            const _normDate = (d) => {
                if (!d) return '';
                const p = d.split('-');
                if (p.length !== 3) return d;
                return p[0].length === 4 ? d : (p[2] + '-' + p[1] + '-' + p[0]);
            };
            const dateNorm = _normDate(date);
            const match = goal.milestones.find(ms => {
                const s = _normDate(ms.startDate || '');
                const e = _normDate(ms.date || ms.endDate || '');
                if (s && e) return dateNorm >= s && dateNorm <= e;
                if (e && !s) return dateNorm <= e;
                return false;
            });
            if (match) parentMilestone = match.id;
        }
    }

    tasks.push({ id, text, completed: false, priority, category, date, timeStart: start, timeEnd: end, parentHabit: parentHabit, parentGoal: parentGoal, parentMilestone: parentMilestone, isOvernight: isOvernight, recurring: recurring, routineId: routineId });

    if (!calendarEvents[date]) calendarEvents[date] = [];
    calendarEvents[date].push({ id, text, timeStart: start, timeEnd: end, priority, parentHabit: parentHabit, parentGoal: parentGoal, isOvernight: isOvernight, routineId: routineId });

    saveTasks();
}
window.addGlobalTask = addGlobalTask;

window.changeTaskGoal = function(taskId, goalId) {
    const tasks = window.__getTasksRef();
    const goals = window.__getGoalsRef();
    const task = tasks.find(t => String(t.id) === String(taskId));
    if (task) {
        task.parentGoal = goalId;
        // Hedef değişince parentMilestone'u yeniden hesapla
        task.parentMilestone = '';
        if (goalId && task.date) {
            const _g = goals.find(g => String(g.id) === String(goalId));
            if (_g && Array.isArray(_g.milestones)) {
                const _norm = (d) => { if (!d) return ''; const p = d.split('-'); return p.length===3 && p[0].length!==4 ? (p[2]+'-'+p[1]+'-'+p[0]) : d; };
                const dn = _norm(task.date);
                const _ms = _g.milestones.find(ms => { const s=_norm(ms.startDate||''); const e=_norm(ms.date||ms.endDate||''); return (s&&e) ? dn>=s&&dn<=e : (e?dn<=e:false); });
                if (_ms) task.parentMilestone = _ms.id;
            }
        }
        saveTasks();
        window.renderGoals(); // Hedef ilerlemesini anlık güncelle
        renderTasks(); // Görev kartını breadcrumb ile güncelle
    }
};

window.deleteGlobalTask = function(id, date) {
    let tasks = window.__getTasksRef();
    let calendarEvents = window.__getCalendarEventsRef();
    const renderCalendarRef = window.__getRenderCalendarRef();
    const renderEventsRef = window.__getRenderEventsRef();
    const renderStatisticsRef = window.__getRenderStatisticsRef();
    const renderSocialStatsRef = window.__getRenderSocialStatsRef();
    const taskToDelete = tasks.find(t => String(t.id) === String(id));
    // Görev tasks dizisinde yoksa ama calendarEvents'te varsa yine de sil
    if(!taskToDelete) {
        let removed = false;
        if (date && calendarEvents[date]) {
            const before = calendarEvents[date].length;
            calendarEvents[date] = calendarEvents[date].filter(e => String(e.id) !== String(id));
            if (calendarEvents[date].length !== before) removed = true;
            if (!calendarEvents[date].length) delete calendarEvents[date];
        }
        // date bilinmiyorsa tüm tarihlerde ara
        if (!removed) {
            for (const d in calendarEvents) {
                const before = calendarEvents[d].length;
                calendarEvents[d] = calendarEvents[d].filter(e => String(e.id) !== String(id));
                if (calendarEvents[d].length !== before) removed = true;
                if (!calendarEvents[d].length) delete calendarEvents[d];
            }
        }
        if (removed) {
            Store.events.set(calendarEvents);
            if (renderCalendarRef) renderCalendarRef();
            if (renderEventsRef) renderEventsRef();
        }
        return;
    }

    // EĞER GÖREV BİR RUTİNSE VE ONAY BEKLENİYORSA MODAL AÇ
    if(taskToDelete.routineId && !window.bypassRoutineCheck) {
        const rModal = document.getElementById('recurring-delete-modal');
        if(rModal) {
            rModal.classList.remove('hidden');

            // 1. SADECE BUNU SİL
            document.getElementById('btn-delete-single').onclick = () => {
                rModal.classList.add('hidden');
                window.bypassRoutineCheck = true; // Sorusuz silmesi için bayrak aç
                window.deleteGlobalTask(id, date); // Fonksiyonu tekrar çağır
                window.bypassRoutineCheck = false; // Bayrağı kapat
            };

            // 2. TÜM RUTİNİ SİL
            document.getElementById('btn-delete-all').onclick = () => {
                rModal.classList.add('hidden');
                const routineId = taskToDelete.routineId;

                // Görevlerden ve Takvimden rutin kimliğine uyan HER ŞEYİ sil
                tasks = tasks.filter(t => t.routineId !== routineId);
                window.__setTasksRef(tasks);
                for(let d in calendarEvents) {
                    calendarEvents[d] = calendarEvents[d].filter(e => e.routineId !== routineId);
                    if(calendarEvents[d].length === 0) delete calendarEvents[d];
                }

                saveTasks(); renderTasks();
                if(renderCalendarRef) renderCalendarRef();
                if(renderEventsRef) renderEventsRef();
                window.showPremiumModal({ title: 'Rutin Silindi', message: 'Serideki tüm tekrarlayan görevler takvimden başarıyla kaldırıldı.', type: 'success' });
            };

            // 3. İPTAL
            document.getElementById('btn-delete-cancel').onclick = () => {
                rModal.classList.add('hidden');
            };
        }
        return; // Soruyu sorduğumuz için fonksiyonu burada durdur
    }

    // --- NORMAL (TEKLİ) SİLME İŞLEMİ ---
    const _deletedTaskSnap = JSON.parse(JSON.stringify(taskToDelete));
    const _deletedEventSnap = (calendarEvents[date] || []).find(e => String(e.id) === String(id));
    const _deletedEventSnapCopy = _deletedEventSnap ? JSON.parse(JSON.stringify(_deletedEventSnap)) : null;

    tasks = tasks.filter(t => String(t.id) !== String(id));
    window.__setTasksRef(tasks);

    if(calendarEvents[date]) {
        calendarEvents[date] = calendarEvents[date].filter(e => String(e.id) !== String(id));
        if(calendarEvents[date].length === 0) delete calendarEvents[date];
    }

    if (typeof window.PlanningUnmirrorTaskGlobal === 'function') window.PlanningUnmirrorTaskGlobal(id);
    saveTasks();
    renderTasks();
    if(renderCalendarRef) renderCalendarRef();
    if(renderEventsRef) renderEventsRef();
    if(renderStatisticsRef && document.getElementById('istatistikler').classList.contains('active')) renderStatisticsRef();
    if(renderSocialStatsRef && document.getElementById('arkadaslar').classList.contains('active')) renderSocialStatsRef();

    window.showUndoToast(`"${_deletedTaskSnap.text}" silindi`, () => {
        let tasks2 = window.__getTasksRef();
        tasks2.push(_deletedTaskSnap);
        window.__setTasksRef(tasks2);
        const calendarEvents2 = window.__getCalendarEventsRef();
        if (_deletedEventSnapCopy) {
            if (!calendarEvents2[_deletedTaskSnap.date]) calendarEvents2[_deletedTaskSnap.date] = [];
            calendarEvents2[_deletedTaskSnap.date].push(_deletedEventSnapCopy);
        }
        saveTasks(); renderTasks();
        const rc = window.__getRenderCalendarRef();
        const re = window.__getRenderEventsRef();
        if(rc) rc();
        if(re) re();
    });
};

// renderTasks'in "Bugün" görev listesindeki tek satırlık widget'ları — her biri
// saf DOM üretimi, dışarıdan sadece todayStr/veri alır, taskList'e kendi ekler.
function renderHighlightGoalRow(todayStr) {
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
    taskList.appendChild(hlLi);
}

// classroom_assignments (social.js, window.FocusAssignments) sistemin geri kalanıyla
// burada senkronlanır: normal görevlerden ayırt edilsin diye kendi ikonu/rengi var ve
// tıklanınca ilgili grubun Ödevler sekmesine götürür (checkbox ile tamamlanmaz).
function renderTodayAssignmentRows(todayStr) {
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

function renderTasks() {
    const tasks = window.__getTasksRef();
    const habits = window.__getHabitsRef();
    const goals = window.__getGoalsRef();
    const renderStatisticsRef = window.__getRenderStatisticsRef();
    const renderSocialStatsRef = window.__getRenderSocialStatsRef();
    const renderBuddyHabitsRef = window.__getRenderBuddyHabitsRef();

    taskList.innerHTML = '';
    const todayStr = window.formatDateToString(new Date());

    renderHighlightGoalRow(todayStr);
    renderTodayAssignmentRows(todayStr);

    let yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yesterdayStr = window.formatDateToString(yest);

    // Hem bugünün görevlerini hem de dünden sarkan (gece kuşu) görevlerini al
    // isLessonPlanDraft: öğretmenin BAŞKA BİR öğrenci için henüz atamadığı ders planı
    // taslağını hazırlarken oluşturduğu "sahte" görevler — bunlar öğretmenin kendi
    // görev listesinde değil, sadece planlama arayüzünün kendi Gün Paneli'nde görünmeli.
    const todayTasks = tasks.filter(t =>
        !t.isLessonPlanDraft && (
            t.date === todayStr ||
            (t.date === yesterdayStr && t.isOvernight)
        )
    );

    // Bekleyenler üste (alışkanlıklar önce, sonra normal görevler), tamamlananlar alta
    todayTasks.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const aH = !!a.parentHabit, bH = !!b.parentHabit;
        if (aH !== bH) return aH ? -1 : 1;
        return 0;
    });

    const completedCount = todayTasks.filter(t => t.completed).length;
    let dividerInserted = false;
    let habitHeaderInserted = false;
    let taskHeaderInserted = false;

    todayTasks.forEach((task, index) => {
        // Tamamlananlar başlamadan önce ayraç ekle
        if (!dividerInserted && task.completed && completedCount > 0) {
            dividerInserted = true;
            habitHeaderInserted = false;
            taskHeaderInserted = false;
            const divider = document.createElement('li');
            divider.className = 'task-divider';
            divider.innerHTML = `<span>${completedCount} tamamlandı</span>`;
            taskList.appendChild(divider);
        }

        if (!task.completed) {
            // Bekleyen alışkanlıklar için grup başlığı
            if (task.parentHabit && !habitHeaderInserted) {
                habitHeaderInserted = true;
                const hd = document.createElement('li');
                hd.style.listStyle = 'none';
                hd.style.padding = '6px 2px 2px';
                hd.style.fontSize = '11px';
                hd.style.fontWeight = '700';
                hd.style.letterSpacing = '.8px';
                hd.style.color = '#c88ce6';
                hd.style.textTransform = 'uppercase';
                hd.style.display = 'flex';
                hd.style.alignItems = 'center';
                hd.style.gap = '6px';
                hd.innerHTML = '<i class="fa-solid fa-leaf"></i> Alışkanlıklar';
                taskList.appendChild(hd);
            }
            // Normal görev başlığı (alışkanlıktan sonra geliyorsa)
            if (!task.parentHabit && !taskHeaderInserted && habitHeaderInserted) {
                taskHeaderInserted = true;
                const hd = document.createElement('li');
                hd.style.listStyle = 'none';
                hd.style.padding = '10px 2px 2px';
                hd.style.fontSize = '11px';
                hd.style.fontWeight = '700';
                hd.style.letterSpacing = '.8px';
                hd.style.color = 'var(--text-muted)';
                hd.style.textTransform = 'uppercase';
                hd.style.display = 'flex';
                hd.style.alignItems = 'center';
                hd.style.gap = '6px';
                hd.style.borderTop = '1px solid rgba(255,255,255,0.05)';
                hd.style.marginTop = '4px';
                hd.innerHTML = '<i class="fa-solid fa-list-check"></i> Görevler';
                taskList.appendChild(hd);
            }
        }

        const li = buildTaskListItem(task, index, todayTasks, todayStr);
        taskList.appendChild(li);
    });

    window.renderHabitRows(todayStr);

    window.updateStats();
    if(renderStatisticsRef && document.getElementById('istatistikler').classList.contains('active')) renderStatisticsRef();
    if(renderSocialStatsRef && document.getElementById('arkadaslar').classList.contains('active')) renderSocialStatsRef();
    if(renderBuddyHabitsRef && document.getElementById('arkadaslar').classList.contains('active')) renderBuddyHabitsRef();
}
window.renderTasks = renderTasks; // script-milestone-goal-actions.js gibi ayrı modüllerden erişim için
window.renderTasksGlobal = function() { if (typeof renderTasks === 'function') renderTasks(); };

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

            saveTasks(); // Değişikliği hafızaya kazı
        }
        draggedItemIndex = null;
        renderTasks();
    });
}

function buildTaskListItem(task, index, todayTasks, todayStr) {
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

        let parentBadgeHTML = '';
        if (task.parentHabit) {
            const ph = habits.find(h => String(h.id) === String(task.parentHabit));
            if (ph) {
                parentBadgeHTML = `<span class="parent-habit-badge"><i class="fa-solid fa-bullseye"></i> ${escapeHtml(ph.name)}</span>`;
            }
        }

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
                                ? `<span class="task-category-tag tag-habit"><i class="fa-solid fa-leaf u-margin-right-4px" ></i>Alışkanlık</span>`
                                : `<span class="task-category-tag tag-${cat}">${catDisplay}</span>`}
                            <span class="u-width-3px_height-3px_border-radius-50pct_background-rgba25"></span>
                            <span class="u-display-inline-flex_align-items-center_gap-5px_font-size-1"><span class="tl-prio-dot u-width-6px_height-6px_border-radius-50pct_flex-shrink-0_dis" ></span>${task.priority === 'high' ? 'Yüksek' : task.priority === 'low' ? 'Düşük' : 'Orta'}</span>
                            <span class="u-width-3px_height-3px_border-radius-50pct_background-rgba25"></span>
                            <span class="u-font-variant-numeric-tabular-nums_font-size-11p5px_color-v">${tStart}–${tEnd}</span>
                            ${task.recurring ? `<span class="task-time-badge u-color-ha29bfe_border-color-rgba1621552540p3_margin-left-2p" ><i class="fa-solid fa-rotate"></i> ${{daily:'Her Gün', weekdays:'Hafta İçi', weekly:'Her Hafta', monthly:'Her Ay'}[task.recurring]}</span>` : ''}
                        </div>
                        ${breadcrumbHTML}
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

})();
