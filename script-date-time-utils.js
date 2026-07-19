// ─── SAF TARİH/SAAT/RENK YARDIMCILARI ─────────────────────────────────
// script.js dosyasından çıkarıldı (Faz 2, 2026-07-19). Sıfır paylaşılan
// state bağımlılığı — sadece parametre + Date/Math kullanıyorlar.
function getProgressColor(pct) {
    function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
    let r, g, b;
    if (pct <= 50) {
        // Altın → Sarı  (#D4900E → #F0C040)
        const t = pct / 50;
        r = lerp(212, 240, t); g = lerp(144, 192, t); b = lerp(14, 64, t);
    } else if (pct <= 80) {
        // Sarı → Sarı-yeşil  (#F0C040 → #A8E063)
        const t = (pct - 50) / 30;
        r = lerp(240, 168, t); g = lerp(192, 224, t); b = lerp(64, 99, t);
    } else {
        // Sarı-yeşil → Yeşil  (#A8E063 → #4ADE80)
        const t = (pct - 80) / 20;
        r = lerp(168, 74, t); g = lerp(224, 222, t); b = lerp(99, 128, t);
    }
    return `rgb(${r},${g},${b})`;
}
window.getProgressColor = getProgressColor;

function formatDateToString(date) {
    return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`; // GÜNCELLEME: Sıralama gün-ay-yıl yapıldı
}
window.formatDateToString = formatDateToString;

// HTML <input type="date"> için dd-mm-yyyy → yyyy-mm-dd
function toInputDate(ddmmyyyy) {
    if (!ddmmyyyy) return '';
    const parts = ddmmyyyy.split('-');
    if (parts.length !== 3) return ddmmyyyy;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}
window.toInputDate = toInputDate;

// <input type="date"> değerini (yyyy-mm-dd) app formatına (dd-mm-yyyy) çevir
function fromInputDate(yyyymmdd) {
    if (!yyyymmdd) return '';
    const parts = yyyymmdd.split('-');
    if (parts.length !== 3) return yyyymmdd;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}
window.fromInputDate = fromInputDate;

function getWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
    return Math.ceil((((date - yearStart) / 86400000) + 1)/7);
}
window.getWeekNumber = getWeekNumber;

function timeToMins(t) {
    if(!t) return 0;
    const parts = t.split(':').map(Number);
    return parts[0] * 60 + parts[1];
}
window.timeToMins = timeToMins;

function getNextRecurringDate(dateStr, recurringType) {
    const [d, m, y] = dateStr.split('-').map(Number); // GÜNCELLENDİ: gün, ay, yıl sırasına alındı
    const date = new Date(y, m - 1, d);
    if (recurringType === 'daily') {
        date.setDate(date.getDate() + 1);
    } else if (recurringType === 'weekly') {
        date.setDate(date.getDate() + 7);
    } else if (recurringType === 'weekdays') {
        date.setDate(date.getDate() + 1);
        while (date.getDay() === 0 || date.getDay() === 6) {
            date.setDate(date.getDate() + 1);
        }
    } else if (recurringType === 'monthly') {
        date.setMonth(date.getMonth() + 1);
    }
    return formatDateToString(date);
}
window.getNextRecurringDate = getNextRecurringDate;

function addOneHour(timeStr) {
    if (!timeStr) return "13:00";
    let [hours, minutes] = timeStr.split(':').map(Number);
    hours = (hours + 1) % 24; // YENİ: 23'ten sonra 00'a (gece yarısı) kusursuz döngü yapar
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
window.addOneHour = addOneHour;
