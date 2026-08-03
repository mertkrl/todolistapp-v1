// ============================================================
// FOCUSAI SCRIPT-SCHEDULE-CONFLICT-UTILS.JS
// script.js'ten çıkarılmış: alışkanlık süre-dolum kontrolü, saat çakışması
// tespiti, boş saat dilimi önerisi, bir tarih için aktif alışkanlıkların
// listesi ve ana hedef tarih sınırı doğrulaması (isHabitExpired,
// hasTimeConflict, getNextAvailableTimeSlot, getHabitsForDate,
// checkGoalDateBoundaries).
// script.js'in window'a koyduğu ince sarmalayıcıları (__getTasksRef,
// __getCalendarEventsRef, __getHabitsRef, __getGoalsRef, showPremiumModal,
// getFriendsForFilter, currentWeekStr) ve script-date-time-utils.js'in
// formatDateToString/timeToMins yardımcılarını kullanır.
// script.js'ten SONRA yüklenir (index.html'de script.js'in hemen
// ardından).
// ============================================================
import { formatDateToString, timeToMins } from './script-date-time-utils.js';
import { getTasksRef, getCalendarEventsRef, getHabitsRef, getGoalsRef, showPremiumModal } from './script.js';

export function isHabitExpired(habit) {
    if (!habit.startDate || !habit.targetDays) return false;
    const [sd, sm, sy] = habit.startDate.split('-').map(Number);
    const end = new Date(sy, sm - 1, sd);
    end.setDate(end.getDate() + habit.targetDays - 1);
    end.setHours(0, 0, 0, 0);
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    return end < todayDate;
}
window.isHabitExpired = isHabitExpired;

export function hasTimeConflict(dateStr, startMins, endMins, ignoreWeekly = false) {
    const calendarEvents = getCalendarEventsRef();
    if (!calendarEvents[dateStr]) return false;
    if (endMins < startMins) return false;

    const tasks = getTasksRef();
    const taskIds = new Set(tasks.map(t => t.id));

    for (let ev of calendarEvents[dateStr]) {
        if (ignoreWeekly && ev.weekStr === window.currentWeekStr) continue;

        if (ev.id && !taskIds.has(ev.id)) continue;

        const evStart = timeToMins(ev.timeStart || ev.time || "12:00");
        const evEnd = timeToMins(ev.timeEnd || "13:00");
        if (evEnd < evStart) continue;

        if (startMins < evEnd && endMins > evStart) return true;
    }
    return false;
}
window.hasTimeConflict = hasTimeConflict;

export function getNextAvailableTimeSlot(dateStr, durationMins = 60, startHour = 9, endHour = 22) {
    for (let h = startHour; h <= endHour; h++) {
        const startMins = h * 60;
        const endMins = startMins + durationMins;
        if (!hasTimeConflict(dateStr, startMins, endMins)) {
            const endH = Math.floor(endMins / 60) % 24;
            const endM = endMins % 60;
            return {
                start: `${String(h).padStart(2, '0')}:00`,
                end: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
            };
        }
    }
    return { start: '09:00', end: '10:00' };
}
window.getNextAvailableTimeSlot = getNextAvailableTimeSlot;

export function getHabitsForDate(dateStr) {
    const habits = getHabitsRef();
    const [d, m, y] = dateStr.split('-').map(Number);
    const targetDate = new Date(y, m - 1, d);
    targetDate.setHours(0, 0, 0, 0);

    const currentFriends = (typeof window.getFriendsForFilter === 'function')
        ? window.getFriendsForFilter()
        : null;

    return habits.filter(habit => {
        if (!habit.startDate) return false;
        if (currentFriends !== null && habit.buddy && habit.buddy !== 'none' && !currentFriends.includes(habit.buddy)) {
            return false;
        }
        const [sd, sm, sy] = habit.startDate.split('-').map(Number);
        const start = new Date(sy, sm - 1, sd);
        start.setHours(0, 0, 0, 0);
        const end = new Date(sy, sm - 1, sd);
        end.setDate(end.getDate() + habit.targetDays - 1);
        end.setHours(0, 0, 0, 0);
        return targetDate >= start && targetDate <= end;
    });
}
window.getHabitsForDate = getHabitsForDate;

export function getPersonalScheduleConflict(dateStr, startMins, endMins) {
    const calendarEvents = getCalendarEventsRef();
    const tasks = getTasksRef();
    if (!calendarEvents[dateStr] || endMins < startMins) return null;
    const taskIds = new Set(tasks.map(t => t.id));
    for (const ev of calendarEvents[dateStr]) {
        if (ev.id && !taskIds.has(ev.id)) continue;
        const evStart = timeToMins(ev.timeStart || ev.time || "12:00");
        const evEnd = timeToMins(ev.timeEnd || "13:00");
        if (evEnd < evStart) continue;
        if (startMins < evEnd && endMins > evStart) return ev;
    }
    return null;
}
window.getPersonalScheduleConflict = getPersonalScheduleConflict;

export function checkGoalDateBoundaries(parentGoalId, targetDateStr) {
    if (!parentGoalId) return true;

    const goals = getGoalsRef();
    const goal = goals.find(g => String(g.id) === String(parentGoalId));
    if (!goal) return true;

    const parts = targetDateStr.split('-').map(Number);
    let targetDate;
    if (String(parts[0]).length === 4) {
        targetDate = new Date(parts[0], parts[1] - 1, parts[2]);
    } else {
        targetDate = new Date(parts[2], parts[1] - 1, parts[0]);
    }
    targetDate.setHours(0, 0, 0, 0);

    const goalStartDate = new Date(goal.createdAt);
    goalStartDate.setHours(0, 0, 0, 0);

    if (!goal.deadline) return true;
    const [gYear, gMonth, gDay] = goal.deadline.split('-').map(Number);
    const goalEndDate = new Date(gYear, gMonth - 1, gDay);
    goalEndDate.setHours(23, 59, 59, 999);

    if (targetDate < goalStartDate) {
        showPremiumModal({
            title: 'Hatalı Tarih 📅',
            message: `Bu görev, seçtiğiniz ana hedefin başlangıç tarihinden (${formatDateToString(goalStartDate)}) önce olamaz!`,
            type: 'warning'
        });
        return false;
    }

    if (targetDate > goalEndDate) {
        showPremiumModal({
            title: 'Hatalı Tarih 📅',
            message: `Bu görev, seçtiğiniz ana hedefin bitiş tarihinden (${formatDateToString(goalEndDate)}) sonra olamaz!`,
            type: 'warning'
        });
        return false;
    }

    return true;
}
window.checkGoalDateBoundaries = checkGoalDateBoundaries;
