// ─── "YENİ MESAJLAR" AYIRACI + OKUNMAMIŞA HIZLI ATLAMA BUTONU ──────────
// social.js dosyasından çıkarıldı (2026-07-18).
function insertDcUnreadDivider(container) {
    const divider = document.createElement('div');
    divider.className = 'dc-unread-divider';
    divider.innerHTML = `<span class="dc-unread-divider-line"></span><span class="dc-unread-divider-label">Yeni mesajlar</span><span class="dc-unread-divider-line"></span>`;
    container.appendChild(divider);
}
window.insertDcUnreadDivider = insertDcUnreadDivider;

function setupDcJumpUnreadBtn(streamEl) {
    const btn = document.getElementById('dc-jump-unread-btn');
    if (!btn) return;

    const updateVisibility = () => {
        const divider = streamEl.querySelector('.dc-unread-divider');
        if (!divider) {
            btn.style.display = 'none';
            return;
        }
        const streamRect = streamEl.getBoundingClientRect();
        const dividerRect = divider.getBoundingClientRect();
        const isVisible = dividerRect.bottom > streamRect.top && dividerRect.top < streamRect.bottom;
        btn.style.display = isVisible ? 'none' : 'flex';
    };

    if (!btn.dataset.bound) {
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => {
            const divider = streamEl.querySelector('.dc-unread-divider');
            if (divider) divider.scrollIntoView({ block: 'center', behavior: 'smooth' });
        });
        streamEl.addEventListener('scroll', updateVisibility);
    }

    updateVisibility();
}
window.setupDcJumpUnreadBtn = setupDcJumpUnreadBtn;
