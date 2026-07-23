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
         const task = window.__getTasksRef().find(t => String(t.id) === String(id));
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
             if (window.timeToMins(newStart) >= window.timeToMins(newEnd)) {
                 editTaskTimeError.style.display = 'block';
                 return;
             }
             editTaskTimeError.style.display = 'none';
 
             const task = window.__getTasksRef().find(t => String(t.id) === String(id));

             // --- DÜZENLEME EKRANI HEDEF TARİH SINIRI KONTROLÜ (DÜZELTİLDİ) ---
             const configGoalSelect = document.getElementById('edit-task-parent-goal');
             const checkedParentGoal = configGoalSelect ? configGoalSelect.value : (task ? task.parentGoal : '');
             if (checkedParentGoal && task && !window.checkGoalDateBoundaries(checkedParentGoal, task.date)) {
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
 
             if (window.__getCalendarEventsRef()[oldDate]) {
                 const ev = window.__getCalendarEventsRef()[oldDate].find(e => String(e.id) === String(id));
                 if (ev) {
                     ev.text      = newText;
                     ev.parentHabit = newParent;
                     ev.timeStart = newStart;
                     ev.timeEnd   = newEnd;
                     ev.priority  = task.priority;
                 }
             }
 
             window.saveTasks();
             window.renderTasks();
             if (window.__getRenderCalendarRef())  window.__getRenderCalendarRef()();
             if (window.__getRenderEventsRef())    window.__getRenderEventsRef()();
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
                 editTaskEnd.value = window.addOneHour(editTaskStart.value);
             }
             const ok = window.timeToMins(editTaskStart.value) < window.timeToMins(editTaskEnd.value);
             editTaskTimeError.style.display = ok ? 'none' : 'block';
         });
     }
     if (editTaskEnd) {
         editTaskEnd.addEventListener('change', () => {
             const ok = window.timeToMins(editTaskStart.value) < window.timeToMins(editTaskEnd.value);
             editTaskTimeError.style.display = ok ? 'none' : 'block';
         });
     }
