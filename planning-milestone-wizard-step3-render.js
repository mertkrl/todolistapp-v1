// planning-milestone-wizard-step3-render.js
// planning-milestone-wizard.js'ten çıkarıldı (Faz H/O devamı): Adım 3'teki (tarihleme)
// booking takvimi ay ızgarası + mini gantt önizlemesi + tarih çakışma kontrolü. Bu
// fonksiyonlar wizardState/MS_RANGE_COLORS/_wzS3ActiveMs'i SADECE okur, hiçbirini
// reassign etmez — wizardState (export let) ve _wzS3ActiveMs (export let) canlı
// binding ile ana dosyadan import ediliyor (planning-milestone-wizard-cal.js'teki
// desenle aynı: gerçek ES modül olduğu için reassignment otomatik yansır).
import { getCat } from './planning-utils.js';
import { wizardState, MS_RANGE_COLORS, _wzS3ActiveMs } from './planning-milestone-wizard.js';

// Dönüm noktalarının tarih aralıklarını hesapla
export function _wzGetMsRanges() {
    const today    = new Date(); today.setHours(0,0,0,0);
    const deadline = wizardState.goal.deadline;
    const msList   = wizardState.milestones;
    const lastIdx  = msList.length - 1;
    const ranges   = [];

    msList.forEach((ms, i) => {
        const isLast = i === lastIdx;

        if (isLast && deadline) {
            // Son milestone: ancak önceki tüm milestone'ların tarihi bilindiyse aralığı çiz
            // (tek milestone ise başlangıç = bugün, o da olur)
            const prev = lastIdx > 0 ? msList[lastIdx - 1] : null;
            if (lastIdx > 0 && !prev?.due_date) return; // önceki henüz seçilmedi

            const start = prev?.due_date
                ? (() => { const d = new Date(prev.due_date); d.setDate(d.getDate() + 1); d.setHours(0,0,0,0); return d; })()
                : new Date(today);
            const end = new Date(deadline); end.setHours(0,0,0,0);
            if (start <= end) {
                ranges.push({ msIdx: i, ms, start, end, isLast: true, color: MS_RANGE_COLORS[i % MS_RANGE_COLORS.length] });
            }
            return;
        }

        // Ara milestone'lar: sadece due_date seçilmişse aralık çiz
        if (!ms.due_date) return;

        const prevWithDate = msList.slice(0, i).reverse().find(m => m.due_date);
        let start;
        if (prevWithDate?.due_date) {
            start = new Date(prevWithDate.due_date);
            start.setDate(start.getDate() + 1);
            start.setHours(0,0,0,0);
        } else {
            start = new Date(today);
        }
        const end = new Date(ms.due_date); end.setHours(0,0,0,0);
        if (start <= end) {
            ranges.push({ msIdx: i, ms, start, end, isLast: false, color: MS_RANGE_COLORS[i % MS_RANGE_COLORS.length] });
        }
    });
    return ranges;
}

export function _wzRenderBookingMonth(year, month, ranges) {
    const today        = new Date(); today.setHours(0,0,0,0);
    const deadlineStr  = wizardState.goal.deadline;
    const deadlineDate = deadlineStr ? (() => { const d = new Date(deadlineStr); d.setHours(0,0,0,0); return d; })() : null;
    const firstDay = new Date(year, month, 1);
    const lastDate = new Date(year, month + 1, 0).getDate();
    const startDow = (firstDay.getDay() + 6) % 7; // Pzt=0
    const label    = firstDay.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    const dayHdrs  = ['Pt','Sa','Ça','Pe','Cu','Ct','Pz'];
    const deadlineDay = (() => {
        if (!deadlineStr) return null;
        const d = new Date(deadlineStr);
        return (d.getFullYear() === year && d.getMonth() === month) ? d.getDate() : null;
    })();

    let cells = '';
    // Boş hücreler (haftanın başına kadar)
    for (let i = 0; i < startDow; i++) cells += '<div class="pg-wz-bcal-day empty"></div>';

    for (let d = 1; d <= lastDate; d++) {
        const dateStr        = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const dateObj        = new Date(year, month, d);
        const isPast         = dateObj < today;
        const isAfterDl      = deadlineDate && dateObj > deadlineDate; // deadline sonrası
        const isOutOfRange   = isPast || isAfterDl;                    // seçilemeyen gün
        const isToday        = dateObj.getTime() === today.getTime();
        const dow            = (dateObj.getDay() + 6) % 7; // Pzt=0, Paz=6

        // Hangi aralıkta?
        let rng = null;
        for (const r of ranges) {
            if (dateObj >= r.start && dateObj <= r.end) { rng = r; break; }
        }

        let bgColor = '', brVal = '';
        let extraHtml   = '';
        let cls = 'pg-wz-bcal-day';
        if (isToday)    cls += ' today';
        if (isPast)     cls += ' past';
        if (isAfterDl)  cls += ' past'; // aynı görsel: soluk, tıklanamaz
        let isRangeEndDay = false;

        if (rng) {
            const isRangeStart = dateObj.getTime() === rng.start.getTime();
            const isRangeEnd   = dateObj.getTime() === rng.end.getTime();
            isRangeEndDay = isRangeEnd;
            const isRowStart   = dow === 0; // Pazartesi
            const isRowEnd     = dow === 6; // Pazar

            // Kenar yuvarlamaları: aralık başı/sonu veya satır başı/sonu
            const roundL = isRangeStart || isRowStart;
            const roundR = isRangeEnd   || isRowEnd;
            let br;
            if (roundL && roundR) br = '8px';
            else if (roundL)      br = '8px 0 0 8px';
            else if (roundR)      br = '0 8px 8px 0';
            else                  br = '0';

            // Aralık sonu (due date): daha koyu, rozet göster
            const bgAlpha = isRangeEnd ? 'bb' : '2e';
            bgColor = `${rng.color}${bgAlpha}`;
            brVal   = br;

            if (isRangeEnd) {
                cls += ' bcal-range-end';
                extraHtml = `<div class="pg-wz-bcal-ms-badge" data-badge-color="${rng.color}">${rng.msIdx + 1}</div>`;
            }
            if (isRangeStart && !isRangeEnd) {
                cls += ' bcal-range-start';
                extraHtml = `<div class="pg-wz-bcal-range-flag" data-flag-color="${rng.color}"></div>`;
            }
        } else if (deadlineDay === d) {
            cls += ' deadline';
            extraHtml = '<div class="pg-wz-bcal-dl-dot"></div>';
        }

        // Aktif aşamanın due date'i = imleç çerçevesi
        const activeMs = wizardState.milestones[_wzS3ActiveMs];
        if (activeMs?.due_date === dateStr) cls += ' active-ms';

        cells += `<div class="${cls}"${!isOutOfRange ? ` data-date="${dateStr}" role="button"` : ''}${bgColor ? ` data-bg-color="${bgColor}" data-br="${brVal}"` : ''}>
            <span class="pg-wz-bcal-d-num"${isRangeEndDay ? ' data-endnum="1"' : ''}>${d}</span>
            ${extraHtml}
        </div>`;
    }

    return `<div class="pg-wz-bcal-month">
        <div class="pg-wz-bcal-month-label">${label}</div>
        <div class="pg-wz-bcal-grid">
            ${dayHdrs.map(h=>`<div class="pg-wz-bcal-day-hdr">${h}</div>`).join('')}
            ${cells}
        </div>
    </div>`;
}

