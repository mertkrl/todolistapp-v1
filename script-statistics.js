// script-statistics.js
// script.js'ten çıkarıldı (Faz 6): renderStatistics() — ısı haritası, trend
// grafiği (SVG), üretkenlik skoru, alışkanlık güven aralığı vb. Salt-okunur
// (tasks/habits/mindDumps state'ini sadece OKUYOR, hiçbirini reassign
// etmiyor) — bu yüzden sadece getter köprüleri yeterli, setter gerekmedi.
//
// Köprüler:
//  - window.__getTasksRef()/__getHabitsRef()/__getMindDumpsRef(): script.js'te
//    zaten var olan salt-okunur getter'lar.
//  - window.monthNames/window.monthNamesShort: script.js'te tanımlı, bu modül
//    için yeni eklendi.
//  - window.formatDateToString: script.js'te zaten window'a atanmıştı.

     function renderStatistics() {
         const now = new Date();
         const filterDays = window.__getStatsActiveFilter();
         let filterStart = null;
         if (filterDays > 0) {
             filterStart = new Date(now);
             filterStart.setDate(filterStart.getDate() - filterDays);
             filterStart.setHours(0,0,0,0);
         }
 
         function inRange(dateStr) {
             if (!filterStart) return true;
             const [d, m, y] = dateStr.split('-').map(Number); // GÜNCELLEME: d, m, y sırasına alındı
             return new Date(y, m-1, d) >= filterStart;
         }
 
         // --- Temel veriler ---
         const highlightHistory = FocusStorage.get('highlight_history', {});
         const filteredTasks = window.__getTasksRef().filter(t => t.completed && inRange(t.date || window.formatDateToString(now)));
         const filteredHighlights = Object.entries(highlightHistory).filter(([ds, h]) => h.completed && inRange(ds));
         const completedTaskCount = filteredTasks.length + filteredHighlights.length;
         const totalTasksCount = window.__getTasksRef().filter(t => inRange(t.date || window.formatDateToString(now))).length + Object.keys(highlightHistory).filter(ds => inRange(ds)).length;
         const completionRate = totalTasksCount === 0 ? 0 : Math.round((completedTaskCount / totalTasksCount) * 100);
 
         // --- Odaklanma ---
         let focusHistory = FocusStorage.get('focus_history', {});
         let focusMinutes = 0;

         if (filterDays === 0) {
             totalFocusMinutes = FocusStorage.get('focus_minutes', 0) || 0;
             focusMinutes = totalFocusMinutes;
         } else {
             for (let i = 0; i < filterDays; i++) {
                 const dCheck = new Date();
                 dCheck.setDate(dCheck.getDate() - i);
                 const dsCheck = window.formatDateToString(dCheck);
                 if (focusHistory[dsCheck]) focusMinutes += focusHistory[dsCheck];
             }
         }

         // Supabase bağlıysa daily_stats'tan daha güncel veri çek (async, sonuçta günceller)
         // NOT: daily_stats henüz senkronize olmamış/boşsa 0 dönebilir — bu durumda doğru
         // hesaplanmış yerel değeri asla daha küçük/sıfır bir değerle ezmiyoruz (flash-then-revert-to-0 bug'ı).
         if (window.FocusSync && window.FocusSync.isEnabled() && window.FocusSync.fetchFocusMinutesForPeriod) {
             window.FocusSync.fetchFocusMinutesForPeriod(filterDays).then(supabaseMinutes => {
                 if (supabaseMinutes !== null && supabaseMinutes >= focusMinutes) {
                     const el = document.getElementById('stat-total-focus');
                     if (el) {
                         const m = supabaseMinutes;
                         el.textContent = m >= 60
                             ? `${Math.floor(m/60)} sa ${m%60 > 0 ? m%60+' dk' : ''}`
                             : `${m} dk`;
                     }
                 }
             });
         }

         let focusDisplay = focusMinutes >= 60
             ? `${Math.floor(focusMinutes/60)} sa ${focusMinutes%60 > 0 ? focusMinutes%60+' dk' : ''}`
             : `${focusMinutes} dk`;
         document.getElementById('stat-total-focus').textContent = focusDisplay;
 
         // --- Alışkanlık ---
         let totalHabitTargetDays = 0, completedHabitDaysCount = 0;
         window.__getHabitsRef().forEach(h => {
             totalHabitTargetDays += (h.targetDays || 21);
             completedHabitDaysCount += Object.keys(h.history).filter(ds => inRange(ds)).length;
         });
         const habitRate = totalHabitTargetDays === 0 ? 0 : Math.round((completedHabitDaysCount / totalHabitTargetDays) * 100);
 
         // --- Peak Hour ---
         const hourCounts = {};
         filteredTasks.forEach(t => {
             const hour = (t.timeEnd || t.timeStart || '12:00').split(':')[0] + ':00';
             hourCounts[hour] = (hourCounts[hour] || 0) + 1;
         });
         let peakHour = '-', maxH = 0;
         for (let h in hourCounts) { if (hourCounts[h] > maxH) { maxH = hourCounts[h]; peakHour = h; } }
 
         // --- Ana Hedef 30 gün ---
         const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate()-30); thirtyAgo.setHours(0,0,0,0);
         let completedHighlights30 = Object.entries(highlightHistory).filter(([ds,h]) => {
             if (!h.completed) return false;
             const [d, m, y] = ds.split('-').map(Number); // GÜNCELLEME: d, m, y sırasına alındı
             return new Date(y,m-1,d) >= thirtyAgo;
         }).length;
 
         // --- DOM Güncelle ---
         document.getElementById('stat-total-tasks').textContent = completedTaskCount;
         document.getElementById('stat-habit-rate').textContent = `%${habitRate}`;
         document.getElementById('stat-completion-rate').textContent = `%${completionRate}`;
         document.getElementById('stat-peak-hour').textContent = maxH > 0 ? peakHour : '-';
         document.getElementById('stat-highlight-success').textContent = completedHighlights30;

         // --- Düşük örneklem güven uyarıları (az veriyle yanıltıcı kesinlik göstermemek için) ---
         const CONFIDENCE_MIN_SAMPLE = 5;
         const completionConfidenceEl = document.getElementById('confidence-completion');
         if (completionConfidenceEl) completionConfidenceEl.style.display = totalTasksCount < CONFIDENCE_MIN_SAMPLE ? 'inline-flex' : 'none';
         const peakConfidenceEl = document.getElementById('confidence-peak');
         if (peakConfidenceEl) peakConfidenceEl.style.display = filteredTasks.length < CONFIDENCE_MIN_SAMPLE ? 'inline-flex' : 'none';
         const habitConfidenceEl = document.getElementById('confidence-habit');
         if (habitConfidenceEl) habitConfidenceEl.style.display = (window.__getHabitsRef().length > 0 && completedHabitDaysCount < 3) ? 'inline-flex' : 'none';

         // EKLEME: 1. Ana Hedef Serisi Hesaplama Algoritması
         let highlightStreak = 0;
         let streakCheckDate = new Date();
         let todayStr = window.formatDateToString(streakCheckDate);
         
         // Eğer bugün henüz ana hedef tamamlanmadıysa ama dün tamamlandıysa seriyi dünden itibaren geriye doğru saymaya başla
         if (!(highlightHistory[todayStr] && highlightHistory[todayStr].completed)) {
             streakCheckDate.setDate(streakCheckDate.getDate() - 1);
         }
         
         while (true) {
             let dStr = window.formatDateToString(streakCheckDate);
             if (highlightHistory[dStr] && highlightHistory[dStr].completed) {
                 highlightStreak++;
                 streakCheckDate.setDate(streakCheckDate.getDate() - 1); // Bir gün geriye git
             } else {
                 break; // Seri bozulduğu anda döngüden çık
             }
         }
         const highlightStreakEl = document.getElementById('stat-highlight-streak');
         if (highlightStreakEl) highlightStreakEl.textContent = `${highlightStreak} Gün`;
 
         // EKLEME: 2. Fikir Dönüşüm Oranı Hesaplama Algoritması (Dinamik ve Filtre Uyumlu)
         let conversionLog = FocusStorage.get('mind_dump_conversions', []);
         const legacyCount = parseInt(localStorage.getItem('convertedMindDumpsCount') || '0');
         
         // Geçmiş verileri kaybetmemek için eski sayacı yeni sisteme göçür (Migration)
         if (legacyCount > 0 && conversionLog.length === 0) {
             for (let i = 0; i < legacyCount; i++) {
                 conversionLog.push({ id: 'legacy_' + i, date: window.formatDateToString(now) });
             }
             FocusStorage.set('mind_dump_conversions', conversionLog);
         }
 
         // Seçilen zaman filtresine (Son 7 Gün vb.) göre verileri süz
         const filteredConversions = conversionLog.filter(log => inRange(log.date));
         const convertedCount = filteredConversions.length;
         const activeDumpCount = window.__getMindDumpsRef() ? window.__getMindDumpsRef().length : 0;
         const totalFikir = convertedCount + activeDumpCount;
         const conversionRate = totalFikir > 0 ? Math.round((convertedCount / totalFikir) * 100) : 0;
         
         const conversionEl = document.getElementById('stat-minddump-conversion');
         if (conversionEl) conversionEl.textContent = `%${conversionRate}`;
 
         // --- Trend okları (önceki dönemle gerçek karşılaştırma) ---
         function setTrend(id, value, suffix) {
             const el = document.getElementById(id);
             if (!el) return;
             if (value === null) { el.textContent = 'Karşılaştırma yok'; el.className = 'stat-trend neutral'; return; }
             if (value > 0) { el.textContent = `▲ +${value}${suffix}`; el.className = 'stat-trend up'; }
             else if (value < 0) { el.textContent = `▼ ${value}${suffix}`; el.className = 'stat-trend down'; }
             else { el.textContent = '— Değişim yok'; el.className = 'stat-trend neutral'; }
         }

         // Seçili döneme eşit uzunlukta, hemen öncesindeki dönemin istatistiklerini hesaplar
         function statsForRange(startDate, endDate) {
             function within(dateStr) {
                 const [d, m, y] = dateStr.split('-').map(Number);
                 const dt = new Date(y, m - 1, d);
                 return dt >= startDate && dt < endDate;
             }
             const tasksInRange = window.__getTasksRef().filter(t => t.completed && within(t.date || window.formatDateToString(now)));
             const highlightsInRange = Object.entries(highlightHistory).filter(([ds, h]) => h.completed && within(ds));
             const completed = tasksInRange.length + highlightsInRange.length;
             const totalInRange = window.__getTasksRef().filter(t => within(t.date || window.formatDateToString(now))).length
                 + Object.keys(highlightHistory).filter(ds => within(ds)).length;
             const rate = totalInRange === 0 ? 0 : Math.round((completed / totalInRange) * 100);
             let focus = 0;
             Object.entries(focusHistory).forEach(([ds, mins]) => { if (within(ds)) focus += mins; });
             let totalTargetDays = 0, completedDays = 0;
             window.__getHabitsRef().forEach(h => {
                 totalTargetDays += (h.targetDays || 21);
                 completedDays += Object.keys(h.history).filter(ds => within(ds)).length;
             });
             const habitR = totalTargetDays === 0 ? 0 : Math.round((completedDays / totalTargetDays) * 100);
             return { completed, rate, focus, habitR };
         }

         // "Tüm Zamanlar" filtresinde eşit uzunlukta bir önceki dönem tanımlanamaz, bu yüzden karşılaştırma gösterilmez
         if (filterDays > 0) {
             const prevEnd = new Date(filterStart);
             const prevStart = new Date(filterStart);
             prevStart.setDate(prevStart.getDate() - filterDays);
             const prev = statsForRange(prevStart, prevEnd);
             setTrend('trend-tasks', completedTaskCount - prev.completed, ' görev');
             setTrend('trend-focus', focusMinutes - prev.focus, ' dk');
             setTrend('trend-habits', habitRate - prev.habitR, '%');
             setTrend('trend-completion', completionRate - prev.rate, '%');
         } else {
             setTrend('trend-tasks', null, '');
             setTrend('trend-focus', null, '');
             setTrend('trend-habits', null, '');
             setTrend('trend-completion', null, '');
         }
 
         // --- Üretkenlik Skoru ---
         const scoreRaw = Math.round((completionRate * 0.4) + (Math.min(habitRate, 100) * 0.35) + (Math.min(focusMinutes / 3, 100) * 0.25));
         if (window.FocusAISocial && typeof window.FocusAISocial.checkPersonalRecord === 'function') {
            window.FocusAISocial.checkPersonalRecord('focusMinutes', focusMinutes, `${focusDisplay} odak süresi`);
            window.FocusAISocial.checkPersonalRecord('completedTasks', completedTaskCount, `${completedTaskCount} tamamlanan görev`);
            window.FocusAISocial.checkPersonalRecord('score', scoreRaw, `${scoreRaw} puan odak skoru`);
        }
         const score = Math.min(scoreRaw, 100);
         document.getElementById('productivity-score').textContent = score;

         // --- Skor "Neden?" dökümü ---
         const completionContribution = Math.round(completionRate * 0.4);
         const habitContribution = Math.round(Math.min(habitRate, 100) * 0.35);
         const focusContribution = Math.round(Math.min(focusMinutes / 3, 100) * 0.25);
         const bdCompletionBar = document.getElementById('score-bd-completion');
         const bdHabitBar = document.getElementById('score-bd-habit');
         const bdFocusBar = document.getElementById('score-bd-focus');
         if (bdCompletionBar) bdCompletionBar.style.width = `${Math.min(completionContribution / 0.4, 100)}%`;
         if (bdHabitBar) bdHabitBar.style.width = `${Math.min(habitContribution / 0.35, 100)}%`;
         if (bdFocusBar) bdFocusBar.style.width = `${Math.min(focusContribution / 0.25, 100)}%`;
         const bdCompletionVal = document.getElementById('score-bd-completion-val');
         const bdHabitVal = document.getElementById('score-bd-habit-val');
         const bdFocusVal = document.getElementById('score-bd-focus-val');
         if (bdCompletionVal) bdCompletionVal.textContent = `+${completionContribution}`;
         if (bdHabitVal) bdHabitVal.textContent = `+${habitContribution}`;
         if (bdFocusVal) bdFocusVal.textContent = `+${focusContribution}`;
         const scoreWhyBtn = document.getElementById('score-why-btn');
         const scoreBreakdownEl = document.getElementById('score-breakdown');
         if (scoreWhyBtn && scoreBreakdownEl && !scoreWhyBtn.dataset.bound) {
             scoreWhyBtn.dataset.bound = '1';
             scoreWhyBtn.addEventListener('click', (e) => {
                 e.stopPropagation();
                 const isHidden = scoreBreakdownEl.style.display === 'none';
                 scoreBreakdownEl.style.display = isHidden ? 'flex' : 'none';
                 scoreWhyBtn.classList.toggle('active', isHidden);
             });
             // Popover dışına tıklanınca kapat — kart genişlemediği için kullanıcı başka bir yere basıp kapatabilmeli
             document.addEventListener('click', (e) => {
                 if (scoreBreakdownEl.style.display === 'none') return;
                 if (!scoreBreakdownEl.contains(e.target) && e.target !== scoreWhyBtn && !scoreWhyBtn.contains(e.target)) {
                     scoreBreakdownEl.style.display = 'none';
                     scoreWhyBtn.classList.remove('active');
                 }
             });
         }

         const ring = document.getElementById('score-ring-fill');
         if (ring) {
             const circumference = 314;
             const offset = circumference - (score / 100) * circumference;
             setTimeout(() => { ring.style.strokeDashoffset = offset; }, 100);
             const grad = ring.closest('svg').querySelector('#scoreGradient') || (() => {
                 const defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
                 const lg = document.createElementNS('http://www.w3.org/2000/svg','linearGradient');
                 lg.id = 'scoreGradient'; lg.setAttribute('x1','0%'); lg.setAttribute('y1','0%'); lg.setAttribute('x2','100%'); lg.setAttribute('y2','0%');
                 const s1 = document.createElementNS('http://www.w3.org/2000/svg','stop');
                 s1.setAttribute('offset','0%'); s1.setAttribute('stop-color','#6c5ce7');
                 const s2 = document.createElementNS('http://www.w3.org/2000/svg','stop');
                 s2.setAttribute('offset','100%'); s2.setAttribute('stop-color','#a29bfe');
                 lg.appendChild(s1); lg.appendChild(s2); defs.appendChild(lg);
                 ring.closest('svg').insertBefore(defs, ring.closest('svg').firstChild);
                 return lg;
             })();
             ring.setAttribute('stroke', 'url(#scoreGradient)');
         }
         const scoreMsg = score >= 85 ? '🔥 Olağanüstü performans!' : score >= 65 ? '✨ Harika gidiyorsun' : score >= 40 ? '📈 İyi, daha ilerleyebilirsin' : '💪 Devam et, ivme kazanıyorsun';
         const scoreEl = document.getElementById('score-message');
         if (scoreEl) scoreEl.textContent = scoreMsg;
         const badgesEl = document.getElementById('score-badges');
         if (badgesEl) {
             const badges = [];
             if (completedTaskCount >= 10) badges.push(['🏆 Görev Ustası','si-purple']);
             if (habitRate >= 70) badges.push(['🔥 Alışkanlık Çekirdeği','si-orange']);
             if (focusMinutes >= 120) badges.push(['🎯 Derin Odak','si-blue']);
             if (completionRate >= 80) badges.push(['⚡ Verimlilik Uzmanı','si-green']);
             badgesEl.innerHTML = badges.map(([t,c]) => `<span class="score-badge ${c}">${t}</span>`).join('');
         }
 
         // --- Isı Haritası (Gelişmiş Ay ve Gün Hizalama Motoru) ---
         const heatmapEl = document.getElementById('focus-heatmap');
         const monthsEl = document.getElementById('heatmap-months');
         if (heatmapEl) {
             const tasksByDay = {};
             window.__getTasksRef().filter(t => t.completed).forEach(t => {
                 if (t.date) tasksByDay[t.date] = (tasksByDay[t.date] || 0) + 1;
             });
             Object.entries(highlightHistory).filter(([,h]) => h.completed).forEach(([ds]) => {
                 tasksByDay[ds] = (tasksByDay[ds] || 0) + 1;
             });
             
             const totalDays = 140; // 20 hafta * 7 gün — kutu boyutu aynı kalsın, sağdaki boşluk daha fazla haftayla dolsun
             const cells = [];
             const monthLabels = [];
             let lastMonth = -1;
 
             // Yedek ay isimleri listesi (Hata önleyici altyapı)
             const fallbackMonthsShort = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
             const activeMonthNamesShort = typeof window.monthNamesShort !== 'undefined' ? window.monthNamesShort : fallbackMonthsShort;
 
            // 1. ADIM: 10 sütunu dikey tarayıp ayların başlangıç koordinatlarını üst satıra hizalama
            const numCols = totalDays / 7; // 70 / 7 = 10
            for (let col = 0; col < numCols; col++) {
             // Her sütunun en üstündeki günün i indeksini buluyoruz
             const i = (totalDays - 1) - (col * 7);
             const dCol = new Date();
             dCol.setDate(dCol.getDate() - i);
             const currentMonth = dCol.getMonth();

             if (col === 0 || currentMonth !== lastMonth) {
                 const mName = activeMonthNamesShort[currentMonth];
                 const percentLeft = (col / numCols) * 100;
                 monthLabels.push(`<span class="heatmap-month-label" style="left: ${percentLeft}%;">${mName}</span>`);
                 lastMonth = currentMonth;
             }
         }
             if (monthsEl) monthsEl.innerHTML = monthLabels.join('');
 
             // 2. ADIM: Isı haritası kutucuklarını (hücreleri) oluşturma
             for (let i = totalDays - 1; i >= 0; i--) {
                 const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
                 const ds = window.formatDateToString(d);
                 const count = tasksByDay[ds] || 0;
                 
                 // Sıfır görev varsa seviye 0, diğer durumlarda yoğunluğa göre seviye ataması
                 const level = count === 0 ? 0 : count === 1 ? 1 : count <= 2 ? 2 : count <= 4 ? 3 : count <= 6 ? 4 : 5;
                 const label = `${d.getDate()} ${activeMonthNamesShort[d.getMonth()]}: ${count} görev`;
                 cells.push(`<div class="hm-day" data-level="${level}" title="${label}" data-date="${ds}"></div>`);
             }
             heatmapEl.innerHTML = cells.join('');
 
             // 3. ADIM: Isı Haritası Hücrelerine Tıklama Dinleyicisi
             heatmapEl.querySelectorAll('.hm-day').forEach(cell => {
                 cell.addEventListener('click', () => {
                     const clickedDate = cell.getAttribute('data-date');
                     
                     heatmapEl.querySelectorAll('.hm-day').forEach(c => c.classList.remove('active-heatmap-day'));
                     cell.classList.add('active-heatmap-day');
                     
                     const dayTasks = window.__getTasksRef().filter(t => t.date === clickedDate && t.completed);
                     
                     let dayHighlightText = "";
                     if (highlightHistory[clickedDate] && highlightHistory[clickedDate].completed) {
                         dayHighlightText = highlightHistory[clickedDate].text;
                     }
                     
                     const detailsPanel = document.getElementById('heatmap-day-details');
                     const detailsDate = document.getElementById('heatmap-details-date');
                     const detailsContent = document.getElementById('heatmap-details-content');
                     
                     if (detailsPanel && detailsDate && detailsContent) {
                         const [d, m, y] = clickedDate.split('-'); // GÜNCELLEME: d, m, y sırasına alındı
                         const fallbackMonthsFull = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
                         const activeFullMonths = typeof window.monthNames !== 'undefined' ? window.monthNames : fallbackMonthsFull;
                         
                         detailsDate.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> ${parseInt(d)} ${activeFullMonths[parseInt(m)-1]} ${y} Tarihinin Özeti`;
                         
                         let htmlContent = "";
                         
                         if (dayHighlightText) {
                             htmlContent += `
                                 <div class="heatmap-mini-task" style="border-left: 3px solid #ff9f43; background: rgba(255,159,67,0.03);">
                                     <i class="fa-solid fa-star" style="color: #ff9f43;"></i>
                                     <span style="font-weight: 600; color: #fff;">[Ana Hedef] ${dayHighlightText}</span>
                                 </div>`;
                         }
                         
                         if (dayTasks.length > 0) {
                             dayTasks.forEach(t => {
                                 htmlContent += `
                                     <div class="heatmap-mini-task">
                                         <i class="fa-solid fa-circle-check"></i>
                                         <span>${escapeHtml(t.text)}</span>
                                         <span class="heatmap-mini-task-time"><i class="fa-regular fa-clock"></i> ${t.timeStart || '09:00'} - ${t.timeEnd || '10:00'}</span>
                                     </div>`;
                             });
                         }
                         
                         if (!dayHighlightText && dayTasks.length === 0) {
                             htmlContent = `<div style="text-align: center; padding: 15px; color: var(--text-muted); font-style: italic;"><i class="fa-solid fa-mug-hot" style="margin-right: 6px;"></i> Bu tarihte tamamlanmış bir aktivite bulunmuyor.</div>`;
                         }
                         
                         detailsContent.innerHTML = htmlContent;
                         detailsPanel.style.display = 'block';
                     }
                 });
             });
         }
 
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
            window.__getTasksRef().forEach(t => { if (t.completed && t.date) completedByDate[t.date] = (completedByDate[t.date] || 0) + 1; });
            Object.entries(highlightHistory).forEach(([ds, h]) => { if (h.completed) completedByDate[ds] = (completedByDate[ds] || 0) + 1; });
            const trendFocusHistory = FocusStorage.get('focus_history', {});

            let barData = [];

            if (filterDays === 7 || filterDays === 30) {
                if (trendTitleEl) trendTitleEl.textContent = `Son ${filterDays} Günlük İlerleme`;
                for (let i = filterDays - 1; i >= 0; i--) {
                    const d = new Date(); d.setDate(d.getDate() - i);
                    const ds = window.formatDateToString(d);
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

        // --- Streak ---
        todayStr = window.formatDateToString(now);
        const taskDaySet = new Set();
         window.__getTasksRef().filter(t=>t.completed).forEach(t => { if(t.date) taskDaySet.add(t.date); });
         Object.entries(highlightHistory).filter(([,h])=>h.completed).forEach(([ds])=>taskDaySet.add(ds));
         let streak = 0, streakBest = 0, tempStreak = 0;
         const msDay = 86400000;
         for (let i=0; i<365; i++) {
             const d=new Date(now.getTime()-i*msDay); const ds=window.formatDateToString(d);
             if (taskDaySet.has(ds)) { if(i===streak) streak++; tempStreak++; streakBest=Math.max(streakBest,tempStreak); } else { tempStreak=0; }
         }
         const dotsEl = document.getElementById('streak-dots');
         if (dotsEl) {
             let dotsHTML = '';
             for (let i=6; i>=0; i--) {
                 const d=new Date(now.getTime()-i*msDay); const ds=window.formatDateToString(d);
                 dotsHTML += `<div class="streak-dot${taskDaySet.has(ds)?' active':''}" title="${ds}"></div>`;
             }
             dotsEl.innerHTML = dotsHTML;
         }
 
         // --- Günlük Ort. Odaklanma ---
         const activeDays = Math.max(taskDaySet.size, 1);
         const avgFocus = Math.round(focusMinutes / activeDays);
         document.getElementById('avg-daily-focus').textContent = avgFocus;
         const avgBar = document.getElementById('avg-focus-bar');
         if (avgBar) setTimeout(()=>{ avgBar.style.width = Math.min((avgFocus/60)*100,100)+'%'; },200);
 
         // --- Haftalık Ort. ---
         const weekStart = new Date(now); weekStart.setDate(now.getDate()-now.getDay()); weekStart.setHours(0,0,0,0);
         const prevStart = new Date(weekStart); prevStart.setDate(prevStart.getDate()-7);
         const thisWeekTasks = window.__getTasksRef().filter(t=>{ if(!t.completed||!t.date) return false; const [d,m,y]=t.date.split('-').map(Number); const dd=new Date(y,m-1,d); return dd>=weekStart; }).length;
         const prevWeekTasks = window.__getTasksRef().filter(t=>{ if(!t.completed||!t.date) return false; const [d,m,y]=t.date.split('-').map(Number); const dd=new Date(y,m-1,d); return dd>=prevStart&&dd<weekStart; }).length;
         document.getElementById('weekly-avg-tasks').textContent = thisWeekTasks;
         document.getElementById('prev-week-tasks').textContent = prevWeekTasks;
         const weekBar = document.getElementById('weekly-avg-bar');
         if (weekBar) { const maxW = Math.max(thisWeekTasks,prevWeekTasks,1); setTimeout(()=>{ weekBar.style.width = Math.min((thisWeekTasks/maxW)*100,100)+'%'; },300); }
         setTrend('trend-peak', maxH > 0 ? 0 : 0, '');
 
         window.updateGlobalStreak();
     }

window.renderStatistics = renderStatistics;
