// script-calendar-week-day-view.js
// script.js'ten çıkarıldı (Faz 6): Haftalık Görünüm + Günlük Görünüm + ikisi
// arasında paylaşılan yardımcılar (saat popover'ı, sürükleme "hayalet"
// görseli, görev taşıma) — TEK dosyada birleştirildi, çünkü paylaşılan
// yardımcılar (createCalDragGhost, openCalInlineAdd, iqa* fonksiyonları)
// iki görünümün de arasına serpiştirilmişti; ayrı dosyalara bölünselerdi
// birbirini import etmek zorunda kalırlardı.
//
// Köprüler:
//  - window.renderWeeklyView/renderDailyView: zaten `window.X = function`
//    deseniyle kendiliğinden dışa açıktı; script.js'in geri kalanındaki
//    10 bare çağrı noktası (calUnifiedPrev/Next/Today navigasyonu)
//    window.*'a çevrildi.
//  - window.createCalDragGhost/openCalInlineAdd: burada tanımlı, script.js'in
//    geri kalanı (script-calendar-month-view.js dahil) tarafından window.*
//    ile çağrılıyor.
//  - window.__getCurrentDateRef/__setCurrentDateRef, __getSelectedDateRef/
//    __setSelectedDateRef, __getTasksRef, __getCalendarEventsRef: script.js'te
//    zaten vardı (script-calendar-month-view.js ile aynı köprüler).
//  - window.CAL_HOUR_START/CAL_HOUR_END/DAY_NAMES_LOCAL/PRIORITY_DOT_COLOR:
//    script.js'te bu çıkarma için yeni eklendi.
//  - `GAP` sabiti: bu blokta tanımlı ama collab.js/social.js'in ONCE VAR OLAN
//    bir backlog bug'ı bunu bare bekliyor (check-cross-module-deps.py'de
//    zaten işaretliydi) — konumu değişti ama düzeltilmedi, kapsam dışı.

     // HAFTALIK GÖRÜNÜM
     // ────────────────────────────────────────────
     window.renderWeeklyView = function() {
         function computeChipColumns(evs) {
             const items = evs.map(ev => ({
                 ev,
                 start: window.timeToMins(ev.timeStart || '0:00'),
                 end:   window.timeToMins(ev.timeEnd   || '1:00'),
                 col: 0
             })).sort((a, b) => a.start - b.start);
             const colEnds = [];
             items.forEach(item => {
                 let c = 0;
                 while (colEnds[c] !== undefined && colEnds[c] > item.start) c++;
                 item.col = c;
                 colEnds[c] = item.end;
             });
             const totalCols = colEnds.length || 1;
             return items.map(item => ({ ev: item.ev, col: item.col, totalCols }));
         }
         const grid = document.getElementById('weekly-grid-inner');
         if (!grid) return;
         const weekStart = window.getWeekStart(window.__getSelectedDateRef());
         const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });
         const todayStr = window.formatDateToString(new Date());
         let html = '';
 
         // Köşe + Gün başlıkları
         html += `<div class="weekly-corner"></div>`;
         days.forEach((d, i) => {
             const ds = window.formatDateToString(d);
             const isToday = ds === todayStr;
            html += `<div class="weekly-day-header${isToday ? ' today-col' : ''}" data-action="weekly-day-header-click" data-date="${ds}" style="cursor:pointer;">
                 <div class="wdh-name">${window.DAY_NAMES_LOCAL[i]}</div>
                 <div class="wdh-num">${d.getDate()}</div>
             </div>`;
         });
 
         // Saat satırları
         for (let h = window.CAL_HOUR_START; h <= window.CAL_HOUR_END; h++) {
             html += `<div class="weekly-hour-label">${String(h).padStart(2,'0')}:00</div>`;
             days.forEach(d => {
                 const ds = window.formatDateToString(d);
                 
                 // ── GERÇEK TEK PARÇA TAŞMA MOTORU (HAFTALIK) ──
                 let cellEvs = [];
                 
                 // Bugün bu saatte başlayan planlar (Aşağı doğru tek parça akar)
                 (window.__getCalendarEventsRef()[ds] || []).filter(ev => !ev.isLessonPlanDraft).forEach(ev => {
                     const startH = parseInt((ev.timeStart || '0:00').split(':')[0]);
                     if (startH === h) {
                         let startMins = window.timeToMins(ev.timeStart || '0:00');
                         let endMins = ev.isOvernight ? 1440 : window.timeToMins(ev.timeEnd || '0:00');
                         let duration = endMins - startMins;
                         cellEvs.push({
                             ...ev,
                             _cTopPx: Math.round(((startMins % 60) / 60) * 60),
                             _cHeightPx: Math.max(20, Math.round((duration / 60) * 60))
                         });
                     }
                 });
 
                 // Dünden sarkan planlar (Sadece yeni günün 00:00 hücresine tek parça blok olarak enjekte edilir)
                 if (h === 0) {
                     let prevD = new Date(d);
                     prevD.setDate(prevD.getDate() - 1);
                     let prevDs = window.formatDateToString(prevD);
                     (window.__getCalendarEventsRef()[prevDs] || []).filter(ev => !ev.isLessonPlanDraft).forEach(ev => {
                         if (ev.isOvernight) {
                             let endMins = window.timeToMins(ev.timeEnd || '0:00');
                             cellEvs.push({
                                 ...ev,
                                 _cTopPx: 0,
                                 _cHeightPx: Math.max(20, Math.round((endMins / 60) * 60))
                             });
                         }
                     });
                 }
 
                 html += `<div class="weekly-hour-cell" data-date="${ds}" data-hour="${h}"
                   data-action="weekly-hour-cell-click" style="position: relative; overflow: visible !important;">`;
                     
                     const chipLayouts = computeChipColumns(cellEvs);
                     chipLayouts.forEach(({ ev, col, totalCols }) => {
                         const t = window.__getTasksRef().find(t => String(t.id) === String(ev.id));
                         const done = t && t.completed;
                         const cc = getTaskColor(t);
                         const prioColor = window.PRIORITY_DOT_COLOR[ev.priority || 'medium'];
                         const chipTime = [ev.timeStart, ev.timeEnd].filter(Boolean).join(' → ');

                         const cTopPx     = ev._cTopPx;
                         const cHeightPx  = ev._cHeightPx;
                         const showActions = cHeightPx >= 52;
                         const colW    = 100 / totalCols;
                         const colLeft = col * colW;
                         const GAP     = totalCols > 1 ? 1 : 0;

                         const isTall = cHeightPx >= 52;
                         const chipBorderColor = done ? '#2ed573' : cc.border;
                         const chipBg          = done ? 'rgba(46,213,115,0.18)' : cc.bg;
                         const chipGlow        = done ? 'rgba(46,213,115,0.15)' : cc.glow;
                         html += `<div class="weekly-event-chip${done?' completed':''}"
                             draggable="true"
                             data-drag-id="${ev.id}" data-drag-date="${ds}"
                            data-action="weekly-chip-noop"
                             title="${ev.text}${chipTime?' · '+chipTime:''}${cc.isGoal?' 🎯 '+cc.label:''}"
                             style="position:absolute;z-index:10;top:${cTopPx}px;height:${cHeightPx}px;min-height:18px;left:calc(${colLeft}% + ${GAP}px);width:calc(${colW}% - ${GAP*2}px);background:${chipBg};border-left-color:${chipBorderColor};box-shadow:0 3px 10px ${chipGlow};${(cc.isGoal&&!done)?'border-left-width:5px;':''}"
                             >
                             ${done
                                 ? `<span class="wec-done-badge"><i class="fa-solid fa-check"></i></span>`
                                 : `<span class="wec-cat-dot" style="background:${prioColor};" title="${cc.label} · ${ev.priority || 'medium'}"></span>`}
                             ${cc.isGoal && !done ? `<span class="wec-goal-badge" title="${cc.label}"><i class="fa-solid fa-mountain-sun"></i></span>` : ''}
                             ${isTall && chipTime ? `<span class="wec-time${done?' wec-time-done':''}">${done?'':' <i class="fa-regular fa-clock"></i>'} ${chipTime}</span>` : ''}
                             <span class="wec-title" style="${!isTall && chipTime ? 'font-size:9px;' : ''}">${!isTall && chipTime ? chipTime + ' · ' : ''}${ev.text}</span>
                             ${showActions ? `<div class="wec-actions">
                                <button class="wec-btn${done?' wec-done':''}" data-action="weekly-chip-toggle" data-id="${ev.id}">
                                     <i class="fa-solid fa-${done?'rotate-left':'check'}"></i> ${done?'Geri Al':'Tamam'}
                                 </button>
                                <button class="wec-btn" data-action="weekly-chip-edit" data-id="${ev.id}">
                                     <i class="fa-solid fa-pen"></i> Düzenle
                                 </button>
                             </div>` : ''}
                         </div>`;
                     });
                 html += `</div>`;
             });
         }
         grid.innerHTML = html;
 
         // Şimdiki zaman çizgisi — sadece bugünün kolonunda
         const now = new Date();
         const nowDateStr = window.formatDateToString(now);
         const nowH = now.getHours();
         if (nowH >= window.CAL_HOUR_START && nowH <= window.CAL_HOUR_END) {
             const nowMinPx = Math.round((now.getMinutes() / 60) * 60);
             const todayCell = grid.querySelector(`.weekly-hour-cell[data-date="${nowDateStr}"][data-hour="${nowH}"]`);
             if (todayCell) {
                 const line = document.createElement('div');
                 line.className = 'weekly-now-line';
                 line.style.top = `${nowMinPx}px`;
                 const timeLabel = document.createElement('span');
                 timeLabel.className = 'weekly-now-time';
                 timeLabel.textContent = `${String(nowH).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
                 line.appendChild(timeLabel);
                 todayCell.appendChild(line);
             }

             // Haftalık grid açılınca mevcut saate scroll et
             const labelH = 44;
             const hourH  = 60;
             const scrollTop = labelH + nowH * hourH - grid.clientHeight / 3;
             grid.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
         }
         window.updateCalUnifiedTitle();
     };
 
     window.weeklyDayHeaderClick = function(ds) {
         const [d,m,y] = ds.split('-').map(Number);
         window.__setSelectedDateRef(new Date(y, m-1, d));
         window.__setCurrentDateRef(new Date(y, m-1, d));
         window.switchCalView('daily');
     };

     // ──────────────────────────────────────────────
     // INLINE QUICK ADD — hücreye tıklayınca popup
     // ──────────────────────────────────────────────
     let _iqaEl = null;
     let _iqaDs = null, _iqaH = null;
     let _iqaCloseTimer = null;
     let _iqaJustOpened = false; // mousedown/click sırası race condition koruması
     let _iqaTimePopoverEl = null;
     function iqaCloseTimePopover() {
         if (_iqaTimePopoverEl) {
             _iqaTimePopoverEl.remove();
             _iqaTimePopoverEl = null;
             document.removeEventListener('mousedown', iqaTimePopoverOutsideClick, true);
         }
     }
     function iqaTimePopoverOutsideClick(e) {
         if (_iqaTimePopoverEl && !_iqaTimePopoverEl.contains(e.target) && e.target.id !== 'iqa-start' && e.target.id !== 'iqa-end') {
             iqaCloseTimePopover();
         }
     }

     function buildIqaEl() {
         if (_iqaEl) return;
         _iqaEl = document.createElement('div');
         _iqaEl.id = 'cal-iqa';
         _iqaEl.innerHTML = `
             <div class="iqa-header">
                 <span class="iqa-time-badge" id="iqa-time-badge"></span>
                 <button class="iqa-close" id="iqa-close">×</button>
             </div>
             <input type="text" id="iqa-input" class="iqa-input" placeholder="Görev adını yaz…">
             <div class="iqa-row">
                 <div class="iqa-time-range">
                     <input type="text" id="iqa-start" class="iqa-time-inp" readonly autocomplete="off">
                     <span class="iqa-arr">→</span>
                     <input type="text" id="iqa-end" class="iqa-time-inp" readonly autocomplete="off">
                 </div>
             </div>
             <div class="iqa-row">
                 <select id="iqa-priority" class="iqa-select">
                     <option value="high">🔴 Yüksek</option>
                     <option value="medium" selected>🟡 Orta</option>
                     <option value="low">🟢 Düşük</option>
                 </select>
                 <select id="iqa-category" class="iqa-select"></select>
             </div>
             <button id="iqa-save" class="iqa-save-btn"><i class="fa-solid fa-plus"></i> Ekle</button>`;
         document.body.appendChild(_iqaEl);

         // Kategori seçeneklerini doldur
         function fillIqaCats() {
             const sel = document.getElementById('iqa-category');
             if (!sel) return;
             sel.innerHTML = '';
             const cats = [
                 { id: 'kisisel', name: 'Kişisel' }, { id: 'is', name: 'İş' },
                 { id: 'egitim', name: 'Eğitim' }, { id: 'saglik', name: 'Sağlık' }
             ];
             cats.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; sel.appendChild(o); });
         }
         fillIqaCats();

         // Saat kutuları: aylık görünümdeki gün detay panelindeki (cdd-time-*)
         // ile aynı görsel dilde, tıklayınca açılan 15dk aralıklı özel liste.
         function iqaOpenTimePopover(inputEl) {
             iqaCloseTimePopover();
             const pop = document.createElement('div');
             pop.className = 'cdd-time-popover';
             const currentVal = inputEl.value;
             for (let h = 0; h < 24; h++) {
                 for (let m = 0; m < 60; m += 15) {
                     const t = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                     const item = document.createElement('div');
                     item.className = 'cdd-time-popover-item' + (t === currentVal ? ' active' : '');
                     item.textContent = t;
                     item.addEventListener('mousedown', (e) => {
                         e.preventDefault();
                         inputEl.value = t;
                         inputEl.dispatchEvent(new Event('change'));
                         iqaCloseTimePopover();
                     });
                     pop.appendChild(item);
                 }
             }
             document.body.appendChild(pop);
             const r = inputEl.getBoundingClientRect();
             let popLeft = r.left;
             if (popLeft + 88 > window.innerWidth - 8) popLeft = window.innerWidth - 96;
             pop.style.left = popLeft + 'px';
             pop.style.top = (r.bottom + 4) + 'px';
             _iqaTimePopoverEl = pop;
             const activeItem = pop.querySelector('.cdd-time-popover-item.active');
             if (activeItem) activeItem.scrollIntoView({ block: 'center' });
             setTimeout(() => document.addEventListener('mousedown', iqaTimePopoverOutsideClick, true), 0);
         }
         document.getElementById('iqa-start').addEventListener('click', function() { iqaOpenTimePopover(this); });
         document.getElementById('iqa-end').addEventListener('click', function() { iqaOpenTimePopover(this); });

         // Bitiş saati otomatik +1h, zaman rozetini güncelle
         document.getElementById('iqa-start').addEventListener('change', function() {
             document.getElementById('iqa-end').value = window.addOneHour(this.value);
             document.getElementById('iqa-time-badge').textContent = `${this.value} – ${document.getElementById('iqa-end').value}`;
         });
         document.getElementById('iqa-end').addEventListener('change', function() {
             document.getElementById('iqa-time-badge').textContent = `${document.getElementById('iqa-start').value} – ${this.value}`;
         });

         // Kaydet
         function saveIqa() {
             const text = document.getElementById('iqa-input').value.trim();
             if (!text) { document.getElementById('iqa-input').focus(); return; }
             const start = document.getElementById('iqa-start').value || `${String(_iqaH).padStart(2,'0')}:00`;
             const end   = document.getElementById('iqa-end').value   || window.addOneHour(start);
             const prio  = document.getElementById('iqa-priority').value;
             const cat   = document.getElementById('iqa-category').value;
             addGlobalTask(text, prio, cat, _iqaDs, start, end, '', '');
             closeCalInlineAdd();
             if (currentCalView === 'weekly') window.renderWeeklyView();
             else if (currentCalView === 'daily') window.renderDailyView();
             window.renderCalendar();
         }

         document.getElementById('iqa-save').addEventListener('click', saveIqa);
         document.getElementById('iqa-close').addEventListener('click', closeCalInlineAdd);
         document.getElementById('iqa-input').addEventListener('keydown', function(e) {
             if (e.key === 'Enter') { e.preventDefault(); saveIqa(); }
             if (e.key === 'Escape') closeCalInlineAdd();
         });

         // Dışarı tıklayınca kapat — ama aynı tıklamanın açtığı popup'ı hemen kapatma
         // Not: saat popover'ı document.body'ye eklendiği (iqaEl'in dışında olduğu)
         // için onu da hariç tutuyoruz, yoksa saat seçince tüm kutu kapanıyordu.
         document.addEventListener('mousedown', function(e) {
             if (_iqaJustOpened) return; // bu mousedown, popup'ı açan tıklamanın kendisi
             if (_iqaTimePopoverEl && _iqaTimePopoverEl.contains(e.target)) return;
             if (_iqaEl && _iqaEl.style.display === 'flex' && !_iqaEl.contains(e.target)) {
                 closeCalInlineAdd();
             }
         }, true);
     }

     window.openCalInlineAdd = (ds, h, anchorEl, clickEvent) => openCalInlineAdd(ds, h, anchorEl, clickEvent); // Faz 6: script-calendar-week-day-view.js için
    function openCalInlineAdd(ds, h, anchorEl, clickEvent) {
         // Bekleyen close-timeout'u iptal et (mousedown→click race condition)
         if (_iqaCloseTimer) { clearTimeout(_iqaCloseTimer); _iqaCloseTimer = null; }
         // Bu tıklamanın mousedown'ının popup'ı kapatmasını engelle
         _iqaJustOpened = true;
         setTimeout(() => { _iqaJustOpened = false; }, 0);

         buildIqaEl();
         _iqaDs = ds;
         _iqaH  = h;

         const hStr = String(h).padStart(2, '0');
         const startVal = `${hStr}:00`;
         const endVal   = window.addOneHour(startVal);
         document.getElementById('iqa-time-badge').textContent = `${hStr}:00 – ${endVal}`;
         document.getElementById('iqa-start').value = startVal;
         document.getElementById('iqa-end').value   = endVal;
         document.getElementById('iqa-input').value = '';
         document.getElementById('iqa-priority').value = 'medium';

         // Pozisyonla: anchor'ın altına veya üstüne
         _iqaEl.style.display = 'flex';
         _iqaEl.style.opacity = '0';
         _iqaEl.style.transform = 'scale(0.95) translateY(-6px)';

         if (anchorEl) {
             const rect = anchorEl.getBoundingClientRect();
             const popW = 370, popH = 210;
             // Hücrenin (özellikle günlük görünümde tek geniş sütun olduğu için)
             // sol kenarına değil, tıklanan noktanın etrafına ortalanır.
             const clickX = (clickEvent && typeof clickEvent.clientX === 'number' && clickEvent.clientX > 0)
                 ? clickEvent.clientX
                 : (rect.left + rect.width / 2);
             let top  = rect.bottom + 6;
             let left = clickX - popW / 2;
             if (top + popH > window.innerHeight - 12) top = rect.top - popH - 6;
             if (left + popW > window.innerWidth  - 12) left = window.innerWidth - popW - 12;
             if (left < 8) left = 8;
             _iqaEl.style.top  = `${top + window.scrollY}px`;
             _iqaEl.style.left = `${left}px`;
         } else {
             _iqaEl.style.top  = '50%';
             _iqaEl.style.left = '50%';
             _iqaEl.style.transform = 'translate(-50%,-50%) scale(0.95)';
         }

         requestAnimationFrame(() => {
             _iqaEl.style.transition = 'opacity 0.18s, transform 0.18s';
             _iqaEl.style.opacity = '1';
             _iqaEl.style.transform = anchorEl ? 'scale(1) translateY(0)' : 'translate(-50%,-50%) scale(1)';
             document.getElementById('iqa-input').focus();
         });
     }

     function closeCalInlineAdd() {
         if (!_iqaEl) return;
         iqaCloseTimePopover();
         if (_iqaCloseTimer) clearTimeout(_iqaCloseTimer);
         _iqaEl.style.transition = 'opacity 0.15s, transform 0.15s';
         _iqaEl.style.opacity = '0';
         _iqaEl.style.transform = 'scale(0.95) translateY(-4px)';
         _iqaCloseTimer = setTimeout(() => {
             if (_iqaEl) _iqaEl.style.display = 'none';
             _iqaCloseTimer = null;
         }, 160);
     }

     window.weeklyHourCellClick = function(ds, h, event) {
         if (event) event.stopPropagation();
         // currentTarget inline onclick'te null gelebilir, target güvenli fallback
         const cell = (event && (event.currentTarget || event.target)) || null;
         openCalInlineAdd(ds, h, cell, event);
     };
 
     // — Premium Drag Ghost Oluşturucu —
     window.createCalDragGhost = (text, timeStart, timeEnd, priority) => createCalDragGhost(text, timeStart, timeEnd, priority); // Faz 6: script-calendar-week-day-view.js için
    function createCalDragGhost(text, timeStart, timeEnd, priority) {
         const ghost = document.createElement('div');
         ghost.className = `cal-drag-ghost ghost-${priority || 'medium'}`;
         const timeStr = timeStart ? `⏱ ${timeStart}${timeEnd ? ' → ' + timeEnd : ''}` : '';
         ghost.innerHTML = `
             <div class="ghost-bar"></div>
             <div class="ghost-time">${timeStr}</div>
             <div class="ghost-title">${escapeHtml(text)}</div>
             <i class="fa-solid fa-grip-dots-vertical ghost-icon"></i>`;
         document.body.appendChild(ghost);
         setTimeout(() => ghost.remove(), 0);
         return ghost;
     }
 
     // ── Drag-and-Drop: global durum & yardımcılar ──
     let _calDragId = null;

     // window.snap15 → script-calendar-date-utils.js dosyasına taşındı.

     // Hücre üzerinde sürüklerken 15dk-snap önizlemesi
     window.calDragOver = function(e, cellEl, h, hourPx) {
         e.preventDefault();
         e.dataTransfer.dropEffect = 'move';
         cellEl.classList.add('drag-over');
         if (!_calDragId) return;

         const snapMins = window.snap15((e.offsetY / hourPx) * 60);
         const task = window.__getTasksRef().find(t => String(t.id) === String(_calDragId));
         if (!task) return;

         const durMins = Math.max(30, window.timeToMins(task.timeEnd || '13:00') - window.timeToMins(task.timeStart || '12:00'));
         const startTotal = h * 60 + snapMins;
         const endTotal   = Math.min(24 * 60, startTotal + durMins);
         const endH = Math.floor(endTotal / 60), endM = endTotal % 60;
         const timeStr = `${String(h).padStart(2,'0')}:${String(snapMins).padStart(2,'0')} → ${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`;

         document.querySelectorAll('.cal-drop-preview').forEach(p => {
             if (p.parentElement !== cellEl) p.remove();
         });

         let preview = cellEl.querySelector('.cal-drop-preview');
         if (!preview) {
             preview = document.createElement('div');
             preview.className = 'cal-drop-preview';
             cellEl.appendChild(preview);
         }
         if (preview._leaveTimer) { clearTimeout(preview._leaveTimer); preview._leaveTimer = null; }

         const cc = getTaskColor(task);
         const previewH = Math.max(20, Math.min((durMins / 60) * hourPx, hourPx * 4));
         preview.style.top    = `${(snapMins / 60) * hourPx}px`;
         preview.style.height = `${previewH}px`;
         preview.style.borderColor  = cc.border;
         preview.style.background   = cc.bg.replace(/[\d.]+\)$/, '0.22)');
         preview.textContent = timeStr;
     };

     window.calDragLeave = function(cellEl) {
         cellEl.classList.remove('drag-over');
         const p = cellEl.querySelector('.cal-drop-preview');
         if (p) p._leaveTimer = setTimeout(() => { if (p.parentElement === cellEl) p.remove(); }, 80);
     };

     window.calDragEnd = function() {
         _calDragId = null;
         document.querySelectorAll('.cal-drop-preview').forEach(p => p.remove());
         document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
     };

     window.weeklyChipDragStart = function(e, id, ds) {
         e.dataTransfer.setData('taskId', id);
         e.dataTransfer.setData('sourceDate', ds);
         e.stopPropagation();
         _calDragId = id;
         const ev = (window.__getCalendarEventsRef()[ds] || []).find(x => String(x.id) === String(id));
         if (ev) {
             const ghost = createCalDragGhost(ev.text, ev.timeStart, ev.timeEnd, ev.priority);
             e.dataTransfer.setDragImage(ghost, 110, 28);
         }
     };

     window.weeklyChipToggle = function(id) {
         toggleTask(id);
         setTimeout(window.renderWeeklyView, 120);
     };

     window.weeklyDropHandler = function(e, targetDate, targetHour) {
         const id = e.dataTransfer.getData('taskId');
         const srcDate = e.dataTransfer.getData('sourceDate');
         calDragEnd();
         if (id) {
             const snapMins = window.snap15((e.offsetY / 60) * 60);
             premiumMoveTask(id, srcDate, targetDate, targetHour, snapMins);
         }
     };
 
     // ────────────────────────────────────────────
     // GÜNLÜK GÖRÜNÜM
     // ────────────────────────────────────────────
     window.renderDailyView = function() {
         const grid = document.getElementById('daily-timeline-grid');
         const titleEl = document.getElementById('daily-view-date-title');
         const countEl = document.getElementById('daily-event-count');
         if (!grid) return;
 
         const dateStr = window.formatDateToString(window.__getSelectedDateRef());
         const todayStr = window.formatDateToString(new Date());
         const now = new Date();
         const dayEvs = (window.__getCalendarEventsRef()[dateStr] || []).filter(e => !e.isLessonPlanDraft);
 
         if (titleEl) titleEl.textContent = window.__getSelectedDateRef().toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
         if (countEl) countEl.textContent = `${dayEvs.length} Plan`;
 
         // İlerleme halkası
         const ringWrap = document.getElementById('daily-ring-wrap');
         const ringCircle = document.getElementById('daily-ring-circle');
         const ringText = document.getElementById('daily-ring-text');
         if (ringWrap) {
             if (dayEvs.length > 0) {
                 ringWrap.style.display = 'block';
                 const done = dayEvs.filter(ev => { const t = window.__getTasksRef().find(t => String(t.id) === String(ev.id)); return t && t.completed; }).length;
                 const pct = Math.round((done / dayEvs.length) * 100);
                 if (ringCircle) { ringCircle.style.strokeDashoffset = 113.1 - (pct / 100) * 113.1; ringCircle.style.stroke = pct === 100 ? '#2ed573' : '#ff9f43'; }
                 if (ringText) ringText.textContent = pct + '%';
             } else { ringWrap.style.display = 'none'; }
         }
 
         let html = '';
         for (let h = 0; h <= 23; h++) {
             const hLabel = String(h).padStart(2,'0') + ':00';
             const isNowHour = (dateStr === todayStr && h === now.getHours());
             const nowPct = isNowHour ? (now.getMinutes() / 60) * 100 : -1;
             
             // ── GERÇEK TEK PARÇA TAŞMA MOTORU (GÜNLÜK) ──
             let cellEvs = [];
             
             // Bugün bu saatte başlayan planlar
             dayEvs.forEach(ev => {
                 const startH = parseInt((ev.timeStart || '0:00').split(':')[0]);
                 if (startH === h) {
                     let startMins = window.timeToMins(ev.timeStart || '0:00');
                     let endMins = ev.isOvernight ? 1440 : window.timeToMins(ev.timeEnd || '0:00');
                     let duration = endMins - startMins;
                     cellEvs.push({
                         ...ev,
                         _cTopPx: Math.round(((startMins % 60) / 60) * 76),
                         _cHeightPx: Math.max(28, Math.round((duration / 60) * 76))
                     });
                 }
             });
 
             // Dünden sarkan planlar (Sadece gece yarısı 00:00 hücresine tek parça olarak çizilir)
             if (h === 0) {
                 let prevDate = new Date(window.__getSelectedDateRef());
                 prevDate.setDate(prevDate.getDate() - 1);
                 const prevCheck = window.formatDateToString(prevDate);
                 (window.__getCalendarEventsRef()[prevCheck] || []).filter(ev => !ev.isLessonPlanDraft).forEach(ev => {
                     if (ev.isOvernight) {
                         let endMins = window.timeToMins(ev.timeEnd || '0:00');
                         cellEvs.push({
                             ...ev,
                             _cTopPx: 0,
                             _cHeightPx: Math.max(28, Math.round((endMins / 60) * 76))
                         });
                     }
                 });
             }
 
             html += `<div class="daily-hour-label">${hLabel}</div>`;
             html += `<div class="daily-hour-cell${isNowHour?' is-now':''}" data-date="${dateStr}" data-hour="${h}"
                data-action="daily-hour-cell-click" style="position: relative; overflow: visible !important;">`;
 
             if (isNowHour) html += `<div class="daily-now-indicator" style="top:${nowPct}%"><span class="daily-now-time">${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}</span></div>`;
 
             cellEvs.forEach(ev => {
                 const t = window.__getTasksRef().find(t => String(t.id) === String(ev.id));
                 const done = t && t.completed;
                 const cc = getTaskColor(t);
                 const prioColor = window.PRIORITY_DOT_COLOR[ev.priority || 'medium'];
                 const tStart = ev.timeStart || hLabel;
                 const tEnd = ev.timeEnd || '';

                 const topPx = ev._cTopPx;
                 const hPx = ev._cHeightPx;

                 const debBg     = done ? 'rgba(46,213,115,0.15)' : cc.bg;
                 const debBorder = done ? '#2ed573' : cc.border;
                 const debGlow   = done ? 'rgba(46,213,115,0.12)' : cc.glow;

                 html += `<div class="daily-event-block${done?' completed':''}"
                     draggable="true"
                     data-drag-id="${ev.id}" data-drag-date="${dateStr}"
                     data-action="daily-block-noop"
                     title="${ev.text}${cc.isGoal?' · 🎯 '+cc.label:''}"
                     style="position:absolute;z-index:10;left:8px;right:8px;width:auto;top:${topPx}px;height:${hPx}px;background:${debBg};border-left-color:${debBorder};box-shadow:0 4px 14px ${debGlow};${(cc.isGoal&&!done)?'border-left-width:5px;':''}">
                     ${done
                         ? `<span class="deb-done-badge"><i class="fa-solid fa-check-double"></i></span>`
                         : `<span class="deb-prio-dot" style="background:${prioColor};" title="${cc.label}"></span>`}
                     ${cc.isGoal && !done ? `<span class="deb-goal-badge" title="${cc.label}"><i class="fa-solid fa-mountain-sun"></i></span>` : ''}
                     <div class="deb-inner">
                         <div class="deb-header">
                              <div class="deb-check${done?' done':''}" data-action="daily-toggle-task" data-id="${ev.id}">
                                 ${done?'<i class="fa-solid fa-check"></i>':''}
                             </div>
                             <div class="deb-title">${ev.text}</div>
                         </div>
                         ${hPx > 44 ? `<div class="deb-time${done?' deb-time-done':''}"><i class="fa-regular fa-clock"></i> ${tStart}${tEnd?' → '+tEnd:''}</div>` : ''}
                     </div>
                    <button class="deb-edit" data-action="daily-edit-task" data-id="${ev.id}" title="Düzenle">
                         <i class="fa-solid fa-pen"></i>
                     </button>
                    <button class="deb-del" data-action="daily-delete-task" data-id="${ev.id}" data-date="${dateStr}" title="Sil">
                         <i class="fa-solid fa-xmark"></i>
                     </button>
                 </div>`;
             });
             html += `</div>`;
         }
 
         grid.innerHTML = html;
 
         // İlk etkinliğe veya şimdiki saate kaydır
         setTimeout(() => {
             const target = grid.querySelector('.daily-event-block') || grid.querySelector('.daily-hour-cell.is-now');
             if (target) target.scrollIntoView({ behavior:'smooth', block:'center' });
         }, 100);
 
         window.updateCalUnifiedTitle();
     };
 
     window.dailyHourCellClick = function(h, event) {
         if (event) event.stopPropagation();
         const ds = window.formatDateToString(window.__getSelectedDateRef());
         const cell = (event && (event.currentTarget || event.target)) || null;
         openCalInlineAdd(ds, h, cell, event);
     };
 
     window.dailyChipDragStart = function(e, id, ds) {
         e.dataTransfer.setData('taskId', id);
         e.dataTransfer.setData('sourceDate', ds);
         e.stopPropagation();
         _calDragId = id;
         const ev = (window.__getCalendarEventsRef()[ds] || []).find(x => String(x.id) === String(id));
         if (ev) {
             const ghost = createCalDragGhost(ev.text, ev.timeStart, ev.timeEnd, ev.priority);
             e.dataTransfer.setDragImage(ghost, 110, 28);
         }
     };

     window.dailyDropHandler = function(e, targetDate, targetHour) {
         const id = e.dataTransfer.getData('taskId');
         const srcDate = e.dataTransfer.getData('sourceDate');
         calDragEnd();
         if (id) {
             const snapMins = window.snap15((e.offsetY / 64) * 60);
             premiumMoveTask(id, srcDate, targetDate, targetHour, snapMins);
         }
     };
 
     // Görevi yeni tarih+saate taşı
     function premiumMoveTask(id, oldDate, newDate, newHour, snapMins) {
         const task = window.__getTasksRef().find(t => String(t.id) === String(id));
         if (!task) return;
         const oldDateStr = oldDate || task.date;
         snapMins = snapMins || 0;

         // Aynı konuma bırakıldıysa işlem yapma
         const oldStartM = window.timeToMins(task.timeStart || '12:00');
         if (oldDateStr === newDate && Math.floor(oldStartM / 60) === newHour && (oldStartM % 60) === snapMins) return;

         const newStartTotal = newHour * 60 + snapMins;
         const newStart = `${String(newHour).padStart(2,'0')}:${String(snapMins).padStart(2,'0')}`;
         const oldEndM = window.timeToMins(task.timeEnd || '13:00');
         const durMins = Math.max(30, oldEndM - oldStartM);
         const newEndTotal = Math.min(23 * 60 + 59, newStartTotal + durMins);
         const newEnd = `${String(Math.floor(newEndTotal / 60)).padStart(2,'0')}:${String(newEndTotal % 60).padStart(2,'0')}`;

         task.date = newDate;
         task.timeStart = newStart;
         task.timeEnd = newEnd;

         if (window.__getCalendarEventsRef()[oldDateStr]) {
             window.__getCalendarEventsRef()[oldDateStr] = window.__getCalendarEventsRef()[oldDateStr].filter(e => String(e.id) !== String(id));
             if (!window.__getCalendarEventsRef()[oldDateStr].length) delete window.__getCalendarEventsRef()[oldDateStr];
         }
         if (!window.__getCalendarEventsRef()[newDate]) window.__getCalendarEventsRef()[newDate] = [];
         window.__getCalendarEventsRef()[newDate] = window.__getCalendarEventsRef()[newDate].filter(e => String(e.id) !== String(id));
         window.__getCalendarEventsRef()[newDate].push({ id: task.id, text: task.text, timeStart: newStart, timeEnd: newEnd, priority: task.priority, parentHabit: task.parentHabit || '' });

         saveTasks();
         window.renderCalendar();
         if (currentCalView === 'weekly') window.renderWeeklyView();
         else if (currentCalView === 'daily') window.renderDailyView();

         showPremiumModal({ title: 'Plan Taşındı 🗓️', message: `"${escapeHtml(task.text)}" → ${newDate} ${newStart} – ${newEnd}`, type: 'success' });
     }
