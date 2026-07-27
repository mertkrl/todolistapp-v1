// ─── PLANLAMA SİHİRBAZI — Planlayıcı Takvim Yardımcıları ───────────────
// planning-milestone-wizard.js dosyasından çıkarıldı (Faz H/I devamı,
// 2026-07-26). Adım 4'teki günlük/haftalık/aylık planlayıcı takvim
// ızgarasının HTML üretimi + click binding'i — bu fonksiyonlar SADECE
// birbirini çağırır ve ana dosyada TEK bir yerden (_wzRenderMsPlanner,
// _wzPlannerCalHTML üzerinden) çağrılır. wizardState canlı binding
// (export let) ile planning-milestone-wizard.js'ten import ediliyor —
// gerçek ES modül olduğu için reassignment (openWizard/closeWizard'daki
// wizardState = {...} / null) burada da otomatik yansır, window.* köprüsü
// gerekmez. window.fmtShort kullanımı (haftalık görünüm etiketleri) zaten
// global olduğu için olduğu gibi bırakıldı.

import { wizardState } from './planning-milestone-wizard.js';

export function _wzPlannerCalHTML(ms, idx, cat, det) {
    const prevMs   = wizardState.milestones[idx - 1];
    const startRaw = prevMs?.due_date ? new Date(prevMs.due_date) : new Date();
    const start    = new Date(startRaw); start.setDate(start.getDate() + 1);
    const end      = ms.due_date ? new Date(ms.due_date) : new Date(new Date().getTime() + 30 * 86400000);
    if (end < start) return `<div class="pg-wz-s4-no-range"><i class="ti ti-calendar-off"></i> Adım 3'te bu aşamaya tarih atayın.</div>`;
    const units = det.planned_units || [];
    if (wizardState.planMode === 'weekly')  return _wzWeeklyCalHTML(start, end, units, cat);
    if (wizardState.planMode === 'monthly') return _wzMonthlyCalHTML(start, end, units, cat);
    return _wzDailyCalHTML(start, end, units, cat);
}

