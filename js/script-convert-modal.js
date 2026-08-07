// script-convert-modal.js
// script.js'ten çıkarıldı (Faz 6): Mind Dump → Görev/Alışkanlık/Hedef
// "Dönüştürme Modalı" — tür seçimi, form alanları, kaydetme akışı. Temiz bir
// fonksiyon DEĞİL, script.js'in DOMContentLoaded akışı içinde ardışık
// top-level DOM-binding kodu olarak taşındı (script.js'teki convertModal vb.
// DOM referansları da bu dosyaya birlikte taşındı, event listener'lar bu
// referanslara bağımlı).
//
// Köprüler:
//  - getMindDumpsRef()/__setMindDumpsRef(): mindDumps hem okunuyor
//    hem `filter()` sonucu reassign ediliyor, bu yüzden getter+setter.
//  - getHabitsRef(): habits sadece push ile mutate ediliyor, getter yeterli.
//  - getHabitCategoriesRef(): script.js'te bu çıkarma için yeni eklendi.
//  - window.renderCalendar/renderEvents/addSmartTask: script.js'te bu çıkarma
//    için yeni eklendi (önceden sadece hoisting'e dayanan bare referanslardı —
//    taşınmadan önce her ikisi de script.js'in kendi closure'ında "çalışıyormuş
//    gibi" görünüyordu ama gerçekte hiç window'a atanmamıştı).
//  - window.checkGoalDateBoundaries/hasTimeConflict/showPremiumModal/updateStats/
//    saveHabits/renderHabits/renderTasks/renderCalMindDump: script.js'te zaten vardı.
//  - window.__getRenderCalendarRef/__getRenderEventsRef/__getRenderStatisticsRef:
//    script.js'te zaten vardı (script-habit-sync.js ile aynı desen).
//
// Faz G: window.* çağrıları gerçek import'lara çevrildi (script.js/script-date-time-utils.js/
// script-mind-dump.js hâlâ window.X = fn atamalarını KORUYOR, geriye dönük uyumluluk için).
//
// GERÇEK BUG DÜZELTMESİ (2026-08-06): openGoalModal() önceden bare (import
// edilmemiş) çağrılıyordu, "window fallthrough ile inline-goal-modal-globals.js'e
// çözülür" varsayımıyla — ama planning-goal-crud.js (Planlama'nın #pg-goal-modal'ı)
// AYNI global ismi en son ele geçiriyordu, bu yüzden "Detaylı Hedef Formunu Aç"
// yanlış modalı açıyordu (tarih alanı hep boş geliyordu, İptal/Oluştur butonları
// da o modalın farklı stiliyle geliyordu). Artık doğrudan import ediliyor.

