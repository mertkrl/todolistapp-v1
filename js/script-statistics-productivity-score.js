// script-statistics-productivity-score.js
// script-statistics.js'ten çıkarıldı: üretkenlik skoru halkası + katkı
// dökümü ('Neden?' popover'ı) + rozetler — sadece kendi parametrelerine ve
// window.FocusAISocial köprüsüne bağımlı.

     // Üretkenlik skoru halkası + katkı dökümü ("Neden?" popover'ı) + rozetler.
     // Faz S devamı, dev fonksiyon refactoru: renderStatistics'ten çıkarıldı.
     export function _renderProductivityScoreUI(completionRate, habitRate, focusMinutes, completedTaskCount, focusDisplay) {
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
                 const isHidden = scoreBreakdownEl.classList.contains('is-hidden');
                 scoreBreakdownEl.classList.toggle('is-hidden', !isHidden);
                 scoreWhyBtn.classList.toggle('active', isHidden);
             });
             // Popover dışına tıklanınca kapat — kart genişlemediği için kullanıcı başka bir yere basıp kapatabilmeli
             document.addEventListener('click', (e) => {
                 if (scoreBreakdownEl.classList.contains('is-hidden')) return;
                 if (!scoreBreakdownEl.contains(e.target) && e.target !== scoreWhyBtn && !scoreWhyBtn.contains(e.target)) {
                     scoreBreakdownEl.classList.add('is-hidden');
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
     }
