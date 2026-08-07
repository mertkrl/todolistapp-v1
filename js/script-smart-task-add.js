// Akıllı görev ekleme (rutin/tekrar eden görev genişletmesi) — Faz H2,
// script.js'ten çıkarıldı. Sadece global window.* fonksiyonlarına
// (addGlobalTask/formatDateToString/timeToMins) ve hasTimeConflict/generateId
// global'lerine bağımlı — closure state bağımlılığı yok.
import { showPremiumModal } from './script-premium-modal.js';

export function addSmartTask(text, priority, category, startDateStr, start, end, parentHabit, parentGoal, recurring) {
    if (!recurring) {
        // Rutin değilse normal şekilde 1 tane ekle geç
        window.addGlobalTask(text, priority, category, startDateStr, start, end, parentHabit, parentGoal, "", "");
        return;
    }

    const routineId = 'rutin_' + generateId(); // YENİ: Ortak Kimlik
    const [d, m, y] = startDateStr.split('-').map(Number); // GÜNCELLEME: d, m, y sırasına alındı
    let currDate = new Date(y, m - 1, d);
    const limitDays = 30; // Önümüzdeki 30 gün için takvimi rezerve et
    let addedCount = 0;

    for (let i = 0; i < limitDays; i++) {
        let addThisDay = false;
        let checkDate = new Date(currDate);
        checkDate.setDate(checkDate.getDate() + i);
        let dayOfWeek = checkDate.getDay(); // 0 Pazar, 6 Cumartesi

        if (recurring === 'daily') {
            addThisDay = true;
        } else if (recurring === 'weekdays') {
            if (dayOfWeek !== 0 && dayOfWeek !== 6) addThisDay = true;
        } else if (recurring === 'weekly') {
            if (i % 7 === 0) addThisDay = true;
        } else if (recurring === 'monthly') {
            if (checkDate.getDate() === d) addThisDay = true;
        }

        if (addThisDay) {
            const dateStr = window.formatDateToString(checkDate);
            const conflict = hasTimeConflict(dateStr, window.timeToMins(start), window.timeToMins(end));
            if (!conflict) {
                window.addGlobalTask(text, priority, category, dateStr, start, end, parentHabit, parentGoal, recurring, routineId);
                addedCount++;
            }
        }
    }

    if (addedCount > 1) {
        setTimeout(() => {
            showPremiumModal({ title: 'Rutin Oluşturuldu 🔄', message: `Önümüzdeki 30 gün içinde toplam ${addedCount} adet görev takviminize otomatik olarak yerleştirildi.`, type: 'success' });
        }, 600);
    }
}
window.addSmartTask = (...args) => addSmartTask(...args);
