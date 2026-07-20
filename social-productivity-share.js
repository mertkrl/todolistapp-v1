// social-productivity-share.js — social.js'ten ayrıldı (Faz 2 modülerleştirme).
// ── ÜRETKENLİK PAYLAŞMA SİSTEMİ ──────────────────────────
// window.currentUser (social.js her reassignment'ta senkron tutuyor) ve
// window.__getActiveGroupIdRef (social.js'teki salt-okunur closure değişkeni
// için köprü) kullanılıyor.
(function () {
'use strict';

function getProductivityStats() {
    try {
        // Tamamlanan görevler (completedAt alanı olmayabilir, sadece completed flag'i kontrol et)
        const tasks = typeof FocusStorage !== 'undefined'
            ? FocusStorage.get('tasks', [])
            : JSON.parse(localStorage.getItem('focusai_tasks') || '[]');
        const completedCount = (Array.isArray(tasks) ? tasks : [])
            .filter(t => t.completed === true).length;

        // Toplam odak dakikası
        const focusMin = typeof FocusStorage !== 'undefined'
            ? FocusStorage.get('total_focus_minutes', 0)
            : parseInt(localStorage.getItem('focusai_total_focus_minutes') || '0');

        return { completedToday: completedCount, focusMin: focusMin || 0 };
    } catch { return { completedToday: 0, focusMin: 0 }; }
}
window.getProductivityStats = getProductivityStats;

function buildProductivityMessage(stats) {
    const name = window.currentUser ? (window.currentUser.displayName || window.currentUser.username) : 'Kullanıcı';
    const taskPart = stats.completedToday > 0
        ? `${stats.completedToday} görev tamamlamış durumda ✅`
        : null;
    const focusPart = stats.focusMin > 0
        ? `${stats.focusMin} dakika odaklandı ⏱️`
        : null;

    const parts = [taskPart, focusPart].filter(Boolean);
    if (parts.length === 0) return `🔥 ${name} bugün çalışmaya hazır — hadi başlayalım!`;
    return `🔥 ${name} bugün ${parts.join(' ve ')}!`;
}

const shareProductivityBtn = document.getElementById('share-productivity-btn');
const productivityPopup   = document.getElementById('productivity-preview-popup');
const prodPreviewText     = document.getElementById('prod-preview-message-text');
const prodSendBtn         = document.getElementById('prod-send-btn');
const prodCancelBtn       = document.getElementById('prod-cancel-btn');

if (shareProductivityBtn && productivityPopup) {
    shareProductivityBtn.addEventListener('click', () => {
        if (productivityPopup.classList.contains('visible')) {
            productivityPopup.classList.remove('visible');
            return;
        }
        const stats = getProductivityStats();
        const msg   = buildProductivityMessage(stats);
        if (prodPreviewText) prodPreviewText.textContent = msg;
        productivityPopup.classList.add('visible');
    });
}

if (prodSendBtn) {
    prodSendBtn.addEventListener('click', () => {
        const _st3 = window._dcState || {};
        const _grp3  = _st3.groupCode || (window.__getActiveGroupIdRef ? window.__getActiveGroupIdRef() : null);
        const _room3 = _st3.roomId || null;
        const _chan3  = _st3.chanId || null;
        if (!_grp3) { window.dcShowToast('Önce bir gruba gir.'); return; }
        const text = prodPreviewText ? prodPreviewText.textContent : '';
        if (!text) return;

        // Supabase grubunda açık bir sohbet varsa, mesajı oraya yaz
        if (window._dcCurrentGroupScope && window.FocusSupabase && window.currentUser?.id) {
            window.FocusSupabase.from('messages').insert({
                scope_type: window._dcCurrentGroupScope.type,
                scope_id:   window._dcCurrentGroupScope.id,
                sender_id:  window.currentUser.id,
                text
            }).then(({ error }) => {
                if (error) { console.error('[FocusAI] verimlilik paylaşımı hatası', error); return; }
                productivityPopup.classList.remove('visible');
            });
            return;
        }
    });
}

if (prodCancelBtn) {
    prodCancelBtn.addEventListener('click', () => {
        productivityPopup.classList.remove('visible');
    });
}

})();
