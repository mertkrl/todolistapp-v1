// ─── PLANVIEW SAAT/TARİH/MİLESTONE BİÇİMLENDİRME YARDIMCILARI ─────────────
// planning.js dosyasından çıkarıldı (Faz O, üçüncü dilim): PlanView (hedef
// detay paneli/takvim) render fonksiyonlarının kullandığı saf (pure) saat,
// tarih ve milestone-indeksi yardımcıları. Hiçbiri planning.js'in
// goals/dependencies/activeFilters gibi paylaşılan durumuna DOKUNMUYOR —
// hepsi sadece kendilerine verilen parametreleri okuyup bir değer döndürüyor.
//
// Dış bağımlılık: _normYMD (planning-wizard.js'te tanımlı, window._normYMD
// köprüsü zaten var ve bu dosyadan ÖNCE yükleniyor) — bare referans yeterli.
//
// window._pvIsMirrorMs / window._pvWeekTotalMins / window._pvFmtDuration /
// window._pvAddHour köprüleri KORUNDU — planning-plan-header.js ve
// planning.js'in alt export köprüleri bunları kullanıyor.

function _dstrLocal(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Her zaman "09:00" gibi sıfır dolgulu, iki haneli saat:dakika biçimi
function _pvFmtHM(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    return `${String(h||0).padStart(2,'0')}:${String(m||0).padStart(2,'0')}`;
}

window._pvFmtDuration = _pvFmtDuration; // planning-plan-header.js için
function _pvFmtDuration(mins) {
    if (mins <= 0) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} dk`;
    if (m === 0) return `${h} sa`;
    return `${h} sa ${m} dk`;
}

function _pvTimeToMin(t) {
    const [h, m] = (t || '00:00').split(':').map(Number);
    return h * 60 + (m || 0);
}

function _pvMinToTime(m) {
    return `${String(Math.floor(m / 60)).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`;
}

window._pvAddHour = _pvAddHour;
function _pvAddHour(t) {
    const m = _pvTimeToMin(t) + 60;
    return _pvMinToTime(Math.min(m, 22 * 60));
}

window._pvIsMirrorMs = _pvIsMirrorMs; // planning-plan-header.js için
function _pvIsMirrorMs(m) { return !!(m && (m.task_mirror_id || m.is_task_mirror)); }

function _pvMsIcon(ms, g) {
    if (ms.icon) return ms.icon;
    const catIcons = { egitim:'📖', saglik:'💪', kariyer:'💼', finans:'💰', kisisel:'🌱', diger:'🎯' };
    return catIcons[g.category] || '🎯';
}

function _pvGetMsIndex(g, msId) {
    return (g.milestones || []).findIndex(m => m.id === msId);
}

window._pvWeekTotalMins = _pvWeekTotalMins; // planning-plan-header.js için
function _pvWeekTotalMins(tasks, wStart, wEnd) {
    let mins = 0;
    tasks.forEach(t => {
        if (!t.date || t._pending) return;
        const d = _normYMD(t.date);
        if (d < wStart || d > wEnd) return;
        if (t.timeStart && t.timeEnd) {
            const diff = _pvTimeToMin(t.timeEnd) - _pvTimeToMin(t.timeStart);
            if (diff > 0) mins += diff;
        }
    });
    return mins;
}

// Günün 09:00–21:00 aralığında boş bir 1 saatlik dilim arar (hızlı görev
// ekleme formunda saat otomatik doldurma için) — bulamazsa günün sonuna
// (21:00–22:00) yığar.
function _pvFindFreeSlot(tasks, dateStr) {
    const dayTasks = tasks.filter(t => _normYMD(t.date) === dateStr && t.timeStart && t.timeEnd);
    const occupied = new Set();
    dayTasks.forEach(t => {
        const s = _pvTimeToMin(t.timeStart);
        const e = _pvTimeToMin(t.timeEnd);
        for (let m = s; m < e; m++) occupied.add(m);
    });
    const start9  = 9 * 60;
    const end22   = 22 * 60;
    for (let s = start9; s < end22; s++) {
        const e = s + 60;
        if (e > end22) break;
        let free = true;
        for (let m = s; m < e; m++) {
            if (occupied.has(m)) { free = false; break; }
        }
        if (free) return { start: _pvMinToTime(s), end: _pvMinToTime(e) };
    }
    return { start: '21:00', end: '22:00' };
}

// Faz O: gerçek export (planning.js bu dosyadan ÖNCE yüklendiği için güvenli
// — bkz. inline-module-loader.js). window.* köprüleri KALDIRILMADI:
// planning-plan-header.js hâlâ window.* üzerinden çağırıyor.
export {
    _dstrLocal, _pvFmtHM, _pvFmtDuration, _pvTimeToMin, _pvMinToTime,
    _pvAddHour, _pvIsMirrorMs, _pvMsIcon, _pvGetMsIndex, _pvWeekTotalMins,
    _pvFindFreeSlot
};