// ── Planlayıcı Yardımcı Fonksiyonlar ────────────────────────────
export function _wzAllDaysInRange(start, end) {
    const days = []; const cur = new Date(start);
    while (cur <= end) {
        days.push(cur.toISOString().split('T')[0]);
        cur.setDate(cur.getDate() + 1);
    }
    return days;
}
export function _wzWeekdaysInRange(start, end) {
    return _wzAllDaysInRange(start, end).filter(ds => {
        const d = new Date(ds).getDay();
        return d !== 0 && d !== 6; // Pazartesi-Cuma
    });
}
export function _wzWeekendsInRange(start, end) {
    return _wzAllDaysInRange(start, end).filter(ds => {
        const d = new Date(ds).getDay();
        return d === 0 || d === 6;
    });
}
export function _wzAllWeeksInRange(start, end) {
    const keys = []; const mon = new Date(start);
    const dow = mon.getDay(); mon.setDate(mon.getDate() - (dow === 0 ? 6 : dow - 1));
    while (mon <= end) {
        const jan1 = new Date(mon.getFullYear(), 0, 1);
        const wn   = Math.ceil((((mon - jan1) / 86400000) + jan1.getDay() + 1) / 7);
        keys.push(`${mon.getFullYear()}-W${String(wn).padStart(2,'0')}`);
        mon.setDate(mon.getDate() + 7);
    }
    return keys;
}
export function _wzAllMonthsInRange(start, end) {
    const keys = []; const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const endM  = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cur <= endM) {
        keys.push(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`);
        cur.setMonth(cur.getMonth() + 1);
    }
    return keys;
}

export function _wzPlanToolbar(count, label, cat, quickBtns) {
    const pct = count > 0 ? 100 : 0; // sadece "seçildi" gösterimi
    return `<div class="pg-wz-plan-toolbar">
        <div class="pg-wz-plan-counter-wrap">
            <span class="pg-wz-plan-counter" style="color:${count > 0 ? cat.color : '#555'};">
                ${count > 0 ? `<i class="ti ti-check" style="color:${cat.color};"></i> ${count} ${label} seçildi` : `<i class="ti ti-hand-click"></i> Planlayacağın ${label}leri seç`}
            </span>
        </div>
        <div class="pg-wz-plan-quick-btns">
            ${quickBtns}
            ${count > 0 ? `<button class="pg-wz-plan-qbtn pg-wz-plan-qbtn-clear" data-action="clear" type="button"><i class="ti ti-x"></i> Temizle</button>` : ''}
        </div>
    </div>`;
}

export function _wzDailyCalHTML(start, end, units, cat) {
    const today    = new Date();
    const months   = [];
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const endM = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cur <= endM) { months.push({ year: cur.getFullYear(), month: cur.getMonth() }); cur.setMonth(cur.getMonth() + 1); }
    const dayHdrs  = ['Pt','Sa','Ça','Pe','Cu','Ct','Pz'];
    const selCount = units.length;

    const toolbar = _wzPlanToolbar(selCount, 'gün', cat,
        `<button class="pg-wz-plan-qbtn" data-action="weekdays" type="button">Hafta İçi</button>
         <button class="pg-wz-plan-qbtn" data-action="weekends" type="button">Haftasonu</button>
         <button class="pg-wz-plan-qbtn" data-action="all" type="button">Tümü</button>`
    );

    const grid = months.map(({ year, month }) => {
        const first    = new Date(year, month, 1);
        const last     = new Date(year, month + 1, 0).getDate();
        const startDow = (first.getDay() + 6) % 7;
        const label    = first.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
        let cells = '';
        for (let i = 0; i < startDow; i++) cells += '<div class="pg-wz-plan-day empty"></div>';
        for (let d = 1; d <= last; d++) {
            const ds   = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const dObj = new Date(year, month, d);
            const inR  = dObj >= start && dObj <= end;
            const sel  = units.includes(ds);
            const isT  = dObj.getTime() === new Date(today.toDateString()).getTime();
            const dow  = (dObj.getDay() + 6) % 7; // 5=Ct, 6=Pz
            const isWE = dow === 5 || dow === 6;
            let cls = `pg-wz-plan-day${inR ? ' in-range' : ' out-range'}${sel ? ' selected' : ''}${isT ? ' today' : ''}${isWE && inR ? ' weekend' : ''}`;
            cells += `<div class="${cls}"${inR ? ` data-unit="${ds}" role="button"` : ''}
                style="${sel ? `background:${cat.color}33;border-color:${cat.color};color:${cat.color};font-weight:700;` : ''}">
                ${d}${isT ? '<div class="pg-wz-plan-today-dot"></div>' : ''}
            </div>`;
        }
        return `<div class="pg-wz-plan-month-block">
            <div class="pg-wz-plan-month-label">${label}</div>
            <div class="pg-wz-plan-day-hdrs">${dayHdrs.map((h,i) => `<div class="${i>=5?'weekend-hdr':''}">${h}</div>`).join('')}</div>
            <div class="pg-wz-plan-day-grid">${cells}</div>
        </div>`;
    }).join('');

    return toolbar + grid;
}

export function _wzWeeklyCalHTML(start, end, units, cat) {
    const today = new Date(); today.setHours(0,0,0,0);
    const weeks = [];
    const mon = new Date(start);
    const dow = mon.getDay(); mon.setDate(mon.getDate() - (dow === 0 ? 6 : dow - 1));
    while (mon <= end) {
        const ws   = new Date(mon); const we = new Date(mon); we.setDate(we.getDate() + 6);
        const jan1 = new Date(ws.getFullYear(), 0, 1);
        const wn   = Math.ceil((((ws - jan1) / 86400000) + jan1.getDay() + 1) / 7);
        const isCurrentWeek = today >= ws && today <= we;
        weeks.push({ key: `${ws.getFullYear()}-W${String(wn).padStart(2,'0')}`, start: new Date(ws), end: new Date(we), isCurrent: isCurrentWeek });
        mon.setDate(mon.getDate() + 7);
    }

    const selCount = units.length;
    const toolbar  = _wzPlanToolbar(selCount, 'hafta', cat,
        `<button class="pg-wz-plan-qbtn" data-action="all-weeks" type="button">Tüm Haftalar</button>`
    );

    // Her hafta için gün göstergesi (Pt-Pz küçük kutucuklar)
    const dayLetters = ['P','S','Ç','P','C','C','P'];
    const rows = weeks.map(w => {
        const sel = units.includes(w.key);
        // O haftanın hangi günleri range içinde?
        const dayDots = Array.from({length:7}, (_,i) => {
            const day = new Date(w.start); day.setDate(day.getDate() + i);
            const inR = day >= start && day <= end;
            return `<div class="pg-wz-week-day-dot${inR?' active':''}" style="${inR && sel ? `background:${cat.color};` : ''}"></div>`;
        }).join('');
        return `<div class="pg-wz-plan-week${sel?' selected':''}${w.isCurrent?' current':''}" data-unit="${w.key}" role="button"
            style="${sel ? `background:${cat.color}18;border-color:${cat.color};` : ''}">
            <div class="pg-wz-week-main">
                <div class="pg-wz-week-dates" style="${sel ? `color:${cat.color};font-weight:700;` : ''}">${window.fmtShort(w.start)} — ${window.fmtShort(w.end)}</div>
                ${w.isCurrent ? `<span class="pg-wz-week-current-badge" style="color:${cat.color};border-color:${cat.color}44;background:${cat.color}15;">Bu Hafta</span>` : ''}
            </div>
            <div class="pg-wz-week-day-dots">${dayDots}</div>
            <i class="ti ${sel?'ti-check':'ti-plus'} pg-wz-week-icon" style="${sel?`color:${cat.color}`:'color:#444'};"></i>
        </div>`;
    }).join('');

    return toolbar + `<div class="pg-wz-plan-weeks">${rows}</div>`;
}

export function _wzMonthlyCalHTML(start, end, units, cat) {
    const months = [];
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const endM = new Date(end.getFullYear(), end.getMonth(), 1);
    const monthAbbr = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
    while (cur <= endM) {
        months.push({
            key:   `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`,
            label: cur.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }),
            abbr:  monthAbbr[cur.getMonth()],
            year:  cur.getFullYear(),
            month: cur.getMonth(),
        });
        cur.setMonth(cur.getMonth() + 1);
    }

    const selCount = units.length;
    const toolbar  = _wzPlanToolbar(selCount, 'ay', cat,
        `<button class="pg-wz-plan-qbtn" data-action="all-months" type="button">Tüm Aylar</button>`
    );

    const cards = months.map(m => {
        const sel    = units.includes(m.key);
        // Ay içindeki kaç gün range'de?
        const firstD = new Date(m.year, m.month, 1);
        const lastD  = new Date(m.year, m.month + 1, 0);
        const rStart = firstD > start ? firstD : start;
        const rEnd   = lastD  < end   ? lastD  : end;
        const daysInRange = rEnd >= rStart
            ? Math.ceil((rEnd - rStart) / 86400000) + 1
            : 0;
        return `<div class="pg-wz-plan-month-card${sel?' selected':''}" data-unit="${m.key}" role="button"
            style="${sel ? `background:${cat.color}20;border-color:${cat.color};` : ''}">
            <div class="pg-wz-month-abbr" style="${sel ? `color:${cat.color};` : ''}">${m.abbr}</div>
            <div class="pg-wz-month-full" style="${sel ? `color:${cat.color};font-weight:700;` : ''}">${m.label}</div>
            <div class="pg-wz-month-days-hint">${daysInRange} gün</div>
            <div class="pg-wz-month-check" style="${sel ? `background:${cat.color};` : ''}">
                <i class="ti ${sel ? 'ti-check' : 'ti-plus'}" style="color:${sel ? '#fff' : '#444'};font-size:14px;"></i>
            </div>
        </div>`;
    }).join('');

    return toolbar + `<div class="pg-wz-plan-months">${cards}</div>`;
}

export function _wzBindPlannerCal(wrap, ms, det, cat) {
    const msIdx = wizardState.s4MsIdx || 0;

    const rerender = () => {
        const calWrap = document.getElementById('pg-wz-s4-cal-wrap');
        if (!calWrap) return;
        calWrap.innerHTML = _wzPlannerCalHTML(ms, msIdx, cat, det);
        _wzBindPlannerCal(calWrap, ms, det, cat);
    };

    const getDotsDone = () => {
        const dots = document.getElementById('pg-wz-s4-ms-dots');
        if (!dots) return;
        dots.querySelectorAll('.pg-wz-s4-dot').forEach((dot, i) => {
            const m2 = wizardState.milestones[i];
            const d2 = wizardState.msDet[m2?.id];
            dot.classList.toggle('done', !!(d2?.criteria || d2?.planned_units?.length));
        });
    };

    // Milestone'un tarih aralığını hesapla (quick action'lar için)
    const prevMs   = wizardState.milestones[msIdx - 1];
    const startRaw = prevMs?.due_date ? new Date(prevMs.due_date) : new Date();
    const rangeStart = new Date(startRaw); rangeStart.setDate(rangeStart.getDate() + 1);
    const rangeEnd   = ms.due_date ? new Date(ms.due_date) : new Date(new Date().getTime() + 30*86400000);

    wrap.addEventListener('click', e => {
        // Hızlı seçim butonları
        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
            const action = actionBtn.dataset.action;
            if (!det.planned_units) det.planned_units = [];
            if      (action === 'clear')      det.planned_units = [];
            else if (action === 'all')         det.planned_units = _wzAllDaysInRange(rangeStart, rangeEnd);
            else if (action === 'weekdays')    det.planned_units = _wzWeekdaysInRange(rangeStart, rangeEnd);
            else if (action === 'weekends')    det.planned_units = _wzWeekendsInRange(rangeStart, rangeEnd);
            else if (action === 'all-weeks')   det.planned_units = _wzAllWeeksInRange(rangeStart, rangeEnd);
            else if (action === 'all-months')  det.planned_units = _wzAllMonthsInRange(rangeStart, rangeEnd);
            rerender();
            getDotsDone();
            return;
        }

        // Tekil birim seçimi
        const el = e.target.closest('[data-unit]');
        if (!el) return;
        const unit = el.dataset.unit;
        if (!det.planned_units) det.planned_units = [];
        const i = det.planned_units.indexOf(unit);
        if (i !== -1) det.planned_units.splice(i, 1);
        else det.planned_units.push(unit);
        const sel = det.planned_units.includes(unit);

        // Görsel güncelle (tam re-render yerine sadece bu elemanı güncelle)
        el.classList.toggle('selected', sel);
        const isMon = wizardState.planMode === 'monthly';
        el.style.background  = sel ? `${cat.color}${isMon ? '20' : '33'}` : '';
        el.style.borderColor = sel ? cat.color : '';
        el.style.color       = sel ? cat.color : '';
        if (isMon) {
            const circle = el.querySelector('.pg-wz-month-check');
            if (circle) circle.style.background = sel ? cat.color : '';
            const icon = circle?.querySelector('i');
            if (icon) { icon.className = `ti ${sel ? 'ti-check' : 'ti-plus'}`; icon.style.color = sel ? '#fff' : '#444'; }
            const full = el.querySelector('.pg-wz-month-full');
            if (full) { full.style.color = sel ? cat.color : ''; full.style.fontWeight = sel ? '700' : ''; }
        } else {
            const icon = el.querySelector('[class*="ti-check"],[class*="ti-plus"]');
            if (icon) { icon.className = `ti ${sel ? 'ti-check' : 'ti-plus'}`; icon.style.color = sel ? cat.color : ''; }
            const dots2 = el.querySelectorAll('.pg-wz-week-day-dot.active');
            dots2.forEach(dot => dot.style.background = sel ? cat.color : '');
        }

        // Toolbar counter güncelle
        const counter = wrap.querySelector('.pg-wz-plan-counter');
        if (counter) {
            const n = det.planned_units.length;
            const lbl = wizardState.planMode === 'daily' ? 'gün' : wizardState.planMode === 'weekly' ? 'hafta' : 'ay';
            counter.style.color = n > 0 ? cat.color : '#555';
            counter.innerHTML = n > 0
                ? `<i class="ti ti-check" style="color:${cat.color};"></i> ${n} ${lbl} seçildi`
                : `<i class="ti ti-hand-click"></i> Planlayacağın ${lbl}leri seç`;
            // Temizle butonunu göster/gizle
            const clearBtn = wrap.querySelector('[data-action="clear"]');
            if (!clearBtn && n > 0) rerender();
            else if (clearBtn && n === 0) rerender();
        }

        getDotsDone();
    });
}
