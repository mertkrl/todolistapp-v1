// XSS koruması: kullanıcının girdiği metinler innerHTML ile basılmadan önce
// escapeHtml()'den geçirilmeli (task/goal/habit/group başlıkları vb.).
// Tek kaynak: storage-manager.js (script.js'ten önce yüklenir, window.escapeHtml
// olarak tanımlar) — bare escapeHtml(...) çağrıları IIFE kapsam zincirinden
// (aşağıdaki sarmalayıcı yerel bir escapeHtml tanımlamadığı için) global scope'a
// düşüp doğrudan window.escapeHtml'e çözümlenir.
import { updateEndPicker, initCustomTimePicker } from './script-time-picker.js';
import { _setFlatpickrDate, _getDateFromFlatpickr, getWeekStart } from './script-calendar-date-utils.js';
import { editMilestone, deleteMilestone } from './script-milestone-goal-actions.js';
import { getCurrentUser } from '../state/current-user-store.js';
import { getActiveFocusTaskRef, setActiveFocusTaskRef } from '../state/active-focus-task-store.js';
import { getCurrentDateRef, setCurrentDateRef } from '../state/current-date-store.js';
import { getSelectedDateRef, setSelectedDateRef } from '../state/selected-date-store.js';
import { getHabitCategoriesRef, setHabitCategoriesRef } from '../state/habit-categories-store.js';
import { getMindDumpsRef, setMindDumpsRef } from '../state/mind-dumps-store.js';
import { getCalendarEventsRef, setCalendarEventsRef } from '../state/calendar-events-store.js';
import { getTasksRef, setTasksRef } from '../state/tasks-store.js';
import { getGoalsRef, setGoalsRef } from '../state/goals-store.js';
import { getHabitsRef, setHabitsRef } from '../state/habits-store.js';
import { getActiveChatTarget } from '../state/active-chat-target-store.js';
import { getDcRestorePending } from '../state/dc-restore-pending-store.js';
import '../state/priority-labels-store.js';
import '../state/current-cal-view-store.js';
import { setStatsActiveFilter } from '../state/stats-active-filter-store.js';
import { migrateEventKeys } from './script-migrate-event-keys.js';
import { showPremiumModal } from './script-premium-modal.js';
import { renderSocialStats, renderBuddyHabits } from './script-render-social-stats.js';
import { populateParentHabitSelects } from './script-populate-parent-selects.js';
import { openGoalModal, closeGoalModal } from './script-goal-modal-open-close.js';
import { updateTimerDropdown } from './script-update-timer-dropdown.js';
import { checkEveningReflection, openReflectionModal } from './script-evening-reflection-modal.js';
import { addNewEvent, openEventModal, closeEventModal } from './script-event-modal.js';
import { updateDailyProgress, updateStats, renderTodayGoalCard, renderTodayTaskSplit } from './script-today-stats.js';
import { initDailyHighlightWidget } from './script-daily-highlight.js';
import { switchTab } from './script-tab-switch-core.js';
import { addSmartTask } from './script-smart-task-add.js';
import { startFocusMode, clearFocusMode as _clearFocusModeLocal } from './script-focus-mode.js';
import { saveHabits, closeHabitModal, openCategoryModal, closeCategoryModal } from './script-habit-category-modal.js';
import { initCalEventListDnD } from './script-cal-dnd.js';
import { applyLastActiveTab } from './script-tab-restore.js';
import { initLibraryLampParallax } from './script-library-lamp-parallax.js';
import { addTask } from './script-add-task.js';
import { setupGoalRewardUI } from './script-goal-reward-ui.js';
import { toggleTask } from './script-toggle-task.js';
import { toggleActivityReaction } from './script-toggle-activity-reaction.js';
import { openGoalDetails, updateGoalDetailsUI, checkGoalSynergy } from './script-goal-details-panel.js';
export { showPremiumModal, populateParentHabitSelects, updateStats, switchTab, addSmartTask, startFocusMode, saveHabits, initCalEventListDnD };
(function () {
'use strict';

// applyLastActiveTab -> script-tab-restore.js dosyasına taşındı (window.applyLastActiveTab
// köprüsüyle de erişilebilir).

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
     window.dayNames = dayNames; // Faz H: script-plan-wizard.js için — önceden bare 'dayNames' ReferenceError veriyordu (pre-existing bug)
 
     // getWeekNumber → script-date-time-utils.js dosyasına taşındı.
 
     const currentWeekStr = new Date().getFullYear() + "-W" + window.getWeekNumber(new Date());
     window.currentWeekStr = currentWeekStr; // Faz 6: script-plan-wizard.js için köprü
 
     setTasksRef(Store.tasks.get());
     setTasksRef(getTasksRef().map(t => {
         if(!t.id) t.id = generateId();
         if(!t.date) t.date = window.formatDateToString(new Date());
         // Migrate YYYY-MM-DD → DD-MM-YYYY
         if (t.date && /^\d{4}-\d{2}-\d{2}$/.test(t.date)) {
             const p = t.date.split('-');
             t.date = `${p[2]}-${p[1]}-${p[0]}`;
         }
         return t;
     }));
     Store.tasks.set(getTasksRef());
 
     setCalendarEventsRef(Store.events.get());
     // One-time migration: move any YYYY-MM-DD keyed events to DD-MM-YYYY keys
     if (migrateEventKeys(getCalendarEventsRef())) Store.events.set(getCalendarEventsRef());
     for(let date in getCalendarEventsRef()) {
         getCalendarEventsRef()[date] = getCalendarEventsRef()[date].map(e => {
             if(!e.id) e.id = generateId();
             return e;
         });
     }
 
     const DEFAULT_HABIT_CATEGORY_IDS = ['genel', 'saglik', 'kisisel-gelisim'];
 
     setGoalsRef(Store.goals.get());
     let rawHabits = Store.habits.get();
     setHabitsRef(rawHabits.map(h => {
         if(!h.startDate) h.startDate = window.formatDateToString(new Date());
         // Migrasyon: eski yyyy-mm-dd formatını dd-mm-yyyy'ye çevir
         else if (/^\d{4}-\d{2}-\d{2}$/.test(h.startDate)) {
             h.startDate = window.fromInputDate(h.startDate);
         }
         return h;
     }));
     // Migrasyon sonuçlarını hemen kaydet
     Store.habits.set(getHabitsRef());

     // Alışkanlıklar günlük tekrar eden taahhütlerdir — her biri her gün bilinçli
     // takip/irade kaynağı ister (ego-depletion). Aynı anda çok fazla yeni alışkanlık
     // başlatmak (Fogg/Tiny Habits, Lally ve ark. 2010) başarı oranını düşürüp
     // hepsini yarım bıraktırıyor; bu yüzden hâlâ süresi dolmamış (aktif) alışkanlık
     // sayısını sınırlıyoruz. Süresi dolmuş/tamamlanmış alışkanlıklar bu sayıma girmez.
     const MAX_ACTIVE_HABITS = 7;
     // isHabitExpired → script-schedule-conflict-utils.js dosyasına taşındı (window.isHabitExpired).
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
        try { legacyReflections = JSON.parse(localStorage.getItem('focusai_reflections') || '[]', window._safeJsonReviver); } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
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

     // _syncHabitsFromStorage / _syncAllFromStorage → script-data-sync-refresh.js'e
     // taşındı. window._syncHabitsFromStorage / window._syncAllFromStorage köprüleriyle erişilebilir.

     if (window.FocusSync && window.FocusSync.isEnabled()) {
         window.FocusSync.pullAll();
     }


     // script-command-palette.js (ayrı dosyaya çıkarıldı) tasks/goals/habits/
     // mindDumps'a artık bare closure erişimi yapamıyor — bu accessor'lar
     // güncel referansı her çağrıda döndürür (değişkenler yeniden atandığında
     // -ör. tasks = tasks.map(...) gibi- de güncel kalır, closure sayesinde).

     // Zihin çöplüğü hızlı/dip friksiyonlu bir yakalama alanı olmalı — sınırsız
     // MAX_MIND_DUMPS -> script-mind-dump.js dosyasına taşındı (Faz 2, 2026-07-20).


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
     window.__getRenderJournalRef     = () => renderJournalRef; // Faz H2: script-tab-switch-core.js için
     window.__getRenderMindDumpsRef   = () => renderMindDumpsRef; // Faz H2: script-tab-switch-core.js için

     // --- GELİŞMİŞ AKILLI METİN ALGILAMA (NLP) MOTORU → script-nlp.js dosyasına taşındı ---
 
     // --- ANA HEDEF TARİH SINIRI KONTROLÜ (YENİ) ---
     // checkGoalDateBoundaries → script-schedule-conflict-utils.js dosyasına taşındı (window.checkGoalDateBoundaries).


     // timeToMins/getNextRecurringDate/addOneHour → script-date-time-utils.js
     // dosyasına taşındı (Faz 2, 2026-07-19).

     // getNextAvailableTimeSlot/hasTimeConflict → script-schedule-conflict-utils.js
     // dosyasına taşındı (window.getNextAvailableTimeSlot / window.hasTimeConflict).

     // Grup seans takvimi gibi dış modüllerin, kullanıcının kişisel takvimiyle saat çakışmasını
     // (sadece evet/hayır değil, hangi görevle çakıştığını da) sorgulayabilmesi için köprü.
     // dateStr "dd-mm-yyyy" formatında olmalı (kişisel takvimin kullandığı anahtar biçimi).
     // getPersonalScheduleConflict → script-schedule-conflict-utils.js dosyasına taşındı (window.getPersonalScheduleConflict).

     // getHabitsForDate → script-schedule-conflict-utils.js dosyasına taşındı (window.getHabitsForDate).

     // saveTasks -> script-task-render-mutate.js dosyasına taşındı (window.saveTasks).
     // addGlobalTask -> script-task-render-mutate.js dosyasına taşındı (window.addGlobalTask).
     // renderTasksGlobal -> script-task-render-mutate.js dosyasına taşındı (window.renderTasksGlobal).
     // Planning module writes to FocusStorage directly; call this to sync the in-memory tasks array
     // so subsequent window.saveTasks() calls don't overwrite planning changes.
     // syncTasksFromStorage / renderCalendarGlobal / syncMilestoneToCalendar /
     // syncAllMilestonesToCalendar / getPlanningGoalsForDropdown → script-calendar-sync-bridge.js
     // dosyasına taşındı (window.* köprüleri).

     // changeTaskGoal/deleteGlobalTask -> script-task-render-mutate.js dosyasına taşındı (window.changeTaskGoal / window.deleteGlobalTask).
 
    // Faz F: checkSynergy/checkGoalSynergy(habit) -> script-habit-goal-synergy.js (window.checkSynergy / window.__checkGoalHabitSynergy)
 
     window.populateParentHabitSelects = populateParentHabitSelects;

 // updateDynamicGreeting -> script-misc-widgets.js dosyasına taşındı (Faz 2,
 // 2026-07-20). window.updateDynamicGreeting köprüsüyle erişilir.
     window.updateDynamicGreeting(); 
 
     // Zihin Kütüphanesi Canlı Odak Işığı (Paralaks) Motoru -> script-library-lamp-parallax.js dosyasına taşındı.
     initLibraryLampParallax();

     // script-journal-library.js (ayrı dosyaya çıkarıldı) bare showPremiumModal()
     // çağrısı yapamadığı için window.showPremiumModal gerekiyor.
     window.showPremiumModal = function() { return showPremiumModal.apply(null, arguments); };
 
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
 
// Daily Highlight widget (DOM refs + listeners + loadDailyHighlight/toggleHighlightTask)
// -> script-daily-highlight.js dosyasına taşındı.
     initDailyHighlightWidget();

     const navLinks = document.querySelectorAll('.nav-links li');
     const pageSections = document.querySelectorAll('.page-section');
 
     // _switchTabRender/switchTab -> script-tab-switch-core.js dosyasına taşındı
     // (Faz H2, 2026-07-31). window.switchTab köprüsüyle de erişilebilir.

     navLinks.forEach(link => {
         link.addEventListener('click', () => {
             const targetId = link.getAttribute('data-target');
             if(targetId) switchTab(targetId);
         });
     });

     // Nav/dock/section durumunu son aktif sekmeye göre tekrar senkronla
     // (navLinks click listener'ları bağlandıktan sonra emin olmak için).
     applyLastActiveTab();

     const clearFocusBtn = document.getElementById('clear-focus-btn');
     // startFocusMode/clearFocusMode -> script-focus-mode.js dosyasına taşındı
     // (Faz H2, 2026-07-31; iki ayrı eski tanımın nasıl birleştirildiğine dair
     // ayrıntı için o dosyanın başlığına bakın).
     clearFocusBtn.addEventListener('click', _clearFocusModeLocal);
 
     const dateDisplay = document.getElementById('current-date');
     const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
     dateDisplay.textContent = new Date().toLocaleDateString('tr-TR', options);
 
     // timeOptionsList, updateEndPicker, initCustomTimePicker (+ dropdown dışına
     // tıklayınca kapatma dinleyicisi) -> script-time-picker.js dosyasına taşındı
     // (Faz 2, 2026-07-20). window.updateEndPicker/window.initCustomTimePicker
     // köprüsüyle erişilir. Yükleme sırası önemsiz (bkz. o dosyanın başlığı).
 
     initCustomTimePicker('task-time-start-box', 'task-time-start-display', 'task-time-start', 'task-time-start-dropdown', (newTime) => {
         const nextTime = window.addOneHour(newTime);
         updateEndPicker('task-time-end', nextTime);
     });
     initCustomTimePicker('task-time-end-box', 'task-time-end-display', 'task-time-end', 'task-time-end-dropdown');
 
     initCustomTimePicker('event-time-start-box', 'event-time-start-display', 'event-time-start', 'event-time-start-dropdown', (newTime) => {
         const nextTime = window.addOneHour(newTime);
         updateEndPicker('event-time-end', nextTime);
     });
     initCustomTimePicker('event-time-end-box', 'event-time-end-display', 'event-time-end', 'event-time-end-dropdown');
 
     initCustomTimePicker('wiz-time-start-box', 'wiz-time-start-display', 'wiz-new-task-start', 'wiz-time-start-dropdown', (newTime) => {
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
     initCustomTimePicker('wiz-time-end-box', 'wiz-time-end-display', 'wiz-new-task-end', 'wiz-time-end-dropdown');
 
     
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
                 window.deleteGlobalTask(id, date);
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

     // draggedItemIndex -> script-task-render-mutate.js dosyasına taşındı (drag-drop görev listesi state'i).

 // _spawnChipParticles, _celebrateDoneChip, animateCount -> script-misc-widgets.js
 // dosyasına taşındı (Faz 2, 2026-07-20). window.* köprüsüyle erişilir.

     // script-calendar-dragdrop.js (ayrı dosyaya çıkarıldı) bare updateStats()
     // çağrısı yapamadığı için window.updateStats gerekiyor.
     window.updateStats = function() { return updateStats(); };
 
     // taskCategoryLabels/renderHighlightGoalRow/renderTodayAssignmentRows/renderTasks/_buildTaskBreadcrumbHtml/_wireTaskItemDragDrop/buildTaskListItem/renderHabitRows -> script-task-render-mutate.js / script-habit-render-mutate.js dosyalarına taşındı.

     // Faz F (3. tur): playTaskCompleteSound() script-task-complete-sound.js'e
     // taşındı (window.playTaskCompleteSound köprüsü ile).

     // toggleTask -> script-toggle-task.js dosyasına taşındı (window.toggleTask
     // köprüsü + gerçek import ile, bkz. dosyanın başındaki import listesi).

     // addSmartTask -> script-smart-task-add.js dosyasına taşındı (Faz H2, 2026-07-31).
     // addTask -> script-add-task.js dosyasına taşındı (Faz H2, 2026-07-31).

     addTaskBtn.addEventListener('click', addTask);
     taskInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') addTask(); });

     const tdToggleAdd = document.getElementById('td-toggle-add');
     const tdAddForm = document.getElementById('td-add-form');
     if (tdToggleAdd && tdAddForm) {
         tdToggleAdd._mainListenerAdded = true;
         tdToggleAdd.addEventListener('click', () => {
             const open = !tdAddForm.classList.contains('is-hidden');
             tdAddForm.classList.toggle('is-hidden', open);
             tdToggleAdd.classList.toggle('is-open', !open);
             if (!open) {
                 const todayStr = window.formatDateToString(new Date());
                 const nextSlot = getNextAvailableTimeSlot(todayStr);
                 updateEndPicker('task-time-start', nextSlot.start);
                 updateEndPicker('task-time-end', nextSlot.end);
                 const inp = document.getElementById('task-input'); if(inp) inp.focus();
             }
         });
     }
 
 
     const habitInput = document.getElementById('habit-input');
     const habitTargetInput = document.getElementById('habit-target');
     const habitStartDateInput = document.getElementById('habit-start-date');
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

     // openHabitModal → script-habit-render-mutate.js dosyasına taşındı (window.openHabitModal).
     // closeHabitModal -> script-habit-category-modal.js dosyasına taşındı (Faz H2, 2026-07-31).
     if (btnOpenHabitModal) btnOpenHabitModal.addEventListener('click', () => window.openHabitModal());
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

     const categoryModal = document.getElementById('category-modal');
     const closeModalBtn = document.getElementById('close-modal-btn');
     const cancelCategoryBtn = document.getElementById('cancel-category-btn');
     const saveCategoryBtn = document.getElementById('save-category-btn');
     const newCategoryInput = document.getElementById('new-category-input');
 
     let currentHabitFilter = 'all';

     // renderHabitCategories/renderHabitFilters -> script-habit-render-mutate.js dosyasına taşındı (window.renderHabitCategories / window.renderHabitFilters).
 
     // openCategoryModal/closeCategoryModal -> script-habit-category-modal.js dosyasına taşındı (Faz H2, 2026-07-31).

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

             if (getHabitCategoriesRef().length <= 1) {
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
                 setHabitCategoriesRef(getHabitCategoriesRef().filter(c => c.id !== select.value));
                 FocusStorage.set('habitCategories', getHabitCategoriesRef()); // Veritabanını güncelle
                 window.renderHabitCategories(); // Tüm açılır menüleri aynı anda güncelle!
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
             if (!getHabitCategoriesRef().find(c => c.id === newCatId)) {
                 getHabitCategoriesRef().push({ id: newCatId, name: newCatName });
                 FocusStorage.set('habit_categories', getHabitCategoriesRef());
                 window.renderHabitCategories(); window.renderHabitFilters();
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
         if (getHabitCategoriesRef().length <= 1) {
             showPremiumModal({ title: 'İşlem Başarısız', message: 'Sistemde en az bir kategori bulunmalıdır!', type: 'warning' });
             return;
         }
         showPremiumModal({
             title: 'Kategoriyi Sil',
             message: 'Seçili kategoriyi silmek istediğinize emin misiniz?',
             type: 'warning', showCancel: true, confirmText: 'Evet, Sil',
             onConfirm: () => {
                 setHabitCategoriesRef(getHabitCategoriesRef().filter(c => c.id !== selectedId));
                 FocusStorage.set('habit_categories', getHabitCategoriesRef());
                 const firstCatId = getHabitCategoriesRef()[0].id;
                 getHabitsRef().forEach(h => { if (h.category === selectedId) h.category = firstCatId; });
                 saveHabits();
                 if(currentHabitFilter === selectedId) currentHabitFilter = 'all';
                 window.renderHabitCategories(); window.renderHabitFilters(); window.renderHabits();
                 if(renderCalendarRef) renderCalendarRef();
                 if(renderEventsRef) renderEventsRef();
                 if(renderStatisticsRef && document.getElementById('istatistikler').classList.contains('active')) renderStatisticsRef();
                 if(renderSocialStatsRef && document.getElementById('arkadaslar').classList.contains('active')) renderSocialStatsRef();
                 if(renderBuddyHabitsRef && document.getElementById('arkadaslar').classList.contains('active')) renderBuddyHabitsRef();
             }
         });
     });
 
    // Faz F: getChallengeDays -> script-challenge-days.js
 
     // saveHabits -> script-habit-category-modal.js dosyasına taşındı (Faz H2, 2026-07-31).
     // renderHabits -> script-habit-render-mutate.js dosyasına taşındı (window.renderHabits).
 
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
                     const deletingHabit = getHabitsRef().find(h => String(h.id) === String(hId));
                     // Ortak alışkanlıksa partnere bildirim gönder ve Supabase'den sil
                     if (deletingHabit && deletingHabit.buddy && deletingHabit.buddy !== 'none') {
                         if (window.FocusAISocial && typeof window.FocusAISocial._sendBuddyHabitDeletedNotification === 'function') {
                             window.FocusAISocial._sendBuddyHabitDeletedNotification(deletingHabit.id, deletingHabit.buddy, deletingHabit.name);
                         }
                         if (window.FocusSupabase) {
                             window.FocusSupabase.from('buddy_habits').delete().eq('id', String(hId)).then(() => {});
                         }
                     }
                     setHabitsRef(getHabitsRef().filter(h => String(h.id) !== String(hId)));

                     getTasksRef().forEach(t => { if(String(t.parentHabit) === String(hId)) t.parentHabit = ""; });
                     for(let date in getCalendarEventsRef()) {
                         getCalendarEventsRef()[date].forEach(ev => { if(String(ev.parentHabit) === String(hId)) ev.parentHabit = ""; });
                     }
                     window.saveTasks();

                     saveHabits(); window.renderHabits(); window.renderTasks(); 
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
             const habit = getHabitsRef().find(h => String(h.id) === String(li.dataset.habitId));
             if (habit) {
                 if(dot.dataset.date && dot.dataset.date !== "null") {
                     const oldCount = Object.keys(habit.history).length;
                     if (habit.history[dot.dataset.date]) delete habit.history[dot.dataset.date];
                     else habit.history[dot.dataset.date] = true;
                     window.checkHabitMilestones(habit, oldCount, Object.keys(habit.history).length);
                 }
                 saveHabits(); window.renderHabits(); window.renderTasks();
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
             const habit = getHabitsRef().find(h => String(h.id) === String(li.dataset.habitId));
             if (habit) {
                 const today = completeBtn.dataset.date;
                 const oldCount = Object.keys(habit.history).length;
                 if (habit.history[today]) delete habit.history[today];
                 else habit.history[today] = true;
                 window.checkHabitMilestones(habit, oldCount, Object.keys(habit.history).length);
                 saveHabits(); window.renderHabits(); window.renderTasks();
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
 
     // addHabit -> script-habit-render-mutate.js dosyasına taşındı (window.addHabit).
     addHabitBtn.addEventListener('click', () => window.addHabit());
     habitInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') window.addHabit(); });

     const cleanExpiredHabitsBtn = document.getElementById('clean-expired-habits-btn');
     if (cleanExpiredHabitsBtn) {
         cleanExpiredHabitsBtn.addEventListener('click', async () => {
             const todayDate = new Date();
             todayDate.setHours(0, 0, 0, 0);
             const expiredHabits = getHabitsRef().filter(habit => {
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
             setHabitsRef(getHabitsRef().filter(h => !expiredIds.has(String(h.id))));
             saveHabits();
             window.renderHabits();
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

     


     // Aylık Takvim Hover Popup → script-calendar-hover-popup.js dosyasına taşındı
     // (window.showCalHoverPopup / window.hideCalHoverPopup olarak sağlanır)

 
     // --- TAKVİM LİSTESİ İÇİ REORDER + TAMAMLAMA ANİMASYONU ---
     // initCalEventListDnD -> script-cal-dnd.js dosyasına taşındı (Faz H2, 2026-07-31).

     // moveTaskToDate -> script-move-task-to-date.js dosyasına taşındı (window.moveTaskToDate).

     // Event modal open/close
     const eventCreateModal = document.getElementById('event-create-modal');
     const btnOpenEventModal = document.getElementById('btn-open-event-modal');
     const closeEventModalBtn = document.getElementById('close-event-modal-btn');
     const cancelEventModalBtn = document.getElementById('cancel-event-modal-btn');
     const eventModalDateLabel = document.getElementById('event-modal-date-label');

     if (btnOpenEventModal) btnOpenEventModal.addEventListener('click', openEventModal);
     if (closeEventModalBtn) closeEventModalBtn.addEventListener('click', closeEventModal);
     if (cancelEventModalBtn) cancelEventModalBtn.addEventListener('click', closeEventModal);
     if (eventCreateModal) eventCreateModal.addEventListener('click', (e) => { if (e.target === eventCreateModal) closeEventModal(); });

     addEventBtn.addEventListener('click', addNewEvent);
     eventInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') addNewEvent(); });
 
 
 
     // ============ SPOTLIGHT ARAMA SİSTEMİ ============
     // Faz F: script-spotlight-search.js'e çıkarıldı.
     prevMonthBtn.onclick = () => { getCurrentDateRef().setMonth(getCurrentDateRef().getMonth() - 1); window.renderCalendar(); window.updateCalUnifiedTitle(); };
     nextMonthBtn.onclick = () => { getCurrentDateRef().setMonth(getCurrentDateRef().getMonth() + 1); window.renderCalendar(); window.updateCalUnifiedTitle(); };
 
 
     // toggleActivityReaction -> script-toggle-activity-reaction.js dosyasına taşındı.

    // Faz F: getLogicalReflectionDate/isReflectionTime -> script-reflection-date-utils.js
 
     // Sidebar/dock "Akşam Yansıması" butonları kaldırıldı (giriş noktası artık
     // Zihin Kütüphanesi'ndeki "Günü Değerlendir"). Bu fonksiyon sadece akşam
     // saatinde o günün kaydı hiç yoksa modalı bir kez otomatik açar.
 

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
    // getNewStorageData/closeJournalModal/deleteJournalEntry/editJournalEntry
    // → script-journal-modal.js dosyasına taşındı.

    // initBookDetailModal → script-book-detail-modal.js dosyasına taşındı.

     // Faz F: Ortak Odaklanma Odası (co-working) + Gruplar script-coworking-groups.js'e çıkarıldı.

 // ════════════════════════════════════════════════════════════
     // PREMIUM TAKVİM — Aylık / Haftalık / Günlük Görünüm Sistemi
     // ════════════════════════════════════════════════════════════
 
     const CAL_HOUR_START = 0;
    window.CAL_HOUR_START = CAL_HOUR_START; // Faz 6: script-calendar-week-day-view.js için
     const CAL_HOUR_END = 23;
    window.CAL_HOUR_END = CAL_HOUR_END; // Faz 6: script-calendar-week-day-view.js için
     const DAY_NAMES_LOCAL = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
    window.DAY_NAMES_LOCAL = DAY_NAMES_LOCAL; // Faz 6: script-calendar-week-day-view.js için
 
     // window.getWeekStart → script-calendar-date-utils.js dosyasına taşındı.
 
     // updateCalUnifiedTitle → script-calendar-view-switch.js dosyasına taşındı
     // (window.updateCalUnifiedTitle).
 
     // ── GÜN DETAY DRAWER ──────────────────────────────────────────
     // openDayDrawer/renderDayDrawer/cddSwapTaskTimes/saat popover'ı/hızlı ekle
     // → script-day-drawer-core.js dosyasına taşındı (window.openDayDrawer,
     // window.renderDayDrawer). _cddTimePopoverEl artık
     // state/day-drawer-ui-store.js'te paylaşılan bir store.
     // closeDayDrawer → script-day-drawer-core.js dosyasına taşındı
     // (window.closeDayDrawer). switchCalView bu çağrıyı DOMContentLoaded
     // içinde (senkron top-level değil) yapıyor; ES module'ler
     // DOMContentLoaded'dan önce tamamen çalıştığı için sıra riski yok.

     // switchCalView → script-calendar-view-switch.js dosyasına taşındı
     // (window.switchCalView).
 
     // calUnifiedPrev/calUnifiedNext/calUnifiedToday → script-calendar-view-switch.js
     // dosyasına taşındı (window.calUnifiedPrev/calUnifiedNext/calUnifiedToday).
 
    // ── TAKVİM TAM EKRAN MODU → script-calendar-fullscreen.js dosyasına taşındı ──
 
     // .cal-view-btn / cal-unified-prev/next/today click listener'ları
     // → script-calendar-view-switch.js dosyasına taşındı.
 
     // ────────────────────────────────────────────
 
 
     // İlk yükleme: unified title güncelle
     window.updateCalUnifiedTitle();
 
     // ════════════════════════════════════════════════════════════
 
 
     renderCalendarRef = window.renderCalendar;
     window.renderCalendarRef = renderCalendarRef; // script-milestone-goal-actions.js gibi ayrı modüllerden erişim için

     // Sayfa yenilendiyse ve takvim sekmesi aktifse içeriği render et.
     // _restoredTab ayrıca aşağıdaki ilk yükleme render sırasını (bkz. "aktif
     // sekmeyi önce çiz" notu) belirlemek için kullanılıyor.
     const _restoredTab = FocusStorage.get('lastActiveTab', 'bugun');
     if (_restoredTab === 'takvim') {
        window.switchCalView(window.__getCurrentCalView() || 'monthly');
     }

     // renderEventsRef: gizli compat elementi + açık drawer'ı birlikte güncelle
     renderEventsRef = function() {
         window.renderEvents();
         const drawer = document.getElementById('cal-day-drawer');
         if (drawer && drawer.classList.contains('open')) {
             const ds = window.formatDateToString(getSelectedDateRef());
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
             setStatsActiveFilter(parseInt(btn.dataset.filter));
             window.renderStatistics();
         });
     });
     renderJournalRef = buildMassiveLibraryRows;
     renderSocialStatsRef = renderSocialStats;
     renderBuddyHabitsRef = renderBuddyHabits;
     renderMindDumpsRef = window.renderMindDumps;
 
 
     populateParentHabitSelects();
     window.renderTasks();
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
         if (typeof renderTasks === 'function') window.renderTasks();
         if (typeof window.renderCalendar === 'function') window.renderCalendar();
     });
     _runOrDefer('aliskanliklar', () => {
         window.renderHabitCategories();
         window.renderHabitFilters();
         window.renderHabits();
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

 // Eski tasarımı gizleyip yeni şık butona bağlıyoruz
 const oldActiveFocusPanel = document.getElementById('active-focus-task');
 if(oldActiveFocusPanel) oldActiveFocusPanel.style.display = 'none';

 // startFocusMode (canlı sürüm) / clearFocusModeGlobal (window.clearFocusMode'a
 // atanan dış-çağrı sürümü) -> script-focus-mode.js dosyasına taşındı
 // (Faz H2, 2026-07-31). Modül zaten kendi window.startFocusMode/window.clearFocusMode
 // atamalarını yapıyor, burada tekrar atamaya gerek yok.

 // Dropdown Menüyü Her Yerden (Takvim, Alışkanlık, Bugün) Gelen Verilerle Doldur
 
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
 // İptal/kapat: kaydedilmeden vazgeçildi — Zihin Çöplüğü'nden gelinmiş olabilecek
 // bekleyen dönüşüm id'sini temizle (bkz. script-goal-modal.js/script-convert-modal.js),
 // aksi halde daha sonra alakasız bir hedef kaydedilince o eski fikir yanlışlıkla silinebilirdi.
 const _clearPendingDumpConversion = () => { window.__pendingDumpConversionId = null; };
 if(closeGoalModalBtn) closeGoalModalBtn.addEventListener('click', () => { closeGoalModal(); _clearPendingDumpConversion(); });
 if(cancelGoalBtn) cancelGoalBtn.addEventListener('click', () => { closeGoalModal(); _clearPendingDumpConversion(); });

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
                 window.deleteGlobalTask(el.dataset.id, el.dataset.taskDate);
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
                 const ds = window.formatDateToString(getSelectedDateRef());
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
 
     // openGoalDetails/updateGoalDetailsUI/checkGoalSynergy -> script-goal-details-panel.js
     // dosyasına taşındı.

 // YENİ: Manuel Hedef Tamamlama İşlemi
 document.addEventListener('click', (e) => {
     const manualBtn = e.target.closest('#manual-complete-goal-btn');
     if (manualBtn) {
         const goalId = document.getElementById('detail-active-goal-id').value;
         const goal = getGoalsRef().find(g => String(g.id) === String(goalId));
         if(goal) {
             // Uyarı metnini belirle (bağlı aktif görev var mı?)
             const pendingTasks = getTasksRef().filter(t => String(t.parentGoal) === String(goalId) && !t.completed);
             const warningText = pendingTasks.length > 0
                 ? `⚠️ Bu hedefe bağlı <strong class="u-color-hff9f43">${pendingTasks.length} aktif görev</strong> var. Yine de hedefi tamamlamak istiyor musunuz?`
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
                     Store.getGoalsRef().set(getGoalsRef());
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
         const selectedGoal = getGoalsRef().find(g => String(g.id) === String(selectedGoalId));
         
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
         const selectedGoal = getGoalsRef().find(g => String(g.id) === String(selectedGoalId));
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
             const selectedGoal = getGoalsRef().find(g => String(g.id) === String(firstSelectedGoalId));
             
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
 
 
 
 
 
 
// window.alert override + kitaplık özet kutusu hover tooltip konum motoru ->
// script-premium-alert-toast.js dosyasına taşındı.

 // ============ PROFİL DROPDOWN MENÜSÜ → script-profile-dropdown.js dosyasına taşındı ============

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
export function convertDumpToTaskForDate(...args) { return window.convertDumpToTaskForDate(...args); }
export function renderCalMindDump(...args) { return window.renderCalMindDump(...args); }
export { getMindDumpsRef };
export { getHabitsRef, setHabitsRef };
export { getHabitCategoriesRef, setHabitCategoriesRef };
export function getNextAvailableTimeSlot(...args) { return window.getNextAvailableTimeSlot(...args); }
export { updateGoalDetailsUI };
export function getRenderHabitsRef(...args) { return window.__getRenderHabitsRef(...args); }
export function checkGoalDateBoundaries(...args) { return window.checkGoalDateBoundaries(...args); }
export function saveTasks(...args) { return window.saveTasks(...args); }
export function renderTasks(...args) { return window.renderTasks(...args); }
export function renderHabits(...args) { return window.renderHabits(...args); }
export function hasTimeConflict(...args) { return window.hasTimeConflict(...args); }
export { setMindDumpsRef };
export function getRenderCalendarRef(...args) { return window.__getRenderCalendarRef(...args); }
export function getRenderEventsRef(...args) { return window.__getRenderEventsRef(...args); }
export function getRenderStatisticsRef(...args) { return window.__getRenderStatisticsRef(...args); }
export function getRenderSocialStatsRef(...args) { return window.__getRenderSocialStatsRef(...args); }
export { openGoalDetails };
export { getGoalsRef, setGoalsRef };
export function getHabitsForDate(...args) { return window.getHabitsForDate(...args); }
export function addGlobalTask(...args) { return window.addGlobalTask(...args); }
export { getActiveFocusTaskRef, setActiveFocusTaskRef };
export function getNextBreakMode() { return window.__nextBreakMode; }
export function toggleHighlightTask(...args) { return window.toggleHighlightTask(...args); }
export { toggleTask };
export function clearFocusMode(...args) { return window.clearFocusMode(...args); }
// Faz G Kategori 4: script-calendar-month-view.js için eklendi (lazy proxy,
// script.js diğer script-*.js dosyalarından ÖNCE yüklendiği için bu yön
// güvenli — çağrı zamanı window.* değerini okur, import zamanı değil).
export { getCurrentDateRef, setCurrentDateRef, getSelectedDateRef, setSelectedDateRef };
export function openDayDrawer(...args) { return window.openDayDrawer(...args); }
export { getTasksRef, setTasksRef };
export { getCalendarEventsRef, setCalendarEventsRef };
export function getCurrentWeekStr() { return window.currentWeekStr; }
export function getRenderBuddyHabitsRef(...args) { return window.__getRenderBuddyHabitsRef(...args); }
export function getTotalFocusMinutes() { return window.__getTotalFocusMinutesRef(); }
export function getDayNames() { return window.dayNames; }
export function getMonthNamesShort() { return window.monthNamesShort; }
export function getPriorityLabelsRef() { return window.__getPriorityLabelsRef(); }

// script.js'in geri kalan window.* köprülerini de dışa açan evrensel
// shim'ler (Faz P/Q mimari turu, bkz. social.js/planning.js'teki aynı desen).
export function CAL_HOUR_END(...args) { const v = window.CAL_HOUR_END; return (typeof v === "function") ? v(...args) : v; }
export function CAL_HOUR_START(...args) { const v = window.CAL_HOUR_START; return (typeof v === "function") ? v(...args) : v; }
export function DAY_NAMES_LOCAL(...args) { const v = window.DAY_NAMES_LOCAL; return (typeof v === "function") ? v(...args) : v; }
export function JOURNAL_CHAR_LIMIT(...args) { const v = window.JOURNAL_CHAR_LIMIT; return (typeof v === "function") ? v(...args) : v; }
export function __getStatsActiveFilter(...args) { const v = window.__getStatsActiveFilter; return (typeof v === "function") ? v(...args) : v; }
export function _msGroupCollapsed(...args) { const v = window._msGroupCollapsed; return (typeof v === "function") ? v(...args) : v; }
export function _syncAllFromStorage(...args) { const v = window._syncAllFromStorage; return (typeof v === "function") ? v(...args) : v; }
export function _syncHabitsFromStorage(...args) { const v = window._syncHabitsFromStorage; return (typeof v === "function") ? v(...args) : v; }
export function alert(...args) { const v = window.alert; return (typeof v === "function") ? v(...args) : v; }
export function bypassRoutineCheck(...args) { const v = window.bypassRoutineCheck; return (typeof v === "function") ? v(...args) : v; }
export function calendarDays(...args) { const v = window.calendarDays; return (typeof v === "function") ? v(...args) : v; }
export function changeTaskGoal(...args) { const v = window.changeTaskGoal; return (typeof v === "function") ? v(...args) : v; }
export { checkGoalSynergy };
export function closeDropdown(...args) { const v = window.closeDropdown; return (typeof v === "function") ? v(...args) : v; }
export function deleteGlobalTask(...args) { const v = window.deleteGlobalTask; return (typeof v === "function") ? v(...args) : v; }
export function deleteJournalEntry(...args) { const v = window.deleteJournalEntry; return (typeof v === "function") ? v(...args) : v; }
export function editJournalEntry(...args) { const v = window.editJournalEntry; return (typeof v === "function") ? v(...args) : v; }
export function eventList(...args) { const v = window.eventList; return (typeof v === "function") ? v(...args) : v; }
export function eventsCountDisplay(...args) { const v = window.eventsCountDisplay; return (typeof v === "function") ? v(...args) : v; }
export function getPersonalScheduleConflict(...args) { const v = window.getPersonalScheduleConflict; return (typeof v === "function") ? v(...args) : v; }
export function getPlanningGoalsForDropdown(...args) { const v = window.getPlanningGoalsForDropdown; return (typeof v === "function") ? v(...args) : v; }
export function monthNames(...args) { const v = window.monthNames; return (typeof v === "function") ? v(...args) : v; }
export function monthYearDisplay(...args) { const v = window.monthYearDisplay; return (typeof v === "function") ? v(...args) : v; }
export function promptDeleteGoal(...args) { const v = window.promptDeleteGoal; return (typeof v === "function") ? v(...args) : v; }
export function renderCalendarRef(...args) { const v = window.renderCalendarRef; return (typeof v === "function") ? v(...args) : v; }
export function renderDayDrawer(...args) { const v = window.renderDayDrawer; return (typeof v === "function") ? v(...args) : v; }
export function renderEventsRef(...args) { const v = window.renderEventsRef; return (typeof v === "function") ? v(...args) : v; }
export function renderTasksGlobal(...args) { const v = window.renderTasksGlobal; return (typeof v === "function") ? v(...args) : v; }
export function selectedDateTitle(...args) { const v = window.selectedDateTitle; return (typeof v === "function") ? v(...args) : v; }
export function switchCalView(...args) { const v = window.switchCalView; return (typeof v === "function") ? v(...args) : v; }
export function syncAllMilestonesToCalendar(...args) { const v = window.syncAllMilestonesToCalendar; return (typeof v === "function") ? v(...args) : v; }
export function syncMilestoneToCalendar(...args) { const v = window.syncMilestoneToCalendar; return (typeof v === "function") ? v(...args) : v; }
export function syncTasksFromStorage(...args) { const v = window.syncTasksFromStorage; return (typeof v === "function") ? v(...args) : v; }
export function tempEditHabitGoals(...args) { const v = window.tempEditHabitGoals; return (typeof v === "function") ? v(...args) : v; }
export { toggleActivityReaction };
export function updateCalUnifiedTitle(...args) { const v = window.updateCalUnifiedTitle; return (typeof v === "function") ? v(...args) : v; }
