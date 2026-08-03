function getNewStorageData() {
    const entries = window.FocusStorage.get('focusai_journal_entries', []);
    return { entries, currentKey: 'focusai_journal_entries' };
}

function closeJournalModal() {
    const journalEditModal = document.getElementById('journal-edit-modal');
    if (journalEditModal) journalEditModal.classList.add('hidden');
}
window.closeJournalModal = closeJournalModal;

window.deleteJournalEntry = function(dateStr) {
    window.showPremiumModal({
        title: 'Günlüğü Sil',
        message: 'Bu gün sonu değerlendirmesini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
        type: 'warning',
        showCancel: true,
        confirmText: 'Sil',
        onConfirm: () => {
            const { entries } = getNewStorageData();
            const filteredEntries = entries.filter(e => e.date !== dateStr);
            window.FocusStorage.set('focusai_journal_entries', filteredEntries);

            if (typeof window.buildMassiveLibraryRows === 'function') window.buildMassiveLibraryRows();

            window.showPremiumModal({ title: 'Silindi', message: 'Günlük kaydı kütüphaneden kaldırıldı.', type: 'success' });
        }
    });
};

window.editJournalEntry = function(dateStr) {
    const { entries } = getNewStorageData();
    const entry = entries.find(e => e.date === dateStr);

    if (entry) {
        const journalEditModal = document.getElementById('journal-edit-modal');
        const editJournalDateInput = document.getElementById('edit-journal-date');
        const editJournalAchieveInput = document.getElementById('edit-journal-achieve');
        const editJournalImproveInput = document.getElementById('edit-journal-improve');

        editJournalDateInput.value = dateStr;
        editJournalAchieveInput.value = entry.achieve || '';
        editJournalImproveInput.value = entry.improve || '';

        window.updateCharCounter('edit-journal-achieve', 'edit-char-count-achieve', window.JOURNAL_CHAR_LIMIT);
        window.updateCharCounter('edit-journal-improve', 'edit-char-count-improve', window.JOURNAL_CHAR_LIMIT);

        if (journalEditModal) journalEditModal.classList.remove('hidden');
    }
};

(function initJournalEditModal() {
    const closeJournalEditBtn = document.getElementById('close-journal-edit-btn');
    const cancelJournalEditBtn = document.getElementById('cancel-journal-edit-btn');
    const saveJournalEditBtn = document.getElementById('save-journal-edit-btn');
    const editJournalDateInput = document.getElementById('edit-journal-date');
    const editJournalAchieveInput = document.getElementById('edit-journal-achieve');
    const editJournalImproveInput = document.getElementById('edit-journal-improve');

    if (closeJournalEditBtn) closeJournalEditBtn.addEventListener('click', closeJournalModal);
    if (cancelJournalEditBtn) cancelJournalEditBtn.addEventListener('click', closeJournalModal);

    if (saveJournalEditBtn) {
        saveJournalEditBtn.addEventListener('click', () => {
            const dateStr = editJournalDateInput.value;
            const achieve = editJournalAchieveInput.value.trim();
            const improve = editJournalImproveInput.value.trim();

            if (achieve === "" && improve === "") {
                window.showPremiumModal({
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
            window.FocusStorage.set('focusai_journal_entries', entries);

            closeJournalModal();

            if (typeof window.buildMassiveLibraryRows === 'function') window.buildMassiveLibraryRows();

            window.showPremiumModal({ title: 'Güncellendi', message: 'Değişiklikler Zihin Kütüphanenize başarıyla işlendi!', type: 'success' });
        });
    }
})();

export function deleteJournalEntry(...args) { return window.deleteJournalEntry(...args); }
export function editJournalEntry(...args) { return window.editJournalEntry(...args); }
export function closeJournalModal_export(...args) { return window.closeJournalModal(...args); }
