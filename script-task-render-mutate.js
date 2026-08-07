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
import { buildTaskListItem } from './script-task-render-mutate-item-builder.js';
import { renderHighlightGoalRow, renderTodayAssignmentRows } from './script-task-render-mutate-today-rows.js';

(function () {
'use strict';

const taskList = document.getElementById('task-list');

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

})();
