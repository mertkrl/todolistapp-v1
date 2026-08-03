// script-calendar-month-view.js
// script.js'ten çıkarıldı (Faz 6): Ay görünümü render (renderCalendar) + Gün
// Detay Paneli render (renderEvents) + bunların içindeki takvim listesi
// reorder/tamamlama animasyonu (initCalEventListDnD).
//
// Köprüler:
//  - window.__getCurrentDateRef/__setCurrentDateRef, window.__getSelectedDateRef/
//    __setSelectedDateRef: script.js'te bu çıkarma için yeni eklendi —
//    currentDate/selectedDate script.js'in TAKVİM NAVİGASYONU (prev/next/today,
//    switchCalView vb.) tarafından da reassign ediliyor, bu yüzden getter+setter.
//  - window.__getTasksRef/__getGoalsRef/__getHabitsRef/__getCalendarEventsRef:
//    script.js'te zaten vardı (salt-okunur, bu blok sadece mutate ediyor).
//  - window.__getMindDumpsRef/__setMindDumpsRef: script.js'te zaten vardı.
//  - window.renderTasks/updateStats/renderCalMindDump: script.js'te zaten vardı.
//  - window.initCalEventListDnD: burada tanımlı, dışa açıldı (renderEvents
//    kendi içinden çağırıyordu, blok dışına taşınmadı ama dosya SIRASI
//    içinde tanım DAHA SONRA geliyordu — hoisting'e dayanan bağımlılık).
//
// Faz G Kategori 4: script.js'ten tüketilen köprülerin bir kısmı gerçek
// import'a çevrildi — script.js index.html'de bu dosyadan ÖNCE yüklendiği
// için bu yön güvenli (script.js'in kendisi renderCalendar/renderEvents/
// switchCalView'ı BU dosyadan tüketiyor, o yön window.* köprüsü olarak
// KALDI — script.js önce yüklendiği için ters yönde statik import güvenli
// değil).
import {
    getCalendarEventsRef, getMindDumpsRef, getTasksRef, getGoalsRef, getHabitsRef,
    setMindDumpsRef, moveTaskToDate, renderCalMindDump, updateStats, renderTasks,
    getCurrentDateRef, setCurrentDateRef, getSelectedDateRef, setSelectedDateRef,
    initCalEventListDnD as _initCalEventListDnD, openDayDrawer as _openDayDrawer,
    getPriorityLabelsRef
} from './script.js';

     window.renderCalendar = () => renderCalendar(); // Faz 6: script-convert-modal.js için
    // renderCalendar'ın gün-hücresi oluşturma katmanı — tek bir günün DOM elementini
    // (noktalar, hover popup, sürükle-bırak dahil) kurup döner, DOM'a eklemez.
    // Faz S devamı, dev fonksiyon refactoru.
    function _buildCalDayCell(year, month, i) {
             const d = document.createElement('div'); 
             d.className = 'cal-day'; 
             d.textContent = i;
             
             const check = window.formatDateToString(new Date(year, month, i));
             d.setAttribute('data-date', check); // YENİ EKLENEN SATIR: Sürükle-bırak için tarihi hücreye işliyoruz
             if (check === window.formatDateToString(new Date())) d.classList.add('today');
             if (check === window.formatDateToString(getSelectedDateRef())) d.classList.add('selected');
             
             // Dünden sarkan (gece kuşu) görev var mı kontrolü
             let prevD = new Date(year, month, i - 1);
             const prevCheck = window.formatDateToString(prevD);
             const overnightEvents = (getCalendarEventsRef()[prevCheck] || []).filter(e => e.isOvernight && !e.isLessonPlanDraft);

             // Bugünün tüm etkinlikleri (isLessonPlanDraft: öğretmenin başka bir öğrenci için
             // henüz atamadığı ders planı taslağı — sadece planlama arayüzünde görünmeli)
             const todaysEvents = (getCalendarEventsRef()[check] || []).filter(e => !e.isLessonPlanDraft);
             const todaysHabits = getHabitsForDate(check);
             let highlightHistory = FocusStorage.get('highlight_history', {});
             const hasHighlight = !!highlightHistory[check];
 
             const allDayItems = [...overnightEvents, ...todaysEvents];

             // Sınıf ödevleri (window.FocusAssignments, social.js) — o gün teslim tarihi olan,
             // henüz teslim edilmemiş ödevler. Normal görevlerden ayrı bir nokta rengiyle işaretlenir.
             const dayAssignments = (window.FocusAssignments?.items || []).filter(a => !a.done && a.due_date && window.formatDateToString(new Date(a.due_date)) === check);

             // Heat overlay: toplam yük hesabı → data-heat attribute
             const heatCount = allDayItems.length + todaysHabits.length + (hasHighlight ? 1 : 0) + dayAssignments.length;
             if (heatCount > 0) {
                 const level = heatCount <= 2 ? 1 : heatCount <= 4 ? 2 : heatCount <= 7 ? 3 : 4;
                 d.setAttribute('data-heat', level);
             }

             // Eğer o gün herhangi bir etkinlik varsa çoklu noktaları oluştur
             if (allDayItems.length > 0 || todaysHabits.length > 0 || hasHighlight || dayAssignments.length > 0) {
                 const dotsContainer = document.createElement('div');
                 dotsContainer.className = 'cal-task-bars';
                 
                 // Ana hedef varsa turuncu yıldız renginde ilk sıraya ekle
                 if (hasHighlight) {
                     const dot = document.createElement('span');
                     dot.className = 'cal-task-dot';
                     dot.style.backgroundColor = '#ff9f43';
                     dot.style.boxShadow = '0 0 4px #ff9f43';
                     dotsContainer.appendChild(dot);
                 }
 
                 // Renk kaynakları: önce hedef, yoksa kategori
                 const dotSeen = new Set();
                 const dotColors = [];
                 function addDot(key, cc2) {
                     if (dotSeen.has(key) || dotColors.length >= 4) return;
                     dotSeen.add(key); dotColors.push(cc2);
                 }
                 allDayItems.forEach(ev => {
                     const globalTask = getTasksRef().find(t => String(t.id) === String(ev.id));
                     if (globalTask && globalTask.parentGoal) {
                         const gc = window.getGoalColor(globalTask.parentGoal);
                         if (gc) { addDot('goal_' + globalTask.parentGoal, gc); return; }
                     }
                     const cat = (globalTask && globalTask.category) || 'kisisel';
                     addDot('cat_' + cat, getCatColor(cat));
                 });
                 todaysHabits.forEach(h => {
                     addDot('cat_' + (h.category || 'kisisel'), getCatColor(h.category || 'kisisel'));
                 });
                 dotColors.forEach(cc2 => {
                     const dot = document.createElement('span');
                     dot.className = 'cal-task-dot' + (cc2.isGoal ? ' cal-task-dot-goal' : '');
                     dot.style.backgroundColor = cc2.border;
                     dot.style.boxShadow = `0 0 4px ${cc2.border}`;
                     dot.title = cc2.label;
                     dotsContainer.appendChild(dot);
                 });

                 // Ödev noktası — diğer noktalardan ayrı görünsün diye kare şekilli, en sonda
                 if (dayAssignments.length > 0) {
                     const overdueAsg = dayAssignments.some(a => new Date(a.due_date) < new Date());
                     const color = overdueAsg ? '#ff6b6b' : '#a29bfe';
                     const dot = document.createElement('span');
                     dot.className = 'cal-task-dot cal-task-dot-assignment';
                     dot.style.backgroundColor = color;
                     dot.style.boxShadow = `0 0 4px ${color}`;
                     dot.title = `${dayAssignments.length} ödev${overdueAsg ? ' (süresi geçmiş)' : ''}`;
                     dotsContainer.appendChild(dot);
                 }

                 d.appendChild(dotsContainer);
             }
             
             d.onclick = () => {
                 setSelectedDateRef(new Date(year, month, i));
                 setCurrentDateRef(new Date(getSelectedDateRef()));
                 renderCalendar();
                 renderEvents(); // gizli elementler için uyumluluk
                 _openDayDrawer(check);
             };

             // Hover popup
             d.addEventListener('mouseenter', (e) => showCalHoverPopup(e, check, allDayItems, todaysHabits, hasHighlight));
             d.addEventListener('mouseleave', hideCalHoverPopup);
 
             // --- YENİ EKLENEN: Takvim Günlerine Sürükle-Bırak Özelliği ---
             d.addEventListener('dragover', (e) => { e.preventDefault(); d.classList.add('drag-over'); });
             d.addEventListener('dragleave', () => { d.classList.remove('drag-over'); });
             d.addEventListener('drop', (e) => {
                e.preventDefault();
                d.classList.remove('drag-over');
                const draggedTaskId = e.dataTransfer.getData('taskId') || e.dataTransfer.getData('dumpId'); // Bırakılan görevin veya fikrin ID'sini al
                if(draggedTaskId) {
                    // Sürüklenen şey bir zihin çöplüğü fikri mi kontrol et
                    const dumpItem = typeof getMindDumpsRef() !== 'undefined' && getMindDumpsRef().find(x => String(x.id) === String(draggedTaskId));
                    if (dumpItem) {
                        // Fikri otomatik olarak o güne orta öncelikli varsayılan görev olarak planla
                        addSmartTask(dumpItem.text, 'medium', 'is', check, '09:00', '10:00', '', '', '');
                        setMindDumpsRef(getMindDumpsRef().filter(x => String(x.id) !== String(draggedTaskId)));
                        window.saveMindDumps();
                    } else {
                        moveTaskToDate(draggedTaskId, check); // Normal görevi bu yeni güne taşı
                    }
                    
                    // ANLIK GÖRÜNÜM SENKRONİZASYONU
                    setTimeout(() => {
                        if (typeof renderCalendar === 'function') renderCalendar();
                        if (typeof renderEvents === 'function') renderEvents();
                        if (typeof renderCalMindDump === 'function') renderCalMindDump();
                        if (typeof window.renderMindDumps === 'function') window.renderMindDumps();
                        if (typeof renderTasks === 'function') renderTasks();
                        if (typeof updateStats === 'function') updateStats();
                    }, 100);
                }
            });
             // -------------------------------------------------------------
 
        return d;
    }

    export function renderCalendar() {
         const year = getCurrentDateRef().getFullYear(); 
         const month = getCurrentDateRef().getMonth();
         window.monthYearDisplay.textContent = `${monthNames[month]} ${year}`; 
         window.calendarDays.innerHTML = '';
         
         const firstDay = new Date(year, month, 1).getDay();
         const lastDate = new Date(year, month + 1, 0).getDate();
         const startDay = firstDay === 0 ? 6 : firstDay - 1;
         
         for (let i = 0; i < startDay; i++) {
             window.calendarDays.appendChild(Object.assign(document.createElement('div'), {className:'cal-day empty'}));
         }
         
         for (let i = 1; i <= lastDate; i++) {
             window.calendarDays.appendChild(_buildCalDayCell(year, month, i));
         }
     }
 
     window.renderEvents = () => renderEvents(); // Faz 6: script-convert-modal.js için
    // renderEvents'ten ayrılan: arama/filtre durumuna göre günün öğelerini hesaplar (DOM yazmaz, sadece veri döner).
    // Faz S devamı, dev fonksiyon refactoru.
    function _evComputeDayItems() {
         const check = window.formatDateToString(getSelectedDateRef());
         
         // Arama ve Filtreleme Değerlerini Al
         const searchQuery = document.getElementById('calendar-search-input') ? document.getElementById('calendar-search-input').value.toLowerCase().trim() : '';
         const filterValue = document.getElementById('calendar-filter-select') ? document.getElementById('calendar-filter-select').value : 'all';
 
         let dayEvents = [];
         let dayHabits = [];
         let highlightList = [];
 
         // EĞER ARAMA KUTUSU DOLUYSA (TÜM GEÇMİŞTE VE GELECEKTE ARA)
         if (searchQuery !== '') {
             window.selectedDateTitle.textContent = `Arama Sonuçları: "${searchQuery}"`;
             
             // 1. Tüm Takvim Planlarını Ara (getCalendarEventsRef() üzerinden)
             let allCalendarItems = [];
             for (let date in getCalendarEventsRef()) {
                 getCalendarEventsRef()[date].forEach(ev => {
                     allCalendarItems.push(Object.assign({}, ev, { _searchDate: date }));
                 });
             }
             dayEvents = allCalendarItems.filter(ev => !ev.isLessonPlanDraft && ev.text.toLowerCase().includes(searchQuery));
             if (filterValue !== 'all' && filterValue !== 'habit') {
                 dayEvents = dayEvents.filter(ev => ev.priority === filterValue);
             }
 
             // 2. Tüm Alışkanlıkları Ara
             if (filterValue === 'all' || filterValue === 'habit') {
                 dayHabits = getHabitsRef().filter(h => h.name.toLowerCase().includes(searchQuery));
             }
 
             // 3. Tüm Ana Hedefleri (Highlight) Ara
             if (filterValue === 'all' || filterValue === 'high') {
                 let hHistory = FocusStorage.get('highlight_history', {});
                 for (let d in hHistory) {
                     if (hHistory[d].text.toLowerCase().includes(searchQuery)) {
                         highlightList.push({ date: d, data: hHistory[d] });
                     }
                 }
             }
         } 
         // EĞER ARAMA BOŞSA (SADECE TAKVİMDE SEÇİLİ OLAN GÜNÜ GÖSTER)
         else {
             const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
             window.selectedDateTitle.textContent = getSelectedDateRef().toLocaleDateString('tr-TR', options);
             
             // Seçili Günün Görevleri (isLessonPlanDraft: öğretmenin başka bir öğrenci için
             // henüz atamadığı ders planı taslağı — bu görünümde gizli kalmalı)
             if (getCalendarEventsRef()[check]) dayEvents.push(...getCalendarEventsRef()[check].filter(e => !e.isLessonPlanDraft));

             // Dünden sarkan (gece kuşu) görevler
             let prevDate = new Date(getSelectedDateRef());
             prevDate.setDate(prevDate.getDate() - 1);
             const prevCheck = window.formatDateToString(prevDate);
             if (getCalendarEventsRef()[prevCheck]) {
                 const overnightEvents = getCalendarEventsRef()[prevCheck].filter(e => e.isOvernight && !e.isLessonPlanDraft);
                 dayEvents.push(...overnightEvents);
             }
 
             // Seçili Günün Alışkanlıkları ve Ana Hedefi
             dayHabits = getHabitsForDate(check);
             let highlightHistory = FocusStorage.get('highlight_history', {});
             if (highlightHistory[check]) highlightList.push({ date: check, data: highlightHistory[check] });
 
             // Sadece Menü Filtresi Varsa Uygula
             if (filterValue !== 'all') {
                 if (filterValue === 'habit') {
                     dayEvents = [];
                     highlightList = [];
                 } else {
                     dayEvents = dayEvents.filter(ev => ev.priority === filterValue);
                     dayHabits = [];
                     if (filterValue !== 'high') highlightList = [];
                 }
             }
         }
 
         // Görevleri Saate Göre Sırala
         dayEvents.sort((a, b) => {
             const timeA = a.timeStart || "00:00";
             const timeB = b.timeStart || "00:00";
             return timeA.localeCompare(timeB);
         });
        return { check, searchQuery, filterValue, dayEvents, dayHabits, highlightList };
    }

    // renderEvents'ten ayrılan: mikro ilerleme (günlük tamamlanma) halkasını günceller.
    // Faz S devamı, dev fonksiyon refactoru.
    function _evUpdateProgressRing(check, dayEvents, dayHabits, highlightList) {
         window.eventsCountDisplay.textContent = `${dayEvents.length + dayHabits.length + highlightList.length} Plan`;
 
         // --- YENİ: Mikro İlerleme (Günlük Tamamlanma Yüzdesi) ---
         let totalItemsForSelectedDay = dayEvents.length + dayHabits.length + highlightList.length;
         let completedItemsForSelectedDay = 0;
         
         dayEvents.forEach(ev => {
             const globalTask = getTasksRef().find(t => String(t.id) === String(ev.id));
             if (globalTask && globalTask.completed) completedItemsForSelectedDay++;
         });
         dayHabits.forEach(habit => { if (habit.history[check]) completedItemsForSelectedDay++; });
         highlightList.forEach(hl => { if (hl.data.completed) completedItemsForSelectedDay++; });
 
         const calProgContainer = document.getElementById('cal-daily-progress-container');
         const calProgCircle = document.getElementById('cal-daily-progress-circle');
         const calProgText = document.getElementById('cal-daily-progress-text');
         
         if (calProgContainer && calProgCircle && calProgText) {
             if (totalItemsForSelectedDay > 0) {
                 calProgContainer.style.display = 'block';
                 const percentage = Math.round((completedItemsForSelectedDay / totalItemsForSelectedDay) * 100);
                 const offset = 100.5 - (percentage / 100) * 100.5;
                 calProgCircle.style.strokeDashoffset = offset;
                 calProgText.textContent = `%${percentage}`;
                 
                 if (percentage === 100) {
                     calProgCircle.style.stroke = "#2ed573";
                     calProgText.style.color = "#2ed573";
                 } else {
                     calProgCircle.style.stroke = "#ff9f43";
                     calProgText.style.color = "#fff";
                 }
             } else {
                 calProgContainer.style.display = 'none';
             }
         }
    }

    // renderEvents'ten ayrılan: 'Ana Hedef' (highlight) kartlarının HTML'ini üretir.
    // Faz S devamı, dev fonksiyon refactoru.
    function _evBuildHighlightHtml(highlightList) {
        let html = '';
       highlightList.forEach(hl => {
         const isCompleted = hl.data.completed;
         const hlDateStr = hl.date;
         const [d, m, y] = hlDateStr.split('-');
         const shortDate = `${parseInt(d)} ${monthNamesShort[parseInt(m)-1]} ${y}`;

         let parentBadgeHTML = '';
         if (hl.data.parentGoal) {
             const pg = getGoalsRef().find(g => String(g.id) === String(hl.data.parentGoal));
             if (pg) {
                 parentBadgeHTML = `<span class="u-font-size-10px_background-rgba108922310p15_color-ha29bfe_p"><i class="fa-solid fa-mountain-sun"></i> ${escapeHtml(pg.title)}</span>`;
             }
         }

         html += `
         <li class="u-list-style-none_margin-bottom-16px">
             <div class="cal-highlight-card ${isCompleted ? 'cal-highlight-done' : ''}">
                 <div class="cal-highlight-top">
                     <div class="cal-highlight-icon-wrap">
                         <i class="fa-solid fa-star"></i>
                     </div>
                     <div class="u-flex-1_min-width-0">
                         <div class="u-font-size-10px_font-weight-700_letter-spacing-1p5px_color-">✦ Günün Odak Hedefi</div>
                         <div class="cal-highlight-text u-font-size-15px_font-weight-700_line-height-1p4_word-break-" data-completed="${isCompleted ? '1' : '0'}">${hl.data.text}</div>
                         <div class="u-margin-top-8px_display-flex_gap-6px_flex-wrap-wrap_align-i">
                             <span class="u-font-size-10px_background-rgba2552552550p05_color-var-text"><i class="fa-regular fa-calendar u-margin-right-4px" ></i>${shortDate}</span>
                             ${parentBadgeHTML}
                             ${isCompleted ? '<span class="u-font-size-10px_background-rgba462131150p15_color-h2ed573_p"><i class="fa-solid fa-circle-check"></i> Tamamlandı</span>' : ''}
                         </div>
                     </div>
                     <button class="cal-highlight-check-btn ${isCompleted ? 'done' : ''}" data-action="toggle-highlight-task" data-date="${hlDateStr}" title="${isCompleted ? 'Geri al' : 'Tamamla'}">
                         ${isCompleted ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-regular fa-circle-check"></i>'}
                     </button>
                 </div>
             </div>
         </li>`;
         });
        return html;
    }

    // renderEvents'ten ayrılan: yatay alışkanlık bandını render eder (kendi DOM'una yazar).
    // Faz S devamı, dev fonksiyon refactoru.
    function _evRenderHabitsBand(dayHabits, check, searchQuery) {
        // 2. ALIŞKANLIKLARI YATAY BANDA YAZDIR (YENİ)
        const calHabitsBand = document.getElementById('calendar-habits-band');
        const calHabitsList = document.getElementById('calendar-habits-list');
        
        if (calHabitsBand && calHabitsList) {
            if (dayHabits.length > 0 && searchQuery === '') {
                calHabitsBand.style.display = 'block';
                let habitsHTML = '';
                const todayStrForHabit = window.formatDateToString(new Date());
                
                dayHabits.forEach(habit => {
                    const isCompleted = !!habit.history[check]; 
                    const isFutureDate = check > todayStrForHabit; 
                    const clickAttr = isFutureDate ? '' : `data-action="toggle-habit-today" data-id="${habit.id}" data-date="${check}"`;
                    
                    let checkIcon = isCompleted ? '<i class="fa-solid fa-circle-check u-color-h2ed573_font-size-16px-2" ></i>' : 
                                   (isFutureDate ? '<i class="fa-solid fa-lock u-color-var-text-muted_opacity-0p6_font-size-16px" ></i>' : '<i class="fa-regular fa-circle u-color-var-text-muted_font-size-16px" ></i>');
 
                    habitsHTML += `
                    <div class="cal-habit-band-card ${isCompleted ? 'completed' : ''}" ${clickAttr} data-future="${isFutureDate ? '1' : '0'}">
                        <div>${checkIcon}</div>
                        <div class="cal-habit-band-name u-flex-1_overflow-hidden_text-overflow-ellipsis_white-space-" data-completed="${isCompleted ? '1' : '0'}">${escapeHtml(habit.name)}</div>
                    </div>`;
                });
                calHabitsList.innerHTML = habitsHTML;
                calHabitsList.querySelectorAll('.cal-habit-band-card[data-future="1"]').forEach(el => {
                    el.style.opacity = '0.6';
                    el.style.cursor = 'not-allowed';
                });
                calHabitsList.querySelectorAll('.cal-habit-band-name').forEach(el => {
                    if (el.dataset.completed === '1') {
                        el.style.textDecoration = 'line-through';
                        el.style.opacity = '0.7';
                    } else {
                        el.style.color = '#fff';
                    }
                });
            } else {
                calHabitsBand.style.display = 'none';
                calHabitsList.innerHTML = '';
            }
        }
    }

    // renderEvents'ten ayrılan: görev/milestone timeline kartlarının HTML'ini üretir.
    // Faz S devamı, dev fonksiyon refactoru.
    function _evBuildEventsHtml(dayEvents, check) {
         return dayEvents.map((ev) => {
             // F1.2 — Planlama milestone event'leri özel render
             if (ev.isMilestone) {
                 const msId = ev.id.replace('ms_cal_', '');
                 const mColor = ev.milestoneColor || '#a78bfa';
                 const planningGoals = (typeof FocusStorage !== 'undefined')
                     ? FocusStorage.get('planning_goals', [])
                     : JSON.parse(localStorage.getItem('planning_goals') || '[]', window._safeJsonReviver);
                 let msDone = false;
                 for (const g of planningGoals) {
                     const ms = (g.milestones || []).find(m => m.id === msId);
                     if (ms) { msDone = !!ms.done; break; }
                 }
                 return `
                 <li class="cal-event-item${msDone ? ' completed' : ''}" data-ms-color="${mColor}">
                     <div class="tc-time-pill" data-ms-color-text="${mColor}">
                         <i class="fa-solid fa-flag-checkered"></i> Milestone
                     </div>
                     <div class="timeline-card" data-ms-color-border33="${mColor}">
                         <div class="tc-glow-bar" data-ms-color-bg="${mColor}"></div>
                         <div class="tc-inner">
                             <div class="tc-checkbox${msDone ? ' tc-checked' : ''}" data-ms-checkbox-color="${mColor}" data-ms-done="${msDone ? '1' : '0'}"
                                  data-action="toggle-planning-milestone" data-id="${ev.id}">
                                 ${msDone ? '<i class="fa-solid fa-check"></i>' : ''}
                             </div>
                             <div class="tc-content">
                                 <div class="tc-title${msDone ? ' tc-done' : ''}" data-ms-done="${msDone ? '1' : '0'}">${ev.text}</div>
                                 <div class="tc-meta">
                                     <span class="tc-badge" data-ms-color-badge="${mColor}"><i class="fa-solid fa-flag-checkered"></i> Dönüm Noktası</span>
                                     <span class="tc-badge u-cursor-pointer_opacity-p6" data-action="switch-tab-planlama">Planlamaya Git →</span>
                                 </div>
                             </div>
                         </div>
                     </div>
                 </li>`;
             }

             const globalTask = getTasksRef().find(t => String(t.id) === String(ev.id));
             const isCompleted = globalTask ? globalTask.completed : false;

             const evTimeStart = ev.timeStart || ev.time || "12:00";
             const evTimeEnd = ev.timeEnd || "13:00";
             const evPriority = ev.priority || "medium";
             const priorityLabel = getPriorityLabelsRef()[evPriority] || "Orta";

             const evDate = (globalTask && globalTask.date) ? globalTask.date : (ev._searchDate || check);
             const [d, m, y] = evDate.split('-'); // GÜNCELLEME: d, m, y sırasına alındı
             const shortDate = `${parseInt(d)} ${monthNamesShort[parseInt(m)-1]}`;

             let parentBadgeHTML = '';
             if (ev.parentHabit) {
                 const ph = getHabitsRef().find(h => String(h.id) === String(ev.parentHabit));
                 if (ph) parentBadgeHTML = `<span class="parent-habit-badge u-font-size-10px_padding-2px8px" ><i class="fa-solid fa-bullseye"></i> ${escapeHtml(ph.name)}</span>`;
             }

             const priorityColors = { 'high': '#ff4757', 'medium': '#ff9f43', 'low': '#2ed573' };
             const pColor = priorityColors[evPriority] || '#ff9f43';

             return `
             <li class="cal-event-item priority-${evPriority}${isCompleted ? ' completed' : ''}" draggable="true" data-drag-id="${ev.id}">
                 <div class="tc-time-pill">
                     <i class="fa-regular fa-clock"></i> ${evTimeStart} <span class="tc-sep">→</span> ${evTimeEnd}
                 </div>
                 <div class="timeline-card">
                     <div class="tc-glow-bar"></div>
                     <div class="tc-inner">
                         <div class="tc-checkbox${isCompleted ? ' tc-checked' : ''}" data-action="toggle-task" data-id="${ev.id}">
                             ${isCompleted ? '<i class="fa-solid fa-check"></i>' : ''}
                         </div>
                         <div class="tc-content">
                             <div class="tc-title${isCompleted ? ' tc-done' : ''}">${ev.text}</div>
                             <div class="tc-meta">
                                 <span class="tc-badge tc-prio-${evPriority}"><i class="fa-solid fa-circle-dot"></i> ${priorityLabel}</span>
                                 <span class="tc-badge tc-badge-date"><i class="fa-regular fa-calendar"></i> ${shortDate}</span>
                                 ${ev.parentHabit ? (() => { const ph = getHabitsRef().find(h => String(h.id) === String(ev.parentHabit)); return ph ? `<span class="tc-badge tc-badge-goal"><i class="fa-solid fa-bullseye"></i> ${escapeHtml(ph.name)}</span>` : ''; })() : ''}
                             </div>
                         </div>
                         <div class="tc-actions">
                             <i class="fa-solid fa-grip-vertical tc-drag-icon" title="Sürükle & Taşı"></i>
                             <button class="tc-edit-btn" data-action="edit-task" data-id="${ev.id}" title="Düzenle" aria-label="Düzenle"><i class="fa-solid fa-pen"></i></button>
                             <button class="tc-del-btn" data-action="delete-task" data-id="${ev.id}" data-date="${evDate}" title="Sil" aria-label="Sil"><i class="fa-solid fa-trash-can"></i></button>
                         </div>
                     </div>
                 </div>
             </li>`;
         }).join('');
    }

    export function renderEvents() {
        const { check, searchQuery, filterValue, dayEvents, dayHabits, highlightList } = _evComputeDayItems();

        _evUpdateProgressRing(check, dayEvents, dayHabits, highlightList);

         if (dayEvents.length === 0 && dayHabits.length === 0 && highlightList.length === 0) {
             if (searchQuery !== '' || filterValue !== 'all') {
                 window.eventList.innerHTML = '<div class="empty-state">Arama kriterlerine uygun plan bulunamadı.</div>';
             } else {
                 window.eventList.innerHTML = '<div class="empty-state">Bu tarih için plan yok.</div>';
             }
             return;
         }

        let html = _evBuildHighlightHtml(highlightList);

        _evRenderHabitsBand(dayHabits, check, searchQuery);

        html += _evBuildEventsHtml(dayEvents, check);

         window.eventList.innerHTML = html;

        window.eventList.querySelectorAll('.cal-highlight-text[data-completed]').forEach(el => {
            const done = el.dataset.completed === '1';
            el.style.color = done ? 'var(--text-muted)' : '#fff';
            if (done) { el.style.textDecoration = 'line-through'; el.style.opacity = '0.6'; }
        });
        window.eventList.querySelectorAll('[data-ms-color]').forEach(el => {
            el.style.setProperty('--pColor', el.dataset.msColor);
        });
        window.eventList.querySelectorAll('[data-ms-color-text]').forEach(el => {
            const c = el.dataset.msColorText;
            el.style.color = c;
            el.style.borderColor = c + '44';
        });
        window.eventList.querySelectorAll('[data-ms-color-border33]').forEach(el => {
            el.style.borderColor = el.dataset.msColorBorder33 + '33';
        });
        window.eventList.querySelectorAll('[data-ms-color-bg]').forEach(el => {
            el.style.background = el.dataset.msColorBg;
        });
        window.eventList.querySelectorAll('[data-ms-checkbox-color]').forEach(el => {
            const c = el.dataset.msCheckboxColor;
            if (el.dataset.msDone === '1') { el.style.background = c; el.style.borderColor = c; }
            else { el.style.borderColor = c; }
        });
        window.eventList.querySelectorAll('.tc-title[data-ms-done]').forEach(el => {
            el.style.color = el.dataset.msDone === '1' ? 'rgba(255,255,255,.4)' : '#fff';
        });
        window.eventList.querySelectorAll('[data-ms-color-badge]').forEach(el => {
            const c = el.dataset.msColorBadge;
            el.style.background = c + '18';
            el.style.color = c;
            el.style.border = `1px solid ${c}44`;
        });

         _initCalEventListDnD(check);
    }