import { getHabitCategoriesRef, getMindDumpsRef, setMindDumpsRef, checkGoalDateBoundaries, showPremiumModal, hasTimeConflict, addSmartTask, getHabitsRef, saveHabits, renderHabits, renderTasks, getRenderCalendarRef, getRenderEventsRef, getRenderStatisticsRef } from './script.js';
import { formatDateToString, timeToMins, addOneHour } from './script-date-time-utils.js';
import { saveMindDumps, renderMindDumps } from './script-mind-dump.js';
import { openGoalModal } from './script-goal-modal-open-close.js';

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
     const convertHabitDurationMinus = document.getElementById('convert-dump-habit-duration-minus');
     const convertHabitDurationPlus = document.getElementById('convert-dump-habit-duration-plus');

     // Hedeflenen Süre (Gün) steppera'ı — habit-create-modal'daki
     // target-minus/target-plus ile aynı premium desen (bkz.
     // script-habit-modal-dates.js), çıplak type="number" input'un
     // varsayılan tarayıcı ok-tuşlarının yerine geçiyor (kullanıcı isteğiyle,
     // 2026-08-06).
     if (convertHabitDurationMinus) {
         convertHabitDurationMinus.addEventListener('click', () => {
             let val = parseInt(convertHabitDuration.value) || 21;
             if (val > 1) convertHabitDuration.value = val - 1;
         });
     }
     if (convertHabitDurationPlus) {
         convertHabitDurationPlus.addEventListener('click', () => {
             let val = parseInt(convertHabitDuration.value) || 21;
             if (val < 365) convertHabitDuration.value = val + 1;
         });
     }
     if (convertHabitDuration) {
         convertHabitDuration.addEventListener('change', () => {
             let val = parseInt(convertHabitDuration.value);
             if (isNaN(val) || val < 1) val = 1;
             if (val > 365) val = 365;
             convertHabitDuration.value = val;
         });
     }

     const dumpOpenGoalBtn = document.getElementById('dump-open-goal-modal-btn');
     const dumpTypeRadios = document.querySelectorAll('input[name="dump_type"]');
     const dumpTypeBtns = document.querySelectorAll('.dump-type-btn');
 
     const saveConvertBtn = document.getElementById('save-convert-dump-btn');
     const closeConvertBtn = document.getElementById('close-convert-dump-btn');
     const cancelConvertBtn = document.getElementById('cancel-convert-dump-btn');
 
     // TÜR DEĞİŞİMİ: hem radyo 'change' olayından hem de modal her açıldığında
     // (openConvertModal) doğrudan çağrılabilsin diye adlandırılmış fonksiyon.
     // GERÇEK BUG DÜZELTMESİ (2026-08-06): openConvertModal önceden
     // radio.click() ile "Görev"i seçtiriyordu — ama radyo zaten checked ise
     // (varsayılan durum) .click() 'change' olayını hiç TETİKLEMİYOR, bu
     // yüzden alan görünürlüğü/aktif buton stili senkronize olmuyordu. Bunun
     // üstüne dump-habit-fields'in "hidden" class'ı (display:none !important)
     // JS'in .style.display='block' atamasını da hiçbir zaman ezemiyordu —
     // sonuç: "Alışkanlık" seçilince kategori/hedeflenen-süre alanları HİÇ
     // görünmüyordu.
     function applyDumpTypeUI(radio) {
         dumpTypeBtns.forEach(btn => {
             btn.classList.remove('active');
             btn.style.background = 'var(--glass-bg)';
             btn.style.color = 'var(--text-muted)';
             btn.style.borderColor = 'var(--glass-border)';
         });

         const selectedLabel = radio.closest('label').querySelector('.dump-type-btn');
         selectedLabel.classList.add('active');
         selectedLabel.style.background = 'rgba(108, 92, 231, 0.2)';
         selectedLabel.style.color = '#fff';
         selectedLabel.style.borderColor = 'var(--primary-color)';

         const val = radio.value;
         dumpTaskFields.style.display = 'none';
         dumpHabitFields.style.display = 'none';
         dumpGoalFields.style.display = 'none';
         saveConvertBtn.style.display = 'block';

         if(val === 'task') {
             dumpTaskFields.style.display = 'block';
             saveConvertBtn.innerHTML = '<i class="fa-solid fa-check"></i> Planla & Taşı';
         } else if(val === 'habit') {
             dumpHabitFields.style.display = 'flex'; // dikey ortalama için (bkz. mind-dump.css .dump-type-fields)
             saveConvertBtn.innerHTML = '<i class="fa-solid fa-leaf"></i> Alışkanlık Oluştur';

             // KATEGORİLERİ SENKRONİZE ET (Alışkanlıklar sekmesiyle aynı yapar)
             convertHabitCat.innerHTML = '';
             getHabitCategoriesRef().forEach(cat => {
                 const opt = document.createElement('option');
                 opt.value = cat.id;
                 opt.textContent = cat.name;
                 convertHabitCat.appendChild(opt);
             });
         } else if(val === 'goal') {
             dumpGoalFields.style.display = 'flex'; // dikey ortalama için (bkz. mind-dump.css .dump-type-fields)
             saveConvertBtn.style.display = 'none'; // Ana hedefte detaylı form açılır
         }
     }

     dumpTypeRadios.forEach(radio => {
         radio.addEventListener('change', (e) => applyDumpTypeUI(e.target));
     });

     window.openConvertModal = function(id) {
         const dump = getMindDumpsRef().find(d => String(d.id) === String(id));
         if(!dump) return;

         convertIdInput.value = dump.id;
         convertTextInput.value = dump.text;

         const taskRadio = document.querySelector('input[name="dump_type"][value="task"]');
         taskRadio.checked = true;
         applyDumpTypeUI(taskRadio); // Görevi varsayılan yap — .click() değil, doğrudan çağrı (bkz. yukarıdaki not)
         
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

             // GERÇEK BUG DÜZELTMESİ (2026-08-06): fikir artık burada HEMEN
             // silinmiyor — kullanıcı hedef formunu iptal edip kapatırsa fikir
             // kayboluyordu. Silme artık sadece hedef GERÇEKTEN kaydedilirse
             // gerçekleşiyor (bkz. script-goal-modal.js _saveGoalImpl —
             // window.__pendingDumpConversionId'i okuyup orada temizler).
             window.__pendingDumpConversionId = id;
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
                 
                 getHabitsRef().push({ 
                     id: window.generateId(),
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
            setMindDumpsRef(getMindDumpsRef().filter(d => String(d.id) !== String(id)));
            
            // Fikir dönüşüm günlüğünü veritabanına tarihli kaydet
            let conversionLog = FocusStorage.get('mind_dump_conversions', []);
            conversionLog.push({ id: id, date: formatDateToString(new Date()) });
            FocusStorage.set('mind_dump_conversions', conversionLog);
 
            saveMindDumps();
            renderMindDumps();
             
             renderTasks();
             if(getRenderCalendarRef()) getRenderCalendarRef()();
             if(getRenderEventsRef()) getRenderEventsRef()();
             if(getRenderStatisticsRef() && document.getElementById('istatistikler').classList.contains('active')) getRenderStatisticsRef()();
             
             // GÜNCELLEME: Takvimin aktif görünüm moduna (Aylık/Haftalık/Günlük) göre arayüzü ve havuzu zorunlu yenile
                setTimeout(() => {
                    if (typeof window.renderCalendar === 'function') window.renderCalendar();
                    if (typeof window.renderEvents === 'function') window.renderEvents();
                    if (typeof window.renderCalMindDump === 'function') window.renderCalMindDump();
                    if (typeof window.renderCalMindDump === 'function') window.renderCalMindDump();
                    if (typeof window.updateStats === 'function') window.updateStats();
                    if (typeof window.renderTasks === 'function') renderTasks();
                    
                    // Aktif takvim görünümlerini (Haftalık/Günlük çipleri) anında yenileyen tetikleyiciler
                    if (typeof window.renderWeeklyView === 'function') window.renderWeeklyView();
                    if (typeof window.renderDailyView === 'function') window.renderDailyView();
                }, 100);

                closeConvertModal();
        });
    }
 
