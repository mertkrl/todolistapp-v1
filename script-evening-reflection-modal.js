export function checkEveningReflection() {
    if (!window.isReflectionTime()) return;
    const logDate = window.toInputDate(window.getLogicalReflectionDate());
    const journalEntries = window.FocusStorage.get('focusai_journal_entries', []);
    const todayEntry = journalEntries.find(e => e.date === logDate);
    if (!todayEntry) openReflectionModal();
}

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
