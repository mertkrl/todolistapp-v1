import { updateEndPicker } from './script-time-picker.js';

export function addNewEvent() {
    const eventInput = document.getElementById('event-input');
    const eventParentSelect = document.getElementById('event-parent-habit');
    const eventParentGoalSelect = document.getElementById('event-parent-goal');
    const eventTimeStart = document.getElementById('event-time-start');
    const eventTimeEnd = document.getElementById('event-time-end');
    const eventPriority = document.getElementById('event-priority');
    const selectedDate = window.__getSelectedDateRef();

    const rawText = eventInput.value.trim();
    if(rawText === "") return;

    // NLP Analizi ile metni parçala
    const smartData = window.parseSmartText(rawText);
    const text = smartData.cleanText || "İsimsiz Plan";

    const parentHabit = eventParentSelect ? eventParentSelect.value : "";
    const parentGoal = eventParentGoalSelect ? eventParentGoalSelect.value : "";
    const priority = eventPriority.value;

    // Eğer NLP saat bulduysa onu kullan, bulamadıysa arayüzdeki mevcut saati kullan
    const timeStart = smartData.parsedTime ? smartData.parsedTime : eventTimeStart.value;
    const timeEnd = smartData.parsedTime ? window.addOneHour(timeStart) : eventTimeEnd.value;

    // NLP tarih bulduysa onu kullan, bulamadıysa takvimde KULLANICININ SEÇTİĞİ tarihi kullan
    const d = smartData.parsedDate ? smartData.parsedDate : window.formatDateToString(selectedDate);

    const startMins = window.timeToMins(timeStart);
    const endMins = window.timeToMins(timeEnd);

    // --- YENİ: Ana Hedef Tarih Sınırı Kontrolü ---
       if (!window.checkGoalDateBoundaries(parentGoal, d)) {
           return;
       }

    if(startMins === endMins) {
        window.showPremiumModal({ title: 'Hatalı Zaman Aralığı', message: 'Başlangıç ve bitiş saati aynı olamaz.', type: 'warning' });
        return;
    }

    if(window.hasTimeConflict(d, startMins, endMins)) {
        window.showPremiumModal({ title: 'Zaman Çakışması!', message: 'Seçtiğiniz zaman aralığı, o günkü başka bir planınızla kesişiyor. Lütfen çakışmayan farklı bir saat aralığı seçin.', type: 'warning' });
        return;
    }

    window.addGlobalTask(text, priority, 'is', d, timeStart, timeEnd, parentHabit, parentGoal);

    eventInput.value = '';
    if(eventParentSelect) eventParentSelect.value = '';
    if(eventParentGoalSelect) eventParentGoalSelect.value = '';

    // Bir sonraki görev ekleme pratikliği için zaman seçicilerini bir sonraki boş dilime ilerlet
    const nextSlot = window.getNextAvailableTimeSlot(d, window.timeToMins(timeEnd) - window.timeToMins(timeStart) || 60);
    updateEndPicker('event-time-start', nextSlot.start);
    updateEndPicker('event-time-end', nextSlot.end);
    eventPriority.value = 'medium';

    closeEventModal();
    window.renderCalendar(); window.renderEvents(); window.renderTasks();
}

export function openEventModal() {
    const eventCreateModal = document.getElementById('event-create-modal');
    const eventModalDateLabel = document.getElementById('event-modal-date-label');
    const selectedDate = window.__getSelectedDateRef();

    if (!eventCreateModal) return;
    if (eventModalDateLabel && selectedDate) {
        eventModalDateLabel.textContent = selectedDate.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    if (selectedDate) {
        const nextSlot = window.getNextAvailableTimeSlot(window.formatDateToString(selectedDate));
        updateEndPicker('event-time-start', nextSlot.start);
        updateEndPicker('event-time-end', nextSlot.end);
    }
    eventCreateModal.classList.remove('hidden');
    setTimeout(() => { const inp = document.getElementById('event-input'); if(inp) inp.focus(); }, 60);
}

export function closeEventModal() {
    const eventCreateModal = document.getElementById('event-create-modal');
    if (!eventCreateModal) return;
    eventCreateModal.classList.add('hidden');
}