export function _wzRenderMiniGantt() {
    const el       = document.getElementById('pg-wz-gantt-preview');
    if (!el) return;
    const deadline = wizardState.goal.deadline ? new Date(wizardState.goal.deadline) : null;
    const today    = new Date();
    const ms       = wizardState.milestones.filter(m => m.due_date);
    if (!deadline || !ms.length) { el.style.display = 'none'; return; }
    el.style.display = '';

    const totalDays = Math.max(1, Math.ceil((deadline - today) / 86400000));
    const cat = getCat(wizardState.goal.category);

    const markers = ms.map(m => {
        const days = Math.ceil((new Date(m.due_date) - today) / 86400000);
        const pct  = Math.max(2, Math.min(97, (days / totalDays) * 100));
        return { ...m, pct };
    });

    el.innerHTML = `
        <div class="pg-wz-gantt-label"><i class="ti ti-timeline"></i> Zaman Çizelgesi — ${ms.length} dönüm noktası</div>
        <div class="pg-wz-gantt-track">
            <div class="pg-wz-gantt-bg"></div>
            <div class="pg-wz-gantt-today-mark"></div>
            <div class="pg-wz-gantt-deadline-mark"></div>
            ${markers.map(m => `
                <div class="pg-wz-gantt-marker" data-marker-id="${m.id}">
                    <div class="pg-wz-gantt-marker-dot"></div>
                    <div class="pg-wz-gantt-marker-label">${m.icon} ${window.esc(m.title.length > 10 ? m.title.slice(0, 9) + '…' : m.title)}</div>
                </div>`).join('')}
        </div>
        <div class="pg-wz-gantt-dates">
            <span>Bugün</span>
            <span>${deadline.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>`;

    el.querySelector('.pg-wz-gantt-label i')?.style.setProperty('color', cat.color);
    el.querySelectorAll('.pg-wz-gantt-marker[data-marker-id]').forEach(markerEl => {
        const m = markers.find(mm => mm.id === markerEl.dataset.markerId);
        if (!m) return;
        markerEl.style.left = m.pct + '%';
        const dotEl = markerEl.querySelector('.pg-wz-gantt-marker-dot');
        if (dotEl) { dotEl.style.background = cat.color; dotEl.style.color = cat.color; }
    });
}

export function _wzCheckConflicts() {
    const warnEl = document.getElementById('pg-wz-conflict-warn');
    if (!warnEl) return;
    const conflicts = [];
    wizardState.milestones.forEach(m => {
        if (!m.due_date) return;
        for (const g of window._pgGetGoals()) {
            for (const existMs of (g.milestones || [])) {
                if (existMs.due_date === m.due_date && !existMs.done) {
                    conflicts.push(`"${window.esc(m.title)}" tarihi, "${window.esc(existMs.title)}" ile aynı gün`);
                }
            }
        }
    });
    if (conflicts.length) {
        warnEl.style.display = '';
        warnEl.innerHTML = `<i class="ti ti-alert-triangle"></i> ${conflicts[0]}${conflicts.length > 1 ? ' (+' + (conflicts.length - 1) + ' daha)' : ''}`;
    } else {
        warnEl.style.display = 'none';
    }
}
