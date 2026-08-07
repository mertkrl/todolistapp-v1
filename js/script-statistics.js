// script-statistics.js
// script.js'ten çıkarıldı (Faz 6): renderStatistics() — ısı haritası, trend
// grafiği (SVG), üretkenlik skoru, alışkanlık güven aralığı vb. Salt-okunur
// (tasks/habits/mindDumps state'ini sadece OKUYOR, hiçbirini reassign
// etmiyor) — bu yüzden sadece getter köprüleri yeterli, setter gerekmedi.
//
// Köprüler:
//  - getTasksRef()/__getHabitsRef()/__getMindDumpsRef(): script.js'te
//    zaten var olan salt-okunur getter'lar.
//  - window.monthNames/window.monthNamesShort: script.js'te tanımlı, bu modül
//    için yeni eklendi.
//  - formatDateToString: script.js'te zaten window'a atanmıştı, artık import.

import { getTasksRef, getHabitsRef, getMindDumpsRef } from './script.js';
import { formatDateToString } from './script-date-time-utils.js';
import { updateGlobalStreak } from './script-misc-widgets.js';
import { renderFocusHeatmap } from './script-statistics-heatmap.js';
import { renderProgressTrendChart } from './script-statistics-trend-chart.js';
import { _renderProductivityScoreUI } from './script-statistics-productivity-score.js';
import { _renderStreakAndAveragesUI } from './script-statistics-streak-averages.js';


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
         const filteredTasks = getTasksRef().filter(t => t.completed && inRange(t.date || formatDateToString(now)));
         const filteredHighlights = Object.entries(highlightHistory).filter(([ds, h]) => h.completed && inRange(ds));
         let filteredHabitCheckinDays = 0;
        getHabitsRef().forEach(h => {
            filteredHabitCheckinDays += Object.keys(h.history || {}).filter(ds => h.history[ds] && inRange(ds)).length;
        });
        const completedTaskCount = filteredTasks.length + filteredHighlights.length + filteredHabitCheckinDays;
         const totalTasksCount = getTasksRef().filter(t => inRange(t.date || formatDateToString(now))).length + Object.keys(highlightHistory).filter(ds => inRange(ds)).length + filteredHabitCheckinDays;
         const completionRate = totalTasksCount === 0 ? 0 : Math.round((completedTaskCount / totalTasksCount) * 100);
 
         // --- Odaklanma ---
         let focusHistory = FocusStorage.get('focus_history', {});
         let focusMinutes = 0;

         if (filterDays === 0) {
             focusMinutes = FocusStorage.get('focus_minutes', 0) || 0;
         } else {
             for (let i = 0; i < filterDays; i++) {
                 const dCheck = new Date();
                 dCheck.setDate(dCheck.getDate() - i);
                 const dsCheck = formatDateToString(dCheck);
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
         getHabitsRef().forEach(h => {
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
         if (habitConfidenceEl) habitConfidenceEl.style.display = (getHabitsRef().length > 0 && completedHabitDaysCount < 3) ? 'inline-flex' : 'none';

         // EKLEME: 1. Ana Hedef Serisi Hesaplama Algoritması
         let highlightStreak = 0;
         let streakCheckDate = new Date();
         let todayStr = formatDateToString(streakCheckDate);
         
         // Eğer bugün henüz ana hedef tamamlanmadıysa ama dün tamamlandıysa seriyi dünden itibaren geriye doğru saymaya başla
         if (!(highlightHistory[todayStr] && highlightHistory[todayStr].completed)) {
             streakCheckDate.setDate(streakCheckDate.getDate() - 1);
         }
         
         while (true) {
             let dStr = formatDateToString(streakCheckDate);
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
                 conversionLog.push({ id: 'legacy_' + i, date: formatDateToString(now) });
             }
             FocusStorage.set('mind_dump_conversions', conversionLog);
         }
 
         // Seçilen zaman filtresine (Son 7 Gün vb.) göre verileri süz
         const filteredConversions = conversionLog.filter(log => inRange(log.date));
         const convertedCount = filteredConversions.length;
         const activeDumpCount = getMindDumpsRef() ? getMindDumpsRef().length : 0;
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
             const tasksInRange = getTasksRef().filter(t => t.completed && within(t.date || formatDateToString(now)));
             const highlightsInRange = Object.entries(highlightHistory).filter(([ds, h]) => h.completed && within(ds));
             const completed = tasksInRange.length + highlightsInRange.length;
             const totalInRange = getTasksRef().filter(t => within(t.date || formatDateToString(now))).length
                 + Object.keys(highlightHistory).filter(ds => within(ds)).length;
             const rate = totalInRange === 0 ? 0 : Math.round((completed / totalInRange) * 100);
             let focus = 0;
             Object.entries(focusHistory).forEach(([ds, mins]) => { if (within(ds)) focus += mins; });
             let totalTargetDays = 0, completedDays = 0;
             getHabitsRef().forEach(h => {
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
        _renderProductivityScoreUI(completionRate, habitRate, focusMinutes, completedTaskCount, focusDisplay);

        renderFocusHeatmap(highlightHistory);

        renderProgressTrendChart(filterDays, highlightHistory);

        // --- Streak + Günlük/Haftalık Ort. ---
        _renderStreakAndAveragesUI(now, highlightHistory, focusMinutes, maxH, setTrend);

        updateGlobalStreak();
     }

window.renderStatistics = renderStatistics;
