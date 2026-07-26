// XSS koruması: kullanıcının girdiği metinler innerHTML ile basılmadan önce
// escapeHtml()'den geçirilmeli (task/goal/habit/group başlıkları vb.).
// Tek kaynak: storage-manager.js (script.js'ten önce yüklenir, window.escapeHtml
// olarak tanımlar) — bare escapeHtml(...) çağrıları IIFE kapsam zincirinden
// (aşağıdaki sarmalayıcı yerel bir escapeHtml tanımlamadığı için) global scope'a
// düşüp doğrudan window.escapeHtml'e çözümlenir.
(function () {
'use strict';

// Kaydedilen son aktif sekmeyi tüm ilgili DOM durumuna (section, nav, dock, body attr)
// uygular. DOMContentLoaded içinde (flash önleme + nav/dock senkronu için) ve
// `pageshow` olayında (bfcache'den geri gelindiğinde JS yeniden çalışmadığı için
// sayfa eski/varsayılan sekmede donmuş görünebiliyordu) çağrılır.
function applyLastActiveTab() {
    const target = FocusStorage.get('lastActiveTab', 'bugun');
    document.querySelectorAll('.page-section').forEach(function(s) {
        s.classList.toggle('active', s.id === target);
    });
    document.querySelectorAll('.nav-links li[data-target]').forEach(function(nav) {
        nav.classList.toggle('active', nav.getAttribute('data-target') === target);
    });
    document.querySelectorAll('#app-dock .di[data-target]').forEach(function(d) {
        d.classList.toggle('act', d.getAttribute('data-target') === target);
    });
    document.body.setAttribute('data-active-tab', target);
    // İlk boyama öncesi flash önleme için <head>'e enjekte edilen geçici CSS
    // kuralını (bkz. index.html "erken sekme restorasyonu") kaldır — kalıcı
    // kalırsa hedef section'ı sonsuza dek zorla görünür bırakıp (display
    // !important), kullanıcı başka bir sekmeye geçse bile o section ekranda
    // kalmaya devam ediyordu (bkz. kullanıcı geri bildirimi: "Alışkanlıklar"
    // sekmesinde takılı kalma sorunu).
    document.getElementById('early-tab-restore-style')?.remove();
    return target;
}
window.applyLastActiveTab = applyLastActiveTab;

// Sayfa bfcache'den (geri/ileri tuşu vb.) geri geldiğinde DOMContentLoaded tekrar
// tetiklenmez; bu durumda da son sekmeyi yeniden uygula.
window.addEventListener('pageshow', function(e) {
    if (e.persisted) applyLastActiveTab();
});

document.addEventListener('DOMContentLoaded', () => {

    // ── FLASH ÖNLEME: JS'nin ilk işi doğru section'ı göstermek.
    // switchTab henüz tanımlı değil; sadece CSS class toggle yeterli.
    // setTimeout yok → tarayıcı render etmeden önce çalışır → flash olmaz.
    applyLastActiveTab();

    // --- Premium Tarih ve Saat Seçici (Flatpickr) Başlangıç ---
    flatpickr('input[type="date"]', {
        locale: "tr",
        altInput: true,
        altFormat: "d-m-Y", // Kullanıcının ekranda göreceği format (TR)
        dateFormat: "Y-m-d", // Arka planda kodun okuyacağı standart format (US)
        disableMobile: "true"
   });

   // Zihin çöplüğü dönüştürme modalı için geçmiş tarihleri engelle
   const _convertDumpDateEl = document.getElementById('convert-dump-date');
   if (_convertDumpDateEl && _convertDumpDateEl._flatpickr) {
       _convertDumpDateEl._flatpickr.set('minDate', 'today');
   } else if (_convertDumpDateEl) {
       flatpickr(_convertDumpDateEl, {
           locale: "tr",
           altInput: true,
           altFormat: "d-m-Y",
           dateFormat: "Y-m-d",
           disableMobile: "true",
           minDate: "today"
       });
   }
   // --- Premium Tarih ve Saat Seçici (Flatpickr) Bitiş ---
 
    
     // --- Premium Tarih ve Saat Seçici (Flatpickr) Bitiş ---
 
     // ── Mobil Sidebar ──
     const appSidebar  = document.getElementById('app-sidebar');
     const sidebarOverlay = document.getElementById('sidebar-overlay');
 
     // Hamburger butonu yoksa dinamik oluştur
     if (!document.getElementById('hamburger-btn')) {
         const btn = document.createElement('button');
         btn.id = 'hamburger-btn';
         btn.innerHTML = '<i class="fa-solid fa-bars"></i>';
         Object.assign(btn.style, {
             display: 'none', position: 'fixed', top: '15px', left: '15px',
             zIndex: '1001', background: 'rgba(108,92,231,0.85)', border: 'none',
             color: '#fff', borderRadius: '10px', padding: '10px 13px',
             fontSize: '18px', cursor: 'pointer', backdropFilter: 'blur(8px)',
             boxShadow: '0 4px 15px rgba(108,92,231,0.4)'
         });
         document.body.appendChild(btn);
 
         // Sadece mobilde göster
         const mediaQ = window.matchMedia('(max-width: 768px)');
         const toggleHamburger = (e) => { btn.style.display = e.matches ? 'block' : 'none'; };
         mediaQ.addEventListener('change', toggleHamburger);
         toggleHamburger(mediaQ);
 
         btn.addEventListener('click', () => {
             appSidebar.classList.toggle('open');
             sidebarOverlay.classList.toggle('open');
         });
     }
 
     if (sidebarOverlay) {
         sidebarOverlay.addEventListener('click', () => {
             appSidebar.classList.remove('open');
             sidebarOverlay.classList.remove('open');
         });
     }
 
     // Nav linkine tıklanınca mobilde sidebar kapansın
     document.querySelectorAll('.nav-links li').forEach(li => {
         li.addEventListener('click', () => {
             if (window.innerWidth <= 768) {
                 appSidebar.classList.remove('open');
                 sidebarOverlay.classList.remove('open');
             }
         });
     });
     
    // getProgressColor/formatDateToString/toInputDate/fromInputDate →
    // script-date-time-utils.js dosyasına taşındı (Faz 2, 2026-07-19).
    // window.* üzerinden erişiliyor (index.html'de script.js'ten ÖNCE
    // yüklenmesi gerekiyor — aşağıdaki currentWeekStr satırı senkron
    // çağırıyor).
     const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
     const monthNamesShort = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
     window.monthNames = monthNames; window.monthNamesShort = monthNamesShort; // Faz 6: script-statistics.js için
     const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
 
     // getWeekNumber → script-date-time-utils.js dosyasına taşındı.
 
     const currentWeekStr = new Date().getFullYear() + "-W" + window.getWeekNumber(new Date());
     window.currentWeekStr = currentWeekStr; // Faz 6: script-plan-wizard.js için köprü
 
     let tasks = Store.tasks.get();
     tasks = tasks.map(t => {
         if(!t.id) t.id = generateId();
         if(!t.date) t.date = window.formatDateToString(new Date());
         // Migrate YYYY-MM-DD → DD-MM-YYYY
         if (t.date && /^\d{4}-\d{2}-\d{2}$/.test(t.date)) {
             const p = t.date.split('-');
             t.date = `${p[2]}-${p[1]}-${p[0]}`;
         }
         return t;
     });
     Store.tasks.set(tasks);
 
     let calendarEvents = Store.events.get();
     // One-time migration: move any YYYY-MM-DD keyed events to DD-MM-YYYY keys
     (function _migrateEventKeys() {
         let changed = false;
         const toFix = Object.keys(calendarEvents).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k));
         toFix.forEach(oldKey => {
             const p = oldKey.split('-');
             const newKey = `${p[2]}-${p[1]}-${p[0]}`;
             if (!calendarEvents[newKey]) calendarEvents[newKey] = [];
             calendarEvents[newKey] = [...calendarEvents[newKey], ...calendarEvents[oldKey]];
             delete calendarEvents[oldKey];
             changed = true;
         });
         if (changed) Store.events.set(calendarEvents);
     })();
     for(let date in calendarEvents) {
         calendarEvents[date] = calendarEvents[date].map(e => {
             if(!e.id) e.id = generateId();
             return e;
         });
     }
 
     const DEFAULT_HABIT_CATEGORY_IDS = ['genel', 'saglik', 'kisisel-gelisim'];
     window.__getHabitCategoriesRef = () => habitCategories; // Faz 6: script-convert-modal.js için
    let habitCategories = FocusStorage.get('habit_categories', [
         { id: 'genel', name: 'Genel' }, { id: 'saglik', name: 'Sağlık' }, { id: 'kisisel-gelisim', name: 'Kişisel Gelişim' }
     ]);
 
     let goals = Store.goals.get();
     let rawHabits = Store.habits.get();
     let habits = rawHabits.map(h => {
         if(!h.startDate) h.startDate = window.formatDateToString(new Date());
         // Migrasyon: eski yyyy-mm-dd formatını dd-mm-yyyy'ye çevir
         else if (/^\d{4}-\d{2}-\d{2}$/.test(h.startDate)) {
             h.startDate = window.fromInputDate(h.startDate);
         }
         return h;
     });
     // Migrasyon sonuçlarını hemen kaydet
     Store.habits.set(habits);

     // Alışkanlıklar günlük tekrar eden taahhütlerdir — her biri her gün bilinçli
     // takip/irade kaynağı ister (ego-depletion). Aynı anda çok fazla yeni alışkanlık
     // başlatmak (Fogg/Tiny Habits, Lally ve ark. 2010) başarı oranını düşürüp
     // hepsini yarım bıraktırıyor; bu yüzden hâlâ süresi dolmamış (aktif) alışkanlık
     // sayısını sınırlıyoruz. Süresi dolmuş/tamamlanmış alışkanlıklar bu sayıma girmez.
     const MAX_ACTIVE_HABITS = 7;
     function isHabitExpired(habit) {
         if (!habit.startDate || !habit.targetDays) return false;
         const [sd, sm, sy] = habit.startDate.split('-').map(Number);
         const end = new Date(sy, sm - 1, sd);
         end.setDate(end.getDate() + habit.targetDays - 1);
         end.setHours(0, 0, 0, 0);
         const todayDate = new Date();
         todayDate.setHours(0, 0, 0, 0);
         return end < todayDate;
     }
    // Migrasyon: günlük (journal) verilerini birleştir → focusai_journal_entries
    if (FocusStorage.get('focusai_journal_entries', null) === null) {
        const mergedJournal = {};
        const oldReflectionHistory = FocusStorage.get('reflection_history', {});
        for (let key in oldReflectionHistory) {
            const e = oldReflectionHistory[key];
            const isoDate = /^\d{2}-\d{2}-\d{4}$/.test(key) ? window.toInputDate(key) : key;
            mergedJournal[isoDate] = {
                date: isoDate,
                achieve: e.achieve || '',
                improve: e.improve || '',
                completed: !!e.completed,
                skipped: !!e.skipped
            };
        }
        let legacyReflections = [];
        try { legacyReflections = JSON.parse(localStorage.getItem('focusai_reflections') || '[]'); } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
        legacyReflections.forEach(e => {
            if (!e || !e.date) return;
            const existing = mergedJournal[e.date] || { date: e.date, achieve: '', improve: '', completed: false, skipped: false };
            existing.achieve = e.achieve || existing.achieve;
            existing.improve = e.improve || existing.improve;
            existing.completed = true;
            existing.skipped = false;
            mergedJournal[e.date] = existing;
        });
        FocusStorage.set('focusai_journal_entries', Object.values(mergedJournal));
    }

     // social.js'in arkadaş silme temizliği yaptıktan sonra in-memory diziyi senkronize eder
     window._syncHabitsFromStorage = function() {
         habits = Store.habits.get();
         setTimeout(function() {
             if (typeof renderTodayTab === 'function') renderTodayTab();
             if (typeof renderHabits   === 'function') renderHabits();
         }, 0);
     };

     // Supabase'ten veri çekildikten sonra (giriş / sayfa açılışı) in-memory verileri ve arayüzü yeniler
     window._syncAllFromStorage = function() {
         tasks = Store.tasks.get();
         calendarEvents = Store.events.get();
         habitCategories = FocusStorage.get('habit_categories', habitCategories);
         goals = Store.goals.get();
         habits = Store.habits.get();
         mindDumps = Store.mind_dumps.get();
         totalFocusMinutes = FocusStorage.get('focus_minutes', 0) || 0;

         // setTimeout(0): DOM const'ları (taskList, habitList vb.) tanımlanmadan önce
         // render fonksiyonları çağrılırsa TDZ hatası alınır; defer ile güvene al
         setTimeout(function() {
             if (typeof renderTodayTab    === 'function') renderTodayTab();
             if (typeof renderTasks       === 'function') renderTasks();
             if (typeof renderGoals       === 'function') renderGoals();
             if (typeof renderHabits      === 'function') renderHabits();
             if (typeof renderJournal     === 'function') renderJournal();
             if (typeof window.renderMindDumps === 'function') window.renderMindDumps();
             if (typeof renderCalendarRef === 'function') renderCalendarRef();
             if (typeof renderEventsRef   === 'function') renderEventsRef();
             if (typeof renderHabitsRef   === 'function') renderHabitsRef();
             if (typeof renderStatisticsRef === 'function') renderStatisticsRef();
             if (typeof renderJournalRef  === 'function') renderJournalRef();
             if (typeof renderMindDumpsRef === 'function') renderMindDumpsRef();
             if (typeof renderTodayGoalCard === 'function') renderTodayGoalCard();
             if (typeof renderTodayTaskSplit === 'function') renderTodayTaskSplit();
         }, 0);
     };
     window.addEventListener('focusai:data-synced', window._syncAllFromStorage);

     if (window.FocusSync && window.FocusSync.isEnabled()) {
         window.FocusSync.pullAll();
     }

     let mindDumps = Store.mind_dumps.get();

     // script-command-palette.js (ayrı dosyaya çıkarıldı) tasks/goals/habits/
     // mindDumps'a artık bare closure erişimi yapamıyor — bu accessor'lar
     // güncel referansı her çağrıda döndürür (değişkenler yeniden atandığında
     // -ör. tasks = tasks.map(...) gibi- de güncel kalır, closure sayesinde).
     window.__getTasksRef = () => tasks;
    window.__setTasksRef = (v) => { tasks = v; }; // Faz 6: script-plan-wizard.js için (ilk kez tasks setter — dikkatli kullanılmalı)
     window.__getGoalsRef = () => goals;
     // script-goal-modal.js (Faz 2, 2026-07-20) deleteGoal içinde `goals = goals.filter(...)`
     // ile yeniden atama yapıyor — salt-okunur getter yetmediği için setter da eklendi.
     window.__setGoalsRef = (arr) => { goals = arr; };
     window.__getHabitsRef = () => habits;
     window.__getMindDumpsRef = () => mindDumps;
    window.__setMindDumpsRef = (v) => { mindDumps = v; }; // Faz 6: script-convert-modal.js için
    window.__getCalendarEventsRef = () => calendarEvents;

     // Zihin çöplüğü hızlı/dip friksiyonlu bir yakalama alanı olmalı — sınırsız
     // MAX_MIND_DUMPS -> script-mind-dump.js dosyasına taşındı (Faz 2, 2026-07-20).

     let totalFocusMinutes = FocusStorage.get('focus_minutes', 0) || 0;
 
     FocusStorage.checkOnInit();
 
     // ── UNDO (GERİ AL) SİSTEMİ → script-undo-toast.js dosyasına taşındı ──
 
     let renderCalendarRef, renderEventsRef, renderHabitsRef, renderStatisticsRef, renderJournalRef, renderSocialStatsRef, renderBuddyHabitsRef, renderMindDumpsRef;
     // script-timer.js modülünün (Faz 2, 2026-07-20) bu fonksiyon işaretçilerini
     // salt-okunur okuyabilmesi için köprü (henüz atanmamışsa null döner, `if`
     // kontrolleri zaten bunu güvenle ele alıyor).
     window.__getRenderStatisticsRef  = () => renderStatisticsRef;
     window.__getRenderSocialStatsRef = () => renderSocialStatsRef;
     window.__getRenderBuddyHabitsRef = () => renderBuddyHabitsRef; // Faz 6: script-habit-sync.js için
     window.__getRenderCalendarRef    = () => renderCalendarRef;
     window.__getRenderEventsRef      = () => renderEventsRef;
     window.__getRenderHabitsRef      = () => renderHabitsRef;
 
     // --- GELİŞMİŞ AKILLI METİN ALGILAMA (NLP) MOTORU → script-nlp.js dosyasına taşındı ---
 
     // --- ANA HEDEF TARİH SINIRI KONTROLÜ (YENİ) ---
     function checkGoalDateBoundaries(parentGoalId, targetDateStr) {
        if (!parentGoalId) return true; // Hedef seçilmediyse sınırlama yok

        const goal = goals.find(g => String(g.id) === String(parentGoalId));
        if (!goal) return true;

        // targetDateStr hem "YYYY-MM-DD" (date input) hem "dd-mm-yyyy" (flatpickr altFormat) olabilir
        // İlk parçanın uzunluğuna göre formatı ayırt et
        const parts = targetDateStr.split('-').map(Number);
        let targetDate;
        if (String(parts[0]).length === 4) {
            // YYYY-MM-DD formatı
            targetDate = new Date(parts[0], parts[1] - 1, parts[2]);
        } else {
            // dd-mm-yyyy formatı
            targetDate = new Date(parts[2], parts[1] - 1, parts[0]);
        }
        targetDate.setHours(0,0,0,0);

        // Ana Hedef Başlangıç Tarihi (createdAt milisaniye cinsinden)
        const goalStartDate = new Date(goal.createdAt);
        goalStartDate.setHours(0,0,0,0);

        // Ana Hedef Bitiş Tarihi (goal.deadline "YYYY-MM-DD" formatında)
        if (!goal.deadline) return true;
        const [gYear, gMonth, gDay] = goal.deadline.split('-').map(Number);
        const goalEndDate = new Date(gYear, gMonth - 1, gDay);
        goalEndDate.setHours(23, 59, 59, 999);

        if (targetDate < goalStartDate) {
            showPremiumModal({
                title: 'Hatalı Tarih 📅',
                message: `Bu görev, seçtiğiniz ana hedefin başlangıç tarihinden (${window.formatDateToString(goalStartDate)}) önce olamaz!`,
                type: 'warning'
            });
            return false;
        }

        if (targetDate > goalEndDate) {
            showPremiumModal({
                title: 'Hatalı Tarih 📅',
                message: `Bu görev, seçtiğiniz ana hedefin bitiş tarihinden (${window.formatDateToString(goalEndDate)}) sonra olamaz!`,
                type: 'warning'
            });
            return false;
        }

        return true;
    }
    window.checkGoalDateBoundaries = checkGoalDateBoundaries; // script-milestone-goal-actions.js gibi ayrı modüllerden erişim için


     // timeToMins/getNextRecurringDate/addOneHour → script-date-time-utils.js
     // dosyasına taşındı (Faz 2, 2026-07-19).

     // O gün için ilk boş (çakışmayan) saat dilimini bulur — örn. 09:00-10:00 doluysa 10:00-11:00 önerir.
     function getNextAvailableTimeSlot(dateStr, durationMins = 60, startHour = 9, endHour = 22) {
         for (let h = startHour; h <= endHour; h++) {
             const startMins = h * 60;
             const endMins = startMins + durationMins;
             if (!hasTimeConflict(dateStr, startMins, endMins)) {
                 const endH = Math.floor(endMins / 60) % 24;
                 const endM = endMins % 60;
                 return {
                     start: `${String(h).padStart(2, '0')}:00`,
                     end: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
                 };
             }
         }
         return { start: '09:00', end: '10:00' };
     }
 
     function hasTimeConflict(dateStr, startMins, endMins, ignoreWeekly = false) {
         if(!calendarEvents[dateStr]) return false;
         if (endMins < startMins) return false;

         // Görev id'leri set'i — phantom çakışmaları önlemek için
         const taskIds = new Set(tasks.map(t => t.id));

         for(let ev of calendarEvents[dateStr]) {
             if (ignoreWeekly && ev.weekStr === currentWeekStr) continue;

             // Bu takvim girişine karşılık gelen görev artık yoksa çakışma sayma
             if (ev.id && !taskIds.has(ev.id)) continue;

             const evStart = window.timeToMins(ev.timeStart || ev.time || "12:00");
             const evEnd = window.timeToMins(ev.timeEnd || "13:00");
             if (evEnd < evStart) continue;

             if(startMins < evEnd && endMins > evStart) return true;
         }
         return false;
     }
     window.hasTimeConflict = hasTimeConflict;

     // Grup seans takvimi gibi dış modüllerin, kullanıcının kişisel takvimiyle saat çakışmasını
     // (sadece evet/hayır değil, hangi görevle çakıştığını da) sorgulayabilmesi için köprü.
     // dateStr "dd-mm-yyyy" formatında olmalı (kişisel takvimin kullandığı anahtar biçimi).
     window.getPersonalScheduleConflict = function(dateStr, startMins, endMins) {
         if (!calendarEvents[dateStr] || endMins < startMins) return null;
         const taskIds = new Set(tasks.map(t => t.id));
         for (const ev of calendarEvents[dateStr]) {
             if (ev.id && !taskIds.has(ev.id)) continue;
             const evStart = window.timeToMins(ev.timeStart || ev.time || "12:00");
             const evEnd = window.timeToMins(ev.timeEnd || "13:00");
             if (evEnd < evStart) continue;
             if (startMins < evEnd && endMins > evStart) return ev;
         }
         return null;
     };

     function getHabitsForDate(dateStr) {
         const [d, m, y] = dateStr.split('-').map(Number); // GÜNCELLENDİ: gün, ay, yıl sırasına alındı
         const targetDate = new Date(y, m - 1, d);
         targetDate.setHours(0,0,0,0);
 
         // Arkadaş listesini al — social.js yüklenmediyse boş dizi kullan
         const currentFriends = (typeof window.getFriendsForFilter === 'function')
             ? window.getFriendsForFilter()
             : null; // null = social.js henüz yüklenmediyse filtreleme yapma

         return habits.filter(habit => {
             if (!habit.startDate) return false;
             // Buddy alışkanlığı ama partner artık arkadaş listesinde değilse gizle
             if (currentFriends !== null && habit.buddy && habit.buddy !== 'none' && !currentFriends.includes(habit.buddy)) {
                 return false;
             }
             const [sd, sm, sy] = habit.startDate.split('-').map(Number); // GÜNCELLENDİ: gün, ay, yıl sırasına alındı
             const start = new Date(sy, sm - 1, sd);
             start.setHours(0,0,0,0);
             const end = new Date(sy, sm - 1, sd);
             end.setDate(end.getDate() + habit.targetDays - 1);
             end.setHours(0,0,0,0);
             return targetDate >= start && targetDate <= end;
         });
     }
    window.getHabitsForDate = getHabitsForDate; // script-day-summary-card.js gibi ayrı script scope'larından erişim için

     function saveTasks() {
         Store.tasks.set(tasks);
         Store.events.set(calendarEvents);

         // YENİ EKLENEN: Görevler her eklendiğinde/değiştiğinde Ana Hedefler sayacını anında güncelle
         if (typeof window.renderGoals === 'function') {
             window.renderGoals();
         }
     }
     window.saveTasks = saveTasks;

   function addGlobalTask(text, priority, category, date, start, end, parentHabit = "", parentGoal = "", recurring = "", routineId = "") {
         const id = generateId();
         const isOvernight = window.timeToMins(end) < window.timeToMins(start); 
         
         // Görevin tarihine göre hangi dönüm noktasına düştüğünü otomatik bul
         let parentMilestone = "";
         if (parentGoal && date) {
             const goal = goals.find(g => String(g.id) === String(parentGoal));
             if (goal && Array.isArray(goal.milestones)) {
                 // Tarihi YYYY-MM-DD'ye normalize et (app DD-MM-YYYY, milestone YYYY-MM-DD saklar)
                 const _normDate = (d) => {
                     if (!d) return '';
                     const p = d.split('-');
                     if (p.length !== 3) return d;
                     return p[0].length === 4 ? d : (p[2] + '-' + p[1] + '-' + p[0]);
                 };
                 const dateNorm = _normDate(date);
                 const match = goal.milestones.find(ms => {
                     const s = _normDate(ms.startDate || '');
                     const e = _normDate(ms.date || ms.endDate || '');
                     if (s && e) return dateNorm >= s && dateNorm <= e;
                     if (e && !s) return dateNorm <= e;
                     return false;
                 });
                 if (match) parentMilestone = match.id;
             }
         }

         tasks.push({ id, text, completed: false, priority, category, date, timeStart: start, timeEnd: end, parentHabit: parentHabit, parentGoal: parentGoal, parentMilestone: parentMilestone, isOvernight: isOvernight, recurring: recurring, routineId: routineId });
         
         if(!calendarEvents[date]) calendarEvents[date] = [];
         calendarEvents[date].push({ id, text, timeStart: start, timeEnd: end, priority, parentHabit: parentHabit, parentGoal: parentGoal, isOvernight: isOvernight, routineId: routineId });
         
         saveTasks();
     }

     // Planlama modülünün milestone → görev dönüşümü için global erişim
     window.addGlobalTask = addGlobalTask;
     window.renderTasksGlobal  = function() { if (typeof renderTasks === 'function') renderTasks(); };
     // Planning module writes to FocusStorage directly; call this to sync the in-memory tasks array
     // so subsequent saveTasks() calls don't overwrite planning changes.
     window.syncTasksFromStorage = function() {
         tasks = Store.tasks.get();
         calendarEvents = Store.events.get();
         // Fix legacy tasks whose date was stored as YYYY-MM-DD instead of DD-MM-YYYY.
         // Move their calendarEvents entry to the correct DD-MM-YYYY key.
         let eventsFixed = false;
         tasks.forEach(t => {
             if (!t.date || !t.date.match(/^\d{4}-\d{2}-\d{2}$/)) return;
             const p = t.date.split('-');
             const ddmmyyyy = `${p[2]}-${p[1]}-${p[0]}`;
             t.date = ddmmyyyy; // fix the task's own date field
             // move calendarEvent from YYYY-MM-DD key to DD-MM-YYYY key
             const oldKey = `${p[0]}-${p[1]}-${p[2]}`;
             const existing = (calendarEvents[oldKey] || []).find(e => e.id === t.id);
             if (existing) {
                 calendarEvents[oldKey] = (calendarEvents[oldKey] || []).filter(e => e.id !== t.id);
                 if (!calendarEvents[oldKey].length) delete calendarEvents[oldKey];
                 if (!calendarEvents[ddmmyyyy]) calendarEvents[ddmmyyyy] = [];
                 if (!calendarEvents[ddmmyyyy].find(e => e.id === t.id)) calendarEvents[ddmmyyyy].push(existing);
                 eventsFixed = true;
             }
         });
         if (eventsFixed) {
             Store.tasks.set(tasks);
             Store.events.set(calendarEvents);
         }
     };
     window.renderCalendarGlobal = function() {
         // Re-read from storage so any cross-module writes are picked up
         tasks          = Store.tasks.get();
         calendarEvents = Store.events.get();
         if (typeof renderCalendarRef === 'function') renderCalendarRef();
         if (typeof renderEventsRef   === 'function') renderEventsRef();
         if (typeof renderTasks       === 'function') renderTasks();
     };

     // ── Planlama ↔ Takvim köprüsü ──
     // Milestone due_date'leri takvime ekler/kaldırır
     window.syncMilestoneToCalendar = function(milestone, goalTitle, goalColor, action) {
         if (!milestone.due_date) return;
         // milestone.due_date is YYYY-MM-DD; calendarEvents keyed by DD-MM-YYYY
         const _toDD = (d) => { if (!d) return d; const p = d.split('-'); return p.length === 3 && p[0].length === 4 ? `${p[2]}-${p[1]}-${p[0]}` : d; };
         const date = _toDD(milestone.due_date);
         const evId = 'ms_cal_' + milestone.id;
         // Önce varsa sil
         if (calendarEvents[date]) {
             calendarEvents[date] = calendarEvents[date].filter(e => e.id !== evId);
             if (!calendarEvents[date].length) delete calendarEvents[date];
         }
         // Saatli aşamalar (start_time set) — ister takvimden sürükle-bırakla eklenen bir
        // "ayna" (is_task_mirror) olsun ister öğretmenin doğrudan saat verdiği bir aşama —
        // bkz. planning.js _acceptLessonPlanInvite/finalize: bunlar zaten `tasks` içinde ayrı
        // bir görev olarak takvimde görünüyor. Ayrıca 🚩 bayraklı bir milestone etkinliği
        // eklemek aynı dersi iki kez (görev + bayrak) göstermeye yol açar.
        if (action === 'add' && !milestone.done && !milestone.start_time && !milestone.is_task_mirror && !milestone.task_mirror_id) {
             if (!calendarEvents[date]) calendarEvents[date] = [];
             calendarEvents[date].push({
                 id: evId,
                 text: '🚩 ' + milestone.title + ' (' + goalTitle + ')',
                 timeStart: '09:00', timeEnd: '09:30',
                 priority: 1,
                 isMilestone: true,
                 milestoneColor: goalColor,
             });
         }
         Store.events.set(calendarEvents);
         if (typeof renderCalendarRef === 'function') renderCalendarRef();
         if (typeof renderEventsRef   === 'function') renderEventsRef();
     };

     // Tüm planning milestone'larını takvimle senkronize et (başlangıçta ve güncellemede)
     window.syncAllMilestonesToCalendar = function() {
         // Önce eski milestone cal event'lerini temizle
         for (const date in calendarEvents) {
             calendarEvents[date] = calendarEvents[date].filter(e => !e.isMilestone);
             if (!calendarEvents[date].length) delete calendarEvents[date];
         }
         const planningGoals = (typeof FocusStorage !== 'undefined')
             ? FocusStorage.get('planning_goals', [])
             : JSON.parse(localStorage.getItem('planning_goals') || '[]');
         planningGoals.forEach(g => {
             if (g.status === 'archived') return;
             // plan_mode==='lesson-plan' && !lpa_id: öğretmenin başka bir öğrenci için henüz
             // atamadığı ders planı taslağı — bu aşamalar öğretmenin KENDİ takvimine değil,
             // sadece planlama arayüzünün kendi takvimine ait.
             if (g.plan_mode === 'lesson-plan' && !g.lpa_id) return;
             (g.milestones || []).forEach(ms => {
                 window.syncMilestoneToCalendar(ms, g.title, g.color, 'add');
             });
         });
     };

     // Planlama hedeflerini görev formu dropdown'ına ekle
     window.getPlanningGoalsForDropdown = function() {
         const pg = (typeof FocusStorage !== 'undefined')
             ? FocusStorage.get('planning_goals', [])
             : JSON.parse(localStorage.getItem('planning_goals') || '[]');
         return pg.filter(g => g.status !== 'archived');
     };

     window.changeTaskGoal = function(taskId, goalId) {
         const task = tasks.find(t => String(t.id) === String(taskId));
         if (task) {
             task.parentGoal = goalId;
             // Hedef değişince parentMilestone'u yeniden hesapla
             task.parentMilestone = '';
             if (goalId && task.date) {
                 const _g = goals.find(g => String(g.id) === String(goalId));
                 if (_g && Array.isArray(_g.milestones)) {
                     const _norm = (d) => { if (!d) return ''; const p = d.split('-'); return p.length===3 && p[0].length!==4 ? (p[2]+'-'+p[1]+'-'+p[0]) : d; };
                     const dn = _norm(task.date);
                     const _ms = _g.milestones.find(ms => { const s=_norm(ms.startDate||''); const e=_norm(ms.date||ms.endDate||''); return (s&&e) ? dn>=s&&dn<=e : (e?dn<=e:false); });
                     if (_ms) task.parentMilestone = _ms.id;
                 }
             }
             saveTasks();
             renderGoals(); // Hedef ilerlemesini anlık güncelle
             renderTasks(); // Görev kartını breadcrumb ile güncelle
         }
     };
 
     window.deleteGlobalTask = function(id, date) {
         const taskToDelete = tasks.find(t => String(t.id) === String(id));
         // Görev tasks dizisinde yoksa ama calendarEvents'te varsa yine de sil
         if(!taskToDelete) {
             let removed = false;
             if (date && calendarEvents[date]) {
                 const before = calendarEvents[date].length;
                 calendarEvents[date] = calendarEvents[date].filter(e => String(e.id) !== String(id));
                 if (calendarEvents[date].length !== before) removed = true;
                 if (!calendarEvents[date].length) delete calendarEvents[date];
             }
             // date bilinmiyorsa tüm tarihlerde ara
             if (!removed) {
                 for (const d in calendarEvents) {
                     const before = calendarEvents[d].length;
                     calendarEvents[d] = calendarEvents[d].filter(e => String(e.id) !== String(id));
                     if (calendarEvents[d].length !== before) removed = true;
                     if (!calendarEvents[d].length) delete calendarEvents[d];
                 }
             }
             if (removed) {
                 Store.events.set(calendarEvents);
                 if (renderCalendarRef) renderCalendarRef();
                 if (renderEventsRef) renderEventsRef();
             }
             return;
         }
 
         // EĞER GÖREV BİR RUTİNSE VE ONAY BEKLENİYORSA MODAL AÇ
         if(taskToDelete.routineId && !window.bypassRoutineCheck) {
             const rModal = document.getElementById('recurring-delete-modal');
             if(rModal) {
                 rModal.classList.remove('hidden');
                 
                 // 1. SADECE BUNU SİL
                 document.getElementById('btn-delete-single').onclick = () => {
                     rModal.classList.add('hidden');
                     window.bypassRoutineCheck = true; // Sorusuz silmesi için bayrak aç
                     window.deleteGlobalTask(id, date); // Fonksiyonu tekrar çağır
                     window.bypassRoutineCheck = false; // Bayrağı kapat
                 };
 
                 // 2. TÜM RUTİNİ SİL
                 document.getElementById('btn-delete-all').onclick = () => {
                     rModal.classList.add('hidden');
                     const routineId = taskToDelete.routineId;
                     
                     // Görevlerden ve Takvimden rutin kimliğine uyan HER ŞEYİ sil
                     tasks = tasks.filter(t => t.routineId !== routineId);
                     for(let d in calendarEvents) {
                         calendarEvents[d] = calendarEvents[d].filter(e => e.routineId !== routineId);
                         if(calendarEvents[d].length === 0) delete calendarEvents[d];
                     }
                     
                     saveTasks(); renderTasks(); 
                     if(renderCalendarRef) renderCalendarRef();
                     if(renderEventsRef) renderEventsRef();
                     showPremiumModal({ title: 'Rutin Silindi', message: 'Serideki tüm tekrarlayan görevler takvimden başarıyla kaldırıldı.', type: 'success' });
                 };
 
                 // 3. İPTAL
                 document.getElementById('btn-delete-cancel').onclick = () => {
                     rModal.classList.add('hidden');
                 };
             }
             return; // Soruyu sorduğumuz için fonksiyonu burada durdur
         }
 
        // --- NORMAL (TEKLİ) SİLME İŞLEMİ ---
        const _deletedTaskSnap = JSON.parse(JSON.stringify(taskToDelete));
        const _deletedEventSnap = (calendarEvents[date] || []).find(e => String(e.id) === String(id));
        const _deletedEventSnapCopy = _deletedEventSnap ? JSON.parse(JSON.stringify(_deletedEventSnap)) : null;
 
        tasks = tasks.filter(t => String(t.id) !== String(id));

         if(calendarEvents[date]) {
             calendarEvents[date] = calendarEvents[date].filter(e => String(e.id) !== String(id));
             if(calendarEvents[date].length === 0) delete calendarEvents[date];
         }

         if (typeof window.PlanningUnmirrorTaskGlobal === 'function') window.PlanningUnmirrorTaskGlobal(id);
         saveTasks();
         renderTasks();
         if(renderCalendarRef) renderCalendarRef();
         if(renderEventsRef) renderEventsRef();
         if(renderStatisticsRef && document.getElementById('istatistikler').classList.contains('active')) renderStatisticsRef();
         if(renderSocialStatsRef && document.getElementById('arkadaslar').classList.contains('active')) renderSocialStatsRef();
 
         showUndoToast(`"${_deletedTaskSnap.text}" silindi`, () => {
             tasks.push(_deletedTaskSnap);
             if (_deletedEventSnapCopy) {
                 if (!calendarEvents[_deletedTaskSnap.date]) calendarEvents[_deletedTaskSnap.date] = [];
                 calendarEvents[_deletedTaskSnap.date].push(_deletedEventSnapCopy);
             }
             saveTasks(); renderTasks();
             if(renderCalendarRef) renderCalendarRef();
             if(renderEventsRef) renderEventsRef();
         });
     }
 
    // Faz F: checkSynergy/checkGoalSynergy(habit) -> script-habit-goal-synergy.js (window.checkSynergy / window.__checkGoalHabitSynergy)
 
     function populateParentHabitSelects() {
       // 1. Görevler İçin Eski Alışkanlık Menüleri (Takvim, Odak vb.)
       const habitSelects = [
         document.getElementById('wiz-parent-habit')
     ];
         habitSelects.forEach(select => {
             if (!select) return;
             const currentValue = select.value;
             select.innerHTML = '<option value="" selected>Bağımsız Görev</option>';
             habits.forEach(h => {
                 const opt = document.createElement('option');
                 opt.value = h.id; opt.textContent = h.name;
                 select.appendChild(opt);
             });
             if (currentValue && habits.some(h => String(h.id) === String(currentValue))) select.value = currentValue;
         });
 
    // 2. Bugün Sekmesi Ana Hedef Seçicileri (OPSİYONEL YAPILDI)
    const goalSelects = [
     document.getElementById('wiz-parent-goal'),
     document.getElementById('highlight-parent-goal'),
     document.getElementById('task-parent-goal'),
     document.getElementById('edit-task-parent-goal'),
     document.getElementById('event-parent-goal'),
     document.getElementById('convert-dump-parent-goal')
 ];
         goalSelects.forEach(select => {
             if (!select) return;
             const currentValue = select.value;
             select.innerHTML = '<option value="">🎯 Hedef (Opsiyonel)</option>'; // Zorunluluk kalktı
             goals.forEach(g => {
                 const opt = document.createElement('option');
                 opt.value = g.id; opt.textContent = g.title;
                 select.appendChild(opt);
             });
             if (currentValue && goals.some(g => String(g.id) === String(currentValue))) select.value = currentValue;
         });
 
         // 3. Premium Hap Butonlar (Alışkanlıklar İçin)
         const pillContainers = [
             { id: 'habit-goal-pills', selectedIds: window.tempHabitGoals || [] },
             { id: 'edit-habit-goal-pills', selectedIds: window.tempEditHabitGoals || [] }
         ];
 
         pillContainers.forEach(containerObj => {
             const container = document.getElementById(containerObj.id);
             if (!container) return;
             
             let currentSelected = Array.from(container.querySelectorAll('.goal-pill.selected')).map(p => p.dataset.val);
             if(containerObj.selectedIds.length > 0) currentSelected = containerObj.selectedIds;
 
             container.innerHTML = '';
             if(goals.length === 0) {
                 container.innerHTML = '<span style="font-size:12px; color:var(--text-muted);">Önce bir Ana Hedef oluşturmalısın.</span>';
                 return;
             }
 
             goals.forEach(g => {
                 const pill = document.createElement('div');
                 pill.className = `goal-pill ${currentSelected.includes(g.id) ? 'selected' : ''}`;
                 pill.dataset.val = g.id;
                 pill.innerHTML = `<i class="fa-solid fa-bullseye"></i> ${escapeHtml(g.title)}`;
                 pill.onclick = () => { pill.classList.toggle('selected'); };
                 container.appendChild(pill);
             });
             
             if(containerObj.id === 'edit-habit-goal-pills') window.tempEditHabitGoals = [];
         });
     }
     window.populateParentHabitSelects = populateParentHabitSelects;

 // updateDynamicGreeting -> script-misc-widgets.js dosyasına taşındı (Faz 2,
 // 2026-07-20). window.updateDynamicGreeting köprüsüyle erişilir.
     window.updateDynamicGreeting(); 
 
     // ── Zihin Kütüphanesi Canlı Odak Işığı (Paralaks) Motoru ──
     const libraryRoomContainer = document.getElementById('library-room');
     if (libraryRoomContainer) {
         // Hedef değerler (ham)
         let targetLampX = 50, targetLampY = 2;
         // Mevcut değerler (lerp ile yumuşatılmış)
         let currentLampX = 50, currentLampY = 2;
         let lampRafId = null;

         function lerpLamp() {
             const speed = 0.07; // 0.07 = yumuşak ağır
             currentLampX += (targetLampX - currentLampX) * speed;
             currentLampY += (targetLampY - currentLampY) * speed;
             libraryRoomContainer.style.setProperty('--lamp-x', `${currentLampX.toFixed(2)}%`);
             libraryRoomContainer.style.setProperty('--lamp-y', `${currentLampY.toFixed(2)}%`);
             // Hedefe yaklaştıysa dur
             if (Math.abs(targetLampX - currentLampX) > 0.05 || Math.abs(targetLampY - currentLampY) > 0.05) {
                 lampRafId = requestAnimationFrame(lerpLamp);
             } else {
                 lampRafId = null;
             }
         }

         libraryRoomContainer.addEventListener('mousemove', (e) => {
             const rect = libraryRoomContainer.getBoundingClientRect();
             const xPct = ((e.clientX - rect.left) / rect.width) * 100;
             const yPct = ((e.clientY - rect.top)  / rect.height) * 100;
             // Işık hareketi: X geniş (30-70), Y dar (0-8)
             targetLampX = 30 + xPct * 0.40;
             targetLampY = yPct * 0.08;
             if (!lampRafId) lampRafId = requestAnimationFrame(lerpLamp);
         });

         libraryRoomContainer.addEventListener('mouseleave', () => {
             targetLampX = 50;
             targetLampY = 2;
             if (!lampRafId) lampRafId = requestAnimationFrame(lerpLamp);
         });
     }

     const premiumModal = document.getElementById('premium-modal');
     const pmIconWrapper = document.getElementById('premium-modal-icon-wrapper');
     const pmIcon = document.getElementById('premium-modal-icon');
     const pmTitle = document.getElementById('premium-modal-title');
     const pmMessage = document.getElementById('premium-modal-message');
     let pmCancelBtn = document.getElementById('premium-modal-cancel-btn');
     let pmConfirmBtn = document.getElementById('premium-modal-confirm-btn');
 
     // script-journal-library.js (ayrı dosyaya çıkarıldı) bare showPremiumModal()
     // çağrısı yapamadığı için window.showPremiumModal gerekiyor.
     window.showPremiumModal = function() { return showPremiumModal.apply(null, arguments); };
     function showPremiumModal({ title, message, type = 'info', showCancel = false, confirmText = 'Tamam', cancelText = 'İptal', onConfirm = null }) {
         pmTitle.textContent = title;
         pmMessage.innerHTML = escapeHtml(message);
         
         pmIconWrapper.className = `modal-icon-wrapper ${type}`;
         if (type === 'success') pmIcon.className = 'fa-solid fa-check';
         else if (type === 'warning') pmIcon.className = 'fa-solid fa-triangle-exclamation';
         else pmIcon.className = 'fa-solid fa-circle-info';
 
         const newConfirmBtn = pmConfirmBtn.cloneNode(true);
         pmConfirmBtn.parentNode.replaceChild(newConfirmBtn, pmConfirmBtn);
         pmConfirmBtn = newConfirmBtn;
         pmConfirmBtn.textContent = confirmText;
 
         const newCancelBtn = pmCancelBtn.cloneNode(true);
         pmCancelBtn.parentNode.replaceChild(newCancelBtn, pmCancelBtn);
         pmCancelBtn = newCancelBtn;
         pmCancelBtn.textContent = cancelText;
 
         if (showCancel) pmCancelBtn.classList.remove('hidden');
         else pmCancelBtn.classList.add('hidden');
 
         premiumModal.style.zIndex = '999999';
         premiumModal.classList.remove('hidden');
 
         pmConfirmBtn.addEventListener('click', () => {
             premiumModal.classList.add('hidden');
             if (onConfirm) onConfirm();
         });
 
         pmCancelBtn.addEventListener('click', () => {
             premiumModal.classList.add('hidden');
         });
     }
 
     window.JOURNAL_CHAR_LIMIT = 1000;
     const JOURNAL_CHAR_LIMIT = window.JOURNAL_CHAR_LIMIT;

 // updateCharCounter -> script-misc-widgets.js dosyasına taşındı (Faz 2,
 // 2026-07-20). window.updateCharCounter köprüsüyle erişilir.

     const achieveInput    = document.getElementById('reflection-achieve');
     const improveInput    = document.getElementById('reflection-improve');
     const editAchieveInput = document.getElementById('edit-journal-achieve');
     const editImproveInput = document.getElementById('edit-journal-improve');

     if(achieveInput)     achieveInput.addEventListener('input',     () => window.updateCharCounter('reflection-achieve',    'char-count-achieve',      JOURNAL_CHAR_LIMIT));
     if(improveInput)     improveInput.addEventListener('input',     () => window.updateCharCounter('reflection-improve',    'char-count-improve',      JOURNAL_CHAR_LIMIT));
     if(editAchieveInput) editAchieveInput.addEventListener('input', () => window.updateCharCounter('edit-journal-achieve', 'edit-char-count-achieve', JOURNAL_CHAR_LIMIT));
     if(editImproveInput) editImproveInput.addEventListener('input', () => window.updateCharCounter('edit-journal-improve', 'edit-char-count-improve', JOURNAL_CHAR_LIMIT));
 
     const highlightSetupState = document.getElementById('highlight-setup-state');
     const highlightActiveState = document.getElementById('highlight-active-state');
     const highlightCompletedState = document.getElementById('highlight-completed-state');
     const highlightInput = document.getElementById('highlight-input');
     const highlightParentSelect = document.getElementById('highlight-parent-goal');
     const saveHighlightBtn = document.getElementById('save-highlight-btn');
     const highlightDisplayText = document.getElementById('highlight-display-text');
     const completeHighlightBtn = document.getElementById('complete-highlight-btn');
     const editHighlightBtn = document.getElementById('edit-highlight-btn');
     const deleteHighlightBtn = document.getElementById('delete-highlight-btn');
     
     const powerupBtn = document.getElementById('powerup-highlight-btn');
     const contractDisplay = document.getElementById('highlight-contract-display');
     const contractModal = document.getElementById('contract-modal');
     const cancelContractBtn = document.getElementById('cancel-contract-btn');
     const saveContractBtn = document.getElementById('save-contract-btn');
     const contractIfInput = document.getElementById('contract-if');
     const contractThenInput = document.getElementById('contract-then');
 
     if(powerupBtn) {
         powerupBtn.addEventListener('click', () => {
             if(contractModal) {
                 contractModal.classList.remove('hidden');
                 if(contractIfInput) contractIfInput.value = '';
                 if(contractThenInput) contractThenInput.value = '';
                 if(contractIfInput) contractIfInput.focus();
             }
         });
     }
 
     if(cancelContractBtn) {
         cancelContractBtn.addEventListener('click', () => {
             if(contractModal) contractModal.classList.add('hidden');
         });
     }
 
     if(saveContractBtn) {
         saveContractBtn.addEventListener('click', () => {
             const ifText = contractIfInput ? contractIfInput.value.trim() : '';
             const thenText = contractThenInput ? contractThenInput.value.trim() : '';
             
             if(ifText === "" || thenText === "") {
                 showPremiumModal({ title: 'Eksik Alan', message: 'Lütfen hem "Eğer" hem de "O Zaman" kısımlarını doldurun.', type: 'warning' });
                 return;
             }
 
             const todayStr = window.formatDateToString(new Date());
             let highlightHistory = FocusStorage.get('highlight_history', {});
             
             if(highlightHistory[todayStr]) {
                 highlightHistory[todayStr].contract = { ifText: ifText, thenText: thenText };
                 FocusStorage.set('highlight_history', highlightHistory); if(window.FocusSync) window.FocusSync.pushKey('highlight_history', highlightHistory);
                 
                 if(contractModal) contractModal.classList.add('hidden');
                 loadDailyHighlight();
                 
                 showPremiumModal({ 
                     title: 'Sözleşme İmzalandı ⚡', 
                     message: 'Kişisel sözleşmeni başarıyla oluşturdun. Artık ertelemek için hiçbir bahanen yok!', 
                     type: 'success' 
                 });
             }
         });
     }
 
 // updateGlobalStreak -> script-misc-widgets.js dosyasına taşındı (Faz 2,
 // 2026-07-20). window.updateGlobalStreak köprüsüyle erişilir (tasks state'ini
 // window.__getTasksRef() üzerinden salt-okunur okur).
 
     function loadDailyHighlight() {
         const todayStr = window.formatDateToString(new Date());
         let highlightHistory = FocusStorage.get('highlight_history', {});
         let todayHighlight = highlightHistory[todayStr];
         const goalCard = document.getElementById('td-goal-wrap');

         if (!todayHighlight) {
             if(highlightSetupState) highlightSetupState.style.display = 'flex';
             if(highlightActiveState) highlightActiveState.style.display = 'none';
             if(highlightCompletedState) highlightCompletedState.style.display = 'none';
             if(highlightInput) highlightInput.value = '';
             if(highlightParentSelect) highlightParentSelect.value = '';
             if(goalCard) goalCard.classList.remove('is-goal-complete');
         } else {
             if(highlightDisplayText) highlightDisplayText.textContent = todayHighlight.text;

             const completedDisplay = document.getElementById('highlight-completed-display');
             if(completedDisplay) completedDisplay.textContent = todayHighlight.text;

             if (todayHighlight.completed) {
                 if(highlightSetupState) highlightSetupState.style.display = 'none';
                 if(highlightActiveState) highlightActiveState.style.display = 'none';
                 if(highlightCompletedState) highlightCompletedState.style.display = 'flex';
                 if(goalCard) goalCard.classList.add('is-goal-complete');
             } else {
                 if(highlightSetupState) highlightSetupState.style.display = 'none';
                 if(highlightActiveState) highlightActiveState.style.display = 'flex';
                 if(highlightCompletedState) highlightCompletedState.style.display = 'none';
                 if(goalCard) goalCard.classList.remove('is-goal-complete');
             }
         }
         window.updateGlobalStreak();
     }
 
     window.toggleHighlightTask = function(dateStr = null) {
         const targetDate = dateStr || window.formatDateToString(new Date());
         let highlightHistory = FocusStorage.get('highlight_history', {});
         
         if(highlightHistory[targetDate]) {
             const willComplete = !highlightHistory[targetDate].completed;
             highlightHistory[targetDate].completed = willComplete;
             FocusStorage.set('highlight_history', highlightHistory); if(window.FocusSync) window.FocusSync.pushKey('highlight_history', highlightHistory);
             
             // Yeni Ana Hedef Sinerjisi
             window.__checkGoalHabitSynergy(highlightHistory[targetDate].parentGoal, targetDate, willComplete);
 
             if (targetDate === window.formatDateToString(new Date())) {
                 loadDailyHighlight(); 
             }
             
             renderTasks(); 
             if(renderCalendarRef) renderCalendarRef();
             if(renderEventsRef) renderEventsRef();
             if(renderStatisticsRef && document.getElementById('istatistikler').classList.contains('active')) renderStatisticsRef();
             if(renderSocialStatsRef && document.getElementById('arkadaslar').classList.contains('active')) renderSocialStatsRef();
             // Hedef detay modali açıksa aksiyon planını güncelle
             const _hlParentGoal = highlightHistory[targetDate] && highlightHistory[targetDate].parentGoal;
             if (_hlParentGoal && typeof updateGoalDetailsUI === 'function') {
                 const _hlModal = document.getElementById('goal-details-modal');
                 const _hlModalId = document.getElementById('detail-active-goal-id');
                 if (_hlModal && !_hlModal.classList.contains('hidden') && _hlModalId && String(_hlModalId.value) === String(_hlParentGoal)) {
                     updateGoalDetailsUI(_hlParentGoal);
                 }
             }
             
             if(willComplete && targetDate === window.formatDateToString(new Date())) {
                 showPremiumModal({ title: 'Mükemmel İş!', message: 'Bugünün en önemli hedefini tamamladın. Geri kalan her şey artık daha kolay.', type: 'success' });
             }

             if (willComplete && window.FocusAISocial && typeof window.FocusAISocial.postActivity === 'function') {
                 window.FocusAISocial.postActivity(`"${highlightHistory[targetDate].text}" günün öne çıkanını tamamladı 🌟`);
             }
         }
     }
 
     if(saveHighlightBtn) {
         saveHighlightBtn.addEventListener('click', () => {
             const text = highlightInput.value.trim();
             const parentGoal = highlightParentSelect ? highlightParentSelect.value : "";
             if (text === "") return;
             
             const todayStr = window.formatDateToString(new Date());
             let highlightHistory = FocusStorage.get('highlight_history', {});
             
             highlightHistory[todayStr] = { text: text, completed: false, parentGoal: parentGoal };
             FocusStorage.set('highlight_history', highlightHistory); if(window.FocusSync) window.FocusSync.pushKey('highlight_history', highlightHistory);
             
             loadDailyHighlight();
             // Hedef belirlendi — vurgu parlaması
             const goalText = document.getElementById('highlight-display-text');
             if (goalText) {
                 goalText.classList.remove('glowing');
                 requestAnimationFrame(() => requestAnimationFrame(() => goalText.classList.add('glowing')));
                 setTimeout(() => goalText.classList.remove('glowing'), 1050);
             }
             renderTasks();
             if(renderCalendarRef) renderCalendarRef();
             if(renderEventsRef) renderEventsRef();
             if(renderStatisticsRef && document.getElementById('istatistikler').classList.contains('active')) renderStatisticsRef();
             if(renderSocialStatsRef && document.getElementById('arkadaslar').classList.contains('active')) renderSocialStatsRef();
             // Hedef detay modali açıksa ve kaydedilen günün hedefi bu hedefe bağlıysa aksiyon planını güncelle
             if (parentGoal && typeof updateGoalDetailsUI === 'function') {
                 const _gModal = document.getElementById('goal-details-modal');
                 const _gModalId = document.getElementById('detail-active-goal-id');
                 if (_gModal && !_gModal.classList.contains('hidden') && _gModalId && String(_gModalId.value) === String(parentGoal)) {
                     updateGoalDetailsUI(parentGoal);
                 }
             }
             
             showPremiumModal({ title: 'Hedef Kilitlendi', message: 'Günün en önemli görevine odaklan. Başarılar!', type: 'success' });
         });
     }
 
     if(completeHighlightBtn) {
         completeHighlightBtn.addEventListener('click', () => {
             window.toggleHighlightTask();
         });
     }

     const undoHighlightBtn = document.getElementById('undo-highlight-btn');
     if(undoHighlightBtn) {
         undoHighlightBtn.addEventListener('click', () => {
             window.toggleHighlightTask();
         });
     }
 
     if(editHighlightBtn) {
         editHighlightBtn.addEventListener('click', () => {
             const todayStr = window.formatDateToString(new Date());
             let highlightHistory = FocusStorage.get('highlight_history', {});
             let todayHighlight = highlightHistory[todayStr];
 
             if(todayHighlight && !todayHighlight.completed) {
                 const textToEdit = todayHighlight.text;
                 const parentToEdit = todayHighlight.parentGoal || "";
                 
                 delete highlightHistory[todayStr];
                 FocusStorage.set('highlight_history', highlightHistory); if(window.FocusSync) window.FocusSync.pushKey('highlight_history', highlightHistory);
                 
                 loadDailyHighlight();
                 renderTasks();
                 if(renderCalendarRef) renderCalendarRef();
                 if(renderEventsRef) renderEventsRef();
                 if(renderStatisticsRef && document.getElementById('istatistikler').classList.contains('active')) renderStatisticsRef();
                 if(renderSocialStatsRef && document.getElementById('arkadaslar').classList.contains('active')) renderSocialStatsRef();
 
                 if(highlightInput) {
                     highlightInput.value = textToEdit;
                     if(highlightParentSelect) highlightParentSelect.value = parentToEdit;
                     highlightInput.focus();
                 }
             }
         });
     }
 
     if(deleteHighlightBtn) {
         deleteHighlightBtn.addEventListener('click', () => {
             showPremiumModal({
                 title: 'Hedefi Sil',
                 message: 'Bugünün ana hedefini silmek istediğinize emin misiniz?',
                 type: 'warning',
                 showCancel: true,
                 confirmText: 'Sil',
                 onConfirm: () => {
                     const todayStr = window.formatDateToString(new Date());
                     let highlightHistory = FocusStorage.get('highlight_history', {});
                     delete highlightHistory[todayStr];
                     FocusStorage.set('highlight_history', highlightHistory); if(window.FocusSync) window.FocusSync.pushKey('highlight_history', highlightHistory);
                     
                     loadDailyHighlight();
                     renderTasks();
                     if(renderCalendarRef) renderCalendarRef();
                     if(renderEventsRef) renderEventsRef();
                     if(renderStatisticsRef && document.getElementById('istatistikler').classList.contains('active')) renderStatisticsRef();
                     if(renderSocialStatsRef && document.getElementById('arkadaslar').classList.contains('active')) renderSocialStatsRef();
                 }
             });
         });
     }
 
     loadDailyHighlight();
 
     const navLinks = document.querySelectorAll('.nav-links li');
     const pageSections = document.querySelectorAll('.page-section');
 
     function switchTab(targetId) {
         // Sosyal sekmesinden başka bir sekmeye geçiliyorsa açık kalan sohbeti kapat.
         // Aksi halde window._activeChatTarget sekmeler arası geçişten sonra da o kişiyle
         // yazışılıyormuş gibi kalıyor ve gelen yeni mesajlar sessizce "okundu" işaretlenip
         // Son Mesajlaşmalar'da hiç okunmamış rozeti çıkmıyordu (sayfa yenilenince düzeliyordu,
         // çünkü _activeChatTarget o zaman null'a resetleniyordu).
         if (targetId !== 'arkadaslar' && typeof window.closeDcChat === 'function') {
             window.closeDcChat();
         }

         // Track active tab on body for CSS visibility rules
         document.body.setAttribute('data-active-tab', targetId);

         // Zamanlayıcı sekmesinden ayrılınca Hayalet Mod'u hemen kapat — aksi halde
         // zamanlayıcı çalışırken başka bir sekmede (örn. Sosyal) birkaç saniye
         // hareketsiz kalındığında o sekmedeki .section-header (sıralama/seri listesi
         // başlığı gibi) yanlışlıkla soluk kalmaya devam edebiliyordu.
         if (targetId !== 'zamanlayici') {
             document.body.classList.remove('ghost-mode-active');
         }

         navLinks.forEach(nav => {
             nav.classList.remove('active');
             if (nav.getAttribute('data-target') === targetId) {
                 nav.classList.add('active');
             }
         });

         // Dock aktif durumunu doğrudan güncelle (MutationObserver köprüsüne gerek yok)
         document.querySelectorAll('#app-dock .di[data-target]').forEach(function(d) {
             d.classList.toggle('act', d.getAttribute('data-target') === targetId);
         });

         pageSections.forEach(section => {
             section.classList.remove('active');
             if(section.id === targetId) {
                 section.classList.add('active');
             }
         });

         // Aktif sekmeyi hemen kaydet — DOM zaten doğru sekmeyi gösteriyor. Bundan
         // SONRAKİ sekmeye özel render çağrılarından biri (renderGoals, switchCalView
         // vb.) hata fırlatırsa fonksiyonun geri kalanı çalışmadan kesiliyordu; kayıt
         // en sonda olduğu için o zaman hiç yazılmıyordu — sekme görsel olarak
         // değişmiş gibi görünse de sayfa yenilenince eski sekmeye geri dönüyordu
         // (bkz. kullanıcı geri bildirimi: sekmeler arası geçiş sonrası yenilemede
         // yanlış sekmeye dönme). Artık kayıt, aşağıdaki render çağrılarının
         // başarısından bağımsız.
         // NOT: 'zamanlayici' eskiden hariç tutuluyordu (sayfa yenilemede odak
         // seansı sıfırlandığı için kafa karıştırıcı olabileceği düşünülmüştü),
         // ama kullanıcı hangi sekmeden Zamanlayıcı'ya geçerse geçsin yenilemede
         // Zamanlayıcı'da kalmasını istiyor — artık diğer sekmeler gibi kaydediliyor.
         if (!window._restoringTab) {
             FocusStorage.set('lastActiveTab', targetId);
         }

         try {
         if(targetId === 'bugun') {
             renderTasks();
             // 5.4 — Sprint widget güncelle
             if (typeof window.renderTodaySprintWidget === 'function')
                 setTimeout(window.renderTodaySprintWidget, 200);
             // Sınıf ödevleri (social.js window.FocusAssignments) her sekme açılışında
             // taze çekilsin — sadece login anındaki/bildirimdeki önbelleğe güvenmeyelim,
             // öğretmen ödev eklediğinde öğrenci sayfayı yenilemeden de görsün.
             if (window.FocusAssignments && typeof window.FocusAssignments.refresh === 'function') {
                 window.FocusAssignments.refresh();
             }
         }

         if(targetId === 'istatistikler' && typeof renderStatisticsRef === 'function') {
             renderStatisticsRef();
         }
         if(targetId === 'istatistikler' && typeof window.renderPlanningStats === 'function') {
             setTimeout(window.renderPlanningStats, 100);
         }

         if(targetId === 'hedefler' && typeof renderGoals === 'function') {
             renderGoals();
         }
         
         if(targetId === 'gunluk' && typeof renderJournalRef === 'function') {
             // Sekmeye dönüşte, o an hangi görünüm (raf/takvim) aktifse onu yeniden çiz.
             // Aksi halde raf görünümü takvim aktifken (gizliyken, offsetWidth=0) yeniden
             // hesaplanır ve yanlış (fallback) genişlikle bozuk render edilir.
             const calView = document.getElementById('library-calendar-view');
             if (calView && !calView.classList.contains('hidden')) {
                 if (typeof buildCalendarView === 'function') buildCalendarView();
             } else {
                 renderJournalRef();
             }
         }
         
         if(targetId === 'zihin-coplugu' && typeof renderMindDumpsRef === 'function') {
             renderMindDumpsRef();
         }
 
         if(targetId === 'arkadaslar') {
             if(typeof renderSocialStatsRef === 'function') renderSocialStatsRef();
             if(typeof renderBuddyHabitsRef === 'function') renderBuddyHabitsRef();
             if(typeof window.simulateIncomingInvite === 'function') window.simulateIncomingInvite();
             // Başka bir sekmedeyken kaçırılmış olabilecek DM/okunmamış güncellemelerini telafi et
             if(typeof window.resyncRecentConversationsAndUnread === 'function') window.resyncRecentConversationsAndUnread();
             // Arena varsayılan: sosyal bölüme her girişte rekabet panosu açılır.
             // İSTİSNA: sayfa yenileme restorasyonu (social.js _dcRestoreLastOpenOnLoad)
             // kullanıcının kaldığı grup panelini/sohbeti geri açacaksa Arena'yı zorlama —
             // bu çağrı DOMContentLoaded (isTrusted) içinden geldiği için dcSetMainView'ın
             // kendi "otomatik çağrı" koruması onu kullanıcı tıklaması sanıyordu.
             if(typeof window.dcSetMainView === 'function' && !window._dcRestorePending) window.dcSetMainView('home');
             if(typeof window.renderHomeSummary === 'function') window.renderHomeSummary();
             if(typeof window.renderLeaderboardFromCache === 'function') window.renderLeaderboardFromCache();
         }

         if(targetId === 'planlama') {
             if(typeof renderPlanningRef === 'function') renderPlanningRef();
         } else {
             // Planlama'dan başka bir sekmeye geçilirken açık kalan Hedef Detay/Plan
             // Görünümü (tam ekran overlay) kapatılmazsa localStorage'daki
             // 'pg_pv_last_goal' kaydı silinmiyor — sayfa başka bir sekmede
             // (ör. takvim) yenilendiğinde planning.js init() bu kaydı görüp
             // overlay'i sekmeden bağımsız olarak tekrar açıyor, kullanıcıya
             // sanki sayfa hep Planlama'da açılmış gibi görünüyordu.
             if (typeof window.closePlanView === 'function') {
                 const pv = document.getElementById('pg-plan-view');
                 if (pv && !pv.classList.contains('hidden')) window.closePlanView();
             }
         }

         // Takvim sekmesine geçildiğinde storage'dan taze oku ve çiz
         if(targetId === 'takvim') {
             tasks          = Store.tasks.get();
             calendarEvents = Store.events.get();
             if(typeof switchCalView === 'function') {
                 switchCalView(currentCalView || 'monthly');
             }
             // Sınıf ödevleri de taze çekilsin (bkz. 'bugun' dalındaki aynı not)
             if (window.FocusAssignments && typeof window.FocusAssignments.refresh === 'function') {
                 window.FocusAssignments.refresh();
             }
         }
         } catch (e) {
             // Sekmeye özel render çağrılarından biri hata fırlatırsa (ör. bozuk/eksik
             // alanlı bir hedef verisi renderGoals'u çökertirse) sekme geçişi tamamen
             // sessizce yarım kalmasın — en azından DOM/kayıt zaten yukarıda tamamlandı,
             // burada sadece loglayıp devam ediyoruz.
             console.error(`[switchTab] "${targetId}" sekmesi render edilirken hata:`, e);
         }
     }

     window.switchTab = switchTab; // dock ve diğer global çağrılar için

     navLinks.forEach(link => {
         link.addEventListener('click', () => {
             const targetId = link.getAttribute('data-target');
             if(targetId) switchTab(targetId);
         });
     });

     // Nav/dock/section durumunu son aktif sekmeye göre tekrar senkronla
     // (navLinks click listener'ları bağlandıktan sonra emin olmak için).
     applyLastActiveTab();

     let activeFocusTask = null;
     window.__getActiveFocusTaskRef = () => activeFocusTask; // script-task-end-question.js gibi diğer scriptlerden okunması için
     const activeFocusPanel = document.getElementById('active-focus-task');
     const focusTaskNameDisplay = document.getElementById('focus-task-name');
     const clearFocusBtn = document.getElementById('clear-focus-btn');
 
     function startFocusMode(id) {
         activeFocusTask = String(id);
         const task = tasks.find(t => String(t.id) === String(id));
         if(task) {
             focusTaskNameDisplay.textContent = task.text;
             activeFocusPanel.classList.remove('hidden');
             switchTab('zamanlayici'); 
         }
     }
     window.startFocusMode = startFocusMode; 
 
     function clearFocusMode() {
         activeFocusTask = null;
         focusTaskNameDisplay.textContent = "Görev Adı";
         activeFocusPanel.classList.add('hidden');
     }
     window.clearFocusMode = clearFocusMode; 
 
     clearFocusBtn.addEventListener('click', clearFocusMode);
 
     const dateDisplay = document.getElementById('current-date');
     const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
     dateDisplay.textContent = new Date().toLocaleDateString('tr-TR', options);
 
     // timeOptionsList, updateEndPicker, initCustomTimePicker (+ dropdown dışına
     // tıklayınca kapatma dinleyicisi) -> script-time-picker.js dosyasına taşındı
     // (Faz 2, 2026-07-20). window.updateEndPicker/window.initCustomTimePicker
     // köprüsüyle erişilir. Yükleme sırası önemsiz (bkz. o dosyanın başlığı).
 
     window.initCustomTimePicker('task-time-start-box', 'task-time-start-display', 'task-time-start', 'task-time-start-dropdown', (newTime) => {
         const nextTime = window.addOneHour(newTime);
         window.updateEndPicker('task-time-end', nextTime);
     });
     window.initCustomTimePicker('task-time-end-box', 'task-time-end-display', 'task-time-end', 'task-time-end-dropdown');
 
     window.initCustomTimePicker('event-time-start-box', 'event-time-start-display', 'event-time-start', 'event-time-start-dropdown', (newTime) => {
         const nextTime = window.addOneHour(newTime);
         window.updateEndPicker('event-time-end', nextTime);
     });
     window.initCustomTimePicker('event-time-end-box', 'event-time-end-display', 'event-time-end', 'event-time-end-dropdown');
 
     window.initCustomTimePicker('wiz-time-start-box', 'wiz-time-start-display', 'wiz-new-task-start', 'wiz-time-start-dropdown', (newTime) => {
         const nextTime = window.addOneHour(newTime);
         const display = document.getElementById('wiz-time-end-display');
         const input = document.getElementById('wiz-new-task-end');
         const dropdown = document.getElementById('wiz-time-end-dropdown');
         if (display && input) { display.textContent = nextTime; input.value = nextTime; }
         if (dropdown) {
             dropdown.querySelectorAll('.custom-time-option').forEach(opt => {
                 opt.classList.remove('selected');
                 if (opt.textContent === nextTime) opt.classList.add('selected');
             });
         }
     });
     window.initCustomTimePicker('wiz-time-end-box', 'wiz-time-end-display', 'wiz-new-task-end', 'wiz-time-end-dropdown');
 
     
    // saveMindDumps, dumpRelativeTime, tag yardımcıları (getDumpCustomTags/
    // saveDumpCustomTags/getDumpTagMeta), renderDumpInlineTagRow, renderMindDumps,
    // renderDumpFilterBtns, özel etiket yönetimi (openAddCustomTagPrompt vb.),
    // submitInlineDump, addMindDump, window.selectDumpInlineTag/changeDumpTag/
    // toggleDumpTagPicker -> script-mind-dump.js dosyasına taşındı (Faz 2,
    // 2026-07-20). window.saveMindDumps/window.renderMindDumps köprüsüyle
    // erişilir ("Dönüştür" modalı gibi script.js'te kalan yerlerden).

     const cddContentEl = document.getElementById('cdd-content');
     if (cddContentEl) {
         cddContentEl.addEventListener('click', (e) => {
             const el = e.target.closest('[data-action]');
             if (!el) return;
             const action = el.dataset.action;
             const id = el.dataset.id;
             const date = el.dataset.date;
             if (action === 'cdd-toggle-task') {
                 toggleTask(id);
                 window.renderDayDrawer(date);
                 if (window.renderCalendarGlobal) window.renderCalendarGlobal();
             } else if (action === 'cdd-edit-task') {
                 e.stopPropagation();
                 window.editTask(id);
             } else if (action === 'cdd-delete-task') {
                 e.stopPropagation();
                 deleteGlobalTask(id, date);
                 setTimeout(() => {
                     window.renderDayDrawer(date);
                     if (window.renderCalendarGlobal) window.renderCalendarGlobal();
                 }, 80);
             } else if (action === 'cdd-toggle-habit') {
                 window.toggleHabitFromToday(id, date);
                 window.renderDayDrawer(date);
             }
         });
     }

    // window.deleteMindDump, window.startDumpEdit -> script-mind-dump.js dosyasına
    // taşındı (Faz 2, 2026-07-20).
 
     const taskInput = document.getElementById('task-input');
     const taskParentSelect = document.getElementById('task-parent-habit');
     const taskPriority = document.getElementById('task-priority');
     const taskCategory = document.getElementById('task-category'); 
     const taskTimeStart = document.getElementById('task-time-start'); 
     const taskTimeEnd = document.getElementById('task-time-end'); 
     
     const addTaskBtn = document.getElementById('add-task-btn');
     const taskList = document.getElementById('task-list');
     const pendingCountDisplay = document.getElementById('pending-count');
     const completedCountDisplay = document.getElementById('completed-count');

     if (taskList) {
         taskList.addEventListener('click', (e) => {
             const el = e.target.closest('[data-action]');
             if (!el) return;
             const action = el.dataset.action;
             const id = el.dataset.id;
             if (action === 'toggle-highlight-task') window.toggleHighlightTask(el.dataset.date);
             else if (action === 'toggle-task') window.toggleTask(id);
             else if (action === 'edit-task') window.editTask(id);
             else if (action === 'focus-task') window.startFocusMode(id);
             else if (action === 'delete-task') window.deleteGlobalTask(id, el.dataset.date);
             else if (action === 'toggle-habit-today') window.toggleHabitFromToday(id, el.dataset.date);
         });
         taskList.addEventListener('change', (e) => {
             const el = e.target.closest('[data-action="change-task-goal"]');
             if (!el) return;
             window.changeTaskGoal(el.dataset.id, el.value);
         });
     }

     let draggedItemIndex = null;

 // _spawnChipParticles, _celebrateDoneChip, animateCount -> script-misc-widgets.js
 // dosyasına taşındı (Faz 2, 2026-07-20). window.* köprüsüyle erişilir.

     function updateDailyProgress() {
         const circle = document.getElementById('daily-progress-circle');
         const progressText = document.getElementById('daily-progress-text');
         if(!progressText) return;

         const todayStr = window.formatDateToString(new Date());
         const todayHabits = getHabitsForDate(todayStr);
         const todayTasks = tasks.filter(t => t.date === todayStr && !t.isLessonPlanDraft);

         let highlightHistory = FocusStorage.get('highlight_history', {});
         let highlightTotal = 0;
         let highlightCompleted = 0;

         if (highlightHistory[todayStr]) {
             highlightTotal = 1;
             if (highlightHistory[todayStr].completed) highlightCompleted = 1;
         }

         const totalTasks = todayTasks.length + todayHabits.length + highlightTotal;
         const completedTasks = todayTasks.filter(t => t.completed).length + todayHabits.filter(h => !!h.history[todayStr]).length + highlightCompleted;
         const percentage = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

         if (circle) {
             const circumference = 175.9; // r=28, 2*π*28≈175.9
             circle.style.strokeDashoffset = circumference - (percentage / 100) * circumference;
         }

         // Mini donut (Tamamlanan kartı)
         const doneRing = document.getElementById('td-done-ring-circle');
         if (doneRing) {
             const dc = 113.1; // r=18, 2*π*18≈113.1
             doneRing.style.strokeDashoffset = dc - (percentage / 100) * dc;
         }

         const fill = document.getElementById('td-progress-fill');
         if (fill) {
             fill.style.width = percentage + '%';
         }

         progressText.textContent = `${percentage}%`;
         progressText.style.color = (percentage === 100 && totalTasks > 0) ? '#4ADE80' : '#ecc987';

         const ratio = document.getElementById('td-task-ratio');
         if (ratio) ratio.innerHTML = `${completedTasks}<span style="color:#6b665c"> / </span>${totalTasks}`;
         const totalCount = document.getElementById('td-total-count');
         if (totalCount) totalCount.textContent = `/ ${totalTasks}`;
     }
 
     // script-calendar-dragdrop.js (ayrı dosyaya çıkarıldı) bare updateStats()
     // çağrısı yapamadığı için window.updateStats gerekiyor.
     window.updateStats = function() { return updateStats(); };
     function updateStats() {
         const todayStr = window.formatDateToString(new Date());
         const todayHabits = getHabitsForDate(todayStr);
         const todayTasks = tasks.filter(t => t.date === todayStr && !t.isLessonPlanDraft);
 
         let highlightHistory = FocusStorage.get('highlight_history', {});
         let highlightTotal = 0;
         let highlightCompleted = 0;
         
         if (highlightHistory[todayStr]) {
             highlightTotal = 1;
             if (highlightHistory[todayStr].completed) highlightCompleted = 1;
         }
 
         const pending = todayTasks.filter(t => !t.completed).length + todayHabits.filter(h => !h.history[todayStr]).length + (highlightTotal - highlightCompleted);
         const completed = todayTasks.filter(t => t.completed).length + todayHabits.filter(h => !!h.history[todayStr]).length + highlightCompleted;
         
         const completedChip = completedCountDisplay ? completedCountDisplay.closest('.td-chip-done') : null;
         const pendingChip = pendingCountDisplay ? pendingCountDisplay.closest('.td-chip') : null;
         if (pendingChip) pendingChip.classList.toggle('td-chip-pending-active', pending > 0);
         window.animateCount(pendingCountDisplay, pending);
         window.animateCount(completedCountDisplay, completed, { celebrateChip: completedChip });
         updateDailyProgress();
         renderTodayGoalCard();
         renderTodayTaskSplit();

         // Görev bölümü meta: "X görev · HH:MM – HH:MM"
         const tasksMeta = document.getElementById('td-tasks-meta');
         if (tasksMeta) {
             const total = pending + completed;
             if (total > 0) {
                 const times = todayTasks.map(t => t.timeStart).filter(Boolean).sort();
                 const endTimes = todayTasks.map(t => t.timeEnd).filter(Boolean).sort();
                 const firstTime = times[0] || null;
                 const lastTime = endTimes[endTimes.length - 1] || null;
                 tasksMeta.textContent = total + ' görev' + (firstTime && lastTime ? ' · ' + firstTime + ' – ' + lastTime : '');
             } else {
                 tasksMeta.textContent = '';
             }
         }
     }

     function renderTodayGoalCard() {
         const card = document.getElementById('today-goal-card');
         if (!card) return;
         card.style.display = 'none';
         return;
         const todayStr = window.formatDateToString(new Date());
         const highlightHistory = FocusStorage.get('highlight_history', {});
         const todayHighlight = highlightHistory[todayStr];
         if (!todayHighlight) {
             card.style.display = 'none';
             return;
         }
         card.style.display = 'flex';
         const isCompleted = todayHighlight.completed;
         const icon = isCompleted ? '✅' : '🎯';
         const tagColor = isCompleted ? 'color:var(--g);background:var(--g10,rgba(74,222,128,.1));border-color:rgba(74,222,128,.2)' : 'color:var(--a,#ff9f43);background:rgba(255,159,67,.1);border-color:rgba(255,159,67,.2)';
         const tagText = isCompleted ? 'Tamamlandı' : 'Günün Odağı';
         card.innerHTML = `
             <div style="font-size:26px;flex-shrink:0;">${icon}</div>
             <div style="flex:1;min-width:0;">
                 <div style="font-size:11px;font-weight:600;letter-spacing:.5px;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;">Günün Hedefi</div>
                 <div style="font-size:14px;font-weight:600;line-height:1.4;color:#fff;${isCompleted ? 'text-decoration:line-through;opacity:.6;' : ''}">${escapeHtml(todayHighlight.text || '')}</div>
             </div>
             <span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap;border:1px solid;${tagColor}">${tagText}</span>`;
     }

     function renderTodayTaskSplit() {
         const pendingList = document.getElementById('today-pending-list');
         const completedList = document.getElementById('today-completed-list');
         const pendingHd = document.getElementById('today-pending-hd');
         const completedHd = document.getElementById('today-completed-hd');
         if (!pendingList || !completedList) return;
         const todayStr = window.formatDateToString(new Date());
         const todayTasks = tasks.filter(t => t.date === todayStr && !t.isLessonPlanDraft);
         const pending = todayTasks.filter(t => !t.completed);
         const completed = todayTasks.filter(t => t.completed);
         if (pendingHd) pendingHd.textContent = `⏳ Bekleyen (${pending.length})`;
         if (completedHd) completedHd.textContent = `✅ Tamamlanan (${completed.length})`;
         const taskItem = (t) => `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;cursor:pointer;" data-action="toggle-today-task" data-id="${t.id}">
             <div style="width:16px;height:16px;border-radius:4px;border:1.5px solid ${t.completed ? 'var(--g,#2ed573)' : 'rgba(255,255,255,0.2)'};background:${t.completed ? 'var(--g,#2ed573)' : 'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;color:#000;">
                 ${t.completed ? '✓' : ''}</div>
             <span style="font-size:12px;${t.completed ? 'text-decoration:line-through;opacity:.5;' : ''}color:#fff;">${escapeHtml(t.text)}</span>
         </div>`;
         pendingList.innerHTML = pending.length ? pending.map(taskItem).join('') : '<div style="font-size:12px;color:var(--text-muted);padding:6px 0;">Tüm görevler tamamlandı 🎉</div>';
         completedList.innerHTML = completed.length ? completed.map(taskItem).join('') : '<div style="font-size:12px;color:var(--text-muted);padding:6px 0;">Henüz tamamlanan yok</div>';
         if (!pendingList.dataset.delegated) {
             pendingList.dataset.delegated = '1';
             pendingList.addEventListener('click', (e) => {
                 const el = e.target.closest('[data-action="toggle-today-task"]');
                 if (el) window.toggleTask(el.dataset.id);
             });
         }
         if (!completedList.dataset.delegated) {
             completedList.dataset.delegated = '1';
             completedList.addEventListener('click', (e) => {
                 const el = e.target.closest('[data-action="toggle-today-task"]');
                 if (el) window.toggleTask(el.dataset.id);
             });
         }
     }
 
     const taskCategoryLabels = { 'kisisel': 'Kişisel', 'is': 'İş', 'egitim': 'Eğitim', 'saglik': 'Sağlık' };

     // Faz F (3. tur): Kategori/hedef/görev renk yardımcıları (getCatColor/
     // getGoalColor/getTaskColor/getHabitCategoryLabel, PRIORITY_DOT_COLOR)
     // script-color-utils.js'e taşındı, window.* köprüleriyle kullanılıyor.

     function renderTasks() {
         taskList.innerHTML = '';
         const todayStr = window.formatDateToString(new Date());
         
         let highlightHistory = FocusStorage.get('highlight_history', {});
         
         if (highlightHistory[todayStr]) {
             const todayHighlight = highlightHistory[todayStr];
             let parentBadgeHTML = '';
             if (todayHighlight.parentGoal) {
                 const pg = goals.find(g => String(g.id) === String(todayHighlight.parentGoal));
                 if (pg) {
                     parentBadgeHTML = `<span class="task-category-tag" style="background: rgba(108, 92, 231, 0.1); color: var(--primary-color); border: 1px solid rgba(108, 92, 231, 0.2); margin-left: 5px;"><i class="fa-solid fa-bullseye"></i> ${escapeHtml(pg.title)}</span>`;
                 }
             }
 
             const hlLi = document.createElement('li');
             hlLi.className = `task-item highlight-task ${todayHighlight.completed ? 'completed' : ''}`;

             hlLi.innerHTML = `
                 <div class="tl-time-col">
                     <i class="fa-solid fa-star" style="color: #ff9f43; font-size: 13px;" title="Günün En Önemli 1 Şeyi"></i>
                 </div>
                 <div class="tl-rail">
                     <span class="tl-rail-line"></span>
                     <span class="tl-rail-dot" style="border-color:#ff9f43"></span>
                     <span class="tl-rail-line"></span>
                 </div>
                 <div class="tl-card">
                     <div class="tl-card-inner" style="border-color: rgba(255,159,67,0.25); background: rgba(255,159,67,0.04);">
                         <div class="task-checkbox" data-action="toggle-highlight-task" data-date="${todayStr}"></div>
                         <div class="task-left">
                             <span class="task-text" data-action="toggle-highlight-task" data-date="${todayStr}">${escapeHtml(todayHighlight.text)}</span>
                             <div class="task-meta">
                                 <span class="task-category-tag" style="background: rgba(255, 159, 67, 0.15); color: #ff9f43; border: 1px solid rgba(255, 159, 67, 0.3);"><i class="fa-solid fa-star" style="margin-right:4px;"></i>GÜNÜN HEDEFİ</span>
                                 ${parentBadgeHTML}
                             </div>
                         </div>
                     </div>
                 </div>
             `;
             taskList.appendChild(hlLi);
         }

         // ── Sınıf ödevleri (bugün teslim tarihi olanlar) ──
         // classroom_assignments (social.js, window.FocusAssignments) sistemin geri kalanıyla
         // burada senkronlanır: normal görevlerden ayırt edilsin diye kendi ikonu/rengi var ve
         // tıklanınca ilgili grubun Ödevler sekmesine götürür (checkbox ile tamamlanmaz).
         const todayAssignments = (window.FocusAssignments?.items || []).filter(a => {
             if (a.done || !a.due_date) return false;
             return window.formatDateToString(new Date(a.due_date)) === todayStr;
         });
         todayAssignments.forEach(a => {
             const overdue = new Date(a.due_date) < new Date();
             const asgColor = overdue ? '#ff6b6b' : '#a29bfe';
             const li = document.createElement('li');
             li.className = 'task-item';
             li.style.borderLeftColor = asgColor;
             li.style.background = `linear-gradient(90deg, ${overdue ? 'rgba(255, 107, 107, 0.05)' : 'rgba(162, 155, 254, 0.05)'} 0%, transparent 100%)`;
             li.style.cursor = 'pointer';
             li.innerHTML = `
                 <div class="task-left">
                     <i class="fa-solid fa-clipboard-list" style="color: ${asgColor}; margin-right: 5px;" title="Sınıf Ödevi"></i>
                     <div class="task-checkbox" style="border-color: ${asgColor}; cursor:pointer;"></div>
                     <span class="task-text">${escapeHtml(a.title)}</span>
                     <div style="flex-basis: 100%; height: 0;"></div>
                     <div class="task-meta">
                         <span class="task-category-tag" style="background: ${overdue ? 'rgba(255, 107, 107, 0.15)' : 'rgba(162, 155, 254, 0.15)'}; color: ${asgColor}; border: 1px solid ${overdue ? 'rgba(255, 107, 107, 0.3)' : 'rgba(162, 155, 254, 0.3)'};">${overdue ? 'ÖDEV · SÜRESİ GEÇTİ' : 'ÖDEV'}</span>
                         ${a.groupName ? `<span class="task-category-tag" style="background: rgba(108, 92, 231, 0.1); color: var(--primary-color); border: 1px solid rgba(108, 92, 231, 0.2); margin-left: 5px;">${escapeHtml(a.groupName)}</span>` : ''}
                     </div>
                 </div>
             `;
             li.addEventListener('click', () => {
                 if (typeof window.switchTab === 'function') window.switchTab('arkadaslar');
                 if (typeof window.dcOpenAssignmentTab === 'function') window.dcOpenAssignmentTab(a.groupCode);
             });
             taskList.appendChild(li);
         });

         let yest = new Date();
         yest.setDate(yest.getDate() - 1);
         const yesterdayStr = window.formatDateToString(yest);
 
         // Hem bugünün görevlerini hem de dünden sarkan (gece kuşu) görevlerini al
         // isLessonPlanDraft: öğretmenin BAŞKA BİR öğrenci için henüz atamadığı ders planı
         // taslağını hazırlarken oluşturduğu "sahte" görevler — bunlar öğretmenin kendi
         // görev listesinde değil, sadece planlama arayüzünün kendi Gün Paneli'nde görünmeli.
         const todayTasks = tasks.filter(t =>
             !t.isLessonPlanDraft && (
                 t.date === todayStr ||
                 (t.date === yesterdayStr && t.isOvernight)
             )
         );
 
         // Bekleyenler üste (alışkanlıklar önce, sonra normal görevler), tamamlananlar alta
         todayTasks.sort((a, b) => {
             if (a.completed !== b.completed) return a.completed ? 1 : -1;
             const aH = !!a.parentHabit, bH = !!b.parentHabit;
             if (aH !== bH) return aH ? -1 : 1;
             return 0;
         });

         const completedCount = todayTasks.filter(t => t.completed).length;
         let dividerInserted = false;
         let habitHeaderInserted = false;
         let taskHeaderInserted = false;

         todayTasks.forEach((task, index) => {
             // Tamamlananlar başlamadan önce ayraç ekle
             if (!dividerInserted && task.completed && completedCount > 0) {
                 dividerInserted = true;
                 habitHeaderInserted = false;
                 taskHeaderInserted = false;
                 const divider = document.createElement('li');
                 divider.className = 'task-divider';
                 divider.innerHTML = `<span>${completedCount} tamamlandı</span>`;
                 taskList.appendChild(divider);
             }

             if (!task.completed) {
                 // Bekleyen alışkanlıklar için grup başlığı
                 if (task.parentHabit && !habitHeaderInserted) {
                     habitHeaderInserted = true;
                     const hd = document.createElement('li');
                     hd.style.cssText = 'list-style:none;padding:6px 2px 2px;font-size:11px;font-weight:700;letter-spacing:.8px;color:#c88ce6;text-transform:uppercase;display:flex;align-items:center;gap:6px;';
                     hd.innerHTML = '<i class="fa-solid fa-leaf"></i> Alışkanlıklar';
                     taskList.appendChild(hd);
                 }
                 // Normal görev başlığı (alışkanlıktan sonra geliyorsa)
                 if (!task.parentHabit && !taskHeaderInserted && habitHeaderInserted) {
                     taskHeaderInserted = true;
                     const hd = document.createElement('li');
                     hd.style.cssText = 'list-style:none;padding:10px 2px 2px;font-size:11px;font-weight:700;letter-spacing:.8px;color:var(--text-muted);text-transform:uppercase;display:flex;align-items:center;gap:6px;border-top:1px solid rgba(255,255,255,0.05);margin-top:4px;';
                     hd.innerHTML = '<i class="fa-solid fa-list-check"></i> Görevler';
                     taskList.appendChild(hd);
                 }
             }

             const li = document.createElement('li');
             const isHabitTask = !!task.parentHabit;
            li.className = `task-item ${task.completed ? 'completed' : ''} ${task.isMilestone ? 'milestone-task' : isHabitTask ? 'habit-task' : `priority-${task.priority || 'medium'}`}`;
             li.draggable = true; 
             
             const cat = task.category || 'kisisel';
             const catDisplay = taskCategoryLabels[cat] || 'Kişisel';
             const tStart = (task.timeStart || "09:00").substring(0, 5);
             const tEnd = (task.timeEnd || "10:00").substring(0, 5);
 
             let parentBadgeHTML = '';
             if (task.parentHabit) {
                 const ph = habits.find(h => String(h.id) === String(task.parentHabit));
                 if (ph) {
                     parentBadgeHTML = `<span class="parent-habit-badge"><i class="fa-solid fa-bullseye"></i> ${escapeHtml(ph.name)}</span>`;
                 }
             }
 
             let milestoneBadgeHTML = '';
             if (task.isMilestone) {
                 milestoneBadgeHTML = `<span class="parent-habit-badge" style="color:#74b9ff; border-color:rgba(9,132,227,0.4); background:rgba(9,132,227,0.12); font-weight:700; font-size:11px; padding: 3px 10px;"><i class="fa-solid fa-flag-checkered" style="margin-right:4px;"></i>Dönüm Noktası</span>`;
             }
 
             let goalOptionsHTML = '<option value="">🎯 Hedefsiz</option>';
             goals.forEach(g => {
                 const isSelected = task.parentGoal === g.id ? 'selected' : '';
                 goalOptionsHTML += `<option value="${g.id}" ${isSelected}>${escapeHtml(g.title)}</option>`;
             });
 
             // --- YENİ: Hiyerarşik Yol Haritası (Breadcrumb) Rozeti ---
         let breadcrumbParts = [];
 
         // 1. Ana Hedef — önce eski goals sistemini, sonra planning_goals modülünü kontrol et
         if (task.parentGoal) {
             let parentGoalInfo = goals.find(g => String(g.id) === String(task.parentGoal));
             let isPlanningGoal = false;
             if (!parentGoalInfo && String(task.parentGoal).startsWith('pg_')) {
                 // Planning modülü hedefi
                 const _pg = (typeof FocusStorage !== 'undefined')
                     ? FocusStorage.get('planning_goals', [])
                     : JSON.parse(localStorage.getItem('planning_goals') || '[]');
                 parentGoalInfo = _pg.find(g => g.id === task.parentGoal);
                 isPlanningGoal = !!parentGoalInfo;
             }
             if (parentGoalInfo) {
                 breadcrumbParts.push(`<span style="display:inline-flex; align-items:center; gap:5px; color:#feca57;" title="Ana Hedef"><i class="fa-solid fa-mountain-sun"></i> ${escapeHtml(parentGoalInfo.title)}</span>`);

                 // 2. Dönüm Noktası
                 if (task.parentMilestone) {
                     const milestones = parentGoalInfo.milestones || [];
                     // Eski sistem: ms.text | Planlama modülü: ms.title
                     const milestoneInfo = milestones.find(m => String(m.id) === String(task.parentMilestone));
                     if (milestoneInfo) {
                         const msLabel = milestoneInfo.title || milestoneInfo.text || '';
                         breadcrumbParts.push(`<span style="display:inline-flex; align-items:center; gap:5px; color:#0984e3;" title="Dönüm Noktası"><i class="fa-solid fa-flag-checkered"></i> ${escapeHtml(msLabel)}</span>`);
                     }
                 }
             }
         }
 
         // 3. Alışkanlık
         if (task.parentHabit) {
             const habitInfo = (typeof habits !== 'undefined') ? habits.find(h => String(h.id) === String(task.parentHabit)) : null;
             if (habitInfo) {
                 // Alışkanlık ismini güvenli şekilde alıyoruz
                 const habitName = habitInfo.title || habitInfo.text || habitInfo.name || "Alışkanlık"; 
                 breadcrumbParts.push(`<span style="display:inline-flex; align-items:center; gap:5px; color:#c88ce6;" title="Bağlı Alışkanlık"><i class="fa-solid fa-leaf"></i> ${window.escapeHtml(habitName)}</span>`);
             }
         }
 
         let breadcrumbHTML = '';
         if (breadcrumbParts.length > 0) {
             // Aralarına şık bir ok işareti (chevron-right) ekleyerek birleştiriyoruz
             const joinedParts = breadcrumbParts.join('<i class="fa-solid fa-chevron-right" style="color: rgba(255,255,255,0.2); font-size: 10px; margin: 0 4px;"></i>');
             
             breadcrumbHTML = `<div style="flex-basis: 100%; height: 0;"></div>
             <div class="task-breadcrumb-badge" style="display: inline-flex; align-items: center; background: rgba(0,0,0,0.25); padding: 5px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); font-size: 12px; font-weight: 500; margin-top: 8px; flex-wrap: wrap; gap: 6px;">
                 ${joinedParts}
             </div>`;
         
         }
         // ----------------------------------------------
             
                          const prioColorMap = { high: '#d98a6a', medium: '#d9b16a', low: '#8d887c' };
             const dotColor = task.isMilestone ? '#74b9ff' : isHabitTask ? '#c88ce6' : (prioColorMap[task.priority || 'medium'] || '#d9b16a');

             li.innerHTML = `
                 <div class="tl-time-col">
                     <span class="tl-time-start">${tStart}</span>
                     <span class="tl-time-end">${tEnd}</span>
                 </div>
                 <div class="tl-rail">
                     <span class="tl-rail-line"></span>
                     <span class="tl-rail-dot" style="border-color:${dotColor}"></span>
                     <span class="tl-rail-line"></span>
                 </div>
                 <div class="tl-card">
                     <div class="tl-card-inner">
                         <div class="task-checkbox" data-action="toggle-task" data-id="${task.id}"></div>
                         <div class="task-left">
                             <span class="task-text" data-action="toggle-task" data-id="${task.id}">${escapeHtml(task.text)}</span>
                             <div class="task-meta">
                                 ${isHabitTask
                                     ? `<span class="task-category-tag tag-habit"><i class="fa-solid fa-leaf" style="margin-right:4px;"></i>Al\u0131\u015fkanl\u0131k</span>`
                                     : `<span class="task-category-tag tag-${cat}">${catDisplay}</span>`}
                                 <span style="width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.2);display:inline-block;vertical-align:middle;flex-shrink:0;"></span>
                                 <span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--t3);"><span style="width:6px;height:6px;border-radius:50%;background:${dotColor};flex-shrink:0;display:inline-block;"></span>${task.priority === 'high' ? 'Y\u00fcksek' : task.priority === 'low' ? 'D\u00fc\u015f\u00fck' : 'Orta'}</span>
                                 <span style="width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.2);display:inline-block;vertical-align:middle;flex-shrink:0;"></span>
                                 <span style="font-variant-numeric:tabular-nums;font-size:11.5px;color:var(--t3);">${tStart}\u2013${tEnd}</span>
                                 ${task.recurring ? `<span class="task-time-badge" style="color:#a29bfe; border-color:rgba(162,155,254,0.3);margin-left:2px;"><i class="fa-solid fa-rotate"></i> ${{daily:'Her G\u00fcn', weekdays:'Hafta \u0130\u00e7i', weekly:'Her Hafta', monthly:'Her Ay'}[task.recurring]}</span>` : ''}
                             </div>
                             ${breadcrumbHTML}
                         </div>
                         <div class="task-item-right">
                             <select class="mini-goal-select" data-action="change-task-goal" data-id="${task.id}">
                                 ${goalOptionsHTML}
                             </select>
                             <div class="task-actions">
                                 ${!task.completed ? `<button class="edit-btn" data-action="edit-task" data-id="${task.id}" title="G\u00f6revi D\u00fczenle"><i class="fa-solid fa-pen"></i></button>` : ''}
                                 ${!task.completed ? `<button class="focus-btn" data-action="focus-task" data-id="${task.id}" title="Bu G\u00f6reve Odaklan"><i class="fa-solid fa-crosshairs"></i></button>` : ''}
                                 <button class="delete-btn" data-action="delete-task" data-id="${task.id}" data-date="${task.date}"><i class="fa-solid fa-trash-can"></i></button>
                             </div>
                         </div>
                     </div>
                 </div>
             `;
 
             li.addEventListener('dragstart', function(e) { 
                 draggedItemIndex = index; 
                 setTimeout(() => this.classList.add('dragging'), 0);
                 if (e.dataTransfer) {
                     e.dataTransfer.effectAllowed = "move";
                     e.dataTransfer.setData('taskId', task.id); // ← EKSİK OLAN BU SATIRDI
                 }
             });
 
             li.addEventListener('dragend', function() { 
                 this.classList.remove('dragging'); 
             });
             li.addEventListener('dragover', function(e) { 
                 e.preventDefault(); 
                 if (e.dataTransfer) e.dataTransfer.dropEffect = "move"; 
             });
             li.addEventListener('dragenter', function(e) { 
                 e.preventDefault(); 
                 if(index !== draggedItemIndex) this.classList.add('drag-over'); 
             });
             li.addEventListener('dragleave', function() { 
                 this.classList.remove('drag-over'); 
             });
             li.addEventListener('drop', function(e) {
                 e.preventDefault();
                 this.classList.remove('drag-over');
                 
                 // Eğer farklı bir sıraya bırakıldıysa yerlerini değiştir ve KAYDET
                 if (draggedItemIndex !== null && draggedItemIndex !== index) {
                     const draggedTask = todayTasks[draggedItemIndex];
                     todayTasks.splice(draggedItemIndex, 1);
                     todayTasks.splice(index, 0, draggedTask);
 
                     // Ana görev listesini bu yeni sıralamaya göre güncelle
                     const otherTasks = tasks.filter(t => t.date !== todayStr);
                     tasks = [...otherTasks, ...todayTasks];
 
                     saveTasks(); // Değişikliği hafızaya kazı
                 }
                 draggedItemIndex = null;
                 renderTasks(); 
             });
 
             taskList.appendChild(li);
         });
 
         const todayHabits = getHabitsForDate(todayStr);
 
         todayHabits.forEach(habit => {
             const isCompleted = !!habit.history[todayStr];
             const catDisplay = getHabitCategoryLabel(habit.category);
             const buddyBadge = (habit.buddy && habit.buddy !== 'none') ? `<span class="task-category-tag" style="background: rgba(46, 213, 115, 0.15); color: #2ed573; border-color: rgba(46, 213, 115, 0.3); margin-left: 5px;" title="Ortak Partner: ${escapeHtml(habit.buddy)}"><i class="fa-solid fa-user-group"></i> ${escapeHtml(habit.buddy.split(' ')[0])}</span>` : '';
             
             // --- YENİ: Bağlı Hedefleri Rozet Olarak Hazırla ---
             let goalBadgesHTML = '';
             if (habit.parentGoals && habit.parentGoals.length > 0) {
                 habit.parentGoals.forEach(goalId => {
                     const goal = goals.find(g => String(g.id) === String(goalId));
                     if (goal) {
                         goalBadgesHTML += `<span class="task-category-tag" style="background: rgba(108, 92, 231, 0.1); color: var(--primary-color); border: 1px solid rgba(108, 92, 231, 0.2); margin-left: 5px;"><i class="fa-solid fa-bullseye"></i> ${escapeHtml(goal.title)}</span>`;
                     }
                 });
             }
 
            // --- script.js içinde renderTasks fonksiyonunun altındaki ilgili alanı bu blokla değiştirin ---
            let hasPendingTaskForGoal = false;
            if (habit.parentGoals && habit.parentGoals.length > 0) {
                hasPendingTaskForGoal = tasks.some(t => 
                    t.date === todayStr && 
                    !t.completed && 
                    t.parentGoal && 
                    // YENİ KOŞUL: Sadece sistemde hâlâ mevcut olan (silinmemiş) aktif hedeflerin görevlerini kilitler
                    goals.some(g => String(g.id) === String(t.parentGoal)) &&
                    habit.parentGoals.includes(String(t.parentGoal))
                );
            }

            // GÜNCELLENEN KİLİT AÇICI: Eğer hedef silindiyse veya kilit yoksa tıklama niteliğini koşulsuz açar
            const clickAttr = hasPendingTaskForGoal ? "" : `data-action="toggle-habit-today" data-id="${habit.id}" data-date="${todayStr}"`;
            const autoBadge = hasPendingTaskForGoal ? `<span class="task-time-badge" style="background: rgba(255, 159, 67, 0.1); color: #ff9f43; border: 1px solid rgba(255, 159, 67, 0.2); margin-left: 5px;"><i class="fa-solid fa-bolt"></i> Görevle Tamamlanacak</span>` : '';

 
             const li = document.createElement('li');
             li.className = `task-item ${isCompleted ? 'completed' : ''} priority-low`;
             
             if(hasPendingTaskForGoal) {
                 li.style.opacity = "0.75";
                 li.style.background = "rgba(255, 255, 255, 0.02)";
             }
             
             li.innerHTML = `
                 <div class="task-left">
                     <i class="fa-solid fa-leaf drag-handle" style="cursor:default; opacity:0.5;" title="Alışkanlık"></i>
                     <div class="task-checkbox" ${clickAttr} style="${hasPendingTaskForGoal ? 'cursor:not-allowed; border-color:var(--text-muted);' : ''}"></div>
                     <span class="task-text" ${clickAttr} style="${hasPendingTaskForGoal ? 'cursor:not-allowed;' : ''}">${escapeHtml(habit.name)}</span>
                     <div style="flex-basis: 100%; height: 0;"></div> 
                     <div class="task-meta">
                         <span class="task-category-tag tag-${habit.category || 'kisisel'}">${catDisplay}</span>
                         <span class="task-time-badge habit-badge" title="Tüm Gün"><i class="fa-solid fa-repeat"></i> Tüm Gün</span>
                         ${buddyBadge}
                         ${goalBadgesHTML}
                         ${autoBadge}
                     </div>
                 </div>
             `;
             taskList.appendChild(li);
         });
 
         updateStats();
         if(renderStatisticsRef && document.getElementById('istatistikler').classList.contains('active')) renderStatisticsRef();
         if(renderSocialStatsRef && document.getElementById('arkadaslar').classList.contains('active')) renderSocialStatsRef();
         if(renderBuddyHabitsRef && document.getElementById('arkadaslar').classList.contains('active')) renderBuddyHabitsRef();
     }
     window.renderTasks = renderTasks; // script-milestone-goal-actions.js gibi ayrı modüllerden erişim için

     // Faz F (3. tur): playTaskCompleteSound() script-task-complete-sound.js'e
     // taşındı (window.playTaskCompleteSound köprüsü ile).

     window.toggleTask = function(id) {
         const task = tasks.find(t => String(t.id) === String(id));
         if(task) {
             const willComplete = !task.completed;
             const habitsSnapBeforeToggle = willComplete ? JSON.parse(JSON.stringify(habits)) : null;
             task.completed = willComplete;
 
             if (willComplete) {
                 const _snapTaskId = task.id;
                 const _snapTaskText = task.text;
                 const _snapHabits = habitsSnapBeforeToggle;
                 setTimeout(() => showUndoToast(`"${_snapTaskText}" tamamlandı ✓`, () => {
                     const t = tasks.find(x => String(x.id) === String(_snapTaskId));
                     if (t) t.completed = false;
                     if (_snapHabits) habits.splice(0, habits.length, ..._snapHabits);
                     saveHabits(); saveTasks(); renderTasks(); renderGoals();
                     if (typeof renderHabitsRef === 'function') renderHabitsRef();
                     if (typeof renderEventsRef === 'function') renderEventsRef();
                 }), 0);
 
                 const _burstEl = document.querySelector(`[onclick*="toggleTask('${id}')"]`);
                 if (_burstEl) { const _r = _burstEl.getBoundingClientRect(); window.microBurst(_r.left + _r.width / 2, _r.top + _r.height / 2); }

                 if (window.FocusAISocial && typeof window.FocusAISocial.postActivity === 'function') {
                     window.FocusAISocial.postActivity(`"${task.text}" görevini tamamladı ✅`);
                 }
             }
             
             // 1. KLASİK SİNERJİ: Görev doğrudan bir alışkanlığın alt göreviyse
             // (willComplete=false için de çağrılmalı, yoksa görev geri alındığında
             // bağlı alışkanlığın tiki hiç kalkmıyordu — kalıcı desync.)
             if (task.parentHabit) {
                 window.checkSynergy(task.parentHabit, task.date, willComplete);
             }
     
             // 2. YENİ HEDEF SİNERJİSİ: Görev bir Ana Hedef'e bağlıysa
             if (task.parentGoal) {
                 let habitUpdated = false;
                 
                 habits.forEach(habit => {
                     // Eğer bu alışkanlığın hedefleri arasında, görevin bağlı olduğu hedef varsa:
                     if (habit.parentGoals && habit.parentGoals.includes(String(task.parentGoal))) {
                         
                         if (willComplete && !habit.history[task.date]) {
                             // Görev tamamlandıysa alışkanlığı da tamamla
                             habit.history[task.date] = true; 
                             habitUpdated = true;
                         } 
                         else if (!willComplete) {
                             // Görev iptal edildiyse, bu hedefe/alışkanlığa bağlı BUGÜN bitmiş BAŞKA görev var mı kontrol et
                             const otherTasksDone = tasks.some(t => 
                                 t.id !== task.id && 
                                 t.date === task.date && 
                                 t.completed && 
                                 ((t.parentGoal && habit.parentGoals.includes(String(t.parentGoal))) || t.parentHabit === habit.id)
                             );
                             
                             // Başka bitmiş görev yoksa alışkanlığın tikini geri al
                             if (!otherTasksDone) {
                                 delete habit.history[task.date];
                                 habitUpdated = true;
                             }
                         }
                     }
                 });
     
                 // Eğer bir alışkanlık otomatik tamamlandıysa kaydet ve bildirim göster
                 if (habitUpdated) {
                     saveHabits();
                     if (willComplete) {
                         showPremiumModal({ 
                             title: 'Zincirleme Reaksiyon! ⚡', 
                             message: `"${escapeHtml(task.text)}" görevini başardığın için aynı hedefe hizmet eden alışkanlığın da otomatik tamamlandı!`,
                             type: 'success' 
                         });
                     }
                 }
             }
     // Eski "tek tek ileri atma" mantığı kaldırıldı, artık Akıllı Rutin Dağıtıcısı (addSmartTask) kullanılıyor.
 
     if (activeFocusTask === String(id) && task.completed) clearFocusMode();
     saveTasks();
 
     // YENİ: Hedef ilerlemesini anlık güncelle
     if(task.parentGoal) window.checkGoalSynergy(task.parentGoal);
 
     // MİLESTONE SENKRON: Görev tamamlanma durumu milestone ile senkron çalışır
     if (task.parentMilestone && task.parentGoal) {
         const parentGoal = goals.find(g => String(g.id) === String(task.parentGoal));
         if (parentGoal && parentGoal.milestones) {
             const ms = parentGoal.milestones.find(m => String(m.id) === String(task.parentMilestone));
             if (ms) {
                 const msLinkedTasks = tasks.filter(t => String(t.parentMilestone) === String(ms.id) && String(t.parentGoal) === String(task.parentGoal));
                 const allDone = msLinkedTasks.length > 0 && msLinkedTasks.every(t => t.completed);
                 if (allDone && !ms.completed) {
                     // Tüm görevler tamamlandı → milestone'u tamamla
                     ms.completed = true;
                     Store.goals.set(goals); if(window.FocusSync) window.FocusSync.pushKey('goals', goals);
                     showPremiumModal({
                         title: 'Dönüm Noktası Aşıldı! 🏁',
                         message: `"${escapeHtml(ms.text)}" dönüm noktasına ulaştın! Tüm bağlı görevleri tamamladın.`,
                         type: 'success'
                     });
                     if (window.FocusAISocial && typeof window.FocusAISocial.postActivity === 'function') {
                         window.FocusAISocial.postActivity(`"${ms.text}" dönüm noktasına ulaştı 🏁`);
                     }
                 } else if (!allDone && ms.completed) {
                     // En az bir görev tamamlanmadı → milestone'u geri al
                     ms.completed = false;
                     Store.goals.set(goals); if(window.FocusSync) window.FocusSync.pushKey('goals', goals);
                 }
             }
         }
     }
 
     // F1.1 — Planlama modülü (planning.js) milestone sync
     if (task.parentMilestone && String(task.parentMilestone).startsWith('ms_') &&
         task.parentGoal     && String(task.parentGoal).startsWith('pg_') &&
         typeof window.setPlanningMilestoneDone === 'function') {
         window.setPlanningMilestoneDone(task.parentGoal, task.parentMilestone, willComplete);
     }

     renderTasks(); // Arayüzü anında günceller (Alışkanlık tiki burada anında görünür)
             renderGoals();
             window.updateGlobalStreak();
             // Hedef detay modali açıksa milestone listesini de güncelle
             const _toggleModal = document.getElementById('goal-details-modal');
             const _toggleGoalId = document.getElementById('detail-active-goal-id');
             if (_toggleModal && !_toggleModal.classList.contains('hidden') && _toggleGoalId && _toggleGoalId.value && typeof updateGoalDetailsUI === 'function') {
                 updateGoalDetailsUI(_toggleGoalId.value);
             }
             if(typeof renderEventsRef === 'function') renderEventsRef();
             if(typeof renderStatisticsRef === 'function' && document.getElementById('istatistikler').classList.contains('active')) renderStatisticsRef();
             if(typeof renderSocialStatsRef === 'function' && document.getElementById('arkadaslar').classList.contains('active')) renderSocialStatsRef();
             if (typeof renderHabits === 'function') {
                renderHabits();
            }
         }
     }
 
     window.addSmartTask = (...args) => addSmartTask(...args); // Faz 6: script-convert-modal.js için
    function addSmartTask(text, priority, category, startDateStr, start, end, parentHabit, parentGoal, recurring) {
         if (!recurring) {
             // Rutin değilse normal şekilde 1 tane ekle geç
             addGlobalTask(text, priority, category, startDateStr, start, end, parentHabit, parentGoal, "", "");
             return;
         }
 
         const routineId = 'rutin_' + generateId(); // YENİ: Ortak Kimlik
         const [d, m, y] = startDateStr.split('-').map(Number); // GÜNCELLEME: d, m, y sırasına alındı
         let currDate = new Date(y, m - 1, d);
         const limitDays = 30; // Önümüzdeki 30 gün için takvimi rezerve et
         let addedCount = 0;
 
         for (let i = 0; i < limitDays; i++) {
             let addThisDay = false;
             let checkDate = new Date(currDate);
             checkDate.setDate(checkDate.getDate() + i);
             let dayOfWeek = checkDate.getDay(); // 0 Pazar, 6 Cumartesi
 
             if (recurring === 'daily') {
                 addThisDay = true;
             } else if (recurring === 'weekdays') {
                 if (dayOfWeek !== 0 && dayOfWeek !== 6) addThisDay = true;
             } else if (recurring === 'weekly') {
                 if (i % 7 === 0) addThisDay = true;
             } else if (recurring === 'monthly') {
                 if (checkDate.getDate() === d) addThisDay = true;
             }
 
             if (addThisDay) {
                 const dateStr = window.formatDateToString(checkDate);
                 const conflict = hasTimeConflict(dateStr, window.timeToMins(start), window.timeToMins(end));
                 if (!conflict) {
                     addGlobalTask(text, priority, category, dateStr, start, end, parentHabit, parentGoal, recurring, routineId);
                     addedCount++;
                 }
             }
         }
         
         if (addedCount > 1) {
             setTimeout(() => {
                 showPremiumModal({ title: 'Rutin Oluşturuldu 🔄', message: `Önümüzdeki 30 gün içinde toplam ${addedCount} adet görev takviminize otomatik olarak yerleştirildi.`, type: 'success' });
             }, 600);
         }
     }
 
 function addTask() {
     const rawText = taskInput.value.trim();
     if(rawText === "") return;
 
     // NLP Analizi ile metni parçala
     const smartData = parseSmartText(rawText);
     const text = smartData.cleanText || "İsimsiz Görev";
     
     const parentHabit = taskParentSelect ? taskParentSelect.value : "";
     const taskParentGoalSelect = document.getElementById('task-parent-goal');
     const parentGoal = taskParentGoalSelect ? taskParentGoalSelect.value : "";
     const recurringSelect = document.getElementById('task-recurring');
     const recurring = recurringSelect ? recurringSelect.value : "";
     const priority = taskPriority.value;
     const category = taskCategory.value;
     
     // Eğer NLP saat bulduysa onu kullan, bulamadıysa arayüzdeki mevcut saati kullan
     const timeStart = smartData.parsedTime ? smartData.parsedTime : taskTimeStart.value;
     // Bitiş saatini başlangıca göre otomatik 1 saat sonrasına ayarla
     const timeEnd = smartData.parsedTime ? window.addOneHour(timeStart) : taskTimeEnd.value;
 
     // Eğer NLP "yarın" gibi bir tarih bulduysa o tarihi, bulamadıysa bugünü kullan
     const taskDateStr = smartData.parsedDate ? smartData.parsedDate : window.formatDateToString(new Date());
 
     const startMins = window.timeToMins(timeStart);
     const endMins = window.timeToMins(timeEnd);

     if(startMins === endMins) {
         showPremiumModal({ title: 'Hatalı Zaman', message: 'Görev başlangıç ve bitiş saati aynı olamaz.', type: 'warning' });
         return;
     }
 
     if (hasTimeConflict(taskDateStr, startMins, endMins)) {
         showPremiumModal({ title: 'Zaman Çakışması', message: 'Bu saatte takviminizde başka plan var.', type: 'warning' });
         return;
     }
 
     // --- ANA HEDEF TARİH SINIRLARI DENETİMİ (GÜNCEL DOĞRU YER) ---
     if (parentGoal && !checkGoalDateBoundaries(parentGoal, taskDateStr)) {
        return; // Eğer seçilen tarih hedefin dışındaysa işlemi tamamen durdurur
    }

    addSmartTask(text, priority, category, taskDateStr, timeStart, timeEnd, parentHabit, parentGoal, recurring);
     if(recurringSelect) recurringSelect.value = '';
     taskInput.value = ''; 
     if(taskParentSelect) taskParentSelect.value = '';
     
     // Arayüzdeki seçici saatleri bir sonraki boş saat dilimine ilerlet (örn. 09-10 eklendiyse 10-11 önerilir)
     const nextSlot = getNextAvailableTimeSlot(taskDateStr, window.timeToMins(timeEnd) - window.timeToMins(timeStart) || 60);
     window.updateEndPicker('task-time-start', nextSlot.start);
     window.updateEndPicker('task-time-end', nextSlot.end);

     renderTasks();
     if(renderCalendarRef && renderEventsRef) { renderCalendarRef(); renderEventsRef(); }
 }
 
     addTaskBtn.addEventListener('click', addTask);
     taskInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') addTask(); });

     const tdToggleAdd = document.getElementById('td-toggle-add');
     const tdAddForm = document.getElementById('td-add-form');
     if (tdToggleAdd && tdAddForm) {
         tdToggleAdd._mainListenerAdded = true;
         tdToggleAdd.addEventListener('click', () => {
             const open = tdAddForm.style.display !== 'none' && tdAddForm.style.display !== '';
             tdAddForm.style.display = open ? 'none' : 'flex';
             tdToggleAdd.classList.toggle('is-open', !open);
             if (!open) {
                 const todayStr = window.formatDateToString(new Date());
                 const nextSlot = getNextAvailableTimeSlot(todayStr);
                 window.updateEndPicker('task-time-start', nextSlot.start);
                 window.updateEndPicker('task-time-end', nextSlot.end);
                 const inp = document.getElementById('task-input'); if(inp) inp.focus();
             }
         });
     }
 
 
     const habitInput = document.getElementById('habit-input');
     const habitTargetInput = document.getElementById('habit-target');
     const habitStartDateInput = document.getElementById('habit-start-date');
     const targetMinusBtn = document.getElementById('target-minus');
     const targetPlusBtn = document.getElementById('target-plus');
     const habitCategorySelect = document.getElementById('habit-category');
     const addHabitCatBtn = document.getElementById('add-habit-cat-btn');
     const delHabitCatBtn = document.getElementById('del-habit-cat-btn');
     const habitFilterContainer = document.getElementById('habit-filter-container');
     const addHabitBtn = document.getElementById('add-habit-btn');

     // Habit modal open/close
     const habitCreateModal = document.getElementById('habit-create-modal');
     const btnOpenHabitModal = document.getElementById('btn-open-habit-modal');
     const closeHabitModalBtn = document.getElementById('close-habit-modal-btn');
     const cancelHabitModalBtn = document.getElementById('cancel-habit-modal-btn');

     // window._setFlatpickrDate/window._getDateFromFlatpickr → script-calendar-date-utils.js
     // dosyasına taşındı (Faz 2, 2026-07-19).

     function openHabitModal() {
         if (!habitCreateModal) return;
         const activeHabitCount = habits.filter(h => !isHabitExpired(h)).length;
         if (activeHabitCount >= MAX_ACTIVE_HABITS) {
             showPremiumModal({
                 title: 'Fazla Yüklenme 🌱',
                 message: `Aynı anda en fazla ${MAX_ACTIVE_HABITS} aktif alışkanlık sürdürebilirsin. Çok sayıda yeni alışkanlığı birden başlatmak her birine ayıracağın irade ve dikkati böler, hiçbirini kalıcı hale getiremezsin. Yeni bir alışkanlık eklemeden önce mevcutlardan birini tamamla ya da süresi dolmuşları temizle.`,
                 type: 'warning'
             });
             return;
         }
         habitCreateModal.classList.remove('hidden');
         if (habitTargetInput) habitTargetInput.value = 30;
         selectedHabitEmoji = '🔁';
         if (habitEmojiBtn) habitEmojiBtn.textContent = '🔁';
         if (habitEmojiPicker) habitEmojiPicker.classList.add('hidden');
         const today = new Date();
         window._setFlatpickrDate(habitStartDateInput, today);
         const endDate = new Date(today);
         endDate.setDate(today.getDate() + 29); // 30 gün - 1
         setTimeout(() => {
             window._setFlatpickrDate(habitEndDateInput, endDate);
             const hint = document.getElementById('hm-sync-hint');
             if (hint) hint.textContent = '';
             habitInput && habitInput.focus();
         }, 30);
     }
     function closeHabitModal() {
         if (!habitCreateModal) return;
         habitCreateModal.classList.add('hidden');
     }
     if (btnOpenHabitModal) btnOpenHabitModal.addEventListener('click', openHabitModal);
     if (closeHabitModalBtn) closeHabitModalBtn.addEventListener('click', closeHabitModal);
     if (cancelHabitModalBtn) cancelHabitModalBtn.addEventListener('click', closeHabitModal);
     if (habitCreateModal) habitCreateModal.addEventListener('click', (e) => { if (e.target === habitCreateModal) closeHabitModal(); });

     // Emoji picker
     let selectedHabitEmoji = '🔁';
     const habitEmojiBtn = document.getElementById('habit-emoji-btn');
     const habitEmojiPicker = document.getElementById('habit-emoji-picker');
     if (habitEmojiBtn && habitEmojiPicker) {
         habitEmojiBtn.addEventListener('click', (e) => {
             e.stopPropagation();
             habitEmojiPicker.classList.toggle('hidden');
         });
         habitEmojiPicker.querySelectorAll('span').forEach(span => {
             span.addEventListener('click', () => {
                 selectedHabitEmoji = span.textContent;
                 habitEmojiBtn.textContent = selectedHabitEmoji;
                 habitEmojiPicker.classList.add('hidden');
             });
         });
         document.addEventListener('click', (e) => {
             if (!habitEmojiPicker.classList.contains('hidden') &&
                 !habitEmojiPicker.contains(e.target) &&
                 e.target !== habitEmojiBtn) {
                 habitEmojiPicker.classList.add('hidden');
             }
         });
     }
     const habitList = document.getElementById('habit-list');
     const habitBuddySelect = document.getElementById('habit-buddy'); 
 
     const habitEndDateInput = document.getElementById('habit-end-date');
     const hmSyncHint = document.getElementById('hm-sync-hint');

     function _habitDateFromInput(inputVal) {
         if (!inputVal) return null;
         const [y, m, d] = inputVal.split('-').map(Number);
         return new Date(y, m - 1, d);
     }
     function _habitInputFromDate(date) {
         const y = date.getFullYear();
         const m = String(date.getMonth() + 1).padStart(2, '0');
         const d = String(date.getDate()).padStart(2, '0');
         return `${y}-${m}-${d}`;
     }
     function _syncEndDateFromTarget() {
         const start = window._getDateFromFlatpickr(habitStartDateInput);
         const days = parseInt(habitTargetInput.value) || 30;
         if (!start) return;
         const end = new Date(start);
         end.setDate(end.getDate() + days - 1);
         window._setFlatpickrDate(habitEndDateInput, end);
         if (hmSyncHint) hmSyncHint.textContent = '';
     }
     function _syncTargetFromEndDate() {
         const start = window._getDateFromFlatpickr(habitStartDateInput);
         const end = window._getDateFromFlatpickr(habitEndDateInput);
         if (!start || !end) return;
         const days = Math.round((end - start) / 86400000) + 1;
         if (days < 1) {
             if (hmSyncHint) hmSyncHint.textContent = '⚠ Bitiş başlangıçtan önce olamaz';
             return;
         }
         if (days > 365) {
             if (hmSyncHint) hmSyncHint.textContent = '⚠ En fazla 365 gün';
             return;
         }
         habitTargetInput.value = days;
         if (hmSyncHint) hmSyncHint.textContent = '';
     }

     if(habitStartDateInput) {
        if(habitStartDateInput._flatpickr) { habitStartDateInput._flatpickr.setDate(new Date()); }
        else { habitStartDateInput.value = window.toInputDate(window.formatDateToString(new Date())); }
        _syncEndDateFromTarget();
    }
 
     const categoryModal = document.getElementById('category-modal');
     const closeModalBtn = document.getElementById('close-modal-btn');
     const cancelCategoryBtn = document.getElementById('cancel-category-btn');
     const saveCategoryBtn = document.getElementById('save-category-btn');
     const newCategoryInput = document.getElementById('new-category-input');
 
     let currentHabitFilter = 'all';
 
     targetMinusBtn.addEventListener('click', () => {
         let val = parseInt(habitTargetInput.value) || 21;
         if(val > 1) { habitTargetInput.value = val - 1; _syncEndDateFromTarget(); }
     });

     targetPlusBtn.addEventListener('click', () => {
         let val = parseInt(habitTargetInput.value) || 21;
         if(val < 365) { habitTargetInput.value = val + 1; _syncEndDateFromTarget(); }
     });

     habitTargetInput.addEventListener('change', () => {
         let val = parseInt(habitTargetInput.value);
         if (isNaN(val) || val < 1) val = 1;
         if (val > 365) val = 365;
         habitTargetInput.value = val;
         _syncEndDateFromTarget();
     });

     if (habitStartDateInput) {
         habitStartDateInput.addEventListener('change', _syncEndDateFromTarget);
     }
     if (habitEndDateInput) {
         habitEndDateInput.addEventListener('change', _syncTargetFromEndDate);
     }
 
     function renderHabitCategories() {
         // Güncellenecek tüm kategori açılır menülerinin ID'leri
         const dropdownIds = ['task-category', 'edit-task-category', 'habit-category', 'convert-dump-habit-category', 'goal-category-input', 'calendar-task-category'];
         
         dropdownIds.forEach(id => {
             const select = document.getElementById(id);
             if (!select) return;
             
             const currentValue = select.value; // Kullanıcının mevcut seçimini hafızada tut
             select.innerHTML = ''; // İçini temizle
             
             // Tüm kategorileri menüye ekle
             habitCategories.forEach(cat => {
                 const opt = document.createElement('option');
                 opt.value = cat.id; 
                 opt.textContent = cat.name;
                 select.appendChild(opt);
             });
             
             // Eğer kullanıcının eski seçtiği kategori hala listedeyse, seçimi bozulmasın
             if (habitCategories.some(c => c.id === currentValue)) {
                 select.value = currentValue;
             }
         });
     }
 
     function renderHabitFilters() {
         habitFilterContainer.innerHTML = `<button class="filter-btn ${currentHabitFilter === 'all' ? 'active' : ''}" data-filter="all">Tümü</button>`;
         habitCategories.forEach(cat => {
             habitFilterContainer.innerHTML += `<button class="filter-btn ${currentHabitFilter === cat.id ? 'active' : ''}" data-filter="${cat.id}">${escapeHtml(cat.name)}</button>`;
         });
         document.querySelectorAll('.filter-btn').forEach(btn => {
             btn.addEventListener('click', (e) => {
                 currentHabitFilter = e.target.getAttribute('data-filter');
                 renderHabitFilters(); renderHabits();
             });
         });
     }
 
     function openCategoryModal() { categoryModal.classList.remove('hidden'); newCategoryInput.value = ''; setTimeout(() => newCategoryInput.focus(), 100); }
     function closeCategoryModal() { categoryModal.classList.add('hidden'); }
 
     addHabitCatBtn.addEventListener('click', (e) => { e.preventDefault(); openCategoryModal(); });
     // --- YENİ: Bugün Sekmesi Kategori Butonları (Tek Merkezden Yönetim) ---
     const addTaskCatBtn = document.getElementById('add-task-cat-btn');
     if (addTaskCatBtn) {
         addTaskCatBtn.addEventListener('click', (e) => {
             e.preventDefault();
             openCategoryModal();
         });
     }

     // Hedef modalındaki kategori ekleme butonu
     const goalAddCategoryBtn = document.getElementById('goal-add-category-btn');
     if (goalAddCategoryBtn) {
         goalAddCategoryBtn.addEventListener('click', (e) => {
             e.preventDefault();
             openCategoryModal();
         });
     }
 
     const delTaskCatBtn = document.getElementById('del-task-cat-btn');
     if (delTaskCatBtn) {
         delTaskCatBtn.addEventListener('click', async (e) => {
             e.preventDefault();
             const select = document.getElementById('task-category');
             if (!select || !select.value) return;

             if (habitCategories.length <= 1) {
                 alert('Sistemde en az 1 kategori bulunmalıdır!');
                 return;
             }

             const confirmed = typeof window.showFocusaiConfirm === 'function'
                 ? await window.showFocusaiConfirm({
                     title: 'Kategori Siliniyor',
                     desc: 'Bu kategoriyi silmek istediğine emin misin?',
                     type: 'danger',
                     confirmText: 'Evet, Sil',
                     cancelText: 'Vazgeç',
                 })
                 : confirm('Bu kategoriyi silmek istediğine emin misin?');
             if (confirmed) {
                 // Seçili kategoriyi diziden çıkar
                 habitCategories = habitCategories.filter(c => c.id !== select.value);
                 FocusStorage.set('habitCategories', habitCategories); // Veritabanını güncelle
                 renderHabitCategories(); // Tüm açılır menüleri aynı anda güncelle!
             }
         });
     }
     // ------------------------------------------------------------------------
     closeModalBtn.addEventListener('click', closeCategoryModal);
     cancelCategoryBtn.addEventListener('click', closeCategoryModal);
 
     saveCategoryBtn.addEventListener('click', () => {
         const newCatName = newCategoryInput.value.trim();
         if (newCatName !== '') {
             const newCatId = newCatName.toLowerCase().replace(/[^a-z0-9ğüşöçı]/gi, '-');
             if (!habitCategories.find(c => c.id === newCatId)) {
                 habitCategories.push({ id: newCatId, name: newCatName });
                 FocusStorage.set('habit_categories', habitCategories);
                 renderHabitCategories(); renderHabitFilters();
                 habitCategorySelect.value = newCatId; closeCategoryModal();
             } else {
                 showPremiumModal({ title: 'Hata', message: 'Bu kategori zaten mevcut!', type: 'warning' });
             }
         }
     });
 
     delHabitCatBtn.addEventListener('click', () => {
         const selectedId = habitCategorySelect.value;
        if (DEFAULT_HABIT_CATEGORY_IDS.includes(selectedId)) {
            showPremiumModal({ title: 'İşlem Başarısız', message: 'Varsayılan kategoriler silinemez!', type: 'warning' });
            return;
        }
         if (habitCategories.length <= 1) {
             showPremiumModal({ title: 'İşlem Başarısız', message: 'Sistemde en az bir kategori bulunmalıdır!', type: 'warning' });
             return;
         }
         showPremiumModal({
             title: 'Kategoriyi Sil',
             message: 'Seçili kategoriyi silmek istediğinize emin misiniz?',
             type: 'warning', showCancel: true, confirmText: 'Evet, Sil',
             onConfirm: () => {
                 habitCategories = habitCategories.filter(c => c.id !== selectedId);
                 FocusStorage.set('habit_categories', habitCategories);
                 const firstCatId = habitCategories[0].id;
                 habits.forEach(h => { if (h.category === selectedId) h.category = firstCatId; });
                 saveHabits();
                 if(currentHabitFilter === selectedId) currentHabitFilter = 'all';
                 renderHabitCategories(); renderHabitFilters(); renderHabits();
                 if(renderCalendarRef) renderCalendarRef();
                 if(renderEventsRef) renderEventsRef();
                 if(renderStatisticsRef && document.getElementById('istatistikler').classList.contains('active')) renderStatisticsRef();
                 if(renderSocialStatsRef && document.getElementById('arkadaslar').classList.contains('active')) renderSocialStatsRef();
                 if(renderBuddyHabitsRef && document.getElementById('arkadaslar').classList.contains('active')) renderBuddyHabitsRef();
             }
         });
     });
 
    // Faz F: getChallengeDays -> script-challenge-days.js
 
     function saveHabits() {
         Store.habits.set(habits);
         populateParentHabitSelects();
     }
     window.saveHabits = saveHabits;

     window.renderHabits = () => renderHabits();
     function renderHabits() {
         habitList.innerHTML = '';
         const todayStr = window.formatDateToString(new Date());

         // "+ Yeni Alışkanlık" butonuna aktif/limit sayısını göster; limite ulaşınca soluklaştır
         if (btnOpenHabitModal) {
             const activeHabitCountForBtn = habits.filter(h => !isHabitExpired(h)).length;
             const habitAtLimit = activeHabitCountForBtn >= MAX_ACTIVE_HABITS;
             btnOpenHabitModal.innerHTML = `<i class="fa-solid fa-plus"></i> Yeni Alışkanlık <span style="opacity:.75; font-weight:500; font-size:12px;">(${activeHabitCountForBtn}/${MAX_ACTIVE_HABITS})</span>`;
             btnOpenHabitModal.style.opacity = habitAtLimit ? '0.55' : '';
             btnOpenHabitModal.title = habitAtLimit ? `Aynı anda en fazla ${MAX_ACTIVE_HABITS} aktif alışkanlık sürdürebilirsin.` : '';
         }

         const filteredHabits = currentHabitFilter === 'all' ? habits : habits.filter(h => h.category === currentHabitFilter);
         
         if(filteredHabits.length === 0) {
             habitList.innerHTML = '<div class="empty-state">Bu kategoride hiç alışkanlık bulunmuyor.</div>';
             return;
         }
 
         filteredHabits.forEach((habit) => {
             const li = document.createElement('li');
             li.className = 'habit-item';
             li.dataset.habitId = habit.id; 
             
             const targetDays = habit.targetDays || 21;
             const completedDays = Object.keys(habit.history).length; 
             const catId = habit.category || habitCategories[0].id;
             const catObj = habitCategories.find(c => c.id === catId);
             const progressPercentage = Math.min(Math.round((completedDays / targetDays) * 100), 100);
             
             const challengeDays = window.getChallengeDays(habit);
             let trackerHTML = '';
             challengeDays.forEach(day => { trackerHTML += `<div class="tracker-dot ${day.status} ${day.locked}" data-date="${day.dateStr}">${day.status === 'completed' ? '' : day.dayNumber}</div>`; });
 
             const [sD, sM, sY] = habit.startDate.split('-').map(Number); // GÜNCELLEME: d, m, y sırasına alındı
             const sdObj = new Date(sY, sM - 1, sD);
             const edObj = new Date(sY, sM - 1, sD);
             edObj.setDate(edObj.getDate() + habit.targetDays - 1);
             const dateRangeText = `${sdObj.toLocaleDateString('tr-TR', {month:'short', day:'numeric'})} - ${edObj.toLocaleDateString('tr-TR', {month:'short', day:'numeric'})}`;
 
             const buddyBadge = (habit.buddy && habit.buddy !== 'none') ? `<span style="font-size: 11px; color: #2ed573; background: rgba(46, 213, 115, 0.1); padding: 3px 8px; border-radius: 12px; border: 1px solid rgba(46, 213, 115, 0.3);"><i class="fa-solid fa-user-group"></i> ${escapeHtml(habit.buddy.split(' ')[0])} ile Ortak</span>` : '';

             const linkedGoalBadges = (habit.parentGoals && habit.parentGoals.length > 0)
                 ? habit.parentGoals.map(gId => {
                     const gc = getGoalColor(gId);
                     if (!gc) return '';
                     return `<span style="font-size:11px; color:var(--primary-color); background:rgba(212,144,14,0.1); padding:3px 8px; border-radius:12px; border:1px solid rgba(212,144,14,0.3);" title="Ana Hedef"><i class="fa-solid fa-mountain-sun"></i> ${escapeHtml(gc.label)}</span>`;
                 }).join('')
                 : '';
 
             li.innerHTML = `
                 <div class="habit-icon-wrapper"><i class="fa-solid ${habit.icon && habit.icon.startsWith('fa-') ? escapeHtml(habit.icon) : 'fa-repeat'}"></i></div>
                 <div class="habit-details">
                     <div class="habit-header-top">
                         <span class="habit-name">${escapeHtml(habit.name)}</span>
                         ${buddyBadge}
                         ${linkedGoalBadges}
                         <span class="habit-category-tag">${escapeHtml(catObj ? catObj.name : 'Genel')}</span>
                     </div>
                     <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                         <span class="habit-streak"><i class="fa-solid fa-bullseye"></i> ${targetDays} gün hedef</span>
                         <span style="font-size:11px; color:var(--text-muted);"><i class="fa-regular fa-calendar" style="margin-right:3px;"></i>${dateRangeText}</span>
                     </div>
                     <div class="habit-progress-wrapper">
                         <div class="habit-progress-container"><div class="habit-progress-fill" style="width:${progressPercentage}%;"></div></div>
                         <span class="habit-progress-text">%${progressPercentage} · ${completedDays}/${targetDays} gün</span>
                     </div>
                     <div class="habit-tracker">${trackerHTML}</div>
                 </div>
                 <div class="habit-actions">
                     <button class="complete-today-btn ${habit.history[todayStr] ? 'done' : ''}" data-date="${todayStr}">
                         <i class="fa-solid ${habit.history[todayStr] ? 'fa-check' : 'fa-bolt'}"></i> ${habit.history[todayStr] ? 'Tamamlandı' : 'Bugünü Tamamla'}
                     </button>
                     <div class="habit-side-actions">
                         <button class="edit-habit-btn" data-action="edit-habit" data-id="${habit.id}" title="Düzenle"><i class="fa-solid fa-pen"></i></button>
                         <button class="habit-del-btn delete-btn" title="Sil"><i class="fa-solid fa-trash"></i></button>
                     </div>
                 </div>
             `;
             habitList.appendChild(li);
         });
         saveHabits();
     }
 
     habitList.addEventListener('click', (e) => {
         const editHabitBtn = e.target.closest('[data-action="edit-habit"]');
         if (editHabitBtn) { window.openEditHabitModal(editHabitBtn.dataset.id); return; }
         const deleteBtn = e.target.closest('.delete-btn');
         if (deleteBtn) {
             const li = deleteBtn.closest('.habit-item');
             showPremiumModal({
                 title: 'Alışkanlığı Sil', message: 'Bu alışkanlığı silmek istediğinize emin misiniz? (Bağlı alt görevler silinmez ancak bağımsız göreve dönüşürler.)',
                 type: 'warning', showCancel: true, confirmText: 'Sil',
                 onConfirm: () => {
                     const hId = li.dataset.habitId;
                     const deletingHabit = habits.find(h => String(h.id) === String(hId));
                     // Ortak alışkanlıksa partnere bildirim gönder ve Supabase'den sil
                     if (deletingHabit && deletingHabit.buddy && deletingHabit.buddy !== 'none') {
                         if (window.FocusAISocial && typeof window.FocusAISocial._sendBuddyHabitDeletedNotification === 'function') {
                             window.FocusAISocial._sendBuddyHabitDeletedNotification(deletingHabit.id, deletingHabit.buddy, deletingHabit.name);
                         }
                         if (window.FocusSupabase) {
                             window.FocusSupabase.from('buddy_habits').delete().eq('id', String(hId)).then(() => {});
                         }
                     }
                     habits = habits.filter(h => String(h.id) !== String(hId));

                     tasks.forEach(t => { if(String(t.parentHabit) === String(hId)) t.parentHabit = ""; });
                     for(let date in calendarEvents) {
                         calendarEvents[date].forEach(ev => { if(String(ev.parentHabit) === String(hId)) ev.parentHabit = ""; });
                     }
                     saveTasks();

                     saveHabits(); renderHabits(); renderTasks(); 
                     if(renderCalendarRef) renderCalendarRef(); 
                     if(renderEventsRef) renderEventsRef();     
                     if(renderStatisticsRef && document.getElementById('istatistikler').classList.contains('active')) renderStatisticsRef();
                     if(renderSocialStatsRef && document.getElementById('arkadaslar').classList.contains('active')) renderSocialStatsRef();
                     if(renderBuddyHabitsRef && document.getElementById('arkadaslar').classList.contains('active')) renderBuddyHabitsRef();
                 }
             });
             return;
         }
         
         const dot = e.target.closest('.tracker-dot');
         if (dot) {
             if(dot.classList.contains('locked')) return;
             const li = dot.closest('.habit-item');
             const habit = habits.find(h => String(h.id) === String(li.dataset.habitId));
             if (habit) {
                 if(dot.dataset.date && dot.dataset.date !== "null") {
                     const oldCount = Object.keys(habit.history).length;
                     if (habit.history[dot.dataset.date]) delete habit.history[dot.dataset.date];
                     else habit.history[dot.dataset.date] = true;
                     window.checkHabitMilestones(habit, oldCount, Object.keys(habit.history).length);
                 }
                 saveHabits(); renderHabits(); renderTasks();
                 if(renderCalendarRef) renderCalendarRef(); 
                 if(renderEventsRef) renderEventsRef();     
                 if(typeof renderGoals === 'function') renderGoals();
                 // Hedef detay modalı açıksa ilerlemeyi anında güncelle
                 const _dm1 = document.getElementById('goal-details-modal');
                 const _dgi1 = document.getElementById('detail-active-goal-id');
                 if(_dm1 && !_dm1.classList.contains('hidden') && _dgi1 && _dgi1.value && typeof updateGoalDetailsUI === 'function') updateGoalDetailsUI(_dgi1.value);
                 if(renderStatisticsRef && document.getElementById('istatistikler').classList.contains('active')) renderStatisticsRef();
                 if(renderSocialStatsRef && document.getElementById('arkadaslar').classList.contains('active')) renderSocialStatsRef();
                 if(renderBuddyHabitsRef && document.getElementById('arkadaslar').classList.contains('active')) renderBuddyHabitsRef();
             }
             return;
         }
 
         const completeBtn = e.target.closest('.complete-today-btn');
         if (completeBtn) {
             const li = completeBtn.closest('.habit-item');
             const habit = habits.find(h => String(h.id) === String(li.dataset.habitId));
             if (habit) {
                 const today = completeBtn.dataset.date;
                 const oldCount = Object.keys(habit.history).length;
                 if (habit.history[today]) delete habit.history[today];
                 else habit.history[today] = true;
                 window.checkHabitMilestones(habit, oldCount, Object.keys(habit.history).length);
                 saveHabits(); renderHabits(); renderTasks();
                 if(renderCalendarRef) renderCalendarRef(); 
                 if(renderEventsRef) renderEventsRef();     
                 if(typeof renderGoals === 'function') renderGoals();
                 // Hedef detay modalı açıksa ilerlemeyi anında güncelle
                 const _dm2 = document.getElementById('goal-details-modal');
                 const _dgi2 = document.getElementById('detail-active-goal-id');
                 if(_dm2 && !_dm2.classList.contains('hidden') && _dgi2 && _dgi2.value && typeof updateGoalDetailsUI === 'function') updateGoalDetailsUI(_dgi2.value);
                 if(renderStatisticsRef && document.getElementById('istatistikler').classList.contains('active')) renderStatisticsRef();
                 if(renderSocialStatsRef && document.getElementById('arkadaslar').classList.contains('active')) renderSocialStatsRef();
                 if(renderBuddyHabitsRef && document.getElementById('arkadaslar').classList.contains('active')) renderBuddyHabitsRef();
             }
         }
     });
 
     function addHabit() {
         const text = habitInput.value.trim();
         const targetDays = parseInt(habitTargetInput.value) || 21;
         const category = habitCategorySelect.value;
         const startDate = habitStartDateInput.value ? window.fromInputDate(habitStartDateInput.value) : window.formatDateToString(new Date());
         const buddy = habitBuddySelect ? habitBuddySelect.value : 'none'; 
         const pillsContainer = document.getElementById('habit-goal-pills');
         const selectedGoals = pillsContainer ? Array.from(pillsContainer.querySelectorAll('.goal-pill.selected')).map(p => p.dataset.val) : [];
         
         const habitIcon = '';

         if(text !== "") {
             const activeHabitCount = habits.filter(h => !isHabitExpired(h)).length;
             if (activeHabitCount >= MAX_ACTIVE_HABITS) {
                 showPremiumModal({
                     title: 'Fazla Yüklenme 🌱',
                     message: `Aynı anda en fazla ${MAX_ACTIVE_HABITS} aktif alışkanlık sürdürebilirsin. Yeni bir alışkanlık eklemeden önce mevcutlardan birini tamamla ya da süresi dolmuşları temizle.`,
                     type: 'warning'
                 });
                 return;
             }
             // Ortak alışkanlık seçildiyse: alışkanlığı hemen oluşturma, partnere davet gönder.
             // Partner kabul ederse her iki tarafta da otomatik olarak oluşturulacak.
             if (buddy !== 'none' && typeof window.sendBuddyHabitInvite === 'function') {
                 const sent = window.sendBuddyHabitInvite(buddy, {
                     name: text,
                     icon: habitIcon,
                     targetDays: targetDays,
                     category: category,
                     startDate: startDate,
                     parentGoals: selectedGoals
                 });
                 if (sent) {
                     habitInput.value = '';
                     if (habitBuddySelect) habitBuddySelect.value = 'none';
                     showPremiumModal({ title: 'Davet Gönderildi!', message: `Partnerine "${text}" alışkanlığı için ortak hedef daveti gönderildi. Kabul ederse ikinizde de otomatik olarak oluşacak.`, type: 'success' });
                 }
                 return;
             }

             habits.push({
                 id: generateId(),
                 name: text,
                 icon: habitIcon,
                 targetDays: targetDays,
                 category: category,
                 startDate: startDate,
                 buddy: 'none',
                 parentGoals: selectedGoals,
                 history: {}
             });
             habitInput.value = '';
             closeHabitModal();

             saveHabits(); renderHabits(); renderTasks();
             if(renderCalendarRef) renderCalendarRef();
             if(renderEventsRef) renderEventsRef();
             if(renderStatisticsRef && document.getElementById('istatistikler').classList.contains('active')) renderStatisticsRef();
             if(renderSocialStatsRef && document.getElementById('arkadaslar').classList.contains('active')) renderSocialStatsRef();
             if(renderBuddyHabitsRef && document.getElementById('arkadaslar').classList.contains('active')) renderBuddyHabitsRef();

             if (window.FocusAISocial && typeof window.FocusAISocial.postActivity === 'function') {
                window.FocusAISocial.postActivity(`"${text}" adında yeni bir alışkanlık oluşturdu 🌱`);
            }

             showPremiumModal({ title: 'Tebrikler!', message: 'Alışkanlık başarıyla oluşturuldu. Artık görev eklerken bu alışkanlığı alt görevlerinizin ana hedefi olarak seçebilirsiniz.', type: 'success' });
         }
     }
     addHabitBtn.addEventListener('click', addHabit);
     habitInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') addHabit(); });

     const cleanExpiredHabitsBtn = document.getElementById('clean-expired-habits-btn');
     if (cleanExpiredHabitsBtn) {
         cleanExpiredHabitsBtn.addEventListener('click', async () => {
             const todayDate = new Date();
             todayDate.setHours(0, 0, 0, 0);
             const expiredHabits = habits.filter(habit => {
                 if (!habit.startDate || !habit.targetDays) return false;
                 const [sd, sm, sy] = habit.startDate.split('-').map(Number);
                 const end = new Date(sy, sm - 1, sd);
                 end.setDate(end.getDate() + habit.targetDays - 1);
                 end.setHours(0, 0, 0, 0);
                 return end < todayDate;
             });
             if (expiredHabits.length === 0) {
                 showPremiumModal({ title: 'Temizlenecek Bir Şey Yok', message: 'Süresi dolmuş alışkanlık bulunamadı.', type: 'info' });
                 return;
             }
             const confirmed = typeof window.showFocusaiConfirm === 'function'
                 ? await window.showFocusaiConfirm({
                     title: 'Süresi Dolmuş Alışkanlıklar Siliniyor',
                     desc: `${expiredHabits.length} adet süresi dolmuş alışkanlık bulundu. Kalıcı olarak silinsin mi?`,
                     type: 'danger',
                     confirmText: 'Evet, Sil',
                     cancelText: 'Vazgeç',
                 })
                 : confirm(`${expiredHabits.length} adet süresi dolmuş alışkanlık bulundu. Kalıcı olarak silinsin mi?`);
             if (!confirmed) return;
             const expiredIds = new Set(expiredHabits.map(h => String(h.id)));
             habits = habits.filter(h => !expiredIds.has(String(h.id)));
             saveHabits();
             renderHabits();
             if (renderCalendarRef) renderCalendarRef();
             showPremiumModal({ title: 'Temizlendi ✓', message: `${expiredHabits.length} adet süresi dolmuş alışkanlık başarıyla silindi.`, type: 'success' });
         });
     }
 
    // Pomodoro/Odak Zamanlayıcısı (timerInterval/totalTime/timeLeft/isRunning
    // state'i, applyTimerModeColor, resetIdleTimer, enterFocusMode/exitFocusMode,
    // updateTimerDisplay, startTimer/pauseTimer/resetTimer, creditFocusMinutes,
    // goToNextStage, zamanlayıcı profilleri, sayfa yenilenince kaldığı yerden
    // devam ettirme) -> script-timer.js dosyasına taşındı (Faz 2, 2026-07-20).
    // Bu kümeyi script.js'in başka hiçbir yeri DOĞRUDAN çağırmıyordu (DOM
    // event listener'ları hep aynı dosyada kalıyor), bu yüzden dışa açık bir
    // window.* fonksiyon köprüsü GEREKMEDİ — sadece paylaşılan state için
    // (window.__getRenderStatisticsRef/__getRenderSocialStatsRef bu çıkarmada
    // yeni eklendi, tasks/goals/activeFocusTask getter'ları zaten vardı).

     // --- AYARLAR: OTO-LİMİT VE +/- BUTONLARI → script-settings-steppers.js dosyasına taşındı ---

     const monthYearDisplay = document.getElementById('month-year-display');
     const calendarDays = document.getElementById('calendar-days');
     window.monthYearDisplay = monthYearDisplay; window.calendarDays = calendarDays; // Faz F: script-calendar-month-view.js için
     const prevMonthBtn = document.getElementById('prev-month-btn');
     const nextMonthBtn = document.getElementById('next-month-btn');
     const selectedDateTitle = document.getElementById('selected-date-title');
     window.selectedDateTitle = selectedDateTitle; // Faz 6: script-calendar-month-view.js için köprü
     const eventsCountDisplay = document.getElementById('selected-date-events-count');
     window.eventsCountDisplay = eventsCountDisplay; // Faz F: script-calendar-month-view.js için

     const eventInput = document.getElementById('event-input');
     const eventParentSelect = document.getElementById('event-parent-habit');
     const eventParentGoalSelect = document.getElementById('event-parent-goal');
     const eventTimeStart = document.getElementById('event-time-start');
     const eventTimeEnd = document.getElementById('event-time-end');
     const eventPriority = document.getElementById('event-priority');
     const addEventBtn = document.getElementById('add-event-btn');
     const eventList = document.getElementById('event-list');
     window.eventList = eventList; // Faz F: script-calendar-month-view.js için

     if (eventList) {
         eventList.addEventListener('click', (e) => {
             const el = e.target.closest('[data-action]');
             if (!el) return;
             const action = el.dataset.action;
             const id = el.dataset.id;
             if (action === 'toggle-highlight-task') window.toggleHighlightTask(el.dataset.date);
             else if (action === 'toggle-task') window.toggleTask(id);
             else if (action === 'edit-task') window.editTask(id);
             else if (action === 'delete-task') window.deleteGlobalTask(id, el.dataset.date);
             else if (action === 'toggle-planning-milestone') { if (typeof window.togglePlanningMilestoneFromCalendar === 'function') window.togglePlanningMilestoneFromCalendar(id); }
             else if (action === 'switch-tab-planlama') { if (typeof window.switchTab === 'function') window.switchTab('planlama'); }
         });
         eventList.addEventListener('dragstart', (e) => {
             const el = e.target.closest('.cal-event-item[data-drag-id]');
             if (!el || !e.dataTransfer) return;
             e.dataTransfer.setData('taskId', el.dataset.dragId);
         });
     }
     const calHabitsListEl = document.getElementById('calendar-habits-list');
     if (calHabitsListEl) {
         calHabitsListEl.addEventListener('click', (e) => {
             const el = e.target.closest('[data-action="toggle-habit-today"]');
             if (!el) return;
             window.toggleHabitFromToday(el.dataset.id, el.dataset.date);
         });
     }

     let currentDate = new Date();
     let selectedDate = new Date();
     window.__getCurrentDateRef = () => currentDate; // Faz 6: script-calendar-month-view.js için
     window.__setCurrentDateRef = (v) => { currentDate = v; };
     window.__getSelectedDateRef = () => selectedDate;
     window.__setSelectedDateRef = (v) => { selectedDate = v; };
     
     const priorityLabels = { 'high': 'Yüksek', 'medium': 'Orta', 'low': 'Düşük' };
 
     
     // Aylık Takvim Hover Popup → script-calendar-hover-popup.js dosyasına taşındı
     // (window.showCalHoverPopup / window.hideCalHoverPopup olarak sağlanır)

 
     // --- TAKVİM LİSTESİ İÇİ REORDER + TAMAMLAMA ANİMASYONU ---
     window.initCalEventListDnD = (dateStr) => initCalEventListDnD(dateStr); // Faz 6: script-calendar-month-view.js için
    function initCalEventListDnD(dateStr) {
         const list = document.getElementById('event-list');
         if (!list) return;
 
         // TAMAMLAMA ANİMASYONU — checkbox tıklamalarını yakala
         list.querySelectorAll('.tc-checkbox').forEach(cb => {
             cb.addEventListener('click', function() {
                 const li = cb.closest('.cal-event-item');
                 if (!li) return;
                 li.classList.add('completing');
                 setTimeout(() => li.classList.remove('completing'), 420);
             }, { once: false });
         });
 
         // AYNI GÜN İÇİ REORDER
         const items = Array.from(list.querySelectorAll('.cal-event-item[draggable="true"]'));
         let dragSrc = null;
         let dragSrcId = null;
 
         items.forEach(item => {
             // dragstart
             item.addEventListener('dragstart', function(e) {
                 dragSrc = item;
                 dragSrcId = e.dataTransfer.getData('taskId');
                 setTimeout(() => item.classList.add('dragging'), 0);
                 // Premium ghost
                 const evData = (calendarEvents[dateStr] || []).find(x => String(x.id) === String(dragSrcId));
                 if (evData) {
                     const ghost = window.createCalDragGhost(evData.text, evData.timeStart, evData.timeEnd, evData.priority);
                     e.dataTransfer.setDragImage(ghost, 110, 28);
                 }
             });
 
             // dragend
             item.addEventListener('dragend', function() {
                 item.classList.remove('dragging');
                 items.forEach(i => i.classList.remove('drag-over-above', 'drag-over-below'));
                 dragSrc = null;
             });
 
             // dragover — yukarı mı aşağı mı belirle
             item.addEventListener('dragover', function(e) {
                 if (!dragSrc || dragSrc === item) return;
                 e.preventDefault();
                 e.stopPropagation();
                 const rect = item.getBoundingClientRect();
                 items.forEach(i => i.classList.remove('drag-over-above', 'drag-over-below'));
                 item.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drag-over-above' : 'drag-over-below');
             });
 
             // dragleave
             item.addEventListener('dragleave', function() {
                 item.classList.remove('drag-over-above', 'drag-over-below');
             });
 
             // drop — listedeki sırayı güncelle
             item.addEventListener('drop', function(e) {
                 e.preventDefault();
                 e.stopPropagation(); // Takvim günü drop'una geçmesin
                 item.classList.remove('drag-over-above', 'drag-over-below');
 
                 const draggedId = e.dataTransfer.getData('taskId');
                 if (!draggedId || !dragSrc || dragSrc === item) return;
 
                 const evList = calendarEvents[dateStr];
                 if (!evList) return;
 
                 const fromIdx = evList.findIndex(ev => String(ev.id) === String(draggedId));
 
                 // Hedef item'ın id'sini checkbox onclick'ten çıkar
                 const targetCb = item.querySelector('.tc-checkbox');
                 if (!targetCb) return;
                 const targetMatch = (targetCb.getAttribute('onclick') || '').match(/'([^']+)'/);
                 if (!targetMatch) return;
                 const toIdx = evList.findIndex(ev => String(ev.id) === String(targetMatch[1]));
 
                 if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
 
                 // Yukarı mı aşağı mı bırakıldı?
                 const rect = item.getBoundingClientRect();
                 let insertIdx = (e.clientY < rect.top + rect.height / 2) ? toIdx : toIdx + 1;
                 if (fromIdx < insertIdx) insertIdx--;
 
                 const [moved] = evList.splice(fromIdx, 1);
                 evList.splice(insertIdx, 0, moved);
 
                 saveTasks();
                 window.renderEvents();
             });
         });
     }
 
     // --- TAKVİMDE SÜRÜKLE BIRAK TAŞIMA FONKSİYONU ---
     window.moveTaskToDate = function(id, newDateStr) {
         const taskIndex = tasks.findIndex(t => String(t.id) === String(id));
         if (taskIndex === -1) return;
         
         const task = tasks[taskIndex];
         const oldDateStr = task.date;
         
         if (oldDateStr === newDateStr) return; // Aynı güne bırakıldıysa hiçbir şey yapma
         
         // 1. Ana listede tarihi güncelle
         task.date = newDateStr;
         
         // 2. Takvim Events (Hafıza) objesinden eski günden sil
         if(calendarEvents[oldDateStr]) {
             calendarEvents[oldDateStr] = calendarEvents[oldDateStr].filter(e => String(e.id) !== String(id));
             if(calendarEvents[oldDateStr].length === 0) delete calendarEvents[oldDateStr];
         }
         
         // 3. Takvim Events objesinde yeni güne ekle
         if(!calendarEvents[newDateStr]) calendarEvents[newDateStr] = [];
         const evCopy = { id: task.id, text: task.text, timeStart: task.timeStart, timeEnd: task.timeEnd, priority: task.priority, parentHabit: task.parentHabit };
         if(task.weekStr) evCopy.weekStr = task.weekStr; // Haftalık plan bağlantısını koru
         calendarEvents[newDateStr].push(evCopy);
         
         // Kaydet ve Ekranı Yenile
         saveTasks();
         renderTasks();
         window.renderCalendar();
         window.renderEvents();
         
         showPremiumModal({ title: 'Plan Taşındı 🗓️', message: 'Görev başarıyla yeni tarihine taşındı.', type: 'success' });
     }
 
     function addNewEvent() {
         const rawText = eventInput.value.trim();
         if(rawText === "") return;
 
         // NLP Analizi ile metni parçala
         const smartData = parseSmartText(rawText);
         const text = smartData.cleanText || "İsimsiz Plan";
 
         const parentHabit = eventParentSelect ? eventParentSelect.value : "";
         const parentGoal = eventParentGoalSelect ? eventParentGoalSelect.value : "";
         const priority = eventPriority.value;
 
         // Eğer NLP saat bulduysa onu kullan, bulamadıysa arayüzdeki mevcut saati kullan
         const timeStart = smartData.parsedTime ? smartData.parsedTime : eventTimeStart.value;
         const timeEnd = smartData.parsedTime ? window.addOneHour(timeStart) : eventTimeEnd.value;
 
         // NLP tarih bulduysa onu kullan, bulamadıysa takvimde KULLANICININ SEÇTİĞİ tarihi kullan
         const d = smartData.parsedDate ? smartData.parsedDate : window.formatDateToString(selectedDate); 
 
         const startMins = window.timeToMins(timeStart);
         const endMins = window.timeToMins(timeEnd);

         // --- YENİ: Ana Hedef Tarih Sınırı Kontrolü ---
            if (!checkGoalDateBoundaries(parentGoal, d)) {
                return;
            }
 
         if(startMins === endMins) {
             showPremiumModal({ title: 'Hatalı Zaman Aralığı', message: 'Başlangıç ve bitiş saati aynı olamaz.', type: 'warning' });
             return;
         }
 
         if(hasTimeConflict(d, startMins, endMins)) {
             showPremiumModal({ title: 'Zaman Çakışması!', message: 'Seçtiğiniz zaman aralığı, o günkü başka bir planınızla kesişiyor. Lütfen çakışmayan farklı bir saat aralığı seçin.', type: 'warning' });
             return;
         }
 
         addGlobalTask(text, priority, 'is', d, timeStart, timeEnd, parentHabit, parentGoal);
         
         eventInput.value = ''; 
         if(eventParentSelect) eventParentSelect.value = '';
         if(eventParentGoalSelect) eventParentGoalSelect.value = '';
         
         // Bir sonraki görev ekleme pratikliği için zaman seçicilerini bir sonraki boş dilime ilerlet
         const nextSlot = getNextAvailableTimeSlot(d, window.timeToMins(timeEnd) - window.timeToMins(timeStart) || 60);
         window.updateEndPicker('event-time-start', nextSlot.start);
         window.updateEndPicker('event-time-end', nextSlot.end);
         eventPriority.value = 'medium';
 
         closeEventModal();
         window.renderCalendar(); window.renderEvents(); renderTasks();
     }

     // Event modal open/close
     const eventCreateModal = document.getElementById('event-create-modal');
     const btnOpenEventModal = document.getElementById('btn-open-event-modal');
     const closeEventModalBtn = document.getElementById('close-event-modal-btn');
     const cancelEventModalBtn = document.getElementById('cancel-event-modal-btn');
     const eventModalDateLabel = document.getElementById('event-modal-date-label');

     function openEventModal() {
         if (!eventCreateModal) return;
         if (eventModalDateLabel && selectedDate) {
             eventModalDateLabel.textContent = selectedDate.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
         }
         if (selectedDate) {
             const nextSlot = getNextAvailableTimeSlot(window.formatDateToString(selectedDate));
             window.updateEndPicker('event-time-start', nextSlot.start);
             window.updateEndPicker('event-time-end', nextSlot.end);
         }
         eventCreateModal.classList.remove('hidden');
         setTimeout(() => { const inp = document.getElementById('event-input'); if(inp) inp.focus(); }, 60);
     }
     function closeEventModal() {
         if (!eventCreateModal) return;
         eventCreateModal.classList.add('hidden');
     }

     if (btnOpenEventModal) btnOpenEventModal.addEventListener('click', openEventModal);
     if (closeEventModalBtn) closeEventModalBtn.addEventListener('click', closeEventModal);
     if (cancelEventModalBtn) cancelEventModalBtn.addEventListener('click', closeEventModal);
     if (eventCreateModal) eventCreateModal.addEventListener('click', (e) => { if (e.target === eventCreateModal) closeEventModal(); });

     addEventBtn.addEventListener('click', addNewEvent);
     eventInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') addNewEvent(); });
 
 
 
     // ============ SPOTLIGHT ARAMA SİSTEMİ ============
     // Faz F: script-spotlight-search.js'e çıkarıldı.
     prevMonthBtn.onclick = () => { currentDate.setMonth(currentDate.getMonth() - 1); window.renderCalendar(); updateCalUnifiedTitle(); };
     nextMonthBtn.onclick = () => { currentDate.setMonth(currentDate.getMonth() + 1); window.renderCalendar(); updateCalUnifiedTitle(); };
 
     let statsActiveFilter = 7;
     window.__getStatsActiveFilter = () => statsActiveFilter; // Faz F: script-statistics.js için
 
     window.toggleActivityReaction = function(btn) {
         const countSpan = btn.querySelector('.reaction-count');
         let currentCount = parseInt(countSpan.textContent) || 0;
 
         if (btn.classList.contains('active')) {
             btn.classList.remove('active');
             countSpan.textContent = currentCount - 1;
         } else {
             btn.classList.add('active');
             countSpan.textContent = currentCount + 1;
         }
     };
 
     function renderSocialStats() {
         // Liderlik tablosu ve arkadaş aktivitesi artık social.js içindeki canlı
         // Firebase abonelikleri (subscribeLeaderboard / subscribeActivity) tarafından
         // gerçek zamanlı olarak yönetiliyor. Burada statik "Sen" verisiyle üzerine
         // yazmak, eklenmiş arkadaşların listede kaybolmasına sebep oluyordu.
     }
 
 
     function renderBuddyHabits() {
         const container = document.getElementById('buddy-habits-list');
         if(!container) return;

         // Gerçek zamanlı partner durumunu Firebase'den çekebilen social.js render'ı varsa onu kullan.
         if (typeof window.renderBuddyHabitsSocial === 'function') {
             window.renderBuddyHabitsSocial(habits);
             return;
         }
 
         const buddyHabits = habits.filter(h => h.buddy && h.buddy !== 'none');
 
         if(buddyHabits.length === 0) {
             container.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 10px;">Henüz ortak bir alışkanlık oluşturmadın. "Alışkanlıklar" sekmesinden yeni bir hedef belirle ve partnerini seç!</div>';
             return;
         }
 
         let html = '';
         const todayStr = window.formatDateToString(new Date());
 
         buddyHabits.forEach(habit => {
             const completedDays = Object.keys(habit.history).length;
             const targetDays = habit.targetDays || 21;
             const progressPercentage = Math.min(Math.round((completedDays / targetDays) * 100), 100);
 
             const isUserDoneToday = !!habit.history[todayStr];
             const isBuddyDoneToday = isUserDoneToday; 
             
             let statusClass = isUserDoneToday ? 'buddy-status-success' : 'buddy-status-waiting';
             let statusText = isUserDoneToday ? '<i class="fa-solid fa-check-double"></i> İkiniz de Tamamladınız' : '<i class="fa-solid fa-hourglass-half"></i> Bugün İçin Bekleniyor';
             let progressClass = isUserDoneToday ? 'success' : ''; 
 
             let avatarSrc = "https://ui-avatars.com/api/?name=" + encodeURIComponent(habit.buddy) + "&background=random&color=fff";
 
             html += `
             <div class="buddy-habit-card">
                 <div class="buddy-header">
                     <span class="buddy-title"><i class="fa-solid ${habit.icon && habit.icon.startsWith('fa-') ? escapeHtml(habit.icon) : 'fa-repeat'}" style="color: var(--primary-color);"></i> ${escapeHtml(habit.name)}</span>
                     <div class="buddy-users">
                         <div class="buddy-avatar-group">
                             <img src="https://ui-avatars.com/api/?name=Sen&background=6c5ce7&color=fff" class="buddy-avatar" title="Sen">
                             <img src="${avatarSrc}" class="buddy-avatar" title="${habit.buddy}">
                         </div>
                     </div>
                 </div>
                 <div class="buddy-progress-wrapper">
                     <div class="buddy-status-text">
                         <span>Ortak İlerleme: <strong>${completedDays}/${targetDays} Gün</strong></span>
                         <span class="buddy-status-badge ${statusClass}">${statusText}</span>
                     </div>
                     <div class="buddy-progress-bar">
                         <div class="buddy-progress-fill ${progressClass}" style="width: ${progressPercentage}%;"></div>
                     </div>
                 </div>
             </div>`;
         });
 
         container.innerHTML = html;
     }
 
    // Faz F: getLogicalReflectionDate/isReflectionTime -> script-reflection-date-utils.js
 
     // Sidebar/dock "Akşam Yansıması" butonları kaldırıldı (giriş noktası artık
     // Zihin Kütüphanesi'ndeki "Günü Değerlendir"). Bu fonksiyon sadece akşam
     // saatinde o günün kaydı hiç yoksa modalı bir kez otomatik açar.
     function checkEveningReflection() {
         if (!window.isReflectionTime()) return;
         const logDate = window.toInputDate(window.getLogicalReflectionDate());
         const journalEntries = FocusStorage.get('focusai_journal_entries', []);
         const todayEntry = journalEntries.find(e => e.date === logDate);
         if (!todayEntry) openReflectionModal();
     }
 
     function openReflectionModal() {
         const logDate = window.toInputDate(window.getLogicalReflectionDate());
         const journalEntries = FocusStorage.get('focusai_journal_entries', []);
         const todayRef = journalEntries.find(e => e.date === logDate);

         const achieveInput = document.getElementById('reflection-achieve');
         const improveInput = document.getElementById('reflection-improve');

         if (achieveInput) achieveInput.value = (todayRef && todayRef.achieve) ? todayRef.achieve : '';
         if (improveInput) improveInput.value = (todayRef && todayRef.improve) ? todayRef.improve : '';

         window.updateCharCounter('reflection-achieve', 'char-count-achieve', JOURNAL_CHAR_LIMIT);
         window.updateCharCounter('reflection-improve', 'char-count-improve', JOURNAL_CHAR_LIMIT);

         // Bugün zaten tamamlanmış değerlendirme varsa düzenleme modunu belirt
         const reflModalTitle = document.querySelector('#evening-reflection-modal h2');
         const alreadyDone = todayRef && todayRef.completed;
         if (reflModalTitle) {
             reflModalTitle.textContent = alreadyDone ? 'Gün Sonu Değerlendirmesini Düzenle' : 'Gün Sonu Değerlendirmesi';
         }
         const saveBtn = document.getElementById('save-reflection-btn');
         if (saveBtn) {
             saveBtn.textContent = alreadyDone ? 'Güncelle' : 'Kaydet';
         }

         const modal = document.getElementById('evening-reflection-modal');
         if (modal) modal.classList.remove('hidden');
     }
 

     // Zihin Kütüphanesi içindeki "Günü Değerlendir" butonu — artık eski form modalı
     // yerine doğrudan bugünün kitap sayfasını açar. Eski modal (openReflectionModal/
     // evening-reflection-modal) sadece akşam saatlerinde otomatik çıkan hatırlatma
     // olarak (checkEveningReflection üzerinden) kullanılmaya devam ediyor.
     const libReflectionBtn = document.getElementById('btn-open-reflection-library');
     if (libReflectionBtn) {
         libReflectionBtn.addEventListener('click', () => {
             const now   = new Date();
             const day   = now.getDate();
             const month = now.getMonth();
             const year  = now.getFullYear();
             const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

             const journalEntries = FocusStorage.get('focusai_journal_entries', []);
             const entry = journalEntries.find(e => e.date === dateStr);

             const leather = [
                 '#6e2b2b','#2f4a32','#243a5e','#1f4d4a','#8a6a2f',
                 '#4a2c4d','#5a3a22','#5c1f2a','#4f5224','#3a4754',
                 '#7a4a24','#214034'
             ];
             const trMonthsFull = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
             const trDaysFull   = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];

             const bk = {
                 d: day, dateStr, entry, isFuture: false, isToday: true,
                 isFilled: !!(entry && (entry.achieve || entry.improve)), isMatch: true,
                 color: leather[(day * 5 + 2) % leather.length],
                 dayNameFull: trDaysFull[now.getDay()],
                 dateLabel: `${day} ${trMonthsFull[month]}`,
                 monthYear: `${trMonthsFull[month]} ${year}`,
             };

             if (typeof openZKModal === 'function') openZKModal(bk, year);
         });
     }
 
     const skipReflectionBtn = document.getElementById('skip-reflection-btn');
     if (skipReflectionBtn) {
         skipReflectionBtn.addEventListener('click', () => {
             const logDate = window.toInputDate(window.getLogicalReflectionDate());
             let journalEntries = FocusStorage.get('focusai_journal_entries', []);

             if (!journalEntries.find(e => e.date === logDate)) {
                 journalEntries.push({ date: logDate, achieve: '', improve: '', completed: false, skipped: true });
                 FocusStorage.set('focusai_journal_entries', journalEntries);
                 // "Sonra doldur" işareti de hemen buluta gitsin; yoksa yenilemede modal tekrar açılır
                 if (window.FocusSync) window.FocusSync.flushAll();
             }

             document.getElementById('evening-reflection-modal').classList.add('hidden');
         });
     }

     const closeReflectionModalBtn = document.getElementById('close-reflection-modal-btn');
     if (closeReflectionModalBtn) {
         closeReflectionModalBtn.addEventListener('click', () => {
             document.getElementById('evening-reflection-modal').classList.add('hidden');
         });
     }
 
     const saveReflectionBtn = document.getElementById('save-reflection-btn');
     if (saveReflectionBtn) {
         saveReflectionBtn._mainListenerAdded = true;
         saveReflectionBtn.addEventListener('click', () => {
             const logDate = window.toInputDate(window.getLogicalReflectionDate()); // yyyy-mm-dd — kütüphane renderer ile eşleşir
             const achieve = document.getElementById('reflection-achieve').value.trim();
             const improve = document.getElementById('reflection-improve').value.trim();

             if (achieve === "" && improve === "") {
                 showPremiumModal({
                     title: 'Eksik Veri',
                     message: 'Lütfen günü değerlendirmek için en az bir alanı doldur. İstersen "Kapat / Sonra Doldur" diyebilirsin.',
                     type: 'warning'
                 });
                 return;
             }

             // focusai_journal_entries'e kaydet (ana veri deposu)
             const entries = FocusStorage.get('focusai_journal_entries', []);
             const existingIndex = entries.findIndex(e => e.date === logDate);
             const newEntry = { date: logDate, achieve: achieve, improve: improve, completed: true, skipped: false };
             if (existingIndex !== -1) { entries[existingIndex] = newEntry; } else { entries.push(newEntry); }
             FocusStorage.set('focusai_journal_entries', entries);
             if (window.FocusSync) {
                 window.FocusSync.pushKey('focusai_journal_entries', entries);
                 // Debounce'ı bekleme: kullanıcı hemen sayfayı kapatır/yenilerse
                 // kayıt buluta yetişemiyor, sonraki pull'da geri geliyordu.
                 window.FocusSync.flushAll();
             }

             document.getElementById('reflection-achieve').value = '';
             document.getElementById('reflection-improve').value = '';
             // Animasyonlu kapanış
             const reflModal = document.getElementById('evening-reflection-modal');
             reflModal.classList.add('slide-out');
             setTimeout(() => {
                 reflModal.classList.add('hidden');
                 reflModal.classList.remove('slide-out');
             }, 450);
             showPremiumModal({ title: 'İyi Geceler!', message: 'Gün sonu değerlendirmen başarıyla kaydedildi. Zihnini boşalttın, şimdi harika bir uyku çekme vakti.', type: 'success' });
             if (typeof buildMassiveLibraryRows === 'function') buildMassiveLibraryRows();
             if (renderJournalRef && document.getElementById('gunluk')?.classList.contains('active')) renderJournalRef();
         });
     }
 
     
    // --- YENİ NESİL KÜTÜPHANE VE DÜZENLEME MODÜLÜ ---
    const journalEditModal = document.getElementById('journal-edit-modal');
    const closeJournalEditBtn = document.getElementById('close-journal-edit-btn');
    const cancelJournalEditBtn = document.getElementById('cancel-journal-edit-btn');
    const saveJournalEditBtn = document.getElementById('save-journal-edit-btn');
    const editJournalDateInput = document.getElementById('edit-journal-date');
    const editJournalAchieveInput = document.getElementById('edit-journal-achieve');
    const editJournalImproveInput = document.getElementById('edit-journal-improve');

    function getNewStorageData() {
        const entries = FocusStorage.get('focusai_journal_entries', []);
        return { entries, currentKey: 'focusai_journal_entries' };
    }

    window.deleteJournalEntry = function(dateStr) {
        showPremiumModal({
            title: 'Günlüğü Sil',
            message: 'Bu gün sonu değerlendirmesini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
            type: 'warning',
            showCancel: true,
            confirmText: 'Sil',
            onConfirm: () => {
                const { entries } = getNewStorageData();
                const filteredEntries = entries.filter(e => e.date !== dateStr);
                FocusStorage.set('focusai_journal_entries', filteredEntries);

                if(typeof buildMassiveLibraryRows === "function") buildMassiveLibraryRows();

                showPremiumModal({ title: 'Silindi', message: 'Günlük kaydı kütüphaneden kaldırıldı.', type: 'success' });
            }
        });
    };

    window.editJournalEntry = function(dateStr) {
        const { entries } = getNewStorageData();
        const entry = entries.find(e => e.date === dateStr);

        if (entry) {
            editJournalDateInput.value = dateStr;
            editJournalAchieveInput.value = entry.achieve || '';
            editJournalImproveInput.value = entry.improve || '';

            window.updateCharCounter('edit-journal-achieve', 'edit-char-count-achieve', JOURNAL_CHAR_LIMIT);
            window.updateCharCounter('edit-journal-improve', 'edit-char-count-improve', JOURNAL_CHAR_LIMIT);

            journalEditModal.classList.remove('hidden');
        }
    };

    function closeJournalModal() {
        journalEditModal.classList.add('hidden');
    }

    if (closeJournalEditBtn) closeJournalEditBtn.addEventListener('click', closeJournalModal);
    if (cancelJournalEditBtn) cancelJournalEditBtn.addEventListener('click', closeJournalModal);

    if (saveJournalEditBtn) {
        saveJournalEditBtn.addEventListener('click', () => {
            const dateStr = editJournalDateInput.value;
            const achieve = editJournalAchieveInput.value.trim();
            const improve = editJournalImproveInput.value.trim();

            if (achieve === "" && improve === "") {
                showPremiumModal({
                    title: 'Eksik Veri',
                    message: 'Günlük kaydını tamamen boş bırakamazsın. Silmek istiyorsan çöp kutusu ikonunu kullanabilirsin.',
                    type: 'warning'
                });
                return;
            }

            const { entries } = getNewStorageData();
            const existingIndex = entries.findIndex(e => e.date === dateStr);
            const newEntry = { date: dateStr, achieve: achieve, improve: improve, completed: true, skipped: false };

            if (existingIndex !== -1) {
                entries[existingIndex] = newEntry;
            } else {
                entries.push(newEntry);
            }
            FocusStorage.set('focusai_journal_entries', entries);

            closeJournalModal();

            if(typeof buildMassiveLibraryRows === "function") buildMassiveLibraryRows();

            showPremiumModal({ title: 'Güncellendi', message: 'Değişiklikler Zihin Kütüphanenize başarıyla işlendi!', type: 'success' });
        });
    }
     
     function renderJournal() { /* buildMassiveLibraryRows tarafından replace edildi */ }

     (function initBookDetailModal() {
         const modal    = document.getElementById('book-detail-modal');
         const closeBtn = document.getElementById('close-book-detail-btn');
         const editBtn  = document.getElementById('book-edit-btn');
         const deleteBtn= document.getElementById('book-delete-btn');

         if (!modal) return;

         // Animasyonlu kapanış — closeBookDetailModal henüz tanımlanmamış olabilir,
         // DOMContentLoaded sonrası çalışacak şekilde defer ediyoruz
         function closeModal() {
             if (typeof closeBookDetailModal === 'function') {
                 closeBookDetailModal();
             } else {
                 modal.classList.add('hidden');
                 modal.classList.remove('animate-open');
             }
         }
         function getActiveDate() { return modal.getAttribute('data-active-date'); }

         if (closeBtn)  closeBtn.addEventListener('click', closeModal);
         modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

         if (editBtn) editBtn.addEventListener('click', () => {
             const dateStr = getActiveDate();
             if (dateStr) {
                 closeModal();
                 if (typeof editJournalEntry === 'function') editJournalEntry(dateStr);
             }
         });

         if (deleteBtn) deleteBtn.addEventListener('click', () => {
             const dateStr = getActiveDate();
             if (dateStr) {
                 closeModal();
                 if (typeof deleteJournalEntry === 'function') deleteJournalEntry(dateStr);
             }
         });
     })();

     // Faz F: Ortak Odaklanma Odası (co-working) + Gruplar script-coworking-groups.js'e çıkarıldı.

 // ════════════════════════════════════════════════════════════
     // PREMIUM TAKVİM — Aylık / Haftalık / Günlük Görünüm Sistemi
     // ════════════════════════════════════════════════════════════
 
     let currentCalView = 'monthly';
     const CAL_HOUR_START = 0;
    window.CAL_HOUR_START = CAL_HOUR_START; // Faz 6: script-calendar-week-day-view.js için
     const CAL_HOUR_END = 23;
    window.CAL_HOUR_END = CAL_HOUR_END; // Faz 6: script-calendar-week-day-view.js için
     const DAY_NAMES_LOCAL = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
    window.DAY_NAMES_LOCAL = DAY_NAMES_LOCAL; // Faz 6: script-calendar-week-day-view.js için
 
     // window.getWeekStart → script-calendar-date-utils.js dosyasına taşındı.
 
     window.updateCalUnifiedTitle = () => updateCalUnifiedTitle(); // Faz 6: script-calendar-week-day-view.js için
    function updateCalUnifiedTitle() {
         const el = document.getElementById('cal-unified-title');
         const monthYearDisplay = document.getElementById('month-year-display');
         
         // Üst kısımdaki Ay/Yıl başlığını her halükarda senkronize et
         if (monthYearDisplay && currentDate) {
             monthYearDisplay.textContent = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
         }
 
         if (!el) return;
         if (currentCalView === 'monthly') {
             el.textContent = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
         } else if (currentCalView === 'weekly') {
             const ws = window.getWeekStart(selectedDate);
             const we = new Date(ws); we.setDate(we.getDate() + 6);
             el.textContent = `${ws.getDate()} ${monthNamesShort[ws.getMonth()]} – ${we.getDate()} ${monthNamesShort[we.getMonth()]} ${we.getFullYear()}`;
         } else {
             el.textContent = selectedDate.toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
         }
     }
 
     // ── GÜN DETAY DRAWER ──────────────────────────────────────────
     window.openDayDrawer = (dateStr) => openDayDrawer(dateStr); // Faz 6: script-calendar-month-view.js için
    function openDayDrawer(dateStr) {
         const drawer = document.getElementById('cal-day-drawer');
         if (!drawer) return;

         const todayStr = window.formatDateToString(new Date());
         const isPast   = dateStr < todayStr;

         // Görev ekleme formu: geçmiş günlerde gizle
         const addForm = drawer.querySelector('.cdd-add-form');
         if (addForm) addForm.style.display = isPast ? 'none' : '';

         // Readonly badge: geçmiş günlerde göster
         let badge = drawer.querySelector('.cdd-readonly-badge');
         if (isPast) {
             if (!badge) {
                 badge = document.createElement('div');
                 badge.className = 'cdd-readonly-badge';
                 badge.innerHTML = '<i class="fa-solid fa-lock"></i> Geçmiş gün — yalnızca görüntüleme';
                 // quick-add'in yerine ekle
                 const qa = drawer.querySelector('.cdd-quick-add');
                 if (qa) qa.parentNode.insertBefore(badge, qa.nextSibling);
             }
             badge.style.display = '';
         } else {
             if (badge) badge.style.display = 'none';
         }

         drawer.classList.add('open');
         cddPopulateGoals();
         renderDayDrawer(dateStr);

         // Saat kutucuklarını o günün ilk boş dilimine ayarla (örn. 09-10 doluysa 10-11 önerilir)
         const cddTS = document.getElementById('cdd-time-start');
         const cddTE = document.getElementById('cdd-time-end');
         if (cddTS && cddTE && !isPast) {
             const nextSlot = getNextAvailableTimeSlot(dateStr);
             cddTS.value = nextSlot.start;
             cddTE.value = nextSlot.end;
         }

         // Günlük özet kartını render et
         window.renderDaySummary(dateStr);
     }

     function closeDayDrawer() {
         const drawer = document.getElementById('cal-day-drawer');
         if (drawer) drawer.classList.remove('open');
     }

     window.renderDayDrawer = function(dateStr) {
         const [dd, mm, yyyy] = dateStr.split('-');
         const date = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
         const todayStr = window.formatDateToString(new Date());
         const isFuture = dateStr > todayStr;
         const isPast   = dateStr < todayStr;

         // Başlık
         const weekdayEl = document.getElementById('cdd-weekday');
         const dateEl    = document.getElementById('cdd-date');
         if (weekdayEl) weekdayEl.textContent = date.toLocaleDateString('tr-TR', { weekday: 'long' });
         if (dateEl)    dateEl.textContent    = date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

         // Veri (isLessonPlanDraft: öğretmenin başka bir öğrenci için henüz atamadığı
         // ders planı taslağı — bu çekmecede görünmemeli)
         const dayEvents = (calendarEvents[dateStr] || [])
             .filter(e => !e.isLessonPlanDraft)
             .slice()
             .sort((a, b) => (a.timeStart || '').localeCompare(b.timeStart || ''));
         const dayHabits = getHabitsForDate(dateStr);
         const highlightHistory = FocusStorage.get('highlight_history', {});
         const highlight = highlightHistory[dateStr] || null;
         const total = dayEvents.length + dayHabits.length + (highlight ? 1 : 0);

         // İlerleme halkası
         const ring       = document.getElementById('cdd-ring');
         const ringCircle = document.getElementById('cdd-ring-circle');
         const ringText   = document.getElementById('cdd-ring-text');
         if (ring && total > 0 && !isFuture) {
             const done =
                 dayEvents.filter(ev => { const t = tasks.find(t => String(t.id) === String(ev.id)); return t && t.completed; }).length +
                 dayHabits.filter(h => !!h.history[dateStr]).length +
                 (highlight && highlight.completed ? 1 : 0);
             const pct = Math.round((done / total) * 100);
             ring.classList.add('visible');
             if (ringCircle) {
                 ringCircle.style.strokeDashoffset = 100.5 - (pct / 100) * 100.5;
                 ringCircle.style.stroke = pct === 100 ? '#2ed573' : '#ff9f43';
             }
             if (ringText) ringText.textContent = pct + '%';
         } else if (ring) {
             ring.classList.remove('visible');
         }

         // İçerik
         const content = document.getElementById('cdd-content');
         if (!content) return;

         if (total === 0) {
             const emptyMsg = isFuture
                 ? 'Bu güne henüz plan eklenmemiş.<br><span style="font-size:11px;opacity:0.6;">Hızlı ekle alanını kullanabilirsin.</span>'
                 : isPast
                     ? 'Bu gün için kayıtlı plan yok.'
                     : 'Bugün için plan bulunamadı.<br><span style="font-size:11px;opacity:0.6;">Hızlı ekle alanını kullanabilirsin.</span>';
             content.innerHTML = `<div class="cdd-empty">
                 <div class="cdd-empty-icon">${isPast ? '📖' : '📅'}</div>
                 <div class="cdd-empty-text">${emptyMsg}</div>
             </div>`;
             return;
         }

         let html = '';

         // Odak hedefi
         if (highlight) {
             html += `<div class="cdd-section-label">✦ Odak Hedefi</div>
             <div class="cdd-highlight ${highlight.completed ? 'completed' : ''}">
                 <i class="fa-solid fa-star"></i>
                 <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${highlight.text}</span>
                 ${highlight.completed ? '<i class="fa-solid fa-check" style="color:#2ed573;font-size:11px;flex-shrink:0;"></i>' : ''}
             </div>`;
         }

         // Görevler — zengin header + sil/düzenle butonları
         if (dayEvents.length > 0) {
             const evDone  = dayEvents.filter(ev => { const t = tasks.find(t => String(t.id) === String(ev.id)); return t && t.completed; }).length;
             const evTotal = dayEvents.length;
             const evPct   = Math.round((evDone / evTotal) * 100);
             const usedMin = dayEvents.reduce((s, ev) => s + Math.max(0, window.timeToMins(ev.timeEnd || '10:00') - window.timeToMins(ev.timeStart || '09:00')), 0);
             const usedH   = Math.floor(usedMin / 60);
             const usedM   = usedMin % 60;
             const usedStr = usedH > 0 ? `${usedH}s ${usedM > 0 ? usedM + 'dk' : ''}`.trim() : `${usedM}dk`;
             const burnoutPct = Math.min(100, Math.round((usedMin / 480) * 100));
             const burnoutColor = burnoutPct >= 100 ? '#ff4757' : burnoutPct >= 75 ? '#ff9f43' : '#2ed573';

             html += `
             <div class="cdd-tasks-header">
                 <div class="cdd-tasks-top">
                     <span class="cdd-tasks-label">Görevler</span>
                     <div class="cdd-tasks-badges">
                         <span class="cdd-badge-done">${evDone}/${evTotal} tamamlandı</span>
                         <span class="cdd-badge-time" style="color:${burnoutColor};">
                             <i class="fa-regular fa-clock"></i> ${usedStr}
                             ${burnoutPct >= 100 ? '<i class="fa-solid fa-fire-flame-curved" style="color:#ff4757;margin-left:2px;" title="Burnout riski!"></i>' : ''}
                         </span>
                     </div>
                 </div>
                 <div class="cdd-task-prog-track">
                     <div class="cdd-task-prog-fill" style="width:${evPct}%;background:${evPct===100?'#2ed573':'#D4900E'};"></div>
                 </div>
             </div>`;

             const pColors = { high: '#ff4757', medium: '#D4900E', low: '#00b894' };
             dayEvents.forEach(ev => {
                 const t     = tasks.find(t => String(t.id) === String(ev.id));
                 const done  = t && t.completed;
                 const pColor = pColors[ev.priority || 'medium'];
                 html += `
                 <div class="cdd-event ${done ? 'completed' : ''}"
                      style="border-left-color:${pColor};"
                      ${isPast ? '' : 'draggable="true"'}
                      data-ev-id="${ev.id}">
                     ${isPast ? '' : `<div class="cdd-drag-handle" title="Sürükle"><i class="fa-solid fa-grip-vertical"></i></div>`}
                     <div class="cdd-ev-left" data-action="cdd-toggle-task" data-id="${ev.id}" data-date="${dateStr}">
                         <div class="cdd-ev-check ${done ? 'done' : ''}">
                             ${done ? '<i class="fa-solid fa-check"></i>' : ''}
                         </div>
                         <div class="cdd-ev-body">
                             <div class="cdd-ev-title">${ev.text}</div>
                             <div class="cdd-ev-time">${ev.timeStart || '--'} – ${ev.timeEnd || '--'}</div>
                         </div>
                     </div>
                     <div class="cdd-ev-actions">
                         ${isPast ? '' : `<button class="cdd-act-btn" title="Düzenle"
                             data-action="cdd-edit-task" data-id="${ev.id}">
                             <i class="fa-solid fa-pen"></i>
                         </button>`}
                         <button class="cdd-act-btn del" title="Sil"
                             data-action="cdd-delete-task" data-id="${ev.id}" data-date="${dateStr}">
                             <i class="fa-solid fa-trash-can"></i>
                         </button>
                     </div>
                 </div>`;
             });
         }

         // Alışkanlıklar — streak + 7 günlük mini geçmiş
         if (dayHabits.length > 0) {
             const habDone  = dayHabits.filter(h => !!h.history[dateStr]).length;
             const habTotal = dayHabits.length;

             html += `
             <div class="cdd-tasks-header">
                 <div class="cdd-tasks-top">
                     <span class="cdd-tasks-label">Alışkanlıklar</span>
                     <span class="cdd-badge-done">${habDone}/${habTotal} tamamlandı</span>
                 </div>
                 <div class="cdd-task-prog-track">
                     <div class="cdd-task-prog-fill" style="width:${habTotal>0?Math.round((habDone/habTotal)*100):0}%;background:${habDone===habTotal&&habTotal>0?'#2ed573':'#a29bfe'};"></div>
                 </div>
             </div>`;

             dayHabits.forEach(h => {
                 const done = !!h.history[dateStr];

                 // Streak: seçili günden geriye ardışık tamamlanmış gün sayısı
                 const [hdd, hmm, hyyyy] = dateStr.split('-').map(Number);
                 let streak = 0;
                 let sd = new Date(hyyyy, hmm - 1, hdd);
                 sd.setHours(0, 0, 0, 0);
                 while (true) {
                     const sds = window.formatDateToString(sd);
                     if (h.history[sds]) { streak++; sd.setDate(sd.getDate() - 1); }
                     else break;
                 }

                 // Streak tipi: renk + emoji
                 const streakColor = streak >= 30 ? '#ff4757'
                                   : streak >= 14 ? '#ff9f43'
                                   : streak >= 7  ? '#fdcb6e'
                                   : streak >= 3  ? '#a29bfe'
                                   : '#636e72';
                 const streakIcon = streak >= 30 ? 'fa-fire-flame-curved'
                                  : streak >= 7  ? 'fa-fire'
                                  : 'fa-seedling';

                 // Son 7 günlük mini nokta geçmişi
                 let dotsHtml = '';
                 for (let i = 6; i >= 0; i--) {
                     const pd = new Date(hyyyy, hmm - 1, hdd - i);
                     const pds = window.formatDateToString(pd);
                     const filled = !!h.history[pds];
                     const isToday = i === 0;
                     dotsHtml += `<span class="cdd-hdot ${filled ? 'filled' : ''} ${isToday ? 'today' : ''}"
                         title="${pd.toLocaleDateString('tr-TR',{day:'numeric',month:'short'})}"></span>`;
                 }

                 const toggleAttr = isFuture
                     ? 'disabled title="Gelecek gün"'
                     : `data-action="cdd-toggle-habit" data-id="${h.id}" data-date="${dateStr}"`;

                 html += `
                 <div class="cdd-habit-card ${done ? 'done' : ''} ${isFuture ? 'future' : ''}">
                     <button class="cdd-habit-check-btn ${done ? 'done' : ''}" ${toggleAttr}>
                         ${done ? '<i class="fa-solid fa-check"></i>' : ''}
                     </button>
                     <div class="cdd-habit-main">
                         <div class="cdd-habit-name">${escapeHtml(h.name)}</div>
                         <div class="cdd-habit-dots-row">${dotsHtml}</div>
                     </div>
                     <div class="cdd-habit-streak" style="color:${streakColor};" title="${streak} günlük seri">
                         <i class="fa-solid ${streakIcon}"></i>
                         <span>${streak}</span>
                     </div>
                 </div>`;
             });
         }

         content.innerHTML = html;

         // ── DRAWER DRAG-AND-DROP: görev sıralaması (zaman takası) ────────
         let cddDragSrcId = null;

         content.querySelectorAll('.cdd-event[data-ev-id][draggable="true"]').forEach(card => {
             card.addEventListener('dragstart', e => {
                 cddDragSrcId = card.dataset.evId;
                 card.classList.add('cdd-dragging');
                 e.dataTransfer.effectAllowed = 'move';
                 // Sürüklenen öğenin görsel kopyasını hafiflet
                 e.dataTransfer.setData('text/plain', cddDragSrcId);
             });

             card.addEventListener('dragend', () => {
                 card.classList.remove('cdd-dragging');
                 content.querySelectorAll('.cdd-event').forEach(c => {
                     c.classList.remove('cdd-drag-over', 'cdd-drag-above', 'cdd-drag-below');
                 });
             });

             card.addEventListener('dragover', e => {
                 e.preventDefault();
                 if (card.dataset.evId === cddDragSrcId) return;
                 e.dataTransfer.dropEffect = 'move';
                 content.querySelectorAll('.cdd-event').forEach(c =>
                     c.classList.remove('cdd-drag-over', 'cdd-drag-above', 'cdd-drag-below'));
                 // Kartın üst/alt yarısına göre yön göster
                 const rect = card.getBoundingClientRect();
                 const midY = rect.top + rect.height / 2;
                 card.classList.add(e.clientY < midY ? 'cdd-drag-above' : 'cdd-drag-below');
                 card.classList.add('cdd-drag-over');
             });

             card.addEventListener('dragleave', () => {
                 card.classList.remove('cdd-drag-over', 'cdd-drag-above', 'cdd-drag-below');
             });

             card.addEventListener('drop', e => {
                 e.preventDefault();
                 const dstId = card.dataset.evId;
                 if (!cddDragSrcId || cddDragSrcId === dstId) return;
                 cddSwapTaskTimes(cddDragSrcId, dstId, dateStr);
             });
         });
         // ─────────────────────────────────────────────────────────────────
     };

     // İki drawer görevi arasında zaman aralıklarını takas et
     // ── GÜNLÜK ÖZET KARTI → script-day-summary-card.js dosyasına taşındı ──
     // (window.renderDaySummary olarak erişilebilir)
     // ─────────────────────────────────────────────────────────────

     function cddSwapTaskTimes(srcId, dstId, dateStr) {
         const srcTask = tasks.find(t => String(t.id) === String(srcId));
         const dstTask = tasks.find(t => String(t.id) === String(dstId));
         if (!srcTask || !dstTask) return;

         // tasks dizisinde takas
         const tmpStart = srcTask.timeStart, tmpEnd = srcTask.timeEnd;
         srcTask.timeStart = dstTask.timeStart;
         srcTask.timeEnd   = dstTask.timeEnd;
         dstTask.timeStart = tmpStart;
         dstTask.timeEnd   = tmpEnd;

         // calendarEvents içinde takas
         const dateEvs = calendarEvents[dateStr] || [];
         const srcEv = dateEvs.find(e => String(e.id) === String(srcId));
         const dstEv = dateEvs.find(e => String(e.id) === String(dstId));
         if (srcEv && dstEv) {
             const ts = srcEv.timeStart, te = srcEv.timeEnd;
             srcEv.timeStart = dstEv.timeStart; srcEv.timeEnd = dstEv.timeEnd;
             dstEv.timeStart = ts;              dstEv.timeEnd = te;
         }

         saveTasks();
         window.renderDayDrawer(dateStr);
         window.renderCalendar();
         if (typeof renderTasks === 'function') renderTasks();
     }

     // Drawer'daki hedef select'ini doldur
     function cddPopulateGoals() {
         const sel = document.getElementById('cdd-goal-select');
         if (!sel) return;
         const active = goals.filter(g => !g.completed);
         sel.innerHTML = `<option value="">— Ana hedefe bağla (isteğe bağlı)</option>` +
             active.map(g => `<option value="${g.id}">${escapeHtml(g.title)}</option>`).join('');
     }

     // Başlangıç saati değişince bitiş saatini 1 saat sonraya ayarla
     const _cddTStart = document.getElementById('cdd-time-start');
     const _cddTEnd   = document.getElementById('cdd-time-end');
     if (_cddTStart && _cddTEnd) {
         _cddTStart.addEventListener('change', () => {
             _cddTEnd.value = window.addOneHour(_cddTStart.value);
         });
     }

     // Saat kutuları: tıklayınca özel (tema uyumlu) saat listesi açılır
     let _cddTimePopoverEl = null;
     function cddCloseTimePopover() {
         if (_cddTimePopoverEl) {
             _cddTimePopoverEl.remove();
             _cddTimePopoverEl = null;
             document.removeEventListener('mousedown', cddTimePopoverOutsideClick, true);
         }
     }
     function cddTimePopoverOutsideClick(e) {
         if (_cddTimePopoverEl && !_cddTimePopoverEl.contains(e.target) && e.target.id !== 'cdd-time-start' && e.target.id !== 'cdd-time-end') {
             cddCloseTimePopover();
         }
     }
     function cddOpenTimePopover(inputEl) {
         cddCloseTimePopover();
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
                     cddCloseTimePopover();
                 });
                 pop.appendChild(item);
             }
         }
         document.body.appendChild(pop);
         const r = inputEl.getBoundingClientRect();
         pop.style.left = r.left + 'px';
         pop.style.top = (r.bottom + 4) + 'px';
         _cddTimePopoverEl = pop;
         const activeItem = pop.querySelector('.cdd-time-popover-item.active');
         if (activeItem) activeItem.scrollIntoView({ block: 'center' });
         setTimeout(() => document.addEventListener('mousedown', cddTimePopoverOutsideClick, true), 0);
     }
     if (_cddTStart) _cddTStart.addEventListener('click', () => cddOpenTimePopover(_cddTStart));
     if (_cddTEnd) _cddTEnd.addEventListener('click', () => cddOpenTimePopover(_cddTEnd));

     // Drawer hızlı ekle — çakışma + burnout korumalı, tüm alanlar
     function cddQuickAdd() {
         const inp    = document.getElementById('cdd-quick-input');
         const pri    = document.getElementById('cdd-quick-priority');
         const tSEl   = document.getElementById('cdd-time-start');
         const tEEl   = document.getElementById('cdd-time-end');
         const goalEl = document.getElementById('cdd-goal-select');
         if (!inp || !inp.value.trim()) {
             inp && inp.focus();
             return;
         }

         const smart    = parseSmartText(inp.value.trim());
         const text     = smart.cleanText || inp.value.trim();
         const priority = pri    ? pri.value    : 'medium';
         const tStart   = (smart.parsedTime) || (tSEl ? tSEl.value : '09:00');
         const tEnd     = tEEl  ? tEEl.value   : window.addOneHour(tStart);
         const goalId   = goalEl ? goalEl.value : '';
         const ds       = window.formatDateToString(selectedDate);
         const sMins    = window.timeToMins(tStart);
         const eMins    = window.timeToMins(tEnd);

         // Bitiş saati başlangıçtan önce olamaz
         if (eMins <= sMins) {
             showPremiumModal({ title: 'Geçersiz Saat', message: 'Bitiş saati başlangıç saatinden sonra olmalı.', type: 'warning' });
             return;
         }

         // 1. Zaman çakışması
         if (hasTimeConflict(ds, sMins, eMins)) {
             showPremiumModal({ title: 'Zaman Çakışması', message: `${tStart}–${tEnd} aralığında zaten bir planın var.`, type: 'warning' });
             return;
         }

         // 2. Burnout (480 dk = 8 saat)
         const usedMin = (calendarEvents[ds] || []).reduce((s, ev) =>
             s + Math.max(0, window.timeToMins(ev.timeEnd || '10:00') - window.timeToMins(ev.timeStart || '09:00')), 0);
         if (usedMin + Math.max(0, eMins - sMins) > 480) {
             showPremiumModal({ title: 'Kapasite Uyarısı! 🔥', message: 'Bu güne 8 saatten fazla görev yığdın. Hedeflerini diğer günlere dağıt.', type: 'warning' });
             return;
         }

         // 3. Hedef tarihi sınır kontrolü
         if (goalId && !checkGoalDateBoundaries(goalId, ds)) return;

         // 4. Görevi ekle
         addGlobalTask(text, priority, 'is', ds, tStart, tEnd, '', goalId);

         // 5. Formu sıfırla — saat kutucuklarını bir sonraki boş dilime ilerlet (örn. 09-10 eklendiyse 10-11)
         inp.value = '';
         const nextSlot = getNextAvailableTimeSlot(ds, eMins - sMins || 60);
         if (tSEl) tSEl.value = nextSlot.start;
         if (tEEl) tEEl.value = nextSlot.end;
         if (goalEl) goalEl.value = '';

         // 6. Tam senkronizasyon
         window.renderDayDrawer(ds);
         window.renderDaySummary(ds);
         window.renderCalendar();
         window.renderEvents();
         if (typeof renderTasks  === 'function') renderTasks();
         if (typeof updateStats  === 'function') updateStats();
         if (typeof renderGoals  === 'function') renderGoals();
     }

     // Drawer event listener'ları
     const _cddClose   = document.getElementById('cdd-close');
     const _cddQBtn    = document.getElementById('cdd-quick-btn');
     const _cddQInp    = document.getElementById('cdd-quick-input');
     const _cddOpenDay = document.getElementById('cdd-open-daily');
     if (_cddClose)   _cddClose.addEventListener('click', closeDayDrawer);
     if (_cddQBtn)    _cddQBtn.addEventListener('click', cddQuickAdd);
     if (_cddQInp)    _cddQInp.addEventListener('keypress', e => { if (e.key === 'Enter') cddQuickAdd(); });
     if (_cddOpenDay) _cddOpenDay.addEventListener('click', () => { closeDayDrawer(); switchCalView('daily'); });
     // ──────────────────────────────────────────────────────────────

     window.switchCalView = (view) => switchCalView(view); // Faz 6: script-calendar-week-day-view.js için
    function switchCalView(view) {
         currentCalView = view;
         document.querySelectorAll('.cal-view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));

         // Görünüm değişince drawer'ı kapat
         closeDayDrawer();

         // Seçili günü yeni görünüme taşı: selectedDate her zaman bağlam kaynağı
         currentDate = new Date(selectedDate);

         const prevPanel = document.querySelector('.cal-view-panel.active');
         const nextPanel = document.getElementById('cal-view-' + view);

         if (!nextPanel || prevPanel === nextPanel) {
             // Aynı panel — sadece yenile
             updateCalUnifiedTitle();
             if (view === 'monthly') { window.renderCalendar(); window.renderEvents(); }
             else if (view === 'weekly') window.renderWeeklyView();
             else window.renderDailyView();
             return;
         }

         // Mevcut paneli fade-out yap
         if (prevPanel) {
             prevPanel.classList.add('cal-panel-leaving');
             setTimeout(() => {
                 prevPanel.classList.remove('active', 'cal-panel-leaving');
                 prevPanel.style.display = 'none';
             }, 150);
         }

         // Yeni paneli kısa gecikme sonrası fade-in yap
         setTimeout(() => {
             nextPanel.classList.remove('hidden');
             nextPanel.style.display = 'flex';
             // Tarayıcıya bir frame ver, sonra animasyonu tetikle
             requestAnimationFrame(() => {
                 requestAnimationFrame(() => {
                     nextPanel.classList.add('active', 'cal-panel-entering');
                     setTimeout(() => nextPanel.classList.remove('cal-panel-entering'), 220);
                 });
             });
             updateCalUnifiedTitle();
             if (view === 'monthly') { window.renderCalendar(); window.renderEvents(); }
             else if (view === 'weekly') window.renderWeeklyView();
             else window.renderDailyView();
         }, 120);
     }
 
     function calUnifiedPrev() {
         if (currentCalView === 'monthly') { 
             currentDate.setMonth(currentDate.getMonth() - 1); 
             window.renderCalendar(); 
         }
         else if (currentCalView === 'weekly') { 
             selectedDate = new Date(selectedDate); 
             selectedDate.setDate(selectedDate.getDate() - 7); 
             currentDate = new Date(selectedDate); // Üst tarafı senkronize etmek için
             window.renderWeeklyView(); 
         }
         else { 
             selectedDate = new Date(selectedDate); 
             selectedDate.setDate(selectedDate.getDate() - 1); 
             currentDate = new Date(selectedDate); // Üst tarafı senkronize etmek için
             window.renderDailyView(); 
         }
         updateCalUnifiedTitle();
     }
 
     function calUnifiedNext() {
         if (currentCalView === 'monthly') { 
             currentDate.setMonth(currentDate.getMonth() + 1); 
             window.renderCalendar(); 
         }
         else if (currentCalView === 'weekly') { 
             selectedDate = new Date(selectedDate); 
             selectedDate.setDate(selectedDate.getDate() + 7); 
             currentDate = new Date(selectedDate); // Üst tarafı senkronize etmek için
             window.renderWeeklyView(); 
         }
         else { 
             selectedDate = new Date(selectedDate); 
             selectedDate.setDate(selectedDate.getDate() + 1); 
             currentDate = new Date(selectedDate); // Üst tarafı senkronize etmek için
             window.renderDailyView(); 
         }
         updateCalUnifiedTitle();
     }
 
     function calUnifiedToday() {
         const t = new Date();
         currentDate = new Date(t);
         selectedDate = new Date(t);
         updateCalUnifiedTitle();
         if (currentCalView === 'monthly') { window.renderCalendar(); window.renderEvents(); }
         else if (currentCalView === 'weekly') window.renderWeeklyView();
         else window.renderDailyView();
     }
 
     // ── TAKVİM TAM EKRAN MODU ──
     (function() {
         let isFullscreen = false;
         const btn = document.getElementById('cal-fullscreen-btn');
         const section = document.getElementById('takvim');
         if (!btn || !section) return;
 
         function toggleCalFullscreen() {
             isFullscreen = !isFullscreen;
 
             if (isFullscreen) {
                 // 1. Orijinal konumu kaydet
                 section._fsOriginalParent = section.parentNode;
                 section._fsOriginalNextSibling = section.nextSibling;
 
 
                 // 3. Body'e taşı
                 document.body.appendChild(section);
 
                 // 4. Fullscreen stilleri ve buton durumunu yükle
                 section.classList.add('cal-is-fullscreen');
                 document.body.classList.add('has-cal-fullscreen');
                 btn.classList.add('fs-active');
                 btn.querySelector('i').className = 'fa-solid fa-compress';
                 btn.title = 'Küçült (F veya Esc)';
 
                 switchCalView('monthly');
 
 
             } else {
                 // CSS kapanış animasyonunu başlat
                 section.classList.add('cal-is-closing');
                 btn.classList.remove('fs-active');
                 btn.querySelector('i').className = 'fa-solid fa-expand';
                 btn.title = 'Tam Ekran (F)';
 
                 // Animasyon (500ms) bitince eski yerine taşı
                 setTimeout(() => {
                     section.classList.remove('cal-is-fullscreen');
                     section.classList.remove('cal-is-closing');
                     document.body.classList.remove('has-cal-fullscreen');
 
                     if (section._fsOriginalParent) {
                         section._fsOriginalParent.insertBefore(
                             section,
                             section._fsOriginalNextSibling || null
                         );
                     }
 
                     requestAnimationFrame(() => {
                         if (currentCalView === 'monthly') {
                             if (typeof window.renderCalendar === 'function') window.renderCalendar();
                             if (typeof window.renderEvents === 'function') window.renderEvents();
                         } else if (currentCalView === 'weekly') {
                             if (typeof window.renderWeeklyView === 'function') window.renderWeeklyView();
                         } else {
                             if (typeof window.renderDailyView === 'function') window.renderDailyView();
                         }
                     });
                 }, 850);
             }
         }
 
         btn.addEventListener('click', (e) => { e.stopPropagation(); toggleCalFullscreen(); });
 
         // Klavye kısayolu: F tuşu açar, Esc kapatır
         document.addEventListener('keydown', (e) => {
             const onCalPage = document.getElementById('takvim')?.classList.contains('active');
             if (!onCalPage) return;
             if (e.key === 'Escape' && isFullscreen) { toggleCalFullscreen(); return; }
             if (e.key === 'f' || e.key === 'F') {
                 const tag = document.activeElement?.tagName;
                 if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
                 toggleCalFullscreen();
             }
         });
     })();
 
     // Sadece geçerli bir görünüm değerine (data-view) sahip butonların tıklanmasını sağla
     document.querySelectorAll('.cal-view-btn').forEach(btn => {
         if (btn.dataset.view) {
             btn.addEventListener('click', () => switchCalView(btn.dataset.view));
         }
     });
     const _calPrev = document.getElementById('cal-unified-prev');
     const _calNext = document.getElementById('cal-unified-next');
     const _calToday = document.getElementById('cal-unified-today');
     if (_calPrev) _calPrev.addEventListener('click', calUnifiedPrev);
     if (_calNext) _calNext.addEventListener('click', calUnifiedNext);
     if (_calToday) _calToday.addEventListener('click', calUnifiedToday);
 
     // ────────────────────────────────────────────
 
 
     // İlk yükleme: unified title güncelle
     updateCalUnifiedTitle();
 
     // ════════════════════════════════════════════════════════════
 
 
     renderCalendarRef = window.renderCalendar;
     window.renderCalendarRef = renderCalendarRef; // script-milestone-goal-actions.js gibi ayrı modüllerden erişim için

     // Sayfa yenilendiyse ve takvim sekmesi aktifse içeriği render et.
     // _restoredTab ayrıca aşağıdaki ilk yükleme render sırasını (bkz. "aktif
     // sekmeyi önce çiz" notu) belirlemek için kullanılıyor.
     const _restoredTab = FocusStorage.get('lastActiveTab', 'bugun');
     if (_restoredTab === 'takvim') {
         switchCalView(currentCalView || 'monthly');
     }

     // renderEventsRef: gizli compat elementi + açık drawer'ı birlikte güncelle
     renderEventsRef = function() {
         window.renderEvents();
         const drawer = document.getElementById('cal-day-drawer');
         if (drawer && drawer.classList.contains('open')) {
             const ds = window.formatDateToString(selectedDate);
             window.renderDayDrawer(ds);
             window.renderDaySummary(ds);
         }
     };
     window.renderEventsRef = renderEventsRef; // script-milestone-goal-actions.js gibi ayrı modüllerden erişim için
     renderHabitsRef = renderHabits;
     renderStatisticsRef = renderStatistics;

     document.querySelectorAll('.stats-filter-btn').forEach(btn => {
         btn.addEventListener('click', () => {
             document.querySelectorAll('.stats-filter-btn').forEach(b => b.classList.remove('active'));
             btn.classList.add('active');
             statsActiveFilter = parseInt(btn.dataset.filter);
             window.renderStatistics();
         });
     });
     renderJournalRef = buildMassiveLibraryRows;
     renderSocialStatsRef = renderSocialStats;
     renderBuddyHabitsRef = renderBuddyHabits;
     renderMindDumpsRef = window.renderMindDumps;
 
 
     populateParentHabitSelects();
     renderTasks();
     window.renderEvents();

     // İlk yüklemede ekranda GÖRÜNEN sekmenin (yenileme sonrası geri yüklenen
     // sekme) render'ı hemen, senkron çalışır; görünmeyen diğer sekmelerin
     // (takvim/istatistik/habitler/sosyal/zihin çöplüğü) ağır render'ları bir
     // sonraki frame'e ertelenir. Eskiden hepsi burada art arda senkron
     // çalışıyordu — kullanıcı hangi sekmede yenilerse yenilesin, önce diğer
     // TÜM sekmelerin (görünmeyen) içerikleri hesaplanıp DOM'a yazılıyor,
     // ekrandaki sekme en son sırada render ediliyordu. Özellikle Zihin
     // Çöplüğü'nde bu yüzden ilk açılış "kasıyor/geç yükleniyor" gibi
     // hissettiriyordu (bkz. kullanıcı geri bildirimi) — o sekme listede en
     // sonda olduğu için takvim/istatistik gibi daha ağır render'lar bitene
     // kadar ekrana hiçbir şey basılmıyordu.
     const _runOrDefer = (tabId, fn) => {
         if (_restoredTab === tabId) fn();
         else requestAnimationFrame(fn);
     };
     _runOrDefer('takvim', window.renderCalendar);
     // Sınıf ödevleri (social.js window.FocusAssignments) yüklendikçe/değiştikçe
     // Bugün listesi ve Takvim'i tazele — ilk render sırasında ödev verisi henüz
     // Supabase'den gelmemiş olabilir, bu event geldiğinde ikisi de güncellenir.
     window.addEventListener('focusai:assignments-updated', () => {
         if (typeof renderTasks === 'function') renderTasks();
         if (typeof window.renderCalendar === 'function') window.renderCalendar();
     });
     _runOrDefer('aliskanliklar', () => {
         renderHabitCategories();
         renderHabitFilters();
         renderHabits();
     });
     _runOrDefer('istatistikler', renderStatistics);
     _runOrDefer('arkadaslar', () => {
         renderSocialStats();
         renderBuddyHabits();
     });
     _runOrDefer('zihin-coplugu', window.renderMindDumps);

     if(document.getElementById('my-groups-container')) {
         // Faz F: renderMyGroups/loadGroupDetails artık script-coworking-groups.js'te tanımlı
         // ve o dosya script.js'ten SONRA yüklenir — bu yüzden mikro-task ile ertele.
         setTimeout(() => {
             if (typeof window.renderMyGroups === 'function') window.renderMyGroups();
             if (typeof window.loadGroupDetails === 'function') window.loadGroupDetails("g1");
         }, 0);
     }
     
     checkEveningReflection();
 
     const btnExport      = document.getElementById('btn-export-data');
     const btnImport      = document.getElementById('btn-import-data');
     const importFileInput= document.getElementById('import-file-input');
     const importModal    = document.getElementById('import-confirm-modal');
     const importCancelBtn= document.getElementById('import-cancel-btn');
     const importConfirmBtn=document.getElementById('import-confirm-btn');
     const importFirstBackupBtn = document.getElementById('import-first-backup-btn');
     const importFileName = document.getElementById('import-file-name');
     const importFileSize = document.getElementById('import-file-size');
     const importFileInfo = document.getElementById('import-file-info');
 
     let pendingImportFile = null;
 
     if (btnExport) {
         btnExport.addEventListener('click', () => DataManager.exportData());
     }
 
     if (btnImport) {
         btnImport.addEventListener('click', () => importFileInput && importFileInput.click());
     }
 
     if (importFileInput) {
         importFileInput.addEventListener('change', (e) => {
             const file = e.target.files[0];
             if (!file) return;
             pendingImportFile = file;
 
             if (importFileName) importFileName.textContent = file.name;
             if (importFileSize) importFileSize.textContent = `Boyut: ${(file.size / 1024).toFixed(1)} KB`;
             if (importFileInfo) importFileInfo.style.display = 'block';
             if (importModal)    importModal.classList.remove('hidden');
 
             importFileInput.value = ''; 
         });
     }
 
     if (importCancelBtn) {
         importCancelBtn.addEventListener('click', () => {
             pendingImportFile = null;
             if (importModal) importModal.classList.add('hidden');
         });
     }
 
     if (importFirstBackupBtn) {
         importFirstBackupBtn.addEventListener('click', () => DataManager.exportData());
     }
 
     if (importConfirmBtn) {
         importConfirmBtn.addEventListener('click', async () => {
             if (!pendingImportFile) return;
             importConfirmBtn.disabled = true;
             importConfirmBtn.textContent = 'Yükleniyor...';
             try {
                 const exportDate = await DataManager.importData(pendingImportFile);
                 if (importModal) importModal.classList.add('hidden');
                 pendingImportFile = null;
 
                 showPremiumModal({
                     title: 'İçe Aktarma Başarılı!',
                     message: `Yedek (${exportDate}) başarıyla yüklendi. Değişikliklerin yansıması için sayfa yenilenecek.`,
                     type: 'success',
                     confirmText: 'Tamam, Yenile',
                     onConfirm: () => window.location.reload()
                 });
             } catch (err) {
                 showPremiumModal({
                     title: 'İçe Aktarma Başarısız',
                     message: err.message,
                     type: 'warning'
                 });
             } finally {
                 importConfirmBtn.disabled = false;
                 importConfirmBtn.innerHTML = '<i class="fa-solid fa-check"></i> İçe Aktar';
             }
         });
     }
 
 
 // ============ PREMIUM ODAK GÖREVİ & KONFETİ SİSTEMİ ============
 const taskSelector = document.getElementById('active-task-selector');
 const taskDropdown = document.getElementById('timer-task-dropdown');
 const timerTodoList = document.getElementById('timer-todo-list');
 const focusTaskText = document.getElementById('current-focus-task-text');
 
 // Eski tasarımı gizleyip yeni şık butona bağlıyoruz
 const oldActiveFocusPanel = document.getElementById('active-focus-task');
 if(oldActiveFocusPanel) oldActiveFocusPanel.style.display = 'none';
 
 window.startFocusMode = function(id) {
     activeFocusTask = String(id);
     let taskName = "Bilinmeyen Görev";
 
     // 1. Önce normal görevlerde ara (Bugün veya Takvim)
     let t = tasks.find(x => String(x.id) === String(id));
     if (t) taskName = t.text;
     
     // 2. Bulamadıysak Alışkanlıklarda ara
     if (!t) {
         let h = habits.find(x => String(x.id) === String(id));
         if (h) taskName = h.name;
     }
 
     // 3. Bulamadıysak Günün Ana Hedefi mi diye bak
     if (!t && id === 'highlight-task') {
         const todayStr = window.formatDateToString(new Date());
         let highlightHistory = FocusStorage.get('highlight_history', {});
         if (highlightHistory[todayStr]) taskName = highlightHistory[todayStr].text;
     }
 
     focusTaskText.innerHTML = `<i class="fa-solid fa-crosshairs" style="color:#ff9f43;"></i> <span style="color:#ff9f43;">${escapeHtml(taskName)}</span>`;
     switchTab('zamanlayici'); 
 };
 
 window.clearFocusMode = function() {
     activeFocusTask = null;
     focusTaskText.innerHTML = `<i class="fa-solid fa-bullseye"></i> Odaklanılacak Hedefi Seç`;
 };

 // Dropdown Menüyü Her Yerden (Takvim, Alışkanlık, Bugün) Gelen Verilerle Doldur
 function updateTimerDropdown() {
     if(!timerTodoList) return;
     timerTodoList.innerHTML = '';
 
     // --- YENİ EKLENEN: ODAĞI İPTAL ET BUTONU ---
     if (activeFocusTask) {
         const clearLi = document.createElement('li');
         clearLi.className = 'timer-todo-item';
         clearLi.innerHTML = `<i class="fa-solid fa-xmark" style="color:#ff4757;"></i> <span class="task-name" style="color:#ff4757; font-weight: 600;">Odağı Kaldır</span>`;
         clearLi.onclick = (e) => {
             e.stopPropagation();
             window.clearFocusMode(); // Odağı sıfırla
             taskDropdown.classList.add('hidden'); // Menüyü kapat
         };
         timerTodoList.appendChild(clearLi);
 
         // Araya hafif şeffaf bir çizgi çekiyoruz ki görevlerle karışmasın
         const hr = document.createElement('hr');
         hr.style.border = '0';
         hr.style.borderTop = '1px solid rgba(255,255,255,0.1)';
         hr.style.margin = '5px 0';
         timerTodoList.appendChild(hr);
     }
     // --------------------------------------------
 
     const todayStr = window.formatDateToString(new Date());
     let yest = new Date();
     yest.setDate(yest.getDate() - 1);
     const yesterdayStr = window.formatDateToString(yest);
 
     // 1. Bugünün Görevleri (Takvim dahil) + Dünden sarkanlar
     // isLessonPlanDraft: öğretmenin başka bir öğrenci için henüz atamadığı ders planı taslağı — gizli.
     const todayTasks = tasks.filter(t =>
         !t.isLessonPlanDraft && (
             (t.date === todayStr && !t.completed) ||
             (t.date === yesterdayStr && t.isOvernight && !t.completed)
         )
     );
 
     // 2. Bugünün Alışkanlıkları
     const todayHabits = getHabitsForDate(todayStr).filter(h => !h.history[todayStr]);
 
     // 3. Günün Ana Hedefi
     let highlightHistory = FocusStorage.get('highlight_history', {});
     let todayHighlight = highlightHistory[todayStr];
     let hasHighlight = todayHighlight && !todayHighlight.completed;
 
     // Eğer odaklanılacak hiçbir şey kalmadıysa ve aktif odak yoksa boş uyarı ver
     if(todayTasks.length === 0 && todayHabits.length === 0 && !hasHighlight) {
         if(!activeFocusTask) {
             timerTodoList.innerHTML = '<li style="padding:10px; text-align:center; color:var(--text-muted); font-size:12px;">Bugün için bekleyen plan yok.</li>';
         }
         return;
     }
 
     // Günün Hedefini Ekle
     if(hasHighlight) {
         const li = document.createElement('li');
         li.className = 'timer-todo-item';
         li.innerHTML = `<i class="fa-solid fa-star" style="color:#ff9f43;"></i> <span class="task-name" style="color:#ff9f43;">${escapeHtml(todayHighlight.text)}</span> <span style="font-size:10px; background:rgba(255,159,67,0.2); color:#ff9f43; padding:2px 6px; border-radius:8px; margin-left:auto;">Ana Hedef</span>`;
         li.onclick = (e) => {
             e.stopPropagation();
             window.startFocusMode('highlight-task');
             taskDropdown.classList.add('hidden');
         };
         timerTodoList.appendChild(li);
     }
 
     // Görevleri Ekle (Takvim ve Bugün sayfasından gelenler)
     todayTasks.forEach(task => {
         const li = document.createElement('li');
         li.className = 'timer-todo-item';
         li.innerHTML = `<i class="fa-regular fa-circle"></i> <span class="task-name">${escapeHtml(task.text)}</span> <span style="font-size:10px; opacity:0.5; margin-left:auto;">Görev</span>`;
         li.onclick = (e) => {
             e.stopPropagation();
             window.startFocusMode(task.id);
             taskDropdown.classList.add('hidden');
         };
         timerTodoList.appendChild(li);
     });
 
     // Alışkanlıkları Ekle
     todayHabits.forEach(habit => {
         const li = document.createElement('li');
         li.className = 'timer-todo-item';
         li.innerHTML = `<i class="fa-solid fa-leaf" style="color:#c88ce6;"></i> <span class="task-name" style="color:#c88ce6;">${escapeHtml(habit.name)}</span> <span style="font-size:10px; opacity:0.5; margin-left:auto;">Alışkanlık</span>`;
         li.onclick = (e) => {
             e.stopPropagation();
             window.startFocusMode(habit.id);
             taskDropdown.classList.add('hidden');
         };
         timerTodoList.appendChild(li);
     });
 }
 
 // Menünün aniden kapanmasını önleyen akıllı tıklama sistemi
 if(taskSelector) {
     taskSelector.addEventListener('click', (e) => {
         if (e.target.closest('#timer-task-dropdown')) return; // Listenin içine tıklandıysa menüyü kapatma
         updateTimerDropdown();
         taskDropdown.classList.toggle('hidden');
     });
 }
 document.addEventListener('click', (e) => {
     if(taskSelector && !taskSelector.contains(e.target)) {
         taskDropdown.classList.add('hidden');
     }
 });

 // --- SÜRE SONU SORU VE KONFETİ İŞLEMLERİ → script-task-end-question.js dosyasına taşındı ---
 window.__nextBreakMode = window.__nextBreakMode || 'shortBreak'; // Molayı hafızada tutmak için (script-task-end-question.js tarafından okunuyor/yazılıyor)


 // ============ ANA HEDEFLER (GOALS) VE YAPAY ZEKA SİSTEMİ ============
 // Aynı anda çok fazla aktif "ana hedef" (uzun vadeli vizyon) taşımak odağı dağıtıp
 // motivasyon düşüşüne yol açabiliyor (goal dilution etkisi) — bu yüzden aktif hedef
 // sayısını sınırlıyoruz. Günlük görevleri değil, büyük vizyonları kapsar.
 const MAX_ACTIVE_GOALS = 5;
 const btnOpenGoalModal = document.getElementById('btn-open-goal-modal');
 const goalModal = document.getElementById('goal-modal');
 const closeGoalModalBtn = document.getElementById('close-goal-modal-btn');
 const cancelGoalBtn = document.getElementById('cancel-goal-btn');
 const saveGoalBtn = document.getElementById('save-goal-btn');
 const goalsContainer = document.getElementById('goals-container');
 if (goalsContainer) {
     goalsContainer.addEventListener('click', (e) => {
         const el = e.target.closest('[data-action]');
         if (!el) return;
         const action = el.dataset.action;
         if (action === 'open-goal-modal') {
             const btn = document.getElementById('btn-open-goal-modal');
             if (btn) btn.click();
         } else if (action === 'click-active-goal-tab') {
             const tabBtn = document.querySelector('.goal-tab-btn[data-goal-filter="active"]');
             if (tabBtn) tabBtn.click();
         } else if (action === 'extend-goal-deadline') {
             e.stopPropagation();
             window.extendGoalDeadline(el.dataset.id);
         } else if (action === 'delete-goal') {
             e.stopPropagation();
             window.deleteGoal(el.dataset.id);
         } else if (action === 'quick-complete-goal') {
             e.stopPropagation();
             window.quickCompleteGoal(el.dataset.id);
         } else if (action === 'open-goal-details') {
             e.stopPropagation();
             window.openGoalDetails(el.dataset.id);
         }
     });
 }

 function openGoalModal() {
     const activeGoalCount = goals.filter(g => g.status !== 'completed' && g.status !== 'expired').length;
     if (activeGoalCount >= MAX_ACTIVE_GOALS) {
         showPremiumModal({
             title: 'Odağını Koru 🎯',
             message: `Aynı anda en fazla ${MAX_ACTIVE_GOALS} aktif ana hedef belirleyebilirsin. Çok sayıda hedef aynı anda motivasyonu dağıtır ve hiçbirini tam anlamıyla bitiremezsin. Yeni bir vizyon eklemeden önce mevcut hedeflerinden birini tamamla ya da arşivle.`,
             type: 'warning'
         });
         return;
     }
     goalModal.classList.remove('hidden');
     if(document.getElementById('edit-goal-id')) document.getElementById('edit-goal-id').value = '';
     document.getElementById('goal-title-input').value = '';
     document.getElementById('goal-desc-input').value = '';
     const _deadlineEl = document.getElementById('goal-deadline-input');
    if (_deadlineEl._flatpickr) { _deadlineEl._flatpickr.setDate(new Date()); }
    else { _deadlineEl.value = window.toInputDate(window.formatDateToString(new Date())); }
 }
 function closeGoalModal() {
     goalModal.classList.add('hidden');
 }
 // Not: index.html kendi closeGoalModal/openGoalModal fallback'lerini ayrıca
 // tanımlıyor (script.js'in DOMContentLoaded'ı henüz çalışmamışsa veya
 // hata verirse diye) — bu yüzden yukarıdaki yerel fonksiyon global'e
 // export edilmiyor; index.html'deki tanım gerçek global'i sağlıyor.

 // Modal içinden düzenleme butonuna basınca çalışacak fonksiyon
// window.editGoalInfo -> script-goal-modal.js dosyasına taşındı (Faz 2, 2026-07-20).
 
 if(btnOpenGoalModal) {
     btnOpenGoalModal._mainListenerAdded = true;
     btnOpenGoalModal.addEventListener('click', openGoalModal);
 }
 if(closeGoalModalBtn) closeGoalModalBtn.addEventListener('click', closeGoalModal);
 if(cancelGoalBtn) cancelGoalBtn.addEventListener('click', closeGoalModal);

// Zafer Modalı butonları, window._saveGoalImpl, window.deleteGoal,
// generateAIAnalysis, hedef sekme/sıralama, window.renderGoals ->
// script-goal-modal.js dosyasına taşındı (Faz 2, 2026-07-20).
 
 // Uygulama başlarken hedefleri de yükle
 renderGoals();

 // --- SÜRESİ DOLAN HEDEFİ AKTİFE GERİ TAŞIMA (Süreyi Uzat) → script-goal-deadline-extend.js dosyasına taşındı ---

 // microBurst, fireConfetti -> script-confetti.js dosyasına taşındı (Faz 2,
 // 2026-07-20). Paylaşılan state yok, window.microBurst/window.fireConfetti
 // köprüsüyle erişilir. Yükleme sırası önemsiz (bu modülün çağrıları hep
 // olay tetikleyicileri içinde, script.js'in kendi DOMContentLoaded'ının
 // en üst seviyesinde değil).

 // Alışkanlık Düzenleme Modalı (openEditHabitModal/closeEditHabitModalFunc/
 // kaydet) -> script-habit-edit-modal.js dosyasına taşındı (Faz 2, 2026-07-20).
 
 // ==========================================
     // HEDEF DETAY ODASI (KOMUTA MERKEZİ) MANTIĞI - BÖLÜM 1
     // ==========================================
     const goalDetailsModal = document.getElementById('goal-details-modal');
     const closeGoalDetailsBtn = document.getElementById('close-goal-details-btn');
 
     // Modalı Kapatma
     if(closeGoalDetailsBtn) {
         closeGoalDetailsBtn.addEventListener('click', () => {
             goalDetailsModal.classList.add('hidden');
         });
     }

     // Detay odası içindeki görev/alışkanlık/dönüm noktası aksiyonları (Event Delegation)
     if (goalDetailsModal) {
         goalDetailsModal.addEventListener('click', (e) => {
             const el = e.target.closest('[data-action]');
             if (!el) return;
             const action = el.dataset.action;
             const goalId = el.dataset.goalId;
             if (action === 'gd-toggle-highlight-task') {
                 toggleHighlightTask(el.dataset.date);
                 setTimeout(() => updateGoalDetailsUI(goalId), 50);
             } else if (action === 'gd-toggle-task') {
                 toggleTask(el.dataset.id);
                 setTimeout(() => updateGoalDetailsUI(goalId), 50);
             } else if (action === 'gd-delete-task') {
                 deleteGlobalTask(el.dataset.id, el.dataset.taskDate);
                 setTimeout(() => updateGoalDetailsUI(goalId), 50);
             } else if (action === 'gd-toggle-habit') {
                 window.toggleHabitFromToday(el.dataset.id, el.dataset.date);
                 setTimeout(() => updateGoalDetailsUI(goalId), 100);
             } else if (action === 'gd-edit-milestone') {
                 editMilestone(goalId, el.dataset.id);
             } else if (action === 'gd-delete-milestone') {
                 deleteMilestone(goalId, el.dataset.id);
             }
         });
     }

     // Haftalık takvim ızgarası (Event Delegation) — hücreler + günlük plan çipleri
     const weeklyGridInnerEl = document.getElementById('weekly-grid-inner');
     if (weeklyGridInnerEl) {
         weeklyGridInnerEl.addEventListener('click', (e) => {
             const el = e.target.closest('[data-action]');
             if (!el) return;
             const action = el.dataset.action;
             if (action === 'weekly-day-header-click') {
                 window.weeklyDayHeaderClick(el.dataset.date);
             } else if (action === 'weekly-hour-cell-click') {
                 const h = parseInt(el.dataset.hour, 10);
                 window.openCalInlineAdd(el.dataset.date, h, el, e);
             } else if (action === 'weekly-chip-toggle') {
                 window.weeklyChipToggle(el.dataset.id);
             } else if (action === 'weekly-chip-edit') {
                 window.editTask(el.dataset.id);
             }
             // 'weekly-chip-noop' → sadece hücrenin click'ini durdurmak için var, ekstra davranış yok
         });
         weeklyGridInnerEl.addEventListener('dragover', (e) => {
             const cell = e.target.closest('.weekly-hour-cell');
             if (!cell) return;
             window.calDragOver(e, cell, parseInt(cell.dataset.hour, 10), 60);
         });
         weeklyGridInnerEl.addEventListener('dragleave', (e) => {
             const cell = e.target.closest('.weekly-hour-cell');
             if (cell) window.calDragLeave(cell);
         });
         weeklyGridInnerEl.addEventListener('drop', (e) => {
             const cell = e.target.closest('.weekly-hour-cell');
             if (!cell) return;
             window.weeklyDropHandler(e, cell.dataset.date, parseInt(cell.dataset.hour, 10));
             cell.classList.remove('drag-over');
         });
         weeklyGridInnerEl.addEventListener('dragstart', (e) => {
             const chip = e.target.closest('.weekly-event-chip[data-drag-id]');
             if (!chip) return;
             window.weeklyChipDragStart(e, chip.dataset.dragId, chip.dataset.dragDate);
         });
         weeklyGridInnerEl.addEventListener('dragend', () => window.calDragEnd());
     }

     // Günlük takvim ızgarası (Event Delegation) — hücreler + görev blokları
     const dailyTimelineGridEl = document.getElementById('daily-timeline-grid');
     if (dailyTimelineGridEl) {
         dailyTimelineGridEl.addEventListener('click', (e) => {
             const el = e.target.closest('[data-action]');
             if (!el) return;
             const action = el.dataset.action;
             if (action === 'daily-hour-cell-click') {
                 const h = parseInt(el.dataset.hour, 10);
                 const ds = window.formatDateToString(selectedDate);
                 window.openCalInlineAdd(ds, h, el, e);
             } else if (action === 'daily-toggle-task') {
                 window.toggleTask(el.dataset.id);
                 setTimeout(window.renderDailyView, 120);
             } else if (action === 'daily-edit-task') {
                 window.editTask(el.dataset.id);
             } else if (action === 'daily-delete-task') {
                 window.deleteGlobalTask(el.dataset.id, el.dataset.date);
                 setTimeout(window.renderDailyView, 120);
             }
             // 'daily-block-noop' → sadece hücrenin click'ini durdurmak için var, ekstra davranış yok
         });
         dailyTimelineGridEl.addEventListener('dragover', (e) => {
             const cell = e.target.closest('.daily-hour-cell');
             if (!cell) return;
             window.calDragOver(e, cell, parseInt(cell.dataset.hour, 10), 76);
         });
         dailyTimelineGridEl.addEventListener('dragleave', (e) => {
             const cell = e.target.closest('.daily-hour-cell');
             if (cell) window.calDragLeave(cell);
         });
         dailyTimelineGridEl.addEventListener('drop', (e) => {
             const cell = e.target.closest('.daily-hour-cell');
             if (!cell) return;
             window.dailyDropHandler(e, cell.dataset.date, parseInt(cell.dataset.hour, 10));
             cell.classList.remove('drag-over');
         });
         dailyTimelineGridEl.addEventListener('dragstart', (e) => {
             const block = e.target.closest('.daily-event-block[data-drag-id]');
             if (!block) return;
             window.dailyChipDragStart(e, block.dataset.dragId, block.dataset.dragDate);
         });
         dailyTimelineGridEl.addEventListener('dragend', () => window.calDragEnd());
     }

     // Hedef Kartlarına Tıklandığında Detayı Açma (Event Delegation)
     document.addEventListener('click', (e) => {
         const goalCard = e.target.closest('.goal-card'); // Senin hedeflerinin class'ı
         const isActionBtn = e.target.closest('button'); // Düzenle/Sil butonlarına basıldıysa içine girme
 
         if (goalCard && !isActionBtn) {
             const goalId = goalCard.dataset.id;
             if(goalId) openGoalDetails(goalId);
         }
     });
 
     // Detay Odasını Açan Ana Fonksiyon
     window.openGoalDetails = function(goalId) {
         // 1. Hedefi Bul
         const goal = goals.find(g => String(g.id) === String(goalId));
         if(!goal) return;
 
         // 2. Aktif hedef ID'sini gizli inputa yaz (Görev eklerken lazım olacak)
         document.getElementById('detail-active-goal-id').value = goal.id;
 
         // 3. Tepe Kısmı: Temel Bilgiler
         document.getElementById('detail-goal-title').innerHTML = `<i class="fa-solid fa-mountain-sun" style="color:var(--primary-color);margin-right:8px;"></i>${escapeHtml(goal.title)}`;
         
         if (goal.vision) {
             document.getElementById('detail-goal-desc').textContent = `"${goal.vision}"`;
         } else {
             document.getElementById('detail-goal-desc').textContent = `"Nedenini hatırlamayan yolunu kaybeder..."`;
         }
 
        // 4. İlerleme ve Kalan Gün
        const progress = goal._progress || 0;
        document.getElementById('detail-goal-progress-text').textContent = `%${progress}`;
        document.getElementById('detail-goal-progress-fill').style.width = `${progress}%`;
        
        if (goal.deadline) {
            let deadlineDate;
            // Eğer tarih d-m-Y (örn: 25-12-2026) formatındaysa parçala ve güvenli Date nesnesi yap
            if (goal.deadline.includes('-')) {
                const parts = goal.deadline.split('-');
                if (parts[0].length === 4) { // YYYY-MM-DD
                    deadlineDate = new Date(parts[0], parts[1] - 1, parts[2]);
                } else { // d-m-Y
                    deadlineDate = new Date(parts[2], parts[1] - 1, parts[0]);
                }
            } else {
                deadlineDate = new Date(goal.deadline);
            }
            
            deadlineDate.setHours(23, 59, 59, 999);
            const today = new Date();
            const diff = deadlineDate - today;
            const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
            
            if (days < 0) {
                document.getElementById('detail-goal-countdown').textContent = 'Süre bitti!';
            } else if (days === 0) {
                document.getElementById('detail-goal-countdown').textContent = 'Bugün son gün!';
            } else {
                document.getElementById('detail-goal-countdown').textContent = `${days} gün kaldı`;
            }
        } else {
            document.getElementById('detail-goal-countdown').textContent = 'Süresiz';
        }
 
        // 5. Hedef Ödülü (Kilitli Sistem)
        const rewardInput = document.getElementById('detail-goal-reward');
        const saveRewardBtn = document.getElementById('save-reward-btn');
        const editRewardBtn = document.getElementById('edit-reward-btn');
        
        // Dinamik olarak "Ödülü Sil" butonu var mı kontrol et, yoksa oluştur ve ekle
        let deleteRewardBtn = document.getElementById('delete-reward-btn');
        if (!deleteRewardBtn) {
            deleteRewardBtn = document.createElement('button');
            deleteRewardBtn.id = 'delete-reward-btn';
            deleteRewardBtn.className = 'icon-btn delete-icon-btn';
            deleteRewardBtn.title = 'Ödülü Kaldır';
            deleteRewardBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
            deleteRewardBtn.style.cssText = 'background: rgba(255, 71, 87, 0.1); color: #ff4757; padding: 6px 12px; font-size: 12px; border-radius: 6px; border: 1px solid rgba(255, 71, 87, 0.3); cursor: pointer; display: none; align-items: center; justify-content: center;';
            editRewardBtn.parentNode.appendChild(deleteRewardBtn);
        }
        
        rewardInput.value = goal.reward || '';


        
        
        // Ödül durumuna göre arayüzü düzenleyen yardımcı fonksiyon
        function updateRewardUIState() {
            if (goal.reward && goal.reward.trim() !== '') {
                rewardInput.disabled = true;
                rewardInput.style.opacity = '0.6';
                saveRewardBtn.style.display = 'none';
                editRewardBtn.style.display = 'inline-flex';
                deleteRewardBtn.style.display = 'inline-flex';
            } else {
                rewardInput.value = '';
                rewardInput.disabled = false;
                rewardInput.style.opacity = '1';
                saveRewardBtn.style.display = 'inline-flex';
                editRewardBtn.style.display = 'none';
                deleteRewardBtn.style.display = 'none';
            }
        }

        updateRewardUIState();
 
        saveRewardBtn.onclick = () => {
            const val = rewardInput.value.trim();
            if (val) {
                goal.reward = val;
                Store.goals.set(goals);
                updateRewardUIState();
                renderGoals(); // Ana sayfadaki kartı da anlık günceller
                showPremiumModal({ title: 'Ödül Kilitlendi 🔒', message: 'Hedefe ulaştığında bu ödül senin olacak. Şimdi çalışmaya dön!', type: 'success' });
            }
        };
 
        editRewardBtn.onclick = () => {
            rewardInput.disabled = false;
            rewardInput.style.opacity = '1';
            rewardInput.focus();
            saveRewardBtn.style.display = 'inline-flex';
            editRewardBtn.style.display = 'none';
            deleteRewardBtn.style.display = 'none';
        };

        deleteRewardBtn.onclick = () => {
            showPremiumModal({
                title: 'Ödülü Kaldır 🗑️',
                message: 'Bu hedefe belirlediğin ödülü silmek istediğine emin misin?',
                type: 'warning',
                showCancel: true,
                confirmText: 'Evet, Sil',
                onConfirm: () => {
                    goal.reward = '';
                    Store.goals.set(goals);
                    updateRewardUIState();
                    renderGoals(); // Ana sayfadaki kartı da anlık günceller
                }
            });
        };
 
        // YENİ: Tamamla butonunu gizle/göster
        const manualBtn = document.getElementById('manual-complete-goal-btn');
        if (manualBtn) {
            const currentProgress = goal._progress || 0;
            if (goal.status === 'completed' || currentProgress === 100) {
                manualBtn.style.display = 'none'; 
            } else {
                manualBtn.style.display = 'inline-flex';
            }
        }
 
        // Tarih ve saat alanlarını bugüne/varsayılana sıfırla
        const detailDateInput = document.getElementById('detail-task-date');
        if(detailDateInput) detailDateInput.value = window.toInputDate(window.formatDateToString(new Date()));
        const detailTimeStart = document.getElementById('detail-task-time-start');
        const detailTimeEnd = document.getElementById('detail-task-time-end');
        if(detailTimeStart) detailTimeStart.value = '09:00';
        if(detailTimeEnd) detailTimeEnd.value = '10:00';
 

       // --- DÖNÜM NOKTASI (MILESTONE) TAKVİM SINIRLANDIRMASI ---
       const milestoneDateInput = document.getElementById('detail-new-milestone-date');
       const milestoneStartDateInput = document.getElementById('detail-new-milestone-start');
       
       if (milestoneDateInput || milestoneStartDateInput) {
           let goalStartDate = goal.createdAt ? new Date(goal.createdAt) : new Date();
           goalStartDate.setHours(0, 0, 0, 0);
           
           let goalEndDate = new Date();
           if (goal.deadline) {
               // Tarihi güvenli şekilde parse et
               const parts = goal.deadline.trim().split('-');
               if (parts.length === 3) {
                   if (parts[0].length === 4) { // YYYY-MM-DD
                       goalEndDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                   } else { // d-m-Y
                       goalEndDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                   }
               }
           }
           goalEndDate.setHours(23, 59, 59, 999);

           // Mevcut dönüm noktası aralıklarını hesapla (görsel işaretleme)
           const existingMilestones = (goal.milestones || []).filter(m => m.date);
           // Bitiş tarihleri artık kilitlenmiyor — bitişik aralıklara (21-22, 22-23) izin verilir.
           // Çakışma kontrolü kaydetme aşamasında yapılır (katı < > ile).

           // Mevcut milestone aralıklarını renk paleti ile eşleştir
           const _msColors = ['#0984e3','#6c5ce7','#00b894','#e17055','#fdcb6e','#fd79a8'];
           const _msRangeData = existingMilestones.map((m, i) => {
               const toYMD = (d) => { if(!d) return ''; const p=d.split('-'); return p[0].length===4 ? d : `${p[2]}-${p[1]}-${p[0]}`; };
               return { start: toYMD(m.startDate || ''), end: toYMD(m.date), color: _msColors[i % _msColors.length], text: m.text };
           });

           // onDayCreate: takvim günlerine milestone rengi ekle
           const _onDayCreate = (dObj, dStr, fp, dayElem) => {
               const dayYMD = dStr; // flatpickr dateFormat Y-m-d zaten YYYY-MM-DD döner
               for (const range of _msRangeData) {
                   if (!range.end) continue;
                   const inRange = (range.start ? dayYMD >= range.start : true) && dayYMD <= range.end;
                   if (inRange) {
                       const isEnd = dayYMD === range.end;
                       const isStart = range.start && dayYMD === range.start;
                       dayElem.style.background = `${range.color}22`;
                       dayElem.style.borderRadius = '6px';
                       // Başlangıç ve bitiş günleri daha belirgin
                       if (isStart || isEnd) {
                           dayElem.style.background = `${range.color}55`;
                           dayElem.style.border = `1px solid ${range.color}`;
                       }
                       // Kilit ikonu (bitiş günü disabled ise)
                       if (isEnd) {
                           const dot = document.createElement('span');
                           dot.style.cssText = `display:block; width:5px; height:5px; border-radius:50%; background:${range.color}; margin:1px auto 0; position:absolute; bottom:2px; left:50%; transform:translateX(-50%);`;
                           dayElem.style.position = 'relative';
                           dayElem.appendChild(dot);
                       }
                       dayElem.title = `🚩 ${range.text}`;
                       break;
                   }
               }
           };

           // Başlangıç Tarihi Seçici Yapılandırması
           if (milestoneStartDateInput) {
               flatpickr(milestoneStartDateInput, {
                   locale: "tr",
                   altInput: true,
                   altFormat: "d-m-Y",
                   dateFormat: "Y-m-d",
                   minDate: goalStartDate,
                   maxDate: goalEndDate,
                   disableMobile: "true",
                   onDayCreate: _onDayCreate
               });
           }

           // Bitiş Tarihi Seçici Yapılandırması
           if (milestoneDateInput) {
               flatpickr(milestoneDateInput, {
                   locale: "tr",
                   altInput: true,
                   altFormat: "d-m-Y",
                   dateFormat: "Y-m-d",
                   minDate: goalStartDate,
                   maxDate: goalEndDate,
                   disableMobile: "true",
                   onDayCreate: _onDayCreate
               });
           }
       }
        // --------------------------------------------------------
        


        // 6. Modalı Aç
        goalDetailsModal.classList.remove('hidden');
         
         updateGoalDetailsUI(goalId);
     };
 
     // ==========================================
     // HEDEF DETAY ODASI - BÖLÜM 2 (LİSTELER, AI VE AKSİYONLAR)
     // ==========================================
 
     window.updateGoalDetailsUI = function(goalId) {
         const goal = goals.find(g => String(g.id) === String(goalId));
         if(!goal) return;

         // 1. Aksiyon Planı (Görevler)
         const detailTaskList = document.getElementById('detail-task-list');
         // detail-task-list, hedef detay modalının içinde — modal DOM'dan hiç
         // kaldırılmaz ama bu fonksiyon çağrı zincirinin bulunmadığı bir görev/
         // görev-silme setTimeout'undan (ör. deleteGlobalTask sonrası 50ms'lik
         // gecikmeli çağrı) tetiklendiğinde savunmasız null erişimi önlemek için
         // koruma ekleniyor.
         if (!detailTaskList) return;
         detailTaskList.innerHTML = '';
         const linkedTasks = tasks.filter(t => String(t.parentGoal) === String(goalId));

         // Günün hedefini de dahil et (highlight_history, tarih=bugün, parentGoal=bu hedef)
         const _todayStrAP = window.formatDateToString(new Date());
         const _hlHistory = FocusStorage.get('highlight_history', {});
         const _todayHL = _hlHistory[_todayStrAP];
         if (_todayHL && _todayHL.parentGoal && String(_todayHL.parentGoal) === String(goalId)) {
             // Sahte görev objesi — zaten tasks'ta yoksa ekle
             const alreadyIn = linkedTasks.some(t => t._isHighlight);
             if (!alreadyIn) {
                 // parentMilestone hesapla
                 let _hlMs = '';
                 if (goal && Array.isArray(goal.milestones)) {
                     const _norm = (d) => { if(!d) return ''; const p=d.split('-'); return p.length===3&&p[0].length!==4?(p[2]+'-'+p[1]+'-'+p[0]):d; };
                     const _dn = _norm(_todayStrAP);
                     const _m = goal.milestones.find(ms => { const s=_norm(ms.startDate||'');const e=_norm(ms.date||''); return s&&e?_dn>=s&&_dn<=e:(e?_dn<=e:false); });
                     if (_m) _hlMs = _m.id;
                 }
                 linkedTasks.push({ id: '__highlight__', text: _todayHL.text, completed: _todayHL.completed, priority: 'high', date: _todayStrAP, timeStart: null, timeEnd: null, parentGoal: goalId, parentMilestone: _hlMs, _isHighlight: true });
             }
         }
         
         let completedTaskCount = 0;
 
         const apCompleted = document.getElementById('ap-completed-count');
         const apPending = document.getElementById('ap-pending-count');
 
         completedTaskCount = linkedTasks.filter(t => t.completed).length;
         if(apCompleted) apCompleted.textContent = completedTaskCount;
         if(apPending) apPending.textContent = linkedTasks.length - completedTaskCount;
 
         const milestones = (goal && goal.milestones) ? goal.milestones : [];
 
         // Milestone gruplarını tarihe göre sırala
         const sortedMs = [...milestones].sort((a, b) => {
             const da = a.startDate || a.date || '';
             const db = b.startDate || b.date || '';
             return da.localeCompare(db);
         });
 
         // Her milestone için tarih aralığı hesapla
         // startDate yoksa bir önceki milestone'un bitişini başlangıç say
         const msRanges = sortedMs.map((ms, i) => {
             const endDate = ms.date || '';
             let startDate = ms.startDate || '';
             if (!startDate && i > 0) {
                 startDate = sortedMs[i - 1].date || '';
             }
             return { ms, startDate, endDate };
         });
 
         // Görevleri tarih aralıklarına göre grupla
         const assignedIds = new Set();
         const groups = [];
 
         // Tarihi YYYY-MM-DD'ye normalize et (app DD-MM-YYYY, milestone YYYY-MM-DD saklar)
         const _normApDate = (d) => { if(!d) return ''; const p=d.split('-'); return p.length===3 && p[0].length!==4 ? (p[2]+'-'+p[1]+'-'+p[0]) : d; };

         msRanges.forEach(({ ms, startDate, endDate }) => {
             const msTasks = linkedTasks.filter(t => {
                 // Önce parentMilestone'a göre kontrol et (explicit bağlantı)
                 if (t.parentMilestone && String(t.parentMilestone) === String(ms.id)) return true;
                 // parentMilestone yoksa tarih aralığına göre grupla
                 if (t.parentMilestone) return false; // Başka milestone'a bağlıysa dahil etme
                 if (!t.date) return false;
                 const tdn = _normApDate(t.date);
                 const sdn = _normApDate(startDate);
                 const edn = _normApDate(endDate);
                 if (edn && sdn) return tdn >= sdn && tdn <= edn;
                 if (edn && !sdn) return tdn <= edn;
                 return false;
             });
             msTasks.forEach(t => assignedIds.add(t.id));
             // Milestone grubu HER ZAMAN göster (görev olmasa bile)
             groups.push({ type: 'milestone', ms, tasks: msTasks });
         });
 
         const unassigned = linkedTasks.filter(t => !assignedIds.has(t.id));
         if (unassigned.length > 0) groups.push({ type: 'general', ms: null, tasks: unassigned });
 
         if(linkedTasks.length === 0 && groups.filter(g => g.type === 'milestone').length === 0) {
             detailTaskList.innerHTML = '<li class="empty-list-note">Henüz bu hedefe bağlı bir aksiyon (görev) yok. Yukarıdan hızlıca ekleyebilirsin.</li>';
         } else {
 
             const renderTaskCard = (t) => {
                 const priorityLabels = { 'high': 'Yüksek', 'medium': 'Orta', 'low': 'Düşük' };
                 const pLabel = priorityLabels[t.priority] || 'Orta';
                 const pClass = t.priority || 'medium';
                 const li = document.createElement('li');
                 li.className = `detail-task-item ${t.completed ? 'completed' : ''}`;
                 if (t._isHighlight) {
                     // Günün hedefi — özel görünüm, saat olmadan
                     li.style.borderLeft = '3px solid #ff9f43';
                     li.style.background = 'linear-gradient(90deg, rgba(255,159,67,0.04) 0%, transparent 100%)';
                     li.innerHTML = `
                         <div class="ap-priority-bar" style="background:#ff9f43;"></div>
                         <div class="task-checkbox" style="border-radius:8px; width:22px; height:22px; flex-shrink:0; border-color:#ff9f43; ${t.completed ? 'background:#ff9f43;' : ''}" data-action="gd-toggle-highlight-task" data-date="${_todayStrAP}" data-goal-id="${goalId}">
                             ${t.completed ? '<i class="fa-solid fa-check" style="font-size:11px; color:white;"></i>' : ''}
                         </div>
                         <div style="display:flex; flex-direction:column; gap:4px; flex:1; min-width:0;">
                             <span style="${t.completed ? 'text-decoration:line-through; color:var(--text-muted);' : 'color:#fff; font-weight:500;'} font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:0.3s;">${escapeHtml(t.text)}</span>
                             <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                                 <span style="font-size:10px; background:rgba(255,159,67,0.12); padding:2px 8px; border-radius:6px; color:#ff9f43; border:1px solid rgba(255,159,67,0.3); font-weight:600;"><i class="fa-solid fa-star" style="margin-right:3px;"></i>Günün Hedefi</span>
                                 <span style="font-size:10px; background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:6px; color:var(--text-muted); border:1px solid rgba(255,255,255,0.1);"><i class="fa-regular fa-calendar"></i> ${t.date}</span>
                             </div>
                         </div>
                     `;
                 } else {
                     li.innerHTML = `
                         <div class="ap-priority-bar ${pClass}"></div>
                         <div class="task-checkbox" style="border-radius:8px; width:22px; height:22px; flex-shrink:0; ${t.completed ? 'background:#2ed573; border-color:#2ed573;' : 'border-color:#2ed573;'}" data-action="gd-toggle-task" data-id="${t.id}" data-goal-id="${goalId}">
                             ${t.completed ? '<i class="fa-solid fa-check" style="font-size:11px; color:white;"></i>' : ''}
                         </div>
                         <div style="display:flex; flex-direction:column; gap:4px; flex:1; min-width:0;">
                             <span style="${t.completed ? 'text-decoration:line-through; color:var(--text-muted);' : 'color:#fff; font-weight:500;'} font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:0.3s;">${escapeHtml(t.text)}</span>
                             <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                                 <span style="font-size:10px; background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:6px; color:var(--text-muted); border:1px solid rgba(255,255,255,0.1);"><i class="fa-regular fa-clock"></i> ${t.timeStart || '09:00'}</span>
                                 <span style="font-size:10px; padding:2px 8px; border-radius:6px; font-weight:600; ${t.priority==='high' ? 'color:#ff4757; background:rgba(255,71,87,0.1); border:1px solid rgba(255,71,87,0.2);' : t.priority==='low' ? 'color:#2ed573; background:rgba(46,213,115,0.1); border:1px solid rgba(46,213,115,0.2);' : 'color:#ff9f43; background:rgba(255,159,67,0.1); border:1px solid rgba(255,159,67,0.2);'}">${pLabel}</span>
                                 ${t.date ? `<span style="font-size:10px; background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:6px; color:var(--text-muted); border:1px solid rgba(255,255,255,0.1);"><i class="fa-regular fa-calendar"></i> ${t.date}</span>` : ''}
                             </div>
                         </div>
                         <button class="ap-delete-btn" data-action="gd-delete-task" data-id="${t.id}" data-task-date="${t.date}" data-goal-id="${goalId}" title="Sil"><i class="fa-solid fa-trash"></i></button>
                     `;
                 }
                 return li;
             };
 
             // Katlanma durumunu bellekte tut
             if (!window._msGroupCollapsed) window._msGroupCollapsed = {};
 
             groups.forEach((group, groupIndex) => {
                 const groupKey = group.type === 'milestone' ? `ms_${group.ms.id}` : `general_${goalId}`;
                 // İlk açılışta hepsi açık
                 if (window._msGroupCollapsed[groupKey] === undefined) window._msGroupCollapsed[groupKey] = false;
                 const isCollapsed = window._msGroupCollapsed[groupKey];
 
                 // Grup başlığı
                 const header = document.createElement('li');
                 header.style.cssText = 'list-style:none; padding:0; margin-bottom:4px; margin-top:8px;';
 
                 if (group.type === 'milestone') {
                     const msCompleted = group.tasks.filter(t => t.completed).length;
                     const msTotal = group.tasks.length;
                     const allDone = msCompleted === msTotal;
                     // Tarih aralığı label'ı oluştur
                     const _fmtMsDate = (d) => { if(!d) return '?'; const p=d.split('-'); return p[0].length===4 ? `${p[2]}.${p[1]}.${p[0]}` : `${p[0]}.${p[1]}.${p[2]}`; };
                     const msStart = group.ms.startDate || '';
                     const msEnd = group.ms.date || '';
                     const msDateRange = (msStart || msEnd) ? `<span style="font-size:10px; color:rgba(116,185,255,0.7); background:rgba(9,132,227,0.08); padding:2px 7px; border-radius:6px; border:1px solid rgba(9,132,227,0.15); white-space:nowrap;"><i class="fa-regular fa-calendar-range" style="margin-right:3px;"></i>${_fmtMsDate(msStart)} → ${_fmtMsDate(msEnd)}</span>` : '';
                     header.innerHTML = `
                         <div data-group-key="${groupKey}" style="display:flex; align-items:center; gap:8px; padding:8px 12px; border-radius:10px; background:${allDone ? 'rgba(46,213,115,0.07)' : 'rgba(9,132,227,0.07)'}; border:1px solid ${allDone ? 'rgba(46,213,115,0.2)' : 'rgba(9,132,227,0.2)'}; cursor:pointer; user-select:none; transition: background 0.2s; flex-wrap:wrap;">
                             <i class="fa-solid fa-chevron-${isCollapsed ? 'right' : 'down'}" style="font-size:10px; color:${allDone ? '#2ed573' : '#74b9ff'}; transition:transform 0.2s; width:10px;"></i>
                             <i class="fa-solid fa-flag-checkered" style="font-size:12px; color:${allDone ? '#2ed573' : '#0984e3'};"></i>
                             <span style="font-size:12px; font-weight:700; color:${allDone ? '#2ed573' : '#74b9ff'}; flex:1; min-width:0;">${escapeHtml(group.ms.text)}</span>
                             ${msDateRange}
                             <span style="font-size:11px; color:var(--text-muted); background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:8px;">${msCompleted}/${msTotal}</span>
                         </div>
                     `;
                 } else {
                     header.innerHTML = `
                         <div data-group-key="${groupKey}" style="display:flex; align-items:center; gap:8px; padding:8px 12px; border-radius:10px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); cursor:pointer; user-select:none; transition: background 0.2s;">
                             <i class="fa-solid fa-chevron-${isCollapsed ? 'right' : 'down'}" style="font-size:10px; color:var(--text-muted); width:10px;"></i>
                             <i class="fa-solid fa-layer-group" style="font-size:12px; color:var(--text-muted);"></i>
                             <span style="font-size:12px; font-weight:700; color:var(--text-muted); flex:1;">Genel</span>
                             <span style="font-size:11px; color:var(--text-muted); background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:8px;">${group.tasks.length} görev</span>
                         </div>
                     `;
                 }
 
                 // Başlığa tıklama: aç/kapat
                 header.querySelector('[data-group-key]').addEventListener('click', () => {
                     window._msGroupCollapsed[groupKey] = !window._msGroupCollapsed[groupKey];
                     updateGoalDetailsUI(goalId);
                 });
 
                 detailTaskList.appendChild(header);
 
                 // Görevleri render et (kapalıysa ekleme)
                 if (!isCollapsed) {
                     group.tasks.forEach(t => detailTaskList.appendChild(renderTaskCard(t)));
                 }
             });
         }
 
        // 2. Destekleyici Alışkanlıklar (PREMIUM UI GÜNCELLEMESİ)
        const detailHabitList = document.getElementById('detail-habit-list');
        detailHabitList.innerHTML = '';
        const linkedHabits = habits.filter(h => h.parentGoals && h.parentGoals.includes(String(goalId)));
        
        let completedHabitSteps = 0;
        let totalHabitTarget = 0;
 
        if(linkedHabits.length === 0) {
            detailHabitList.innerHTML = '<li class="empty-list-note">Bu hedefe bağlı destekleyici alışkanlık bulunmuyor. "Alışkanlıklar" sekmesinden ekleyebilirsiniz.</li>';
        } else {
            const todayStr = window.formatDateToString(new Date());
 
            linkedHabits.forEach(h => {
                const hCompleted = Object.keys(h.history).length;
                const hTarget = h.targetDays || 21;
                completedHabitSteps += hCompleted;
                totalHabitTarget += hTarget;
                const hProgress = Math.min(Math.round((hCompleted / hTarget) * 100), 100);
                
                const isDoneToday = !!h.history[todayStr];
 
                const li = document.createElement('li');
                li.className = 'detail-habit-item';
                li.innerHTML = `
                    <div class="habit-premium-header">
                        <div class="habit-premium-title-group">
                            <div class="habit-premium-icon">
                                <i class="fa-solid ${h.icon || 'fa-leaf'}"></i>
                            </div>
                            <span class="habit-premium-name">${escapeHtml(h.name)}</span>
                        </div>
                        
                        <button class="habit-premium-today-check ${isDoneToday ? 'done' : ''}" 
                                data-action="gd-toggle-habit" data-id="${h.id}" data-date="${todayStr}" data-goal-id="${goalId}"
                                title="${isDoneToday ? 'Bugün Tamamlandı! Geri al?' : 'Bugün için tamamla'}">
                            <i class="fa-solid ${isDoneToday ? 'fa-check' : 'fa-bolt'}"></i> ${isDoneToday ? 'Bitti' : 'Bugün'}
                        </button>
                    </div>
 
                    <div class="habit-premium-progress-area">
                        <div class="habit-premium-stats">
                            <span>İlerleme: ${hCompleted} / ${hTarget} Gün</span>
                            <strong>%${hProgress}</strong>
                        </div>
                        <div class="habit-premium-track">
                            <div class="habit-premium-fill" style="width: ${hProgress}%;"></div>
                        </div>
                    </div>
                `;
                detailHabitList.appendChild(li);
            });
        }
 
         // 3. Milestones (Dönüm Noktaları)
         if(!goal.milestones) goal.milestones = [];
         const milestoneList = document.getElementById('detail-milestone-list');
         milestoneList.innerHTML = '';
         
         const totalMs = goal.milestones.length;
         const completedMs = goal.milestones.filter(m => m.completed).length;
         const msBadge = document.getElementById('milestone-progress-badge');
         const msFill = document.getElementById('milestone-overall-fill');
         if(msBadge) msBadge.textContent = `${completedMs} / ${totalMs}`;
         if(msFill) msFill.style.width = totalMs > 0 ? `${Math.round((completedMs/totalMs)*100)}%` : '0%';
 
         if(goal.milestones.length === 0) {
             milestoneList.innerHTML = '<li style="padding: 20px 0; text-align:center; color:var(--text-muted); font-size:13px;"><i class="fa-solid fa-route" style="font-size:24px; display:block; margin-bottom:8px; opacity:0.3;"></i>Henüz aşama eklenmedi.<br>Hedefini parçalara bölerek başarmayı kolaylaştır.</li>';
         } else {
             goal.milestones.forEach((m, index) => {
                 const li = document.createElement('li');
 
                 // Bağlı görevleri hesapla
                 const linkedToMs = tasks.filter(t => String(t.parentMilestone) === String(m.id) && String(t.parentGoal) === String(goal.id));
                 const completedLinked = linkedToMs.filter(t => t.completed).length;
                 const totalLinked = linkedToMs.length;
 
                 // --- Premium Liste Tarih Badge Çözümleyici Başlangıç ---
                 let dateBadge = '';
                 if (m.date) {
                     const today = new Date(); today.setHours(0, 0, 0, 0);
                     
                     // Güvenli tarih ayrıştırıcı (TR ve US formatlarına tam uyumlu)
                     let msDate = new Date();
                     const dateParts = m.date.trim().split('-');
                     if (dateParts.length === 3) {
                         if (dateParts[0].length === 4) { // YYYY-MM-DD
                             msDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
                         } else { // DD-MM-YYYY
                             msDate = new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]));
                         }
                     } else {
                         msDate = new Date(m.date);
                     }
                     msDate.setHours(0, 0, 0, 0);
                     
                     const diffDays = Math.round((msDate - today) / 86400000);
                     if (!m.completed) {
                         if (diffDays < 0) dateBadge = `<span style="color:#ff4757; background:rgba(255,71,87,0.12); border:1px solid rgba(255,71,87,0.25); border-radius:10px; padding:1px 7px; font-size:10px; font-weight:600;"><i class="fa-solid fa-clock"></i> ${Math.abs(diffDays)}g gecikmiş</span>`;
                         else if (diffDays === 0) dateBadge = `<span style="color:#ffa502; background:rgba(255,165,2,0.12); border:1px solid rgba(255,165,2,0.3); border-radius:10px; padding:1px 7px; font-size:10px; font-weight:600;"><i class="fa-solid fa-bolt"></i> Bugün</span>`;
                         else dateBadge = `<span style="color:#74b9ff; background:rgba(116,185,255,0.1); border:1px solid rgba(116,185,255,0.2); border-radius:10px; padding:1px 7px; font-size:10px; font-weight:600;"><i class="fa-regular fa-calendar"></i> ${diffDays}g kaldı</span>`;
                     }
                 }
                 // --- Premium Liste Tarih Badge Çözümleyici Bitiş ---
 
                 // Görev sayacı badge'i
                 let taskBadge = '';
                 if (totalLinked > 0) {
                     const allDone = completedLinked === totalLinked;
                     taskBadge = `<span style="color:${allDone ? '#2ed573' : '#a29bfe'}; background:${allDone ? 'rgba(46,213,115,0.1)' : 'rgba(162,155,254,0.1)'}; border:1px solid ${allDone ? 'rgba(46,213,115,0.25)' : 'rgba(162,155,254,0.2)'}; border-radius:10px; padding:1px 7px; font-size:10px; font-weight:600;"><i class="fa-solid fa-list-check"></i> ${completedLinked}/${totalLinked} görev</span>`;
                 }
 
                 li.className = `detail-milestone-item ${m.completed ? 'completed' : ''}`;
                 li.innerHTML = `
                     <div class="ms-dot" style="cursor:default;" title="${m.completed ? 'Tamamlandı' : `Adım ${index + 1}`}">
                         ${m.completed
                             ? '<i class="fa-solid fa-check" style="font-size:10px; color:#fff;"></i>'
                             : `<span class="ms-step-label">${index + 1}</span>`
                         }
                     </div>
                     <div class="ms-content">
                         <span class="ms-text">${escapeHtml(m.text)}</span>
                         <div class="ms-meta" style="flex-wrap:wrap; gap:5px;">
                             ${m.completed
                                 ? '<i class="fa-solid fa-circle-check" style="font-size:10px;"></i> Tamamlandı'
                                 : `<i class="fa-solid fa-circle" style="font-size:6px; opacity:0.4;"></i> Adım ${index + 1}`
                             }
                             ${dateBadge}
                             ${taskBadge}
                         </div>
                     </div>
                    <div style="display:flex; flex-direction:column; gap:5px; flex-shrink:0;">
                        <button class="ms-delete-btn" data-action="gd-edit-milestone" data-goal-id="${goal.id}" data-id="${m.id}" title="Düzenle" style="color:#74b9ff; background:rgba(116,185,255,0.08); border-color:rgba(116,185,255,0.2);"><i class="fa-solid fa-pen"></i></button>
                        <button class="ms-delete-btn" data-action="gd-delete-milestone" data-goal-id="${goal.id}" data-id="${m.id}" title="Sil"><i class="fa-solid fa-trash"></i></button>
                     </div>
                 `;
                 milestoneList.appendChild(li);
             });
         }
 
      // 4. İstatistikler & İlerleme Güncellemesi
      // Milestone katkısı (her milestone = 1 adım ağırlığında)
      const totalMsSteps = goal.milestones ? goal.milestones.length : 0;
      const completedMsSteps = goal.milestones ? goal.milestones.filter(m => m.completed).length : 0;
 
      const totalSteps = linkedTasks.length + totalHabitTarget + totalMsSteps;
      const completedSteps = completedTaskCount + completedHabitSteps + completedMsSteps;
      let totalProgress = totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100);
      if (totalProgress > 100) totalProgress = 100;
 
      // Tepe İlerleme Çubuğunu Canlı Güncelle
      document.getElementById('detail-goal-progress-text').textContent = `%${totalProgress}`;
      const manualBtn2 = document.getElementById('manual-complete-goal-btn');
      if(manualBtn2) manualBtn2.style.display = (goal.status === 'completed') ? 'none' : 'inline-flex';
      document.getElementById('detail-goal-progress-fill').style.width = `${totalProgress}%`;
 
      // Odaklanma Eforu (Artık tamamen gerçek Pomodoro verisi!)
      const totalFocusMins = goal.focusTime || 0; 
      const hTime = Math.floor(totalFocusMins / 60);
      const mTime = totalFocusMins % 60;
      document.getElementById('detail-goal-focus-time').textContent = hTime > 0 ? `${hTime} sa ${mTime} dk` : `${mTime} dk`;
 
     // FocusAI Analizi
     const aiContainer = document.getElementById('detail-goal-ai-text');
     if (typeof window.generateAIAnalysis === 'function') {
         aiContainer.innerHTML = window.generateAIAnalysis(goal, totalProgress, totalSteps, completedSteps);
     }
 
     // Arşivlendiyse Tamamla butonunu gizle
     const manualBtnCheck = document.getElementById('manual-complete-goal-btn');
     if (manualBtnCheck) {
         manualBtnCheck.style.display = (goal.status === 'completed' || totalProgress === 100) ? 'none' : 'inline-flex';
     }
 
      // --- YENİ: %100 TAMAMLANMA VE KONFETİ KONTROLÜ ---
      if (totalProgress === 100 && totalSteps > 0 && !goal.isCelebrated) {
          goal.isCelebrated = true; // Sürekli patlamaması için işaretle
          Store.goals.set(goals);
          if(typeof fireConfetti === 'function') fireConfetti(); // Şölen başlasın!

          // Başarı modalını göster (btn-victory-archive / btn-victory-close)
          const victoryModal = document.getElementById('goal-victory-modal');
          if (victoryModal) {
              victoryModal._activeGoalId = goalId;
              victoryModal.classList.remove('hidden');
          } else {
              showPremiumModal({
                  title: 'Vizyon Gerçekleşti! 🏆',
                  message: `Muazzam bir iş başardın! "${escapeHtml(goal.title)}" hedefine ulaştın.`,
                  type: 'success'
              });
          }
      } else if (totalProgress < 100 && goal.isCelebrated) {
           goal.isCelebrated = false; // Kullanıcı bir görevin tikini geri alırsa kutlama hakkını sıfırla
           Store.goals.set(goals);
      }
     };
 
     // --- Aşama (Milestone) Aksiyon Fonksiyonları → script-milestone-goal-actions.js dosyasına taşındı ---

     // --- Otomatik Aşama Parçalayıcı & Boşluk Doldurucu → script-milestone-auto-splitter.js dosyasına taşındı ---

 
 // ============ HIZLI GÖREV EKLE (CTRL+N) SİSTEMİ ============
 // Faz F: script-quick-add.js'e taşındı (openQuickAdd/closeQuickAdd/openQuickAddModal/closeQuickAddModal).
 window.promptDeleteGoal = function(goalId) {
     const goal = goals.find(g => String(g.id) === String(goalId));
     if(!goal) return;
 
     const modal = document.getElementById('goal-delete-modal');
     
     // Güvenlik Önlemi: Eğer HTML'de özel modal yoksa, çökme! Standart silme ekranını aç.
     if (!modal) {
         window.deleteGoal(goalId);
         return;
     }
 
     const linkedTasks = tasks.filter(t => String(t.parentGoal) === String(goalId) && !t.isMilestone);
     const linkedHabits = habits.filter(h => h.parentGoals && h.parentGoals.includes(String(goalId)));
 
     if(linkedTasks.length === 0 && linkedHabits.length === 0) {
         window.deleteGoal(goalId);
         return;
     }
 
     document.getElementById('orphan-task-count').textContent = linkedTasks.length;
     document.getElementById('orphan-habit-count').textContent = linkedHabits.length;
     modal.classList.remove('hidden');
 
     document.getElementById('btn-del-goal-all').onclick = () => {
         // 1. Takvimdeki bağlantılı etkinlikleri de bul ve tamamen sil
         for(let date in calendarEvents) {
             calendarEvents[date] = calendarEvents[date].filter(e => String(e.parentGoal) !== String(goalId));
             if(calendarEvents[date].length === 0) delete calendarEvents[date];
         }
         
         // 2. Ana görevlerden ve alışkanlıklardan tamamen sil
         tasks = tasks.filter(t => String(t.parentGoal) !== String(goalId));
         habits = habits.filter(h => !(h.parentGoals && h.parentGoals.includes(String(goalId))));
         
         saveTasks(); saveHabits();
         
         // 3. Değişikliklerin anında yansıması için ekranları yenile
         renderTasks();
         if (typeof renderEventsRef === 'function') renderEventsRef();
         if (typeof renderCalendarRef === 'function') renderCalendarRef();
         
         window.deleteGoal(goalId);
         modal.classList.add('hidden');
     };
 
     document.getElementById('btn-del-goal-only').onclick = () => {
         // 1. Takvimdeki etkinliklerin sadece ana hedef bağını kopar (kendilerini silme)
         for(let date in calendarEvents) {
             calendarEvents[date].forEach(e => {
                 if(String(e.parentGoal) === String(goalId)) e.parentGoal = '';
             });
         }
         
         // 2. Ana görev ve alışkanlıkların bağını kopar
         tasks.forEach(t => { if(String(t.parentGoal) === String(goalId)) t.parentGoal = ''; });
         habits.forEach(h => { 
             if(h.parentGoals) h.parentGoals = h.parentGoals.filter(gid => String(gid) !== String(goalId)); 
         });
         
         saveTasks(); saveHabits();
         
         // 3. Değişikliklerin anında yansıması için ekranları yenile
         renderTasks();
         if (typeof renderEventsRef === 'function') renderEventsRef();
         if (typeof renderCalendarRef === 'function') renderCalendarRef();

         window.deleteGoal(goalId);
         modal.classList.add('hidden');
     };
 
     document.getElementById('btn-del-goal-cancel').onclick = () => modal.classList.add('hidden');
 };
 
 
 window.checkGoalSynergy = function(goalId) {
     if(!goalId) return;
     const goal = goals.find(g => String(g.id) === String(goalId));
     if(!goal || goal.status === 'completed') return;
 
     const linkedTasks = tasks.filter(t => String(t.parentGoal) === String(goalId));
     if(linkedTasks.length > 0) {
         const completedCount = linkedTasks.filter(t => t.completed).length;
         const newProgress = Math.round((completedCount / linkedTasks.length) * 100);
         
         if(goal._progress !== newProgress) {
             goal._progress = newProgress;
             goal._completedSteps = completedCount;
             goal._totalSteps = linkedTasks.length;
             
             Store.goals.set(goals); 
             
             if(newProgress === 100) {
                 // Görevler %100 oldu diye konfeti patlatıp motive edelim
                 if(typeof fireConfetti === 'function') fireConfetti();
                 
                 renderGoals();
                 
                 // Kullanıcıyı bilgilendiriyoruz ama hedefi asla otomatik olarak tamamlayıp arşive ATMIYORUZ.
                 showPremiumModal({
                     title: 'Mevcut Adımlar Tamamlandı! 🚀',
                     message: `Harika! "${escapeHtml(goal.title)}" hedefine bağladığın tüm görevleri bitirdin. Bu vizyonu büyütmek için yeni görevler ekleyebilir veya hazır hissettiğinde hedefi tamamlayıp zaferini ilan edebilirsin!`,
                     type: 'success'
                 });
             } else {
                 renderGoals(); 
             }
         }
     }
 };
 
 // YENİ: Manuel Hedef Tamamlama İşlemi
 document.addEventListener('click', (e) => {
     const manualBtn = e.target.closest('#manual-complete-goal-btn');
     if (manualBtn) {
         const goalId = document.getElementById('detail-active-goal-id').value;
         const goal = goals.find(g => String(g.id) === String(goalId));
         if(goal) {
             // Uyarı metnini belirle (bağlı aktif görev var mı?)
             const pendingTasks = tasks.filter(t => String(t.parentGoal) === String(goalId) && !t.completed);
             const warningText = pendingTasks.length > 0
                 ? `⚠️ Bu hedefe bağlı <strong style="color:#ff9f43;">${pendingTasks.length} aktif görev</strong> var. Yine de hedefi tamamlamak istiyor musunuz?`
                 : 'Bu ana hedefi başarıyla tamamlandı (Başarı) olarak işaretlemek istiyor musunuz?';
 
             showPremiumModal({
                 title: 'Hedefi Tamamla 🏆',
                 message: warningText,
                 type: pendingTasks.length > 0 ? 'warning' : 'info',
                 showCancel: true,
                 confirmText: 'Evet, Tamamla',
                 onConfirm: () => {
                     goal.status = 'completed';
                     goal.completedAt = Date.now();
                     Store.goals.set(goals);
                     document.getElementById('goal-details-modal').classList.add('hidden');
                     renderGoals();
                     if(typeof fireConfetti === 'function') fireConfetti();

                     if (window.FocusAISocial && typeof window.FocusAISocial.postActivity === 'function') {
                         window.FocusAISocial.postActivity(`"${goal.title}" hedefini başarıyla tamamladı 🏆`);
                     }

 
                     setTimeout(() => {
                         showPremiumModal({
                             title: 'Tebrikler! 🏆',
                             message: 'Hedef başarıyla tamamlandı ve otomatik olarak Başarılarım arşivine taşındı.',
                             type: 'success'
                         });
                     }, 400);
                 }
             });
         }
     }
 });
 
 // --- YENİ: Görev Eklerken Hedef Seçilirse Kategoriyi Otomatik Değiştir (Otomasyon) ---
 const taskParentGoalSelect = document.getElementById('task-parent-goal');
 const taskCategorySelect = document.getElementById('task-category');
 
 if (taskParentGoalSelect && taskCategorySelect) {
     taskParentGoalSelect.addEventListener('change', (e) => {
         const selectedGoalId = e.target.value;
         if (!selectedGoalId) return; // Kullanıcı "Hedefe Bağla" seçeneğini boş bıraktıysa bir şey yapma
 
         // Seçilen ana hedefi bul
         const selectedGoal = goals.find(g => String(g.id) === String(selectedGoalId));
         
         // Eğer bu hedefin kaydedilmiş bir kategorisi varsa
         if (selectedGoal && selectedGoal.category) {
             // Kategori menümüzde bu kategori var mı diye kontrol et (güvenlik için)
             const optionExists = Array.from(taskCategorySelect.options).some(opt => opt.value === selectedGoal.category);
             if (optionExists) {
                 taskCategorySelect.value = selectedGoal.category; // Sihir burada gerçekleşiyor! 🪄
             }
         }
     });
 }
 // -------------------------------------------------------------------------------------
 
 // --- YENİ: Takvim ve Alışkanlıklar İçin Otomatik Kategori Seçimi ---
 
 // 1. TAKVİM İÇİN OTOMASYON
 // (Not: Takvim modalındaki ID'lerin farklıysa aşağıdaki iki const satırını kendi ID'lerine göre güncelle)
 const calendarGoalSelect = document.getElementById('event-parent-goal');
 const calendarCatSelect = document.getElementById('calendar-task-category');
 
 if (calendarGoalSelect && calendarCatSelect) {
     calendarGoalSelect.addEventListener('change', (e) => {
         const selectedGoalId = e.target.value;
         if (!selectedGoalId) return;
         const selectedGoal = goals.find(g => String(g.id) === String(selectedGoalId));
         if (selectedGoal && selectedGoal.category) {
             const optionExists = Array.from(calendarCatSelect.options).some(opt => opt.value === selectedGoal.category);
             if (optionExists) {
                 calendarCatSelect.value = selectedGoal.category;
             }
         }
     });
 }
 
 // 2. ALIŞKANLIKLAR İÇİN OTOMASYON (İlk Seçim Belirler Mantığı)
 const habitGoalSelect = document.getElementById('habit-parent-goal'); // Alışkanlık hedef çoklu seçim ID'si
 const habitCatSelect = document.getElementById('habit-category');
 
 if (habitGoalSelect && habitCatSelect) {
     habitGoalSelect.addEventListener('change', (e) => {
         // Çoklu seçim yapısından (multiple select) sadece seçilenleri bir diziye alıyoruz
         const selectedOptions = Array.from(habitGoalSelect.selectedOptions);
         
         // Eğer en az 1 hedef seçildiyse (Seçenek 1: İlk gelen alır mantığı)
         if (selectedOptions.length > 0) {
             const firstSelectedGoalId = selectedOptions[0].value; // Listenin en başındaki ilk seçimi alıyoruz
             const selectedGoal = goals.find(g => String(g.id) === String(firstSelectedGoalId));
             
             if (selectedGoal && selectedGoal.category) {
                 const optionExists = Array.from(habitCatSelect.options).some(opt => opt.value === selectedGoal.category);
                 if (optionExists) {
                     habitCatSelect.value = selectedGoal.category; // Kategoriyi otomatik değiştir!
                 }
             }
         }
     });
 }
 // ---------------------------------------------------------------------
 
 
 
 
 
 
