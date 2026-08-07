// script-statistics-streak-averages.js
// script-statistics.js'ten çıkarıldı: seri (streak) noktaları + günlük/
// haftalık ortalama odak çubukları — sadece kendi parametrelerine (setTrend
// dahil, bağımlı callback olarak enjekte ediliyor) bağımlı.
import { getTasksRef } from './script.js';
import { formatDateToString } from './script-date-time-utils.js';

     // Seri (streak) noktaları + günlük/haftalık ortalama odak çubukları.
     // Faz S devamı, dev fonksiyon refactoru: renderStatistics'ten çıkarıldı.
     export function _renderStreakAndAveragesUI(now, highlightHistory, focusMinutes, maxH, setTrend) {
         const taskDaySet = new Set();
         getTasksRef().filter(t=>t.completed).forEach(t => { if(t.date) taskDaySet.add(t.date); });
         Object.entries(highlightHistory).filter(([,h])=>h.completed).forEach(([ds])=>taskDaySet.add(ds));
         let streak = 0, streakBest = 0, tempStreak = 0;
         const msDay = 86400000;
         for (let i=0; i<365; i++) {
             const d=new Date(now.getTime()-i*msDay); const ds=formatDateToString(d);
             if (taskDaySet.has(ds)) { if(i===streak) streak++; tempStreak++; streakBest=Math.max(streakBest,tempStreak); } else { tempStreak=0; }
         }
         const dotsEl = document.getElementById('streak-dots');
         if (dotsEl) {
             let dotsHTML = '';
             for (let i=6; i>=0; i--) {
                 const d=new Date(now.getTime()-i*msDay); const ds=formatDateToString(d);
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
         const thisWeekTasks = getTasksRef().filter(t=>{ if(!t.completed||!t.date) return false; const [d,m,y]=t.date.split('-').map(Number); const dd=new Date(y,m-1,d); return dd>=weekStart; }).length;
         const prevWeekTasks = getTasksRef().filter(t=>{ if(!t.completed||!t.date) return false; const [d,m,y]=t.date.split('-').map(Number); const dd=new Date(y,m-1,d); return dd>=prevStart&&dd<weekStart; }).length;
         document.getElementById('weekly-avg-tasks').textContent = thisWeekTasks;
         document.getElementById('prev-week-tasks').textContent = prevWeekTasks;
         const weekBar = document.getElementById('weekly-avg-bar');
         if (weekBar) { const maxW = Math.max(thisWeekTasks,prevWeekTasks,1); setTimeout(()=>{ weekBar.style.width = Math.min((thisWeekTasks/maxW)*100,100)+'%'; },300); }
         setTrend('trend-peak', maxH > 0 ? 0 : 0, '');
     }
