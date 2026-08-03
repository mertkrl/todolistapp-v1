import { dcUnreadTotals } from './social-dm-notifications.js';
const _origRenderFloating = window.renderFloatingChatBadge;
window.renderFloatingChatBadge = function() {
    if (typeof _origRenderFloating === 'function') _origRenderFloating();
    // Aynı tek kaynaktan oku — yüzen rozetle aynı mantık: sayı sadece DM,
    // grup hareketliliği sessiz nokta.
    const t = (typeof window.dcUnreadTotals === 'function') ? dcUnreadTotals() : { dmTotal: 0, groupTotal: 0 };
    const badge = document.getElementById('social-chat-unread-count');
    if (badge) {
        if (t.dmTotal > 0) {
            badge.textContent = t.dmTotal > 9 ? '9+' : t.dmTotal;
            badge.classList.remove('is-dot');
            badge.style.display = 'inline-flex';
        } else if (t.groupTotal > 0) {
            badge.textContent = '';
            badge.classList.add('is-dot');
            badge.style.display = 'inline-flex';
        } else {
            badge.classList.remove('is-dot');
            badge.style.display = 'none';
        }
    }
};
