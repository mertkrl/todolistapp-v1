// ============ HIZLI GÖREV EKLE (CTRL+N) SİSTEMİ ============
// Faz F: script.js'ten çıkarıldı (openQuickAdd/closeQuickAdd + spotlight quick-add sistemi)

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
        quickDateInput.value = window.formatDateToString(new Date());
    }
    quickStartInput.value = '09:00';
    quickEndInput.value = '10:00';
    quickPriority.value = 'medium';

    // --- Premium Dönüm Noktası Tarih Sınırları ve Çakışma Kontrolü Başlangıç ---
    if(quickParentGoal) {
       quickParentGoal.innerHTML = '<option value="" selected>🎯 Ana Hedef Seç (Opsiyonel)</option>';
       window.__getGoalsRef().forEach(g => {
           const opt = document.createElement('option');
           opt.value = g.id;
           opt.textContent = g.title;
           quickParentGoal.appendChild(opt);
       });

       // Kullanıcı Ana Hedef seçtiğinde dönüm noktası takvimini dinamik kısıtla
       quickParentGoal.onchange = (e) => {
           const selectedGoalId = e.target.value;
           if (!selectedGoalId) return;

           const goal = window.__getGoalsRef().find(g => String(g.id) === String(selectedGoalId));
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
        quickEndInput.value = window.addOneHour(quickStartInput.value);
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
        const smartData = window.parseSmartText(e.target.value);
        if(smartData.parsedDate) quickDateInput.value = smartData.parsedDate;
        if(smartData.parsedTime) {
            quickStartInput.value = smartData.parsedTime;
            quickEndInput.value = window.addOneHour(smartData.parsedTime);
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

        const smartData = window.parseSmartText(rawText);
        const text = smartData.cleanText || "İsimsiz Görev";

        const date = quickDateInput.value || window.formatDateToString(new Date());
        const start = quickStartInput.value;
        const end = quickEndInput.value;
        const priority = quickPriority.value;
        const parentGoal = quickParentGoal ? quickParentGoal.value : '';

        // Saat her zaman zorunlu
        if(!start || !end) {
            window.showPremiumModal({ title: 'Hata', message: 'Lütfen görev için bir saat belirleyin.', type: 'warning' });
            return;
        }

        const startMins = window.timeToMins(start);
        const endMins = window.timeToMins(end);

        if(startMins >= endMins) {
            window.showPremiumModal({ title: 'Hatalı Zaman', message: 'Bitiş saati başlangıçtan önce olamaz.', type: 'warning' });
            return;
        }

        if(window.hasTimeConflict(date, startMins, endMins)) {
            window.showPremiumModal({ title: 'Zaman Çakışması', message: 'Bu saatte takviminizde zaten başka bir plan var.', type: 'warning' });
            return;
        }

        // Görevi globale ekle
        window.addGlobalTask(text, priority, 'kisisel', date, start, end, '', parentGoal, '');

        closeQuickAdd();

        // Tüm ekranları güncelle
        window.renderTasks();
        if(window.__getRenderCalendarRef()) window.__getRenderCalendarRef()();
        if(window.__getRenderEventsRef()) window.__getRenderEventsRef()();
        if(window.__getRenderStatisticsRef() && document.getElementById('istatistikler').classList.contains('active')) window.__getRenderStatisticsRef()();

        window.showPremiumModal({ title: 'Hızlı Ekleme Başarılı', message: 'Görev takviminize eklendi.', type: 'success' });
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
            const smartData = window.parseSmartText(rawText);
            const text = smartData.cleanText || "Hızlı Görev";

            const parentGoal = document.getElementById('quick-add-parent-goal').value;
            const priority = document.getElementById('quick-add-priority').value;
            const recurring = document.getElementById('quick-add-recurring').value;

            // NLP saat bulduysa onu kullan, bulamadıysa arayüzdeki zorunlu saati kullan
            const manualTime = document.getElementById('quick-add-time').value;
            const timeStart = smartData.parsedTime ? smartData.parsedTime : (manualTime || "09:00");
            const timeEnd = window.addOneHour(timeStart); // Bitiş otomatik 1 saat sonrası

            // NLP tarih bulduysa onu kullan, yoksa bugün
            const taskDateStr = smartData.parsedDate ? smartData.parsedDate : window.formatDateToString(new Date());

            const startMins = window.timeToMins(timeStart);
            const endMins = window.timeToMins(timeEnd);

            // Çakışma kontrolü
            if (window.hasTimeConflict(taskDateStr, startMins, endMins)) {
                window.showPremiumModal({ title: 'Zaman Çakışması', message: 'Bu saatte takviminizde başka plan var.', type: 'warning' });
                return;
            }

            // addSmartTask hem normal hem de sıklık (recurring) içeren görevleri mükemmel işler
            window.addSmartTask(text, priority, 'kisisel', taskDateStr, timeStart, timeEnd, "", parentGoal, recurring);

            closeQuickAddModal();

            // Arayüzleri yenile
            window.renderTasks();
            if(window.__getRenderCalendarRef()) window.__getRenderCalendarRef()();
            if(window.__getRenderEventsRef()) window.__getRenderEventsRef()();

            window.showPremiumModal({ title: 'Başarılı!', message: `"${text}" sisteme eklendi.`, type: 'success' });
        }
    });
}
// ==========================================================================
