// script-mind-dump-calendar-bridge.js
// script.js'ten çıkarıldı (Faz 6): Mind Dump → Takvim köprüsü —
// convertDumpToTaskForDate (script-calendar-dragdrop.js tarafından bare
// çağrılıyor) + findFirstAvailableSlot yardımcısı.
//
// NOT: Bu blokla birlikte, script.js'te ÖLÜ KOD olarak tespit edilen eski
// `window.renderCalMindDump` sürümü (Store.mind_dumps.get() kullanan, hiç
// tanımlı olmayan `calMindDumpList`e bare erişen) SİLİNDİ — gerçek/aktif
// sürüm zaten script-mind-dump-drawer.js'te ve script.js'ten SONRA yüklenip
// window.renderCalMindDump'ı eziyordu (bkz. o dosyanın kendi yorumu, "eski/
// yedek" olarak zaten belgelenmişti).
//
// Köprüler:
//  - window.__setMindDumpsRef(): script.js'te zaten vardı (mindDumps burada
//    tam reassign ediliyor: `mindDumps = currentDumps`).
//  - window.addGlobalTask/hasTimeConflict/showPremiumModal: script.js'te
//    zaten vardı (showPremiumModal hoisting'e dayanıyordu, düzeltildi).

 window.convertDumpToTaskForDate = function(dumpId, dateStr) {
     let currentDumps = typeof FocusStorage !== 'undefined' ? Store.mind_dumps.get() : [];
     const dumpIndex = currentDumps.findIndex(d => String(d.id) === String(dumpId));
     if (dumpIndex === -1) return;
     
     const dumpItem = currentDumps[dumpIndex];
     
     // YENİ: Müsait zamanı otomatik bul
     const slot = findFirstAvailableSlot(dateStr);
     
     // Görevi bulduğu müsait saate ekle
     window.addGlobalTask(
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
         window.__setMindDumpsRef(currentDumps);
     }
     
     if (typeof window.renderCalendar === 'function') window.renderCalendar();
     if (typeof window.renderEvents === 'function') window.renderEvents();
     if (typeof window.renderCalMindDump === 'function') window.renderCalMindDump();
     if (typeof window.renderMindDumps === 'function') window.renderMindDumps(); 
     
     if (typeof window.showPremiumModal === 'function') {
         window.showPremiumModal({
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
         
         let startMins = window.timeToMins(start);
         let endMins = window.timeToMins(end);
         
         // hasTimeConflict zaten çakışma olup olmadığını kontrol ediyor
         if (!window.hasTimeConflict(dateStr, startMins, endMins)) {
             return { start, end }; // İlk boş aralığı döndür
         }
     }
     return { start: "18:00", end: "19:00" }; // Eğer gün tamamen doluysa mesai sonuna at
 }
