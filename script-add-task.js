// addTask + bağlı "Görev Ekle" formu dinleyicileri (script.js'ten çıkarıldı).
import { addSmartTask } from './script-smart-task-add.js';
import { showPremiumModal } from './script-premium-modal.js';
import { updateEndPicker } from './script-time-picker.js';

export function addTask() {
    const taskInput = document.getElementById('task-input');
    const taskParentSelect = document.getElementById('task-parent-habit');
    const taskPriority = document.getElementById('task-priority');
    const taskCategory = document.getElementById('task-category');
    const taskTimeStart = document.getElementById('task-time-start');
    const taskTimeEnd = document.getElementById('task-time-end');

    const rawText = taskInput.value.trim();
    if(rawText === "") return;

    // NLP Analizi ile metni parçala
    const smartData = window.parseSmartText(rawText);
    const text = smartData.cleanText || "İsimsiz Görev";

    const parentHabit = taskParentSelect ? taskParentSelect.value : "";
    const taskParentGoalSelect = document.getElementById('task-parent-goal');
    const parentGoal = taskParentGoalSelect ? taskParentGoalSelect.value : "";
    const recurringSelect = document.getElementById('task-recurring');
    const recurring = recurringSelect ? recurringSelect.value : "";
    const priority = taskPriority.value;
    const category = taskCategory.value;

    // Eğer NLP saat bulduysa onu kullan, bulamadıysa arayüzdeki mevcut saati kullan
    const timeStart = smartData.parsedTime ? smartData.parsedTime : taskTimeStart.value;
    // Bitiş saatini başlangıca göre otomatik 1 saat sonrasına ayarla
    const timeEnd = smartData.parsedTime ? window.addOneHour(timeStart) : taskTimeEnd.value;

    // Eğer NLP "yarın" gibi bir tarih bulduysa o tarihi, bulamadıysa bugünü kullan
    const taskDateStr = smartData.parsedDate ? smartData.parsedDate : window.formatDateToString(new Date());

    const startMins = window.timeToMins(timeStart);
    const endMins = window.timeToMins(timeEnd);

    if(startMins === endMins) {
        showPremiumModal({ title: 'Hatalı Zaman', message: 'Görev başlangıç ve bitiş saati aynı olamaz.', type: 'warning' });
        return;
    }

    if (window.hasTimeConflict(taskDateStr, startMins, endMins)) {
        showPremiumModal({ title: 'Zaman Çakışması', message: 'Bu saatte takviminizde başka plan var.', type: 'warning' });
        return;
    }

    // --- ANA HEDEF TARİH SINIRLARI DENETİMİ (GÜNCEL DOĞRU YER) ---
    if (parentGoal && !window.checkGoalDateBoundaries(parentGoal, taskDateStr)) {
       return; // Eğer seçilen tarih hedefin dışındaysa işlemi tamamen durdurur
   }

   addSmartTask(text, priority, category, taskDateStr, timeStart, timeEnd, parentHabit, parentGoal, recurring);
    if(recurringSelect) recurringSelect.value = '';
    taskInput.value = '';
    if(taskParentSelect) taskParentSelect.value = '';

    // Arayüzdeki seçici saatleri bir sonraki boş saat dilimine ilerlet (örn. 09-10 eklendiyse 10-11 önerilir)
    const nextSlot = window.getNextAvailableTimeSlot(taskDateStr, window.timeToMins(timeEnd) - window.timeToMins(timeStart) || 60);
    updateEndPicker('task-time-start', nextSlot.start);
    updateEndPicker('task-time-end', nextSlot.end);

    window.renderTasks();
    if(window.renderCalendarRef && window.renderEventsRef) { window.renderCalendarRef(); window.renderEventsRef(); }
}
window.addTask = addTask;
