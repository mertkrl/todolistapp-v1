// ─── "KİŞİLER" POPOVER (2026-07-03) ──────────────────────────
// Selamlama şeridindeki "Çevrimiçi" rozetine tıklayınca #arena-online-card'ı
// rozetin altında açar/kapatır (mola sohbeti odak-daveti gibi diğer
// popover'larla aynı desen: sabit konumlu, dışarı tıklayınca kapanır).
function _onlinePopoverOutsideClick(e) {
    const panel = document.getElementById('arena-online-card');
    const badge = document.getElementById('dhs-online-badge');
    if (!panel) return;
    if (panel.contains(e.target) || (badge && badge.contains(e.target))) return;
    _closeOnlinePeoplePopover();
}
function _closeOnlinePeoplePopover() {
    document.getElementById('arena-online-card')?.classList.remove('aoc-open');
    document.removeEventListener('click', _onlinePopoverOutsideClick, true);
}
function _toggleOnlinePeoplePopover(anchor) {
    const panel = document.getElementById('arena-online-card');
    if (!panel) return;
    if (panel.classList.contains('aoc-open')) { _closeOnlinePeoplePopover(); return; }
    const r = (anchor || document.getElementById('dhs-online-badge'))?.getBoundingClientRect();
    if (r) {
        panel.style.top = (r.bottom + 8) + 'px';
        panel.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 300 - 8)) + 'px';
    }
    panel.classList.add('aoc-open');
    setTimeout(() => document.addEventListener('click', _onlinePopoverOutsideClick, true), 0);
}
window._toggleOnlinePeoplePopover = _toggleOnlinePeoplePopover;
window._closeOnlinePeoplePopover = _closeOnlinePeoplePopover;
document.getElementById('aoc-close-btn')?.addEventListener('click', _closeOnlinePeoplePopover);
