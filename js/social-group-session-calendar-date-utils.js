// social-group-session-calendar-date-utils.js
// social-group-session-calendar.js'ten çıkarıldı (Faz devam): GSC takviminin
// saf tarih/saat yardımcı fonksiyonları — modül-seviyeli state'e bağımlı değiller.

export const GSC_DAYS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

export function gscGetWeekDates(offset) {
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const mondayDiff = (day === 0 ? -6 : 1 - day);
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayDiff + offset * 7);
    monday.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d;
    });
}

export function gscDateKey(date) {
    // ÖNEMLİ: toISOString() UTC'ye çevirir — UTC+3 gibi dilimlerde gece saatlerinde
    // tarih bir gün kayabilirdi (örn. 23:30 yerel saat → ertesi gün UTC). Yerel
    // tarih bileşenlerini kullanmak bu kaymayı önler.
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function gscIsToday(date) {
    return gscDateKey(date) === gscDateKey(new Date());
}

// "HH:MM" + dakika → "HH:MM" (gün içinde sarmalanır, sadece varsayılan bitiş saati önerisi için)
export function gscAddMinutes(timeStr, mins) {
    const [h, m] = (timeStr || '00:00').split(':').map(Number);
    const total = (h * 60 + m + mins + 1440) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// İki "HH:MM" arasındaki farkı dakika olarak döner (bitiş başlangıçtan önceyse negatif/0)
export function gscMinutesBetween(startStr, endStr) {
    const [sh, sm] = (startStr || '00:00').split(':').map(Number);
    const [eh, em] = (endStr || '00:00').split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
}
