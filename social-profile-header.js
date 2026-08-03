// social-profile-header.js
// social.js'ten çıkarıldı (Faz E, 2026-07-23): profil header güncelleme
// (avatar/isim/kullanıcı adı/durum — Arkadaşlar sekmesi + sol sidebar +
// sohbet paneli, üç ayrı DOM bölgesinde aynı bilgiyi senkron tutar) ve
// "topluluk profili henüz kurulmadı" banner'ı.
//
// Dış bağımlılıklar (window.* üzerinden): getCurrentUser(),
// window.getLocalXP, window.avatarSrc, window._applyPlanBadge.
import { getCurrentUser } from './state/current-user-store.js';
export function updateProfileHeader() {
        if (!getCurrentUser()) return;
        const xp = window.getLocalXP();
        const el = id => document.getElementById(id);
        const avatarUrl = getCurrentUser().customAvatar || window.avatarSrc(getCurrentUser().displayName, getCurrentUser().avatarColor);
        const ringColor = '#' + (getCurrentUser().avatarColor || '6c5ce7').replace('#', '');
        const statusColor = getCurrentUser().statusColor || '#2ed573';
        const applyAvatar = (id) => {
            const img = el(id);
            if (!img) return;
            img.src = avatarUrl;
            img.style.border = `2px solid ${ringColor}`;
            img.style.boxSizing = 'border-box';
            img.style.objectFit = 'cover';
        };

        // Arkadaşlar sekmesi profil header
        applyAvatar('social-my-avatar');
        if (el('social-my-displayname')) el('social-my-displayname').textContent = getCurrentUser().displayName;
        if (el('social-my-username')) el('social-my-username').textContent = getCurrentUser().username;
        if (el('social-my-xp')) el('social-my-xp').textContent = `${xp} XP`;

        // Sol sidebar profil alanı (ana sidebar)
        applyAvatar('sidebar-avatar');
        if (el('sidebar-display-name')) el('sidebar-display-name').textContent = getCurrentUser().displayName;
        if (el('sidebar-username-line')) el('sidebar-username-line').textContent = getCurrentUser().username ? `#${getCurrentUser().username}` : '';
        if (el('sidebar-status-dot')) el('sidebar-status-dot').style.background = statusColor;

        // Sohbet paneli profil alanı
        applyAvatar('sb-sidebar-avatar');
        if (el('sb-sidebar-name')) el('sb-sidebar-name').textContent = getCurrentUser().displayName;
        if (el('sb-sidebar-username')) el('sb-sidebar-username').textContent = getCurrentUser().username ? `#${getCurrentUser().username}` : '';
        if (el('sb-online-dot')) el('sb-online-dot').style.background = statusColor;
        const statusLabels = { online: 'Çevrimiçi', away: 'Meşgul', dnd: 'Rahatsız Etme', offline: 'Görünmez' };
        if (el('sb-status-label')) el('sb-status-label').textContent = statusLabels[getCurrentUser().status || 'online'] || 'Çevrimiçi';

        el('social-not-configured')?.classList.add('hidden');
        window._applyPlanBadge();
    }
    window.updateProfileHeader = updateProfileHeader;

export function showNotConfiguredBanner() {
        document.getElementById('social-not-configured')?.classList.remove('hidden');
        document.getElementById('social-profile-header')?.classList.add('hidden');
    }
    window.showNotConfiguredBanner = showNotConfiguredBanner;

