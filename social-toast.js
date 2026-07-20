// social-toast.js — social.js'ten ayrıldı (Faz 2 modülerleştirme).
// Global mini toast + custom confirm modal. Bağımsız, dış closure state'ine
// bağımlı değil (yalnızca window.escapeHtml varsa onu kullanır, yoksa yerel
// fallback'e düşer).
(function () {
'use strict';

// ─── GLOBAL MİNİ TOAST ───────────────────────────────────────────────────────
// alert() yerine kullanılan, engellemeyen bildirim. type: 'info' | 'error' | 'success'.
// type verilmezse metinden hata olup olmadığını tahmin eder (eski alert çağrıları için).
window.dcShowToast = function(text, type) {
    let toast = document.getElementById('dc-mini-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'dc-mini-toast';
        document.body.appendChild(toast);
    }
    if (!type) {
        type = /hata|başarısız|yetki|geçersiz|geçerli|olamaz|bulunamadı|gerek|malısın|en az|en fazla|dolu|kaldırıl|silinemedi|gönderilemedi|kaydedilemedi/i.test(String(text)) ? 'error' : 'info';
    }
    toast.textContent = text;
    toast.classList.remove('dc-toast-error', 'dc-toast-success');
    if (type === 'error')   toast.classList.add('dc-toast-error');
    if (type === 'success') toast.classList.add('dc-toast-success');
    toast.classList.add('show');
    clearTimeout(toast._hideTimer);
    // Uzun metinlere daha uzun süre — okunabilirlik için
    const dur = Math.max(2200, Math.min(6500, String(text).length * 55));
    toast._hideTimer = setTimeout(() => toast.classList.remove('show'), dur);
};

// ─── CUSTOM CONFIRM MODAL ────────────────────────────────────────────────────
window.showFocusaiConfirm = function({ title = '', desc = '', type = 'danger', confirmText = 'Onayla', cancelText = 'Vazgeç', icon = null } = {}) {
    return new Promise(resolve => {
        const icons = { danger: 'fa-triangle-exclamation', warning: 'fa-circle-exclamation', info: 'fa-circle-info' };
        const confirmClass = type === 'danger' ? 'confirm-danger' : 'confirm-primary';
        const overlay = document.createElement('div');
        overlay.className = 'focusai-confirm-overlay';
        overlay.innerHTML = `
            <div class="focusai-confirm-box">
                <div class="focusai-confirm-icon ${type}">
                    <i class="fa-solid ${icon || icons[type] || icons.info}"></i>
                </div>
                <div class="focusai-confirm-title">${_escapeHtml(title)}</div>
                <div class="focusai-confirm-desc">${desc}</div>
                <div class="focusai-confirm-actions">
                    ${cancelText ? `<button class="focusai-confirm-btn cancel" id="_fc_cancel">${cancelText}</button>` : ''}
                    <button class="focusai-confirm-btn ${confirmClass}" id="_fc_confirm">${confirmText}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        const close = (val) => {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.15s';
            setTimeout(() => overlay.remove(), 150);
            resolve(val);
        };
        overlay.querySelector('#_fc_confirm').addEventListener('click', () => close(true));
        overlay.querySelector('#_fc_cancel')?.addEventListener('click', () => close(false));
        overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
    });
};

function _escapeHtml(str) {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(str);
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

})();
