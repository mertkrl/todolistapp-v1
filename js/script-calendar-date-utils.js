// ─── TAKVİM/FLATPICKR SAF YARDIMCILARI ────────────────────────────────
// script.js dosyasından çıkarıldı (Faz 2, 2026-07-19). Sıfır paylaşılan
// state bağımlılığı — sadece parametre + DOM/Date/Math kullanıyorlar.
export function _setFlatpickrDate(el, date) {
    if (!el) return;
    if (el._flatpickr) { el._flatpickr.setDate(date, false); }
    else { el.value = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
}
window._setFlatpickrDate = _setFlatpickrDate;

export function _getDateFromFlatpickr(el) {
    if (!el) return null;
    if (el._flatpickr && el._flatpickr.selectedDates.length) return el._flatpickr.selectedDates[0];
    const v = el.value;
    if (!v) return null;
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d);
}
window._getDateFromFlatpickr = _getDateFromFlatpickr;

export function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0,0,0,0);
    return d;
}
window.getWeekStart = getWeekStart;

export function snap15(mins) { return Math.min(45, Math.max(0, Math.round(mins / 15) * 15)); }
window.snap15 = snap15;
