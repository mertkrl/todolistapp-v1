// ============================================================
// FOCUSAI SCRIPT-JOURNAL-LIBRARY.JS
// script.js'ten çıkarılmış "Günlük" (foto-takvim / kitap görünümü) modülü —
// aylık kitap sayfaları, not defteri (ZK) modalları, kitap detay penceresi.
//
// ÖNEMLİ — bu dosya BİLİNÇLİ OLARAK document.addEventListener('DOMContentLoaded', ...)
// İLE SARILMAMIŞTIR (diğer script-*.js çıkarmalarının aksine): script.js'in
// kendi DOMContentLoaded handler'ı içinde (satır ~10322) `renderJournalRef =
// buildMassiveLibraryRows;` ataması var — bu satır script.js'in DOMContentLoaded
// handler'ı çalışırken, yani bu dosyanın senkron <script> etiketi çoktan
// parse/çalıştırılmış OLMASI gerektiği bir zamanda çalışır. Eğer bu dosyayı da
// DOMContentLoaded'a sarsaydık, script.js'inki ÖNCE kayıtlı olduğu için önce
// çalışır ve bizim window.buildMassiveLibraryRows'umuz henüz set edilmemiş
// olurdu — renderJournalRef undefined kalır, "Günlük" sekmesi bir daha hiç
// otomatik yenilenmezdi. Senkron (sarmalayıcısız) çalıştırarak bu atamadan
// ÖNCE window.buildMassiveLibraryRows'un hazır olması garantilenir.
// Bu dosyanın kendi DOM erişimleri sadece fonksiyon gövdelerinde (kullanıcı
// etkileşimiyle sonra çağrılır), üst seviyede değil — bu yüzden senkron
// çalışmak (script.js'ten sonra, body sonunda) güvenlidir.
// ============================================================
import { FocusStorage } from './storage-manager.js';

