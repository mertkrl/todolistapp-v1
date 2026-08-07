// planning-wizard.js'ten çıkarıldı: saf tarih yardımcıları (closure/state bağımlılığı yok)

export function _localToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function _pvDayAfter(dateStr) {
    if (!dateStr) return _localToday();
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Normalize any date to YYYY-MM-DD (handles DD-MM-YYYY from the main app)
export function _normYMD(d) {
    if (!d) return '';
    const p = d.split('-');
    if (p.length !== 3) return d;
    return p[0].length === 2 ? `${p[2]}-${p[1]}-${p[0]}` : d;
}