// ================================================================
// [PREMIUM VALIDATION] AMATÖR UYARILARI AKILLI TOAST BİLDİRİME DÖNÜŞTÜRÜCÜ
// ================================================================
window.alert = function(message) {
    // 1. Ekranda zaten eski bir bildirim varsa anında temizle
    document.getElementById('premium-alert-toast')?.remove();
    
    // 2. Yeni premium bildirim kartı oluştur
    const toast = document.createElement('div');
    toast.id = 'premium-alert-toast';
    
    // Tasarım ve pürüzsüzlük kodları (FocusAI Premium Karanlık Tema Uyumu)
    Object.assign(toast.style, {
        position: 'fixed',
        top: '25px',
        right: '25px',
        backgroundColor: 'rgba(26, 26, 36, 0.96)',
        color: '#ffffff',
        padding: '16px 26px',
        borderRadius: '14px',
        boxShadow: '0 15px 35px rgba(255, 71, 87, 0.25), 0 0 1px 1px rgba(255, 71, 87, 0.4)',
        zIndex: '999999',
        fontFamily: "'Poppins', sans-serif",
        fontSize: '14px',
        fontWeight: '500',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        backdropFilter: 'blur(12px)',
        borderLeft: '5px solid #ff4757',
        transform: 'translateX(130%)',
        transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    });
    
    // İçerik mimarisi (İkon + Mesaj)
    toast.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="color: #ff4757; font-size: 18px;"></i> <span>${escapeHtml(message)}</span>`;
    
    // Kartı ekrana iğnele
    document.body.appendChild(toast);
    
    // 3. Ekranda o an açık olan ve boş bırakılan tüm alanları bulup titret (CSS ile birleşme noktası)
    document.querySelectorAll('input, textarea').forEach(el => {
        if ((el.value.trim() === "" || el.classList.contains('invalid')) && el.offsetParent !== null) {
            el.classList.add('premium-input-error');
            // Animasyon bittiğinde sınıfı temizle ki bir sonraki hatada tekrar titreyebilsin
            setTimeout(() => el.classList.remove('premium-input-error'), 450);
        }
    });
    
    // 4. Milisaniyeler içinde sağdan pürüzsüzce kaydırarak ekrana getir
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 40);
    
    // 5. 4 saniye sonra pürüzsüzce sağa doğru kaydırarak yok et
    setTimeout(() => {
        toast.style.transform = 'translateX(130%)';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
};

// Kitaplık özet kutusunun sağ kenardan taşmasını önleyen güncellenmiş konum motoru
document.addEventListener('mouseover', (e) => {
    const book = e.target.closest('.book-spine'); // Sınıf adını kütüphane element yapınıza göre eşitledik
    if (!book) return;
    
    const tooltip = book.querySelector('.book-premium-tooltip');
    if (!tooltip) return;

    // Önce sınıfı temizle
    tooltip.classList.remove('edge-right');

    const bookRect = book.getBoundingClientRect();
    const tooltipWidth = 280; // Özet kutusunun ortalama genişliği
    const distanceToRight = window.innerWidth - bookRect.right;
    
    // Eğer sağ kenarda kutunun sığacağı kadar (genişlik + güvenli pay) yer kalmadıysa sola aç
    if (distanceToRight < (tooltipWidth + 30)) {
        tooltip.classList.add('edge-right');
    }
});

 // ============ PROFİL DROPDOWN MENÜSÜ ============
 (function() {
     const avatarEl  = document.getElementById('v2-user-avatar');
     const dropdown  = document.getElementById('profile-dropdown');
     if (!avatarEl || !dropdown) return;

     // Kullanıcı bilgilerini doldur
     function updateProfileHeader() {
         const user = window.currentUser;
         const nameEl  = document.getElementById('pdm-user-name');
         const emailEl = document.getElementById('pdm-user-email');
         const avEl    = document.getElementById('pdm-avatar-initials');
         if (user) {
             const name = user.displayName || user.username || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Kullanıcı';
             const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
             if (nameEl)  nameEl.textContent  = name;
             if (emailEl) emailEl.textContent = user.username ? `@${user.username}` : (user.email || '');
             if (avEl)    avEl.textContent    = initials;
             if (avatarEl) avatarEl.textContent = initials;
         }

         // Madde 8 (2026-07-03): "Premium'a Yükselt" yalnızca ücretsiz plandaki
         // bireysel kullanıcıda görünür — dcChatEnabled() (social.js) plan/kurumsal
         // rol birleşik kontrolünü zaten yapıyor, burada tekrarlanmıyor. Fonksiyon
         // henüz yüklenmediyse (profil daha gelmedi) varsayılan gizli kalır —
         // dropdown her açılışta yeniden çağrıldığı için profil gelince düzelir.
         const upgradeBtn = document.getElementById('pdm-upgrade-btn');
         if (upgradeBtn) {
             const isFree = typeof window.dcChatEnabled === 'function' && !window.dcChatEnabled();
             upgradeBtn.style.display = isFree ? 'flex' : 'none';
         }
     }
     updateProfileHeader();

     // Dropdown aç/kapat
     avatarEl.addEventListener('click', (e) => {
         e.stopPropagation();
         const isOpen = dropdown.style.display === 'block';
         dropdown.style.display = isOpen ? 'none' : 'block';
         if (!isOpen) updateProfileHeader();
     });
     document.addEventListener('click', (e) => {
         if (!dropdown.contains(e.target) && e.target !== avatarEl)
             dropdown.style.display = 'none';
     });

     function closeDropdown() { dropdown.style.display = 'none'; }
     window.closeDropdown = closeDropdown; // script-system-settings.js gibi ayrı script scope'larından erişim için

     // ── Sistem Ayarları + Veriyi Yedekle/Yükle + Çıkış Yap → script-system-settings.js dosyasına taşındı ──

     // ── PROFİL DÜZENLE → script-profile-edit.js dosyasına taşındı ──────────────────────────────

 })();

 });

})();

// ── ES module export yüzeyi ──────────────────────────────────────────────
// Yukarıdaki window.X atamaları DOMContentLoaded içinde yapılıyor, bu yüzden
// "export const x = window.x" burada henüz tanımsız değeri yakalardı. Bunun
// yerine çağrı anında window üzerinden arayan ince sarmalayıcılar export
// ediyoruz — script.js'ten import eden küçük modüller (örn.
// script-calendar-dragdrop.js) DOMContentLoaded sırası konusunda hiçbir şey
// bilmek zorunda kalmaz, çağrıldıkları an (kullanıcı etkileşimi, her zaman
// sayfa tam yüklendikten sonra) window.X çoktan atanmış olur.
export function moveTaskToDate(...args) { return window.moveTaskToDate(...args); }
export function renderCalendarGlobal(...args) { return window.renderCalendarGlobal(...args); }
export function updateStats(...args) { return window.updateStats(...args); }
export function convertDumpToTaskForDate(...args) { return window.convertDumpToTaskForDate(...args); }
export function renderCalMindDump(...args) { return window.renderCalMindDump(...args); }
export function getMindDumpsRef(...args) { return window.__getMindDumpsRef(...args); }
export function getTasksRef(...args) { return window.__getTasksRef(...args); }
export function getGoalsRef(...args) { return window.__getGoalsRef(...args); }
export function getHabitsRef(...args) { return window.__getHabitsRef(...args); }
export function getHabitCategoriesRef(...args) { return window.__getHabitCategoriesRef(...args); }
export function switchTab(...args) { return window.switchTab(...args); }
export function showPremiumModal(...args) { return window.showPremiumModal(...args); }
export function updateGoalDetailsUI(...args) { return window.updateGoalDetailsUI(...args); }
export function saveHabits(...args) { return window.saveHabits(...args); }
export function getRenderHabitsRef(...args) { return window.__getRenderHabitsRef(...args); }
export function checkGoalDateBoundaries(...args) { return window.checkGoalDateBoundaries(...args); }
export function saveTasks(...args) { return window.saveTasks(...args); }
export function renderTasks(...args) { return window.renderTasks(...args); }
export function renderHabits(...args) { return window.renderHabits(...args); }
export function populateParentHabitSelects(...args) { return window.populateParentHabitSelects(...args); }
export function hasTimeConflict(...args) { return window.hasTimeConflict(...args); }
export function addSmartTask(...args) { return window.addSmartTask(...args); }
export function getCalendarEventsRef(...args) { return window.__getCalendarEventsRef(...args); }
export function setMindDumpsRef(...args) { return window.__setMindDumpsRef(...args); }
export function getRenderCalendarRef(...args) { return window.__getRenderCalendarRef(...args); }
export function getRenderEventsRef(...args) { return window.__getRenderEventsRef(...args); }
export function getRenderStatisticsRef(...args) { return window.__getRenderStatisticsRef(...args); }
export function getRenderSocialStatsRef(...args) { return window.__getRenderSocialStatsRef(...args); }
export function openGoalDetails(...args) { return window.openGoalDetails(...args); }
export function setGoalsRef(...args) { return window.__setGoalsRef(...args); }
export function getHabitsForDate(...args) { return window.getHabitsForDate(...args); }
export function addGlobalTask(...args) { return window.addGlobalTask(...args); }
export function getActiveFocusTaskRef(...args) { return window.__getActiveFocusTaskRef(...args); }
export function getNextBreakMode() { return window.__nextBreakMode; }
export function toggleHighlightTask(...args) { return window.toggleHighlightTask(...args); }
export function toggleTask(...args) { return window.toggleTask(...args); }
export function clearFocusMode(...args) { return window.clearFocusMode(...args); }
