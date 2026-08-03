// social-institution-classroom-perf-utils.js
// social-institution-panel.js'ten çıkarıldı (Faz P2): renderClassroomTab'in performans
// tablosu/dağılımı/trend hesaplarını üreten SAF yardımcı fonksiyonlar. Hiçbiri dışarıdan
// hiçbir yerel değişken okumuyor/yazmıyor, sadece parametrelerine (+ bu dosyadaki sabitlere)
// bağlı saf hesaplama/HTML-string üretimi yapıyor. Davranış birebir aynı — sadece artık
// ayrı bir modülde ve `export`la dışa açık.

export const CP_CATEGORY_META = {
    egitim:  { label: 'Eğitim',  icon: '🧠', color: '#7c6eff' },
    saglik:  { label: 'Sağlık',  icon: '💪', color: '#ef476f' },
    kariyer: { label: 'Kariyer', icon: '💼', color: '#06d6a0' },
    finans:  { label: 'Finans',  icon: '💰', color: '#ffd166' },
    kisisel: { label: 'Kişisel', icon: '🌱', color: '#ff9f43' },
    diger:   { label: 'Diğer',   icon: '✨', color: '#a78bfa' },
};
export function _renderCategoryBreakdownHtml(rows, opts) {
    if (!rows || !rows.length) return '';
    const total = rows.reduce((s, r) => s + (r.minutes || 0), 0);
    if (!total) return '';
    const scopeLabel = opts?.scopeLabel || 'bu hafta, sınıf geneli';
    const captionText = opts?.captionText || 'Sınıfın bu hafta odaklandığı zamanın alanlara dağılımı (uygulamanın genel Eğitim/Kariyer/Kişisel gelişim kategorileri — ders bazlı bir ayrım değil).';
    return `
        <div class="cp-section-title u-margin-top-22px" >
            <i class="fa-solid fa-chart-pie u-color-h7c6eff" ></i> Alan Dağılımı <small>${scopeLabel}</small>
        </div>
        <p class="cp-hint u-margin-4px010px" >${captionText}</p>
        <div class="cp-cat-breakdown">
            ${rows.map(r => {
                const meta = CP_CATEGORY_META[r.category] || { label: r.category, icon: '•', color: '#888' };
                const pct = Math.max(2, Math.round((r.minutes / total) * 100));
                return `
                <div class="cp-cat-row">
                    <span class="cp-cat-label">${meta.icon} ${meta.label}</span>
                    <div class="cp-cat-bar-track"><div class="cp-cat-bar-fill" data-dyn-w="${pct}" data-dyn-bg="${meta.color}"></div></div>
                    <span class="cp-cat-minutes">${window.formatFocusMinutes(r.minutes)}</span>
                </div>`;
            }).join('')}
        </div>`;
}

