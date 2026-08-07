// ── Ay Özeti Kitabı Modalı ──
// script-journal-library.js dosyasından çıkarıldı: sadece kendi parametrelerine
// (selectedMonth/selectedYear/entries/trMonthsFull) ve kendi DOM'una bağımlıydı,
// dosyanın paylaşılan module-level state'ine (dayBooks, __zkCurrentBook vb.) dokunmuyordu.
export function openZKMonthModal(selectedMonth, selectedYear, entries, trMonthsFull) {
    const modal    = document.getElementById('zk-month-modal');
    const cover    = document.getElementById('zk-month-book-cover');
    if (!modal) return;

    const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2,'0')}`;
    const monthEntries = entries.filter(e => e.date.startsWith(monthKey) && (e.achieve || e.improve));

    const countWords = (str) => (str || '').trim().split(/\s+/).filter(Boolean).length;

    const daysWritten  = monthEntries.length;
    let totalWords     = 0;
    monthEntries.forEach(e => {
        totalWords += countWords(e.achieve) + countWords(e.improve);
    });
    const avgWords = daysWritten > 0 ? Math.round(totalWords / daysWritten) : 0;

    const totalDaysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const now = new Date();
    const isCurrentMonth = now.getFullYear() === selectedYear && now.getMonth() === selectedMonth;
    const daysBase  = isCurrentMonth ? now.getDate() : totalDaysInMonth;
    const fillRate  = daysBase > 0 ? Math.round((daysWritten / daysBase) * 100) : 0;

    // Ay içinde en uzun ardışık yazma serisi — seriyi bozmayı cezalandırmak yerine
    // devam etme direncini öne çıkarır.
    const writtenDates = new Set(monthEntries.map(e => e.date));
    let longestStreak = 0, curStreak = 0;
    for (let d = 1; d <= totalDaysInMonth; d++) {
        const ds = `${monthKey}-${String(d).padStart(2,'0')}`;
        if (writtenDates.has(ds)) {
            curStreak++;
            longestStreak = Math.max(longestStreak, curStreak);
        } else {
            curStreak = 0;
        }
    }

    // Önceki aya göre trend (Yazılan Gün) — mutlak sayı yerine yön göstererek
    // kıyaslamayı kullanıcının kendi geçmişiyle sınırlı tutar.
    const prevDate = new Date(selectedYear, selectedMonth - 1, 1);
    const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2,'0')}`;
    const prevMonthEntries = entries.filter(e => e.date.startsWith(prevMonthKey) && (e.achieve || e.improve));
    const prevDaysWritten = prevMonthEntries.length;
    const fmtTrend = (cur, prev) => {
        if (prev <= 0) return '';
        const diff = cur - prev;
        if (diff === 0) return '';
        return diff > 0 ? ` ▲+${diff}` : ` ▼${diff}`;
    };
    const daysTrend  = fmtTrend(daysWritten, prevDaysWritten);

    // En verimli gün: ay içindeki girdilerin haftanın hangi gününde yoğunlaştığı — bir rutin
    // farkındalığı sağlar, "kaçırılan gün" gibi suçlayıcı bir çerçeve kullanmaz.
    const trWeekdays = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
    const weekdayCounts = [0,0,0,0,0,0,0];
    monthEntries.forEach(e => {
        const [y, m, d] = e.date.split('-').map(Number);
        weekdayCounts[new Date(y, m - 1, d).getDay()]++;
    });
    let bestDayIdx = -1, bestDayCount = 0;
    weekdayCounts.forEach((c, i) => { if (c > bestDayCount) { bestDayCount = c; bestDayIdx = i; } });
    const bestDayText = bestDayIdx >= 0 ? `${trWeekdays[bestDayIdx]} günleri` : '—';

    document.getElementById('zkmm-monthyear').textContent    = `${trMonthsFull[selectedMonth]} ${selectedYear}`;
    document.getElementById('zkmm-days-val').textContent     = `${daysWritten}/${daysBase}`;
    document.getElementById('zkmm-days-trend').textContent   = daysTrend;
    document.getElementById('zkmm-streak-val').textContent   = longestStreak > 0 ? `${longestStreak} gün` : '—';
    document.getElementById('zkmm-avgwords-val').textContent = avgWords > 0 ? `${avgWords}` : '—';
    document.getElementById('zkmm-fillrate-val').textContent = `%${fillRate}`;
    document.getElementById('zkmm-bestday-val').textContent  = bestDayText;
    document.getElementById('zkmm-cover-num').textContent      = trMonthsFull[selectedMonth].slice(0,3);
    document.getElementById('zkmm-cover-monthyear').textContent = `${selectedYear}`;

    const emptyEl = document.getElementById('zkmm-empty');
    if (emptyEl) emptyEl.classList.toggle('hidden', daysWritten > 0);

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    if (cover) {
        cover.style.animation = 'none';
        void cover.offsetHeight;
        cover.style.animation = '';
    }
}

function closeZKMonthModal() {
    const modal = document.getElementById('zk-month-modal');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
}

export function initZKMonthModal() {
    const closeBtn  = document.getElementById('zk-month-modal-close-btn');
    const backdrop  = document.getElementById('zk-month-modal-backdrop');
    if (closeBtn)  closeBtn.addEventListener('click', closeZKMonthModal);
    if (backdrop)  backdrop.addEventListener('click', closeZKMonthModal);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeZKMonthModal();
    });
}
