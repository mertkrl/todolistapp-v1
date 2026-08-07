import { ensureHushedNotifQueue } from '../state/hushed-notif-queue-store.js';

function showRoleChangeToast({ direction, roleLabel }) {
    let stack = document.getElementById('social-toast-stack');
    if (!stack) {
        stack = document.createElement('div');
        stack.id = 'social-toast-stack';
        stack.className = 'social-toast-stack';
        document.body.appendChild(stack);
    }

    const isPromote = direction === 'promote';
    const accent = isPromote ? '#ffd166' : '#ff7675';
    const icon = isPromote ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
    const title = isPromote ? 'Terfi ettirildin!' : 'Rolün değişti';

    const toast = document.createElement('div');
    toast.className = 'social-toast';
    toast.style.borderLeft = `3px solid ${accent}`;
    toast.innerHTML = `
        <span class="st-emoji u-display-inline-flex_align-items-center_justify-content-cen" >
            <i class="fa-solid ${icon} u-font-size-15px" ></i>
        </span>
        <div class="st-text">
            <div><b>${window._escapeHtml(title)}</b></div>
            <div class="st-sub">Yeni rolün: <span class="st-role-label u-font-weight-600" >${window._escapeHtml(roleLabel || '')}</span></div>
        </div>`;
    toast.querySelector('.st-emoji').style.background = `${accent}22`;
    toast.querySelector('.st-emoji i').style.color = accent;
    toast.querySelector('.st-role-label').style.color = accent;
    stack.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));

    const remove = () => {
        toast.classList.add('is-leaving');
        toast.classList.remove('is-visible');
        setTimeout(() => toast.remove(), 260);
    };
    const timer = setTimeout(remove, 4500);
    toast.addEventListener('click', () => { clearTimeout(timer); remove(); });
}

// Arkadaşlık isteği, mesaj isteği, grup daveti, kaydedilen grupta yer açılması
// gibi şimdiye kadar sessizce sadece bildirim panelinde biriken bildirimler için
// sağ üstte kısa süreli, tıklanabilir bir uyarı gösterir. Sohbet mesajı toast'ından
// (avatar + balon görünümü) farklı olarak ikon rozeti + renkli kenarlık kullanır.
export function showGenericNotifToast({ icon, accent, title, body, onClick }) {
    // Odak kalkanı: kullanıcı odaktayken sosyal toast'lar ekrana çıkmaz,
    // kuyruğa alınır ve seans bitince tek özetle gösterilir (dcSetHushMode).
    if (window._focusHushActive) {
        const queue = ensureHushedNotifQueue();
        queue.push(title || '');
        if (queue.length > 50) queue.shift();
        return;
    }
    let stack = document.getElementById('social-toast-stack');
    if (!stack) {
        stack = document.createElement('div');
        stack.id = 'social-toast-stack';
        stack.className = 'social-toast-stack';
        document.body.appendChild(stack);
    }

    const color = accent || '#6c5ce7';
    const toast = document.createElement('div');
    toast.className = 'social-toast generic-notif-toast';
    toast.style.borderLeft = `3px solid ${color}`;
    if (onClick) toast.style.cursor = 'pointer';
    toast.innerHTML = `
        <span class="st-emoji u-display-inline-flex_align-items-center_justify-content-cen-2" >
            <i class="fa-solid ${icon || 'fa-bell'} u-font-size-15px" ></i>
        </span>
        <div class="st-text">
            <div><b>${window._escapeHtml(title)}</b></div>
            ${body ? `<div class="st-sub">${body}</div>` : ''}
        </div>`;
    toast.querySelector('.st-emoji').style.background = `${color}22`;
    toast.querySelector('.st-emoji i').style.color = color;
    stack.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));

    const remove = () => {
        toast.classList.add('is-leaving');
        toast.classList.remove('is-visible');
        setTimeout(() => toast.remove(), 260);
    };
    const timer = setTimeout(remove, 5000);
    toast.addEventListener('click', () => {
        clearTimeout(timer);
        remove();
        if (typeof onClick === 'function') onClick();
    });
}
