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
     
     function getProgressColor(pct) {
         function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
         let r, g, b;
         if (pct <= 50) {
             // Altın → Sarı  (#D4900E → #F0C040)
             const t = pct / 50;
             r = lerp(212, 240, t); g = lerp(144, 192, t); b = lerp(14, 64, t);
         } else if (pct <= 80) {
             // Sarı → Sarı-yeşil  (#F0C040 → #A8E063)
             const t = (pct - 50) / 30;
             r = lerp(240, 168, t); g = lerp(192, 224, t); b = lerp(64, 99, t);
         } else {
             // Sarı-yeşil → Yeşil  (#A8E063 → #4ADE80)
             const t = (pct - 80) / 20;
             r = lerp(168, 74, t); g = lerp(224, 222, t); b = lerp(99, 128, t);
         }
         return `rgb(${r},${g},${b})`;
     }

     function formatDateToString(date) {
         return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`; // GÜNCELLEME: Sıralama gün-ay-yıl yapıldı
     }
    window.formatDateToString = formatDateToString; // script-nlp.js gibi ayrı script scope'larından erişim için
     // HTML <input type="date"> için dd-mm-yyyy → yyyy-mm-dd
     function toInputDate(ddmmyyyy) {
         if (!ddmmyyyy) return '';
         const parts = ddmmyyyy.split('-');
         if (parts.length !== 3) return ddmmyyyy;
         return `${parts[2]}-${parts[1]}-${parts[0]}`;
     }
    window.toInputDate = toInputDate; // script-goal-deadline-extend.js gibi ayrı script scope'larından erişim için
     // <input type="date"> değerini (yyyy-mm-dd) app formatına (dd-mm-yyyy) çevir
     function fromInputDate(yyyymmdd) {
         if (!yyyymmdd) return '';
         const parts = yyyymmdd.split('-');
         if (parts.length !== 3) return yyyymmdd;
         return `${parts[2]}-${parts[1]}-${parts[0]}`;
     }
     const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
     const monthNamesShort = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
     const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
 
     function getWeekNumber(d) {
         const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
         const dayNum = date.getUTCDay() || 7;
         date.setUTCDate(date.getUTCDate() + 4 - dayNum);
         const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
         return Math.ceil((((date - yearStart) / 86400000) + 1)/7);
     }
 
     const currentWeekStr = new Date().getFullYear() + "-W" + getWeekNumber(new Date());
 
     let tasks = Store.tasks.get();
     tasks = tasks.map(t => {
         if(!t.id) t.id = generateId();
         if(!t.date) t.date = formatDateToString(new Date());
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
     let habitCategories = FocusStorage.get('habit_categories', [
         { id: 'genel', name: 'Genel' }, { id: 'saglik', name: 'Sağlık' }, { id: 'kisisel-gelisim', name: 'Kişisel Gelişim' }
     ]);
 
     let goals = Store.goals.get();
     let rawHabits = Store.habits.get();
     let habits = rawHabits.map(h => {
         if(!h.startDate) h.startDate = formatDateToString(new Date());
         // Migrasyon: eski yyyy-mm-dd formatını dd-mm-yyyy'ye çevir
         else if (/^\d{4}-\d{2}-\d{2}$/.test(h.startDate)) {
             h.startDate = fromInputDate(h.startDate);
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
            const isoDate = /^\d{2}-\d{2}-\d{4}$/.test(key) ? toInputDate(key) : key;
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
             if (typeof renderMindDumps   === 'function') renderMindDumps();
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
     window.__getGoalsRef = () => goals;
     window.__getHabitsRef = () => habits;
     window.__getMindDumpsRef = () => mindDumps;
    window.__getCalendarEventsRef = () => calendarEvents;

     // Zihin çöplüğü hızlı/dip friksiyonlu bir yakalama alanı olmalı — sınırsız
     // birikim, işleme motivasyonunu öldürüp gerçek bir "çöplüğe" dönüştürüyor
     // (dijital biriktiricilik / karar yorgunluğu). Sert tavan, düzenli işlemeyi
     // zorunlu kılar; 10+ öğede zaten yumuşak bir "temizle" bandı gösteriliyor.
     const MAX_MIND_DUMPS = 30;

     let totalFocusMinutes = FocusStorage.get('focus_minutes', 0) || 0;
 
     FocusStorage.checkOnInit();
 
     // ── UNDO (GERİ AL) SİSTEMİ → script-undo-toast.js dosyasına taşındı ──
 
     let renderCalendarRef, renderEventsRef, renderHabitsRef, renderStatisticsRef, renderJournalRef, renderSocialStatsRef, renderBuddyHabitsRef, renderMindDumpsRef;
 
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
                message: `Bu görev, seçtiğiniz ana hedefin başlangıç tarihinden (${formatDateToString(goalStartDate)}) önce olamaz!`,
                type: 'warning'
            });
            return false;
        }

        if (targetDate > goalEndDate) {
            showPremiumModal({
                title: 'Hatalı Tarih 📅',
                message: `Bu görev, seçtiğiniz ana hedefin bitiş tarihinden (${formatDateToString(goalEndDate)}) sonra olamaz!`,
                type: 'warning'
            });
            return false;
        }

        return true;
    }
    window.checkGoalDateBoundaries = checkGoalDateBoundaries; // script-milestone-goal-actions.js gibi ayrı modüllerden erişim için


     function timeToMins(t) {
         if(!t) return 0;
         const parts = t.split(':').map(Number);
         return parts[0] * 60 + parts[1];
     }
    window.timeToMins = timeToMins; // script-day-summary-card.js gibi ayrı script scope'larından erişim için
 
     function getNextRecurringDate(dateStr, recurringType) {
         const [d, m, y] = dateStr.split('-').map(Number); // GÜNCELLENDİ: gün, ay, yıl sırasına alındı
         const date = new Date(y, m - 1, d);
         if (recurringType === 'daily') {
             date.setDate(date.getDate() + 1);
         } else if (recurringType === 'weekly') {
             date.setDate(date.getDate() + 7);
         } else if (recurringType === 'weekdays') {
             date.setDate(date.getDate() + 1);
             while (date.getDay() === 0 || date.getDay() === 6) {
                 date.setDate(date.getDate() + 1);
             }
         } else if (recurringType === 'monthly') {
             date.setMonth(date.getMonth() + 1);
         }
         return formatDateToString(date);
     }
 
     function addOneHour(timeStr) {
         if (!timeStr) return "13:00";
         let [hours, minutes] = timeStr.split(':').map(Number);
         hours = (hours + 1) % 24; // YENİ: 23'ten sonra 00'a (gece yarısı) kusursuz döngü yapar
         return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
     }

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

             const evStart = timeToMins(ev.timeStart || ev.time || "12:00");
             const evEnd = timeToMins(ev.timeEnd || "13:00");
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
             const evStart = timeToMins(ev.timeStart || ev.time || "12:00");
             const evEnd = timeToMins(ev.timeEnd || "13:00");
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
 
   function addGlobalTask(text, priority, category, date, start, end, parentHabit = "", parentGoal = "", recurring = "", routineId = "") {
         const id = generateId();
         const isOvernight = timeToMins(end) < timeToMins(start); 
         
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
 
     function checkSynergy(parentHabitId, dateStr, isCompleted) {
         if (!parentHabitId) return;
         const habit = habits.find(h => String(h.id) === String(parentHabitId));
         if (habit) {
             // Görev tamamlandıysa ve alışkanlık henüz tiklenmemişse tikle
             if (isCompleted && !habit.history[dateStr]) {
                 habit.history[dateStr] = true;
                 saveHabits();
                 if(typeof renderHabitsRef === 'function') renderHabitsRef();
                 
                 setTimeout(() => {
                     showPremiumModal({ 
                         title: 'Sinerji Aktif! ⚡', 
                         message: `Harika! Bağlantılı görevi tamamladığın için "${escapeHtml(habit.name)}" alışkanlığının bugünkü adımı da otomatik tamamlandı.`,
                         type: 'success' 
                     });
                 }, 1420);
             }
             // Görevdeki tik kaldırıldıysa (Acaba başka bitmiş görev var mı diye bak)
             else if (!isCompleted) {
                 const otherTasksDone = tasks.some(t => String(t.parentHabit) === String(parentHabitId) && t.date === dateStr && t.completed);
                 if (!otherTasksDone) {
                     delete habit.history[dateStr];
                     saveHabits();
                     if(typeof renderHabitsRef === 'function') renderHabitsRef();
                 }
             }
         }
     }
 
     function checkGoalSynergy(parentGoalId, dateStr, isCompleted) {
         if (!parentGoalId) return;
 
         // Bu hedefe (parentGoal) bağlı olan tüm alışkanlıkları bul
         const linkedHabits = habits.filter(h => h.parentGoals && h.parentGoals.includes(parentGoalId));
 
         let habitUpdated = false;
         linkedHabits.forEach(habit => {
             if (isCompleted && !habit.history[dateStr]) {
                 habit.history[dateStr] = true;
                 habitUpdated = true;
                 
                 showPremiumModal({ 
                     title: 'Hedef Sinerjisi! 🎯', 
                     message: `Ana hedefin için bir adım attın! Buna bağlı olan "${escapeHtml(habit.name)}" alışkanlığın da bugünlük otomatik tamamlandı.`,
                     type: 'success' 
                 });
             } else if (!isCompleted) {
                 // Eğer görevin tiki kaldırıldıysa ve o hedefe/alışkanlığa bağlı BAŞKA tamamlanmış görev yoksa tiki geri al
                 const otherTasksDoneForGoal = tasks.some(t => t.parentGoal === parentGoalId && t.date === dateStr && t.completed);
                 const otherTasksDoneForHabit = tasks.some(t => t.parentHabit === habit.id && t.date === dateStr && t.completed);
                 
                 if (!otherTasksDoneForGoal && !otherTasksDoneForHabit) {
                     delete habit.history[dateStr];
                     habitUpdated = true;
                 }
             }
         });
 
         if (habitUpdated) {
             saveHabits();
             if(renderHabitsRef) renderHabitsRef();
             if(renderGoals) renderGoals();
         }
     }
 
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
 
     function updateDynamicGreeting() {
         const greetingDisplay = document.getElementById('dynamic-greeting');
         if (!greetingDisplay) return;
         const currentHour = new Date().getHours();
         let greetingText = "Günün Özeti";
         let greetingEmoji = "👋";
         if (currentHour >= 5 && currentHour < 12) { greetingText = "Günaydın"; greetingEmoji = "🌅"; }
         else if (currentHour >= 12 && currentHour < 18) { greetingText = "Tünaydın"; greetingEmoji = "☀️"; }
         else if (currentHour >= 18 && currentHour < 22) { greetingText = "İyi Akşamlar"; greetingEmoji = "🌙"; }
         else { greetingText = "İyi Geceler"; greetingEmoji = "🦉"; }
         greetingDisplay.textContent = greetingText;
         const emojiEl = document.getElementById('greeting-emoji');
         if (emojiEl) emojiEl.textContent = greetingEmoji;
     }
     updateDynamicGreeting(); 
 
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

     function updateCharCounter(inputId, counterId, limit) {
         const inputEl = document.getElementById(inputId);
         const counterEl = document.getElementById(counterId);
         if (!inputEl || !counterEl) return;
         const len = inputEl.value.length;
         counterEl.textContent = `${len} / ${limit}`;
         // Akıllı renk aşamaları
         counterEl.classList.remove('cc-writing', 'cc-good', 'cc-warn', 'cc-limit');
         if (len === 0) { /* gri — varsayılan */ }
         else if (len < limit * 0.5) counterEl.classList.add('cc-writing');
         else if (len < limit * 0.8) counterEl.classList.add('cc-good');
         else if (len < limit)       counterEl.classList.add('cc-warn');
         else                        counterEl.classList.add('cc-limit');
     }

     const achieveInput    = document.getElementById('reflection-achieve');
     const improveInput    = document.getElementById('reflection-improve');
     const editAchieveInput = document.getElementById('edit-journal-achieve');
     const editImproveInput = document.getElementById('edit-journal-improve');

     if(achieveInput)     achieveInput.addEventListener('input',     () => updateCharCounter('reflection-achieve',    'char-count-achieve',      JOURNAL_CHAR_LIMIT));
     if(improveInput)     improveInput.addEventListener('input',     () => updateCharCounter('reflection-improve',    'char-count-improve',      JOURNAL_CHAR_LIMIT));
     if(editAchieveInput) editAchieveInput.addEventListener('input', () => updateCharCounter('edit-journal-achieve', 'edit-char-count-achieve', JOURNAL_CHAR_LIMIT));
     if(editImproveInput) editImproveInput.addEventListener('input', () => updateCharCounter('edit-journal-improve', 'edit-char-count-improve', JOURNAL_CHAR_LIMIT));
 
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
 
             const todayStr = formatDateToString(new Date());
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
 
     function updateGlobalStreak() {
         // Tamamlanmış görev olan günleri bul (DD-MM-YYYY formatında set)
         const completedDays = new Set(
             tasks.filter(t => t.completed && t.date).map(t => t.date)
         );

         // Günlük hedef tamamlanan günleri de ekle
         const highlightHistory = FocusStorage.get('highlight_history', {});
         Object.entries(highlightHistory).forEach(([dateKey, val]) => {
             if (val && val.completed) completedDays.add(dateKey);
         });

         const todayStr = formatDateToString(new Date());

         // Bugün tamamlanan görev yoksa seri sıfır — dünden saymaya başlama
         let streak = 0;
         if (completedDays.has(todayStr)) {
             let d = new Date();
             d.setHours(0, 0, 0, 0);
             while (true) {
                 const ds = formatDateToString(d);
                 if (completedDays.has(ds)) {
                     streak++;
                     d.setDate(d.getDate() - 1);
                 } else {
                     break;
                 }
             }
         }

         // DD-MM-YYYY → timestamp dönüştür, kronolojik sırala
         function ddmmyyyyToTs(ds) {
             const [dd, mm, yyyy] = ds.split('-').map(Number);
             return new Date(yyyy, mm - 1, dd).getTime();
         }
         const sorted = [...completedDays].sort((a, b) => ddmmyyyyToTs(a) - ddmmyyyyToTs(b));

         let bestStreak = 0, tempStreak = 0, prevTs = null;
         for (const ds of sorted) {
             const ts = ddmmyyyyToTs(ds);
             if (prevTs !== null && ts - prevTs === 86400000) {
                 tempStreak++;
             } else {
                 tempStreak = 1;
             }
             if (tempStreak > bestStreak) bestStreak = tempStreak;
             prevTs = ts;
         }
         if (streak > bestStreak) bestStreak = streak;

         // Mutlak gün sayısına göre tier — seri uzadıkça alev objektif olarak şiddetlenir
         // (önceki "kişisel rekora oranla" hesap, 3 günlük bir seriyi de rekorsa "inferno"
         // gösterip anlamsızlaştırıyordu).
         const tier = streak >= 14 ? 'inferno'
                    : streak >= 7  ? 'blaze'
                    : streak >= 3  ? 'warm'
                    : 'ember';

         const streakBadge = document.getElementById('streak-badge');
         const streakCountDisplay = document.getElementById('streak-count');

         if(streakBadge && streakCountDisplay) {
             (() => {
                 const el = streakCountDisplay;
                 const newVal = streak;
                 if (el.textContent !== String(newVal)) {
                     const oldVal = parseInt(el.textContent, 10);
                     const dir = isNaN(oldVal) || newVal > oldVal ? 'roll-up' : 'roll-down';
                     el.classList.remove('rolling', 'roll-up', 'roll-down');
                     void el.offsetWidth;
                     el.textContent = String(newVal);
                     el.classList.add('rolling', dir);
                     el.addEventListener('animationend', () => el.classList.remove('rolling', 'roll-up', 'roll-down'), { once: true });
                 }
             })();
             streakBadge.classList.remove('streak-tier-ember','streak-tier-warm','streak-tier-blaze','streak-tier-inferno');
             if (streak > 0) streakBadge.classList.add('streak-tier-' + tier);
             streakBadge.style.display = 'flex';
             // Seri 0 iken alev sönük ve hareketsiz kalsın — "yanmıyor" hissi net olsun
             const streakFireEl = document.getElementById('td-streak-fire');
             if (streakFireEl) {
                 streakFireEl.classList.toggle('tsf-unlit', streak <= 0);
                 // Alev şiddeti seri gününe göre SÜREKLİ artar: logaritmik eğri
                 // (ilk günlerde belirgin büyüme, sonra doyum) 30 günde ~tavana ulaşır.
                 const t = streak > 0 ? Math.min(Math.log(streak + 1) / Math.log(31), 1) : 0;
                 streakFireEl.style.setProperty('--fire-glow', (3 + t * 10).toFixed(1) + 'px');
                 // Parlama rengi ısındıkça sarıdan kızıla kayar, opaklığı artar
                 const hue = Math.round(38 - t * 24);
                 streakFireEl.style.setProperty('--fire-glow-color', `hsla(${hue}, 96%, 52%, ${(0.35 + t * 0.5).toFixed(2)})`);
                 if (window.TsfFlame) window.TsfFlame.setIntensity(t);
             }
         }
     }
 
     function loadDailyHighlight() {
         const todayStr = formatDateToString(new Date());
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
         updateGlobalStreak();
     }
 
     window.toggleHighlightTask = function(dateStr = null) {
         const targetDate = dateStr || formatDateToString(new Date());
         let highlightHistory = FocusStorage.get('highlight_history', {});
         
         if(highlightHistory[targetDate]) {
             const willComplete = !highlightHistory[targetDate].completed;
             highlightHistory[targetDate].completed = willComplete;
             FocusStorage.set('highlight_history', highlightHistory); if(window.FocusSync) window.FocusSync.pushKey('highlight_history', highlightHistory);
             
             // Yeni Ana Hedef Sinerjisi
             checkGoalSynergy(highlightHistory[targetDate].parentGoal, targetDate, willComplete);
 
             if (targetDate === formatDateToString(new Date())) {
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
             
             if(willComplete && targetDate === formatDateToString(new Date())) {
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
             
             const todayStr = formatDateToString(new Date());
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
             const todayStr = formatDateToString(new Date());
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
                     const todayStr = formatDateToString(new Date());
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
             if(typeof simulateIncomingInvite === 'function') simulateIncomingInvite();
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
 
     const timeOptionsList = [];
     for (let h = 0; h < 24; h++) {
         for (let m = 0; m < 60; m += 30) {
             timeOptionsList.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
         }
     }
     // 23:59 sınırı tamamen kaldırıldı, menü 23:30'dan sonra otomatik 00:00'a atlamaya hazır.
 
     function updateEndPicker(inputIdPrefix, newTime) {
         const display = document.getElementById(`${inputIdPrefix}-display`);
         const input = document.getElementById(inputIdPrefix);
         const dropdown = document.getElementById(`${inputIdPrefix}-dropdown`);
 
         if (display && input) {
             display.textContent = newTime;
             input.value = newTime;
         }
 
         if (dropdown) {
             dropdown.querySelectorAll('.custom-time-option').forEach(opt => {
                 opt.classList.remove('selected');
                 if (opt.textContent === newTime) opt.classList.add('selected');
             });
         }
     }
 
     function initCustomTimePicker(boxId, displayId, inputId, dropdownId, onChangeCallback = null) {
         const box = document.getElementById(boxId);
         const display = document.getElementById(displayId);
         const input = document.getElementById(inputId);
         const dropdown = document.getElementById(dropdownId);
 
         if (!box || !dropdown || !input) return;
 
         dropdown.innerHTML = '';
         
         const loopCount = 3; // Sonsuzluk hissi için listeyi 3 kez kopyalıyoruz
         let targetLi = null;
 
         // Listeyi 3 tur yazdır
         for (let i = 0; i < loopCount; i++) {
             timeOptionsList.forEach(time => {
                 const li = document.createElement('li');
                 li.className = 'custom-time-option';
                 li.textContent = time;
                 
                 li.addEventListener('click', (e) => {
                     e.stopPropagation(); 
                     display.textContent = time;
                     input.value = time;
                     
                     dropdown.classList.remove('show');
                     box.classList.remove('active');
                     if (onChangeCallback) onChangeCallback(time);
                 });
                 dropdown.appendChild(li);
             });
         }
 
         // --- YENİ EKLENEN: Gerçek Sonsuz Döngü (Infinite Scroll) Sihri ---
         dropdown.addEventListener('scroll', () => {
             const oneCycleHeight = dropdown.scrollHeight / loopCount;
             
             // Kullanıcı en tepeye kaydırırsa, hissettirmeden orta döngüye ışınla
             if (dropdown.scrollTop < 10) {
                 dropdown.scrollTop += oneCycleHeight;
             }
             // Kullanıcı en aşağı kaydırırsa, hissettirmeden orta döngüye ışınla
             else if (dropdown.scrollTop + dropdown.clientHeight > dropdown.scrollHeight - 10) {
                 dropdown.scrollTop -= oneCycleHeight;
             }
         });
 
         box.addEventListener('click', (e) => {
             e.stopPropagation();
            document.querySelectorAll('.custom-time-dropdown').forEach(d => {
                if (d !== dropdown) { d.classList.remove('show'); d.classList.add('hidden'); }
            });
            document.querySelectorAll('.time-box').forEach(b => {
                if (b !== box) b.classList.remove('active');
            });
 
            // 'hidden' sınıfı 'display:none !important' uyguladığından, açılırken kaldırılmalı
            dropdown.classList.remove('hidden');
            dropdown.classList.toggle('show');
            box.classList.toggle('active');
            if (!dropdown.classList.contains('show')) dropdown.classList.add('hidden');
             
             if (dropdown.classList.contains('show')) {
                 // Menü açıldığında her zaman ORTADAKİ döngüdeki saati bul ve oraya odaklan
                 const options = Array.from(dropdown.children);
                 const middleStartIndex = timeOptionsList.length;
                 const middleEndIndex = timeOptionsList.length * 2;
                 
                 let currentSelected = options.find((child, index) => {
                     return child.textContent === input.value && index >= middleStartIndex && index < middleEndIndex;
                 });
                 
                 if (currentSelected) {
                     options.forEach(opt => opt.classList.remove('selected'));
                     currentSelected.classList.add('selected');
                     // Menüyü tam o saatin üzerine ortala
                     dropdown.scrollTop = currentSelected.offsetTop - (dropdown.clientHeight / 2) + (currentSelected.clientHeight / 2);
                 }
             }
         });
     }
 
     document.addEventListener('click', () => {
         document.querySelectorAll('.custom-time-dropdown').forEach(d => d.classList.remove('show'));
         document.querySelectorAll('.time-box').forEach(b => b.classList.remove('active'));
     });
 
     initCustomTimePicker('task-time-start-box', 'task-time-start-display', 'task-time-start', 'task-time-start-dropdown', (newTime) => {
         const nextTime = addOneHour(newTime);
         updateEndPicker('task-time-end', nextTime);
     });
     initCustomTimePicker('task-time-end-box', 'task-time-end-display', 'task-time-end', 'task-time-end-dropdown');
 
     initCustomTimePicker('event-time-start-box', 'event-time-start-display', 'event-time-start', 'event-time-start-dropdown', (newTime) => {
         const nextTime = addOneHour(newTime);
         updateEndPicker('event-time-end', nextTime);
     });
     initCustomTimePicker('event-time-end-box', 'event-time-end-display', 'event-time-end', 'event-time-end-dropdown');
 
     initCustomTimePicker('wiz-time-start-box', 'wiz-time-start-display', 'wiz-new-task-start', 'wiz-time-start-dropdown', (newTime) => {
         const nextTime = addOneHour(newTime);
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
     initCustomTimePicker('wiz-time-end-box', 'wiz-time-end-display', 'wiz-new-task-end', 'wiz-time-end-dropdown');
 
     
     function saveMindDumps() {
         Store.mind_dumps.set(mindDumps);
     }

     // Göreli zaman (yaş göstergesi)
     function dumpRelativeTime(timestamp) {
         const diff = Date.now() - timestamp;
         const mins = Math.floor(diff / 60000);
         if (mins < 1) return 'Az önce';
         if (mins < 60) return `${mins} dakika önce`;
         const hours = Math.floor(mins / 60);
         if (hours < 24) return `${hours} saat önce`;
         const days = Math.floor(hours / 24);
         if (days === 1) return 'Dün';
         if (days < 7) return `${days} gün önce`;
         const weeks = Math.floor(days / 7);
         if (weeks === 1) return '1 hafta önce';
         if (weeks < 5) return `${weeks} hafta önce`;
         const months = Math.floor(days / 30);
         return `${months} ay önce`;
     }

     // Etiket renk/metin tablosu
     // Sabit etiket renk paleti (özel etiketler de bu renklerden döngüsel olarak alır)
     const DUMP_CUSTOM_TAG_COLORS = [
         { color: '#00cec9', bg: 'rgba(0,206,201,0.12)',   border: 'rgba(0,206,201,0.25)'   },
         { color: '#fd79a8', bg: 'rgba(253,121,168,0.12)', border: 'rgba(253,121,168,0.25)' },
         { color: '#55efc4', bg: 'rgba(85,239,196,0.12)',  border: 'rgba(85,239,196,0.25)'  },
         { color: '#ffeaa7', bg: 'rgba(255,234,167,0.12)', border: 'rgba(255,234,167,0.25)' },
         { color: '#b2bec3', bg: 'rgba(178,190,195,0.12)', border: 'rgba(178,190,195,0.25)' },
     ];
     const DUMP_CUSTOM_TAG_MAX = 5;

     const DUMP_PRESET_TAGS = {
         'ana-hedef':  { label: '🎯 Ana Hedef',  color: '#a29bfe', bg: 'rgba(162,155,254,0.12)', border: 'rgba(162,155,254,0.25)' },
         'aliskanlik': { label: '🔥 Alışkanlık', color: '#fd79a8', bg: 'rgba(253,121,168,0.12)', border: 'rgba(253,121,168,0.25)' },
         'fikir':      { label: '💡 Fikir',       color: '#fdcb6e', bg: 'rgba(253,203,110,0.12)', border: 'rgba(253,203,110,0.25)' },
         'diger':      { label: '📦 Diğer',       color: 'rgba(255,255,255,0.45)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)' },
         // Geriye dönük uyum (eski kayıtlar)
         'endise':       { label: '😟 Endişe',      color: '#e17055', bg: 'rgba(225,112,85,0.12)',  border: 'rgba(225,112,85,0.25)'  },
         'hatirlatici':  { label: '📌 Hatırlatıcı', color: '#a29bfe', bg: 'rgba(162,155,254,0.12)', border: 'rgba(162,155,254,0.25)' },
         'soru':         { label: '❓ Soru',         color: '#74b9ff', bg: 'rgba(116,185,255,0.12)', border: 'rgba(116,185,255,0.25)' },
     };

     function getDumpCustomTags() {
         return FocusStorage.get('dump_custom_tags', []);
     }
     function saveDumpCustomTags(tags) {
         FocusStorage.set('dump_custom_tags', tags);
     }

     // Tüm tag meta (preset + özel) birleştirir
     function getDumpTagMeta() {
         const custom = getDumpCustomTags();
         const meta = { ...DUMP_PRESET_TAGS };
         custom.forEach((t, i) => {
             const c = DUMP_CUSTOM_TAG_COLORS[i % DUMP_CUSTOM_TAG_COLORS.length];
             meta[t.id] = { label: t.label, ...c };
         });
         return meta;
     }

     // Geriye dönük uyum için dumpTagMeta alias
     const dumpTagMeta = new Proxy({}, { get(_, k) { return getDumpTagMeta()[k]; } });

     let dumpSearchQuery = '';
     let dumpActiveTag = 'all';
     let dumpInlineSelectedTag = 'diger';

     function renderDumpInlineTagRow() {
         const row = document.getElementById('dump-inline-tag-row');
         if (!row) return;
         const meta = getDumpTagMeta();
         const customTags = getDumpCustomTags();
         const VISIBLE = ['ana-hedef', 'aliskanlik', 'fikir', 'diger'];
         const allKeys = [...VISIBLE, ...customTags.map(t => t.id)];
         row.innerHTML = allKeys.map(key => {
             const info = meta[key] || meta['diger'];
             const isActive = key === dumpInlineSelectedTag;
             return `<button class="dump-inline-tag-chip${isActive ? ' active' : ''}"
                 style="${isActive ? `color:${info.color};background:${info.bg};border-color:${info.border};` : ''}"
                 data-action="select-dump-inline-tag" data-tag="${key}">${escapeHtml(info.label)}</button>`;
         }).join('');
     }

     function renderMindDumps() {
         const dumpList = document.getElementById('dump-list');
         if(!dumpList) return;
         dumpList.innerHTML = '';
         renderDumpFilterBtns();
         renderDumpInlineTagRow();

         // ── Dönüşüm özeti ──────────────────────────────────────
         const convLog = FocusStorage.get('mind_dump_conversions', []);
         const convertedCount = convLog.length;
         const totalEver = convertedCount + mindDumps.length;
         const convRate = totalEver > 0 ? Math.round((convertedCount / totalEver) * 100) : 0;

         // Header meta chip'leri güncelle
         const headerMeta = document.getElementById('dump-header-meta');
         const hChipCount = document.getElementById('dump-hchip-count');
         const hChipRate  = document.getElementById('dump-hchip-rate');
         if (headerMeta) {
             if (mindDumps.length === 0 && convertedCount === 0) {
                 headerMeta.style.display = 'none';
             } else {
                 headerMeta.style.display = 'flex';
                 if (hChipCount) hChipCount.textContent = `${mindDumps.length} düşünce`;
                 if (hChipRate)  hChipRate.textContent  = `%${convRate} dönüştürüldü`;
             }
         }

         // Limite yaklaşınca/dolunca "Fırlat" butonunu görsel olarak uyar
         if (dumpInlineSubmitBtn) {
             const dumpAtLimit = mindDumps.length >= MAX_MIND_DUMPS;
             dumpInlineSubmitBtn.style.opacity = dumpAtLimit ? '0.55' : '';
             dumpInlineSubmitBtn.title = dumpAtLimit ? `Zihin çöplüğü dolu (${MAX_MIND_DUMPS}/${MAX_MIND_DUMPS}) — önce işle ya da temizle.` : '';
         }

         // Stats şeridi (bekleyen / dönüştürüldü / bayatlıyor / eyleme geçiş) kaldırıldı.
         const _oldStatsEl = document.getElementById('dump-stats-strip');
         if (_oldStatsEl) _oldStatsEl.remove();

         // Temizleme hatırlatıcısı
         const banner = document.getElementById('dump-cleanup-banner');
         const bannerText = document.getElementById('dump-cleanup-text');
         const CLEANUP_THRESHOLD = 10;
         const dismissed = FocusStorage.get('dump_banner_dismissed_at', 0);
         const daysSinceDismiss = (Date.now() - dismissed) / (1000 * 60 * 60 * 24);
         if (banner) {
             if (mindDumps.length >= CLEANUP_THRESHOLD && daysSinceDismiss > 7) {
                 if (bannerText) bannerText.textContent = `Zihin çöplüğünde ${mindDumps.length} bekleyen öğe var — işleme vakti! 🧹`;
                 banner.style.display = 'flex';
             } else {
                 banner.style.display = 'none';
             }
         }

         // Filtreleme
         let filtered = [...mindDumps].reverse();
         if (dumpSearchQuery) {
             const q = dumpSearchQuery.toLowerCase();
             filtered = filtered.filter(d => d.text.toLowerCase().includes(q));
         }
         if (dumpActiveTag !== 'all') {
             filtered = filtered.filter(d => (d.tag || 'diger') === dumpActiveTag);
         }

         if (filtered.length === 0) {
             if (mindDumps.length === 0) {
                 dumpList.innerHTML = '<li class="dump-empty">🎉 Zihin çöplüğün tertemiz. <button data-action="focus-dump-textarea" class="dump-empty-cta">Bir şeyler fırlat →</button></li>';
             } else {
                 dumpList.innerHTML = '<li class="dump-empty">Bu filtreyle eşleşen öğe yok.</li>';
             }
             return;
         }

         filtered.forEach(dump => {
             const ageStr = dumpRelativeTime(dump.timestamp);
             const tagKey = dump.tag || 'diger';
             const _metaAll = getDumpTagMeta();
             const tagInfo = _metaAll[tagKey] || _metaAll['diger'];
             const ageDays = (Date.now() - dump.timestamp) / (1000 * 60 * 60 * 24);
             const ageClass = ageDays > 14 ? 'dump-age-critical'
                            : ageDays > 7  ? 'dump-age-old'
                            : ageDays > 3  ? 'dump-age-stale'
                            : '';
             const ageWarnLabel = ageDays > 14 ? '🔴 Kritik'
                                : ageDays > 7  ? '🟠 Bayatladı'
                                : ageDays > 3  ? '🟡 Eski'
                                : '';
             const isOld = ageDays > 3;

             const li = document.createElement('li');
             li.className = 'dump-item' + (ageClass ? ' ' + ageClass : '');
             li.dataset.dumpId = dump.id;
             li.innerHTML = `
                 <div class="dump-info">
                     <div class="dump-title-row">
                         <span class="dump-title" title="Düzenlemek için çift tıkla">${escapeHtml(dump.text)}</span>
                         <span class="dump-tag-badge" title="Etiket" style="color:${tagInfo.color};background:${tagInfo.bg};border-color:${tagInfo.border};">${escapeHtml(tagInfo.label)}</span>
                     </div>
                     <span class="dump-date">
                         <i class="fa-regular fa-clock"></i> ${ageStr}
                         ${isOld ? `<span class="dump-age-warn">${ageWarnLabel}</span>` : ''}
                     </span>
                 </div>
                 <div class="dump-actions">
                     <button class="dump-edit-btn" data-action="edit-dump" data-id="${dump.id}" title="Düzenle"><i class="fa-solid fa-pen"></i></button>
                     <button class="dump-convert-btn" data-action="convert-dump" data-id="${dump.id}" title="Dönüştür"><i class="fa-solid fa-arrow-right-arrow-left"></i></button>
                     <button class="dump-del-btn" data-action="delete-dump" data-id="${dump.id}" title="Sil"><i class="fa-solid fa-trash"></i></button>
                 </div>
             `;
             // Çift tıklama ile inline düzenleme
             li.querySelector('.dump-title').addEventListener('dblclick', () => startDumpEdit(dump.id));
             dumpList.appendChild(li);
         });
     }

     // Inline dump input
     const dumpInlineTextarea = document.getElementById('dump-inline-textarea');
     const dumpInlineSubmitBtn = document.getElementById('dump-inline-submit');

     // ─── Filtre butonlarını (toolbar) dinamik render et ───
     function renderDumpFilterBtns() {
         const container = document.getElementById('dump-tag-filters');
         if (!container) return;
         const meta = getDumpTagMeta();
         const customTags = getDumpCustomTags();
         const VISIBLE_PRESET = ['ana-hedef', 'aliskanlik', 'fikir', 'diger'];
         const allTags = [null, ...VISIBLE_PRESET, ...customTags.map(t => t.id)]; // null = "Tümü"
         container.innerHTML = allTags.map(tag => {
             if (!tag) return `<button class="dump-tag-filter-btn${dumpActiveTag === 'all' ? ' active' : ''}" data-tag="all" style="white-space:nowrap;">Tümü</button>`;
             const m = meta[tag] || meta.diger;
             return `<button class="dump-tag-filter-btn${dumpActiveTag === tag ? ' active' : ''}" data-tag="${tag}" style="white-space:nowrap;">${escapeHtml(m.label)}</button>`;
         }).join('');
         container.querySelectorAll('.dump-tag-filter-btn').forEach(btn => {
             btn.addEventListener('click', () => {
                 container.querySelectorAll('.dump-tag-filter-btn').forEach(b => b.classList.remove('active'));
                 btn.classList.add('active');
                 dumpActiveTag = btn.dataset.tag;
                 renderMindDumps();
             });
         });
     }


     // ─── Özel etiket ekle ───
     // ─── Özel Etiket Yönetim Modalı ───────────────────────────────────────────
     const _dumpTagMgrModal  = document.getElementById('dump-tag-manager-modal');
     const _dumpTagInput     = document.getElementById('dump-new-tag-input');
     const _dumpTagSaveBtn   = document.getElementById('dump-tag-save-btn');
     const _dumpTagError     = document.getElementById('dump-tag-error');
     const _dumpTagCharCount = document.getElementById('dump-tag-char-count');
     const _dumpTagCounter   = document.getElementById('dump-tag-manager-counter');
     const _dumpTagList      = document.getElementById('dump-custom-tag-list');
     const _dumpNoTags       = document.getElementById('dump-no-custom-tags');
     const _dumpTagAddArea   = document.getElementById('dump-tag-add-area');

     function _refreshTagManager() {
         const custom = getDumpCustomTags();
         const atMax  = custom.length >= DUMP_CUSTOM_TAG_MAX;

         if (_dumpTagCounter) _dumpTagCounter.textContent = `${custom.length} / ${DUMP_CUSTOM_TAG_MAX} etiket`;
         if (_dumpTagAddArea) _dumpTagAddArea.style.opacity = atMax ? '0.45' : '1';
         if (_dumpTagInput)   _dumpTagInput.disabled = atMax;
         if (_dumpTagSaveBtn) {
             _dumpTagSaveBtn.disabled = atMax;
             _dumpTagSaveBtn.style.opacity = atMax ? '0.4' : '1';
             _dumpTagSaveBtn.style.cursor  = atMax ? 'not-allowed' : 'pointer';
         }

         if (_dumpTagList) {
             if (custom.length === 0) {
                 _dumpTagList.innerHTML = '';
                 if (_dumpNoTags) _dumpNoTags.style.display = 'block';
             } else {
                 if (_dumpNoTags) _dumpNoTags.style.display = 'none';
                 _dumpTagList.innerHTML = '';
                 custom.forEach((t, i) => {
                     const c = DUMP_CUSTOM_TAG_COLORS[i % DUMP_CUSTOM_TAG_COLORS.length];
                     const li = document.createElement('li');
                     li.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);';
                     const dot = document.createElement('span');
                     dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:' + c.color + ';flex-shrink:0;display:inline-block;';
                     const lbl = document.createElement('span');
                     lbl.textContent = t.label;
                     lbl.style.cssText = 'flex:1;font-size:13px;color:#fff;font-weight:500;';
                     const delBtn = document.createElement('button');
                     delBtn.type = 'button';
                     delBtn.title = 'Etiketi sil';
                     // inline-flex + açık kırmızı renk + SVG ikon (FA bağımlılığı yok)
                     delBtn.style.cssText = [
                         'width:30px', 'height:30px', 'min-width:30px', 'border-radius:8px',
                         'border:1px solid #ff7675', 'background:rgba(255,71,87,0.12)',
                         'color:#ff7675 !important', 'cursor:pointer',
                         'display:inline-flex', 'align-items:center', 'justify-content:center',
                         'flex-shrink:0', 'padding:0', 'box-sizing:border-box',
                         'font-size:14px', 'line-height:1', 'overflow:visible'
                     ].join(';');
                     delBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff7675" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;display:block;"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
                     delBtn.addEventListener('mouseover', () => { delBtn.style.background = 'rgba(255,71,87,0.28)'; delBtn.style.borderColor = '#ff4757'; });
                     delBtn.addEventListener('mouseout',  () => { delBtn.style.background = 'rgba(255,71,87,0.12)'; delBtn.style.borderColor = '#ff7675'; });
                     delBtn.addEventListener('click', () => window._deleteDumpCustomTag(t.id));
                     li.appendChild(dot);
                     li.appendChild(lbl);
                     li.appendChild(delBtn);
                     _dumpTagList.appendChild(li);
                 });
             }
         }
         if (_dumpTagInput) { _dumpTagInput.value = ''; if (_dumpTagCharCount) _dumpTagCharCount.textContent = '0/16'; }
         if (_dumpTagError) _dumpTagError.style.display = 'none';
     }

     window._deleteDumpCustomTag = function(id) {
         let custom = getDumpCustomTags();
         custom = custom.filter(t => t.id !== id);
         saveDumpCustomTags(custom);
         _refreshTagManager();
         renderDumpFilterBtns();
     };

     function _saveDumpCustomTag() {
         if (!_dumpTagInput) return;
         const raw   = _dumpTagInput.value.trim();
         const label = raw.slice(0, 16);
         if (!label) { _showDumpTagError('Etiket adı boş olamaz.'); return; }

         const custom  = getDumpCustomTags();
         const presets = ['Ana Hedef', 'Alışkanlık', 'Fikir', 'Diğer'];
         const allNames = [
             ...presets.map(n => n.toLowerCase()),
             ...custom.map(t => t.label.toLowerCase())
         ];
         if (allNames.includes(label.toLowerCase())) {
             _showDumpTagError('Bu isimde bir etiket zaten var.');
             return;
         }
         if (custom.length >= DUMP_CUSTOM_TAG_MAX) {
             _showDumpTagError(`En fazla ${DUMP_CUSTOM_TAG_MAX} özel etiket eklenebilir.`);
             return;
         }
         const id = 'custom_' + Date.now();
         custom.push({ id, label });
         saveDumpCustomTags(custom);
         _refreshTagManager();
         renderDumpFilterBtns();
     }

     function _showDumpTagError(msg) {
         if (!_dumpTagError) return;
         _dumpTagError.textContent = msg;
         _dumpTagError.style.display = 'block';
         if (_dumpTagInput) _dumpTagInput.style.borderColor = 'rgba(255,118,117,0.6)';
         setTimeout(() => {
             if (_dumpTagError) _dumpTagError.style.display = 'none';
             if (_dumpTagInput) _dumpTagInput.style.borderColor = 'rgba(255,255,255,0.1)';
         }, 2800);
     }

     function openAddCustomTagPrompt() {
         if (!_dumpTagMgrModal) return;
         _refreshTagManager();
         _dumpTagMgrModal.classList.remove('hidden');
         setTimeout(() => _dumpTagInput && !_dumpTagInput.disabled && _dumpTagInput.focus(), 80);
     }

     // Karakter sayacı
     if (_dumpTagInput) {
         _dumpTagInput.addEventListener('input', () => {
             const len = _dumpTagInput.value.length;
             if (_dumpTagCharCount) {
                 _dumpTagCharCount.textContent = `${len}/16`;
                 _dumpTagCharCount.style.color = len >= 14 ? '#fdcb6e' : 'var(--text-muted)';
             }
             if (_dumpTagError) _dumpTagError.style.display = 'none';
             if (_dumpTagInput) _dumpTagInput.style.borderColor = 'rgba(255,255,255,0.1)';
         });
         _dumpTagInput.addEventListener('keydown', e => { if (e.key === 'Enter') _saveDumpCustomTag(); });
     }

     if (_dumpTagSaveBtn) _dumpTagSaveBtn.addEventListener('click', _saveDumpCustomTag);

     if (document.getElementById('close-dump-tag-manager-btn')) {
         document.getElementById('close-dump-tag-manager-btn').addEventListener('click', () => {
             _dumpTagMgrModal && _dumpTagMgrModal.classList.add('hidden');
         });
     }
     if (_dumpTagMgrModal) {
         _dumpTagMgrModal.addEventListener('click', e => { if (e.target === _dumpTagMgrModal) _dumpTagMgrModal.classList.add('hidden'); });
     }

     window.selectDumpInlineTag = function(key) {
         dumpInlineSelectedTag = key;
         renderDumpInlineTagRow();
     };

     function submitInlineDump() {
         if (!dumpInlineTextarea) return;
         const text = dumpInlineTextarea.value.trim();
         if (!text) return;
         if (mindDumps.length >= MAX_MIND_DUMPS) {
             showPremiumModal({
                 title: 'Çöplük Dolu 🗑️',
                 message: `Zihin çöplüğü, işlenmeyi bekleyen ${MAX_MIND_DUMPS} fikirle dolu. Buradaki amaç düşünceleri biriktirmek değil, kafanı boşaltıp hızlıca işlemek — yeni bir fikir eklemeden önce birkaçını göreve/hedefe dönüştür ya da artık gerekmeyenleri sil.`,
                 type: 'warning'
             });
             return;
         }
         mindDumps.push({ id: generateId(), text, tag: dumpInlineSelectedTag, timestamp: Date.now() });
         saveMindDumps();
         renderMindDumps();
         if (typeof renderCalMindDump === 'function') renderCalMindDump();
         dumpInlineTextarea.value = '';
         dumpInlineTextarea.focus();
     }

     if (dumpInlineSubmitBtn) dumpInlineSubmitBtn.addEventListener('click', submitInlineDump);
     if (dumpInlineTextarea) {
         dumpInlineTextarea.addEventListener('keydown', (e) => {
             if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitInlineDump(); }
         });
         const charCounter = document.getElementById('dump-char-counter');
         const MAX = 140;
         dumpInlineTextarea.addEventListener('input', () => {
             const len = dumpInlineTextarea.value.length;
             if (charCounter) {
                 charCounter.textContent = `${len} / ${MAX}`;
                 charCounter.classList.toggle('warn',  len >= MAX * 0.8 && len < MAX);
                 charCounter.classList.toggle('limit', len >= MAX);
             }
         });
     }

     window.changeDumpTag = function(id, newTag) {
         const dump = mindDumps.find(d => String(d.id) === String(id));
         if (!dump) return;
         dump.tag = newTag;
         saveMindDumps();
         renderMindDumps();
     };

     window.toggleDumpTagPicker = function(id, badgeEl) {
         // Açık picker varsa kapat
         const existing = document.getElementById('dump-tag-picker');
         if (existing) {
             if (existing.dataset.dumpId === String(id)) { existing.remove(); return; }
             existing.remove();
         }
         const meta = getDumpTagMeta();
         const customTags = getDumpCustomTags();
         const VISIBLE_PRESET = ['ana-hedef', 'aliskanlik', 'fikir', 'diger'];
         const allTags = [...VISIBLE_PRESET, ...customTags.map(t => t.id)];
         const picker = document.createElement('div');
         picker.id = 'dump-tag-picker';
         picker.dataset.dumpId = String(id);
         picker.className = 'dump-tag-picker';
         allTags.forEach(tag => {
             const m = meta[tag] || meta.diger;
             const btn = document.createElement('button');
             btn.className = 'dump-tag-picker-btn';
             btn.textContent = m.label;
             btn.style.cssText = `color:${m.color};`;
             btn.addEventListener('click', (e) => { e.stopPropagation(); picker.remove(); changeDumpTag(id, tag); });
             picker.appendChild(btn);
         });
         // Özel etiket yönetimi linki
         const mgrBtn = document.createElement('button');
         mgrBtn.className = 'dump-tag-picker-btn dump-tag-picker-mgr';
         mgrBtn.textContent = '+ Özel etiket';
         mgrBtn.addEventListener('click', (e) => { e.stopPropagation(); picker.remove(); openAddCustomTagPrompt(); });
         picker.appendChild(mgrBtn);
         badgeEl.parentElement.appendChild(picker);
         setTimeout(() => document.addEventListener('click', () => picker.remove(), { once: true }), 0);
     };

     // Arama
     const dumpSearchInput = document.getElementById('dump-search-input');
     if (dumpSearchInput) {
         dumpSearchInput.addEventListener('input', () => {
             dumpSearchQuery = dumpSearchInput.value.trim();
             renderMindDumps();
         });
     }

     // Filtre butonları dinamik render edilir (renderDumpFilterBtns ile)
     renderDumpFilterBtns();

     // Temizleme hatırlatıcısı dismiss
     const cleanupDismissBtn = document.getElementById('dump-cleanup-dismiss');
     if (cleanupDismissBtn) {
         cleanupDismissBtn.addEventListener('click', () => {
             FocusStorage.set('dump_banner_dismissed_at', Date.now());
             const banner = document.getElementById('dump-cleanup-banner');
             if (banner) banner.style.display = 'none';
         });
     }

     // Eski input fallback (başka yerden çağrılıyorsa diye)
     const dumpInput = document.getElementById('dump-input');
     const addDumpBtn = document.getElementById('add-dump-btn');
     function addMindDump() {
         if(!dumpInput) return;
         const text = dumpInput.value.trim();
         if(!text) return;
         if (mindDumps.length >= MAX_MIND_DUMPS) {
             showPremiumModal({
                 title: 'Çöplük Dolu 🗑️',
                 message: `Zihin çöplüğü, işlenmeyi bekleyen ${MAX_MIND_DUMPS} fikirle dolu. Yeni bir fikir eklemeden önce birkaçını göreve/hedefe dönüştür ya da artık gerekmeyenleri sil.`,
                 type: 'warning'
             });
             return;
         }
         mindDumps.push({ id: generateId(), text, timestamp: Date.now() });
         dumpInput.value = '';
         saveMindDumps();
         renderMindDumps();
         if (typeof renderCalMindDump === 'function') renderCalMindDump();
     }
     if(addDumpBtn) addDumpBtn.addEventListener('click', addMindDump);
     if(dumpInput) dumpInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') addMindDump(); });

     const dumpInlineTagRowEl = document.getElementById('dump-inline-tag-row');
     if (dumpInlineTagRowEl) {
         dumpInlineTagRowEl.addEventListener('click', (e) => {
             const btn = e.target.closest('[data-action="select-dump-inline-tag"]');
             if (!btn) return;
             window.selectDumpInlineTag(btn.dataset.tag);
         });
     }
     const dumpListEl = document.getElementById('dump-list');
     if (dumpListEl) {
         dumpListEl.addEventListener('click', (e) => {
             const emptyBtn = e.target.closest('[data-action="focus-dump-textarea"]');
             if (emptyBtn) {
                 const ta = document.getElementById('dump-inline-textarea');
                 if (ta) ta.focus();
                 return;
             }
             const actionBtn = e.target.closest('[data-action]');
             if (!actionBtn) return;
             const id = actionBtn.dataset.id;
             const action = actionBtn.dataset.action;
             if (action === 'edit-dump') startDumpEdit(id);
             else if (action === 'convert-dump') openConvertModal(id);
             else if (action === 'delete-dump') deleteMindDump(id);
         });
     }

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
                 editTask(id);
             } else if (action === 'cdd-delete-task') {
                 e.stopPropagation();
                 deleteGlobalTask(id, date);
                 setTimeout(() => {
                     window.renderDayDrawer(date);
                     if (window.renderCalendarGlobal) window.renderCalendarGlobal();
                 }, 80);
             } else if (action === 'cdd-toggle-habit') {
                 toggleHabitFromToday(id, date);
                 window.renderDayDrawer(date);
             }
         });
     }

     window.deleteMindDump = function(id) {
         const idx = mindDumps.findIndex(d => String(d.id) === String(id));
         if (idx === -1) return;
         const [deleted] = mindDumps.splice(idx, 1);
         saveMindDumps();
         renderMindDumps();
         showUndoToast(`"${deleted.text.slice(0, 40)}${deleted.text.length > 40 ? '…' : ''}" silindi`, () => {
             mindDumps.splice(idx, 0, deleted);
             saveMindDumps();
             renderMindDumps();
         });
     }

     window.startDumpEdit = function(id) {
         const li = document.querySelector(`.dump-item[data-dump-id="${id}"]`);
         if (!li) return;
         const titleSpan = li.querySelector('.dump-title');
         if (!titleSpan || li.classList.contains('dump-editing')) return;

         const originalText = titleSpan.textContent;
         li.classList.add('dump-editing');

         const input = document.createElement('input');
         input.type = 'text';
         input.className = 'dump-inline-input';
         input.value = originalText;
         titleSpan.replaceWith(input);
         input.focus();
         input.select();

         // Düzenleme sırasında etiket rozeti tıklanabilir hale gelir
         const tagBadge = li.querySelector('.dump-tag-badge');
         if (tagBadge) {
             tagBadge.classList.add('dump-tag-badge-btn');
             tagBadge.title = 'Etiketi değiştir';
             tagBadge.addEventListener('mousedown', (e) => e.preventDefault());
             tagBadge.addEventListener('click', (e) => {
                 e.stopPropagation();
                 toggleDumpTagPicker(id, tagBadge);
             });
         }

         function commit() {
             const newText = input.value.trim();
             if (newText && newText !== originalText) {
                 const dump = mindDumps.find(d => String(d.id) === String(id));
                 if (dump) { dump.text = newText; saveMindDumps(); }
             }
             renderMindDumps();
         }
         function cancel() { renderMindDumps(); }

         input.addEventListener('blur', commit);
         input.addEventListener('keydown', (e) => {
             if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
             if (e.key === 'Escape') { e.removeEventListener('blur', commit); cancel(); }
         });
     }
 
     const convertModal = document.getElementById('convert-dump-modal');
     const convertIdInput = document.getElementById('convert-dump-id');
     const convertTextInput = document.getElementById('convert-dump-text');
     
     // YENİ TANIMLAMALAR
     const dumpTaskFields = document.getElementById('dump-task-fields');
     const dumpHabitFields = document.getElementById('dump-habit-fields');
     const dumpGoalFields = document.getElementById('dump-goal-fields');
     
     const convertDateInput = document.getElementById('convert-dump-date');
     const convertStartTimeInput = document.getElementById('convert-dump-start-time');
     const convertEndTimeInput = document.getElementById('convert-dump-end-time');
     const convertParentGoal = document.getElementById('convert-dump-parent-goal');
     const convertPriorityInput = document.getElementById('convert-dump-priority');
     const convertTaskRecurring = document.getElementById('convert-dump-task-recurring');
     
     const convertHabitCat = document.getElementById('convert-dump-habit-category');
     const convertHabitDuration = document.getElementById('convert-dump-habit-duration');
     
     const dumpOpenGoalBtn = document.getElementById('dump-open-goal-modal-btn');
     const dumpTypeRadios = document.querySelectorAll('input[name="dump_type"]');
     const dumpTypeBtns = document.querySelectorAll('.dump-type-btn');
 
     const saveConvertBtn = document.getElementById('save-convert-dump-btn');
     const closeConvertBtn = document.getElementById('close-convert-dump-btn');
     const cancelConvertBtn = document.getElementById('cancel-convert-dump-btn');
 
     // TÜR DEĞİŞİMİ DİNLEYİCİSİ
     dumpTypeRadios.forEach(radio => {
         radio.addEventListener('change', (e) => {
             dumpTypeBtns.forEach(btn => {
                 btn.classList.remove('active');
                 btn.style.background = 'var(--glass-bg)';
                 btn.style.color = 'var(--text-muted)';
                 btn.style.borderColor = 'var(--glass-border)';
             });
             
             const selectedLabel = e.target.closest('label').querySelector('.dump-type-btn');
             selectedLabel.classList.add('active');
             selectedLabel.style.background = 'rgba(108, 92, 231, 0.2)';
             selectedLabel.style.color = '#fff';
             selectedLabel.style.borderColor = 'var(--primary-color)';
 
             const val = e.target.value;
             dumpTaskFields.style.display = 'none';
             dumpHabitFields.style.display = 'none';
             dumpGoalFields.style.display = 'none';
             saveConvertBtn.style.display = 'block';
 
             if(val === 'task') {
                 dumpTaskFields.style.display = 'block';
                 saveConvertBtn.innerHTML = '<i class="fa-solid fa-check"></i> Planla & Taşı';
             } else if(val === 'habit') {
                 dumpHabitFields.style.display = 'block';
                 saveConvertBtn.innerHTML = '<i class="fa-solid fa-leaf"></i> Alışkanlık Yarat';
                 
                 // KATEGORİLERİ SENKRONİZE ET (Alışkanlıklar sekmesiyle aynı yapar)
                 convertHabitCat.innerHTML = '';
                 habitCategories.forEach(cat => {
                     const opt = document.createElement('option');
                     opt.value = cat.id; 
                     opt.textContent = cat.name;
                     convertHabitCat.appendChild(opt);
                 });
             } else if(val === 'goal') {
                 dumpGoalFields.style.display = 'block';
                 saveConvertBtn.style.display = 'none'; // Ana hedefte detaylı form açılır
             }
         });
     });
 
     window.openConvertModal = function(id) {
         const dump = mindDumps.find(d => String(d.id) === String(id));
         if(!dump) return;
         
         convertIdInput.value = dump.id;
         convertTextInput.value = dump.text;
         
         document.querySelector('input[name="dump_type"][value="task"]').click(); // Görevi varsayılan yap
         
         if (convertDateInput._flatpickr) {
            convertDateInput._flatpickr.setDate(new Date(), false);
        } else {
            convertDateInput.value = formatDateToString(new Date());
        }
         convertPriorityInput.value = 'medium';
         if(convertTaskRecurring) convertTaskRecurring.value = '';
         if(convertStartTimeInput) convertStartTimeInput.value = '09:00';
         if(convertEndTimeInput) convertEndTimeInput.value = '10:00';
         if(convertParentGoal) convertParentGoal.value = '';
         
         convertModal.classList.remove('hidden');
     }
 
     if (convertStartTimeInput && convertEndTimeInput) {
         convertStartTimeInput.addEventListener('change', () => {
             convertEndTimeInput.value = addOneHour(convertStartTimeInput.value);
         });
     }
 
     function closeConvertModal() {
         convertModal.classList.add('hidden');
     }
 
     if(closeConvertBtn) closeConvertBtn.addEventListener('click', closeConvertModal);
     if(cancelConvertBtn) cancelConvertBtn.addEventListener('click', closeConvertModal);
 
     // HEDEF MODALINA YÖNLENDİRME (Ana Hedef Seçilirse)
     if(dumpOpenGoalBtn) {
         dumpOpenGoalBtn.addEventListener('click', () => {
             const id = convertIdInput.value;
             const text = convertTextInput.value.trim();
             
             closeConvertModal();
             openGoalModal(); 
             document.getElementById('goal-title-input').value = text; 
             
             mindDumps = mindDumps.filter(d => String(d.id) !== String(id));
             saveMindDumps();
             renderMindDumps();
         });
     }
 
     // SİSTEME EKLE BUTONU (Görev veya Alışkanlık)
     if(saveConvertBtn) {
         saveConvertBtn.addEventListener('click', () => {
             const id = convertIdInput.value;
             const text = convertTextInput.value.trim();
             const type = document.querySelector('input[name="dump_type"]:checked').value;
 
             if(!text) return;
 
             if(type === 'task') {
                const rawDate = convertDateInput.value;
                let date;
                if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
                    const [y, m, d] = rawDate.split('-');
                    date = `${d}-${m}-${y}`;
                } else {
                    date = rawDate;
                }
                 const priority = convertPriorityInput.value;
                 const start = convertStartTimeInput.value;
                 const end = convertEndTimeInput.value;
                 const parentGoal = convertParentGoal ? convertParentGoal.value : '';

                    // --- YENİ: Ana Hedef Tarih Sınırı Kontrolü ---
                    if (!checkGoalDateBoundaries(parentGoal, date)) {
                        return;
                    }

                 const recurring = convertTaskRecurring ? convertTaskRecurring.value : '';
                 
                 if(!date || !start || !end) {
                     showPremiumModal({ title: 'Eksik Bilgi', message: 'Lütfen görev için bir başlangıç ve bitiş saati belirleyin.', type: 'warning' });
                     return;
                 }
 
                 const startMins = timeToMins(start);
                 const endMins = timeToMins(end);
 
                 if(startMins >= endMins) {
                     showPremiumModal({ title: 'Hatalı Zaman', message: 'Bitiş saati başlangıçtan önce veya aynı olamaz.', type: 'warning' });
                     return;
                 }
 
                 if(hasTimeConflict(date, startMins, endMins)) {
                     showPremiumModal({ title: 'Zaman Çakışması', message: 'Bu saatte takviminizde başka plan var.', type: 'warning' });
                     return;
                 }
 
                 addSmartTask(text, priority, 'kisisel', date, start, end, '', parentGoal, recurring);
                 if(!recurring) {
                     showPremiumModal({ title: 'Başarılı!', message: 'Fikriniz başarıyla bir göreve dönüştürüldü.', type: 'success' });
                 }
                 if (window.FocusAISocial && typeof window.FocusAISocial.postActivity === 'function') {
                     window.FocusAISocial.postActivity(`"${text}" fikrini göreve dönüştürdü 💡`);
                 }
             } 
             else if (type === 'habit') {
                 const category = convertHabitCat.value;
                 const duration = parseInt(convertHabitDuration.value) || 21;
                 const iconMap = { 'health': 'fa-heart-pulse', 'education': 'fa-book-open', 'finance': 'fa-wallet', 'social': 'fa-users', 'work': 'fa-briefcase', 'other': 'fa-star' };
                 
                 habits.push({ 
                     id: generateId(),
                     name: text, 
                     icon: iconMap[category] || 'fa-star', 
                     targetDays: duration, 
                     category: category,
                     startDate: formatDateToString(new Date()),
                     buddy: 'none', 
                     parentGoals: [],
                     history: {} 
                 });
                 saveHabits();
                 renderHabits();
                 showPremiumModal({ title: 'Başarılı!', message: 'Fikriniz yeni bir alışkanlığa dönüştürüldü.', type: 'success' });
             }
 
            // Ortak: Çöplükten sil ve yenile
            mindDumps = mindDumps.filter(d => String(d.id) !== String(id));
            
            // Fikir dönüşüm günlüğünü veritabanına tarihli kaydet
            let conversionLog = FocusStorage.get('mind_dump_conversions', []);
            conversionLog.push({ id: id, date: formatDateToString(new Date()) });
            FocusStorage.set('mind_dump_conversions', conversionLog);
 
            saveMindDumps();
            renderMindDumps();
             
             renderTasks();
             if(renderCalendarRef) renderCalendarRef();
             if(renderEventsRef) renderEventsRef();
             if(renderStatisticsRef && document.getElementById('istatistikler').classList.contains('active')) renderStatisticsRef();
             
             // GÜNCELLEME: Takvimin aktif görünüm moduna (Aylık/Haftalık/Günlük) göre arayüzü ve havuzu zorunlu yenile
                setTimeout(() => {
                    if (typeof renderCalendar === 'function') renderCalendar();
                    if (typeof renderEvents === 'function') renderEvents();
                    if (typeof renderCalMindDump === 'function') renderCalMindDump();
                    if (typeof window.renderCalMindDump === 'function') window.renderCalMindDump();
                    if (typeof updateStats === 'function') updateStats();
                    if (typeof renderTasks === 'function') renderTasks();
                    
                    // Aktif takvim görünümlerini (Haftalık/Günlük çipleri) anında yenileyen tetikleyiciler
                    if (typeof window.renderWeeklyView === 'function') window.renderWeeklyView();
                    if (typeof window.renderDailyView === 'function') window.renderDailyView();
                }, 100);

                closeConvertModal();
        });
    }
 
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

     function _spawnChipParticles(chip) {
         const COLORS = ['#4ADE80','#86EFAC','#A7F3D0','#BBF7D0','#FFFFFF','#34D399'];
         const rect = chip.getBoundingClientRect();
         const cx = rect.left + rect.width / 2;
         const cy = rect.top  + rect.height / 2;
         const count = 14;
         for (let i = 0; i < count; i++) {
             const p = document.createElement('span');
             p.className = 'chip-particle';
             const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.6;
             const dist  = 32 + Math.random() * 38;
             const tx = Math.cos(angle) * dist;
             const ty = Math.sin(angle) * dist - (Math.random() * 18);
             const size = 3 + Math.random() * 4;
             const dur  = 550 + Math.random() * 250;
             p.style.cssText = [
                 `left:${cx}px`, `top:${cy}px`,
                 `width:${size}px`, `height:${size}px`,
                 `background:${COLORS[i % COLORS.length]}`,
                 `--tx:${tx}px`, `--ty:${ty}px`,
                 `--dur:${dur}ms`,
                 `border-radius:${Math.random() > 0.4 ? '50%' : '2px'}`,
                 `box-shadow:0 0 4px ${COLORS[i % COLORS.length]}88`
             ].join(';');
             document.body.appendChild(p);
             p.addEventListener('animationend', () => p.remove(), { once: true });
         }
     }

     function _celebrateDoneChip(chip) {
         if (!chip || !chip.offsetParent) return;
         chip.classList.remove('celebrate');
         void chip.offsetWidth;
         chip.classList.add('celebrate');
         chip.addEventListener('animationend', () => chip.classList.remove('celebrate'), { once: true });
         _spawnChipParticles(chip);
     }

     function animateCount(el, newVal, { celebrateChip } = {}) {
         if (!el) return;
         const oldVal = parseInt(el.textContent, 10);
         const next = String(newVal);
         if (el.textContent === next) return;
         const increased = isNaN(oldVal) || newVal > oldVal;
         const dir = increased ? 'roll-up' : 'roll-down';
         el.classList.remove('rolling', 'roll-up', 'roll-down');
         void el.offsetWidth;
         el.textContent = next;
         el.classList.add('rolling', dir);
         el.addEventListener('animationend', () => el.classList.remove('rolling', 'roll-up', 'roll-down'), { once: true });
         if (celebrateChip && increased) {
             _celebrateDoneChip(celebrateChip);
         }
     }

     function updateDailyProgress() {
         const circle = document.getElementById('daily-progress-circle');
         const progressText = document.getElementById('daily-progress-text');
         if(!progressText) return;

         const todayStr = formatDateToString(new Date());
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
         const todayStr = formatDateToString(new Date());
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
         animateCount(pendingCountDisplay, pending);
         animateCount(completedCountDisplay, completed, { celebrateChip: completedChip });
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
         const todayStr = formatDateToString(new Date());
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
         const todayStr = formatDateToString(new Date());
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

     // Kategori renk paleti — takvim chip/blok renklendirmesi için
     const TASK_CAT_COLORS = {
         'kisisel':  { bg: 'rgba(142,92,246,0.78)',  border: '#8e5cf6', glow: 'rgba(142,92,246,0.28)',  label: 'Kişisel',  icon: 'fa-user' },
         'is':       { bg: 'rgba(255,159,67,0.78)',  border: '#ff9f43', glow: 'rgba(255,159,67,0.28)', label: 'İş',       icon: 'fa-briefcase' },
         'egitim':   { bg: 'rgba(46,213,115,0.78)',  border: '#2ed573', glow: 'rgba(46,213,115,0.25)', label: 'Eğitim',   icon: 'fa-book' },
         'saglik':   { bg: 'rgba(255,71,87,0.78)',   border: '#ff4757', glow: 'rgba(255,71,87,0.28)',  label: 'Sağlık',   icon: 'fa-heart' },
     };
     // Öncelik rengi (küçük köşe nokta için)
     const PRIORITY_DOT_COLOR = { high: '#ff4757', medium: '#D4900E', low: '#2ed573' };

     function getCatColor(catId) {
         if (TASK_CAT_COLORS[catId]) return TASK_CAT_COLORS[catId];
         // Dinamik kategoriler için hash renk üret
         let hash = 0;
         for (let i = 0; i < (catId || '').length; i++) hash = catId.charCodeAt(i) + ((hash << 5) - hash);
         const hue = Math.abs(hash) % 360;
         return { bg: `hsla(${hue},65%,55%,0.78)`, border: `hsl(${hue},65%,60%)`, glow: `hsla(${hue},65%,55%,0.25)`, label: catId, icon: 'fa-tag' };
     }
     window.getCatColor = getCatColor;

     // Hedef renk paleti — her hedef için tutarlı, birbirinden ayrışan renkler
     const GOAL_COLOR_PALETTE = [
         { bg: 'rgba(108,92,231,0.82)',  border: '#6c5ce7', glow: 'rgba(108,92,231,0.35)'  }, // violet
         { bg: 'rgba(0,206,201,0.82)',   border: '#00cec9', glow: 'rgba(0,206,201,0.32)'   }, // cyan
         { bg: 'rgba(253,203,110,0.85)', border: '#fdcb6e', glow: 'rgba(253,203,110,0.35)' }, // gold
         { bg: 'rgba(116,185,255,0.82)', border: '#74b9ff', glow: 'rgba(116,185,255,0.32)' }, // blue
         { bg: 'rgba(232,67,147,0.82)',  border: '#e84393', glow: 'rgba(232,67,147,0.32)'  }, // pink
         { bg: 'rgba(0,184,148,0.82)',   border: '#00b894', glow: 'rgba(0,184,148,0.32)'   }, // teal
         { bg: 'rgba(253,121,168,0.82)', border: '#fd79a8', glow: 'rgba(253,121,168,0.32)' }, // rose
         { bg: 'rgba(162,155,254,0.82)', border: '#a29bfe', glow: 'rgba(162,155,254,0.32)' }, // lavender
         { bg: 'rgba(85,239,196,0.82)',  border: '#55efc4', glow: 'rgba(85,239,196,0.32)'  }, // mint
         { bg: 'rgba(255,234,167,0.82)', border: '#ffeaa7', glow: 'rgba(255,234,167,0.32)' }, // cream
     ];

     function getGoalColor(goalId) {
         if (!goalId) return null;
         const goal = goals.find(g => String(g.id) === String(goalId));
         if (!goal) return null;
         const idx = goals.indexOf(goal) % GOAL_COLOR_PALETTE.length;
         return { ...GOAL_COLOR_PALETTE[idx], label: goal.title, icon: 'fa-mountain-sun', isGoal: true };
     }

     // Görev için renk: parentGoal varsa hedef rengi, yoksa kategori rengi
     function getTaskColor(task) {
         if (!task) return getCatColor('kisisel');
         if (task.parentGoal) {
             const gc = getGoalColor(task.parentGoal);
             if (gc) return gc;
         }
         return getCatColor(task.category || 'kisisel');
     }
     window.getTaskColor = getTaskColor;

     function getHabitCategoryLabel(catId) {
         const cat = habitCategories.find(c => c.id === catId);
         return cat ? cat.name : 'Alışkanlık';
     }
 
     function renderTasks() {
         taskList.innerHTML = '';
         const todayStr = formatDateToString(new Date());
         
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
             return formatDateToString(new Date(a.due_date)) === todayStr;
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
         const yesterdayStr = formatDateToString(yest);
 
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

     window.changeHabitDailyGoal = function(habitId, dateStr, goalId) {
         const habit = habits.find(h => String(h.id) === String(habitId));
         if (habit) {
             if (!habit.dailyGoals) habit.dailyGoals = {};
             habit.dailyGoals[dateStr] = goalId;
             saveHabits();
             renderGoals(); // <-- Bu satırın eklendiğinden emin ol
         }
     };
 
     // Bir alışkanlık %25 / %50 / %75 / %100 hedef gününe ulaştığında, o eşiği
     // ilk geçtiği anda aktivite akışına ayrı bir kayıt düşer (her eşik bir kez).
     function checkHabitMilestones(habit, oldCount, newCount) {
         if (!window.FocusAISocial || typeof window.FocusAISocial.postActivity !== 'function') return;
         const target = habit.targetDays || 21;
         if (target <= 0) return;
         [25, 50, 75, 100].forEach(milestone => {
             const oldPct = (oldCount / target) * 100;
             const newPct = (newCount / target) * 100;
             if (oldPct < milestone && newPct >= milestone) {
                 if (milestone === 100) {
                     window.FocusAISocial.postActivity(`"${habit.name}" alışkanlığını %100 tamamladı, hedefe ulaştı! 🏆`);
                 } else {
                     window.FocusAISocial.postActivity(`"${habit.name}" alışkanlığında %${milestone}'e ulaştı 🔥`);
                 }
             }
         });
     }

     window.toggleHabitFromToday = function(habitId, dateStr) {
         const habit = habits.find(h => String(h.id) === String(habitId));
         if (habit) {
             const willComplete = !habit.history[dateStr];
             const oldCount = Object.keys(habit.history).length;

             if (willComplete) {
                 habit.history[dateStr] = true;
             } else {
                 delete habit.history[dateStr];
             }

             // --- SİNERJİ: Alışkanlığa bağlı BUGÜNKÜ Görevleri de otomatik tamamla/kaldır ---
             tasks.forEach(t => {
                 if (String(t.parentHabit) === String(habitId) && t.date === dateStr) {
                     t.completed = willComplete;
                 }
             });

             saveHabits();
             saveTasks();
             renderTasks();

             if(typeof renderHabitsRef === 'function') renderHabitsRef();
             if(typeof renderCalendarRef === 'function') renderCalendarRef();
             if(typeof renderEventsRef === 'function') renderEventsRef();
             if(typeof renderGoals === 'function') renderGoals();
             // Hedef detay modalı açıksa ilerlemeyi anında güncelle
             const detailModal = document.getElementById('goal-details-modal');
             const detailGoalId = document.getElementById('detail-active-goal-id');
             if (detailModal && !detailModal.classList.contains('hidden') && detailGoalId && detailGoalId.value) {
                 if(typeof updateGoalDetailsUI === 'function') updateGoalDetailsUI(detailGoalId.value);
             }

             if (willComplete && window.FocusAISocial && typeof window.FocusAISocial.postActivity === 'function') {
                 window.FocusAISocial.postActivity(`"${habit.name}" alışkanlığını tamamladı 🔥`);
                 checkHabitMilestones(habit, oldCount, oldCount + 1);
             }
         }
     }
 
     // Ortak odaklanma odası (social.js) bugünün görevlerini listeleyip kullanıcıya
     // "hangi göreve odaklanacaksın?" seçeneği sunabilsin diye basit bir global erişim sağlar.
     window.getTodayTasksForFocus = function() {
         try {
             const todayStr = formatDateToString(new Date());
             return tasks
                 .filter(t => t.date === todayStr && !t.completed && !t.isLessonPlanDraft)
                 .map(t => ({ id: t.id, text: t.text }));
         } catch (e) {
             return [];
         }
     };

     // Ortak alışkanlık (buddy habit) entegrasyonu için social.js'in çağırdığı global yardımcılar.
     // Bir günü "tamamlandı" olarak işaretler — zaten tamamlanmışsa dokunmaz (idempotent, toggle değildir).
     window.markHabitCompleteForDate = function(habitId, dateStr) {
         const habit = habits.find(h => String(h.id) === String(habitId));
         if (!habit || habit.history[dateStr]) return false;

         const oldCount = Object.keys(habit.history).length;
         habit.history[dateStr] = true;
         tasks.forEach(t => {
             if (String(t.parentHabit) === String(habitId) && t.date === dateStr) t.completed = true;
         });

         checkHabitMilestones(habit, oldCount, oldCount + 1);

         saveHabits();
         saveTasks();
         renderTasks();
         if(typeof renderHabitsRef === 'function') renderHabitsRef();
         if(typeof renderCalendarRef === 'function') renderCalendarRef();
         if(typeof renderEventsRef === 'function') renderEventsRef();
         if(typeof renderGoals === 'function') renderGoals();
         if(typeof renderBuddyHabitsRef === 'function') renderBuddyHabitsRef();
         return true;
     };

     // Davet kabul edildiğinde / partner kabul ettiğinde ortak alışkanlığı yerel listeye ekler.
     window.addBuddyHabitLocal = function(habitData) {
         if (habits.some(h => String(h.id) === String(habitData.id))) return false;
         habits.push({
             id: habitData.id,
             name: habitData.name,
             icon: habitData.icon || 'fa-repeat',
             targetDays: habitData.targetDays || 21,
             category: habitData.category || 'genel',
             startDate: habitData.startDate || formatDateToString(new Date()),
             buddy: habitData.buddy,
             pairId: habitData.pairId,
             parentGoals: habitData.parentGoals || [],
             history: {}
         });
         saveHabits(); renderHabits(); renderTasks();
         if(renderCalendarRef) renderCalendarRef();
         if(renderEventsRef) renderEventsRef();
         if(renderBuddyHabitsRef && document.getElementById('arkadaslar').classList.contains('active')) renderBuddyHabitsRef();
         return true;
     };

     // Ortak alışkanlığı solo'ya çevir (buddy/pairId'yi kaldır)
     window.convertBuddyHabitToSolo = function(habitId) {
         const h = habits.find(h => String(h.id) === String(habitId));
         if (!h) return;
         h.buddy = null;
         h.pairId = null;
         saveHabits();
         if (typeof renderHabits === 'function') renderHabits();
         if (typeof renderBuddyHabitsRef === 'function') renderBuddyHabitsRef();
         // Supabase'den de sil (artık buddy değil)
         if (window.FocusSupabase && window.currentUser?.id) {
             window.FocusSupabase.from('buddy_habits').delete().eq('id', String(habitId)).then(() => {});
         }
     };

     // Alışkanlığı id'ye göre tamamen sil
     window.deleteHabitById = function(habitId) {
         const idx = habits.findIndex(h => String(h.id) === String(habitId));
         if (idx === -1) return;
         habits.splice(idx, 1);
         saveHabits();
         if (typeof renderHabits === 'function') renderHabits();
         if (typeof renderGoals === 'function') renderGoals();
         if (typeof renderBuddyHabitsRef === 'function') renderBuddyHabitsRef();
         if (window.FocusSupabase && window.currentUser?.id) {
             window.FocusSupabase.from('buddy_habits').delete().eq('id', String(habitId)).then(() => {});
         }
     };

     function playTaskCompleteSound() {
         const cfg = FocusStorage.get('system_settings', { tasksound: true });
         if (cfg.tasksound === false) return;
         try {
             const ctx = new (window.AudioContext || window.webkitAudioContext)();
             const osc = ctx.createOscillator(); const g = ctx.createGain();
             osc.connect(g); g.connect(ctx.destination);
             osc.frequency.setValueAtTime(880, ctx.currentTime);
             osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.05);
             osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.1);
             g.gain.setValueAtTime(0.25, ctx.currentTime);
             g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
             osc.start(); osc.stop(ctx.currentTime + 0.4);
         } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
     }
 
 
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
                 if (_burstEl) { const _r = _burstEl.getBoundingClientRect(); microBurst(_r.left + _r.width / 2, _r.top + _r.height / 2); }

                 if (window.FocusAISocial && typeof window.FocusAISocial.postActivity === 'function') {
                     window.FocusAISocial.postActivity(`"${task.text}" görevini tamamladı ✅`);
                 }
             }
             
             // 1. KLASİK SİNERJİ: Görev doğrudan bir alışkanlığın alt göreviyse
             // (willComplete=false için de çağrılmalı, yoksa görev geri alındığında
             // bağlı alışkanlığın tiki hiç kalkmıyordu — kalıcı desync.)
             if (task.parentHabit) {
                 checkSynergy(task.parentHabit, task.date, willComplete);
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
             updateGlobalStreak();
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
                 const dateStr = formatDateToString(checkDate);
                 const conflict = hasTimeConflict(dateStr, timeToMins(start), timeToMins(end));
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
     const timeEnd = smartData.parsedTime ? addOneHour(timeStart) : taskTimeEnd.value;
 
     // Eğer NLP "yarın" gibi bir tarih bulduysa o tarihi, bulamadıysa bugünü kullan
     const taskDateStr = smartData.parsedDate ? smartData.parsedDate : formatDateToString(new Date());
 
     const startMins = timeToMins(timeStart);
     const endMins = timeToMins(timeEnd);

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
     const nextSlot = getNextAvailableTimeSlot(taskDateStr, timeToMins(timeEnd) - timeToMins(timeStart) || 60);
     updateEndPicker('task-time-start', nextSlot.start);
     updateEndPicker('task-time-end', nextSlot.end);

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
                 const todayStr = formatDateToString(new Date());
                 const nextSlot = getNextAvailableTimeSlot(todayStr);
                 updateEndPicker('task-time-start', nextSlot.start);
                 updateEndPicker('task-time-end', nextSlot.end);
                 const inp = document.getElementById('task-input'); if(inp) inp.focus();
             }
         });
     }
 
     const editTaskModal       = document.getElementById('edit-task-modal');
     const editTaskIdInput     = document.getElementById('edit-task-id');
     const editTaskTextInput   = document.getElementById('edit-task-text');
     const editTaskParentSelect= document.getElementById('edit-task-parent-habit');
     const editTaskPriority    = document.getElementById('edit-task-priority');
     const editTaskCategory    = document.getElementById('edit-task-category');
     const editTaskStart       = document.getElementById('edit-task-start');
     const editTaskEnd         = document.getElementById('edit-task-end');
     const editTaskTimeError   = document.getElementById('edit-task-time-error');
     const saveEditTaskBtn     = document.getElementById('save-edit-task-btn');
     const cancelEditTaskBtn   = document.getElementById('cancel-edit-task-btn');
     const closeEditTaskBtn    = document.getElementById('close-edit-task-btn');
 
     function closeEditModal() {
         if (editTaskModal) editTaskModal.classList.add('hidden');
         if (editTaskTimeError) editTaskTimeError.style.display = 'none';
     }
 
     window.editTask = function(id) {
         const task = tasks.find(t => String(t.id) === String(id));
         if (!task) return;
 
         editTaskIdInput.value       = task.id;
         editTaskTextInput.value     = task.text;
         if(editTaskParentSelect) editTaskParentSelect.value = task.parentHabit || "";
         editTaskPriority.value      = task.priority  || 'medium';
         editTaskCategory.value      = task.category  || 'kisisel';
         editTaskStart.value         = task.timeStart || '09:00';
         editTaskEnd.value           = task.timeEnd   || '10:00';
         editTaskTimeError.style.display = 'none';
 
         editTaskModal.classList.remove('hidden');
         editTaskTextInput.focus();
     };
 
     if (saveEditTaskBtn) {
         saveEditTaskBtn.addEventListener('click', () => {
             const id       = editTaskIdInput.value;
             const newText  = editTaskTextInput.value.trim();
             const newParent = editTaskParentSelect ? editTaskParentSelect.value : "";
             const newStart = editTaskStart.value;
             const newEnd   = editTaskEnd.value;
 
             if (!newText) {
                 editTaskTextInput.focus();
                 return;
             }
             if (timeToMins(newStart) >= timeToMins(newEnd)) {
                 editTaskTimeError.style.display = 'block';
                 return;
             }
             editTaskTimeError.style.display = 'none';
 
             const task = tasks.find(t => String(t.id) === String(id));

             // --- DÜZENLEME EKRANI HEDEF TARİH SINIRI KONTROLÜ (DÜZELTİLDİ) ---
             const configGoalSelect = document.getElementById('edit-task-parent-goal');
             const checkedParentGoal = configGoalSelect ? configGoalSelect.value : (task ? task.parentGoal : '');
             if (checkedParentGoal && task && !checkGoalDateBoundaries(checkedParentGoal, task.date)) {
                 return;
             }

             if (!task) return;
 
             const oldDate = task.date;
 
             task.text      = newText;
             task.parentHabit = newParent;
             task.priority  = editTaskPriority.value;
             task.category  = editTaskCategory.value;
             task.timeStart = newStart;
             task.timeEnd   = newEnd;
 
             if (calendarEvents[oldDate]) {
                 const ev = calendarEvents[oldDate].find(e => String(e.id) === String(id));
                 if (ev) {
                     ev.text      = newText;
                     ev.parentHabit = newParent;
                     ev.timeStart = newStart;
                     ev.timeEnd   = newEnd;
                     ev.priority  = task.priority;
                 }
             }
 
             saveTasks();
             renderTasks();
             if (renderCalendarRef)  renderCalendarRef();
             if (renderEventsRef)    renderEventsRef();
             if (typeof window.renderWeeklyView === 'function') window.renderWeeklyView();
             if (typeof window.renderDailyView  === 'function') window.renderDailyView();
 
             closeEditModal();
         });
     }
 
     if (cancelEditTaskBtn) cancelEditTaskBtn.addEventListener('click', closeEditModal);
     if (closeEditTaskBtn)  closeEditTaskBtn.addEventListener('click',  closeEditModal);
 
     if (editTaskModal) {
         editTaskModal.addEventListener('click', (e) => {
             if (e.target === editTaskModal) closeEditModal();
         });
     }
 
     if (editTaskStart) {
         editTaskStart.addEventListener('change', () => {
             if (editTaskEnd) {
                 editTaskEnd.value = addOneHour(editTaskStart.value);
             }
             const ok = timeToMins(editTaskStart.value) < timeToMins(editTaskEnd.value);
             editTaskTimeError.style.display = ok ? 'none' : 'block';
         });
     }
     if (editTaskEnd) {
         editTaskEnd.addEventListener('change', () => {
             const ok = timeToMins(editTaskStart.value) < timeToMins(editTaskEnd.value);
             editTaskTimeError.style.display = ok ? 'none' : 'block';
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

     function _setFlatpickrDate(el, date) {
         if (!el) return;
         if (el._flatpickr) { el._flatpickr.setDate(date, false); }
         else { el.value = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
     }
     function _getDateFromFlatpickr(el) {
         if (!el) return null;
         if (el._flatpickr && el._flatpickr.selectedDates.length) return el._flatpickr.selectedDates[0];
         const v = el.value;
         if (!v) return null;
         const [y, m, d] = v.split('-').map(Number);
         return new Date(y, m - 1, d);
     }

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
         _setFlatpickrDate(habitStartDateInput, today);
         const endDate = new Date(today);
         endDate.setDate(today.getDate() + 29); // 30 gün - 1
         setTimeout(() => {
             _setFlatpickrDate(habitEndDateInput, endDate);
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
         const start = _getDateFromFlatpickr(habitStartDateInput);
         const days = parseInt(habitTargetInput.value) || 30;
         if (!start) return;
         const end = new Date(start);
         end.setDate(end.getDate() + days - 1);
         _setFlatpickrDate(habitEndDateInput, end);
         if (hmSyncHint) hmSyncHint.textContent = '';
     }
     function _syncTargetFromEndDate() {
         const start = _getDateFromFlatpickr(habitStartDateInput);
         const end = _getDateFromFlatpickr(habitEndDateInput);
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
        else { habitStartDateInput.value = toInputDate(formatDateToString(new Date())); }
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
 
     function getChallengeDays(habit) {
         const days = [];
         const todayStr = formatDateToString(new Date());
         const todayDate = new Date();
         todayDate.setHours(0,0,0,0);
         
         // GÜNCELLEME: Gün-Ay-Yıl formatını güvenli parçalayarak nesneye dönüştürüyoruz
         const [sd, sm, sy] = habit.startDate.split('-').map(Number);
         let currentDate = new Date(sy, sm - 1, sd); 
         currentDate.setHours(0,0,0,0);
         
         for (let i = 0; i < habit.targetDays; i++) {
             const dateStr = formatDateToString(currentDate);
             const isCompleted = !!habit.history[dateStr];
             const isToday = dateStr === todayStr;
             const isFuture = currentDate > todayDate; 
             
             let status = '';
             if (isCompleted) status = 'completed';
             else if (isToday) status = 'today';
             else if (!isFuture && !isCompleted) status = 'missed';
             
             const lockedClass = isFuture ? 'locked' : '';
             days.push({ dayNumber: i + 1, dateStr: dateStr, status: status, locked: lockedClass });
             currentDate.setDate(currentDate.getDate() + 1);
         }
         return days;
     }
 
     function saveHabits() { 
         Store.habits.set(habits); 
         populateParentHabitSelects(); 
     }
 
     function renderHabits() {
         habitList.innerHTML = '';
         const todayStr = formatDateToString(new Date());

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
             
             const challengeDays = getChallengeDays(habit);
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
                     checkHabitMilestones(habit, oldCount, Object.keys(habit.history).length);
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
                 checkHabitMilestones(habit, oldCount, Object.keys(habit.history).length);
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
         const startDate = habitStartDateInput.value ? fromInputDate(habitStartDateInput.value) : formatDateToString(new Date());
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
 
     let timerInterval;
     let totalTime = 25 * 60;
     let timeLeft = 25 * 60;
     let isRunning = false;
     let idleTimeout;
     let endTime = 0; // Arka plan koruması için hedeflenen bitiş zamanını tutacak
     let pomodoroCount = 0; // Pomodoro döngüsünü sayacak

     // Sayfa yenilenince zamanlayıcının sıfırlanmaması için çalışma durumunu localStorage'a
     // yansıtıyoruz (endTime mutlak zaman damgası olduğu için yenileme sonrası kalan süre
     // güvenle yeniden hesaplanabiliyor). Bulut senkronuna dahil olmayan, sadece bu cihaza
     // özgü geçici bir anahtar — FocusStorage.set bunu otomatik olarak fark edip görmezden gelir.
     function _saveTimerRunState() {
         const activeBtn = document.querySelector('.mode-btn.active');
         const mode = activeBtn ? activeBtn.getAttribute('data-mode') : 'pomodoro';
         FocusStorage.set('timer_run_state', { isRunning, endTime, totalTime, timeLeft, mode, loopCount: pomodoroCount });
     }
     function _clearTimerRunState() {
         FocusStorage.set('timer_run_state', null);
     }
     // Çalışıyorsa / duraklatılmış ama ilerlemesi varsa durumu kaydet, taze/bitmiş durumdaysa temizle.
     function _syncTimerRunState() {
         if (isRunning) { _saveTimerRunState(); }
         else if (timeLeft > 0 && timeLeft !== totalTime) { _saveTimerRunState(); }
         else { _clearTimerRunState(); }
     }
     // Zamanlayıcı bir grup seansından ("Odaklan" butonu) başlatıldıysa o seansın id'sini tutar —
     // presence'a eklenip grup takviminde "şu an bu seansa kimler odaklanıyor" gösterilebilsin diye.
     let _activeGroupSessionId = null;
     // Sunucu tarafı odak XP doğrulaması (057): mevcut geri sayımın sunucuda
     // damgalanmış seans kimliği. Taze bir başlangıçta start_focus_session()
     // ile doldurulur, bitişte finish_focus_session()'a taşınıp sıfırlanır.
     let _serverFocusSessionId = null;
     // Etkileşim doğrulaması (059): en son gerçek fare/klavye/dokunma zamanı +
     // seans boyunca periyodik heartbeat interval'ı. "Sekmeyi açık bırakıp
     // beklemek" açığını kapatmak için — heartbeat yalnızca gerçek etkileşim
     // varken ve sekme görünür/odaklıyken gönderilir (bkz. _startFocusHeartbeat).
     let _lastUserActivityAt = Date.now();
     let _focusHeartbeatInterval = null;
     ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
         document.addEventListener(evt, () => { _lastUserActivityAt = Date.now(); }, { passive: true });
     });
     function _startFocusHeartbeat() {
         _stopFocusHeartbeat();
         _focusHeartbeatInterval = setInterval(() => {
             if (!_serverFocusSessionId || !window.FocusXP) return;
             const idleMs = Date.now() - _lastUserActivityAt;
             if (document.visibilityState !== 'visible' || !document.hasFocus() || idleMs > 90000) return; // etkileşimsiz aralık sayılmaz
             window.FocusXP.heartbeat(_serverFocusSessionId);
         }, 45000);
     }
     function _stopFocusHeartbeat() {
         if (_focusHeartbeatInterval) { clearInterval(_focusHeartbeatInterval); _focusHeartbeatInterval = null; }
     }
     let alarmInterval = null;
     const alarmSound = {
         _playing: false,
         play() {
             if (this._playing) return Promise.resolve();
             this._playing = true;
             this._playBeep();
             alarmInterval = setInterval(() => this._playBeep(), 900);
             return Promise.resolve();
         },
         _playBeep() {
             try {
                 const ctx = new (window.AudioContext || window.webkitAudioContext)();
                 [880, 0, 880, 0, 1100].forEach((freq, i) => {
                     if (!freq) return;
                     const osc = ctx.createOscillator();
                     const g = ctx.createGain();
                     osc.connect(g); g.connect(ctx.destination);
                     osc.frequency.value = freq;
                     const t = ctx.currentTime + i * 0.12;
                     g.gain.setValueAtTime(0.3, t);
                     g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                     osc.start(t); osc.stop(t + 0.1);
                 });
             } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
         },
         pause()  { this._playing = false; clearInterval(alarmInterval); },
         get currentTime() { return 0; },
         set currentTime(v) {}
     };
 
     // Temsilci Dinleyici: Butonlar yenilense bile tıklamayı her zaman yakalar
     document.addEventListener('click', (e) => {
         if (e.target.closest('#premium-modal-confirm-btn') || e.target.closest('#premium-modal-cancel-btn') || e.target.closest('.modal-overlay')) {
             alarmSound.pause();
             alarmSound.currentTime = 0;
         }
     });
 
     const minutesDisplay = document.getElementById('minutes');
     const secondsDisplay = document.getElementById('seconds');
     const startBtn = document.getElementById('start-btn');
     const pauseBtn = document.getElementById('pause-btn');
     const resetBtn = document.getElementById('reset-btn');
     const finishEarlyBtn = document.getElementById('finish-early-btn');
     const modeBtns = document.querySelectorAll('.mode-btn');
     const timerCircle = document.querySelector('.timer-circle');
     const timerProgressRing = document.getElementById('timer-progress-ring');
     const nextStageBtn = document.getElementById('next-stage-btn');

     // Çember rengi moda göre değişsin: odaklanma (pomodoro/derin çalışma) mor,
     // kısa mola yeşil, uzun mola turuncu — bkz. style.css .timer-mode-*.
     function applyTimerModeColor(mode) {
         if (!timerCircle) return;
         timerCircle.classList.remove('timer-mode-focus', 'timer-mode-short', 'timer-mode-long');
         if (mode === 'pomodoro' || mode === 'ultradian') timerCircle.classList.add('timer-mode-focus');
         else if (mode === 'shortBreak') timerCircle.classList.add('timer-mode-short');
         else if (mode === 'longBreak') timerCircle.classList.add('timer-mode-long');
     }
     applyTimerModeColor(document.querySelector('.mode-btn.active')?.getAttribute('data-mode') || 'pomodoro');

     const focusQuotes = [
         "Başlamak için mükemmel olmak zorunda değilsin, ama mükemmel olmak için başlamak zorundasın.",
         "Zorluklar, başarının süsüdür. Odaklan ve aş.",
         "Odağını nereye verirsen, enerjin oraya akar.",
         "Küçük ve istikrarlı adımlar, en büyük dağları aşırır.",
         "Başarı, her gün tekrarlanan küçük çabaların toplamıdır."
     ];
     const quoteDisplay = document.getElementById('focus-quote');
     setInterval(() => {
         quoteDisplay.style.opacity = 0;
         setTimeout(() => {
             quoteDisplay.textContent = `"${focusQuotes[Math.floor(Math.random() * focusQuotes.length)]}"`;
             quoteDisplay.style.opacity = 1;
         }, 1400);
     }, 15000);
 
     function resetIdleTimer() {
         clearTimeout(idleTimeout);
         document.body.classList.remove('ghost-mode-active');
         // Hayalet Mod SADECE kullanıcı "Odak Modu"na bilinçli olarak bastığında
         // (focus-mode-active) devreye girmeli. Önceden sadece `isRunning` kontrol
         // ediliyordu; bu da zamanlayıcı Odak Modu'na hiç girilmeden başlatılır
         // başlatılmaz, 3sn hareketsizlikte ekranın "sadece süre ve söz kalacak
         // şekilde" soluklaşmasına yol açıyordu.
         if (isRunning && document.body.classList.contains('focus-mode-active')) {
             idleTimeout = setTimeout(() => {
                 // Hayalet Mod sadece Zamanlayıcı sekmesindeyken uygulanmalı. Bu zamanlayıcı
                 // (mousemove/keydown gibi) TÜM sayfada global dinleyicilere bağlı olduğundan,
                 // kullanıcı zamanlayıcı çalışırken başka bir sekmede (örn. Sosyal) 3sn hareketsiz
                 // kalırsa, oradaki .section-header (sıralama/seri listesi başlığı gibi) da
                 // yanlışlıkla soluklaşıyordu — .ghost-mode-active kuralı sekmeye özgü değil, body
                 // seviyesinde global.
                 const timerTab = document.getElementById('zamanlayici');
                 if (timerTab && timerTab.classList.contains('active') && document.body.classList.contains('focus-mode-active')) {
                     document.body.classList.add('ghost-mode-active');
                 }
             }, 3000);
         }
     }
 
     ['mousemove', 'mousedown', 'keydown', 'touchstart'].forEach(evt => {
         document.addEventListener(evt, resetIdleTimer);
     });
 
     const focusModeBtn = document.getElementById('focus-mode-btn');
     const focusExitBtn = document.getElementById('focus-exit-btn');

     // Sosyal'daki "odak kalkanı" (sohbet + sıralama/seri kartının soluklaşması)
     // sadece kullanıcı gerçekten tam ekran Odak Modu'na girmişse/çıkmışsa yeniden
     // değerlendirilmeli — zamanlayıcının salt çalışıyor olması yeterli değil.
     function _syncSocialHushWithFocusMode() {
         if (!(window.FocusAISocial && typeof window.FocusAISocial.setFocusState === 'function')) return;
         const activeModeBtn = document.querySelector('.mode-btn.active');
         const activeMode = activeModeBtn ? activeModeBtn.getAttribute('data-mode') : null;
         const isFocusMode = isRunning && (activeMode === 'pomodoro' || activeMode === 'ultradian');
         window.FocusAISocial.setFocusState(isFocusMode, activeMode, isFocusMode ? _activeGroupSessionId : null);
     }

     function enterFocusMode() {
         document.body.classList.add('focus-mode-active');
         resetIdleTimer();
         _syncSocialHushWithFocusMode();
     }
     function exitFocusMode() {
         document.body.classList.remove('focus-mode-active');
         document.body.classList.remove('ghost-mode-active');
         clearTimeout(idleTimeout);
         _syncSocialHushWithFocusMode();
     }

     focusModeBtn.addEventListener('click', () => {
         if (document.body.classList.contains('focus-mode-active')) exitFocusMode();
         else enterFocusMode();
     });
     if (focusExitBtn) focusExitBtn.addEventListener('click', exitFocusMode);
 
    // ============ ODAK SESLERİ MİKSER SİSTEMİ + SCENE BAR → script-ambient-sounds.js dosyasına taşındı ============
 
 function updateNavBadge() {
     const badge = document.getElementById('timer-nav-badge');
     const dockIcon = document.getElementById('dock-timer-icon');
     if (isRunning) {
         const m = Math.floor(timeLeft / 60);
         const s = timeLeft % 60;
         const timeStr = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
         if (badge) {
             badge.innerHTML = `<span class="tnb-dot"></span>${timeStr}`;
             badge.style.display = 'inline-flex';
         }
         // Dock ikonu (gerçek görünür sidebar) çalışırken yeşile döner.
         if (dockIcon) dockIcon.classList.add('timer-running');
     } else {
         if (badge) badge.style.display = 'none';
         if (dockIcon) dockIcon.classList.remove('timer-running');
     }
     _refreshDockTimerHoverPopup(); // açık duruyorsa (hover'da) içeriğini canlı güncelle
 }

 // Dock zamanlayıcı ikonunun üzerine gelince açılan popup — hangi sekmede olunursa olsun
 // "kaçıncı dakikadasın" bilgisini gösterir. .dock'un overflow-y:auto'su normal .tip
 // tooltip'ini (dock dışına taşan kısmını) kırptığı için ayrı, position:fixed bir katman.
 const _dockTimerIcon  = document.getElementById('dock-timer-icon');
 const _dockTimerPopup = document.getElementById('dock-timer-hover-popup');
 const _dockTimerPopupTitle = document.getElementById('dock-timer-hover-title');
 const _dockTimerPopupTime  = document.getElementById('dock-timer-hover-time');

 function _refreshDockTimerHoverPopup() {
     if (!_dockTimerPopup || _dockTimerPopup.classList.contains('hidden')) return;
     // Sadece zamanlayıcı gerçekten çalışırken popup göster — duraklatılmış/taze durumda
     // hover'da hiçbir şey çıkmamalı.
     if (!isRunning) {
         _dockTimerPopup.classList.add('hidden');
         return;
     }
     const activeBtn = document.querySelector('.mode-btn.active');
     const modeType = activeBtn ? activeBtn.getAttribute('data-mode') : 'pomodoro';
     const modeLabel = (modeType === 'shortBreak') ? 'Kısa Mola' : (modeType === 'longBreak') ? 'Uzun Mola' : 'Odaklanma';
     const m = Math.floor(timeLeft / 60), s = timeLeft % 60;
     if (_dockTimerPopupTitle) _dockTimerPopupTitle.textContent = `${modeLabel} çalışıyor`;
     if (_dockTimerPopupTime)  _dockTimerPopupTime.textContent  = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} kaldı`;
 }

 if (_dockTimerIcon && _dockTimerPopup) {
     _dockTimerIcon.addEventListener('mouseenter', () => {
         if (!isRunning) return; // çalışmıyorken popup hiç gösterilmez
         const rect = _dockTimerIcon.getBoundingClientRect();
         _dockTimerPopup.style.top = Math.round(rect.top) + 'px';
         _dockTimerPopup.style.left = Math.round(rect.right + 10) + 'px';
         _dockTimerPopup.classList.remove('hidden');
         _refreshDockTimerHoverPopup();
     });
     _dockTimerIcon.addEventListener('mouseleave', () => {
         _dockTimerPopup.classList.add('hidden');
     });
 }
 
     function updateTimerDisplay() {
         const m = Math.floor(timeLeft / 60); const s = timeLeft % 60;
         minutesDisplay.textContent = String(m).padStart(2, '0');
         secondsDisplay.textContent = String(s).padStart(2, '0');
         updateNavBadge();
         
         // --- YENİ EKLENEN: ÇEMBER ERİME ANİMASYONU ---
         if (timerProgressRing) {
             const circumference = 691.15;
             const percent = timeLeft / totalTime;
             const offset = circumference - (percent * circumference);
             timerProgressRing.style.strokeDashoffset = offset;
         }
         updateTimerProfileBarVisibility();
     }
 
     function startTimer() {
         if (!isRunning && timeLeft > 0) {
             
             if ("Notification" in window && Notification.permission === "default") {
                 Notification.requestPermission();
             }
 
             isRunning = true;
             startBtn.classList.add('hidden'); pauseBtn.classList.remove('hidden');
             if (finishEarlyBtn) finishEarlyBtn.classList.remove('hidden'); // Erken bitirme butonunu göster
             timerCircle.classList.add('running'); timerCircle.classList.remove('paused');
             resetIdleTimer();
 
             const activeMode = document.querySelector('.mode-btn.active').getAttribute('data-mode');
             if (activeMode === 'shortBreak' || activeMode === 'longBreak') {
                 timerCircle.classList.add('breathing-active');
             }

             // Sunucu tarafı odak XP doğrulaması (057): taze bir odak başlangıcında
             // (mola değil, ve daha önce duraklatılmış bir seansın devamı değil)
             // sunucuda zaman damgalı bir seans aç. Duraklat/devam et arasında
             // aynı seans kimliği korunur — resetTimer/mod değişimi sıfırlar.
             if ((activeMode === 'pomodoro' || activeMode === 'ultradian') && timeLeft === totalTime && !_serverFocusSessionId) {
                 if (window.FocusXP && typeof window.FocusXP.startFocusSession === 'function') {
                     window.FocusXP.startFocusSession().then(id => {
                         _serverFocusSessionId = id;
                         _lastUserActivityAt = Date.now(); // seans başlangıcı = etkileşim anı
                         _startFocusHeartbeat();
                     });
                 }
             }

             // Grup panellerindeki "Canlı Çalışan Üyeler" gerçek odaklanma durumunu
             // yansıtsın diye sadece odaklanma modlarında (mola değil) presence'ı işaretle.
             // Bir grup seansından başlatıldıysa sessionId de eklenir — böylece grup takviminde
             // "şu an bu seansa kimler odaklanıyor" canlı olarak gösterilebilir.
             if (window.FocusAISocial && typeof window.FocusAISocial.setFocusState === 'function') {
                 const isFocusMode = activeMode === 'pomodoro' || activeMode === 'ultradian';
                 window.FocusAISocial.setFocusState(isFocusMode, activeMode, isFocusMode ? _activeGroupSessionId : null);
             }

             endTime = Date.now() + (timeLeft * 1000);
             // Sıfırla/Sıradaki Aşama görünürlüğünü, dock ikonunun yeşile dönmesini ve kaydedilen
             // çalışma durumunu (endTime dahil) setInterval'ın ilk tick'ini (≈1sn) beklemeden hemen
             // güncelle. NOT: bu çağrı endTime hesaplanmadan ÖNCE yapılırsa, kaydedilen durum eski/sıfır
             // bir endTime taşır — kullanıcı tam o anda sayfayı yenilerse zamanlayıcı sıfırlanırdı.
             updateTimerDisplay();
 
             timerInterval = setInterval(() => {
                 timeLeft = Math.round((endTime - Date.now()) / 1000);
                 
                 if (timeLeft <= 0) {
                     timeLeft = 0; 
                     updateTimerDisplay(); 
                     
                     clearInterval(timerInterval); isRunning = false;
                     if (window.FocusAISocial && typeof window.FocusAISocial.setFocusState === 'function') {
                         window.FocusAISocial.setFocusState(false, null);
                     }
                     _activeGroupSessionId = null;
                     timerCircle.classList.remove('running');
                     timerCircle.classList.remove('paused');
                     timerCircle.classList.remove('breathing-active');
                     startBtn.classList.remove('hidden'); pauseBtn.classList.add('hidden');
                     
                     clearTimeout(idleTimeout); 
                     document.body.classList.remove('ghost-mode-active');
                     
                     alarmSound.play().catch(e => console.log("Tarayıcı sesi engelledi."));
                     if ("Notification" in window && Notification.permission === "granted") {
                         new Notification("Zamanlayıcı Bitti!", { 
                             body: "Odaklanma veya mola süren tamamlandı.",
                             icon: "https://cdn-icons-png.flaticon.com/512/4305/4305432.png"
                         });
                     }
                     
                     const activeBtn = document.querySelector('.mode-btn.active');
                     const modeType = activeBtn.getAttribute('data-mode'); 
                     
                     if(modeType === 'pomodoro' || modeType === 'ultradian') {
                         const modeMins = parseInt(activeBtn.getAttribute('data-time'));
                         totalFocusMinutes += modeMins;
                         FocusStorage.set('focus_minutes', totalFocusMinutes);
                         if (window.FocusXP) window.FocusXP.finishFocusSession(_serverFocusSessionId, modeMins);
                         _serverFocusSessionId = null;
                         _stopFocusHeartbeat();

                         if (window.FocusAISocial && typeof window.FocusAISocial.postActivity === 'function') {
                             window.FocusAISocial.postActivity(`${modeMins} dakika odaklandı ⏱️`);
                         }

                         // Günlük odak ve kategori geçmişini hafızaya ekleyen akıllı motor
                         const todayDateStr = formatDateToString(new Date());
                         let focusHistory = FocusStorage.get('focus_history', {});
                         focusHistory[todayDateStr] = (focusHistory[todayDateStr] || 0) + modeMins;
                         FocusStorage.set('focus_history', focusHistory);
 
                         let activeCategory = 'kategorisiz';
                         if (activeFocusTask) {
                             if (activeFocusTask !== 'highlight-task') {
                                 const focusedTask = tasks.find(t => String(t.id) === String(activeFocusTask));
                                 if (focusedTask && focusedTask.category) activeCategory = focusedTask.category;
                             } else {
                                 activeCategory = 'kisisel';
                             }
                         }
                         let categoryFocus = FocusStorage.get('category_focus', {});
                         if (!categoryFocus[todayDateStr]) categoryFocus[todayDateStr] = {};
                         categoryFocus[todayDateStr][activeCategory] = (categoryFocus[todayDateStr][activeCategory] || 0) + modeMins;
                         FocusStorage.set('category_focus', categoryFocus);
                         // Saatlik odak dağılımı için saat kaydı
                         const currentHour = String(new Date().getHours()).padStart(2, '0');
                         let focusHours = FocusStorage.get('focus_hours', {});
                         if (!focusHours[todayDateStr]) focusHours[todayDateStr] = {};
                         focusHours[todayDateStr][currentHour] = (focusHours[todayDateStr][currentHour] || 0) + modeMins;
                         FocusStorage.set('focus_hours', focusHours);
                         if(renderStatisticsRef && document.getElementById('istatistikler').classList.contains('active')) renderStatisticsRef();
                         if(renderSocialStatsRef && document.getElementById('arkadaslar').classList.contains('active')) renderSocialStatsRef();
 
                         // --- HEDEFE ODAK SÜRESİ EKLEME ---
                         if(activeFocusTask && activeFocusTask !== 'highlight-task') {
                             const focusedTask = tasks.find(t => String(t.id) === String(activeFocusTask));
                             if(focusedTask && focusedTask.parentGoal) {
                                 const goalToCredit = goals.find(g => String(g.id) === String(focusedTask.parentGoal));
                                 if(goalToCredit) {
                                     goalToCredit.focusTime = (goalToCredit.focusTime || 0) + modeMins;
                                     Store.goals.set(goals);
                                     if(typeof renderGoals === 'function') renderGoals();
                                     if(!document.getElementById('goal-details-modal').classList.contains('hidden') && document.getElementById('detail-active-goal-id').value === String(goalToCredit.id)) {
                                         updateGoalDetailsUI(goalToCredit.id);
                                     }
                                 }
                             }
                         }
                         // ----------------------------------------------
                         // ----------------------------------------------
                         
                         // Sonraki mola türünü belirle
                         let breakType = 'shortBreak';
                         if(modeType === 'ultradian') {
                             breakType = 'longBreak';
                         } else {
                             pomodoroCount++;
                             const tc = timerSettings.targetCycles || 4;
                             let currentLoop = pomodoroCount % tc === 0 ? tc : pomodoroCount % tc;
                             const loopSpan = document.getElementById('loop-count');
                             if (loopSpan) loopSpan.textContent = currentLoop;
                             if (pomodoroCount % tc === 0) breakType = 'longBreak';
                         }
 
                         // --- YENİ: GÖREV SEÇİLİYSE SORU SOR, DEĞİLSE DİREKT MOLAYA GEÇ ---
                         if(activeFocusTask) {
                             window.__nextBreakMode = breakType;
                             document.getElementById('task-complete-check-modal').classList.remove('hidden');
                         } else {
                             if (timerSettings.autoStart) {
                                 // Otomatik geçiş: sessizce moda geç ve başlat
                                 document.querySelector(`.mode-btn[data-mode="${breakType}"]`).click();
                                 setTimeout(() => startTimer(), 300);
                             } else {
                                 if (breakType === 'longBreak') {
                                     showPremiumModal({ title: 'Harika!', message: 'Uzun bir molayı hak ettin.', type: 'success' });
                                 } else {
                                     showPremiumModal({ title: 'Tebrikler!', message: 'Bir seansı tamamladın! Şimdi kısa mola zamanı.', type: 'success' });
                                 }
                                 document.querySelector(`.mode-btn[data-mode="${breakType}"]`).click();
                             }
                         }

                     } else {
                         if (timerSettings.autoStart) {
                             // Mola bitti, otomatik odaklanmaya geç
                             document.querySelector('.mode-btn[data-mode="pomodoro"]').click();
                             setTimeout(() => startTimer(), 300);
                         } else {
                             showPremiumModal({ title: 'Mola Bitti!', message: 'Tekrar odaklanma zamanı. Hadi başlayalım!', type: 'info' });
                             document.querySelector('.mode-btn[data-mode="pomodoro"]').click();
                         }
                     }
                 } else {
                     updateTimerDisplay(); 
                 }
             }, 1000);
         }
     }
 
     function pauseTimer() {
         clearInterval(timerInterval); isRunning = false;
         if (window.FocusAISocial && typeof window.FocusAISocial.setFocusState === 'function') {
             window.FocusAISocial.setFocusState(false, null);
         }
         startBtn.classList.remove('hidden'); pauseBtn.classList.add('hidden');
         timerCircle.classList.add('paused');
         timerCircle.classList.remove('breathing-active'); // Duraklatıldığında animasyonu kaldır
         clearTimeout(idleTimeout); document.body.classList.remove('ghost-mode-active');
         updateNavBadge();
         _syncTimerRunState(); // duraklatılan ilerlemeyi hemen kaydet — aksi halde yenilemede eski "çalışıyor" durumu geri gelirdi
     }

     function resetTimer() {
         pauseTimer(); const active = document.querySelector('.mode-btn.active');
         totalTime = parseInt(active.getAttribute('data-time')) * 60;
         timeLeft = totalTime;
         updateTimerDisplay();
         if (finishEarlyBtn) finishEarlyBtn.classList.add('hidden'); // Sıfırlanınca butonu gizle
         _activeGroupSessionId = null;
         _serverFocusSessionId = null; // XP verilmeden vazgeçildi — sunucudaki açık seans 6 saat sonra kendiliğinden temizlenir
         _stopFocusHeartbeat();
     }

     // Uygulamanın kendi içinden (goToNextStage, otomatik faz geçişleri vb.) zaten
     // kendi onayını almış bir .mode-btn .click() tetiklendiğinde ikinci bir "emin misin"
     // sorusu çıkmasın diye bu bayrak bir sonraki tıklamayı sorgusuz geçirir.
     let _skipModeSwitchConfirm = false;

     function _switchTimerMode(btn) {
         _activeGroupSessionId = null; // kullanıcı elle başka bir moda geçti — artık grup seansına bağlı değil
         _serverFocusSessionId = null; // mod değişti — eski seans XP'siz kaldı, sunucuda 6 saat sonra kendiliğinden temizlenir
         _stopFocusHeartbeat();
         modeBtns.forEach(b => b.classList.remove('active')); btn.classList.add('active');
         pauseTimer();
         totalTime = parseInt(btn.getAttribute('data-time')) * 60;
         timeLeft = totalTime;
         updateTimerDisplay();
         applyTimerModeColor(btn.getAttribute('data-mode'));
     }

     modeBtns.forEach(btn => {
         // gf-* overlay butonları (data-phase) bireysel zamanlayıcıyı etkilememelidir
         if (btn.hasAttribute('data-phase') && !btn.hasAttribute('data-mode')) return;
         btn.addEventListener('click', () => {
             // Zaten aktif olan moda tekrar basmak hiçbir şeyi değiştirmemeli.
             if (btn.classList.contains('active')) return;
             if (_skipModeSwitchConfirm) {
                 _skipModeSwitchConfirm = false;
                 _switchTimerMode(btn);
                 return;
             }
             // Bu aşamada kaydedilmiş ilerleme varsa (sıfırlama butonuyla aynı mantık),
             // mod değiştirmeden önce kullanıcıya sor — aksi halde sessizce siliniyordu.
             // timeLeft === 0 (süre doğal olarak bittiğinde otomatik mola/odak geçişi) hariç —
             // o durumda seans zaten kredilendirilmiş, sorulmadan geçilmeli.
             if (isRunning || (timeLeft > 0 && timeLeft !== totalTime)) {
                 showPremiumModal({
                     title: 'Modu Değiştir',
                     message: 'Bu aşamada kaydettiğin ilerleme silinecek. Moda geçmek istediğine emin misin?',
                     type: 'warning',
                     showCancel: true,
                     confirmText: 'Geç',
                     cancelText: 'Vazgeç',
                     onConfirm: () => _switchTimerMode(btn)
                 });
             } else {
                 _switchTimerMode(btn);
             }
         });
     });

     startBtn.addEventListener('click', startTimer);
     pauseBtn.addEventListener('click', pauseTimer);

     // Sıfırlama, o ana kadar bu aşamada geçen süreyi siler — sadece kaybedilecek
     // bir ilerleme varsa (taze/hiç başlamamış bir sayaçta gereksiz yere sormadan) uyarı gösterilir.
     resetBtn.addEventListener('click', () => {
         if (timeLeft !== totalTime) {
             showPremiumModal({
                 title: 'Zamanlayıcıyı Sıfırla',
                 message: 'Bu aşamada kaydettiğin ilerleme silinecek. Sıfırlamak istediğine emin misin?',
                 type: 'warning',
                 showCancel: true,
                 confirmText: 'Sıfırla',
                 cancelText: 'Vazgeç',
                 onConfirm: resetTimer
             });
         } else {
             resetTimer();
         }
     });

     // Erken bitirme ve "Sıradaki Aşama"nın ortak kullandığı kredilendirme mantığı:
     // o ana kadar odaklanmada geçen dakikayı istatistiklere/XP'ye/hedefe işler.
     function creditFocusMinutes(minutesSpent) {
         totalFocusMinutes += minutesSpent;
         FocusStorage.set('focus_minutes', totalFocusMinutes);
         if (window.FocusXP) window.FocusXP.finishFocusSession(_serverFocusSessionId, minutesSpent);
         _serverFocusSessionId = null;
         _stopFocusHeartbeat();

         const todayDateStr = formatDateToString(new Date());
         let focusHistory = FocusStorage.get('focus_history', {});
         focusHistory[todayDateStr] = (focusHistory[todayDateStr] || 0) + minutesSpent;
         FocusStorage.set('focus_history', focusHistory);

         let activeCategory = 'kategorisiz';
         if (activeFocusTask) {
             if (activeFocusTask !== 'highlight-task') {
                 const focusedTask = tasks.find(t => String(t.id) === String(activeFocusTask));
                 if (focusedTask && focusedTask.category) activeCategory = focusedTask.category;
             } else {
                 activeCategory = 'kisisel';
             }
         }
         let categoryFocus = FocusStorage.get('category_focus', {});
         if (!categoryFocus[todayDateStr]) categoryFocus[todayDateStr] = {};
         categoryFocus[todayDateStr][activeCategory] = (categoryFocus[todayDateStr][activeCategory] || 0) + minutesSpent;
         FocusStorage.set('category_focus', categoryFocus);

         const currentHour = String(new Date().getHours()).padStart(2, '0');
         let focusHours = FocusStorage.get('focus_hours', {});
         if (!focusHours[todayDateStr]) focusHours[todayDateStr] = {};
         focusHours[todayDateStr][currentHour] = (focusHours[todayDateStr][currentHour] || 0) + minutesSpent;
         FocusStorage.set('focus_hours', focusHours);

         if (activeFocusTask && activeFocusTask !== 'highlight-task') {
             const focusedTask = tasks.find(t => String(t.id) === String(activeFocusTask));
             if (focusedTask && focusedTask.parentGoal) {
                 const goalToCredit = goals.find(g => String(g.id) === String(focusedTask.parentGoal));
                 if (goalToCredit) {
                     goalToCredit.focusTime = (goalToCredit.focusTime || 0) + minutesSpent;
                     Store.goals.set(goals);
                     if (typeof renderGoals === 'function') renderGoals();
                     if (!document.getElementById('goal-details-modal').classList.contains('hidden') &&
                         document.getElementById('detail-active-goal-id').value === String(goalToCredit.id)) {
                         updateGoalDetailsUI(goalToCredit.id);
                     }
                 }
             }
         }

         if (window.FocusAISocial && typeof window.FocusAISocial.postActivity === 'function') {
             window.FocusAISocial.postActivity(`${minutesSpent} dakika odaklandı ⏱️`);
         }
         if (renderStatisticsRef && document.getElementById('istatistikler').classList.contains('active')) renderStatisticsRef();
         if (renderSocialStatsRef && document.getElementById('arkadaslar').classList.contains('active')) renderSocialStatsRef();
     }

     // "Sıradaki Aşama": mevcut aşamayı (odaklanma/mola) bitirmeyi beklemeden bir
     // sonraki mantıklı aşamaya atlar — odaklanmadan sonra sırası gelen molaya
     // (kısa/uzun, döngü sayısına göre), moladan sonra tekrar odaklanmaya geçer.
     // Odaklanma modundan çıkılıyorsa o ana kadar geçen süre "erken bitirme" gibi
     // kaydedilir (istatistik/XP/hedef); moladan çıkışta kaydedilecek bir şey yoktur.
     function goToNextStage() {
         const activeBtn = document.querySelector('.mode-btn.active');
         if (!activeBtn) return;
         const modeType = activeBtn.getAttribute('data-mode');

         if (modeType === 'pomodoro' || modeType === 'ultradian') {
             const secondsSpent = totalTime - timeLeft;
             const minutesSpent = Math.floor(secondsSpent / 60);
             if (minutesSpent > 0) creditFocusMinutes(minutesSpent);
             else { _serverFocusSessionId = null; _stopFocusHeartbeat(); }
         } else {
             _serverFocusSessionId = null;
             _stopFocusHeartbeat();
         }

         let nextMode;
         if (modeType === 'pomodoro') {
             pomodoroCount++;
             const tc = (typeof timerSettings !== 'undefined' && timerSettings.targetCycles) || 4;
             const currentLoop = pomodoroCount % tc === 0 ? tc : pomodoroCount % tc;
             const loopSpan = document.getElementById('loop-count');
             if (loopSpan) loopSpan.textContent = currentLoop;
             nextMode = (pomodoroCount % tc === 0) ? 'longBreak' : 'shortBreak';
         } else if (modeType === 'ultradian') {
             nextMode = 'longBreak';
         } else {
             nextMode = 'pomodoro';
         }
         const nextBtn = document.querySelector(`.mode-btn[data-mode="${nextMode}"]`);
         // nextStageBtn zaten kendi onayını aldı — mode-btn handler'ı ikinci kez sormasın.
         if (nextBtn) { _skipModeSwitchConfirm = true; nextBtn.click(); }
     }
     // Uyarı metni moda göre değişir: odaklanmadan çıkarken geçen süre kaydedileceği
     // belirtilir, moladan çıkarken sadece molanın kesileceği belirtilir. Taze/hiç
     // başlamamış bir sayaçta (kaybedilecek ilerleme yokken) hiç sorulmadan geçilir.
     if (nextStageBtn) {
         nextStageBtn.addEventListener('click', () => {
             const activeBtn = document.querySelector('.mode-btn.active');
             const modeType = activeBtn ? activeBtn.getAttribute('data-mode') : null;
             const isFocusMode = modeType === 'pomodoro' || modeType === 'ultradian';

             if (timeLeft !== totalTime) {
                 let message;
                 if (isFocusMode) {
                     const minutesSpent = Math.floor((totalTime - timeLeft) / 60);
                     message = minutesSpent > 0
                         ? `Mevcut odaklanman (${minutesSpent} dakika) kaydedilecek ve sıradaki aşamaya geçilecek. Devam etmek istiyor musun?`
                         : 'Henüz 1 dakika bile tamamlanmadı, bu yüzden kaydedilecek bir süre yok. Yine de sıradaki aşamaya geçmek istiyor musun?';
                 } else {
                     message = 'Molan burada kesilecek ve odaklanma aşamasına geçilecek. Devam etmek istiyor musun?';
                 }
                 showPremiumModal({
                     title: 'Sıradaki Aşamaya Geç',
                     message,
                     type: 'warning',
                     showCancel: true,
                     confirmText: 'Geç',
                     cancelText: 'Vazgeç',
                     onConfirm: goToNextStage
                 });
             } else {
                 goToNextStage();
             }
         });
     }

     // Grup seans takvimi gibi dış modüllerin "Şimdi Başla" aksiyonuyla zamanlayıcıyı
     // planlanan seans süresine göre kurup otomatik başlatabilmesi için açılan köprü.
     // "Odaklanma" (pomodoro) düğmesinin süresini geçici olarak seans süresine çeker —
     // tıpkı zamanlayıcı ayarlarının yaptığı gibi (bkz. applyTimerSettings) — böylece
     // tamamlanınca eklenen istatistikler de gerçek seans süresini yansıtır.
     window.startGroupFocusSession = function(minutes, sessionId) {
         const mins = Math.max(1, Math.round(minutes || 25));
         const pomodoroBtn = document.querySelector('.mode-btn[data-mode="pomodoro"]');
         if (!pomodoroBtn) return false;
         if (isRunning) pauseTimer();
         modeBtns.forEach(b => b.classList.remove('active'));
         pomodoroBtn.classList.add('active');
         pomodoroBtn.setAttribute('data-time', mins);
         totalTime = mins * 60;
         timeLeft = totalTime;
         updateTimerDisplay();
         applyTimerModeColor('pomodoro');
         if (finishEarlyBtn) finishEarlyBtn.classList.add('hidden');
         _activeGroupSessionId = sessionId || null;
         _serverFocusSessionId = null; // taze seans — startTimer() sunucuda yeni bir tane açacak
         _stopFocusHeartbeat();
         startTimer();
         return true;
     };
     if (finishEarlyBtn) {
         finishEarlyBtn.addEventListener('click', () => {
             // Eğer süre hiç başlamadıysa veya zaten sıfırdaysa işlem yapma
             if (timeLeft === totalTime) return;
 
            // Kronometrenin durduğu ana kadar harcanan net süreyi (saniye ve dakika) hesapla
            const secondsSpent = totalTime - timeLeft;
            const minutesSpent = Math.floor(secondsSpent / 60);

            if (minutesSpent > 0) {
                creditFocusMinutes(minutesSpent);
                showPremiumModal({
                    title: 'Odaklanma Tamamlandı ⏱️',
                    message: `Oturumu erken bitirmene rağmen, kazandığın ${minutesSpent} dakikalık derin odaklanma süresi tüm hedeflerine ve istatistiklerine başarıyla işlendi!`,
                    type: 'success'
                });
            } else {
                showPremiumModal({
                    title: 'Süre Çok Kısa',
                    message: 'Henüz 1 dakika bile tamamlanmadığı için süre kaydedilmedi. İvme kazanmak için biraz daha odaklanmayı dene!',
                    type: 'info'
                });
            }
 
             // Zamanlayıcıyı pürüzsüzce sıfırla ve kapat
             pauseTimer();
             const activeMode = document.querySelector('.mode-btn.active');
             totalTime = parseInt(activeMode.getAttribute('data-time')) * 60;
             timeLeft = totalTime;
             updateTimerDisplay();
             finishEarlyBtn.classList.add('hidden');
             window.clearFocusMode(); // Aktif odak seçimini temizle
 
             // Sayfa yenilenmeden İstatistikleri ve Arkadaşlar panelini anlık güncelle
             if (renderStatisticsRef && document.getElementById('istatistikler').classList.contains('active')) renderStatisticsRef();
             if (renderSocialStatsRef && document.getElementById('arkadaslar').classList.contains('active')) renderSocialStatsRef();
         });
     }
     
     // --- ZAMANLAYICI PROFİLLERİ (eski sabit Odaklanma/Derin Çalışma/Kısa-Uzun Mola
     // butonlarının yerini alan, kullanıcı tanımlı profil sistemi) ---
     // NOT: Faz motoru (odaklanma<->mola otomatik geçişleri, döngü sayacı, grup
     // seansları vb.) hâlâ gizlenmiş .mode-btn'lerin data-time/active durumuna dayanıyor —
     // bu yüzden o mekanizmaya dokunmadık. Bir profil sadece bu gizli butonların
     // data-time değerlerini ve döngü sayısını besliyor (applyTimerSettings üzerinden).
     const timerSettingsModal      = document.getElementById('timer-settings-modal');
     const timerProfileModalTitle  = document.getElementById('timer-profile-modal-title');
     const closeTimerSettingsBtn   = document.getElementById('close-timer-settings-btn');
     const saveTimerSettingsBtn    = document.getElementById('save-timer-settings-btn');
     const deleteTimerProfileBtn   = document.getElementById('delete-timer-profile-btn');
     const timerProfileBar         = document.getElementById('timer-profile-bar');
     const timerProfileCards       = document.getElementById('timer-profile-cards');
     const timerProfileAddBtn      = document.getElementById('timer-profile-add-btn');
     const timerActiveProfilePill  = document.getElementById('timer-active-profile-pill');
     const activeProfilePillName   = document.getElementById('active-profile-pill-name');

     const settingProfileName      = document.getElementById('setting-profile-name');
     const settingProfileNameCount = document.getElementById('setting-profile-name-count');
     const PROFILE_NAME_MAX_LEN = 24;
     if (settingProfileName) {
         settingProfileName.addEventListener('input', () => {
             const len = settingProfileName.value.length;
             if (settingProfileNameCount) {
                 settingProfileNameCount.textContent = `${len}/${PROFILE_NAME_MAX_LEN}`;
                 settingProfileNameCount.style.color = len >= PROFILE_NAME_MAX_LEN ? '#fdcb6e' : 'var(--text-muted)';
             }
         });
     }
     const settingPomodoro     = document.getElementById('setting-pomodoro');
     const settingShortBreak   = document.getElementById('setting-shortBreak');
     const settingLongBreak    = document.getElementById('setting-longBreak');
     const settingTargetCycles = document.getElementById('setting-targetCycles');
     const settingAutoStart    = document.getElementById('setting-autoStart');

     const MAX_TIMER_PROFILES = 5;

     // 1. Profilleri hafızadan çek — yoksa psikologların/araştırmaların önerdiği
     // iki hazır profille tohumla: Klasik Pomodoro (Cirillo Tekniği) ve
     // Ultradiyen Ritim (Kleitman'ın temel dinlenme-aktivite döngüsü araştırmasına dayanan derin çalışma bloğu).
     let timerProfiles = FocusStorage.get('timer_profiles', null);
     if (!Array.isArray(timerProfiles) || timerProfiles.length === 0) {
         timerProfiles = [
             { id: generateId(), name: 'Klasik Pomodoro', focus: 25, shortBreak: 5, longBreak: 15, cycles: 4 },
             { id: generateId(), name: 'Derin Çalışma', focus: 90, shortBreak: 20, longBreak: 20, cycles: 2 },
         ];
         FocusStorage.set('timer_profiles', timerProfiles);
     } else {
         // Migrasyon: eski varsayılan profil adı sadeleştirildi
         let _renamed = false;
         timerProfiles.forEach(p => {
             if (p.name === 'Derin Çalışma (Ultradiyen Ritim)') { p.name = 'Derin Çalışma'; _renamed = true; }
         });
         if (_renamed) FocusStorage.set('timer_profiles', timerProfiles);
     }

     let activeTimerProfileId = FocusStorage.get('active_timer_profile_id', null);
     if (!activeTimerProfileId || !timerProfiles.some(p => p.id === activeTimerProfileId)) {
         activeTimerProfileId = timerProfiles[0].id;
         FocusStorage.set('active_timer_profile_id', activeTimerProfileId);
     }

     // timerSettings artık sadece autoStart (genel, profile bağlı olmayan bir davranış) için
     // kalıcı — pomodoro/shortBreak/longBreak/targetCycles alanları aktif profilden türetilir.
     let timerSettings = FocusStorage.get('timer_settings', { autoStart: false });
     if (timerSettings.autoStart === undefined) timerSettings.autoStart = false;

     function applyTimerSettings() {
         document.querySelector('.mode-btn[data-mode="pomodoro"]').setAttribute('data-time', timerSettings.pomodoro);
         document.querySelector('.mode-btn[data-mode="shortBreak"]').setAttribute('data-time', timerSettings.shortBreak);
         document.querySelector('.mode-btn[data-mode="longBreak"]').setAttribute('data-time', timerSettings.longBreak);

         // Pomodoro sayacı gösterimini tur sayısına göre güncelle
         const counterEl = document.getElementById('pomodoro-counter');
         if (counterEl) {
             const loopSpan = document.getElementById('loop-count');
             const curLoop = loopSpan ? loopSpan.textContent : '0';
             counterEl.innerHTML = `<i class="fa-solid fa-repeat"></i> Döngü: <span id="loop-count">${curLoop}</span>/${timerSettings.targetCycles}`;
         }

         // Sayaç çalışmıyorsa ekrandaki süreyi güncelle
         if (!isRunning) {
             const activeModeBtn = document.querySelector('.mode-btn.active');
             totalTime = parseInt(activeModeBtn.getAttribute('data-time')) * 60;
             timeLeft = totalTime;
             updateTimerDisplay();
         }
     }

     // Aktif profili sisteme uygula + arayüzü tazele
     function applyActiveProfile() {
         const p = timerProfiles.find(x => x.id === activeTimerProfileId) || timerProfiles[0];
         if (!p) return;
         timerSettings.pomodoro     = p.focus;
         timerSettings.shortBreak   = p.shortBreak;
         timerSettings.longBreak    = p.longBreak;
         timerSettings.targetCycles = p.cycles;
         applyTimerSettings();
         renderTimerProfiles();
         updateActiveProfilePill();
     }

     function updateActiveProfilePill() {
         const p = timerProfiles.find(x => x.id === activeTimerProfileId);
         if (activeProfilePillName && p) activeProfilePillName.textContent = p.name;
     }

     // Zamanlayıcı "taze" (henüz başlamamış / ilerlemesi olmayan) durumdaysa profil
     // çubuğunu, aksi halde (çalışıyor ya da duraklatılmış ilerleme varsa) sadece
     // aktif profilin adını gösteren küçük bir rozeti göster.
     function updateTimerProfileBarVisibility() {
         if (!timerProfileBar || !timerActiveProfilePill) return;
         const fresh = typeof isRunning !== 'undefined' && !isRunning && timeLeft === totalTime;
         timerProfileBar.classList.toggle('hidden', !fresh);
         timerActiveProfilePill.classList.toggle('hidden', fresh);
         // Taze (henüz hiç başlamamış) durumda sadece "Başlat" görünsün; Sıfırla/Sıradaki
         // Aşama ancak bir seans başladıktan/ilerleme kaydedildikten sonra ortaya çıksın.
         if (resetBtn)      resetBtn.classList.toggle('hidden', fresh);
         if (nextStageBtn)  nextStageBtn.classList.toggle('hidden', fresh);
         _syncTimerRunState();
     }

     function renderTimerProfiles() {
         if (!timerProfileCards) return;
         timerProfileCards.innerHTML = '';
         timerProfiles.forEach(p => {
             const card = document.createElement('div');
             card.className = 'timer-profile-card' + (p.id === activeTimerProfileId ? ' active' : '');
             card.dataset.profileId = p.id;
             card.innerHTML = `
                 <div class="tpc-name">${escapeHtml(p.name)}</div>
                 <div class="tpc-meta">
                     <span title="Odaklanma"><i class="fa-solid fa-bullseye"></i> ${p.focus}dk</span>
                     <span title="Kısa Mola"><i class="fa-solid fa-mug-hot"></i> ${p.shortBreak}dk</span>
                     <span title="Uzun Mola"><i class="fa-solid fa-couch"></i> ${p.longBreak}dk</span>
                 </div>
                 <div class="tpc-actions">
                     <button class="tpc-edit-btn" title="Düzenle"><i class="fa-solid fa-pen"></i></button>
                     <button class="tpc-del-btn" title="Sil"><i class="fa-solid fa-trash"></i></button>
                 </div>
             `;
             card.addEventListener('click', (e) => {
                 if (e.target.closest('.tpc-edit-btn') || e.target.closest('.tpc-del-btn')) return;
                 if (p.id === activeTimerProfileId || isRunning) return;
                 activeTimerProfileId = p.id;
                 FocusStorage.set('active_timer_profile_id', activeTimerProfileId);
                 applyActiveProfile();
             });
             card.querySelector('.tpc-edit-btn').addEventListener('click', (e) => {
                 e.stopPropagation();
                 openTimerProfileModal(p.id);
             });
             card.querySelector('.tpc-del-btn').addEventListener('click', (e) => {
                 e.stopPropagation();
                 deleteTimerProfile(p.id);
             });
             timerProfileCards.appendChild(card);
         });
         if (timerProfileAddBtn) timerProfileAddBtn.disabled = timerProfiles.length >= MAX_TIMER_PROFILES;
     }

     let _editingTimerProfileId = null; // null = yeni profil oluşturuluyor

     function openTimerProfileModal(profileId) {
         if (!timerSettingsModal) return;
         if (profileId) {
             const p = timerProfiles.find(x => x.id === profileId);
             if (!p) return;
             _editingTimerProfileId = p.id;
             if (settingProfileName) settingProfileName.value = p.name;
             settingPomodoro.value  = p.focus;
             settingShortBreak.value = p.shortBreak;
             settingLongBreak.value  = p.longBreak;
             if (settingTargetCycles) settingTargetCycles.value = p.cycles;
             if (timerProfileModalTitle) timerProfileModalTitle.innerHTML = '<i class="fa-solid fa-gear" style="color: var(--primary-color);"></i> Profili Düzenle';
             if (deleteTimerProfileBtn) deleteTimerProfileBtn.classList.remove('hidden');
         } else {
             if (timerProfiles.length >= MAX_TIMER_PROFILES) {
                 showPremiumModal({ title: 'Profil Limiti Doldu', message: `En fazla ${MAX_TIMER_PROFILES} zamanlayıcı profili oluşturabilirsin. Yeni bir profil eklemeden önce kullanmadığın birini silebilirsin.`, type: 'warning' });
                 return;
             }
             _editingTimerProfileId = null;
             if (settingProfileName) settingProfileName.value = '';
             settingPomodoro.value  = 25;
             settingShortBreak.value = 5;
             settingLongBreak.value  = 15;
             if (settingTargetCycles) settingTargetCycles.value = 4;
             if (timerProfileModalTitle) timerProfileModalTitle.innerHTML = '<i class="fa-solid fa-gear" style="color: var(--primary-color);"></i> Yeni Zamanlayıcı Profili';
             if (deleteTimerProfileBtn) deleteTimerProfileBtn.classList.add('hidden');
         }
         if (settingAutoStart) settingAutoStart.checked = timerSettings.autoStart;
         if (settingProfileNameCount) {
             const len = settingProfileName ? settingProfileName.value.length : 0;
             settingProfileNameCount.textContent = `${len}/${PROFILE_NAME_MAX_LEN}`;
             settingProfileNameCount.style.color = 'var(--text-muted)';
         }
         timerSettingsModal.classList.remove('hidden');
     }

     function deleteTimerProfile(id) {
         if (timerProfiles.length <= 1) {
             showPremiumModal({ title: 'Son Profil', message: 'En az bir zamanlayıcı profilin olmalı. Bunu silmeden önce yeni bir profil oluşturmalısın.', type: 'warning' });
             return;
         }
         const p = timerProfiles.find(x => x.id === id);
         if (!p) return;
         showPremiumModal({
             title: 'Profili Sil',
             message: `"${escapeHtml(p.name)}" profilini silmek istediğine emin misin?`,
             type: 'warning', showCancel: true, confirmText: 'Sil', cancelText: 'Vazgeç',
             onConfirm: () => {
                 timerProfiles = timerProfiles.filter(x => x.id !== id);
                 FocusStorage.set('timer_profiles', timerProfiles);
                 if (activeTimerProfileId === id) {
                     activeTimerProfileId = timerProfiles[0].id;
                     FocusStorage.set('active_timer_profile_id', activeTimerProfileId);
                 }
                 applyActiveProfile();
             }
         });
     }

     if (timerProfileAddBtn) timerProfileAddBtn.addEventListener('click', () => openTimerProfileModal(null));

     function closeTimerSettingsModal() {
         timerSettingsModal.classList.add('hidden');
     }

     if (closeTimerSettingsBtn) closeTimerSettingsBtn.addEventListener('click', closeTimerSettingsModal);

     // Modalın dışındaki siyah alana tıklayınca da kapat
     timerSettingsModal.addEventListener('click', (e) => {
         if (e.target === timerSettingsModal) closeTimerSettingsModal();
     });

     if (deleteTimerProfileBtn) {
         deleteTimerProfileBtn.addEventListener('click', () => {
             if (!_editingTimerProfileId) return;
             const idToDelete = _editingTimerProfileId;
             closeTimerSettingsModal();
             deleteTimerProfile(idToDelete);
         });
     }

     // 3. Profili Kaydetme (yeni oluşturma ya da düzenleme)
     if (saveTimerSettingsBtn) {
         saveTimerSettingsBtn.addEventListener('click', () => {
             const nameVal = (settingProfileName?.value || '').trim().slice(0, PROFILE_NAME_MAX_LEN);
             const pVal = parseInt(settingPomodoro.value) || 25;
             const sVal = parseInt(settingShortBreak.value) || 5;
             const lVal = parseInt(settingLongBreak.value) || 15;

             if (!nameVal) {
                 showPremiumModal({ title: 'İsim Gerekli', message: 'Lütfen profiline bir isim ver.', type: 'warning' });
                 return;
             }
             // --- BİLİMSEL SINIRLAR (Ultradian Ritim) ---
             if (pVal < 5 || pVal > 120) {
                 showPremiumModal({ title: 'Bilimsel Sınır Aşıldı', message: 'İnsan beyni aralıksız maksimum 90-120 dakika odaklanabilir. Lütfen odaklanma süresini 5 ile 120 dakika arasında belirleyin.', type: 'warning' });
                 return;
             }
             if (sVal < 1 || sVal > 30) {
                 showPremiumModal({ title: 'Geçersiz Kısa Mola', message: 'Kısa molalar zihni tazelemek içindir. Eğer 30 dakikayı geçerse zihin tamamen soğur. Lütfen 1 ile 30 dakika arası bir süre girin.', type: 'warning' });
                 return;
             }
             if (lVal < 5 || lVal > 60) {
                 showPremiumModal({ title: 'Geçersiz Uzun Mola', message: 'Uzun molalar derin dinlenme içindir ancak 60 dakikayı aşarsa tekrar işe dönmek imkansızlaşır. Lütfen 5 ile 60 dakika arası bir süre girin.', type: 'warning' });
                 return;
             }

             const cVal = parseInt(settingTargetCycles?.value) || 4;
             const aVal = settingAutoStart?.checked || false;
             if (cVal < 1 || cVal > 10) {
                 showPremiumModal({ title: 'Geçersiz Tur Sayısı', message: 'Tur sayısı 1 ile 10 arasında olmalıdır.', type: 'warning' });
                 return;
             }

             timerSettings.autoStart = aVal;
             FocusStorage.set('timer_settings', timerSettings);

             if (_editingTimerProfileId) {
                 const p = timerProfiles.find(x => x.id === _editingTimerProfileId);
                 if (p) {
                     p.name = nameVal; p.focus = pVal; p.shortBreak = sVal; p.longBreak = lVal; p.cycles = cVal;
                 }
             } else {
                 if (timerProfiles.length >= MAX_TIMER_PROFILES) {
                     showPremiumModal({ title: 'Profil Limiti Doldu', message: `En fazla ${MAX_TIMER_PROFILES} zamanlayıcı profili oluşturabilirsin.`, type: 'warning' });
                     return;
                 }
                 const newProfile = { id: generateId(), name: nameVal, focus: pVal, shortBreak: sVal, longBreak: lVal, cycles: cVal };
                 timerProfiles.push(newProfile);
                 activeTimerProfileId = newProfile.id;
                 FocusStorage.set('active_timer_profile_id', activeTimerProfileId);
             }
             FocusStorage.set('timer_profiles', timerProfiles);
             applyActiveProfile();
             closeTimerSettingsModal();
         });
     }

     // Kaydedilmiş bir seans durumu var mı — applyActiveProfile()/updateTimerProfileBarVisibility()
     // "taze" (henüz başlamamış) sayıp bunu temizlemeden ÖNCE yakala.
     const _savedTimerRunState = FocusStorage.get('timer_run_state', null);

     // Sayfa yüklendiğinde aktif profili uygula
     applyActiveProfile();
     updateTimerProfileBarVisibility();

     // Yarım kalmış bir seans varsa (sayfa yenilendiğinde) kaldığı yerden devam ettir.
     (function _restoreTimerRunState() {
         const st = _savedTimerRunState;
         if (!st || !st.mode) return;

         const btn = document.querySelector(`.mode-btn[data-mode="${st.mode}"]`);
         if (btn) {
             modeBtns.forEach(b => b.classList.remove('active'));
             btn.classList.add('active');
             applyTimerModeColor(st.mode);
         }
         pomodoroCount = st.loopCount || 0;
         const tc = timerSettings.targetCycles || 4;
         const loopSpan = document.getElementById('loop-count');
         if (loopSpan) loopSpan.textContent = pomodoroCount % tc === 0 ? (pomodoroCount > 0 ? tc : 0) : pomodoroCount % tc;
         totalTime = st.totalTime || totalTime;

         if (st.isRunning) {
             const remaining = Math.max(0, Math.round((st.endTime - Date.now()) / 1000));
             if (remaining > 0) {
                 timeLeft = remaining;
                 updateTimerDisplay();
                 startTimer(); // kaldığı yerden devam ettir (interval'i yeniden kurar)
             } else {
                 // Sekmeden uzakken süre zaten dolmuş — sıfır göster, kullanıcı tekrar başlatsın
                 timeLeft = 0;
                 updateTimerDisplay();
                 _clearTimerRunState();
             }
         } else if (typeof st.timeLeft === 'number' && st.timeLeft > 0 && st.timeLeft !== totalTime) {
             timeLeft = st.timeLeft;
             updateTimerDisplay();
         }
     })();

     // --- AYARLAR: OTO-LİMİT VE +/- BUTONLARI → script-settings-steppers.js dosyasına taşındı ---

     const monthYearDisplay = document.getElementById('month-year-display');
     const calendarDays = document.getElementById('calendar-days');
     const prevMonthBtn = document.getElementById('prev-month-btn');
     const nextMonthBtn = document.getElementById('next-month-btn');
     const selectedDateTitle = document.getElementById('selected-date-title');
     const eventsCountDisplay = document.getElementById('selected-date-events-count');
     
     const eventInput = document.getElementById('event-input');
     const eventParentSelect = document.getElementById('event-parent-habit');
     const eventParentGoalSelect = document.getElementById('event-parent-goal');
     const eventTimeStart = document.getElementById('event-time-start');
     const eventTimeEnd = document.getElementById('event-time-end');
     const eventPriority = document.getElementById('event-priority');
     const addEventBtn = document.getElementById('add-event-btn');
     const eventList = document.getElementById('event-list');

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
     
     const priorityLabels = { 'high': 'Yüksek', 'medium': 'Orta', 'low': 'Düşük' };
 
     
     // Aylık Takvim Hover Popup → script-calendar-hover-popup.js dosyasına taşındı
     // (window.showCalHoverPopup / window.hideCalHoverPopup olarak sağlanır)

     function renderCalendar() {
         const year = currentDate.getFullYear(); 
         const month = currentDate.getMonth();
         monthYearDisplay.textContent = `${monthNames[month]} ${year}`; 
         calendarDays.innerHTML = '';
         
         const firstDay = new Date(year, month, 1).getDay();
         const lastDate = new Date(year, month + 1, 0).getDate();
         const startDay = firstDay === 0 ? 6 : firstDay - 1;
         
         for (let i = 0; i < startDay; i++) {
             calendarDays.appendChild(Object.assign(document.createElement('div'), {className:'cal-day empty'}));
         }
         
         for (let i = 1; i <= lastDate; i++) {
             const d = document.createElement('div'); 
             d.className = 'cal-day'; 
             d.textContent = i;
             
             const check = formatDateToString(new Date(year, month, i));
             d.setAttribute('data-date', check); // YENİ EKLENEN SATIR: Sürükle-bırak için tarihi hücreye işliyoruz
             if (check === formatDateToString(new Date())) d.classList.add('today');
             if (check === formatDateToString(selectedDate)) d.classList.add('selected');
             
             // Dünden sarkan (gece kuşu) görev var mı kontrolü
             let prevD = new Date(year, month, i - 1);
             const prevCheck = formatDateToString(prevD);
             const overnightEvents = (calendarEvents[prevCheck] || []).filter(e => e.isOvernight && !e.isLessonPlanDraft);

             // Bugünün tüm etkinlikleri (isLessonPlanDraft: öğretmenin başka bir öğrenci için
             // henüz atamadığı ders planı taslağı — sadece planlama arayüzünde görünmeli)
             const todaysEvents = (calendarEvents[check] || []).filter(e => !e.isLessonPlanDraft);
             const todaysHabits = getHabitsForDate(check);
             let highlightHistory = FocusStorage.get('highlight_history', {});
             const hasHighlight = !!highlightHistory[check];
 
             const allDayItems = [...overnightEvents, ...todaysEvents];

             // Sınıf ödevleri (window.FocusAssignments, social.js) — o gün teslim tarihi olan,
             // henüz teslim edilmemiş ödevler. Normal görevlerden ayrı bir nokta rengiyle işaretlenir.
             const dayAssignments = (window.FocusAssignments?.items || []).filter(a => !a.done && a.due_date && formatDateToString(new Date(a.due_date)) === check);

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
                     const globalTask = tasks.find(t => String(t.id) === String(ev.id));
                     if (globalTask && globalTask.parentGoal) {
                         const gc = getGoalColor(globalTask.parentGoal);
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
                 selectedDate = new Date(year, month, i);
                 currentDate = new Date(selectedDate);
                 renderCalendar();
                 renderEvents(); // gizli elementler için uyumluluk
                 openDayDrawer(check);
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
                    const dumpItem = typeof mindDumps !== 'undefined' && mindDumps.find(x => String(x.id) === String(draggedTaskId));
                    if (dumpItem) {
                        // Fikri otomatik olarak o güne orta öncelikli varsayılan görev olarak planla
                        addSmartTask(dumpItem.text, 'medium', 'is', check, '09:00', '10:00', '', '', '');
                        mindDumps = mindDumps.filter(x => String(x.id) !== String(draggedTaskId));
                        saveMindDumps();
                    } else {
                        window.moveTaskToDate(draggedTaskId, check); // Normal görevi bu yeni güne taşı
                    }
                    
                    // ANLIK GÖRÜNÜM SENKRONİZASYONU
                    setTimeout(() => {
                        if (typeof renderCalendar === 'function') renderCalendar();
                        if (typeof renderEvents === 'function') renderEvents();
                        if (typeof renderCalMindDump === 'function') renderCalMindDump();
                        if (typeof renderMindDumps === 'function') renderMindDumps();
                        if (typeof renderTasks === 'function') renderTasks();
                        if (typeof updateStats === 'function') updateStats();
                    }, 100);
                }
            });
             // -------------------------------------------------------------
 
             calendarDays.appendChild(d);
         }
     }
 
     function renderEvents() {
         const check = formatDateToString(selectedDate);
         
         // Arama ve Filtreleme Değerlerini Al
         const searchQuery = document.getElementById('calendar-search-input') ? document.getElementById('calendar-search-input').value.toLowerCase().trim() : '';
         const filterValue = document.getElementById('calendar-filter-select') ? document.getElementById('calendar-filter-select').value : 'all';
 
         let dayEvents = [];
         let dayHabits = [];
         let highlightList = [];
 
         // EĞER ARAMA KUTUSU DOLUYSA (TÜM GEÇMİŞTE VE GELECEKTE ARA)
         if (searchQuery !== '') {
             selectedDateTitle.textContent = `Arama Sonuçları: "${searchQuery}"`;
             
             // 1. Tüm Takvim Planlarını Ara (calendarEvents üzerinden)
             let allCalendarItems = [];
             for (let date in calendarEvents) {
                 calendarEvents[date].forEach(ev => {
                     allCalendarItems.push(Object.assign({}, ev, { _searchDate: date }));
                 });
             }
             dayEvents = allCalendarItems.filter(ev => !ev.isLessonPlanDraft && ev.text.toLowerCase().includes(searchQuery));
             if (filterValue !== 'all' && filterValue !== 'habit') {
                 dayEvents = dayEvents.filter(ev => ev.priority === filterValue);
             }
 
             // 2. Tüm Alışkanlıkları Ara
             if (filterValue === 'all' || filterValue === 'habit') {
                 dayHabits = habits.filter(h => h.name.toLowerCase().includes(searchQuery));
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
             selectedDateTitle.textContent = selectedDate.toLocaleDateString('tr-TR', options);
             
             // Seçili Günün Görevleri (isLessonPlanDraft: öğretmenin başka bir öğrenci için
             // henüz atamadığı ders planı taslağı — bu görünümde gizli kalmalı)
             if (calendarEvents[check]) dayEvents.push(...calendarEvents[check].filter(e => !e.isLessonPlanDraft));

             // Dünden sarkan (gece kuşu) görevler
             let prevDate = new Date(selectedDate);
             prevDate.setDate(prevDate.getDate() - 1);
             const prevCheck = formatDateToString(prevDate);
             if (calendarEvents[prevCheck]) {
                 const overnightEvents = calendarEvents[prevCheck].filter(e => e.isOvernight && !e.isLessonPlanDraft);
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
 
         eventsCountDisplay.textContent = `${dayEvents.length + dayHabits.length + highlightList.length} Plan`;
 
         // --- YENİ: Mikro İlerleme (Günlük Tamamlanma Yüzdesi) ---
         let totalItemsForSelectedDay = dayEvents.length + dayHabits.length + highlightList.length;
         let completedItemsForSelectedDay = 0;
         
         dayEvents.forEach(ev => {
             const globalTask = tasks.find(t => String(t.id) === String(ev.id));
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
                 eventList.innerHTML = '<div class="empty-state">Arama kriterlerine uygun plan bulunamadı.</div>';
             } else {
                 eventList.innerHTML = '<div class="empty-state">Bu tarih için plan yok.</div>';
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
             const pg = goals.find(g => String(g.id) === String(hl.data.parentGoal));
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
                const todayStrForHabit = formatDateToString(new Date());
                
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

             const globalTask = tasks.find(t => String(t.id) === String(ev.id));
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
                 const ph = habits.find(h => String(h.id) === String(ev.parentHabit));
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
                                 ${ev.parentHabit ? (() => { const ph = habits.find(h => String(h.id) === String(ev.parentHabit)); return ph ? `<span class="tc-badge tc-badge-goal"><i class="fa-solid fa-bullseye"></i> ${escapeHtml(ph.name)}</span>` : ''; })() : ''}
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
 
         eventList.innerHTML = html;
         initCalEventListDnD(check);
     }
 
     // --- TAKVİM LİSTESİ İÇİ REORDER + TAMAMLAMA ANİMASYONU ---
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
                     const ghost = createCalDragGhost(evData.text, evData.timeStart, evData.timeEnd, evData.priority);
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
                 renderEvents();
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
         renderCalendar();
         renderEvents();
         
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
         const timeEnd = smartData.parsedTime ? addOneHour(timeStart) : eventTimeEnd.value;
 
         // NLP tarih bulduysa onu kullan, bulamadıysa takvimde KULLANICININ SEÇTİĞİ tarihi kullan
         const d = smartData.parsedDate ? smartData.parsedDate : formatDateToString(selectedDate); 
 
         const startMins = timeToMins(timeStart);
         const endMins = timeToMins(timeEnd);

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
         const nextSlot = getNextAvailableTimeSlot(d, timeToMins(timeEnd) - timeToMins(timeStart) || 60);
         updateEndPicker('event-time-start', nextSlot.start);
         updateEndPicker('event-time-end', nextSlot.end);
         eventPriority.value = 'medium';
 
         closeEventModal();
         renderCalendar(); renderEvents(); renderTasks();
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
             const nextSlot = getNextAvailableTimeSlot(formatDateToString(selectedDate));
             updateEndPicker('event-time-start', nextSlot.start);
             updateEndPicker('event-time-end', nextSlot.end);
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
     const spotlightModal = document.getElementById('spotlight-search-modal');
     const spotlightInput = document.getElementById('spotlight-input');
     const closeSpotlightBtn = document.getElementById('close-spotlight-btn');
     const openSpotlightBtn = document.getElementById('open-spotlight-btn');
     const spotlightResultsWrapper = document.getElementById('spotlight-results-wrapper');
     const spotlightResultsList = document.getElementById('spotlight-results-list');
 
     function openSpotlight() {
         spotlightModal.classList.remove('hidden');
         spotlightInput.value = '';
         spotlightResultsWrapper.classList.add('hidden');
         spotlightResultsList.innerHTML = '';
         setTimeout(() => spotlightInput.focus(), 100);
     }
 
     function closeSpotlight() {
         spotlightModal.classList.add('hidden');
     }
 
     if (openSpotlightBtn) openSpotlightBtn.addEventListener('click', openSpotlight);
     if (closeSpotlightBtn) closeSpotlightBtn.addEventListener('click', closeSpotlight);
     
     spotlightModal.addEventListener('click', (e) => {
         if (e.target === spotlightModal) closeSpotlight();
     });
     
     // Spotlight için Klavye Kısayolu (Ctrl+K veya Cmd+K)
     document.addEventListener('keydown', (e) => {
         if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
             e.preventDefault();
             if (spotlightModal.classList.contains('hidden')) openSpotlight();
             else closeSpotlight();
         }
         if (e.key === 'Escape' && !spotlightModal.classList.contains('hidden')) {
             closeSpotlight();
         }
     });
 
     spotlightInput.addEventListener('input', (e) => {
         const query = e.target.value.toLowerCase().trim();
         if (query.length < 2) {
             spotlightResultsWrapper.classList.add('hidden');
             spotlightResultsList.innerHTML = '';
             return;
         }
 
         let results = [];
         
         // 1. Takvim Kayıtlarında Ara
         for (let dateStr in calendarEvents) {
             calendarEvents[dateStr].forEach(ev => {
                 if (ev.text.toLowerCase().includes(query)) {
                     results.push({ id: ev.id, text: ev.text, date: dateStr, time: ev.timeStart, type: 'Takvim Planı', icon: 'fa-calendar-check' });
                 }
             });
         }
         
         // 2. Görevlerde Ara
         tasks.forEach(t => {
             if (t.text.toLowerCase().includes(query) && !results.some(r => r.id === t.id)) {
                 results.push({ id: t.id, text: t.text, date: t.date, time: t.timeStart, type: 'Görev', icon: 'fa-check-circle' });
             }
         });
 
         // Tarihe göre sırala (GÜNCELLEME: Gün-Ay-Yıl formatına göre akıllı sıralama)
         results.sort((a, b) => {
             const [dA, mA, yA] = a.date.split('-').map(Number);
             const [dB, mB, yB] = b.date.split('-').map(Number);
             return new Date(yA, mA - 1, dA) - new Date(yB, mB - 1, dB);
         });
 
         spotlightResultsList.innerHTML = '';
         if (results.length === 0) {
             spotlightResultsList.innerHTML = '<li style="padding: 20px; text-align: center; color: var(--text-muted);">Sonuç bulunamadı.</li>';
         } else {
             results.forEach(res => {
                 const [d, m, y] = res.date.split('-'); // GÜNCELLEME: d, m, y sırasına alındı
                 const shortDate = `${parseInt(d)} ${monthNamesShort[parseInt(m)-1]} ${y}`;
                 
                 const li = document.createElement('li');
                 li.className = 'spotlight-result-item';
                 li.innerHTML = `
                     <div class="s-res-info">
                         <span class="s-res-title"><i class="fa-solid ${res.icon}" style="color: var(--primary-color); margin-right: 8px;"></i>${escapeHtml(res.text)}</span>
                         <div class="s-res-meta">
                             <span><i class="fa-regular fa-calendar"></i> ${shortDate}</span>
                             <span><i class="fa-regular fa-clock"></i> ${res.time || 'Tüm Gün'}</span>
                             <span style="background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 8px; color: #a29bfe;">${res.type}</span>
                         </div>
                     </div>
                     <i class="fa-solid fa-arrow-right" style="color: var(--text-muted); opacity: 0.5;"></i>
                 `;
                 
                 li.onclick = () => {
                     // Takvime ve hedeflenen tarihe ışınlan
                     const [ty, tm, td] = res.date.split('-').map(Number);
                     currentDate = new Date(ty, tm - 1, td);
                     selectedDate = new Date(ty, tm - 1, td);
                     
                     switchTab('takvim'); 
                     renderCalendar();
                     renderEvents();
                     closeSpotlight();
                 };
                 spotlightResultsList.appendChild(li);
             });
         }
         spotlightResultsWrapper.classList.remove('hidden');
     });
 
     prevMonthBtn.onclick = () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); updateCalUnifiedTitle(); };
     nextMonthBtn.onclick = () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); updateCalUnifiedTitle(); };
 
     let statsActiveFilter = 7;
 
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
 
     function renderStatistics() {
         const now = new Date();
         const filterDays = statsActiveFilter;
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
         const filteredTasks = tasks.filter(t => t.completed && inRange(t.date || formatDateToString(now)));
         const filteredHighlights = Object.entries(highlightHistory).filter(([ds, h]) => h.completed && inRange(ds));
         const completedTaskCount = filteredTasks.length + filteredHighlights.length;
         const totalTasksCount = tasks.filter(t => inRange(t.date || formatDateToString(now))).length + Object.keys(highlightHistory).filter(ds => inRange(ds)).length;
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
         habits.forEach(h => {
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
         if (habitConfidenceEl) habitConfidenceEl.style.display = (habits.length > 0 && completedHabitDaysCount < 3) ? 'inline-flex' : 'none';

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
         const activeDumpCount = mindDumps ? mindDumps.length : 0;
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
             const tasksInRange = tasks.filter(t => t.completed && within(t.date || formatDateToString(now)));
             const highlightsInRange = Object.entries(highlightHistory).filter(([ds, h]) => h.completed && within(ds));
             const completed = tasksInRange.length + highlightsInRange.length;
             const totalInRange = tasks.filter(t => within(t.date || formatDateToString(now))).length
                 + Object.keys(highlightHistory).filter(ds => within(ds)).length;
             const rate = totalInRange === 0 ? 0 : Math.round((completed / totalInRange) * 100);
             let focus = 0;
             Object.entries(focusHistory).forEach(([ds, mins]) => { if (within(ds)) focus += mins; });
             let totalTargetDays = 0, completedDays = 0;
             habits.forEach(h => {
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
             tasks.filter(t => t.completed).forEach(t => {
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
             const activeMonthNamesShort = typeof monthNamesShort !== 'undefined' ? monthNamesShort : fallbackMonthsShort;
 
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
                 const ds = formatDateToString(d);
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
                     
                     const dayTasks = tasks.filter(t => t.date === clickedDate && t.completed);
                     
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
                         const activeFullMonths = typeof monthNames !== 'undefined' ? monthNames : fallbackMonthsFull;
                         
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
            tasks.forEach(t => { if (t.completed && t.date) completedByDate[t.date] = (completedByDate[t.date] || 0) + 1; });
            Object.entries(highlightHistory).forEach(([ds, h]) => { if (h.completed) completedByDate[ds] = (completedByDate[ds] || 0) + 1; });
            const trendFocusHistory = FocusStorage.get('focus_history', {});

            let barData = [];

            if (filterDays === 7 || filterDays === 30) {
                if (trendTitleEl) trendTitleEl.textContent = `Son ${filterDays} Günlük İlerleme`;
                for (let i = filterDays - 1; i >= 0; i--) {
                    const d = new Date(); d.setDate(d.getDate() - i);
                    const ds = formatDateToString(d);
                    const dayNamesShortTr = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
                    const label = filterDays === 7
                        ? `${d.getDate()} ${monthNamesShort ? monthNamesShort[d.getMonth()] : ''}`
                        : `${d.getDate()}`;
                    const dayNum = filterDays === 7
                        ? `${dayNamesShortTr[d.getDay()]} ${d.getDate()}`
                        : String(d.getDate());
                    barData.push({ label, dayNum, full: `${d.getDate()} ${monthNamesShort ? monthNamesShort[d.getMonth()] : ''} ${dayNamesShortTr[d.getDay()]}`, value: completedByDate[ds] || 0, value2: trendFocusHistory[ds] || 0 });
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
                    const label = monthNamesShort ? monthNamesShort[m] : `${m + 1}`;
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
        todayStr = formatDateToString(now);
        const taskDaySet = new Set();
         tasks.filter(t=>t.completed).forEach(t => { if(t.date) taskDaySet.add(t.date); });
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
         const thisWeekTasks = tasks.filter(t=>{ if(!t.completed||!t.date) return false; const [d,m,y]=t.date.split('-').map(Number); const dd=new Date(y,m-1,d); return dd>=weekStart; }).length;
         const prevWeekTasks = tasks.filter(t=>{ if(!t.completed||!t.date) return false; const [d,m,y]=t.date.split('-').map(Number); const dd=new Date(y,m-1,d); return dd>=prevStart&&dd<weekStart; }).length;
         document.getElementById('weekly-avg-tasks').textContent = thisWeekTasks;
         document.getElementById('prev-week-tasks').textContent = prevWeekTasks;
         const weekBar = document.getElementById('weekly-avg-bar');
         if (weekBar) { const maxW = Math.max(thisWeekTasks,prevWeekTasks,1); setTimeout(()=>{ weekBar.style.width = Math.min((thisWeekTasks/maxW)*100,100)+'%'; },300); }
         setTrend('trend-peak', maxH > 0 ? 0 : 0, '');
 
         updateGlobalStreak();
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
         const todayStr = formatDateToString(new Date());
 
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
         const isPlanned = FocusStorage.getRaw('weekly_planned') === currentWeekStr;
         if (!isPlanned) {
             weeklyBanner.style.display = 'flex';
         } else {
             weeklyBanner.style.display = 'none';
         }
     }
     checkBannerVisibility();
 
     function openPlanWizardOrAction() {
         const isPlanned = FocusStorage.getRaw('weekly_planned') === currentWeekStr;
         if (isPlanned) {
             actionModal.classList.remove('hidden');
         } else {
             document.getElementById('w-stat-tasks').textContent = tasks.filter(t => t.completed).length;
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
         tasks = tasks.filter(t => t.weekStr !== currentWeekStr);
         for(let date in calendarEvents) {
             calendarEvents[date] = calendarEvents[date].filter(e => e.weekStr !== currentWeekStr);
             if(calendarEvents[date].length === 0) delete calendarEvents[date];
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
         let tasksToEdit = tasks.filter(t => t.weekStr === currentWeekStr);
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
 
             let dayName = dayNames[currDate.getDay() === 0 ? 0 : currDate.getDay() ];
             let shortDate = `${currDate.getDate()} ${monthNamesShort[currDate.getMonth()]}`;
 
             let tab = document.createElement('div');
             tab.className = `wizard-day-tab ${i === 0 ? 'active' : ''}`;
             tab.innerHTML = `<strong>${dayName}</strong><span style="font-size:10px; opacity:0.8;">${shortDate}</span>`;
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
         if(calendarEvents[date]) {
             calendarEvents[date].forEach(ev => { 
                 if (ev.weekStr !== currentWeekStr) {
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
 
         if(calendarEvents[currentDate]) {
             calendarEvents[currentDate].forEach(ev => {
                 if (ev.weekStr !== currentWeekStr) { 
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
                 const pg = goals.find(g => String(g.id) === String(t.parentGoal));
                 if (pg) {
                     badgeHTML = `<span class="task-category-tag" style="background: rgba(108, 92, 231, 0.1); color: var(--primary-color); border: 1px solid rgba(108, 92, 231, 0.2); display:inline-flex; font-size:10px; padding:2px 6px; margin-top:4px;"><i class="fa-solid fa-bullseye"></i> ${escapeHtml(pg.title)}</span>`;
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
                 if (el) window.removeStagedTask(el.dataset.id);
             });
         }
         checkBurnout();
     }

     window.removeStagedTask = function(id) { stagedTasks = stagedTasks.filter(t => String(t.id) !== String(id)); renderStagedTasks(); };
 
     function renderPrioritySelection() {
         const container = document.getElementById('wiz-priority-selection');
         container.innerHTML = '';
         selectedPriorities = []; 
         document.getElementById('wiz-priority-warning').style.display = 'none';
 
         stagedTasks.forEach(t => {
             const [d, m, y] = t.date.split('-'); // GÜNCELLEME: d, m, y sırasına alındı
             const shortDate = `${parseInt(d)} ${monthNamesShort[parseInt(m)-1]}`;
 
             container.innerHTML += `
                 <label class="priority-select-item" id="priority-label-${t.id}">
                     <input type="checkbox" class="priority-checkbox" value="${t.id}">
                     <div style="display:flex; flex-direction:column;">
                         <span style="color:#fff; font-weight:500; font-size:14px;">${escapeHtml(t.name)}</span>
                         <span style="color:var(--text-muted); font-size:12px;">${shortDate} | ${t.start} - ${t.end}</span>
                     </div>
                 </label>
             `;
         });
         if (!container.dataset.delegated) {
             container.dataset.delegated = '1';
             container.addEventListener('change', (e) => {
                 const cb = e.target.closest('.priority-checkbox');
                 if (cb) window.handlePrioritySelection(cb);
             });
         }
     }

     window.handlePrioritySelection = function(cb) {
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
         tasks = tasks.filter(t => t.weekStr !== currentWeekStr);
         for(let date in calendarEvents) {
             calendarEvents[date] = calendarEvents[date].filter(e => e.weekStr !== currentWeekStr);
             if(calendarEvents[date].length === 0) delete calendarEvents[date];
         }
 
         stagedTasks.forEach(st => {
             const isTopPriority = selectedPriorities.includes(String(st.id));
             const taskPriority = isTopPriority ? 'high' : 'medium';
             
             tasks.push({ id: st.id, text: st.name, completed: false, priority: taskPriority, category: 'is', date: st.date, timeStart: st.start, timeEnd: st.end, weekStr: currentWeekStr, parentGoal: st.parentGoal });
             
             if(!calendarEvents[st.date]) calendarEvents[st.date] = [];
             calendarEvents[st.date].push({ id: st.id, text: st.name, timeStart: st.start, timeEnd: st.end, priority: taskPriority, weekStr: currentWeekStr, parentGoal: st.parentGoal });
         });
         
         saveTasks();
         FocusStorage.setRaw('weekly_planned', currentWeekStr);
         
         wizardModal.classList.add('hidden');
         checkBannerVisibility(); 
         
         renderTasks(); renderCalendar(); renderEvents();
         if(renderStatisticsRef && document.getElementById('istatistikler').classList.contains('active')) renderStatisticsRef();
         if(renderSocialStatsRef && document.getElementById('arkadaslar').classList.contains('active')) renderSocialStatsRef();
         if(renderBuddyHabitsRef && document.getElementById('arkadaslar').classList.contains('active')) renderBuddyHabitsRef();
         
         showPremiumModal({title: 'Hafta Kilitlendi!', message: 'Tüm planlarınızı ve önceliklerinizi takvime yerleştirdik. Verimli bir hafta dileriz!', type: 'success'});
     };
 
     function getLogicalReflectionDate() {
         let d = new Date();
         if (d.getHours() < 3) {
             d.setDate(d.getDate() - 1);
         }
         return formatDateToString(d);
     }
 
     function isReflectionTime() {
         const h = new Date().getHours();
         return (h >= 20 || h < 3); 
     }
 
     // Sidebar/dock "Akşam Yansıması" butonları kaldırıldı (giriş noktası artık
     // Zihin Kütüphanesi'ndeki "Günü Değerlendir"). Bu fonksiyon sadece akşam
     // saatinde o günün kaydı hiç yoksa modalı bir kez otomatik açar.
     function checkEveningReflection() {
         if (!isReflectionTime()) return;
         const logDate = toInputDate(getLogicalReflectionDate());
         const journalEntries = FocusStorage.get('focusai_journal_entries', []);
         const todayEntry = journalEntries.find(e => e.date === logDate);
         if (!todayEntry) openReflectionModal();
     }
 
     function openReflectionModal() {
         const logDate = toInputDate(getLogicalReflectionDate());
         const journalEntries = FocusStorage.get('focusai_journal_entries', []);
         const todayRef = journalEntries.find(e => e.date === logDate);

         const achieveInput = document.getElementById('reflection-achieve');
         const improveInput = document.getElementById('reflection-improve');

         if (achieveInput) achieveInput.value = (todayRef && todayRef.achieve) ? todayRef.achieve : '';
         if (improveInput) improveInput.value = (todayRef && todayRef.improve) ? todayRef.improve : '';

         updateCharCounter('reflection-achieve', 'char-count-achieve', JOURNAL_CHAR_LIMIT);
         updateCharCounter('reflection-improve', 'char-count-improve', JOURNAL_CHAR_LIMIT);

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
             const logDate = toInputDate(getLogicalReflectionDate());
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
             const logDate = toInputDate(getLogicalReflectionDate()); // yyyy-mm-dd — kütüphane renderer ile eşleşir
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

            updateCharCounter('edit-journal-achieve', 'edit-char-count-achieve', JOURNAL_CHAR_LIMIT);
            updateCharCounter('edit-journal-improve', 'edit-char-count-improve', JOURNAL_CHAR_LIMIT);

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
 
     const coWorkingIdle = document.getElementById('co-working-idle');
     const coWorkingActive = document.getElementById('co-working-active');
     const cwMinutesDisplay = document.getElementById('cw-minutes');
     const cwSecondsDisplay = document.getElementById('cw-seconds');
     const cwFriendImg = document.getElementById('cw-friend-img');
     const cwFriendName = document.getElementById('cw-friend-name');
     const cwLeaveBtn = document.getElementById('cw-leave-btn');
     const cwPokeBtn = document.getElementById('cw-poke-btn');
     
     const inviteModal = document.getElementById('coworking-invite-modal');
     const inviteFriendName = document.getElementById('invite-friend-name');
     const acceptInviteBtn = document.getElementById('accept-invite-btn');
     const declineInviteBtn = document.getElementById('decline-invite-btn');
     
     let cwTimerInterval;
     let cwTimeLeft = 25 * 60;
     
     window.sendCoWorkingInvite = function(name, avatar) {
         showPremiumModal({
             title: 'Davet Gönderildi',
             message: `${name} adlı arkadaşına sanal odak odası daveti gönderildi. Yanıt bekleniyor...`,
             type: 'info'
         });
         
         setTimeout(() => {
             premiumModal.classList.add('hidden');
             startCoWorkingRoom(name, avatar);
             showPremiumModal({
                 title: 'Davet Kabul Edildi!',
                 message: `${name} davetini kabul etti. Ortak odaklanma seansı başlıyor!`,
                 type: 'success'
             });
         }, 2500);
     };
     
     function simulateIncomingInvite() {
     }
     
     
     function startCoWorkingRoom(friendName, friendAvatar) {
         if(coWorkingIdle && coWorkingActive) {
             coWorkingIdle.classList.add('hidden');
             coWorkingActive.classList.remove('hidden');
             
             cwFriendName.textContent = friendName;
             cwFriendImg.src = friendAvatar;
             
             cwTimeLeft = 25 * 60;
  
            updateCwTimerDisplay();
             
             clearInterval(cwTimerInterval);
             cwTimerInterval = setInterval(() => {
                 cwTimeLeft--;
                 updateCwTimerDisplay();
                 if(cwTimeLeft <= 0) {
                     clearInterval(cwTimerInterval);
                     showPremiumModal({
                         title: 'Ortak Seans Bitti!',
                         message: `Harika iş çıkardınız! ${friendName} ile ortak odaklanma seansını başarıyla tamamladınız. Sana +50 XP eklendi!`,
                         type: 'success'
                     });
                     leaveCoWorkingRoom();
                 }
             }, 1000);
         }
     }
     
     function updateCwTimerDisplay() {
         if(!cwMinutesDisplay || !cwSecondsDisplay) return;
         const m = Math.floor(cwTimeLeft / 60);
         const s = cwTimeLeft % 60;
         cwMinutesDisplay.textContent = String(m).padStart(2, '0');
         cwSecondsDisplay.textContent = String(s).padStart(2, '0');
     }
     
     function leaveCoWorkingRoom() {
         clearInterval(cwTimerInterval);
         if(coWorkingActive && coWorkingIdle) {
             coWorkingActive.classList.add('hidden');
             coWorkingIdle.classList.remove('hidden');
         }
     }
     
     
     if(cwPokeBtn) {
         cwPokeBtn.addEventListener('click', () => {
             showPremiumModal({
                 title: 'Motivasyon Gönderildi!',
                 message: `Arkadaşını dürttün! Onun ekranında motivasyon gönderdiğine dair şık bir bildirim belirecek.`,
                 type: 'success'
             });
         });
     }
 
     // TEK PANEL: sosyal sekme geçiş kodu kaldırıldı — tek panel dc-chat-area içinde yönetiliyor.
 
     const mockGroups = [
         {
             id: "g1",
             name: "YKS 2025 Sayısal",
             desc: "Derece isteyenler burada. Minimum günlük 4 saat odaklanma hedefi.",
             members: 145,
             weeklyGoalMax: 50000,
             weeklyGoalCurrent: 38500,
             leaderboard: [
                 { name: "Ahmet Y.", score: 2100, isMe: false },
                 { name: "Sen", score: 1850, isMe: true },
                 { name: "Zeynep K.", score: 1720, isMe: false },
                 { name: "Caner T.", score: 1500, isMe: false },
                 { name: "Elif B.", score: 1240, isMe: false }
             ],
             activeMembers: [
                 { name: "Ahmet", status: "Matematik Çözüyor", avatar: "A", color: "#e84393" },
                 { name: "Zeynep", status: "Fizik Tekrarı", avatar: "Z", color: "#00b894" },
                 { name: "Kerem", status: "Deneme Sınavı", avatar: "K", color: "#0984e3" },
                 { name: "Sen", status: "Biyoloji Okuması", avatar: "S", color: "#6c5ce7", isMe: true }
             ]
         },
         {
             id: "g2",
             name: "Yazılım Bootcamp Cohort 3",
             desc: "Frontend ve Backend geliştiricileri. Birlikte kodluyoruz.",
             members: 42,
             weeklyGoalMax: 20000,
             weeklyGoalCurrent: 8400,
             leaderboard: [
                 { name: "Oğuzhan", score: 1400, isMe: false },
                 { name: "Merve", score: 1250, isMe: false },
                 { name: "Sen", score: 900, isMe: true },
                 { name: "Ali", score: 850, isMe: false }
             ],
             activeMembers: [
                 { name: "Oğuzhan", status: "React Projesi", avatar: "O", color: "#fdcb6e" },
                 { name: "Merve", status: "API Entegrasyonu", avatar: "M", color: "#d63031" }
             ]
         },
         {
             id: "g3",
             name: "Kitap Okuma Kulübü",
             desc: "Günde en az 30 sayfa. Zihni dinlendir.",
             members: 210,
             weeklyGoalMax: 10000,
             weeklyGoalCurrent: 9500,
             leaderboard: [
                 { name: "Ayşe", score: 800, isMe: false },
                 { name: "Fatma", score: 750, isMe: false },
                 { name: "Sen", score: 300, isMe: true }
             ],
             activeMembers: [
                 { name: "Ayşe", status: "Suç ve Ceza", avatar: "A", color: "#6c5ce7" }
             ]
         }
     ];
 
     function renderMyGroups() {
         const container = document.getElementById('my-groups-container');
         if(!container) return;
         
         container.innerHTML = '';
         
         mockGroups.forEach(group => {
             const card = document.createElement('div');
             card.className = 'group-card';
             card.onclick = () => loadGroupDetails(group.id);
             
             card.innerHTML = `
                 <div class="group-card-header">
                     <div class="group-card-title"><i class="fa-solid fa-layer-group" style="color: var(--primary-color);"></i> ${escapeHtml(group.name)}</div>
                     <div class="group-card-badge">${group.members} Üye</div>
                 </div>
                 <p style="font-size: 13px; color: var(--text-muted); line-height: 1.4;">${escapeHtml(group.desc)}</p>
                 <div class="group-card-stats">
                     <span><i class="fa-solid fa-fire" style="color: #ff9f43;"></i> Hedef: %${Math.round((group.weeklyGoalCurrent / group.weeklyGoalMax) * 100)}</span>
                     <span><i class="fa-solid fa-headset" style="color: #2ed573;"></i> ${group.activeMembers.length} Aktif</span>
                 </div>
             `;
             container.appendChild(card);
         });
     }
 
     function loadGroupDetails(groupId) {
         const group = mockGroups.find(g => g.id === groupId);
         if(!group) return;
 
         const nameEl = document.getElementById('active-group-name');
         if (nameEl) nameEl.innerHTML = `${escapeHtml(group.name)} <i class="fa-solid fa-circle-check" style="color: #00b894; font-size: 16px;"></i>`;
         
         const descEl = document.getElementById('active-group-desc');
         if (descEl) descEl.textContent = group.desc;
 
         const goalPercent = Math.round((group.weeklyGoalCurrent / group.weeklyGoalMax) * 100);
         const gpEl = document.getElementById('group-goal-percent');
         if (gpEl) gpEl.textContent = `%${goalPercent}`;
         
         const gtEl = document.getElementById('group-goal-text');
         if (gtEl) gtEl.textContent = `${group.weeklyGoalCurrent.toLocaleString()} / ${group.weeklyGoalMax.toLocaleString()} dk`;
         
         setTimeout(() => {
             const gfEl = document.getElementById('group-goal-fill');
             if (gfEl) gfEl.style.width = `${goalPercent}%`;
         }, 100);
 
         const membersContainer = document.getElementById('group-study-members');
         const gacEl = document.getElementById('group-active-count');
         if (gacEl) gacEl.innerHTML = `<i class="fa-solid fa-circle" style="font-size: 8px;"></i> ${group.activeMembers.length} Aktif`;
         
         if (membersContainer) {
             membersContainer.innerHTML = '';
             group.activeMembers.forEach(member => {
                 const memberDiv = document.createElement('div');
                 memberDiv.className = 'study-member';
                 const borderStyle = member.isMe ? `border: 2px solid var(--primary-color); box-shadow: 0 0 15px rgba(108, 92, 231, 0.4);` : `border: 2px solid #2ed573; box-shadow: 0 0 10px rgba(46, 213, 115, 0.2);`;
                 
                 memberDiv.innerHTML = `
                     <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=${member.color.replace('#','')}&color=fff" style="${borderStyle}">
                     <div class="study-member-info">
                         <span class="study-member-name">${escapeHtml(member.name)} ${member.isMe ? '(Sen)' : ''}</span>
                         <span class="study-member-status"><i class="fa-solid fa-bolt"></i> ${member.status}</span>
                     </div>
                 `;
                 membersContainer.appendChild(memberDiv);
             });
         }
 
         const leaderboardContainer = document.getElementById('group-leaderboard-list');
         if (leaderboardContainer) {
             leaderboardContainer.innerHTML = '';
             group.leaderboard.forEach((user, index) => {
                 const li = document.createElement('li');
                 li.style.display = 'flex';
                 li.style.justifyContent = 'space-between';
                 li.style.alignItems = 'center';
                 li.style.padding = '12px 15px';
                 li.style.background = user.isMe ? 'rgba(108, 92, 231, 0.15)' : 'rgba(0,0,0,0.2)';
                 li.style.borderRadius = '12px';
                 li.style.border = user.isMe ? '1px solid rgba(108, 92, 231, 0.3)' : '1px solid var(--glass-border)';
 
                 let rankIcon = `<span style="color: var(--text-muted); font-weight: bold; width: 20px;">#${index + 1}</span>`;
                 if (index === 0) rankIcon = `<i class="fa-solid fa-medal" style="color: #f1c40f; width: 20px; font-size: 18px;"></i>`;
                 else if (index === 1) rankIcon = `<i class="fa-solid fa-medal" style="color: #bdc3c7; width: 20px; font-size: 18px;"></i>`;
                 else if (index === 2) rankIcon = `<i class="fa-solid fa-medal" style="color: #cd7f32; width: 20px; font-size: 18px;"></i>`;
 
                 li.innerHTML = `
                     <div style="display: flex; align-items: center; gap: 15px;">
                         ${rankIcon}
                         <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random" style="width: 30px; height: 30px; border-radius: 50%;">
                         <span style="color: #fff; font-weight: ${user.isMe ? '600' : '500'};">${escapeHtml(user.name)}</span>
                     </div>
                     <div style="color: #2ed573; font-weight: 600; font-size: 14px;">${user.score} XP</div>
                 `;
                 leaderboardContainer.appendChild(li);
             });
         }
     }
 
     
 // ════════════════════════════════════════════════════════════
     // PREMIUM TAKVİM — Aylık / Haftalık / Günlük Görünüm Sistemi
     // ════════════════════════════════════════════════════════════
 
     let currentCalView = 'monthly';
     const CAL_HOUR_START = 0;
     const CAL_HOUR_END = 23;
     const DAY_NAMES_LOCAL = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
 
     function getWeekStart(date) {
         const d = new Date(date);
         const day = d.getDay();
         const diff = day === 0 ? -6 : 1 - day;
         d.setDate(d.getDate() + diff);
         d.setHours(0,0,0,0);
         return d;
     }
 
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
             const ws = getWeekStart(selectedDate);
             const we = new Date(ws); we.setDate(we.getDate() + 6);
             el.textContent = `${ws.getDate()} ${monthNamesShort[ws.getMonth()]} – ${we.getDate()} ${monthNamesShort[we.getMonth()]} ${we.getFullYear()}`;
         } else {
             el.textContent = selectedDate.toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
         }
     }
 
     // ── GÜN DETAY DRAWER ──────────────────────────────────────────
     function openDayDrawer(dateStr) {
         const drawer = document.getElementById('cal-day-drawer');
         if (!drawer) return;

         const todayStr = formatDateToString(new Date());
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
         const todayStr = formatDateToString(new Date());
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
             const usedMin = dayEvents.reduce((s, ev) => s + Math.max(0, timeToMins(ev.timeEnd || '10:00') - timeToMins(ev.timeStart || '09:00')), 0);
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
                     const sds = formatDateToString(sd);
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
                     const pds = formatDateToString(pd);
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
         renderCalendar();
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
             _cddTEnd.value = addOneHour(_cddTStart.value);
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
         const tEnd     = tEEl  ? tEEl.value   : addOneHour(tStart);
         const goalId   = goalEl ? goalEl.value : '';
         const ds       = formatDateToString(selectedDate);
         const sMins    = timeToMins(tStart);
         const eMins    = timeToMins(tEnd);

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
             s + Math.max(0, timeToMins(ev.timeEnd || '10:00') - timeToMins(ev.timeStart || '09:00')), 0);
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
         renderCalendar();
         renderEvents();
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
             if (view === 'monthly') { renderCalendar(); renderEvents(); }
             else if (view === 'weekly') renderWeeklyView();
             else renderDailyView();
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
             if (view === 'monthly') { renderCalendar(); renderEvents(); }
             else if (view === 'weekly') renderWeeklyView();
             else renderDailyView();
         }, 120);
     }
 
     function calUnifiedPrev() {
         if (currentCalView === 'monthly') { 
             currentDate.setMonth(currentDate.getMonth() - 1); 
             renderCalendar(); 
         }
         else if (currentCalView === 'weekly') { 
             selectedDate = new Date(selectedDate); 
             selectedDate.setDate(selectedDate.getDate() - 7); 
             currentDate = new Date(selectedDate); // Üst tarafı senkronize etmek için
             renderWeeklyView(); 
         }
         else { 
             selectedDate = new Date(selectedDate); 
             selectedDate.setDate(selectedDate.getDate() - 1); 
             currentDate = new Date(selectedDate); // Üst tarafı senkronize etmek için
             renderDailyView(); 
         }
         updateCalUnifiedTitle();
     }
 
     function calUnifiedNext() {
         if (currentCalView === 'monthly') { 
             currentDate.setMonth(currentDate.getMonth() + 1); 
             renderCalendar(); 
         }
         else if (currentCalView === 'weekly') { 
             selectedDate = new Date(selectedDate); 
             selectedDate.setDate(selectedDate.getDate() + 7); 
             currentDate = new Date(selectedDate); // Üst tarafı senkronize etmek için
             renderWeeklyView(); 
         }
         else { 
             selectedDate = new Date(selectedDate); 
             selectedDate.setDate(selectedDate.getDate() + 1); 
             currentDate = new Date(selectedDate); // Üst tarafı senkronize etmek için
             renderDailyView(); 
         }
         updateCalUnifiedTitle();
     }
 
     function calUnifiedToday() {
         const t = new Date();
         currentDate = new Date(t);
         selectedDate = new Date(t);
         updateCalUnifiedTitle();
         if (currentCalView === 'monthly') { renderCalendar(); renderEvents(); }
         else if (currentCalView === 'weekly') renderWeeklyView();
         else renderDailyView();
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
                             if (typeof renderCalendar === 'function') renderCalendar();
                             if (typeof renderEvents === 'function') renderEvents();
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
     // HAFTALIK GÖRÜNÜM
     // ────────────────────────────────────────────
     window.renderWeeklyView = function() {
         function computeChipColumns(evs) {
             const items = evs.map(ev => ({
                 ev,
                 start: timeToMins(ev.timeStart || '0:00'),
                 end:   timeToMins(ev.timeEnd   || '1:00'),
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
         const weekStart = getWeekStart(selectedDate);
         const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });
         const todayStr = formatDateToString(new Date());
         let html = '';
 
         // Köşe + Gün başlıkları
         html += `<div class="weekly-corner"></div>`;
         days.forEach((d, i) => {
             const ds = formatDateToString(d);
             const isToday = ds === todayStr;
            html += `<div class="weekly-day-header${isToday ? ' today-col' : ''}" data-action="weekly-day-header-click" data-date="${ds}" style="cursor:pointer;">
                 <div class="wdh-name">${DAY_NAMES_LOCAL[i]}</div>
                 <div class="wdh-num">${d.getDate()}</div>
             </div>`;
         });
 
         // Saat satırları
         for (let h = CAL_HOUR_START; h <= CAL_HOUR_END; h++) {
             html += `<div class="weekly-hour-label">${String(h).padStart(2,'0')}:00</div>`;
             days.forEach(d => {
                 const ds = formatDateToString(d);
                 
                 // ── GERÇEK TEK PARÇA TAŞMA MOTORU (HAFTALIK) ──
                 let cellEvs = [];
                 
                 // Bugün bu saatte başlayan planlar (Aşağı doğru tek parça akar)
                 (calendarEvents[ds] || []).filter(ev => !ev.isLessonPlanDraft).forEach(ev => {
                     const startH = parseInt((ev.timeStart || '0:00').split(':')[0]);
                     if (startH === h) {
                         let startMins = timeToMins(ev.timeStart || '0:00');
                         let endMins = ev.isOvernight ? 1440 : timeToMins(ev.timeEnd || '0:00');
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
                     let prevDs = formatDateToString(prevD);
                     (calendarEvents[prevDs] || []).filter(ev => !ev.isLessonPlanDraft).forEach(ev => {
                         if (ev.isOvernight) {
                             let endMins = timeToMins(ev.timeEnd || '0:00');
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
                         const t = tasks.find(t => String(t.id) === String(ev.id));
                         const done = t && t.completed;
                         const cc = getTaskColor(t);
                         const prioColor = PRIORITY_DOT_COLOR[ev.priority || 'medium'];
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
         const nowDateStr = formatDateToString(now);
         const nowH = now.getHours();
         if (nowH >= CAL_HOUR_START && nowH <= CAL_HOUR_END) {
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
         updateCalUnifiedTitle();
     };
 
     window.weeklyDayHeaderClick = function(ds) {
         const [d,m,y] = ds.split('-').map(Number);
         selectedDate = new Date(y, m-1, d);
         currentDate = new Date(y, m-1, d);
         switchCalView('daily');
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
             document.getElementById('iqa-end').value = addOneHour(this.value);
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
             const end   = document.getElementById('iqa-end').value   || addOneHour(start);
             const prio  = document.getElementById('iqa-priority').value;
             const cat   = document.getElementById('iqa-category').value;
             addGlobalTask(text, prio, cat, _iqaDs, start, end, '', '');
             closeCalInlineAdd();
             if (currentCalView === 'weekly') window.renderWeeklyView();
             else if (currentCalView === 'daily') window.renderDailyView();
             renderCalendar();
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
         const endVal   = addOneHour(startVal);
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

     function snap15(mins) { return Math.min(45, Math.max(0, Math.round(mins / 15) * 15)); }

     // Hücre üzerinde sürüklerken 15dk-snap önizlemesi
     window.calDragOver = function(e, cellEl, h, hourPx) {
         e.preventDefault();
         e.dataTransfer.dropEffect = 'move';
         cellEl.classList.add('drag-over');
         if (!_calDragId) return;

         const snapMins = snap15((e.offsetY / hourPx) * 60);
         const task = tasks.find(t => String(t.id) === String(_calDragId));
         if (!task) return;

         const durMins = Math.max(30, timeToMins(task.timeEnd || '13:00') - timeToMins(task.timeStart || '12:00'));
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
         const ev = (calendarEvents[ds] || []).find(x => String(x.id) === String(id));
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
             const snapMins = snap15((e.offsetY / 60) * 60);
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
 
         const dateStr = formatDateToString(selectedDate);
         const todayStr = formatDateToString(new Date());
         const now = new Date();
         const dayEvs = (calendarEvents[dateStr] || []).filter(e => !e.isLessonPlanDraft);
 
         if (titleEl) titleEl.textContent = selectedDate.toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
         if (countEl) countEl.textContent = `${dayEvs.length} Plan`;
 
         // İlerleme halkası
         const ringWrap = document.getElementById('daily-ring-wrap');
         const ringCircle = document.getElementById('daily-ring-circle');
         const ringText = document.getElementById('daily-ring-text');
         if (ringWrap) {
             if (dayEvs.length > 0) {
                 ringWrap.style.display = 'block';
                 const done = dayEvs.filter(ev => { const t = tasks.find(t => String(t.id) === String(ev.id)); return t && t.completed; }).length;
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
                     let startMins = timeToMins(ev.timeStart || '0:00');
                     let endMins = ev.isOvernight ? 1440 : timeToMins(ev.timeEnd || '0:00');
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
                 let prevDate = new Date(selectedDate);
                 prevDate.setDate(prevDate.getDate() - 1);
                 const prevCheck = formatDateToString(prevDate);
                 (calendarEvents[prevCheck] || []).filter(ev => !ev.isLessonPlanDraft).forEach(ev => {
                     if (ev.isOvernight) {
                         let endMins = timeToMins(ev.timeEnd || '0:00');
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
                 const t = tasks.find(t => String(t.id) === String(ev.id));
                 const done = t && t.completed;
                 const cc = getTaskColor(t);
                 const prioColor = PRIORITY_DOT_COLOR[ev.priority || 'medium'];
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
 
         updateCalUnifiedTitle();
     };
 
     window.dailyHourCellClick = function(h, event) {
         if (event) event.stopPropagation();
         const ds = formatDateToString(selectedDate);
         const cell = (event && (event.currentTarget || event.target)) || null;
         openCalInlineAdd(ds, h, cell, event);
     };
 
     window.dailyChipDragStart = function(e, id, ds) {
         e.dataTransfer.setData('taskId', id);
         e.dataTransfer.setData('sourceDate', ds);
         e.stopPropagation();
         _calDragId = id;
         const ev = (calendarEvents[ds] || []).find(x => String(x.id) === String(id));
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
             const snapMins = snap15((e.offsetY / 64) * 60);
             premiumMoveTask(id, srcDate, targetDate, targetHour, snapMins);
         }
     };
 
     // Görevi yeni tarih+saate taşı
     function premiumMoveTask(id, oldDate, newDate, newHour, snapMins) {
         const task = tasks.find(t => String(t.id) === String(id));
         if (!task) return;
         const oldDateStr = oldDate || task.date;
         snapMins = snapMins || 0;

         // Aynı konuma bırakıldıysa işlem yapma
         const oldStartM = timeToMins(task.timeStart || '12:00');
         if (oldDateStr === newDate && Math.floor(oldStartM / 60) === newHour && (oldStartM % 60) === snapMins) return;

         const newStartTotal = newHour * 60 + snapMins;
         const newStart = `${String(newHour).padStart(2,'0')}:${String(snapMins).padStart(2,'0')}`;
         const oldEndM = timeToMins(task.timeEnd || '13:00');
         const durMins = Math.max(30, oldEndM - oldStartM);
         const newEndTotal = Math.min(23 * 60 + 59, newStartTotal + durMins);
         const newEnd = `${String(Math.floor(newEndTotal / 60)).padStart(2,'0')}:${String(newEndTotal % 60).padStart(2,'0')}`;

         task.date = newDate;
         task.timeStart = newStart;
         task.timeEnd = newEnd;

         if (calendarEvents[oldDateStr]) {
             calendarEvents[oldDateStr] = calendarEvents[oldDateStr].filter(e => String(e.id) !== String(id));
             if (!calendarEvents[oldDateStr].length) delete calendarEvents[oldDateStr];
         }
         if (!calendarEvents[newDate]) calendarEvents[newDate] = [];
         calendarEvents[newDate] = calendarEvents[newDate].filter(e => String(e.id) !== String(id));
         calendarEvents[newDate].push({ id: task.id, text: task.text, timeStart: newStart, timeEnd: newEnd, priority: task.priority, parentHabit: task.parentHabit || '' });

         saveTasks();
         renderCalendar();
         if (currentCalView === 'weekly') window.renderWeeklyView();
         else if (currentCalView === 'daily') window.renderDailyView();

         showPremiumModal({ title: 'Plan Taşındı 🗓️', message: `"${escapeHtml(task.text)}" → ${newDate} ${newStart} – ${newEnd}`, type: 'success' });
     }
 
 
     // İlk yükleme: unified title güncelle
     updateCalUnifiedTitle();
 
     // ════════════════════════════════════════════════════════════
 
 
     renderCalendarRef = renderCalendar;
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
         renderEvents();
         const drawer = document.getElementById('cal-day-drawer');
         if (drawer && drawer.classList.contains('open')) {
             const ds = formatDateToString(selectedDate);
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
             renderStatistics();
         });
     });
     renderJournalRef = buildMassiveLibraryRows;
     renderSocialStatsRef = renderSocialStats;
     renderBuddyHabitsRef = renderBuddyHabits;
     renderMindDumpsRef = renderMindDumps;
 
 
     populateParentHabitSelects();
     renderTasks();
     renderEvents();

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
     _runOrDefer('takvim', renderCalendar);
     // Sınıf ödevleri (social.js window.FocusAssignments) yüklendikçe/değiştikçe
     // Bugün listesi ve Takvim'i tazele — ilk render sırasında ödev verisi henüz
     // Supabase'den gelmemiş olabilir, bu event geldiğinde ikisi de güncellenir.
     window.addEventListener('focusai:assignments-updated', () => {
         if (typeof renderTasks === 'function') renderTasks();
         if (typeof renderCalendar === 'function') renderCalendar();
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
     _runOrDefer('zihin-coplugu', renderMindDumps);

     if(document.getElementById('my-groups-container')) {
         renderMyGroups();
         loadGroupDetails("g1");
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
         const todayStr = formatDateToString(new Date());
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
 
     const todayStr = formatDateToString(new Date());
     let yest = new Date();
     yest.setDate(yest.getDate() - 1);
     const yesterdayStr = formatDateToString(yest);
 
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
    else { _deadlineEl.value = toInputDate(formatDateToString(new Date())); }
 }
 function closeGoalModal() {
     goalModal.classList.add('hidden');
 }
 // Not: index.html kendi closeGoalModal/openGoalModal fallback'lerini ayrıca
 // tanımlıyor (script.js'in DOMContentLoaded'ı henüz çalışmamışsa veya
 // hata verirse diye) — bu yüzden yukarıdaki yerel fonksiyon global'e
 // export edilmiyor; index.html'deki tanım gerçek global'i sağlıyor.

 // Modal içinden düzenleme butonuna basınca çalışacak fonksiyon
 window.editGoalInfo = function() {
     const goalId = document.getElementById('detail-active-goal-id').value;
     const goal = goals.find(g => String(g.id) === String(goalId));
     if(!goal) return;
 
     document.getElementById('edit-goal-id').value = goal.id;
     document.getElementById('goal-title-input').value = goal.title;
     document.getElementById('goal-desc-input').value = goal.desc || '';
     document.getElementById('goal-deadline-input').value = goal.deadline || '';
 
     document.getElementById('goal-details-modal').classList.add('hidden');
     goalModal.classList.remove('hidden');
 }
 
 if(btnOpenGoalModal) {
     btnOpenGoalModal._mainListenerAdded = true;
     btnOpenGoalModal.addEventListener('click', openGoalModal);
 }
 if(closeGoalModalBtn) closeGoalModalBtn.addEventListener('click', closeGoalModal);
 if(cancelGoalBtn) cancelGoalBtn.addEventListener('click', closeGoalModal);

 // --- ZAFER MODALI BUTONLARI ---
 const victoryModal = document.getElementById('goal-victory-modal');
 const btnVictoryArchive = document.getElementById('btn-victory-archive');
 const btnVictoryClose = document.getElementById('btn-victory-close');

 if (btnVictoryArchive && victoryModal) {
     btnVictoryArchive.addEventListener('click', () => {
         const goalId = victoryModal._activeGoalId;
         const goal = goals.find(g => String(g.id) === String(goalId));
         if (goal) {
             goal.status = 'completed';
             goal.completedAt = Date.now();
             Store.goals.set(goals);
             if (window.FocusAISocial && typeof window.FocusAISocial.postActivity === 'function') {
                 window.FocusAISocial.postActivity(`"${goal.title}" hedefini başarıyla tamamladı 🏆`);
             }
             renderGoals();
         }
         victoryModal.classList.add('hidden');
         document.getElementById('goal-details-modal').classList.add('hidden');
         if(typeof fireConfetti === 'function') fireConfetti();
         showPremiumModal({ title: 'Başarı Arşivlendi! 🏆', message: 'Tebrikler! Bu büyük başarı artık Başarılarım sekmesinde.', type: 'success' });
     });
 }

 if (btnVictoryClose && victoryModal) {
     btnVictoryClose.addEventListener('click', () => {
         victoryModal.classList.add('hidden');
     });
 }

 if (victoryModal) {
     victoryModal.addEventListener('click', (e) => {
         if (e.target === victoryModal) victoryModal.classList.add('hidden');
     });
 }
 
 window._saveGoalImpl = function() {
     {
         const idToEdit = document.getElementById('edit-goal-id') ? document.getElementById('edit-goal-id').value : '';
         const title = document.getElementById('goal-title-input').value.trim();
         const desc = document.getElementById('goal-desc-input').value.trim();
         const rawDeadline = document.getElementById('goal-deadline-input').value;
            // Flatpickr'dan gelen d-m-Y formatını renderGoals'un beklediği YYYY-MM-DD formatına dönüştürüyoruz
            let deadline = rawDeadline;
            if (rawDeadline && rawDeadline.includes('-')) {
                const parts = rawDeadline.split('-');
                if (parts[0].length === 2) { // Eğer ilk parça gün ise (d-m-Y)
                    deadline = `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD formatına çevir
                }
            }

         // --- YENİ EKLENEN: Kategoriyi Okuma ---
         const categorySelect = document.getElementById('goal-category-input');
         const category = categorySelect ? categorySelect.value : '';
 
         if(!title) {
             showPremiumModal({ title: 'Hata', message: 'Lütfen hedefinizi yazın.', type: 'warning' });
             return;
         }
 
         if (idToEdit) {
             // Düzenleme Modu
             const goal = goals.find(g => String(g.id) === String(idToEdit));
             if (goal) {
                 goal.title = title;
                 goal.desc = desc;
                 goal.deadline = deadline;
                 if(categorySelect) goal.category = category; // Kategoriyi güncelle
                 showPremiumModal({ title: 'Güncellendi!', message: 'Ana hedef başarıyla güncellendi.', type: 'success' });
             }
         } else {
             // Yeni Ekleme Modu
             const activeGoalCount = goals.filter(g => g.status !== 'completed' && g.status !== 'expired').length;
             if (activeGoalCount >= MAX_ACTIVE_GOALS) {
                 showPremiumModal({
                     title: 'Odağını Koru 🎯',
                     message: `Aynı anda en fazla ${MAX_ACTIVE_GOALS} aktif ana hedef belirleyebilirsin. Yeni bir vizyon eklemeden önce mevcut hedeflerinden birini tamamla ya da arşivle.`,
                     type: 'warning'
                 });
                 return;
             }
             goals.push({
                 id: generateId(),
                 title: title,
                 desc: desc,
                 deadline: deadline,
                 category: category, // Kategoriyi kaydet
                 createdAt: Date.now()
             });

             if (window.FocusAISocial && typeof window.FocusAISocial.postActivity === 'function') {
                window.FocusAISocial.postActivity(`"${title}" adında yeni bir ana hedef belirledi 🎯`);
            }
             showPremiumModal({ title: 'Vizyon Belirlendi!', message: 'Harika bir hedef! Şimdi görev ve alışkanlıklarını bu hedefe bağlayabilirsin.', type: 'success' });
         }
         Store.goals.set(goals);
         populateParentHabitSelects();
         renderGoals();
         
         // YENİ DÜZELTME: Bir sonraki ana hedef oluşturulduğunda tarihin eski hedeften referans almasını engellemek için formları sıfırlıyoruz.
         document.getElementById('goal-title-input').value = '';
         document.getElementById('goal-desc-input').value = '';
         if (document.getElementById('goal-deadline-input')._flatpickr) {
             document.getElementById('goal-deadline-input')._flatpickr.setDate(new Date());
         } else {
             document.getElementById('goal-deadline-input').value = toInputDate(formatDateToString(new Date()));
         }

         closeGoalModal();
         
         // Eğer detay paneli arka planda o hedefe aitse ekranı canlandır
         if (idToEdit) {
             openGoalDetails(idToEdit);
         }
     }
 }
 // saveGoalBtn'in onclick="saveGoal()" HTML attribute'u zaten _saveGoalImpl'i çağırıyor.
 // addEventListener ile ikinci kez bağlarsak çift tetiklenip form temizlendikten sonra
 // boş başlık uyarısı gösterir. Bu yüzden addEventListener kullanmıyoruz.
 
 window.deleteGoal = function(id) {
     showPremiumModal({
         title: 'Hedefi Sil',
         message: 'Bu ana hedefi silmek istediğinize emin misiniz? (Bağlı görev ve alışkanlıklar silinmez, sadece bağları kopar).',
         type: 'warning',
         showCancel: true,
         confirmText: 'Sil',
         onConfirm: () => {
             goals = goals.filter(g => String(g.id) !== String(id));
             tasks.forEach(t => { if(t.parentGoal === id) t.parentGoal = ""; });
             habits.forEach(h => { 
                 if(h.parentGoals) h.parentGoals = h.parentGoals.filter(gid => gid !== id);
             });
             saveTasks();
             saveHabits();
            
            habits.forEach(h => { 
                if(h.parentGoals) h.parentGoals = h.parentGoals.filter(gid => gid !== id);
                //  edef silindiğinde bugünkü sahte kilit geçmişini temizler
                const todayStr = formatDateToString(new Date());
                if (h.history && h.history[todayStr]) {
                    delete h.history[todayStr];
                }
            });
           
             Store.goals.set(goals);
             populateParentHabitSelects();
             renderGoals();
         }
     });
 }
 
 function generateAIAnalysis(goal, progress, totalTasks, completedTasks) {
     if (totalTasks === 0) {
         return `<i class="fa-solid fa-wand-magic-sparkles" style="color: #feca57;"></i> <strong>FocusAI Analizi:</strong> "${escapeHtml(goal.title)}" hedefine ulaşmak için henüz aksiyon planı yapmadın. Hemen yeni bir görev oluştur ve bu hedefe bağla. Unutma, planlanmamış bir hedef sadece bir dilektir!`;
     }
     if (progress === 0) {
         return `<i class="fa-solid fa-wand-magic-sparkles" style="color: #feca57;"></i> <strong>FocusAI Analizi:</strong> Adımlarını belirlemişsin ama henüz ilk harekete geçmemişsin. Başlamak bitirmenin yarısıdır. Nedenin: "${goal.desc ? escapeHtml(goal.desc) : 'Kendin için daha iyi bir gelecek.'}" Bunu hatırla ve bugün başla!`;
     }
     if (progress < 50) {
         return `<i class="fa-solid fa-wand-magic-sparkles" style="color: #2ed573;"></i> <strong>FocusAI Analizi:</strong> İlerleme kaydediyorsun! Toplam ${totalTasks} adımın ${completedTasks} tanesini tamamladın. Sadece ivmeni kaybetme, damlaya damlaya göl olur.`;
     }
     if (progress < 100) {
         return `<i class="fa-solid fa-wand-magic-sparkles" style="color: #ff9f43;"></i> <strong>FocusAI Analizi:</strong> İnanılmaz gidiyorsun! %${progress} oranında tamamladın. "${escapeHtml(goal.title)}" vizyonun artık bir hayal değil, gerçeğe dönüşmek üzere. Odaklan ve bitir!`;
     }
     return `<i class="fa-solid fa-trophy" style="color: #feca57;"></i> <strong>FocusAI Analizi:</strong> TEBRİKLER! Bu vizyonu %100 tamamladın. Kendine verdiğin sözü tuttun. Şimdi bu başarıyı kutla ve kendine daha büyük zirveler belirle!`;
 }
 
 // ============ HEDEF SEKMELERİ VE SIRALAMA MANTIĞI ============
 let currentGoalFilter = 'active';
 
 const goalTabBtns = document.querySelectorAll('.goal-tab-btn');
 goalTabBtns.forEach(btn => {
     btn.addEventListener('click', () => {
         goalTabBtns.forEach(b => b.classList.remove('active'));
         btn.classList.add('active');
         currentGoalFilter = btn.getAttribute('data-goal-filter');
         renderGoals(); // Sekme değişince listeyi yenile
     });
 });
 
 const goalSortSelect = document.getElementById('goal-sort-select');
 if (goalSortSelect) {
     goalSortSelect.addEventListener('change', () => {
         renderGoals(); // Menüden yeni sıralama seçilince listeyi yenile
     });
 }
 
 window.renderGoals = function() {
     if(!goalsContainer) return;
     goalsContainer.innerHTML = '';

     // Başarılarım veya Süresi Dolanlar sekmesindeyken özet banner göster
     if (currentGoalFilter === 'completed' || currentGoalFilter === 'expired') {
         const wonGoals = goals.filter(g => g.status === 'completed');
         const expiredGoals = goals.filter(g => g.status === 'expired');
         if (wonGoals.length > 0 || expiredGoals.length > 0) {
             const banner = document.createElement('div');
             banner.style.cssText = 'display:flex; gap:12px; margin-bottom:16px; flex-wrap:wrap;';
             banner.innerHTML = `
                 <div style="flex:1; min-width:120px; background: rgba(254,202,87,0.1); border: 1px solid rgba(254,202,87,0.25); border-radius:12px; padding:14px 18px; display:flex; align-items:center; gap:10px;">
                     <span style="font-size:24px;">🏆</span>
                     <div><div style="font-size:22px; font-weight:800; color:#feca57; line-height:1;">${wonGoals.length}</div><div style="font-size:11px; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:.5px;">Başarı</div></div>
                 </div>
                 <div style="flex:1; min-width:120px; background: rgba(255,71,87,0.08); border: 1px solid rgba(255,71,87,0.2); border-radius:12px; padding:14px 18px; display:flex; align-items:center; gap:10px;">
                     <span style="font-size:24px;">⏰</span>
                     <div><div style="font-size:22px; font-weight:800; color:#ff4757; line-height:1;">${expiredGoals.length}</div><div style="font-size:11px; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:.5px;">Süre Doldu</div></div>
                 </div>
                 <div style="flex:1; min-width:120px; background: rgba(108,92,231,0.08); border: 1px solid rgba(108,92,231,0.2); border-radius:12px; padding:14px 18px; display:flex; align-items:center; gap:10px;">
                     <span style="font-size:24px;">📊</span>
                     <div><div style="font-size:22px; font-weight:800; color:#a29bfe; line-height:1;">${wonGoals.length + expiredGoals.length > 0 ? Math.round((wonGoals.length / (wonGoals.length + expiredGoals.length)) * 100) : 0}%</div><div style="font-size:11px; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:.5px;">Başarı Oranı</div></div>
                 </div>
             `;
             goalsContainer.appendChild(banner);
         }
     }

     // Sekme butonlarına sayı badge'i ekle (early return'dan ÖNCE yapılmalı)
     const wonCount = goals.filter(g => g.status === 'completed').length;
     const expiredCount = goals.filter(g => g.status === 'expired').length;
     const activeCount = goals.filter(g => g.status !== 'completed' && g.status !== 'expired').length;
     const victoryTabBtn = document.querySelector('.goal-tab-btn[data-goal-filter="completed"]');
     const expiredTabBtn = document.querySelector('.goal-tab-btn[data-goal-filter="expired"]');
     const activeTabBtn = document.querySelector('.goal-tab-btn[data-goal-filter="active"]');
     if (victoryTabBtn) victoryTabBtn.innerHTML = `<i class="fa-solid fa-trophy" style="color:#feca57;"></i> Başarılarım${wonCount > 0 ? ` <span style="background:rgba(254,202,87,0.2);color:#feca57;padding:1px 7px;border-radius:10px;font-size:11px;font-weight:700;margin-left:4px;">${wonCount}</span>` : ''}`;
     if (expiredTabBtn) expiredTabBtn.innerHTML = `⏳ Süresi Dolanlar${expiredCount > 0 ? ` <span style="background:rgba(255,71,87,0.2);color:#ff4757;padding:1px 7px;border-radius:10px;font-size:11px;font-weight:700;margin-left:4px;">${expiredCount}</span>` : ''}`;
     if (activeTabBtn) activeTabBtn.innerHTML = `<i class="fa-solid fa-mountain-sun"></i> Aktif Hedefler${activeCount > 0 ? ` <span style="background:rgba(108,92,231,0.2);color:#a29bfe;padding:1px 7px;border-radius:10px;font-size:11px;font-weight:700;margin-left:4px;">${activeCount}</span>` : ''}`;

     // "+ Yeni Hedef" butonuna aktif/limit sayısını göster; limite ulaşınca soluklaştır
     if (btnOpenGoalModal) {
         const atLimit = activeCount >= MAX_ACTIVE_GOALS;
         btnOpenGoalModal.innerHTML = `<i class="fa-solid fa-plus"></i> Yeni Hedef <span style="opacity:.75; font-weight:500; font-size:12px;">(${activeCount}/${MAX_ACTIVE_GOALS})</span>`;
         btnOpenGoalModal.style.opacity = atLimit ? '0.55' : '';
         btnOpenGoalModal.title = atLimit ? `Aynı anda en fazla ${MAX_ACTIVE_GOALS} aktif ana hedef belirleyebilirsin.` : '';
     }

     if(goals.length === 0) {
         goalsContainer.innerHTML = `
         <div class="glass-element" style="text-align: center; padding: 50px 20px; border: 1px dashed rgba(108, 92, 231, 0.3); background: rgba(0,0,0,0.2);">
             <i class="fa-solid fa-mountain" style="font-size: 48px; color: rgba(108, 92, 231, 0.5); margin-bottom: 15px;"></i>
             <h3 style="color: #fff; margin-bottom: 10px;">Henüz Bir Hedefin Yok</h3>
             <p style="color: var(--text-muted); font-size: 14px; font-style: italic; margin-bottom: 20px; line-height: 1.6;">"Büyük yolculuklar tek bir adımla başlar..." <br><span style="font-size:12px; opacity:0.7; color: var(--primary-color); font-weight: 600;"><i class="fa-solid fa-wand-magic-sparkles"></i> FocusAI</span></p>
             <button data-action="open-goal-modal" class="primary-btn" style="margin: 0 auto; justify-content: center;"><i class="fa-solid fa-plus"></i> İlk Hedefini Belirle</button>
         </div>`;
         return;
     };

     let displayedCount = 0;
     const sortType = goalSortSelect ? goalSortSelect.value : 'newest';

     // Hedefleri render etmeden önce ilerleme yüzdelerini hesaplayıp sıralamak için geçici bir dizi oluşturuyoruz
     let processedGoals = goals.map(goal => {
         let linkedTasks = tasks.filter(t => t.parentGoal === goal.id);
         let linkedHabits = habits.filter(h => h.parentGoals && h.parentGoals.includes(goal.id));
         
         let totalSteps = linkedTasks.length;
         let completedSteps = linkedTasks.filter(t => t.completed).length;
 
         linkedHabits.forEach(h => {
             totalSteps += (h.targetDays || 21);
             completedSteps += Object.keys(h.history).length;
         });
 
         // Milestone katkısı
         if (goal.milestones && goal.milestones.length > 0) {
             totalSteps += goal.milestones.length;
             completedSteps += goal.milestones.filter(m => m.completed).length;
         }
 
         let progress = totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100);
         if (progress > 100) progress = 100;
 
         const milestoneTotal = goal.milestones ? goal.milestones.length : 0;
         const milestoneDone  = goal.milestones ? goal.milestones.filter(m => m.completed).length : 0;

         // Hesaplanan verileri (progress, adımlar) geçici objeye kaydediyoruz
         return {
             ...goal,
             _progress: progress,
             _totalSteps: totalSteps,
             _completedSteps: completedSteps,
             _linkedTasks: linkedTasks,
             _linkedHabits: linkedHabits,
             _milestoneTotal: milestoneTotal,
             _milestoneDone: milestoneDone,
         };
     });
 
     // --- SIRALAMA (SORT) İŞLEMİ ---
     processedGoals.sort((a, b) => {
         if (sortType === 'deadline') {
             return new Date(a.deadline) - new Date(b.deadline); // Yakın tarih önce
         } else if (sortType === 'progress-high') {
             return b._progress - a._progress; // Yüksek yüzde önce
         } else if (sortType === 'progress-low') {
             return a._progress - b._progress; // Düşük yüzde önce
         } else {
             return (b.createdAt || 0) - (a.createdAt || 0); // En yeni eklenen önce
         }
     });
 
     processedGoals.forEach(goal => {
         // Filtre (Aktif/Başarılarım/Süresi Dolanlar) kontrolü - İlerleme %100 olsa bile durum completed veya expired olmadan arşiv sekmesine gitmez
         const isArchived = goal.status === 'completed' || goal.status === 'expired';
         if (currentGoalFilter === 'active' && isArchived) return;
         if (currentGoalFilter === 'completed' && goal.status !== 'completed') return;
         if (currentGoalFilter === 'expired' && goal.status !== 'expired') return;

         displayedCount++;

         // --- ZAFERLERİ ÖZEL KART RENDER ---
         if (isArchived) {
             const isWon = goal.status === 'completed';
             const startDate = new Date(goal.createdAt || Date.now());
             const endDate = new Date(goal.completedAt || Date.now());
             const diffMs = endDate - startDate;
             const diffDaysTotal = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
             const durationText = diffDaysTotal === 0 ? 'Aynı gün' : diffDaysTotal === 1 ? '1 gün' : `${diffDaysTotal} gün`;
             const emoji = isWon ? '🏆' : '⏰';
             const cardBorder = isWon ? 'rgba(254,202,87,0.35)' : 'rgba(255,71,87,0.25)';
             const cardBg = isWon ? 'linear-gradient(135deg, rgba(254,202,87,0.07), rgba(0,0,0,0.25))' : 'linear-gradient(135deg, rgba(255,71,87,0.06), rgba(0,0,0,0.25))';
             const accentColor = isWon ? '#feca57' : '#ff4757';
             const accentBg = isWon ? 'rgba(254,202,87,0.12)' : 'rgba(255,71,87,0.12)';
             const statusLabel = isWon ? 'Başarıldı!' : 'Süre Doldu';
             const statusIcon = isWon ? 'fa-trophy' : 'fa-hourglass-end';
             const linkedTaskCount = tasks.filter(t => t.parentGoal === goal.id).length;
             const completedTaskCount = tasks.filter(t => t.parentGoal === goal.id && t.completed).length;
             const categoryLabel = goal.category ? goal.category.charAt(0).toUpperCase() + goal.category.slice(1).replace(/-/g, ' ') : '';

             const div = document.createElement('div');
             div.className = 'glass-element';
             div.dataset.id = goal.id;
             div.style.cssText = `border: 1px solid ${cardBorder}; background: ${cardBg}; border-radius: 16px; padding: 22px 24px; position: relative; overflow: hidden; cursor: default;`;
             div.innerHTML = `
                 <div style="position: absolute; top: 0; right: 0; font-size: 90px; opacity: 0.06; line-height: 1; padding: 10px 14px; user-select: none;">${emoji}</div>
                 <div style="display: flex; align-items: flex-start; gap: 16px; position: relative; z-index: 1;">
                     <div style="font-size: 36px; line-height: 1; filter: drop-shadow(0 2px 8px ${accentColor}66); flex-shrink: 0;">${emoji}</div>
                     <div style="flex: 1; min-width: 0;">
                         <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
                             <span style="background: ${accentBg}; color: ${accentColor}; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; border: 1px solid ${accentColor}44;">
                                 <i class="fa-solid ${statusIcon}" style="margin-right:4px;"></i>${statusLabel}
                             </span>
                             ${categoryLabel ? `<span style="background: rgba(108,92,231,0.12); color: #a29bfe; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; border: 1px solid rgba(108,92,231,0.25);">${categoryLabel}</span>` : ''}
                         </div>
                         <div style="font-size: 17px; font-weight: 700; color: #fff; margin-bottom: 4px; line-height: 1.3;">${escapeHtml(goal.title)}</div>
                         ${goal.desc ? `<div style="font-size: 12px; color: var(--text-muted); font-style: italic; margin-bottom: 10px;">"${escapeHtml(goal.desc)}"</div>` : ''}
                         <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px;">
                             <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); background: rgba(255,255,255,0.04); padding: 5px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.07);">
                                 <i class="fa-regular fa-calendar" style="color:${accentColor};"></i>
                                 ${endDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                             </div>
                             <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); background: rgba(255,255,255,0.04); padding: 5px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.07);">
                                 <i class="fa-regular fa-clock" style="color:${accentColor};"></i>
                                 ${durationText} sürdü
                             </div>
                             ${linkedTaskCount > 0 ? `<div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); background: rgba(255,255,255,0.04); padding: 5px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.07);">
                                 <i class="fa-solid fa-list-check" style="color:${accentColor};"></i>
                                 ${completedTaskCount}/${linkedTaskCount} görev
                             </div>` : ''}
                             <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: ${accentColor}; background: ${accentBg}; padding: 5px 12px; border-radius: 8px; border: 1px solid ${accentColor}33;">
                                 <i class="fa-solid fa-chart-simple"></i> %${goal._progress}
                             </div>
                         </div>
                     </div>
                     <div style="display:flex; flex-direction:column; gap:8px; flex-shrink:0;">
                         ${!isWon ? `<button class="control-btn" data-action="extend-goal-deadline" data-id="${goal.id}" title="Süreyi Uzat" style="white-space:nowrap; font-size:12px; font-weight:700; padding:7px 12px; border-radius:8px; background:rgba(255,159,67,0.12); border:1px solid rgba(255,159,67,0.35); color:#ff9f43; display:flex; align-items:center; gap:6px;">
                             <i class="fa-solid fa-calendar-plus"></i> Süreyi Uzat
                         </button>` : ''}
                         <button class="icon-btn delete-icon-btn goal-archive-del-btn" data-action="delete-goal" data-id="${goal.id}" title="Sil" style="opacity:0.4; transition:0.3s; align-self:flex-end; width:30px; height:30px; border-radius:8px; background:rgba(255,255,255,0.05); display:flex; justify-content:center; align-items:center;">
                             <i class="fa-solid fa-trash" style="font-size:12px;"></i>
                         </button>
                     </div>
                 </div>
             `;
             goalsContainer.appendChild(div);
             return;
         }

         let aiText = generateAIAnalysis(goal, goal._progress, goal._totalSteps, goal._completedSteps);
 
         const [y, m, d] = goal.deadline.split('-');
         const deadlineDisplay = `${d} ${monthNamesShort[parseInt(m)-1]} ${y}`;
 
         // --- 3. MADDE: Akıllı Tarih Hesaplaması (Urgency) ---
        const deadlineDate = new Date(y, m - 1, d);
        deadlineDate.setHours(23, 59, 59, 999);
        const today = new Date();
        const diffTime = deadlineDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
         let urgencyClass = 'urgency-safe';
         let urgencyIcon = 'fa-regular fa-calendar-check';
         let urgencyText = deadlineDisplay;
         
         // --- YENİ DURUM VE RENK MOTORU BAŞLANGICI ---
         if (goal.status === 'completed' || goal._progress === 100) {
             // Hedef erken veya zamanında tamamlandıysa yeşil buton
             urgencyClass = 'urgency-safe'; 
             urgencyIcon = 'fa-solid fa-circle-check';
             urgencyText = 'Tamamlandı';
         } else if (diffDays < 0 || goal.status === 'expired') {
             // Süresi bittiyse ve tamamlanmadıysa kırmızı buton
             urgencyClass = 'urgency-danger';
             urgencyIcon = 'fa-solid fa-circle-xmark';
             urgencyText = 'Tamamlanamadı';
         } else if (diffDays == 0) {
             urgencyClass = 'urgency-danger';
             urgencyIcon = 'fa-solid fa-fire-flame-curved';
             urgencyText = 'Bugün Son Gün!';
         } else if (diffDays <= 3) {
             urgencyClass = 'urgency-danger';
             urgencyIcon = 'fa-solid fa-fire-flame-curved';
             urgencyText = `${diffDays} Gün Kaldı!`;
         } else if (diffDays <= 7) {
             urgencyClass = 'urgency-warning';
             urgencyIcon = 'fa-solid fa-hourglass-half';
             urgencyText = `${diffDays} Gün Kaldı`;
         } else {
             urgencyClass = 'urgency-safe';
             urgencyIcon = 'fa-regular fa-calendar-check';
             urgencyText = `${diffDays} Gün Kaldı`;
         }
         // --- YENİ DURUM VE RENK MOTORU BİTİŞİ ---
 
         // --- 5. MADDE: Kart İçi İlerleme Çubuğu Vurgusu ---
         let progressColor = 'linear-gradient(90deg, #0984e3, #74b9ff)'; // %0-30 arası (Mavi)
         
         if (goal._progress === 100) {
             progressColor = 'linear-gradient(90deg, #feca57, #ff9f43)'; // %100 Altın Sarısı
         } else if (goal._progress >= 70) {
             progressColor = 'linear-gradient(90deg, #2ed573, #7bed9f)'; // %70-99 arası (Yeşil)
         } else if (goal._progress >= 30) {
             progressColor = 'linear-gradient(90deg, #6c5ce7, #a29bfe)'; // %30-69 arası (Mor)
         }
         // --------------------------------------------------
 
         const div = document.createElement('div');
         div.className = 'goal-card glass-element';
         div.dataset.id = goal.id;
         const isUrgent = diffDays >= 0 && diffDays <= 3;
         const urgencyStyle = isUrgent ? 'background: rgba(255, 71, 87, 0.15); color: #ff4757; border-color: rgba(255, 71, 87, 0.4); box-shadow: 0 0 15px rgba(255,71,87,0.2);' : '';
 
        // YENİ: Tarih rozeti oluşturucu
        let dateInfoHTML = '';
        // İlerleme %100 olsa bile sadece süre dolup otomatik arşiv motoru statüyü değiştirdiğinde bu alan tetiklenir
        if (goal.status === 'completed' || goal.status === 'expired') {
            const startD = new Date(goal.createdAt || Date.now());
            const endD = new Date(goal.completedAt || Date.now());
            const badgeColor = goal.status === 'completed' ? '#2ed573' : '#ff4757';
            const badgeBg = goal.status === 'completed' ? 'rgba(46, 213, 115, 0.1)' : 'rgba(255, 71, 87, 0.1)';
            const badgeBorder = goal.status === 'completed' ? 'rgba(46, 213, 115, 0.2)' : 'rgba(255, 71, 87, 0.2)';
            const badgeIcon = goal.status === 'completed' ? 'fa-calendar-check' : 'fa-calendar-times';
            const badgeText = goal.status === 'completed' ? 'Tamamlanma' : 'Süre Dolumu';

            dateInfoHTML = `<div style="margin-top: 10px; display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: ${badgeColor}; background: ${badgeBg}; padding: 5px 12px; border-radius: 8px; border: 1px solid ${badgeBorder};"><i class="fa-regular ${badgeIcon}"></i> Başlangıç: ${startD.toLocaleDateString('tr-TR')} &nbsp;|&nbsp; ${badgeText}: ${endD.toLocaleDateString('tr-TR')}</div>`;
        }
 
        // Başlangıç ve bitiş tarihlerini oluştur
        const gcStartDate = goal.createdAt ? new Date(goal.createdAt) : null;
        const gcStartDisplay = gcStartDate ? `${String(gcStartDate.getDate()).padStart(2,'0')} ${monthNamesShort[gcStartDate.getMonth()]} ${gcStartDate.getFullYear()}` : '—';
        const gcEndDisplay = deadlineDisplay || '—';

        div.innerHTML = `
        <div class="gc-top">
            <div class="gc-left">
                <div class="gc-title">${escapeHtml(goal.title)}</div>
                <div class="gc-meta-row">
                    <span class="gc-meta-item"><i class="fa-regular fa-calendar-plus"></i> ${gcStartDisplay} <i class="fa-solid fa-arrow-right gc-meta-arrow"></i> ${gcEndDisplay}</span>
                    ${goal.reward && goal.reward.trim() !== '' ? `<span class="gc-meta-item gc-meta-reward"><i class="fa-solid fa-gift"></i> ${escapeHtml(goal.reward)}</span>` : ''}
                </div>
            </div>
            <div class="gc-right">
                <span class="gc-badge ${urgencyClass}">${urgencyText}</span>
                <button class="gc-del-btn" data-action="delete-goal" data-id="${goal.id}" title="Sil"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>

        ${(goal._milestoneTotal > 0 || goal._linkedTasks.length > 0 || goal._linkedHabits.length > 0) ? `
        <div class="gc-link-row">
            ${goal._milestoneTotal > 0 ? `<span class="gc-stat-chip"><i class="fa-solid fa-flag-checkered"></i> ${goal._milestoneDone}/${goal._milestoneTotal} dönüm noktası</span>` : ''}
            ${goal._linkedTasks.length > 0 ? `<span class="gc-stat-chip"><i class="fa-solid fa-list-check"></i> ${goal._linkedTasks.filter(t => t.completed).length}/${goal._linkedTasks.length} görev</span>` : ''}
            ${goal._linkedHabits.slice(0, 3).map(h => `<span class="gc-habit-chip">${h.icon && !h.icon.startsWith('fa-') ? escapeHtml(h.icon) : '<i class="fa-solid fa-repeat"></i>'} ${escapeHtml(h.name)}</span>`).join('')}
            ${goal._linkedHabits.length > 3 ? `<span class="gc-habit-chip gc-habit-more">+${goal._linkedHabits.length - 3} alışkanlık</span>` : ''}
        </div>` : ''}

        <div class="gc-progress-area">
            <div class="gc-progress-track">
                <div class="gc-progress-fill" style="width:${goal._progress}%; background:${progressColor};"></div>
            </div>
            <div class="gc-progress-meta">
                <span>${goal._completedSteps}/${goal._totalSteps} adım</span>
                <span class="gc-pct">%${goal._progress}</span>
            </div>
        </div>

        <div class="gc-actions">
            ${goal.status !== 'completed' ? `<button class="gc-complete-btn" data-action="quick-complete-goal" data-id="${goal.id}"><i class="fa-solid fa-check"></i> Tamamla</button>` : '<span></span>'}
            <button class="gc-detail-btn" data-action="open-goal-details" data-id="${goal.id}">Detaylar <i class="fa-solid fa-arrow-right"></i></button>
        </div>
        `;
         goalsContainer.appendChild(div);
     });
 
     if (displayedCount === 0) {
         if (currentGoalFilter === 'active') {
             goalsContainer.innerHTML = `
             <div style="text-align:center; padding:48px 20px; border: 1px dashed rgba(255,255,255,0.08); border-radius:12px;">
                 <i class="fa-solid fa-mountain" style="font-size:36px; color:rgba(255,255,255,0.15); margin-bottom:14px; display:block;"></i>
                 <p style="color:var(--text-muted); font-size:14px; margin-bottom:18px;">Henüz aktif hedefin yok.<br>Yeni bir hedef belirleyerek başla.</p>
                 <button data-action="open-goal-modal" class="primary-btn" style="margin:0 auto; justify-content:center;"><i class="fa-solid fa-plus"></i> Hedef Belirle</button>
             </div>`;
         } else {
             // --- ZAFERLERİ YOK EMPTY STATE ---
             const activeGoals = goals.filter(g => g.status !== 'completed' && g.status !== 'expired');
             let nearestGoalHTML = '';
             if (activeGoals.length > 0) {
                 const bestGoal = activeGoals.reduce((prev, curr) => {
                     const prevLinked = tasks.filter(t => t.parentGoal === prev.id);
                     const currLinked = tasks.filter(t => t.parentGoal === curr.id);
                     const prevPct = prevLinked.length === 0 ? 0 : Math.round((prevLinked.filter(t => t.completed).length / prevLinked.length) * 100);
                     const currPct = currLinked.length === 0 ? 0 : Math.round((currLinked.filter(t => t.completed).length / currLinked.length) * 100);
                     return currPct > prevPct ? curr : prev;
                 });
                 const linkedTasks = tasks.filter(t => t.parentGoal === bestGoal.id);
                 const pct = linkedTasks.length === 0 ? 0 : Math.round((linkedTasks.filter(t => t.completed).length / linkedTasks.length) * 100);
                 nearestGoalHTML = `
                 <div style="margin-top: 24px; padding: 16px 20px; background: rgba(108,92,231,0.1); border: 1px solid rgba(108,92,231,0.25); border-radius: 14px; text-align: left;">
                     <div style="font-size: 11px; font-weight: 700; letter-spacing: 1px; color: #a29bfe; margin-bottom: 8px; text-transform: uppercase;">En Yakın Başarı Adayı</div>
                     <div style="font-size: 15px; font-weight: 600; color: #fff; margin-bottom: 10px;">${escapeHtml(bestGoal.title)}</div>
                     <div style="background: rgba(255,255,255,0.07); border-radius: 8px; height: 8px; overflow: hidden; margin-bottom: 6px;">
                         <div style="height: 100%; width: ${pct}%; background: linear-gradient(90deg, #6c5ce7, #a29bfe); border-radius: 8px; transition: width 0.5s;"></div>
                     </div>
                     <div style="font-size: 12px; color: var(--text-muted);">%${pct} tamamlandı — devam et!</div>
                 </div>`;
             }
             goalsContainer.innerHTML = `
             <div class="glass-element" style="text-align: center; padding: 50px 28px 40px; border: 1px dashed rgba(254,202,87,0.3); background: linear-gradient(135deg, rgba(0,0,0,0.25), rgba(254,202,87,0.03));">
                 <div style="font-size: 64px; margin-bottom: 12px; line-height: 1; filter: drop-shadow(0 4px 16px rgba(254,202,87,0.4));">🏆</div>
                 <h3 style="color: #fff; font-size: 20px; font-weight: 700; margin-bottom: 8px;">Henüz Bir Başarın Yok</h3>
                 <p style="color: var(--text-muted); font-size: 14px; max-width: 340px; margin: 0 auto; line-height: 1.6;">
                     Tamamladığın hedefler burada arşivlenir. Bir hedefi %100 bitirdiğinde otomatik olarak buraya taşınır.
                 </p>
                 ${nearestGoalHTML}
                <button data-action="click-active-goal-tab" class="primary-btn" style="margin: 24px auto 0; justify-content: center; background: rgba(254,202,87,0.15); border-color: rgba(254,202,87,0.4); color: #feca57;">
                     <i class="fa-solid fa-mountain-sun"></i> Aktif Hedeflerime Git
                 </button>
             </div>`;
         }
     }
 }
 
 // Uygulama başlarken hedefleri de yükle
 renderGoals();

 // --- SÜRESİ DOLAN HEDEFİ AKTİFE GERİ TAŞIMA (Süreyi Uzat) → script-goal-deadline-extend.js dosyasına taşındı ---

 function microBurst(originX, originY) {
     const COLORS = ['#6c5ce7','#a29bfe','#2ed573','#ff9f43','#feca57','#fd79a8','#74b9ff'];
     const COUNT  = 16;
     for (let i = 0; i < COUNT; i++) {
         const angle    = (i / COUNT) * Math.PI * 2;
         const distance = 38 + Math.random() * 32;
         const size     = 5 + Math.random() * 5;
         const d        = document.createElement('div');
         Object.assign(d.style, {
             position:     'fixed',
             left:         (originX - size / 2) + 'px',
             top:          (originY - size / 2) + 'px',
             width:        size + 'px',
             height:       size + 'px',
             borderRadius: '50%',
             background:   COLORS[i % COLORS.length],
             pointerEvents:'none',
             zIndex:       '999997',
             opacity:      '1',
             transition:   'none',
             willChange:   'transform, opacity',
         });
         document.body.appendChild(d);
         requestAnimationFrame(() => {
             requestAnimationFrame(() => {
                 d.style.transition = 'transform 0.55s cubic-bezier(.25,.46,.45,.94), opacity 0.55s ease';
                 d.style.transform  = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(0)`;
                 d.style.opacity    = '0';
             });
         });
         setTimeout(() => d.remove(), 700);
     }
 }
 
 // Görsel Şölen: Konfeti Animasyonu
 function fireConfetti() {
     const canvas = document.getElementById('confetti-canvas');
     if(!canvas) return;
     const ctx = canvas.getContext('2d');
     canvas.width = window.innerWidth;
     canvas.height = window.innerHeight;
 
     const particles = [];
     const colors = ['#2ed573', '#ff9f43', '#ff4757', '#6c5ce7', '#feca57'];
 
     for(let i=0; i<150; i++) {
         particles.push({
             x: canvas.width / 2, y: canvas.height / 2 + 50,
             r: Math.random() * 6 + 2, dx: Math.random() * 15 - 7.5, dy: Math.random() * -15 - 5,
             color: colors[Math.floor(Math.random() * colors.length)],
             tilt: Math.random() * 10, tiltAngle: 0, tiltAngleInc: (Math.random() * 0.07) + 0.05
         });
     }
 
     let animationId;
     function render() {
         ctx.clearRect(0, 0, canvas.width, canvas.height);
         let active = false;
         particles.forEach(p => {
             p.tiltAngle += p.tiltAngleInc;
             p.y += (Math.cos(p.tiltAngle) + 1 + p.r / 2) / 2;
             p.x += Math.sin(p.tiltAngle) * 2;
             p.dy += 0.15; p.x += p.dx; p.y += p.dy;
             
             if(p.y <= canvas.height) active = true;
 
             ctx.beginPath(); ctx.lineWidth = p.r; ctx.strokeStyle = p.color;
             ctx.moveTo(p.x + p.tilt + p.r, p.y); ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r);
             ctx.stroke();
         });
         if(active) animationId = requestAnimationFrame(render);
         else ctx.clearRect(0, 0, canvas.width, canvas.height);
     }
     render();
     setTimeout(() => cancelAnimationFrame(animationId), 5000); // 5 saniye sonra temizle
 }
 window.fireConfetti = fireConfetti; // social.js gibi diğer scriptlerden (grup hedefi kutlaması) erişim için

 // ============ ALIŞKANLIK DÜZENLEME SİSTEMİ ============
 const editHabitModal = document.getElementById('edit-habit-modal');
 const closeEditHabitBtn = document.getElementById('close-edit-habit-btn');
 const cancelEditHabitBtn = document.getElementById('cancel-edit-habit-btn');
 const saveEditHabitBtn = document.getElementById('save-edit-habit-btn');
 
 window.openEditHabitModal = function(id) {
     const habit = habits.find(h => String(h.id) === String(id));
     if(!habit) return;
     
     document.getElementById('edit-habit-id').value = habit.id;
     document.getElementById('edit-habit-name').value = habit.name;
 
     window.tempEditHabitGoals = habit.parentGoals || [];
     populateParentHabitSelects(); // Seçimleri UI'a yansıt
 
     editHabitModal.classList.remove('hidden');
 }
 
 function closeEditHabitModalFunc() { 
     if(editHabitModal) editHabitModal.classList.add('hidden'); 
 }
 
 if(closeEditHabitBtn) closeEditHabitBtn.addEventListener('click', closeEditHabitModalFunc);
 if(cancelEditHabitBtn) cancelEditHabitBtn.addEventListener('click', closeEditHabitModalFunc);
 
 if(saveEditHabitBtn) {
     saveEditHabitBtn.addEventListener('click', () => {
         const id = document.getElementById('edit-habit-id').value;
         const newName = document.getElementById('edit-habit-name').value.trim();
         const pillsContainer = document.getElementById('edit-habit-goal-pills');
             const selectedGoals = pillsContainer ? Array.from(pillsContainer.querySelectorAll('.goal-pill.selected')).map(p => p.dataset.val) : [];
 
         const habit = habits.find(h => String(h.id) === String(id));
         if(habit && newName) {
             habit.name = newName;
             habit.parentGoals = selectedGoals;
             
             saveHabits();
             renderHabits();
             renderGoals(); // Bağlı hedefleri hemen tekrar hesapla
             closeEditHabitModalFunc();
             
             showPremiumModal({ title: 'Güncellendi', message: 'Alışkanlık başarıyla yeniden yapılandırıldı!', type: 'success' });
         }
     });
 }
 
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
                 toggleHabitFromToday(el.dataset.id, el.dataset.date);
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
                 openCalInlineAdd(el.dataset.date, h, el, e);
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
                 const ds = formatDateToString(selectedDate);
                 openCalInlineAdd(ds, h, el, e);
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
        if(detailDateInput) detailDateInput.value = toInputDate(formatDateToString(new Date()));
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
         const _todayStrAP = formatDateToString(new Date());
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
            const todayStr = formatDateToString(new Date());
 
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
     if (typeof generateAIAnalysis === 'function') {
         aiContainer.innerHTML = generateAIAnalysis(goal, totalProgress, totalSteps, completedSteps);
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
 const quickAddModal = document.getElementById('quick-add-task-modal');
 const quickAddInput = document.getElementById('quick-task-input');
 const closeQuickAddBtn = document.getElementById('close-quick-task-btn');
 const openQuickAddBtn = document.getElementById('floating-quick-add-btn');
 const saveQuickAddBtn = document.getElementById('save-quick-task-btn');
 const quickDateInput = document.getElementById('quick-task-date');
 const quickStartInput = document.getElementById('quick-task-start');
 const quickEndInput = document.getElementById('quick-task-end');
 const quickPriority = document.getElementById('quick-task-priority');
 const quickParentGoal = document.getElementById('quick-task-parent-goal');
 
 function openQuickAdd() {
     quickAddModal.classList.remove('hidden');
     quickAddInput.value = '';
     // Varsayılan olarak bugünü seç — flatpickr API üzerinden atanmalı, aksi halde
     // altInput (görünen metin kutusu) güncellenmeyip Tarih alanı boş görünüyordu.
     if (quickDateInput._flatpickr) {
         quickDateInput._flatpickr.set('minDate', false);
         quickDateInput._flatpickr.set('maxDate', false);
         const todayDateOnly = new Date();
         todayDateOnly.setHours(0, 0, 0, 0);
         quickDateInput._flatpickr.setDate(todayDateOnly, true);
     } else {
         quickDateInput.value = formatDateToString(new Date());
     }
     quickStartInput.value = '09:00'; 
     quickEndInput.value = '10:00';
     quickPriority.value = 'medium';
     
     // --- Premium Dönüm Noktası Tarih Sınırları ve Çakışma Kontrolü Başlangıç ---
     if(quickParentGoal) {
        quickParentGoal.innerHTML = '<option value="" selected>🎯 Ana Hedef Seç (Opsiyonel)</option>';
        goals.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = g.title;
            quickParentGoal.appendChild(opt);
        });

        // Kullanıcı Ana Hedef seçtiğinde dönüm noktası takvimini dinamik kısıtla
        quickParentGoal.onchange = (e) => {
            const selectedGoalId = e.target.value;
            if (!selectedGoalId) return;

            const goal = goals.find(g => String(g.id) === String(selectedGoalId));
            if (!goal) return;

            // Ana hedefin oluşturulduğu tarih (En erken alınabilecek gün)
            // Saat bileşenini sıfırlıyoruz, aksi halde createdAt'in saati şu anki
            // saatten sonraysa (örn. hedef az önce oluşturulduysa) "bugün" bile
            // sınırın dışına düşüp seçili tarih siliniyordu.
            const minDateLimit = new Date(goal.createdAt);
            minDateLimit.setHours(0, 0, 0, 0);

            // Ana hedefin bitiş tarihi (En geç alınabilecek gün)
            // Günün SONUNA (23:59:59) sabitliyoruz, aksi halde deadline "bugün"
            // olduğunda gece yarısı sınırı yüzünden "bugün" seçilemiyor, Tarih
            // alanı boş kalıyordu.
            const maxDateLimit = goal.deadline ? `${goal.deadline} 23:59:59` : null;

            // Daha önce bu hedefe eklenmiş dönüm noktası tarihlerini toplayalım (Çakışma engellemek için)
            let existingMilestoneDates = [];
            if (goal.milestones) {
                existingMilestoneDates = goal.milestones.map(m => m.date); // Y-m-d formatındaki tarihler
            }

            // Dönüm noktası tarih seçicisini (Flatpickr) yeniden yapılandır
            flatpickr('#quick-task-date', {
                locale: "tr",
                altInput: true,
                altFormat: "d-m-Y",
                dateFormat: "Y-m-d",
                minDate: minDateLimit,
                maxDate: maxDateLimit,
                // disable kaldırıldı — bitişik aralıklara (21-22, 22-23) izin vermek için
                disableMobile: "true"
            });
        };
    }
    // --- Premium Dönüm Noktası Tarih Sınırları ve Çakışma Kontrolü Bitiş ---
 
     setTimeout(() => quickAddInput.focus(), 100);
 }
 
 function closeQuickAdd() {
     quickAddModal.classList.add('hidden');
 }
 
 // Modal Açma/Kapama Bağlantıları
 if (openQuickAddBtn) {
     openQuickAddBtn._mainListenerAdded = true;
     openQuickAddBtn.addEventListener('click', openQuickAdd);
 }
 window._focusOpenQuickAdd = openQuickAdd; // Global köprü
 if (quickStartInput && quickEndInput) {
     quickStartInput.addEventListener('change', () => {
         quickEndInput.value = addOneHour(quickStartInput.value);
     });
 }
 if (closeQuickAddBtn) closeQuickAddBtn.addEventListener('click', closeQuickAdd);
 
 // Modal Dışına Tıklayınca Kapatma
 if (quickAddModal) {
     quickAddModal.addEventListener('click', (e) => {
         if (e.target === quickAddModal) closeQuickAdd();
     });
 }
 
 // Klavye Kısayolu: Ctrl+N (veya Cmd+N)
 document.addEventListener('keydown', (e) => {
     if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
         e.preventDefault(); // Tarayıcının yeni sekme açmasını engelle
         if (quickAddModal && quickAddModal.classList.contains('hidden')) {
             openQuickAdd();
         } else {
             closeQuickAdd();
         }
     }
 });
 
 // Akıllı Metin (Kullanıcı "Yarın 14:00" yazdığında saati ve tarihi otomatik ayarla)
 if (quickAddInput) {
     quickAddInput.addEventListener('input', (e) => {
         const smartData = parseSmartText(e.target.value);
         if(smartData.parsedDate) quickDateInput.value = smartData.parsedDate;
         if(smartData.parsedTime) {
             quickStartInput.value = smartData.parsedTime;
             quickEndInput.value = addOneHour(smartData.parsedTime);
         }
     });
     
     // Enter tuşu ile kaydetme
     quickAddInput.addEventListener('keypress', (e) => {
         if(e.key === 'Enter' && saveQuickAddBtn) saveQuickAddBtn.click();
     });
 }
 
 // Görevi Sisteme Kaydetme İşlemi
 if (saveQuickAddBtn) {
     saveQuickAddBtn.addEventListener('click', () => {
         const rawText = quickAddInput.value.trim();
         if(rawText === "") return;
 
         const smartData = parseSmartText(rawText);
         const text = smartData.cleanText || "İsimsiz Görev";
         
         const date = quickDateInput.value || formatDateToString(new Date());
         const start = quickStartInput.value;
         const end = quickEndInput.value;
         const priority = quickPriority.value;
         const parentGoal = quickParentGoal ? quickParentGoal.value : '';
 
         // Saat her zaman zorunlu
         if(!start || !end) {
             showPremiumModal({ title: 'Hata', message: 'Lütfen görev için bir saat belirleyin.', type: 'warning' });
             return;
         }
 
         const startMins = timeToMins(start);
         const endMins = timeToMins(end);
 
         if(startMins >= endMins) {
             showPremiumModal({ title: 'Hatalı Zaman', message: 'Bitiş saati başlangıçtan önce olamaz.', type: 'warning' });
             return;
         }
 
         if(hasTimeConflict(date, startMins, endMins)) {
             showPremiumModal({ title: 'Zaman Çakışması', message: 'Bu saatte takviminizde zaten başka bir plan var.', type: 'warning' });
             return;
         }
 
         // Görevi globale ekle
         addGlobalTask(text, priority, 'kisisel', date, start, end, '', parentGoal, '');
         
         closeQuickAdd();
         
         // Tüm ekranları güncelle
         renderTasks();
         if(typeof renderCalendarRef === 'function') renderCalendarRef();
         if(typeof renderEventsRef === 'function') renderEventsRef();
         if(typeof renderStatisticsRef === 'function' && document.getElementById('istatistikler').classList.contains('active')) renderStatisticsRef();
         
         showPremiumModal({ title: 'Hızlı Ekleme Başarılı', message: 'Görev takviminize eklendi.', type: 'success' });
     });
 }
 
 
 // ============ GLOBAL HIZLI GÖREV EKLEME (CTRL+N / FAB) SİSTEMİ ============
 const sqModal = document.getElementById('spotlight-quick-add-modal');
 const sqInput = document.getElementById('quick-add-input');
 
 function openQuickAddModal() {
     sqModal.classList.remove('hidden');
     sqInput.value = '';
     
     // Ana Hedef (Goal) seçeneklerini dinamik olarak güncelle
     const goalSelect = document.getElementById('quick-add-parent-goal');
     const currentValue = goalSelect.value;
     goalSelect.innerHTML = '<option value="">🎯 Ana Hedef Seç (Opsiyonel)</option>';
     const _goals = Store.goals.get();
     _goals.forEach(g => {
         const opt = document.createElement('option');
         opt.value = g.id; opt.textContent = g.title;
         goalSelect.appendChild(opt);
     });
     if (currentValue && _goals.some(g => String(g.id) === String(currentValue))) goalSelect.value = currentValue;
 
     // Modal açıldığında direkt yazmaya hazır olması için odaklan
     setTimeout(() => sqInput.focus(), 100);
 }
 
 function closeQuickAddModal() {
     sqModal.classList.add('hidden');
 }
 
 // sqModal için sadece ESC kapatma (Ctrl+N artık yalnızca quickAddModal'ı açıyor)
 document.addEventListener('keydown', (e) => {
     if (e.key === 'Escape' && sqModal && !sqModal.classList.contains('hidden')) {
         closeQuickAddModal();
     }
 });
 
 // Modalın dışına tıklanırsa kapatma
 if(sqModal) {
     sqModal.addEventListener('click', (e) => {
         if(e.target === sqModal) closeQuickAddModal();
     });
 }
 
 // Görevi Enter'a basınca ekleme ve NLP işleme
 if(sqInput) {
     sqInput.addEventListener('keypress', (e) => {
         if(e.key === 'Enter') {
             e.preventDefault();
             const rawText = sqInput.value.trim();
             if(rawText === "") return;
 
             // NLP (Akıllı Metin) motorundan geçir
             const smartData = parseSmartText(rawText);
             const text = smartData.cleanText || "Hızlı Görev";
             
             const parentGoal = document.getElementById('quick-add-parent-goal').value;
             const priority = document.getElementById('quick-add-priority').value;
             const recurring = document.getElementById('quick-add-recurring').value;
             
             // NLP saat bulduysa onu kullan, bulamadıysa arayüzdeki zorunlu saati kullan
             const manualTime = document.getElementById('quick-add-time').value;
             const timeStart = smartData.parsedTime ? smartData.parsedTime : (manualTime || "09:00");
             const timeEnd = addOneHour(timeStart); // Bitiş otomatik 1 saat sonrası
 
             // NLP tarih bulduysa onu kullan, yoksa bugün
             const taskDateStr = smartData.parsedDate ? smartData.parsedDate : formatDateToString(new Date());
 
             const startMins = timeToMins(timeStart);
             const endMins = timeToMins(timeEnd);
 
             // Çakışma kontrolü
             if (hasTimeConflict(taskDateStr, startMins, endMins)) {
                 showPremiumModal({ title: 'Zaman Çakışması', message: 'Bu saatte takviminizde başka plan var.', type: 'warning' });
                 return;
             }
 
             // addSmartTask hem normal hem de sıklık (recurring) içeren görevleri mükemmel işler
             addSmartTask(text, priority, 'kisisel', taskDateStr, timeStart, timeEnd, "", parentGoal, recurring);
             
             closeQuickAddModal();
             
             // Arayüzleri yenile
             renderTasks();
             if(typeof renderCalendarRef === 'function') renderCalendarRef();
             if(typeof renderEventsRef === 'function') renderEventsRef();
             
             showPremiumModal({ title: 'Başarılı!', message: `"${text}" sisteme eklendi.`, type: 'success' });
         }
     });
 }
 // ==========================================================================
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
 
 // script.js içindeki o çekmece bloğunu bul ve KESİNLİKLE sadece bununla değiştir:

 
 // Zihin Çöplüğü Verilerini Güvenle Getirme ve Render Etme
 window.renderCalMindDump = function() {
    if(!calMindDumpList) return;
    calMindDumpList.innerHTML = '';
    // DÜZELTME: 'mind_dump' yerine 'mind_dumps' kullanıldı
    let currentDumps = typeof FocusStorage !== 'undefined' ? Store.mind_dumps.get() : [];
    if(currentDumps.length === 0) {
        calMindDumpList.innerHTML = '<li style="color:var(--text-muted); font-size:12px; text-align:center; padding: 10px 0;">Çöplük boş. Harika!</li>';
        return;
    }
    currentDumps.forEach(item => {
        const li = document.createElement('li');
        li.className = 'cal-dump-drag-item';
        li.draggable = true;
        li.innerHTML = `<i class="fa-solid fa-grip-vertical" style="color: var(--text-muted);"></i> <span style="flex:1;">${escapeHtml(item.text)}</span>`;
        // Sürükleme (Drag) olayını başlat
        li.addEventListener('dragstart', (e) => {
            // GÜNCELLEME: Takvim ana drop motoruyla tam uyum için hem 'taskId' hem de 'dumpId' olarak kaydet
            e.dataTransfer.setData('taskId', item.id);
            e.dataTransfer.setData('dumpId', item.id);
        });
        calMindDumpList.appendChild(li);
    });
};
 
 window.convertDumpToTaskForDate = function(dumpId, dateStr) {
     let currentDumps = typeof FocusStorage !== 'undefined' ? Store.mind_dumps.get() : [];
     const dumpIndex = currentDumps.findIndex(d => String(d.id) === String(dumpId));
     if (dumpIndex === -1) return;
     
     const dumpItem = currentDumps[dumpIndex];
     
     // YENİ: Müsait zamanı otomatik bul
     const slot = findFirstAvailableSlot(dateStr);
     
     // Görevi bulduğu müsait saate ekle
     addGlobalTask(
         dumpItem.text,
         "medium",
         "kisisel",
         dateStr,
         slot.start,
         slot.end
     );
     
     currentDumps.splice(dumpIndex, 1);
     
     // Fikir dönüşüm günlüğünü takvim tarihiyle veritabanına işle
     let conversionLog = FocusStorage.get('mind_dump_conversions', []);
     conversionLog.push({ id: dumpId, date: dateStr });
     FocusStorage.set('mind_dump_conversions', conversionLog);
     
     if(typeof FocusStorage !== 'undefined') {
         Store.mind_dumps.set(currentDumps);
         mindDumps = currentDumps;
     }
     
     if (typeof renderCalendar === 'function') renderCalendar();
     if (typeof renderEvents === 'function') renderEvents();
     if (typeof window.renderCalMindDump === 'function') window.renderCalMindDump();
     if (typeof renderMindDumps === 'function') renderMindDumps(); 
     
     if (typeof showPremiumModal === 'function') {
         showPremiumModal({
             title: 'Planlandı!',
             message: `Fikriniz ${dateStr} günü en uygun saat olan ${slot.start} - ${slot.end} arasına yerleştirildi.`,
             type: 'success'
         });
     }
     if (window.FocusAISocial && typeof window.FocusAISocial.postActivity === 'function') {
         window.FocusAISocial.postActivity(`"${dumpItem.text}" fikrini göreve dönüştürdü 💡`);
     }
 };
 
 // Bu fonksiyon, belirli bir gün için sabah 09:00'dan başlayarak 
 // ilk boş 1 saatlik aralığı bulur.
 function findFirstAvailableSlot(dateStr) {
     // 09:00 - 18:00 arasını (9 saat) tarıyoruz
     for (let hour = 9; hour < 18; hour++) {
         let start = `${String(hour).padStart(2, '0')}:00`;
         let end = `${String(hour + 1).padStart(2, '0')}:00`;
         
         let startMins = timeToMins(start);
         let endMins = timeToMins(end);
         
         // hasTimeConflict zaten çakışma olup olmadığını kontrol ediyor
         if (!hasTimeConflict(dateStr, startMins, endMins)) {
             return { start, end }; // İlk boş aralığı döndür
         }
     }
     return { start: "18:00", end: "19:00" }; // Eğer gün tamamen doluysa mesai sonuna at
 }
 
 
 
 
 
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
export function switchTab(...args) { return window.switchTab(...args); }