(function () {
'use strict';

 // === PREMIUM FOTO-TAKVİM TABANLI ZİHİN KÜTÜPHANESİ MANTIĞI ===

 // Tarih format utility: günlük YYYY-MM-DD → görev/alışkanlık storage DD-MM-YYYY
 function journalDateToStorageKey(isoDate) {
     const parts = isoDate.split('-');
     return (parts.length === 3 && parts[0].length === 4)
         ? `${parts[2]}-${parts[1]}-${parts[0]}`
         : isoDate;
 }

 // Kitap Detay Penceresini Salt Okunur veya Düzenlenebilir Açma Sihirbazı
 function openGrandBookDetails(entry, isPast) {
     const modal = document.getElementById("book-detail-modal");
     if (!modal) return;
 
     let longDate = entry.date;
     try {
         longDate = new Date(entry.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
     } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
 
     document.getElementById("book-detail-heading").textContent = longDate;
     document.getElementById("book-detail-cover-date").textContent = entry.date;
     document.getElementById("book-detail-achieve").textContent = entry.achieve || "-";
     document.getElementById("book-detail-improve").textContent = entry.improve || "-";

     // --- O Günün İstatistikleri ---
    try {
        const _dateStr = journalDateToStorageKey(entry.date);
        function _setVal(el, value) {
            if (!el) return;
            if (!value) { el.textContent = '—'; el.classList.add('is-empty'); el.style.color = ''; }
            else        { el.textContent = value; el.classList.remove('is-empty'); }
        }

        const _allTasks = FocusStorage.get('tasks', []);
        const _dayTasks = _allTasks.filter(t => t.date === _dateStr);
        const tasksEl = document.getElementById('book-stat-tasks-val');
        _setVal(tasksEl, _dayTasks.length > 0 ? `${_dayTasks.filter(t=>t.completed).length}/${_dayTasks.length}` : null);

        const _focusMin = (FocusStorage.get('focus_history', {}))[_dateStr] || 0;
        const focusTxt = _focusMin >= 60 ? `${Math.floor(_focusMin/60)}s ${_focusMin%60}dk` : _focusMin > 0 ? `${_focusMin}dk` : null;
        _setVal(document.getElementById('book-stat-focus-val'), focusTxt);

        const _allHabits = FocusStorage.get('habits', []);
        const habitsEl = document.getElementById('book-stat-habits-val');
        if (habitsEl) {
            habitsEl.innerHTML = '';
            if (!_allHabits.length) {
                const e = document.createElement('span'); e.className = 'bsi-value is-empty'; e.textContent = '—'; habitsEl.appendChild(e);
            } else {
                _allHabits.forEach(h => {
                    const b = document.createElement('span');
                    b.className = 'bsi-habit-badge ' + (h.history && h.history[_dateStr] ? 'done' : 'missed');
                    b.textContent = h.name || h.title;
                    habitsEl.appendChild(b);
                });
            }
        }

        const _hl = (FocusStorage.get('highlight_history', {}))[_dateStr];
        const hlEl = document.getElementById('book-stat-highlight-val');
        const hlText = _hl && (_hl.text || _hl.title) ? (_hl.text || _hl.title) : null;
        _setVal(hlEl, hlText);
        if (hlEl && hlText) hlEl.style.color = _hl.completed ? '#2ed573' : '#ff4757';
    } catch(e) {
        console.error("Kitap istatistikleri yüklenirken hata:", e);
    }

 
     // TALİMAT GEREĞİ: Kitap geçmişe aitse Düzenle ve Sil butonlarını tamamen ortadan kaldırıyoruz!
     const editBtn = document.getElementById("book-edit-btn");
     const deleteBtn = document.getElementById("book-delete-btn");
     
     if (isPast) {
         if (editBtn) editBtn.style.display = "none";
         if (deleteBtn) deleteBtn.style.display = "none";
         document.getElementById("book-detail-heading").innerHTML = `${longDate} <span class="u-font-size-11px_background-rgba2552552550p1_padding-3px8px_"><i class="fa-solid fa-lock"></i> Arşiv</span>`;
     } else {
         // Bugünün kitabıysa işlemler açık kalabilir
         if (editBtn) editBtn.style.display = "inline-block";
         if (deleteBtn) deleteBtn.style.display = "inline-block";
     }
 
     modal.setAttribute("data-active-date", entry.date);
     modal.classList.remove("hidden");
     void modal.offsetHeight;
     modal.classList.add("animate-open");
 }

     // ==========================================================================
 // ULTRA-PREMIUM AYLIK TAKVİM KÜTÜPHANESİ MANTIĞI (GÜNCEL)
 // ==========================================================================
 function initGrandMassiveLibrary() {
     const libSearchInput = document.getElementById("library-search-input");
     const libFilterMonth = document.getElementById("library-filter-month");
     const libFilterYear = document.getElementById("library-filter-year");
 
     // Seçenekleri mevcut gerçek tarihe eşitle
     const realToday = new Date();
     if (libFilterMonth) libFilterMonth.value = realToday.getMonth();
     if (libFilterYear) libFilterYear.value = realToday.getFullYear();

     // Native <select>'in kendi arka planı yerine gösterdiğimiz sahte etiketi günceller
     function syncLibFilterLabels() {
         const monthLabel = document.getElementById('library-filter-month-label');
         const yearLabel  = document.getElementById('library-filter-year-label');
         if (monthLabel && libFilterMonth) monthLabel.textContent = libFilterMonth.options[libFilterMonth.selectedIndex]?.textContent || '';
         if (yearLabel && libFilterYear) yearLabel.textContent = libFilterYear.options[libFilterYear.selectedIndex]?.textContent || '';
     }
     syncLibFilterLabels();

     // Dinleyicileri bağla — aktif görünüme göre doğru renderer'ı çağır
     function refreshActiveView() {
         syncLibFilterLabels();
         const calView = document.getElementById('library-calendar-view');
         if (calView && !calView.classList.contains('hidden')) buildCalendarView();
         else buildMassiveLibraryRows();
     }
     if (libSearchInput) libSearchInput.addEventListener("input", refreshActiveView);
     if (libFilterMonth) libFilterMonth.addEventListener("change", refreshActiveView);
     if (libFilterYear) libFilterYear.addEventListener("change", refreshActiveView);
 
     // Not: sekmeden geçişi artık renderJournalRef (= buildMassiveLibraryRows) yönetiyor.
 
     buildMassiveLibraryRows();
 }
 
 function updateLibraryStatsBand(entries) {
     const now = new Date();
     const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

     const filled = entries.filter(e => e.completed && (e.achieve || e.improve));
     const filledDates = new Set(filled.map(e => e.date));

     // Seri hesabı — bugünden geriye doğru ardışık günler
     let streak = 0;
     const check = new Date(now);
     // Bugün henüz yazılmamışsa dünden başla
     if (!filledDates.has(todayStr)) check.setDate(check.getDate() - 1);
     while (true) {
         const d = `${check.getFullYear()}-${String(check.getMonth()+1).padStart(2,'0')}-${String(check.getDate()).padStart(2,'0')}`;
         if (!filledDates.has(d)) break;
         streak++;
         check.setDate(check.getDate() - 1);
     }

     // Bu ay yazılan gün sayısı
     const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
     const thisMonthCount = filled.filter(e => e.date.startsWith(thisMonthKey)).length;
     const daysPassedInMonth = now.getDate();

     // Toplam yansıma
     const total = filled.length;

     // Ortalama uzunluk
     let avgLen = 0;
     if (total > 0) {
         const totalChars = filled.reduce((acc, e) => acc + (e.achieve || '').length + (e.improve || '').length, 0);
         avgLen = Math.round(totalChars / total);
     }

     const streakEl = document.getElementById('lstat-streak-val');
     const monthEl  = document.getElementById('lstat-month-val');
     const totalEl  = document.getElementById('lstat-total-val');
     const avgEl    = document.getElementById('lstat-avglen-val');

     if (streakEl) streakEl.textContent = streak > 0 ? `${streak}` : '—';
     if (monthEl)  monthEl.textContent  = `${thisMonthCount}/${daysPassedInMonth}`;
     if (totalEl)  totalEl.textContent  = `${total}`;
     if (avgEl)    avgEl.textContent    = avgLen > 0 ? `${avgLen}` : '—';

     // Seri ≥3 ise aktif vurgu class'ı ekle
     const streakPill = document.getElementById('lstat-streak');
     if (streakPill) {
         streakPill.classList.toggle('seri-aktif', streak >= 3);
     }

     // Kompakt toolbar stats güncelle
     const tbStreak = document.getElementById('ltbstat-streak-val');
     const tbMonth  = document.getElementById('ltbstat-month-val');
     const tbTotal  = document.getElementById('ltbstat-total-val');
     const tbAvg    = document.getElementById('ltbstat-avg-val');
     if (tbStreak) tbStreak.textContent = streak > 0 ? `${streak}` : '—';
     if (tbMonth)  tbMonth.textContent  = `${thisMonthCount}/${daysPassedInMonth}`;
     if (tbTotal)  tbTotal.textContent  = `${total}`;
     if (tbAvg)    tbAvg.textContent    = avgLen > 0 ? `${avgLen}` : '—';
 }

 function buildMassiveLibraryRows() {
     const libraryRoom = document.getElementById("library-room");
     if (!libraryRoom) return;

     const selectedMonth = parseInt(document.getElementById("library-filter-month")?.value ?? new Date().getMonth());
     const selectedYear  = parseInt(document.getElementById("library-filter-year")?.value  ?? new Date().getFullYear());
     const searchTerm    = document.getElementById("library-search-input")?.value.toLowerCase() || "";

     const totalDaysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
     const entries = FocusStorage.get('focusai_journal_entries', []);
     updateLibraryStatsBand(entries);

     const now = new Date();
     const todayNormalized = new Date(now.getFullYear(), now.getMonth(), now.getDate());

     libraryRoom.innerHTML = "";

     const leather = [
         '#6e2b2b','#2f4a32','#243a5e','#1f4d4a','#8a6a2f',
         '#4a2c4d','#5a3a22','#5c1f2a','#4f5224','#3a4754',
         '#7a4a24','#214034'
     ];
     const muted = [
         '#5a3a28','#3f3a2c','#2f3a3a','#4a3145','#34402f',
         '#52473a','#3a2e2c','#403a44','#604a30','#2c3530',
         '#5e4a3a','#473c2e','#6a5238'
     ];
     const trMonthsFull = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
     const trDaysFull   = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
     const trDaysShort  = ['PAZ','PZT','SAL','ÇAR','PER','CUM','CMT'];

     const rnd = (s) => { const x = Math.sin(s * 97.31 + 11.7) * 43758.545; return x - Math.floor(x); };

     // Gün kitap verilerini oluştur
     const dayBooks = [];
     for (let d = 1; d <= totalDaysInMonth; d++) {
         const bookDate = new Date(selectedYear, selectedMonth, d);
         const wd       = bookDate.getDay();
         const mm       = String(selectedMonth + 1).padStart(2,'0');
         const dd       = String(d).padStart(2,'0');
         const dateStr  = `${selectedYear}-${mm}-${dd}`;
         const entry    = entries.find(e => e.date === dateStr);
         const isFuture = bookDate > todayNormalized;
         const isToday  = bookDate.getTime() === todayNormalized.getTime();
         const isFilled = !!(entry && (entry.achieve || entry.improve));

         let isMatch = true;
         if (searchTerm) {
             const txt = ((entry?.achieve||'')+(entry?.improve||'')).toLowerCase();
             isMatch = txt.includes(searchTerm) || dateStr.includes(searchTerm);
         }

         const color   = leather[(d * 5 + 2) % leather.length];
         const bookW   = isToday ? 52 : 42 + Math.floor(rnd(d) * 8);
         const bookH   = 160 + Math.floor(rnd(d * 3.1) * 44);
         const numSize = isToday ? 17 : 18;

         dayBooks.push({
             d, dateStr, entry, isFuture, isToday, isFilled, isMatch,
             color, bookW, bookH, numSize,
             abbr: trDaysShort[wd],
             dayNameFull: trDaysFull[wd],
             dateLabel: `${d} ${trMonthsFull[selectedMonth]}`,
             monthYear: `${trMonthsFull[selectedMonth]} ${selectedYear}`,
             note: isFilled ? (entry.achieve || entry.improve) : '',
         });
     }

     // Raf genişliğini ölç (section görünürdeyse gerçek değer, yoksa fallback)
     const roomW  = libraryRoom.offsetWidth || libraryRoom.clientWidth || 900;
     const SHELF_PAD = 16; // zk-shelf-books'un padding toplamı (8px × 2)
     const availW = roomW - SHELF_PAD;

     // Filler grubu oluşturucu — tam hedef genişliği dolduran filler kitaplar
     function makeFillerGroup(targetW, seed) {
         const els = [];
         let placed = 0;
         let s = seed;
         while (placed < targetW - 4) {
             s++;
             const maxW  = targetW - placed;
             const fw    = Math.min(maxW, 10 + Math.floor(rnd(s) * 16));
             if (fw < 6) break;
             const fh    = 120 + Math.floor(rnd(s * 1.7) * 70);
             const fc    = muted[Math.floor(rnd(s) * muted.length)];
             const fb    = document.createElement('div');
             fb.className  = 'zk-book';
             fb.style.setProperty('--spine', fc);
             fb.style.setProperty('--w', fw + 'px');
             fb.style.setProperty('--h', fh + 'px');
             fb.style.setProperty('--lift', '0px');
             fb.style.cursor = 'default';
             fb.style.pointerEvents = 'none';
             fb.innerHTML  = `<div class="zk-book-top-edge"></div><div class="zk-book-band u-top-22pct" ></div><div class="zk-book-band u-top-72pct" ></div><div class="zk-book-filler-mark"></div>`;
             els.push(fb);
             placed += fw + 1;
         }
         return els;
     }

     const ROWS        = 3;
     const booksPerRow = Math.ceil(totalDaysInMonth / ROWS);
     const TITLE_W     = 43; // ay başlık kitabı genişliği + 1px gap

     for (let row = 0; row < ROWS; row++) {
         const shelfWrap  = document.createElement('div');
         shelfWrap.className = 'zk-shelf-wrap';
         const shelfBooks = document.createElement('div');
         shelfBooks.className = 'zk-shelf-books';
         const shelfBoard = document.createElement('div');
         shelfBoard.className = 'zk-shelf-board';

         const rowStart = row * booksPerRow;
         const rowEnd   = Math.min(rowStart + booksPerRow, totalDaysInMonth);
         const rowDays  = dayBooks.slice(rowStart, rowEnd);
         const n        = rowDays.length;

         // Toplam gün kitap genişliği
         const totalDayW = rowDays.reduce((s, bk) => s + bk.bookW + 1, 0);
         const titleW    = row === 0 ? TITLE_W : 0;

         // Kalan genişliği (n+1) eşit gap'e böl
         const remaining = Math.max(0, availW - titleW - totalDayW);
         const numGaps   = n + 1;
         const baseGap   = Math.floor(remaining / numGaps);
         let   extraPx   = remaining - baseGap * numGaps; // son gap'e eklenecek artık piksel

         const gapWidths = Array.from({ length: numGaps }, (_, i) => {
             // Artık pikseli son gap'e ver
             return baseGap + (i === numGaps - 1 ? extraPx : 0);
         });

         // İlk rafa ay-başlık kitabı
         if (row === 0) {
             const titleBook = document.createElement('div');
             titleBook.className = 'zk-book';
             titleBook.style.setProperty('--spine', '#3a2014');
             titleBook.style.setProperty('--w', '42px');
             titleBook.style.setProperty('--h', '220px');
             titleBook.style.setProperty('--lift', '0px');
             titleBook.style.cursor = 'default';
             titleBook.innerHTML = `
                 <div class="zk-book-top-edge"></div>
                 <div class="zk-book-band u-top-20pct" ></div>
                 <div class="zk-book-band u-top-74pct" ></div>
                 <div class="zk-book-title-text"><span>${trMonthsFull[selectedMonth].toUpperCase()} ${selectedYear}</span></div>
             `;
             titleBook.style.cursor = 'pointer';
             titleBook.addEventListener('click', () => openZKMonthModal(selectedMonth, selectedYear, entries, trMonthsFull));
             shelfBooks.appendChild(titleBook);
         }

         // Önceki gap → gün kitabı → sonraki gap şeklinde yerleştir
         rowDays.forEach((bk, bi) => {
             // bi'inci gap (kitabın önü)
             const gSeed = row * 1000 + bi * 50 + selectedMonth;
             makeFillerGroup(gapWidths[bi], gSeed).forEach(el => shelfBooks.appendChild(el));

             // Gün kitabı
             const bookEl   = document.createElement('div');
             const dimClass = searchTerm ? (bk.isMatch ? '' : 'zk-book-search-dim') : '';
             bookEl.className = ['zk-book',
                 bk.isFuture ? 'zk-book-future' : '',
                 bk.isToday  ? 'zk-book-today-glow' : '',
                 dimClass
             ].filter(Boolean).join(' ');

             const liftPx      = bk.isToday ? '-14px' : '0px';
             const ribbonColor = bk.isToday ? '#e09a44' : (bk.isFuture ? '#8c7c62' : '');
             const showRibbon  = bk.isToday || bk.isFuture;

             bookEl.style.setProperty('--spine', bk.color);
             bookEl.style.setProperty('--w', bk.bookW + 'px');
             bookEl.style.setProperty('--h', bk.bookH + 'px');
             bookEl.style.setProperty('--lift', liftPx);
             if (ribbonColor) bookEl.style.setProperty('--ribbon', ribbonColor);
             bookEl.innerHTML = `
                 <div class="zk-book-top-edge"></div>
                 <div class="zk-book-band u-top-21pct" ></div>
                 <div class="zk-book-band u-top-75pct" ></div>
                 ${showRibbon ? '<div class="zk-book-ribbon"></div>' : ''}
                 <div class="zk-book-label">
                     <div class="zk-book-num">${bk.d}</div>
                     <div class="zk-book-abbr">${bk.abbr}</div>
                 </div>
             `;
             bookEl.querySelector('.zk-book-num').style.fontSize = bk.numSize + 'px';

             if (!bk.isFuture) {
                 bookEl.addEventListener('click', () => openZKModal(bk, selectedYear));
             } else {
                 bookEl.addEventListener('click', () => {
                     showPremiumModal({
                         title: 'Henüz Zaman Gelmedi',
                         message: `<b>${bk.dateLabel} ${selectedYear}</b> henüz gelmedi. Günlük yalnızca o gün veya sonrasında yazılabilir.`,
                         type: 'info'
                     });
                 });
             }

             shelfBooks.appendChild(bookEl);
         });

         // Son gap (son kitabın arkası)
         const lastGSeed = row * 1000 + n * 50 + selectedMonth + 7;
         makeFillerGroup(gapWidths[n], lastGSeed).forEach(el => shelfBooks.appendChild(el));

         shelfWrap.appendChild(shelfBooks);
         shelfWrap.appendChild(shelfBoard);
         libraryRoom.appendChild(shelfWrap);
     }
 }




 // ── TAKVİM / HEATMAP GÖRÜNÜMÜ ──
 function buildCalendarView() {
     const grid = document.getElementById('library-calendar-grid');
     if (!grid) return;

     // İstatistik bandını her görünümde güncelle
     const _allEntries = FocusStorage.get('focusai_journal_entries', []);
     updateLibraryStatsBand(_allEntries);

     const selectedMonth = parseInt(document.getElementById('library-filter-month')?.value ?? new Date().getMonth());
     const selectedYear  = parseInt(document.getElementById('library-filter-year')?.value  ?? new Date().getFullYear());
     const entries = FocusStorage.get('focusai_journal_entries', []);
     const filledSet = new Set(entries.filter(e => e.achieve || e.improve).map(e => e.date));
     const searchTerm = document.getElementById('library-search-input')?.value.toLowerCase() || '';

     const now = new Date();
     const todayNorm = new Date(now.getFullYear(), now.getMonth(), now.getDate());
     const firstDay = new Date(selectedYear, selectedMonth, 1).getDay(); // 0=Paz
     const totalDays = new Date(selectedYear, selectedMonth + 1, 0).getDate();
     const trMonthsFull = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
     const trDaysShort  = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];

     grid.innerHTML = '';

     // Gün başlıkları (Pazartesi başlangıçlı)
     trDaysShort.forEach(d => {
         const h = document.createElement('div');
         h.className = 'cal-day-header';
         h.textContent = d;
         grid.appendChild(h);
     });

     // Boş hücreler — Pazartesi=0 başlangıcına göre offset
     const startOffset = (firstDay === 0 ? 6 : firstDay - 1);
     for (let i = 0; i < startOffset; i++) {
         const empty = document.createElement('div');
         empty.className = 'cal-day cal-empty';
         grid.appendChild(empty);
     }

     for (let day = 1; day <= totalDays; day++) {
         const mm  = String(selectedMonth + 1).padStart(2, '0');
         const dd  = String(day).padStart(2, '0');
         const iso = `${selectedYear}-${mm}-${dd}`;
         const bookDate = new Date(selectedYear, selectedMonth, day);
         const isFuture = bookDate > todayNorm;
         const isToday  = bookDate.getTime() === todayNorm.getTime();
         const isFilled = filledSet.has(iso);
         const entry    = entries.find(e => e.date === iso);

         const cell = document.createElement('div');
         cell.className = 'cal-day';

         if (isFuture)      cell.classList.add('cal-future');
         else if (isFilled) cell.classList.add('cal-filled');
         else               cell.classList.add('cal-past-empty');
         if (isToday)       cell.classList.add('cal-today');

         // Arama filtresi: eşleşmeyenler soluk
         if (searchTerm && entry) {
             const txt = ((entry.achieve || '') + (entry.improve || '')).toLowerCase();
             if (!txt.includes(searchTerm)) cell.style.opacity = '0.2';
         }

         cell.innerHTML = `<span class="cal-day-num">${day}</span>${isFilled ? '<span class="cal-dot"></span>' : ''}`;
         cell.title = `${day} ${trMonthsFull[selectedMonth]} ${selectedYear}`;

         if (isFuture) {
             cell.addEventListener('click', () => showPremiumModal({ title: 'Henüz Zaman Gelmedi', message: `<b>${day} ${trMonthsFull[selectedMonth]}</b> henüz gelmedi.`, type: 'info' }));
         } else {
             // Rafta kullanılan kitap görünümüyle birebir aynı modalı aç — takvim
             // ve raf görünümleri arasında tutarlılık için.
             const leather = [
                 '#6e2b2b','#2f4a32','#243a5e','#1f4d4a','#8a6a2f',
                 '#4a2c4d','#5a3a22','#5c1f2a','#4f5224','#3a4754',
                 '#7a4a24','#214034'
             ];
             const trDaysFullZK = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
             const wd = bookDate.getDay();
             const bk = {
                 d: day, dateStr: iso, entry, isFuture: false, isToday, isFilled, isMatch: true,
                 color: leather[(day * 5 + 2) % leather.length],
                 dayNameFull: trDaysFullZK[wd],
                 dateLabel: `${day} ${trMonthsFull[selectedMonth]}`,
                 monthYear: `${trMonthsFull[selectedMonth]} ${selectedYear}`,
             };
             cell.addEventListener('click', () => openZKModal(bk, selectedYear));
         }
         grid.appendChild(cell);
     }
 }

 // ── GÖRÜNÜM TOGGLE ──
 (function initLibraryViewToggle() {
     const btnShelf    = document.getElementById('view-btn-shelf');
     const btnCalendar = document.getElementById('view-btn-calendar');
     const shelfWrap   = document.querySelector('.library-grand-container');
     const calView     = document.getElementById('library-calendar-view');
     if (!btnShelf || !btnCalendar) return;

     let currentView = 'shelf';

     btnShelf.addEventListener('click', () => {
         if (currentView === 'shelf') return;
         currentView = 'shelf';
         btnShelf.classList.add('active');
         btnCalendar.classList.remove('active');
         calView?.classList.add('hidden');
         shelfWrap?.classList.remove('hidden');
         // Raf artık görünür olduğuna göre gerçek genişlikle yeniden çiz —
         // aksi halde takvimdeyken (gizliyken) hesaplanmış yanlış genişlikle kalır.
         if (typeof buildMassiveLibraryRows === 'function') buildMassiveLibraryRows();
     });

     btnCalendar.addEventListener('click', () => {
         if (currentView === 'calendar') return;
         currentView = 'calendar';
         btnCalendar.classList.add('active');
         btnShelf.classList.remove('active');
         shelfWrap?.classList.add('hidden');
         calView?.classList.remove('hidden');
         buildCalendarView();
     });
 })();

 // ── TAM EKRAN DERİN YAZIM MODU ──
 (function initDeepWriteMode() {
     const overlay  = document.getElementById('deepwrite-modal');
     const textarea = document.getElementById('deepwrite-textarea');
     const charEl   = document.getElementById('deepwrite-char-count');
     const labelEl  = document.getElementById('deepwrite-label');
     const saveBtn  = document.getElementById('deepwrite-save');
     const closeBtn = document.getElementById('deepwrite-close');
     if (!overlay || !textarea) return;

     let _sourceId  = null; // Hangi textarea'dan açıldı

     function updateDeepChar() {
         const len = textarea.value.length;
         charEl.textContent = `${len} / 1000`;
         charEl.classList.remove('cc-writing','cc-good','cc-warn','cc-limit');
         if      (len === 0)       { /* gri */ }
         else if (len < 500)       charEl.classList.add('cc-writing');
         else if (len < 800)       charEl.classList.add('cc-good');
         else if (len < 1000)      charEl.classList.add('cc-warn');
         else                      charEl.classList.add('cc-limit');
     }

     function openDeepWrite(sourceId, label) {
         _sourceId = sourceId;
         const src = document.getElementById(sourceId);
         if (!src) return;
         textarea.value = src.value;
         labelEl.textContent = label;
         updateDeepChar();
         overlay.classList.remove('hidden');
         textarea.focus();
         textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
     }

     function closeDeepWrite(save) {
         if (save && _sourceId) {
             const src = document.getElementById(_sourceId);
             if (src) {
                 src.value = textarea.value;
                 src.dispatchEvent(new Event('input')); // sayacı güncelle
             }
         }
         overlay.classList.add('hidden');
         _sourceId = null;
     }

     textarea.addEventListener('input', updateDeepChar);
     saveBtn?.addEventListener('click', () => closeDeepWrite(true));
     closeBtn?.addEventListener('click', () => closeDeepWrite(true));
     overlay.addEventListener('click', e => { if (e.target === overlay) closeDeepWrite(true); });
     document.addEventListener('keydown', e => {
         if (!overlay.classList.contains('hidden')) {
             if (e.key === 'Escape') { closeDeepWrite(true); e.preventDefault(); }
             if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { closeDeepWrite(true); e.preventDefault(); }
         }
     });

     // Tüm expand butonlarını bağla
     document.addEventListener('click', e => {
         const btn = e.target.closest('.deepwrite-expand-btn');
         if (!btn) return;
         const targetId = btn.getAttribute('data-target');
         const label = btn.closest('.form-group, div')?.querySelector('label')?.textContent?.trim()
             || (targetId.includes('achieve') ? 'Gurur Duyduklarım' : 'Geliştireceklerim');
         openDeepWrite(targetId, label);
     });
 })();

 // ── ZK Kitap Modalı ──
 let __zkCurrentBook = null;

 function renderZKNoteView(bk) {
     const writeBtn    = document.getElementById('zkm-write-btn');
     const cancelBtn   = document.getElementById('zkm-cancel-btn');
     const saveBtn     = document.getElementById('zkm-save-btn');
     const achText     = document.getElementById('zkm-note-achieve');
     const achEmpty    = document.getElementById('zkm-empty-achieve');
     const achEdit      = document.getElementById('zkm-edit-achieve');
     const impText     = document.getElementById('zkm-note-improve');
     const impEmpty    = document.getElementById('zkm-empty-improve');
     const impEdit      = document.getElementById('zkm-edit-improve');

     const achieve = bk.entry?.achieve || '';
     const improve = bk.entry?.improve || '';

     achText.textContent = achieve;
     achText.classList.toggle('hidden', !achieve);
     achEmpty.classList.toggle('hidden', !!achieve);
     achEdit.classList.add('hidden');

     impText.textContent = improve;
     impText.classList.toggle('hidden', !improve);
     impEmpty.classList.toggle('hidden', !!improve);
     impEdit.classList.add('hidden');

     writeBtn.textContent = (achieve || improve) ? 'Düzenle' : 'Bu Günü Yaz';
     writeBtn.classList.remove('hidden');
     cancelBtn.classList.add('hidden');
     saveBtn.classList.add('hidden');
 }

 function enterZKEditMode(bk) {
     const writeBtn   = document.getElementById('zkm-write-btn');
     const cancelBtn  = document.getElementById('zkm-cancel-btn');
     const saveBtn    = document.getElementById('zkm-save-btn');
     const achText    = document.getElementById('zkm-note-achieve');
     const achEmpty   = document.getElementById('zkm-empty-achieve');
     const achEdit     = document.getElementById('zkm-edit-achieve');
     const impText    = document.getElementById('zkm-note-improve');
     const impEmpty   = document.getElementById('zkm-empty-improve');
     const impEdit     = document.getElementById('zkm-edit-improve');

     achEdit.value = bk.entry?.achieve || '';
     impEdit.value = bk.entry?.improve || '';

     achText.classList.add('hidden');
     achEmpty.classList.add('hidden');
     achEdit.classList.remove('hidden');

     impText.classList.add('hidden');
     impEmpty.classList.add('hidden');
     impEdit.classList.remove('hidden');

     writeBtn.classList.add('hidden');
     cancelBtn.classList.remove('hidden');
     saveBtn.classList.remove('hidden');
     achEdit.focus();
 }

 // Sayfa dolunca (son satıra gelindiğinde) yeni satıra/yazıya izin vermez — imleç son satırda kalır,
 // tarayıcının içeriği kaydırmasını (scroll) tamamen engeller.
 (function lockZKTextareaScroll() {
     ['zkm-edit-achieve', 'zkm-edit-improve'].forEach(id => {
         const el = document.getElementById(id);
         if (!el) return;
         let prevValue = el.value;
         let prevStart = el.selectionStart;
         const capture = () => { prevValue = el.value; prevStart = el.selectionStart; };
         el.addEventListener('keydown', capture);
         el.addEventListener('focus', capture);
         el.addEventListener('input', () => {
             el.scrollTop = 0;
             if (el.scrollHeight > el.clientHeight + 1) {
                 // Sayfa dolu: bu tuş vuruşunu geri al, imleç son geçerli konumda kalsın
                 const restorePos = Math.min(prevStart, prevValue.length);
                 el.value = prevValue;
                 el.selectionStart = el.selectionEnd = restorePos;
                 el.scrollTop = 0;
             } else {
                 capture();
             }
         });
     });
 })();

 function saveZKEntry(bk) {
     const achieve = document.getElementById('zkm-edit-achieve').value.trim();
     const improve = document.getElementById('zkm-edit-improve').value.trim();

     if (achieve === '' && improve === '') {
         showPremiumModal({
             title: 'Eksik Veri',
             message: 'Günlük kaydını tamamen boş bırakamazsın.',
             type: 'warning'
         });
         return;
     }

     const entries = FocusStorage.get('focusai_journal_entries', []);
     const existingIndex = entries.findIndex(e => e.date === bk.dateStr);
     const newEntry = { date: bk.dateStr, achieve, improve, completed: true, skipped: false };

     if (existingIndex !== -1) entries[existingIndex] = newEntry;
     else entries.push(newEntry);

     FocusStorage.set('focusai_journal_entries', entries);

     bk.entry = newEntry;
     renderZKNoteView(bk);

     if (typeof buildMassiveLibraryRows === 'function') buildMassiveLibraryRows();
 }

 function openZKModal(bk, selectedYear) {
     const modal    = document.getElementById('zk-book-modal');
     const cover    = document.getElementById('zk-book-cover');
     if (!modal) return;

     __zkCurrentBook = bk;

     // Kapak rengi ve içeriği
     modal.style.setProperty('--bcover', bk.color);
     cover && cover.removeAttribute('style'); // animasyonu sıfırla

     document.getElementById('zkm-dayname').textContent    = bk.dayNameFull;
     document.getElementById('zkm-datelabel').textContent  = bk.dateLabel;
     document.getElementById('zkm-color-circle').style.background =
         `radial-gradient(circle at 35% 30%, rgba(255,255,255,.45), transparent 48%), ${bk.color}`;
     document.getElementById('zkm-cover-dayname').textContent  = bk.dayNameFull;
     document.getElementById('zkm-cover-num').textContent      = bk.d;
     document.getElementById('zkm-cover-monthyear').textContent = bk.monthYear;

     renderZKNoteView(bk);

     // Modalı önce göster, sonra kapak animasyonunu senkron biçimde yeniden tetikle
     // (modal display:none iken sıfırlamak işe yaramıyordu; rAF'a bağlı sıfırlama da
     //  sekme arka planda/pasifken hiç tetiklenmeyip animasyonu 'none'da kilitleyebiliyordu)
     modal.classList.remove('hidden');
     document.body.style.overflow = 'hidden';

     if (cover) {
         cover.style.animation = 'none';
         void cover.offsetHeight; // senkron reflow
         cover.style.animation = '';
     }
 }

 function closeZKModal() {
     const modal = document.getElementById('zk-book-modal');
     if (modal) modal.classList.add('hidden');
     document.body.style.overflow = '';
 }

 // Modal kapatma olayları (bir kez bağla)
 (function initZKModal() {
     const closeBtn  = document.getElementById('zk-modal-close-btn');
     const backdrop  = document.getElementById('zk-modal-backdrop');
     if (closeBtn)  closeBtn.addEventListener('click', closeZKModal);
     if (backdrop)  backdrop.addEventListener('click', closeZKModal);
     document.addEventListener('keydown', (e) => {
         if (e.key === 'Escape') closeZKModal();
     });

     const writeBtn  = document.getElementById('zkm-write-btn');
     const saveBtn   = document.getElementById('zkm-save-btn');
     const cancelBtn = document.getElementById('zkm-cancel-btn');
     if (writeBtn)  writeBtn.addEventListener('click',  () => __zkCurrentBook && enterZKEditMode(__zkCurrentBook));
     if (saveBtn)   saveBtn.addEventListener('click',   () => __zkCurrentBook && saveZKEntry(__zkCurrentBook));
     if (cancelBtn) cancelBtn.addEventListener('click', () => __zkCurrentBook && renderZKNoteView(__zkCurrentBook));
 })();

 // ── Ay Özeti Kitabı Modalı ──
 function openZKMonthModal(selectedMonth, selectedYear, entries, trMonthsFull) {
     const modal    = document.getElementById('zk-month-modal');
     const cover    = document.getElementById('zk-month-book-cover');
     if (!modal) return;

     const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2,'0')}`;
     const monthEntries = entries.filter(e => e.date.startsWith(monthKey) && (e.achieve || e.improve));

     const countWords = (str) => (str || '').trim().split(/\s+/).filter(Boolean).length;

     const daysWritten  = monthEntries.length;
     let totalWords     = 0;
     monthEntries.forEach(e => {
         totalWords += countWords(e.achieve) + countWords(e.improve);
     });
     const avgWords = daysWritten > 0 ? Math.round(totalWords / daysWritten) : 0;

     const totalDaysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
     const now = new Date();
     const isCurrentMonth = now.getFullYear() === selectedYear && now.getMonth() === selectedMonth;
     const daysBase  = isCurrentMonth ? now.getDate() : totalDaysInMonth;
     const fillRate  = daysBase > 0 ? Math.round((daysWritten / daysBase) * 100) : 0;

     // Ay içinde en uzun ardışık yazma serisi — seriyi bozmayı cezalandırmak yerine
     // devam etme direncini öne çıkarır.
     const writtenDates = new Set(monthEntries.map(e => e.date));
     let longestStreak = 0, curStreak = 0;
     for (let d = 1; d <= totalDaysInMonth; d++) {
         const ds = `${monthKey}-${String(d).padStart(2,'0')}`;
         if (writtenDates.has(ds)) {
             curStreak++;
             longestStreak = Math.max(longestStreak, curStreak);
         } else {
             curStreak = 0;
         }
     }

     // Önceki aya göre trend (Yazılan Gün) — mutlak sayı yerine yön göstererek
     // kıyaslamayı kullanıcının kendi geçmişiyle sınırlı tutar.
     const prevDate = new Date(selectedYear, selectedMonth - 1, 1);
     const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2,'0')}`;
     const prevMonthEntries = entries.filter(e => e.date.startsWith(prevMonthKey) && (e.achieve || e.improve));
     const prevDaysWritten = prevMonthEntries.length;
     const fmtTrend = (cur, prev) => {
         if (prev <= 0) return '';
         const diff = cur - prev;
         if (diff === 0) return '';
         return diff > 0 ? ` ▲+${diff}` : ` ▼${diff}`;
     };
     const daysTrend  = fmtTrend(daysWritten, prevDaysWritten);

     // En verimli gün: ay içindeki girdilerin haftanın hangi gününde yoğunlaştığı — bir rutin
     // farkındalığı sağlar, "kaçırılan gün" gibi suçlayıcı bir çerçeve kullanmaz.
     const trWeekdays = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
     const weekdayCounts = [0,0,0,0,0,0,0];
     monthEntries.forEach(e => {
         const [y, m, d] = e.date.split('-').map(Number);
         weekdayCounts[new Date(y, m - 1, d).getDay()]++;
     });
     let bestDayIdx = -1, bestDayCount = 0;
     weekdayCounts.forEach((c, i) => { if (c > bestDayCount) { bestDayCount = c; bestDayIdx = i; } });
     const bestDayText = bestDayIdx >= 0 ? `${trWeekdays[bestDayIdx]} günleri` : '—';

     document.getElementById('zkmm-monthyear').textContent    = `${trMonthsFull[selectedMonth]} ${selectedYear}`;
     document.getElementById('zkmm-days-val').textContent     = `${daysWritten}/${daysBase}`;
     document.getElementById('zkmm-days-trend').textContent   = daysTrend;
     document.getElementById('zkmm-streak-val').textContent   = longestStreak > 0 ? `${longestStreak} gün` : '—';
     document.getElementById('zkmm-avgwords-val').textContent = avgWords > 0 ? `${avgWords}` : '—';
     document.getElementById('zkmm-fillrate-val').textContent = `%${fillRate}`;
     document.getElementById('zkmm-bestday-val').textContent  = bestDayText;
     document.getElementById('zkmm-cover-num').textContent      = trMonthsFull[selectedMonth].slice(0,3);
     document.getElementById('zkmm-cover-monthyear').textContent = `${selectedYear}`;

     const emptyEl = document.getElementById('zkmm-empty');
     if (emptyEl) emptyEl.classList.toggle('hidden', daysWritten > 0);

     modal.classList.remove('hidden');
     document.body.style.overflow = 'hidden';

     if (cover) {
         cover.style.animation = 'none';
         void cover.offsetHeight;
         cover.style.animation = '';
     }
 }

 function closeZKMonthModal() {
     const modal = document.getElementById('zk-month-modal');
     if (modal) modal.classList.add('hidden');
     document.body.style.overflow = '';
 }

 (function initZKMonthModal() {
     const closeBtn  = document.getElementById('zk-month-modal-close-btn');
     const backdrop  = document.getElementById('zk-month-modal-backdrop');
     if (closeBtn)  closeBtn.addEventListener('click', closeZKMonthModal);
     if (backdrop)  backdrop.addEventListener('click', closeZKMonthModal);
     document.addEventListener('keydown', (e) => {
         if (e.key === 'Escape') closeZKMonthModal();
     });
 })();

 function showGrandBookDetails(entry, isPast) {
    const modal = document.getElementById("book-detail-modal");
    if (!modal) return;
    modal.setAttribute('data-active-date', entry.date);

    // Tarihi kullanıcı dostu uzun Türkçe formatına çeviriyoruz (Örn: 25 Mayıs 2026)
    let longDate = entry.date;
    try {
        longDate = new Date(entry.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }

    // Yeni defter alanlarına veriyi basıyoruz
    document.getElementById("book-detail-cover-date").textContent = longDate;
    document.getElementById("book-detail-achieve").textContent = entry.achieve || "Bugün gurur duyulacak çok şey vardı ama kağıda dökülmedi...";
    document.getElementById("book-detail-improve").textContent = entry.improve || "Her gün bir öğrenme fırsatıdır, yarın yeni bir sayfa açılacak.";

    // ── O GÜNE AİT GERÇEK İSTATİSTİKLERİ HESAPLAMA MOTORU ──
    try {
        const _dateStr = journalDateToStorageKey(entry.date);

        // Yardımcı: boş durum için em dash, dolu için değer
        function setStatVal(el, value, emptyClass) {
            if (!el) return;
            if (!value) {
                el.textContent = '—';
                el.classList.add('is-empty');
                el.style.color = '';
            } else {
                el.textContent = value;
                el.classList.remove('is-empty');
            }
        }

        // 1. Görev Sayısı
        const _allTasks = typeof tasks !== 'undefined' ? tasks : FocusStorage.get('tasks', []);
        const _dayTasks = _allTasks.filter(t => t.date === _dateStr);
        const tasksEl = document.getElementById('book-stat-tasks-val');
        if (_dayTasks.length === 0) {
            setStatVal(tasksEl, null);
        } else {
            const done = _dayTasks.filter(t => t.completed).length;
            setStatVal(tasksEl, `${done}/${_dayTasks.length}`);
        }

        // 2. Odak Süresi
        const _focusHistory = FocusStorage.get('focus_history', {});
        const _focusMin = _focusHistory[_dateStr] || 0;
        const focusText = _focusMin >= 60
            ? `${Math.floor(_focusMin/60)}s ${_focusMin % 60}dk`
            : _focusMin > 0 ? `${_focusMin}dk` : null;
        setStatVal(document.getElementById('book-stat-focus-val'), focusText);

        // 3. Alışkanlıklar — badge sistemi
        const _allHabits = typeof habits !== 'undefined' ? habits : FocusStorage.get('habits', []);
        const habitsContainer = document.getElementById('book-stat-habits-val');
        if (habitsContainer) {
            habitsContainer.innerHTML = '';
            if (_allHabits.length === 0) {
                const empty = document.createElement('span');
                empty.className = 'bsi-value is-empty';
                empty.textContent = '—';
                habitsContainer.appendChild(empty);
            } else {
                _allHabits.forEach(h => {
                    const badge = document.createElement('span');
                    badge.className = 'bsi-habit-badge ' + (h.history && h.history[_dateStr] ? 'done' : 'missed');
                    badge.textContent = h.name || h.title;
                    habitsContainer.appendChild(badge);
                });
            }
        }

        // 4. Ana Hedef
        const _highlightHistory = FocusStorage.get('highlight_history', {});
        const _hl = _highlightHistory[_dateStr];
        const highlightElement = document.getElementById('book-stat-highlight-val');
        if (highlightElement) {
            const hlText = _hl && (_hl.text || _hl.title) ? (_hl.text || _hl.title) : null;
            setStatVal(highlightElement, hlText);
            if (hlText) {
                highlightElement.style.color = _hl.completed ? '#2ed573' : '#ff4757';
            }
        }
    } catch(e) {
        console.error("Kitap istatistikleri yüklenirken bir hata oluştu:", e);
    }
    // ─────────────────────────────────────────────────────

    const editBtn = document.getElementById("book-edit-btn");
    const deleteBtn = document.getElementById("book-delete-btn");

    if (isPast) {
        if (editBtn) editBtn.style.display = "none";
        if (deleteBtn) deleteBtn.style.display = "none";
    } else {
        if (editBtn) editBtn.style.display = "inline-block";
        if (deleteBtn) deleteBtn.style.display = "inline-block";
    }

    modal.classList.remove("hidden");
    void modal.offsetHeight; 
    modal.classList.add("animate-open");
}
 
 // Modal kapatma — sinematik kapanış animasyonu
 function closeBookDetailModal() {
     const modal = document.getElementById("book-detail-modal");
     if (!modal || modal.classList.contains("hidden")) return;

     const panel = modal.querySelector('.notebook-layout') || modal.querySelector('.book-detail-panel');

     if (panel) {
         // Kapanış: sağa katlanarak uzaklaşır
         panel.style.transition = [
             'transform 0.35s cubic-bezier(0.6, 0, 0.8, 0.4)',
             'opacity 0.28s ease 0.04s',
             'filter 0.28s ease'
         ].join(', ');
         panel.style.transform = 'perspective(1600px) rotateY(62deg) rotateX(-8deg) scale(0.80) translateZ(-140px) translateY(16px)';
         panel.style.opacity = '0';
         panel.style.filter = 'brightness(0.5)';

         // Overlay da fade out
         modal.style.transition = 'background 0.30s ease, backdrop-filter 0.30s ease';
         modal.style.background = 'rgba(0,0,0,0)';
         modal.style.backdropFilter = 'blur(0px)';

         setTimeout(() => {
             modal.classList.add("hidden");
             modal.classList.remove("animate-open");
             // Temizle
             panel.style.transform = '';
             panel.style.opacity = '';
             panel.style.filter = '';
             panel.style.transition = '';
             modal.style.transition = '';
             modal.style.background = '';
             modal.style.backdropFilter = '';
         }, 340);
     } else {
         modal.classList.add("hidden");
         modal.classList.remove("animate-open");
     }
 }

 document.addEventListener("DOMContentLoaded", () => {
     document.getElementById("close-book-detail-btn")?.addEventListener("click", closeBookDetailModal);
     document.getElementById("book-detail-modal")?.addEventListener("click", (e) => {
         if (e.target === e.currentTarget) closeBookDetailModal();
     });
 });
 
 // Sistemi Başlatma Komutu
 // "Zihin Kütüphanesi" (Günlük/gunluk) her sayfa yüklemesinde — sekme aktif
 // olsun ya da olmasın — burada senkron çalışıyordu. Bu, kullanıcı başka bir
 // sekmede yenilese bile ekstra bir ay-kitap grid'i oluşturup DOM'a yazıyor,
 // Günlük sekmesinde yenilendiğinde ise diğer tüm sekme render'larıyla aynı
 // anda yarışıp gözle görülür bir kasmaya yol açıyordu (bkz. kullanıcı geri
 // bildirimi). Artık yalnızca ekrandaki (yenileme sonrası geri yüklenen)
 // sekme 'gunluk' ise hemen, değilse bir sonraki frame'e ertelenerek çalışır.
 function _startGrandMassiveLibrary() {
     let restoredTab = 'bugun';
     try {
         const raw = localStorage.getItem('focusai_lastActiveTab');
         if (raw) restoredTab = JSON.parse(raw);
     } catch (e) { /* yoksay, varsayılan kalsın */ }
     if (restoredTab === 'gunluk') {
         initGrandMassiveLibrary();
     } else {
         requestAnimationFrame(initGrandMassiveLibrary);
     }
 }
 if (document.readyState === "loading") {
     document.addEventListener("DOMContentLoaded", _startGrandMassiveLibrary);
 } else {
     _startGrandMassiveLibrary();
 }


window.buildMassiveLibraryRows = buildMassiveLibraryRows;
window.closeBookDetailModal = closeBookDetailModal;
window.buildCalendarView = buildCalendarView;
window.openZKModal = openZKModal;

})();
