// Hesap yaşı/tarih bazlı kontrol tarih/saat dilimi kenar durumlarına ve
// senkron gecikmelerine karşı kırılgan çıktı — bunun yerine daha basit ve
// güvenilir bir kural kullanılıyor: kullanıcı en az 1 görevi tamamlayana
// kadar Gün Sonu Değerlendirmesi hiç aktif olmasın/çıkmasın. Bu hem sayfa
// yüklenir yüklenmez senkron olarak bilinir (tasks zaten localStorage'da),
// hem de "henüz hiçbir şey yapmamış yepyeni kullanıcı" senaryosunu tarihe
// bakmadan doğru şekilde kapsar.
function _hasCompletedAtLeastOneTask() {
    const tasks = window.FocusStorage.get('tasks', []) || [];
    return tasks.some(t => t && t.completed);
}

// Ayarlar > Sistem Ayarları > Bildirimler'deki "Gün Sonu Değerlendirmesi"
// anahtarı ile kapatılabilir (script-system-settings.js).
function _eveningReflectionEnabled() {
    const cfg = window.FocusStorage.get('system_settings', {});
    return cfg.eveningReflection !== false;
}

export function checkEveningReflection() {
    if (!window.isReflectionTime() || !_eveningReflectionEnabled() || !_hasCompletedAtLeastOneTask()) {
        document.getElementById('evening-reflection-modal')?.classList.add('hidden');
        return;
    }
    const logDate = window.toInputDate(window.getLogicalReflectionDate());
    const journalEntries = window.FocusStorage.get('focusai_journal_entries', []);
    const todayEntry = journalEntries.find(e => e.date === logDate);
    if (!todayEntry) openReflectionModal();
}
// Görev tamamlandığında (script.js'in toggleTask'ı) ya da girişten sonra veri
// senkronize olduğunda (auth-ui.js) bu kontrolü tekrar çalıştırabilmek için
// global'e açılıyor.
window.checkEveningReflection = checkEveningReflection;

export function openReflectionModal() {
    const logDate = window.toInputDate(window.getLogicalReflectionDate());
    const journalEntries = window.FocusStorage.get('focusai_journal_entries', []);
    const todayRef = journalEntries.find(e => e.date === logDate);

    const achieveInput = document.getElementById('reflection-achieve');
    const improveInput = document.getElementById('reflection-improve');

    if (achieveInput) achieveInput.value = (todayRef && todayRef.achieve) ? todayRef.achieve : '';
    if (improveInput) improveInput.value = (todayRef && todayRef.improve) ? todayRef.improve : '';

    window.updateCharCounter('reflection-achieve', 'char-count-achieve', window.JOURNAL_CHAR_LIMIT);
    window.updateCharCounter('reflection-improve', 'char-count-improve', window.JOURNAL_CHAR_LIMIT);

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
