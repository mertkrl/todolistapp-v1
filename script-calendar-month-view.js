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
    initCalEventListDnD as _initCalEventListDnD, openDayDrawer as _openDayDrawer
} from './script.js';

     window.renderCalendar = () => renderCalendar(); // Faz 6: script-convert-modal.js için
    function renderCalendar() {
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
 
             window.calendarDays.appendChild(d);
         }
     }
 
     window.renderEvents = () => renderEvents(); // Faz 6: script-convert-modal.js için
    function renderEvents() {
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
             if (getCalendarEventsRef()[check]) dayEvents.push(...calendarEvents[check].filter(e => !e.isLessonPlanDraft));

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
         // ---------------------------------------------------------
 
         if (dayEvents.length === 0 && dayHabits.length === 0 && highlightList.length === 0) {
             if (searchQuery !== '' || filterValue !== 'all') {
                 window.eventList.innerHTML = '<div class="empty-state">Arama kriterlerine uygun plan bulunamadı.</div>';
             } else {
                 window.eventList.innerHTML = '<div class="empty-state">Bu tarih için plan yok.</div>';
             }
             return;
         }
 
         let html = '';
 
       // 1. ANA HEDEFLERİ EKRANA YAZDIR
       highlightList.forEach(hl => {
         const isCompleted = hl.data.completed;
         const hlDateStr = hl.date;
         const [d, m, y] = hlDateStr.split('-');
         const shortDate = `${parseInt(d)} ${monthNamesShort[parseInt(m)-1]} ${y}`;

         let parentBadgeHTML = '';
         if (hl.data.parentGoal) {
             const pg = getGoalsRef().find(g => String(g.id) === String(hl.data.parentGoal));
             if (pg) {
                 parentBadgeHTML = `<span style="font-size:10px; background:rgba(108,92,231,0.15); color:#a29bfe; padding:3px 10px; border-radius:20px; border:1px solid rgba(108,92,231,0.3); display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-mountain-sun"></i> ${escapeHtml(pg.title)}</span>`;
             }
         }

         html += `
         <li style="list-style:none; margin-bottom:16px;">
             <div class="cal-highlight-card ${isCompleted ? 'cal-highlight-done' : ''}">
                 <div class="cal-highlight-top">
                     <div class="cal-highlight-icon-wrap">
                         <i class="fa-solid fa-star"></i>
                     </div>
                     <div style="flex:1; min-width:0;">
                         <div style="font-size:10px; font-weight:700; letter-spacing:1.5px; color:#ff9f43; text-transform:uppercase; margin-bottom:5px;">✦ Günün Odak Hedefi</div>
                         <div style="font-size:15px; font-weight:700; color:${isCompleted ? 'var(--text-muted)' : '#fff'}; ${isCompleted ? 'text-decoration:line-through; opacity:0.6;' : ''} line-height:1.4; word-break:break-word;">${hl.data.text}</div>
                         <div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                             <span style="font-size:10px; background:rgba(255,255,255,0.05); color:var(--text-muted); padding:2px 8px; border-radius:20px; border:1px solid rgba(255,255,255,0.08);"><i class="fa-regular fa-calendar" style="margin-right:4px;"></i>${shortDate}</span>
                             ${parentBadgeHTML}
                             ${isCompleted ? '<span style="font-size:10px; background:rgba(46,213,115,0.15); color:#2ed573; padding:2px 10px; border-radius:20px; border:1px solid rgba(46,213,115,0.3); display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-circle-check"></i> Tamamlandı</span>' : ''}
                         </div>
                     </div>
                     <button class="cal-highlight-check-btn ${isCompleted ? 'done' : ''}" data-action="toggle-highlight-task" data-date="${hlDateStr}" title="${isCompleted ? 'Geri al' : 'Tamamla'}">
                         ${isCompleted ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-regular fa-circle-check"></i>'}
                     </button>
                 </div>
             </div>
         </li>`;
         });
 
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
                    
                    let checkIcon = isCompleted ? '<i class="fa-solid fa-circle-check" style="color: #2ed573; font-size: 16px;"></i>' : 
                                   (isFutureDate ? '<i class="fa-solid fa-lock" style="color: var(--text-muted); opacity: 0.6; font-size: 16px;"></i>' : '<i class="fa-regular fa-circle" style="color: var(--text-muted); font-size: 16px;"></i>');
 
                    habitsHTML += `
                    <div class="cal-habit-band-card ${isCompleted ? 'completed' : ''}" ${clickAttr} ${isFutureDate ? 'style="opacity:0.6; cursor:not-allowed;"' : ''}>
                        <div>${checkIcon}</div>
                        <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 500; ${isCompleted ? 'text-decoration:line-through; opacity:0.7;' : 'color:#fff;'}">${escapeHtml(habit.name)}</div>
                    </div>`;
                });
                calHabitsList.innerHTML = habitsHTML;
            } else {
                calHabitsBand.style.display = 'none';
                calHabitsList.innerHTML = '';
            }
        }
 
         // 3. GÖREVLERİ EKRANA YAZDIR
         html += dayEvents.map((ev) => {
             // F1.2 — Planlama milestone event'leri özel render
             if (ev.isMilestone) {
                 const msId = ev.id.replace('ms_cal_', '');
                 const mColor = ev.milestoneColor || '#a78bfa';
                 const planningGoals = (typeof FocusStorage !== 'undefined')
                     ? FocusStorage.get('planning_goals', [])
                     : JSON.parse(localStorage.getItem('planning_goals') || '[]');
                 let msDone = false;
                 for (const g of planningGoals) {
                     const ms = (g.milestones || []).find(m => m.id === msId);
                     if (ms) { msDone = !!ms.done; break; }
                 }
                 return `
                 <li class="cal-event-item${msDone ? ' completed' : ''}" style="--pColor:${mColor};">
                     <div class="tc-time-pill" style="color:${mColor};border-color:${mColor}44;">
                         <i class="fa-solid fa-flag-checkered"></i> Milestone
                     </div>
                     <div class="timeline-card" style="border-color:${mColor}33;">
                         <div class="tc-glow-bar" style="background:${mColor};"></div>
                         <div class="tc-inner">
                             <div class="tc-checkbox${msDone ? ' tc-checked' : ''}" style="${msDone ? 'background:'+mColor+';border-color:'+mColor+';' : 'border-color:'+mColor+';'}"
                                  data-action="toggle-planning-milestone" data-id="${ev.id}">
                                 ${msDone ? '<i class="fa-solid fa-check"></i>' : ''}
                             </div>
                             <div class="tc-content">
                                 <div class="tc-title${msDone ? ' tc-done' : ''}" style="color:${msDone ? 'rgba(255,255,255,.4)' : '#fff'};">${ev.text}</div>
                                 <div class="tc-meta">
                                     <span class="tc-badge" style="background:${mColor}18;color:${mColor};border:1px solid ${mColor}44;"><i class="fa-solid fa-flag-checkered"></i> Dönüm Noktası</span>
                                     <span class="tc-badge" style="cursor:pointer;opacity:.6;" data-action="switch-tab-planlama">Planlamaya Git →</span>
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
             const priorityLabel = priorityLabels[evPriority] || "Orta";

             const evDate = (globalTask && globalTask.date) ? globalTask.date : (ev._searchDate || check);
             const [d, m, y] = evDate.split('-'); // GÜNCELLEME: d, m, y sırasına alındı
             const shortDate = `${parseInt(d)} ${monthNamesShort[parseInt(m)-1]}`;

             let parentBadgeHTML = '';
             if (ev.parentHabit) {
                 const ph = getHabitsRef().find(h => String(h.id) === String(ev.parentHabit));
                 if (ph) parentBadgeHTML = `<span class="parent-habit-badge" style="font-size:10px; padding:2px 8px;"><i class="fa-solid fa-bullseye"></i> ${escapeHtml(ph.name)}</span>`;
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
                             <button class="tc-edit-btn" data-action="edit-task" data-id="${ev.id}" title="Düzenle"><i class="fa-solid fa-pen"></i></button>
                             <button class="tc-del-btn" data-action="delete-task" data-id="${ev.id}" data-date="${evDate}" title="Sil"><i class="fa-solid fa-trash-can"></i></button>
                         </div>
                     </div>
                 </div>
             </li>`;
         }).join('');
 
         window.eventList.innerHTML = html;
         _initCalEventListDnD(check);
     }
