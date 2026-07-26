// script-edit-task-modal.js
// script.js'ten çıkarıldı (Faz 6): Görev Düzenleme Modalı — closeEditModal,
// window.editTask, kaydetme akışı (metin/öncelik/kategori/saat/hedef tarih
// sınırı kontrolü).
//
// Köprüler:
//  - window.__getTasksRef()/__getCalendarEventsRef(): script.js'te zaten vardı
//    (salt-okunur, bu blok sadece .find() ile mutate ediyor, reassign yok).
//  - window.checkGoalDateBoundaries/saveTasks/renderTasks: script.js'te zaten vardı.
//  - window.__getRenderCalendarRef/__getRenderEventsRef: script.js'te zaten vardı
//    (script-habit-sync.js/script-convert-modal.js ile aynı desen).
//
// Faz G: window.* çağrıları gerçek import'lara çevrildi (script.js hâlâ
// window.X = fn atamalarını KORUYOR, geriye dönük uyumluluk için).

import { getTasksRef, getCalendarEventsRef, checkGoalDateBoundaries, saveTasks, renderTasks, getRenderCalendarRef, getRenderEventsRef } from './script.js';
import { timeToMins, addOneHour } from './script-date-time-utils.js';

     const editTaskModal       = document.getElementById('edit-task-modal');
     const editTaskIdInput     = document.getElementById('edit-task-id');
     const editTaskTextInput   = document.getElementById('edit-task-text');
     const editTaskParentSelect= document.getElementById('edit-task-parent-habit');
     const editTaskPriority    = document.getElementById('edit-task-priority');
     const editTaskCategory    = document.getElementById('edit-task-category');
     const editTaskStart       = document.getElementById('edit-task-start');
     const editTaskEnd         = document.getElementById('edit-task-end');
     const editTaskTimeError   = document.getElementById('edit-task-time-error');
     const saveEditTaskBtn     = document.getElementById('save-edit-task-btn');
     const cancelEditTaskBtn   = document.getElementById('cancel-edit-task-btn');
     const closeEditTaskBtn    = document.getElementById('close-edit-task-btn');

     function closeEditModal() {
         if (editTaskModal) editTaskModal.classList.add('hidden');
         if (editTaskTimeError) editTaskTimeError.style.display = 'none';
     }

     window.editTask = function(id) {
         const task = getTasksRef().find(t => String(t.id) === String(id));
         if (!task) return;

         editTaskIdInput.value       = task.id;
         editTaskTextInput.value     = task.text;
         if(editTaskParentSelect) editTaskParentSelect.value = task.parentHabit || "";
         editTaskPriority.value      = task.priority  || 'medium';
         editTaskCategory.value      = task.category  || 'kisisel';
         editTaskStart.value         = task.timeStart || '09:00';
         editTaskEnd.value           = task.timeEnd   || '10:00';
         editTaskTimeError.style.display = 'none';

         editTaskModal.classList.remove('hidden');
         editTaskTextInput.focus();
     };

     if (saveEditTaskBtn) {
         saveEditTaskBtn.addEventListener('click', () => {
             const id       = editTaskIdInput.value;
             const newText  = editTaskTextInput.value.trim();
             const newParent = editTaskParentSelect ? editTaskParentSelect.value : "";
             const newStart = editTaskStart.value;
             const newEnd   = editTaskEnd.value;

             if (!newText) {
                 editTaskTextInput.focus();
                 return;
             }
             if (timeToMins(newStart) >= timeToMins(newEnd)) {
                 editTaskTimeError.style.display = 'block';
                 return;
             }
             editTaskTimeError.style.display = 'none';

             const task = getTasksRef().find(t => String(t.id) === String(id));

             // --- DÜZENLEME EKRANI HEDEF TARİH SINIRI KONTROLÜ (DÜZELTİLDİ) ---
             const configGoalSelect = document.getElementById('edit-task-parent-goal');
             const checkedParentGoal = configGoalSelect ? configGoalSelect.value : (task ? task.parentGoal : '');
             if (checkedParentGoal && task && !checkGoalDateBoundaries(checkedParentGoal, task.date)) {
                 return;
             }

             if (!task) return;

             const oldDate = task.date;

             task.text      = newText;
             task.parentHabit = newParent;
             task.priority  = editTaskPriority.value;
             task.category  = editTaskCategory.value;
             task.timeStart = newStart;
             task.timeEnd   = newEnd;

             if (getCalendarEventsRef()[oldDate]) {
                 const ev = getCalendarEventsRef()[oldDate].find(e => String(e.id) === String(id));
                 if (ev) {
                     ev.text      = newText;
                     ev.parentHabit = newParent;
                     ev.timeStart = newStart;
                     ev.timeEnd   = newEnd;
                     ev.priority  = task.priority;
                 }
             }

             saveTasks();
             renderTasks();
             if (getRenderCalendarRef())  getRenderCalendarRef()();
             if (getRenderEventsRef())    getRenderEventsRef()();
             if (typeof window.renderWeeklyView === 'function') window.renderWeeklyView();
             if (typeof window.renderDailyView  === 'function') window.renderDailyView();

             closeEditModal();
         });
     }

     if (cancelEditTaskBtn) cancelEditTaskBtn.addEventListener('click', closeEditModal);
     if (closeEditTaskBtn)  closeEditTaskBtn.addEventListener('click',  closeEditModal);

     if (editTaskModal) {
         editTaskModal.addEventListener('click', (e) => {
             if (e.target === editTaskModal) closeEditModal();
         });
     }

     if (editTaskStart) {
         editTaskStart.addEventListener('change', () => {
             if (editTaskEnd) {
                 editTaskEnd.value = addOneHour(editTaskStart.value);
             }
             const ok = timeToMins(editTaskStart.value) < timeToMins(editTaskEnd.value);
             editTaskTimeError.style.display = ok ? 'none' : 'block';
         });
     }
     if (editTaskEnd) {
         editTaskEnd.addEventListener('change', () => {
             const ok = timeToMins(editTaskStart.value) < timeToMins(editTaskEnd.value);
             editTaskTimeError.style.display = ok ? 'none' : 'block';
         });
     }
