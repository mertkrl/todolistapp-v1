// Faz F: script.js'ten ayrıldı — Alışkanlık challenge takvimi (gün gün durum) hesaplayıcı.
// Faz G (2026-07-26): window.formatDateToString köprüsü yerine gerçek ES import.
import { formatDateToString } from './script-date-time-utils.js';

export function getChallengeDays(habit) {
    const days = [];
    const todayStr = formatDateToString(new Date());
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    // GÜNCELLEME: Gün-Ay-Yıl formatını güvenli parçalayarak nesneye dönüştürüyoruz
    const [sd, sm, sy] = habit.startDate.split('-').map(Number);
    let currentDate = new Date(sy, sm - 1, sd);
    currentDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < habit.targetDays; i++) {
        const dateStr = formatDateToString(currentDate);
        const isCompleted = !!habit.history[dateStr];
        const isToday = dateStr === todayStr;
        const isFuture = currentDate > todayDate;

        let status = '';
        if (isCompleted) status = 'completed';
        else if (isToday) status = 'today';
        else if (!isFuture && !isCompleted) status = 'missed';

        const lockedClass = isFuture ? 'locked' : '';
        days.push({ dayNumber: i + 1, dateStr: dateStr, status: status, locked: lockedClass });
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return days;
}
window.getChallengeDays = getChallengeDays;
