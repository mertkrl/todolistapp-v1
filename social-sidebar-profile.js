// ============================================================
// FOCUSAI SOCIAL — SOHBET PANELİ: PROFİL GÜNCELLEME + KİŞİLER LİSTESİ
// social.js'ten çıkarıldı (2026-07-18)
// ============================================================
// Faz G: gerçek ES import'lar — bu dosya inline-module-loader.js sırasında
// aşağıdaki üreticilerden SONRA yüklendiği için statik import güvenli.
import { getFriends } from './social-friends-notifications.js';
import { registerPresenceWatchIds } from './social-presence.js';
import { isBlockedEitherWay } from './social-block-users.js';
import { hasUnreadDm } from './social-dm-notifications.js';
import { goToDmChat, openMiniProfile } from './social-dc-contacts.js';
import { getCurrentUser } from './state/current-user-store.js';

(function () {
'use strict';

// ── SOHBET PANELİ: PROFİL GÜNCELLEME ────────────────────────────────
function updateSbProfile() {
    if (!getCurrentUser()) return;
    const avatarEl   = document.getElementById('sb-sidebar-avatar');
    const nameEl     = document.getElementById('sb-sidebar-name');
    const dotEl      = document.getElementById('sb-online-dot');
    const labelEl    = document.getElementById('sb-status-label');
    const unameEl    = document.getElementById('sb-sidebar-username');
    const color      = getCurrentUser().avatarColor || '6c5ce7';
    const name       = getCurrentUser().displayName || getCurrentUser().username || 'Sen';
    const statusColor = getCurrentUser().statusColor || '#2ed573';

    const avatarUrl = getCurrentUser().customAvatar
        || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${color}&color=fff&size=80`;

    if (avatarEl) {
        avatarEl.src = avatarUrl;
        avatarEl.style.border = `2px solid #${color.replace('#','')}`;
        avatarEl.style.boxSizing = 'border-box';
        avatarEl.style.objectFit = 'cover';
    }
    if (nameEl)   nameEl.textContent = name;
    if (dotEl)    dotEl.style.background = statusColor;

    // #kullanıcıadı elementi varsa göster, yoksa nameEl'in yanına ekle
    if (unameEl) {
        unameEl.textContent = getCurrentUser().username ? `#${getCurrentUser().username}` : '';
    }

    const statusLabels = { online: 'Çevrimiçi', away: 'Meşgul', dnd: 'Rahatsız Etme', offline: 'Görünmez' };
    if (labelEl) labelEl.textContent = statusLabels[getCurrentUser().status || 'online'] || 'Çevrimiçi';

    setTimeout(() => {
        const gBadge = document.getElementById('sb-groups-badge');
        const gList  = document.getElementById('sidebar-my-conversations-list');
        if (gBadge && gList) {
            const count = gList.querySelectorAll('.sidebar-group-item-card').length;
            gBadge.textContent = count;
        }
    }, 1800);
}
window.updateSbProfile = updateSbProfile;

// ── SOHBET PANELİ: KİŞİLER LİSTESİ ─────────────────────────────────
let _sbContactsRefs = []; // Önceki dinleyiciler — yeniden çağrıldığında çift kayıt oluşmasın
function syncSidebarContacts() {
    const listEl  = document.getElementById('sidebar-contacts-list');
    const badgeEl = document.getElementById('sb-contacts-badge');
    if (!listEl) return;

    const friends = getFriends();
    if (!friends.length) {
        listEl.innerHTML = '<div class="sidebar-chat-empty-state">Arkadaş ekle, burada görünsün.</div>';
        if (badgeEl) badgeEl.textContent = '0';
        return;
    }

    if (window.FocusSupabase && getCurrentUser()?.id) {
        listEl.innerHTML = '';
        if (badgeEl) badgeEl.textContent = friends.length;

        window.FocusSupabase.from('profiles').select('id, username, display_name, avatar_color, custom_avatar, avatar_initials')
            .in('username', friends)
            .then(({ data: profiles }) => {
                registerPresenceWatchIds((profiles || []).map(u => u.id).filter(Boolean));
                const presenceState = window.getCommunityPresenceState ? window.getCommunityPresenceState() : {};
                (profiles || []).forEach(u => {
                    const username    = u.username;
                    if (isBlockedEitherWay(username)) return;
                    const displayName = u.display_name || username;
                    const color       = u.avatar_color || '6c5ce7';
                    const isOnline    = !!(presenceState && presenceState[username]);

                    let card = document.getElementById(`sb-contact-${username}`);
                    const isNew = !card;
                    if (isNew) {
                        card = document.createElement('div');
                        card.id        = `sb-contact-${username}`;
                        card.className = 'sb-contact-card';
                    }

                    const unread = hasUnreadDm(username);
                    card.innerHTML = `
                        <div class="sb-contact-avatar u-position-relative" title="Profili Gör">
                            ${window._escapeHtml(displayName.charAt(0).toUpperCase())}
                            <span class="sb-contact-dot${isOnline ? ' online' : ''}"></span>
                        </div>
                        <div class="sb-contact-info" title="Sohbete git">
                            <div class="sb-contact-name">${window._escapeHtml(displayName)}</div>
                            <div class="sb-contact-username u-font-size-11px_color-rgba2552552550p35" >#${window._escapeHtml(username)}</div>
                            <div class="sb-contact-status">${isOnline ? '🟢 Çevrimiçi' : '⚫ Çevrimdışı'}</div>
                        </div>
                        ${unread ? '<span class="dc-unread-pill"></span>' : ''}
                        ${isOnline ? '<button class="sb-contact-focus-btn" title="Birlikte Odaklan" aria-label="Birlikte Odaklan"><i class="fa-solid fa-bolt"></i></button>' : ''}
                        <button class="sb-contact-detail-btn" title="Profili Gör" aria-label="Profili Gör"><i class="fa-solid fa-ellipsis"></i></button>
                    `;
                    card.querySelector('.sb-contact-avatar').style.background = '#' + color;

                    const openDM = () => {
                        if (typeof goToDmChat === 'function') goToDmChat(username, displayName);
                        else if (typeof window.openDcDmRoom === 'function') window.openDcDmRoom(username, displayName);
                    };
                    card.querySelector('.sb-contact-avatar').addEventListener('click', e => {
                        e.stopPropagation();
                        openMiniProfile(username, { displayName, avatarColor: color, customAvatar: u.custom_avatar, avatarInitials: u.avatar_initials || null }, card);
                    });
                    card.querySelector('.sb-contact-detail-btn').addEventListener('click', e => {
                        e.stopPropagation();
                        openMiniProfile(username, { displayName, avatarColor: color, customAvatar: u.custom_avatar, avatarInitials: u.avatar_initials || null }, card);
                    });
                    card.querySelector('.sb-contact-focus-btn')?.addEventListener('click', e => {
                        e.stopPropagation();
                        if (typeof window.openBuddyFocusSettingsModal === 'function') window.openBuddyFocusSettingsModal(username, displayName, color, null);
                    });
                    card.querySelector('.sb-contact-info').addEventListener('click', e => {
                        e.stopPropagation();
                        openDM();
                    });

                    if (isNew) listEl.appendChild(card);
                });
            });
        return;
    }

    // Firebase kaldırıldı — Supabase yolu yukarıda ele alındı
    _sbContactsRefs.forEach(ref => ref.off?.());
    _sbContactsRefs = [];
}
window.syncSidebarContacts = syncSidebarContacts;

// Profil düzenleme butonunu mevcut modal'a bağla
const _sbEditBtn = document.getElementById('sb-profile-edit-btn');
if (_sbEditBtn) {
    _sbEditBtn.addEventListener('click', () => {
        document.getElementById('social-change-profile-btn')?.click();
    });
}

})();
