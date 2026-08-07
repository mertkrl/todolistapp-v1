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