// ── Performans tablosu saf yardımcı fonksiyonları (Faz H iç-bölme) ──
export const _CT_TREND_WEEKS = 4;
export const _CT_TREND_MIN_TOTAL = 4;
export function _ctPctColor(pct) { return pct === null ? '#888' : pct >= 80 ? '#06d6a0' : pct >= 50 ? '#feca57' : '#ff8f70'; }
export function _ctDistJitter(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return (Math.abs(h) % 9) - 4; }
export function _ctSparkHtml(buckets) {
    if (!buckets || !buckets.some(b => b.assigned)) return '<span class="cp-perf-spark-empty">—</span>';
    return `<span class="cp-perf-spark" title="Son ${_CT_TREND_WEEKS} hafta">${buckets.map(b => {
        if (!b.assigned) return '<span class="cp-perf-spark-bar cp-perf-spark-bar--empty"></span>';
        const pct = Math.round((b.done / b.assigned) * 100);
        const h = Math.max(3, Math.round((pct / 100) * 24));
        return `<span class="cp-perf-spark-bar" data-dyn-h="${h}" data-dyn-bg="${_ctPctColor(pct)}" title="%${pct}"></span>`;
    }).join('')}</span>`;
}
export function _ctTrendDirection(buckets) {
    if (!buckets) return null;
    const totalAssigned = buckets.reduce((sum, b) => sum + (b.assigned || 0), 0);
    if (totalAssigned < _CT_TREND_MIN_TOTAL) return null;
    const points = buckets.map((b, i) => b.assigned ? { x: i, y: b.done / b.assigned } : null).filter(p => p !== null);
    if (points.length < 2) return null;
    const n = points.length;
    const meanX = points.reduce((s, p) => s + p.x, 0) / n;
    const meanY = points.reduce((s, p) => s + p.y, 0) / n;
    const num = points.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0);
    const den = points.reduce((s, p) => s + (p.x - meanX) ** 2, 0);
    if (den === 0) return null;
    const slope = num / den;
    const totalChange = slope * (buckets.length - 1);
    if (totalChange >= 0.15) return 'up';
    if (totalChange <= -0.15) return 'down';
    return 'flat';
}
export function _ctTrendArrowHtml(dir, labels) {
    const t = labels || { up: 'Yükseliş trendi', down: 'Düşüş trendi' };
    if (dir === 'up') return `<i class="fa-solid fa-arrow-trend-up cp-trend-icon cp-trend-icon--up" title="${t.up}"></i>`;
    if (dir === 'down') return `<i class="fa-solid fa-arrow-trend-down cp-trend-icon cp-trend-icon--down" title="${t.down}"></i>`;
    return '';
}
export function _ctRenderPerfRowsHtml(rows, showClassColumn, memberLabel, anomalyMeta, contextMeta, focusTrendLabels) {
    return rows.map((r, i) => r.is_hidden ? `
        <div class="cp-row cp-row--admin${showClassColumn ? ' cp-row--withclass' : ''}">
            <span>${i + 1}</span>
            <span class="cp-name cp-perf-name-link" data-user-id="${r.user_id}" title="Rapor sekmesinde ${window._escapeHtml(r.name)} için detay aç">${window._escapeHtml(r.name)}</span>
            ${showClassColumn ? `<span class="cp-perf-class-tag" title="${window._escapeHtml(r.className || '')}">${window._escapeHtml(r.className || '—')}</span>` : ''}
            <span class="u-grid-column-span4_color-var-text-muted_font-size-12px"><i class="fa-solid fa-lock"></i> İstatistiklerini gizledi</span>
            <button class="cp-row-kick-btn" data-user-id="${r.user_id}" data-name="${window._escapeHtml(r.name)}" title="${memberLabel === 'Çalışan' ? 'Ekipten' : 'Sınıftan'} çıkar"><i class="fa-solid fa-user-xmark"></i></button>
        </div>` : `
        <div class="cp-row cp-row--admin${showClassColumn ? ' cp-row--withclass' : ''}${r.supportFlag ? ' cp-row--support' : ''}${r.anomaly ? ' cp-row--anomaly' : ''}">
            <span>${i + 1}</span>
            <span class="cp-name cp-perf-name-link" data-user-id="${r.user_id}" title="Rapor sekmesinde ${window._escapeHtml(r.name)} için detay aç">${window._escapeHtml(r.name)}${r.supportFlag ? '<span class="cp-support-badge"><i class="fa-solid fa-hand-holding-heart"></i> Destek Önerilir</span>' : ''}${r.anomaly ? `<span class="cp-anomaly-badge" title="${window._escapeHtml(r.anomalyDetail || anomalyMeta[r.anomaly].title)}"><i class="fa-solid fa-triangle-exclamation"></i> ${anomalyMeta[r.anomaly].label}</span>` : ''}${(r.contextNotes && r.contextNotes.length) ? `<span class="cp-context-note" title="${r.contextNotes.map(k => contextMeta[k].title).join(' • ')}"><i class="fa-solid fa-circle-info"></i> ${r.contextNotes.map(k => contextMeta[k].label).join(', ')}</span>` : ''}</span>
            ${showClassColumn ? `<span class="cp-perf-class-tag" title="${window._escapeHtml(r.className || '')}">${window._escapeHtml(r.className || '—')}</span>` : ''}
            <span class="cp-asg-pct-cell${r.lowSample ? ' cp-asg-pct-cell--lowsample' : ''}">
                ${r.assigned ? `
                <div class="cp-asg-pct-track"><div class="cp-asg-pct-fill" data-dyn-w="${r.pct}" data-dyn-bg="${_ctPctColor(r.pct)}"></div></div>
                <b data-dyn-color="${_ctPctColor(r.pct)}">${r.done}/${r.assigned}</b>${r.lowSample ? `<span class="cp-lowsample-badge cp-lowsample-badge--icon" title="Az veri: sadece ${r.assigned} ödev üzerinden hesaplandı — bu kadar az veride % oranı tek bir ödevle bile büyük ölçüde değişebilir, ${r.done}/${r.assigned} rakamına bakmak daha güvenilir"><i class="fa-solid fa-circle-info"></i></span>` : ''}` : `<span class="u-font-size-11px_color-var-text-muted">Ödev yok</span>`}
            </span>
            <span class="cp-perf-trend-cell">${_ctSparkHtml(r.trend)}${_ctTrendArrowHtml(r.trendDir)}</span>
            <span class="cp-perf-focus-cell">${window.formatFocusMinutes(r.weekly_minutes)}${_ctTrendArrowHtml(r.focusTrendDir, focusTrendLabels)}</span>
            <span class="cp-perf-active-cell">${r.active_days}/7</span>
            <button class="cp-row-kick-btn" data-user-id="${r.user_id}" data-name="${window._escapeHtml(r.name)}" title="${memberLabel === 'Çalışan' ? 'Ekipten' : 'Sınıftan'} çıkar"><i class="fa-solid fa-user-xmark"></i></button>
        </div>`).join('');
}
export function _ctRenderPerfDistributionHtml(rows, LOW_SAMPLE_MAX, memberLabel) {
    const scored = rows.filter(r => !r.is_hidden && !r.isNewMember && r.assigned >= LOW_SAMPLE_MAX);
    if (scored.length < 4) return '';
    const vals = scored.map(r => r.pct).sort((a, b) => a - b);
    const pctile = (p) => {
        const idx = (vals.length - 1) * p;
        const lo = Math.floor(idx), hi = Math.ceil(idx);
        return lo === hi ? vals[lo] : vals[lo] + (vals[hi] - vals[lo]) * (idx - lo);
    };
    const min = vals[0], max = vals[vals.length - 1];
    const q1 = pctile(0.25), median = pctile(0.5), q3 = pctile(0.75);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const W = 600, padX = 14, plotW = W - padX * 2, boxY = 26, boxH = 18, dotsY = boxY + boxH + 16, H = dotsY + 12;
    const xOf = (v) => padX + (v / 100) * plotW;
    const dotsHtml = scored.map(r => {
        const cx = xOf(r.pct);
        const cy = dotsY + _ctDistJitter(r.user_id || r.name || '');
        return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3" fill="${_ctPctColor(r.pct)}" opacity="0.85"><title>${window._escapeHtml(r.name)}: %${r.pct}</title></circle>`;
    }).join('');
    return `
    <div class="cp-perf-dist">
        <div class="cp-perf-dist-title">Sınıf Dağılımı <small>ödev tamamlama %, n=${scored.length}</small></div>
        <svg viewBox="0 0 ${W} ${H}" class="cp-perf-dist-svg" preserveAspectRatio="none">
            <line x1="${padX}" y1="${boxY + boxH / 2}" x2="${xOf(q1).toFixed(1)}" y2="${boxY + boxH / 2}" stroke="var(--text-muted)" stroke-width="1.5"/>
            <line x1="${xOf(q3).toFixed(1)}" y1="${boxY + boxH / 2}" x2="${(padX + plotW).toFixed(1)}" y2="${boxY + boxH / 2}" stroke="var(--text-muted)" stroke-width="1.5"/>
            <line x1="${xOf(min).toFixed(1)}" y1="${boxY + 2}" x2="${xOf(min).toFixed(1)}" y2="${boxY + boxH - 2}" stroke="var(--text-muted)" stroke-width="1.5"/>
            <line x1="${xOf(max).toFixed(1)}" y1="${boxY + 2}" x2="${xOf(max).toFixed(1)}" y2="${boxY + boxH - 2}" stroke="var(--text-muted)" stroke-width="1.5"/>
            <rect x="${xOf(q1).toFixed(1)}" y="${boxY}" width="${Math.max(0, xOf(q3) - xOf(q1)).toFixed(1)}" height="${boxH}" fill="rgba(116,185,255,0.15)" stroke="#74b9ff" stroke-width="1.5" rx="3"></rect>
            <line x1="${xOf(median).toFixed(1)}" y1="${boxY}" x2="${xOf(median).toFixed(1)}" y2="${boxY + boxH}" stroke="#74b9ff" stroke-width="2.5"><title>Medyan: %${Math.round(median)}</title></line>
            <line x1="${xOf(mean).toFixed(1)}" y1="${boxY - 6}" x2="${xOf(mean).toFixed(1)}" y2="${boxY + boxH + 6}" stroke="#feca57" stroke-width="1.5" stroke-dasharray="3,2"><title>Ortalama: %${Math.round(mean)}</title></line>
            ${dotsHtml}
        </svg>
        <div class="cp-perf-dist-legend">
            <span><i class="cp-perf-dist-swatch u-background-h74b9ff" ></i> Medyan %${Math.round(median)}</span>
            <span><i class="cp-perf-dist-swatch u-background-hfeca57" ></i> Ortalama %${Math.round(mean)}${Math.abs(mean - median) >= 10 ? ' <span class="cp-perf-dist-skew-note">(sınıf ortalaması aşırı uçlardan etkileniyor olabilir)</span>' : ''}</span>
            <span class="cp-perf-dist-hint">Kutu: orta %50 (Ç1–Ç3) · Çizgiler: min–maks · Nokta: her ${memberLabel.toLowerCase()}</span>
        </div>
    </div>`;
}
export const _CT_LOW_SAMPLE_MAX = 5;
export const _CT_MIN_ASSIGNED_FOR_SUPPORT = 3;
export const _CT_FOCUS_MISMATCH_HIGH_MULT = 1.5;
export const _CT_FOCUS_MISMATCH_LOW_MULT = 0.5;
export const _CT_FOCUS_MISMATCH_MIN_MEDIAN = 30;
export const _CT_FOCUS_MISMATCH_HIGH_FLOOR = 60;
export const _CT_FOCUS_MISMATCH_HIGH_COMPLETION = 80;
export const _CT_FOCUS_Z_MIN_BASELINE_WEEKS = 3;
export const _CT_FOCUS_Z_DROP_THRESHOLD = -1.5;
export const _CT_FOCUS_Z_MIN_STD = 10;
export const _CT_PERIOD_LABEL = { all: 'tüm zamanlar', '7d': 'son 7 gün', '30d': 'son 30 gün' };
export const _CT_FOCUS_TREND_LABELS = { up: 'Odak süresi geçen haftaya göre artıyor', down: 'Odak süresi geçen haftaya göre azalıyor', flat: 'Odak süresi geçen haftayla benzer' };
export const _CT_ANOMALY_META = {
    focus_drop: { label: 'Ani Düşüş', title: 'Bu haftaki odak süresi geçen haftaya göre belirgin şekilde düştü' },
    focus_drop_z: { label: 'Ani Düşüş', title: 'Bu haftaki odak süresi, öğrencinin KENDİ geçmiş ortalamasına göre olağan dalgalanmanın belirgin şekilde altında' },
    assignment_decline: { label: 'Gerileme', title: 'Ödev tamamlama oranı son haftalarda düşüş eğiliminde' },
    focus_output_mismatch: { label: 'Efor Karşılıksız', title: 'Sınıf ortalamasının belirgin üzerinde odaklanıyor ama ödev tamamlama oranı düşük — harcanan zaman çıktıya yansımıyor' },
};
export const _CT_CONTEXT_META = {
    newMember: { label: 'Yeni katıldı', title: 'Son 7 gün içinde sınıfa katıldı — henüz yeterli veri birikmedi' },
    lowActivity: { label: 'Aktif gün az', title: 'Bu hafta 1 veya daha az gün aktif oldu — devamsızlık veya erişim sorunu olabilir' },
    classAvgLow: { label: 'Sınıf geneli düşük', title: 'Sınıfın geneli bu dönemde düşük tamamlama oranına sahip — bireysel değil, sistemik bir durum olabilir' },
    singleAssignmentDip: { label: 'Tek ödeve özgü', title: 'Genel performansı iyi, düşüş son ödev(ler)e özgü görünüyor' },
    efficientLowFocus: { label: 'Az sürede verimli', title: 'Sınıf ortalamasının belirgin altında odak süresine rağmen ödevlerini büyük ölçüde tamamlıyor — muhtemelen uygulama dışında da çalışıyor, düşük dakika onu "az çalışıyor" gibi göstermesin' },
};
export const _CT_PERF_SORT_KEYS = {
    name: { get: r => r.name || '', type: 'text' },
    className: { get: r => r.className || '', type: 'text' },
    pct: { get: r => r.pct, type: 'num' },
    weekly_minutes: { get: r => r.weekly_minutes, type: 'num' },
    active_days: { get: r => r.active_days, type: 'num' },
};
export function _ctSortPerfRows(key, dir, rows) {
    const spec = _CT_PERF_SORT_KEYS[key] || _CT_PERF_SORT_KEYS.name;
    const mul = dir === 'desc' ? -1 : 1;
    const arr = [...rows];
    arr.sort((a, b) => {
        const av = spec.get(a), bv = spec.get(b);
        const aNull = av === null || av === undefined;
        const bNull = bv === null || bv === undefined;
        if (aNull && bNull) return (a.name || '').localeCompare(b.name || '', 'tr');
        if (aNull) return 1;
        if (bNull) return -1;
        if (spec.type === 'text') return mul * String(av).localeCompare(String(bv), 'tr');
        return mul * (av - bv);
    });
    return arr;
}
export function _ctBuildPerfCounts(period, assignments, studentMembers, stepDoneByAsg, subsByAsg) {
    const cutoff = period === '7d' ? Date.now() - 7 * 86400000 : period === '30d' ? Date.now() - 30 * 86400000 : null;
    const scoped = cutoff ? assignments.filter(a => a.created_at && new Date(a.created_at).getTime() >= cutoff) : assignments;
    const assignedByUser = {};
    const doneByUser = {};
    const now = new Date();
    scoped.forEach(a => {
        const resolved = a.status === 'closed' || (a.due_date && new Date(a.due_date) < now);
        const targets = (a.target_user_ids && a.target_user_ids.length)
            ? a.target_user_ids
            : studentMembers.map(m => m.userId);
        const isMultiStep = !!(a.steps && a.steps.length);
        const doneMap = isMultiStep ? (stepDoneByAsg[a.id] || {}) : null;
        const subUsers = isMultiStep ? null : (subsByAsg[a.id] || []);
        targets.forEach(uid => {
            const isDone = isMultiStep
                ? !!(doneMap[uid] && a.steps.every(s => doneMap[uid].has(s.id)))
                : subUsers.includes(uid);
            if (!resolved && !isDone) return;
            assignedByUser[uid] = (assignedByUser[uid] || 0) + 1;
            if (isDone) doneByUser[uid] = (doneByUser[uid] || 0) + 1;
        });
    });
    return { assignedByUser, doneByUser };
}
export function _ctBuildPerfRows(period, statsRes, studentMembers, assignments, stepDoneByAsg, subsByAsg, trendByUser, focusZInfo) {
    const LOW_SAMPLE_MAX = _CT_LOW_SAMPLE_MAX;
    const MIN_ASSIGNED_FOR_SUPPORT = _CT_MIN_ASSIGNED_FOR_SUPPORT;
    const FOCUS_Z_DROP_THRESHOLD = _CT_FOCUS_Z_DROP_THRESHOLD;
    const FOCUS_MISMATCH_MIN_MEDIAN = _CT_FOCUS_MISMATCH_MIN_MEDIAN;
    const FOCUS_MISMATCH_HIGH_MULT = _CT_FOCUS_MISMATCH_HIGH_MULT;
    const FOCUS_MISMATCH_HIGH_FLOOR = _CT_FOCUS_MISMATCH_HIGH_FLOOR;
    const FOCUS_MISMATCH_LOW_MULT = _CT_FOCUS_MISMATCH_LOW_MULT;
    const FOCUS_MISMATCH_HIGH_COMPLETION = _CT_FOCUS_MISMATCH_HIGH_COMPLETION;
    const statsById = {};
    (statsRes.data || []).forEach(r => { statsById[r.user_id] = r; });
    const { assignedByUser, doneByUser } = _ctBuildPerfCounts(period, assignments, studentMembers, stepDoneByAsg, subsByAsg);
    const rows = studentMembers
        .map(m => {
            const s = statsById[m.userId] || {};
            const assigned = assignedByUser[m.userId] || 0;
            const done = doneByUser[m.userId] || 0;
            const pct = assigned ? Math.round((done / assigned) * 100) : null;
            const lowSample = assigned > 0 && assigned < LOW_SAMPLE_MAX;
            const trend = trendByUser[m.userId] || null;
            const trendDir = _ctTrendDirection(trend);
            const weeklyMinutes = s.weekly_minutes || 0;
            const activeDays = s.active_days || 0;
            const prevWeekMinutes = typeof s.prev_week_minutes === 'number' ? s.prev_week_minutes : null;
            const zInfo = !s.is_hidden ? focusZInfo(m.userId, weeklyMinutes) : null;
            const focusDropZ = zInfo && zInfo.z <= FOCUS_Z_DROP_THRESHOLD;
            const focusDropFixed = !zInfo && !s.is_hidden && prevWeekMinutes !== null && prevWeekMinutes >= 30 && weeklyMinutes < prevWeekMinutes * 0.4;
            const focusDrop = focusDropZ || focusDropFixed;
            const anomaly = focusDrop ? (zInfo ? 'focus_drop_z' : 'focus_drop') : (trendDir === 'down' ? 'assignment_decline' : null);
            const anomalyDetail = focusDrop && zInfo
                ? `Bu hafta ${weeklyMinutes} dk, kendi son ${zInfo.weeksUsed} haftalık ortalaması ${zInfo.mean} dk (±${zInfo.std} dk) — yaklaşık ${Math.abs(zInfo.z).toFixed(1)} standart sapma altında`
                : null;
            let focusTrendDir = null;
            if (!s.is_hidden && prevWeekMinutes !== null) {
                const diff = weeklyMinutes - prevWeekMinutes;
                if (diff >= 15) focusTrendDir = 'up';
                else if (diff <= -15) focusTrendDir = 'down';
                else focusTrendDir = 'flat';
            }

            const isNewMember = !!(m.joinedAt && (Date.now() - m.joinedAt) < 7 * 86400000);
            const contextNotes = [];
            if (isNewMember) contextNotes.push('newMember');
            if (!s.is_hidden && activeDays <= 1) contextNotes.push('lowActivity');
            if (trend) {
                const weekPcts = trend.map(b => b.assigned ? (b.done / b.assigned) * 100 : null);
                const lastPct = weekPcts[weekPcts.length - 1];
                const priorValid = weekPcts.slice(0, -1).filter(p => p !== null);
                if (lastPct !== null && lastPct < 50 && priorValid.length && (priorValid.reduce((a, b) => a + b, 0) / priorValid.length) >= 70) {
                    contextNotes.push('singleAssignmentDip');
                }
            }

            return {
                user_id: m.userId, name: m.displayName || '?',
                classSectionId: m.classSectionId || null,
                is_hidden: !!s.is_hidden,
                weekly_minutes: weeklyMinutes, active_days: activeDays,
                prev_week_minutes: prevWeekMinutes, focusTrendDir,
                assigned, done, pct, isNewMember, lowSample,
                trend, trendDir, anomaly, anomalyDetail, contextNotes,
            };
        });
    const scored = rows.filter(r => r.assigned >= MIN_ASSIGNED_FOR_SUPPORT && !r.isNewMember);
    let supportThreshold = 34;
    let classAvgPct = null;
    if (scored.length >= 3) {
        classAvgPct = scored.reduce((sum, r) => sum + r.pct, 0) / scored.length;
        const variance = scored.reduce((sum, r) => sum + (r.pct - classAvgPct) ** 2, 0) / scored.length;
        const stddev = Math.sqrt(variance);
        supportThreshold = Math.min(50, Math.max(15, Math.round(classAvgPct - Math.max(stddev, 12))));
    }
    const focusScored = rows.filter(r => !r.is_hidden && !r.isNewMember);
    let classMedianFocus = null;
    if (focusScored.length >= 3) {
        const sortedFocus = focusScored.map(r => r.weekly_minutes).sort((a, b) => a - b);
        const mid = Math.floor(sortedFocus.length / 2);
        classMedianFocus = sortedFocus.length % 2 ? sortedFocus[mid] : Math.round((sortedFocus[mid - 1] + sortedFocus[mid]) / 2);
    }
    rows.forEach(r => {
        r.supportFlag = r.assigned >= MIN_ASSIGNED_FOR_SUPPORT && !r.isNewMember && r.pct < supportThreshold;
        if (r.isNewMember) r.anomaly = null;
        if (!r.isNewMember && !r.is_hidden && r.assigned >= LOW_SAMPLE_MAX && r.pct !== null
            && classMedianFocus !== null && classMedianFocus >= FOCUS_MISMATCH_MIN_MEDIAN) {
            const highFocusBar = Math.max(classMedianFocus * FOCUS_MISMATCH_HIGH_MULT, FOCUS_MISMATCH_HIGH_FLOOR);
            const lowFocusBar = classMedianFocus * FOCUS_MISMATCH_LOW_MULT;
            const isHighFocus = r.weekly_minutes >= highFocusBar;
            const isLowFocus = r.weekly_minutes <= lowFocusBar;
            const isLowCompletion = r.pct < supportThreshold;
            const isHighCompletion = r.pct >= FOCUS_MISMATCH_HIGH_COMPLETION;
            if (isHighFocus && isLowCompletion && (!r.anomaly || r.anomaly === 'assignment_decline')) {
                r.anomaly = 'focus_output_mismatch';
                r.anomalyDetail = `Bu hafta ${r.weekly_minutes} dk odaklandı (sınıf medyanı ~${classMedianFocus} dk) ama ödevlerin sadece ${r.pct}%'ini tamamladı (${r.done}/${r.assigned}) — harcanan zaman çıktıya yansımıyor, yöntem/dikkat/anlama desteği gerekebilir`;
            } else if (isLowFocus && isHighCompletion) {
                r.contextNotes.push('efficientLowFocus');
            }
        }
        if (r.supportFlag && classAvgPct !== null && classAvgPct < 40) r.contextNotes.push('classAvgLow');
        if (r.isNewMember) {
            r.contextNotes = ['newMember'];
        } else if (!r.supportFlag && !r.anomaly && !r.contextNotes.includes('efficientLowFocus')) {
            r.contextNotes = [];
        } else if (r.contextNotes.length) {
            const priority = ['classAvgLow', 'efficientLowFocus', 'singleAssignmentDip', 'lowActivity'];
            r.contextNotes = [...new Set(r.contextNotes)]
                .sort((a, b) => priority.indexOf(a) - priority.indexOf(b))
                .slice(0, 2);
        }
    });
    rows.__supportThreshold = supportThreshold;
    return rows;
}
