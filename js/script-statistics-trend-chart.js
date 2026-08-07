// script-statistics-trend-chart.js
// script-statistics.js'ten çıkarıldı: renderStatistics'in İlerleme Trend
// Grafiği bölümü — sadece kendi parametrelerine (filterDays, highlightHistory)
// ve dışa açık köprülere bağımlı, diğer render yardımcılarıyla paylaşılan
// mutable state yok.
import { getTasksRef } from './script.js';
import { formatDateToString } from './script-date-time-utils.js';

     // renderStatistics'in İlerleme Trend Grafiği bölümü — SVG çizgi grafiği,
     // sadece filterDays ve highlightHistory'i dışarıdan alır.
     export function renderProgressTrendChart(filterDays, highlightHistory) {
         // --- İlerleme Trend Grafiği ---
        // Not: eskiden harici Chart.js CDN'ine bağımlıydı; ağ/CSP/reklam engelleyici
        // gibi sebeplerle kütüphane yüklenemediğinde grafik sessizce hiç görünmüyordu.
        // Artık bağımlılıksız, saf CSS/DOM tabanlı bir bar grafiği kullanıyoruz — her
        // koşulda render olur. Ayrıca seçili periyoda (7/30 gün, tüm zamanlar) göre
        // hem başlık hem veri çözünürlüğü uyarlanıyor.
        const trendBarsWrap = document.getElementById('weeklyTrendBars');
        const trendTitleEl  = document.getElementById('weeklyTrendTitle');
        if (trendBarsWrap) {
            const completedByDate = {};
            getTasksRef().forEach(t => { if (t.completed && t.date) completedByDate[t.date] = (completedByDate[t.date] || 0) + 1; });
            Object.entries(highlightHistory).forEach(([ds, h]) => { if (h.completed) completedByDate[ds] = (completedByDate[ds] || 0) + 1; });
            const trendFocusHistory = FocusStorage.get('focus_history', {});

            let barData = [];

            if (filterDays === 7 || filterDays === 30) {
                if (trendTitleEl) trendTitleEl.textContent = `Son ${filterDays} Günlük İlerleme`;
                for (let i = filterDays - 1; i >= 0; i--) {
                    const d = new Date(); d.setDate(d.getDate() - i);
                    const ds = formatDateToString(d);
                    const dayNamesShortTr = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
                    const label = filterDays === 7
                        ? `${d.getDate()} ${window.monthNamesShort ? window.monthNamesShort[d.getMonth()] : ''}`
                        : `${d.getDate()}`;
                    const dayNum = filterDays === 7
                        ? `${dayNamesShortTr[d.getDay()]} ${d.getDate()}`
                        : String(d.getDate());
                    barData.push({ label, dayNum, full: `${d.getDate()} ${window.monthNamesShort ? window.monthNamesShort[d.getMonth()] : ''} ${dayNamesShortTr[d.getDay()]}`, value: completedByDate[ds] || 0, value2: trendFocusHistory[ds] || 0 });
                }
            } else {
                // Tüm Zamanlar — günlük çözünürlük okunaksız olacağı için son 12 ay aylık toplanıyor.
                if (trendTitleEl) trendTitleEl.textContent = 'Aylık İlerleme (Tüm Zamanlar)';
                const nowM = new Date();
                for (let i = 11; i >= 0; i--) {
                    const monthDate = new Date(nowM.getFullYear(), nowM.getMonth() - i, 1);
                    const y = monthDate.getFullYear(), m = monthDate.getMonth();
                    const daysInMonth = new Date(y, m + 1, 0).getDate();
                    let monthTotal = 0, monthFocusTotal = 0;
                    for (let day = 1; day <= daysInMonth; day++) {
                        const ds = `${String(day).padStart(2, '0')}-${String(m + 1).padStart(2, '0')}-${y}`;
                        monthTotal += completedByDate[ds] || 0;
                        monthFocusTotal += trendFocusHistory[ds] || 0;
                    }
                    const label = window.monthNamesShort ? window.monthNamesShort[m] : `${m + 1}`;
                    barData.push({ label, dayNum: label, full: `${label} ${y}`, value: monthTotal, value2: monthFocusTotal });
                }
            }

            const hasData = barData.some(b => b.value > 0 || b.value2 > 0);
            if (!hasData) {
                trendBarsWrap.innerHTML = `
                    <div class="trend-empty-state">
                        <i class="fa-solid fa-chart-line"></i>
                        <p>Bu dönemde henüz tamamlanmış görev yok</p>
                        <span>Görev tamamladıkça burada ilerlemeni göreceksin</span>
                    </div>
                `;
            } else {

            // İki serinin ölçekleri çok farklı (görev: 0-10, odak dk: 0-150+) —
            // aynı Y eksenini paylaştıklarında küçük olan seri tabana yapışıp
            // okunamıyordu. Artık her seri KENDİ eksenine sahip: solda görev
            // sayısı, sağda odak dakikası. Gridline'ların çakışmaması için iki
            // ölçek de aynı bölme sayısını (DIV) kullanır; adım "temiz" değere
            // (1-2-5 × 10^k) yukarı yuvarlanır.
            const DIV = 4;
            const niceScaleFor = (rawMax) => {
                const target = Math.max(1, rawMax) / DIV;
                const pow = Math.pow(10, Math.floor(Math.log10(target)));
                const step = [1, 2, 5, 10].map(m => m * pow).find(s => s >= target);
                const max = step * DIV;
                const ticks = [];
                for (let v = 0; v <= max; v += step) ticks.push(v);
                return { max, ticks };
            };
            const scaleTasks = niceScaleFor(Math.max(1, ...barData.map(b => b.value)));
            const scaleFocus = niceScaleFor(Math.max(1, ...barData.map(b => b.value2)));

            // viewBox genişliği konteynerin gerçek genişliğinden alınır; sabit 600
            // + preserveAspectRatio="none" kombinasyonu geniş ekranlarda yazıları
            // yatayda gerip okunmaz hale getiriyordu.
            // Çizim fonksiyona alındı: konteyner genişliği sekme geçiş animasyonu
            // sırasında yanlış ölçülebiliyor; ResizeObserver gerçek genişlik
            // oturduğunda grafiği doğru oranla yeniden çizer.
            const buildTrendChart = () => {
            const measuredW = trendBarsWrap.clientWidth;
            const W = measuredW > 100 ? Math.round(measuredW - 8) : 600, H = 236, padL = 34, padR = 40, padT = 20, padB = 28;
            const innerW = W - padL - padR, innerH = H - padT - padB;
            const n = barData.length;
            const xFor = i => n === 1 ? padL + innerW / 2 : padL + (innerW * i) / (n - 1);
            const yForTasks = v => padT + innerH - (v / scaleTasks.max) * innerH;
            const yForFocus = v => padT + innerH - (v / scaleFocus.max) * innerH;

            const points = barData.map((b, i) => ({ x: xFor(i), y: yForTasks(b.value), y2: yForFocus(b.value2), ...b }));
            const points2 = points.map(p => ({ ...p, y: p.y2 }));

            // Yumuşak eğri: monotonik kübik Hermite (Fritsch-Carlson).
            // Not: eskiden Catmull-Rom kullanılıyordu; ama 0->yüksek->0 gibi keskin
            // sıçramalarda eğri taban çizgisinin altına/üstüne taşıyordu (overshoot),
            // bu da grafiğin "bozuk" görünmesine yol açıyordu. Monotonik Hermite eğrisi
            // komşu noktaların değer aralığını asla aşmaz.
            const smoothPath = (pts) => {
                const n = pts.length;
                if (n < 2) return n ? `M${pts[0].x},${pts[0].y}` : '';
                if (n === 2) return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} L${pts[1].x.toFixed(1)},${pts[1].y.toFixed(1)}`;

                const dx = [], slope = [];
                for (let i = 0; i < n - 1; i++) {
                    dx[i] = pts[i + 1].x - pts[i].x;
                    slope[i] = dx[i] === 0 ? 0 : (pts[i + 1].y - pts[i].y) / dx[i];
                }

                const tangent = new Array(n);
                tangent[0] = slope[0];
                tangent[n - 1] = slope[n - 2];
                for (let i = 1; i < n - 1; i++) {
                    tangent[i] = (slope[i - 1] * slope[i] <= 0) ? 0 : (slope[i - 1] + slope[i]) / 2;
                }
                for (let i = 0; i < n - 1; i++) {
                    if (slope[i] === 0) { tangent[i] = 0; tangent[i + 1] = 0; continue; }
                    const a = tangent[i] / slope[i], b = tangent[i + 1] / slope[i];
                    const s = a * a + b * b;
                    if (s > 9) {
                        const t = 3 / Math.sqrt(s);
                        tangent[i] = t * a * slope[i];
                        tangent[i + 1] = t * b * slope[i];
                    }
                }

                let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
                for (let i = 0; i < n - 1; i++) {
                    const p0 = pts[i], p1 = pts[i + 1];
                    const cp1x = p0.x + dx[i] / 3, cp1y = p0.y + tangent[i] * dx[i] / 3;
                    const cp2x = p1.x - dx[i] / 3, cp2y = p1.y - tangent[i + 1] * dx[i] / 3;
                    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
                }
                return d;
            };
            const linePath = smoothPath(points);
            const linePath2 = smoothPath(points2);

            // Gridlines + çift Y ekseni etiketleri: sol = görev (turuncu),
            // sağ = odak dakikası (mor). İki ölçek de DIV bölmeli olduğundan
            // her gridline'ın iki ucunda kendi eksen değeri hizalı durur.
            const gridAndYLabels = scaleTasks.ticks.map((v, ti) => {
                const y = yForTasks(v);
                const vFocus = scaleFocus.ticks[ti];
                return `
                    <line class="${v === 0 ? 'trend-baseline' : 'trend-grid-line'}" x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}"/>
                    <text class="trend-axis-label trend-axis-label-tasks" x="${padL - 8}" y="${(y + 3).toFixed(1)}" text-anchor="end">${v}</text>
                    <text class="trend-axis-label trend-axis-label-focus" x="${W - padR + 8}" y="${(y + 3).toFixed(1)}" text-anchor="start">${vFocus}</text>
                `;
            }).join('');

            // X ekseni etiketleri: sade gün numarası (referans görseldeki gibi)
            const maxXLabels = 7;
            const xLabelStride = Math.max(1, Math.ceil(n / maxXLabels));
            const xLabels = points.map((p, i) => {
                const show = i === 0 || i === n - 1 || i % xLabelStride === 0;
                if (!show) return '';
                return `<text class="trend-x-label" x="${p.x.toFixed(1)}" y="${H - 6}" text-anchor="middle">${escapeHtml(p.dayNum)}</text>`;
            }).join('');

            const dotsFor = (pts, cls) => pts.map(p => `<circle class="${cls}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5"/>`).join('');
            const baseline = (padT + innerH).toFixed(1);
            const areaFor = (linePathStr, pts) => `${linePathStr} L${pts[pts.length - 1].x.toFixed(1)},${baseline} L${pts[0].x.toFixed(1)},${baseline} Z`;

            trendBarsWrap.innerHTML = `
                <div class="trend-axis-title trend-axis-title-tasks"><span class="trend-legend-dot trend-series-tasks-dot"></span>Görev</div>
                <div class="trend-axis-title trend-axis-title-focus">Odak (dk)<span class="trend-legend-dot trend-series-focus-dot"></span></div>
                <svg class="trend-line-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="trendGradTasks" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="var(--a, #D4900E)" stop-opacity="0.22"/>
                            <stop offset="100%" stop-color="var(--a, #D4900E)" stop-opacity="0"/>
                        </linearGradient>
                        <linearGradient id="trendGradFocus" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#a29bfe" stop-opacity="0.20"/>
                            <stop offset="100%" stop-color="#a29bfe" stop-opacity="0"/>
                        </linearGradient>
                    </defs>
                    ${gridAndYLabels}
                    <path class="trend-line-area trend-area-focus" d="${areaFor(linePath2, points2)}"/>
                    <path class="trend-line-area trend-area-tasks" d="${areaFor(linePath, points)}"/>
                    <path class="trend-line-path trend-series-focus" d="${linePath2}"/>
                    <path class="trend-line-path trend-series-tasks" d="${linePath}"/>
                    ${dotsFor(points2, 'trend-line-dot trend-series-focus-dot')}
                    ${dotsFor(points, 'trend-line-dot trend-series-tasks-dot')}
                    ${xLabels}
                    <line class="trend-crosshair" id="trendCrosshair" x1="0" y1="${padT}" x2="0" y2="${padT + innerH}"/>
                    <circle class="trend-hover-dot trend-hover-dot-tasks" id="trendHoverDot" r="5"/>
                    <circle class="trend-hover-dot trend-hover-dot-focus" id="trendHoverDot2" r="5"/>
                    <rect class="trend-hover-target" id="trendHoverTarget" x="${padL}" y="0" width="${innerW}" height="${H}"/>
                </svg>
                <div class="trend-tooltip" id="trendTooltip"></div>
                <div class="trend-legend">
                    <div class="trend-legend-item"><span class="trend-legend-dot trend-series-tasks-dot"></span>Tamamlanan Görevler <span class="trend-legend-axis">sol eksen</span></div>
                    <div class="trend-legend-item"><span class="trend-legend-dot trend-series-focus-dot"></span>Odak Süresi (dk) <span class="trend-legend-axis">sağ eksen</span></div>
                </div>
            `;

            const svgEl = trendBarsWrap.querySelector('.trend-line-svg');
            const hoverTarget = document.getElementById('trendHoverTarget');
            const crosshair = document.getElementById('trendCrosshair');
            const hoverDot = document.getElementById('trendHoverDot');
            const hoverDot2 = document.getElementById('trendHoverDot2');
            const tooltip = document.getElementById('trendTooltip');

            const showPoint = (p) => {
                crosshair.setAttribute('x1', p.x); crosshair.setAttribute('x2', p.x);
                crosshair.style.opacity = '1';
                hoverDot.setAttribute('cx', p.x); hoverDot.setAttribute('cy', p.y);
                hoverDot.style.opacity = '1';
                hoverDot2.setAttribute('cx', p.x); hoverDot2.setAttribute('cy', p.y2);
                hoverDot2.style.opacity = '1';
                tooltip.innerHTML = `
                    <div class="trend-tooltip-label">${escapeHtml(p.full)}</div>
                    <div class="trend-tooltip-row trend-tooltip-tasks"><span class="trend-legend-dot trend-series-tasks-dot"></span>${p.value} görev</div>
                    <div class="trend-tooltip-row trend-tooltip-focus"><span class="trend-legend-dot trend-series-focus-dot"></span>${p.value2} dk odak</div>`;
                tooltip.style.opacity = '1';
                const topY = Math.min(p.y, p.y2);
                const pctX = p.x / W, pctY = topY / H;
                tooltip.style.left = `${pctX * trendBarsWrap.clientWidth}px`;
                tooltip.style.top = `${pctY * trendBarsWrap.clientHeight - 8}px`;
            };
            const hidePoint = () => {
                crosshair.style.opacity = '0';
                hoverDot.style.opacity = '0';
                hoverDot2.style.opacity = '0';
                tooltip.style.opacity = '0';
            };
            if (hoverTarget) {
                hoverTarget.addEventListener('mousemove', (e) => {
                    const rect = svgEl.getBoundingClientRect();
                    const relX = ((e.clientX - rect.left) / rect.width) * W;
                    let closest = points[0], closestDist = Infinity;
                    points.forEach(p => { const d = Math.abs(p.x - relX); if (d < closestDist) { closestDist = d; closest = p; } });
                    showPoint(closest);
                });
                hoverTarget.addEventListener('mouseleave', hidePoint);
                hoverTarget.addEventListener('touchstart', (e) => {
                    const touch = e.touches[0]; if (!touch) return;
                    const rect = svgEl.getBoundingClientRect();
                    const relX = ((touch.clientX - rect.left) / rect.width) * W;
                    let closest = points[0], closestDist = Infinity;
                    points.forEach(p => { const d = Math.abs(p.x - relX); if (d < closestDist) { closestDist = d; closest = p; } });
                    showPoint(closest);
                }, { passive: true });
            }
            }; // buildTrendChart

            buildTrendChart();
            if (trendBarsWrap._trendResizeObs) trendBarsWrap._trendResizeObs.disconnect();
            if (typeof ResizeObserver !== 'undefined') {
                let lastDrawnW = trendBarsWrap.clientWidth;
                trendBarsWrap._trendResizeObs = new ResizeObserver(() => {
                    const w = trendBarsWrap.clientWidth;
                    if (Math.abs(w - lastDrawnW) > 24) { lastDrawnW = w; buildTrendChart(); }
                });
                trendBarsWrap._trendResizeObs.observe(trendBarsWrap);
            }
            }
        }
     }
