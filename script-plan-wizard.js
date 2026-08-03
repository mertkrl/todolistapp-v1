// script-plan-wizard.js
// script.js'ten çıkarıldı (Faz 6): Haftalık Plan Sihirbazı — açma/kapama,
// gün sekmeleri, görev ekleme (çakışma/kapasite/burnout kontrolü), öncelik
// seçimi, "Bitir" akışı (staged görevleri gerçek tasks/calendarEvents'e yazar).
//
// ÖNEMLİ: Bu blok `tasks` dizisini TAM REASSIGN ediyor (`tasks = tasks.filter(...)`,
// "Bitir" ve "İptal" akışlarında). `setTasksRef` bu çıkarma için eklendi.
// `tasks` çekirdek/yüksek-riskli kabul edildiği için bu köprü DİKKATLE
// kullanılmalı — yeni bir extraction `tasks` reassignment yaparsa aynı
// setter'ı kullansın, YENİ bir setter icat ETMESİN.
//
// Faz H: script.js/script-calendar-month-view.js'ten tüketilen köprüler gerçek
// import'a çevrildi. Bu dosya script.js'in TEK YÖNLÜ tüketicisi olduğu
// doğrulandı (script.js bu dosyadaki hiçbir window.X'i çağırmıyor — sadece
// removeStagedTask/handlePrioritySelection bu dosya İÇİNDE, event delegasyonu
// üzerinden kendi kendine çağrılıyordu, artık düz fonksiyon). index.html'de
// bu dosya script.js VE script-calendar-month-view.js'ten SONRA yüklendiği
// için static import güvenli.
//  - showPremiumModal/generateId: script.js'te de bare çalışıyordu (genuinely
//    global, başka dosyada tanımlı window.X), değişiklik gerekmedi.
import {
    getTasksRef, setTasksRef, getCalendarEventsRef, getGoalsRef, saveTasks,
    renderTasks, getRenderStatisticsRef, getRenderSocialStatsRef,
    getRenderBuddyHabitsRef, getCurrentWeekStr, getTotalFocusMinutes,
    getDayNames, getMonthNamesShort
} from './script.js';
import { renderCalendar, renderEvents } from './script-calendar-month-view.js';
import { formatDateToString, timeToMins, addOneHour } from './script-date-time-utils.js';

     const weeklyBanner = document.getElementById('weekly-plan-banner');
     const startWeeklyPlanBtn = document.getElementById('start-weekly-plan-btn');
     const navWeeklyPlanBtn = document.getElementById('nav-weekly-plan'); 
     
     const wizardModal = document.getElementById('weekly-wizard-modal');
     const closeWizardBtn = document.getElementById('close-wizard-btn');
     const wizardPrevBtn = document.getElementById('wizard-prev-btn');
     const wizardNextBtn = document.getElementById('wizard-next-btn');
     const wizardFinishBtn = document.getElementById('wizard-finish-btn');
     
     const actionModal = document.getElementById('weekly-plan-action-modal');
     const actionCancelBtn = document.getElementById('action-cancel-plan-btn');
     const actionEditBtn = document.getElementById('action-edit-plan-btn');
     const actionCloseBtn = document.getElementById('action-close-btn');
 
     let currentWizardStep = 1;
     let currentWizTabIndex = 0; 
     let wizardDates = []; 
 
     function checkBannerVisibility() {
         const isPlanned = FocusStorage.getRaw('weekly_planned') === getCurrentWeekStr();
         if (!isPlanned) {
             weeklyBanner.style.display = 'flex';
         } else {
             weeklyBanner.style.display = 'none';
         }
     }
     checkBannerVisibility();
 
     function openPlanWizardOrAction() {
         const isPlanned = FocusStorage.getRaw('weekly_planned') === getCurrentWeekStr();
         if (isPlanned) {
             actionModal.classList.remove('hidden');
         } else {
             document.getElementById('w-stat-tasks').textContent = getTasksRef().filter(t => t.completed).length;
             const totalFocusMinutes = getTotalFocusMinutes();
             let focusDisplay = totalFocusMinutes + " dk";
             if(totalFocusMinutes >= 60) focusDisplay = `${Math.floor(totalFocusMinutes / 60)} sa ${totalFocusMinutes % 60} dk`;
             document.getElementById('w-stat-focus').textContent = focusDisplay;
             
             currentWizardStep = 1; stagedTasks = []; selectedPriorities = [];
             document.getElementById('wiz-new-task-name').value = '';
             
             updateWizardUI(); wizardModal.classList.remove('hidden');
         }
     }
 
     startWeeklyPlanBtn.onclick = openPlanWizardOrAction;
     if(navWeeklyPlanBtn) navWeeklyPlanBtn.onclick = openPlanWizardOrAction;
 
     actionCloseBtn.onclick = () => { actionModal.classList.add('hidden'); };
 
     actionCancelBtn.onclick = () => {
         setTasksRef(getTasksRef().filter(t => t.weekStr !== getCurrentWeekStr()));
         for(let date in getCalendarEventsRef()) {
             getCalendarEventsRef()[date] = getCalendarEventsRef()[date].filter(e => e.weekStr !== getCurrentWeekStr());
             if(getCalendarEventsRef()[date].length === 0) delete getCalendarEventsRef()[date];
         }
         
         FocusStorage.remove('weekly_planned');
         saveTasks();
         renderTasks(); renderCalendar(); renderEvents();
         checkBannerVisibility();
         actionModal.classList.add('hidden');
         showPremiumModal({title: 'Plan İptal Edildi', message: 'Haftalık planınız başarıyla silindi.', type: 'info'});
     };
 
     actionEditBtn.onclick = () => {
         stagedTasks = [];
         let tasksToEdit = getTasksRef().filter(t => t.weekStr === getCurrentWeekStr());
         tasksToEdit.forEach(t => {
             stagedTasks.push({ id: t.id, name: t.text, date: t.date, start: t.timeStart, end: t.timeEnd, parentGoal: t.parentGoal });
         });
         
         actionModal.classList.add('hidden');
         wizardModal.classList.remove('hidden');
         currentWizardStep = 2; 
         initDayTabs();
         updateWizardUI();
     };
 
     let stagedTasks = [];
     let selectedPriorities = [];
 
     function initDayTabs() {
         const startDayVal = parseInt(document.getElementById('wiz-start-day-select').value);
         const today = new Date();
         let d = new Date(today);
 
         while(d.getDay() !== startDayVal) {
             d.setDate(d.getDate() + 1);
         }
 
         wizardDates = [];
         const tabsContainer = document.getElementById('wiz-7day-tabs');
         tabsContainer.innerHTML = '';
 
         for(let i=0; i<7; i++) {
             let currDate = new Date(d);
             currDate.setDate(d.getDate() + i);
             let dateStr = formatDateToString(currDate);
             wizardDates.push(dateStr);
 
             let dayName = getDayNames()[currDate.getDay() === 0 ? 0 : currDate.getDay() ];
             let shortDate = `${currDate.getDate()} ${getMonthNamesShort()[currDate.getMonth()]}`;
 
             let tab = document.createElement('div');
             tab.className = `wizard-day-tab ${i === 0 ? 'active' : ''}`;
             tab.innerHTML = `<strong>${dayName}</strong><span class="u-font-size-10px_opacity-0p8">${shortDate}</span>`;
             tab.dataset.index = i;
 
             tab.onclick = () => { switchWizTab(i); };
             tabsContainer.appendChild(tab);
         }
         switchWizTab(0);
     }
 
     function resetWizardTime() {
         document.getElementById('wiz-new-task-start').value = "09:00";
         document.getElementById('wiz-time-start-display').textContent = "09:00";
         document.getElementById('wiz-new-task-end').value = "10:00";
         document.getElementById('wiz-time-end-display').textContent = "10:00";
     }
 
     function switchWizTab(index) {
         currentWizTabIndex = index;
         document.querySelectorAll('.wizard-day-tab').forEach(t => t.classList.remove('active'));
         const activeTab = document.querySelector(`.wizard-day-tab[data-index="${index}"]`);
         if(activeTab) activeTab.classList.add('active');
 
         document.getElementById('wiz-current-selected-date').value = wizardDates[index];
         resetWizardTime(); 
         renderStagedTasks();
 
         if(currentWizTabIndex === 6) {
             wizardNextBtn.innerHTML = 'Önceliklerini Seç <i class="fa-solid fa-arrow-right"></i>';
         } else {
             wizardNextBtn.innerHTML = 'Sonraki Gün <i class="fa-solid fa-arrow-right"></i>';
         }
     }
 
     function updateWizardUI() {
         document.querySelectorAll('.wizard-step').forEach((step, i) => {
             step.classList.toggle('hidden', i + 1 !== currentWizardStep);
         });
         document.querySelectorAll('.step-dot').forEach((dot, i) => {
             dot.classList.toggle('active', i + 1 === currentWizardStep);
             dot.style.background = i + 1 === currentWizardStep ? 'var(--primary-color)' : 'rgba(255,255,255,0.2)';
         });
         
         wizardPrevBtn.classList.toggle('hidden', currentWizardStep === 1);
         
         if (currentWizardStep === 3) {
             wizardNextBtn.classList.add('hidden');
             wizardFinishBtn.classList.remove('hidden');
             renderPrioritySelection(); 
         } else {
             wizardNextBtn.classList.remove('hidden');
             wizardFinishBtn.classList.add('hidden');
             if(currentWizardStep === 1) wizardNextBtn.innerHTML = 'İleri <i class="fa-solid fa-arrow-right"></i>';
         }
     }
 
     closeWizardBtn.onclick = () => { wizardModal.classList.add('hidden'); }
 
     wizardNextBtn.onclick = () => {
         if(currentWizardStep === 1) {
             currentWizardStep = 2;
             initDayTabs();
             updateWizardUI();
         } else if (currentWizardStep === 2) {
             if (currentWizTabIndex < 6) {
                 switchWizTab(currentWizTabIndex + 1);
             } else {
                 if(stagedTasks.length === 0) {
                     showPremiumModal({title: 'Görev Ekleyin', message: 'Lütfen haftanız için en az 1 görev planlayın.', type: 'warning'});
                     return;
                 }
                 currentWizardStep = 3;
                 updateWizardUI();
             }
         }
     };
     
     wizardPrevBtn.onclick = () => { 
         if (currentWizardStep === 3) {
             currentWizardStep = 2;
             updateWizardUI();
             switchWizTab(6); 
         } else if (currentWizardStep === 2) {
             if (currentWizTabIndex > 0) {
                 switchWizTab(currentWizTabIndex - 1);
             } else {
                 currentWizardStep = 1;
                 updateWizardUI();
             }
         }
     };
 
     const wizAddTaskBtn = document.getElementById('wiz-add-task-btn');
     wizAddTaskBtn.onclick = () => {
         const name = document.getElementById('wiz-new-task-name').value.trim();
         const parentGoal = document.getElementById('wiz-parent-goal').value;
         const date = document.getElementById('wiz-current-selected-date').value;
         const start = document.getElementById('wiz-new-task-start').value;
         const end = document.getElementById('wiz-new-task-end').value;

         // --- YENİ: Ana Hedef Tarih Sınırı Kontrolü ---
            if (!checkGoalDateBoundaries(parentGoal, date)) {
                return;
            }
 
         if(!name || !date || !start || !end) return;
 
         const startMins = timeToMins(start);
         const endMins = timeToMins(end);
 
         if(startMins >= endMins) {
             showPremiumModal({ title: 'Hatalı Zaman', message: 'Bitiş saati başlangıçtan önce olamaz.', type: 'warning' });
             return;
         }
 
         if(hasTimeConflict(date, startMins, endMins, true) || hasStagedConflict(date, startMins, endMins)) {
             showPremiumModal({ title: 'Zaman Çakışması', message: 'Bu tarih ve saat aralığında zaten bir planınız var. Lütfen çakışmayan bir zaman seçin.', type: 'warning' });
             return;
         }
 
         // --- SİHİRBAZ ANA HEDEF TARİH SINIRLARI DENETİMİ (GÜNCEL) ---
         if (parentGoal && !checkGoalDateBoundaries(parentGoal, date)) {
            return; // Tarih sınır dışındaysa eklemeyi keser
        }

         let totalMins = 0;
         stagedTasks.forEach(t => { if(t.date === date) totalMins += (timeToMins(t.end) - timeToMins(t.start)); });
         if(getCalendarEventsRef()[date]) {
             getCalendarEventsRef()[date].forEach(ev => { 
                 if (ev.weekStr !== getCurrentWeekStr()) {
                     totalMins += (timeToMins(ev.timeEnd) - timeToMins(ev.timeStart)); 
                 }
             });
         }
         
         const newTaskMins = endMins - startMins;
         if (totalMins + newTaskMins > 480) {
             showPremiumModal({ title: 'Kapasite Doldu!', message: 'Bir güne maksimum 8 saatlik (480 dk) görev ekleyebilirsiniz. Tükenmişlik (Burnout) yaşamamak için lütfen hedeflerinizi diğer günlere dağıtın.', type: 'warning' });
             return;
         }
 
         stagedTasks.push({ id: generateId(), name, date, start, end, parentGoal });
         document.getElementById('wiz-new-task-name').value = '';
         document.getElementById('wiz-parent-goal').value = '';
         
         const nextStart = end;
         const nextEnd = addOneHour(end);
         
         const displayStart = document.getElementById('wiz-time-start-display');
         const inputStart = document.getElementById('wiz-new-task-start');
         if (displayStart && inputStart) { displayStart.textContent = nextStart; inputStart.value = nextStart; }
         
         const displayEnd = document.getElementById('wiz-time-end-display');
         const inputEnd = document.getElementById('wiz-new-task-end');
         if (displayEnd && inputEnd) { displayEnd.textContent = nextEnd; inputEnd.value = nextEnd; }
 
         renderStagedTasks();
     };
 
     function hasStagedConflict(date, startMins, endMins) {
         for(let st of stagedTasks) {
             if(st.date === date) {
                 let stStart = timeToMins(st.start);
                 let stEnd = timeToMins(st.end);
                 if(startMins < stEnd && endMins > stStart) return true;
             }
         }
         return false;
     }
 
     function checkBurnout() {
         const currentDate = document.getElementById('wiz-current-selected-date').value;
         let totalMins = 0;
 
         stagedTasks.forEach(t => {
             if(t.date === currentDate) totalMins += (timeToMins(t.end) - timeToMins(t.start));
         });
 
         if(getCalendarEventsRef()[currentDate]) {
             getCalendarEventsRef()[currentDate].forEach(ev => {
                 if (ev.weekStr !== getCurrentWeekStr()) { 
                     totalMins += (timeToMins(ev.timeEnd) - timeToMins(ev.timeStart));
                 }
             });
         }
 
         let warningEl = document.getElementById('wiz-burnout-warning');
         if(!warningEl) {
             warningEl = document.createElement('div');
             warningEl.id = 'wiz-burnout-warning';
             warningEl.className = 'burnout-warning';
             warningEl.innerHTML = '<i class="fa-solid fa-fire-flame-curved"></i> <span><strong>Kapasite Uyarısı:</strong> Bu güne 8 saatten fazla görev yığdınız, tükenmişlik (burnout) yaşayabilirsiniz!</span>';
             const container = document.getElementById('wiz-staged-tasks').parentElement;
             container.insertBefore(warningEl, container.firstChild);
         }
 
         if(totalMins >= 480) warningEl.style.display = 'flex';
         else warningEl.style.display = 'none';
     }
 
     function renderStagedTasks() {
         const list = document.getElementById('wiz-staged-tasks');
         list.innerHTML = '';
         const currentDate = document.getElementById('wiz-current-selected-date').value;
         
         const dayTasks = stagedTasks.filter(t => t.date === currentDate);
 
         dayTasks.forEach((t) => {
             let badgeHTML = '';
             if (t.parentGoal) {
                 const pg = getGoalsRef().find(g => String(g.id) === String(t.parentGoal));
                 if (pg) {
                     badgeHTML = `<span class="task-category-tag u-background-rgba108922310p1_color-var-primary-color_border--2" ><i class="fa-solid fa-bullseye"></i> ${escapeHtml(pg.title)}</span>`;
                 }
             }
 
             list.innerHTML += `
                 <li class="staged-task-item">
                     <div class="staged-task-info">
                         <span class="staged-task-title">${escapeHtml(t.name)}</span>
                         <span class="staged-task-time"><i class="fa-regular fa-clock"></i> ${t.start} - ${t.end}</span>
                         ${badgeHTML}
                     </div>
                     <button class="remove-staged-btn" data-action="remove-staged-task" data-id="${t.id}"><i class="fa-solid fa-trash"></i></button>
                 </li>
             `;
         });
 
         if (!list.dataset.delegated) {
             list.dataset.delegated = '1';
             list.addEventListener('click', (e) => {
                 const el = e.target.closest('[data-action="remove-staged-task"]');
                 if (el) removeStagedTask(el.dataset.id);
             });
         }
         checkBurnout();
     }

     function removeStagedTask(id) { stagedTasks = stagedTasks.filter(t => String(t.id) !== String(id)); renderStagedTasks(); }
 
     function renderPrioritySelection() {
         const container = document.getElementById('wiz-priority-selection');
         container.innerHTML = '';
         selectedPriorities = []; 
         document.getElementById('wiz-priority-warning').style.display = 'none';
 
         stagedTasks.forEach(t => {
             const [d, m, y] = t.date.split('-'); // GÜNCELLEME: d, m, y sırasına alındı
             const shortDate = `${parseInt(d)} ${getMonthNamesShort()[parseInt(m)-1]}`;
 
             container.innerHTML += `
                 <label class="priority-select-item" id="priority-label-${t.id}">
                     <input type="checkbox" class="priority-checkbox" value="${t.id}">
                     <div class="u-display-flex_flex-direction-column">
                         <span class="u-color-hfff_font-weight-500_font-size-14px">${escapeHtml(t.name)}</span>
                         <span class="u-font-size-12px_color-var-text-muted">${shortDate} | ${t.start} - ${t.end}</span>
                     </div>
                 </label>
             `;
         });
         if (!container.dataset.delegated) {
             container.dataset.delegated = '1';
             container.addEventListener('change', (e) => {
                 const cb = e.target.closest('.priority-checkbox');
                 if (cb) handlePrioritySelection(cb);
             });
         }
     }

     function handlePrioritySelection(cb) {
         const warningEl = document.getElementById('wiz-priority-warning');
         const labelEl = document.getElementById(`priority-label-${cb.value}`);
         
         if (cb.checked) {
             if (selectedPriorities.length >= 3) {
                 cb.checked = false; 
                 warningEl.style.display = 'block';
                 return;
             }
             selectedPriorities.push(String(cb.value));
             labelEl.classList.add('selected');
             warningEl.style.display = 'none';
         } else {
             selectedPriorities = selectedPriorities.filter(id => id !== String(cb.value));
             labelEl.classList.remove('selected');
             warningEl.style.display = 'none';
         }
     };
 
     wizardFinishBtn.onclick = () => {
         setTasksRef(getTasksRef().filter(t => t.weekStr !== getCurrentWeekStr()));
         for(let date in getCalendarEventsRef()) {
             getCalendarEventsRef()[date] = getCalendarEventsRef()[date].filter(e => e.weekStr !== getCurrentWeekStr());
             if(getCalendarEventsRef()[date].length === 0) delete getCalendarEventsRef()[date];
         }
 
         stagedTasks.forEach(st => {
             const isTopPriority = selectedPriorities.includes(String(st.id));
             const taskPriority = isTopPriority ? 'high' : 'medium';
             
             getTasksRef().push({ id: st.id, text: st.name, completed: false, priority: taskPriority, category: 'is', date: st.date, timeStart: st.start, timeEnd: st.end, weekStr: getCurrentWeekStr(), parentGoal: st.parentGoal });
             
             if(!getCalendarEventsRef()[st.date]) getCalendarEventsRef()[st.date] = [];
             getCalendarEventsRef()[st.date].push({ id: st.id, text: st.name, timeStart: st.start, timeEnd: st.end, priority: taskPriority, weekStr: getCurrentWeekStr(), parentGoal: st.parentGoal });
         });
         
         saveTasks();
         FocusStorage.setRaw('weekly_planned', getCurrentWeekStr());
         
         wizardModal.classList.add('hidden');
         checkBannerVisibility(); 
         
         renderTasks(); renderCalendar(); renderEvents();
         if(getRenderStatisticsRef() && document.getElementById('istatistikler').classList.contains('active')) getRenderStatisticsRef()();
         if(getRenderSocialStatsRef() && document.getElementById('arkadaslar').classList.contains('active')) getRenderSocialStatsRef()();
         if(getRenderBuddyHabitsRef() && document.getElementById('arkadaslar').classList.contains('active')) getRenderBuddyHabitsRef()();
         
         showPremiumModal({title: 'Hafta Kilitlendi!', message: 'Tüm planlarınızı ve önceliklerinizi takvime yerleştirdik. Verimli bir hafta dileriz!', type: 'success'});
     };
 
