// Faz F: script.js'ten ayrıldı — Akşam Yansıması / Zihin Kütüphanesi için
// mantıksal tarih ve zaman-penceresi yardımcıları.
// Faz G (2026-07-26): window.formatDateToString köprüsü yerine gerçek ES import.
import { formatDateToString } from './script-date-time-utils.js';

export function getLogicalReflectionDate() {
    let d = new Date();
    if (d.getHours() < 3) {
        d.setDate(d.getDate() - 1);
    }
    return formatDateToString(d);
}
window.getLogicalReflectionDate = getLogicalReflectionDate;

export function isReflectionTime() {
    const h = new Date().getHours();
    return (h >= 20 || h < 3);
}
window.isReflectionTime = isReflectionTime;
