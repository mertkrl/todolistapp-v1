import { getCurrentUser } from '../state/current-user-store.js';

export function dcChatEnabled() {
    if (window.FOCUS_MESSAGING_ENABLED === false) return false;
    const currentUser = getCurrentUser();
    if (!currentUser) return false;
    return currentUser.plan === 'premium'
        || ['student', 'teacher'].includes(currentUser.institutionRole);
}
window.dcChatEnabled = dcChatEnabled;

export function avatarUploadEnabled() {
    const currentUser = getCurrentUser();
    if (!currentUser) return false;
    return currentUser.plan === 'premium'
        || ['student', 'teacher'].includes(currentUser.institutionRole);
}
window.avatarUploadEnabled = avatarUploadEnabled;

export function _applyPlanBadge() {
    const currentUser = getCurrentUser();
    const els = [document.getElementById('sidebar-plan-badge')].filter(Boolean);
    if (!els.length) return;
    if (!currentUser) { els.forEach(el => { el.style.display = 'none'; }); return; }
    const inst = ['student', 'teacher'].includes(currentUser.institutionRole);
    const key = inst ? 'kurumsal' : currentUser.plan === 'premium' ? 'premium' : 'free';
    const labels = { kurumsal: '🏫 Kurumsal', premium: '⭐ Premium', free: 'Ücretsiz Plan' };
    const titles = {
        kurumsal: `Kurumsal (${currentUser.institutionRole === 'teacher' ? 'öğretmen' : 'öğrenci'}): sohbet + sınıf paneli, 10 grup / 100 üye`,
        premium: 'Premium plan: sohbet açık, 5 grup / 30 üye',
        free: 'Ücretsiz plan: Sosyal + 1 grup (10 üye). Sohbet Premium planda.'
    };
    els.forEach(el => {
        el.textContent = labels[key];
        el.title = titles[key];
        el.className = 'plan-badge plan-badge--' + key;
        el.style.display = '';
    });
}
window._applyPlanBadge = _applyPlanBadge;

export function _applyChatGate() {
    const currentUser = getCurrentUser();
    const off = !dcChatEnabled();
    document.body.classList.toggle('dc-chat-disabled', off);
    _applyPlanBadge();
    if (currentUser) {
        console.info('[FocusAI Plan] plan=%s, rol=%s → sohbet %s',
            currentUser.plan || '-', currentUser.institutionRole || '-', off ? 'KAPALI' : 'AÇIK');
    }
    const mobBtn = document.getElementById('dc-home-chats-btn');
    if (mobBtn) {
        mobBtn.innerHTML = off
            ? '<i class="fa-solid fa-people-group"></i> Gruplar'
            : '<i class="fa-solid fa-comments"></i> Sohbetler';
    }
}
window._applyChatGate = _applyChatGate;
