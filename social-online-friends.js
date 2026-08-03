import { _resolveProfileByUsername } from './social-dc-profile-resolve.js';
import { getFriends, showUnfriendConfirm } from './social-friends-notifications.js';

import { hasUnreadDm } from './social-dm-notifications.js';

import { getCurrentUser } from './state/current-user-store.js';
import { getLastAvatarClick } from './state/last-avatar-click-store.js';
import { getOnlineFriendsPresenceCb, setOnlineFriendsPresenceCb } from './state/online-friends-presence-cb-store.js';
// ============================================================
// FOCUSAI SOCIAL-ONLINE-FRIENDS.JS
// social.js'ten çıkarılmış "Çevrimiçi Arkadaşlar" (yeni nesil dikey liste)
// widget'ı: presence durumuna göre arkadaş listesini render eder.
// getCurrentUser(), getFriends, window.isBlockedEitherWay,
// window._resolveProfileByUsername, window._escapeHtml, window.avatarImgHtml,
// hasUnreadDm, window.openBuddyFocusSettingsModal,
// window.showUnfriendConfirm, window.goToDmChat, window.openMiniProfile
// gibi social.js globallerine bağımlı — ondan SONRA yüklenmeli.
// window._onlineFriendsPresenceCb ve getLastAvatarClick(), social.js'in
// geri kalanıyla PAYLAŞILAN durumdur (orada da okunuyor/yazılıyor) — bu
// yüzden bare değil, window üzerinden erişiliyor.
// ============================================================
(function () {
'use strict';

function subscribeOnlineFriends() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    // Önceki dinleyicileri temizle
    if (getOnlineFriendsPresenceCb()) { window.removeEventListener('focusai:presence-changed', getOnlineFriendsPresenceCb()); setOnlineFriendsPresenceCb(null); }

    {
        const render = async () => {
            // "Çevrimiçi" rozeti (#dhs-online-badge) selamlama şeridinin parçası —
            // renderHomeSummary() her tazelemede innerHTML'i baştan basıyor,
            // yani bu elementler her seferinde YENİDEN oluşuyor. Bu yüzden
            // countEl/dotEl/listEl burada, render() içinde, HER ÇAĞRIDA taze
            // sorgulanır — dışarıda bir kere yakalanırsa (eskiden listEl öyleydi)
            // renderHomeSummary() bir sonraki tazelemede DOM'u yeniden bastığında
            // yazılan node kopup görünmez oluyor, sayaç güncel kalırken liste
            // donmuş/eski durumda kalıyordu (bkz. kullanıcı raporu: rozet "1
            // Çevrimiçi" derken kart hâlâ "Çevrimdışı" gösteriyordu).
            const listEl = document.getElementById('online-friends-list');
            if (!listEl) return;
            const countEl = document.getElementById('dhs-online-count');
            const dotEl = document.getElementById('dhs-online-dot');
            const state = window.getCommunityPresenceState ? window.getCommunityPresenceState() : {};
            const onlineUsernames = new Set();
            Object.values(state).forEach(presArr => {
                if (Array.isArray(presArr)) {
                    presArr.forEach(p => { if (p.username) onlineUsernames.add(p.username); });
                }
            });

            const friends = getFriends();
            const allFriendData = await Promise.all(
                friends
                    .filter(u => !(typeof window.isBlockedEitherWay === 'function' && window.isBlockedEitherWay(u)))
                    .map(async u => {
                        const profile = await window._resolveProfileByUsername?.(u);
                        return {
                            username: u,
                            displayName: profile?.display_name || profile?.username || u,
                            avatarColor: profile?.avatar_color || '6c5ce7',
                            online: onlineUsernames.has(u)
                        };
                    })
            );
            allFriendData.sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0));
            const onlineCount = allFriendData.filter(f => f.online).length;

            if (countEl) countEl.textContent = onlineCount;
            if (dotEl) dotEl.style.color = onlineCount > 0 ? '#2ed573' : 'var(--text-muted)';

            if (!allFriendData.length) {
                listEl.innerHTML = `
                    <div class="dc-empty-cta-box">
                        <i class="fa-solid fa-user-group dc-empty-cta-icon"></i>
                        <div class="dc-empty-cta-title">Henüz arkadaşın yok</div>
                        <div class="dc-empty-cta-sub">Arkadaşlarını ekle; birlikte odaklanın, liderlik tablosunda yarışın.</div>
                        <button class="primary-btn dc-empty-cta-btn" data-empty-cta="add-friend">
                            <i class="fa-solid fa-user-plus"></i> Kişi Ekle
                        </button>
                    </div>`;
                return;
            }

            listEl.innerHTML = allFriendData.map(f => `
            <div class="online-friend-bubble${f.online ? '' : ' is-offline'}">
                <div class="si-row-g10">
                    <div class="sb-friend-avatar-zone u-position-relative_flex-shrink-0_cursor-pointer" data-username="${window._escapeHtml(f.username)}" data-name="${window._escapeHtml(f.displayName)}" title="Profili görüntüle (çift tık: sohbeti aç)">
                        ${window.avatarImgHtml(f, 34)}
                        <span class="dc-dm-status-dot ${f.online ? 'online' : 'offline'}"></span>
                        ${hasUnreadDm(f.username) ? '<span class="dc-unread-dot"></span>' : ''}
                    </div>
                    <div class="sb-friend-name-zone u-cursor-pointer" data-username="${window._escapeHtml(f.username)}" data-name="${window._escapeHtml(f.displayName)}" title="Profili görüntüle">
                        <div class="u-font-size-13px_color-hfff_font-weight-600_max-width-90px_o">${window._escapeHtml(f.displayName)}</div>
                        <div class="dc-dm-status-label">${f.online ? 'Çevrimiçi' : 'Çevrimdışı'}</div>
                    </div>
                </div>
                <div class="u-display-flex_gap-6px_margin-top-6px">
                    <button class="cw-invite-btn${!f.online ? ' cw-invite-btn--offline' : ''} u-flex-1_font-size-11px_padding-5px8px" data-username="${window._escapeHtml(f.username)}" data-name="${window._escapeHtml(f.displayName)}" data-color="${window._escapeHtml(f.avatarColor || '6c5ce7')}" ${!f.online ? 'disabled title="Bu kullanıcı şu an çevrimdışı"' : ''}>
                        <i class="fa-solid fa-bolt"></i> Odak
                    </button>
                    <button class="sb-dm-friend-btn u-flex-1_font-size-11px_padding-5px8px_background-rgba108922 son-dm-friend-btn" data-username="${window._escapeHtml(f.username)}" data-name="${window._escapeHtml(f.displayName)}">
                        <i class="fa-solid fa-message"></i> DM
                    </button>
                    <button class="sb-unfriend-btn" data-username="${window._escapeHtml(f.username)}" data-name="${window._escapeHtml(f.displayName)}" title="Arkadaşlıktan Çıkar">
                        <i class="fa-solid fa-user-minus"></i>
                    </button>
                </div>
            </div>`).join('');

            listEl.querySelectorAll('.sb-dm-friend-btn').forEach(btn => {
                btn.addEventListener('click', () => window.goToDmChat(btn.dataset.username, btn.dataset.name));
            });
            listEl.querySelectorAll('.sb-friend-avatar-zone').forEach(zone => {
                zone.addEventListener('click', () => {
                    const username = zone.dataset.username;
                    const now = Date.now();
                    if (getLastAvatarClick().username === username && (now - getLastAvatarClick().time) < 500) {
                        getLastAvatarClick().username = null; getLastAvatarClick().time = 0;
                        document.querySelectorAll('.mini-profile-popup').forEach(p => p.remove());
                        window.goToDmChat(username, zone.dataset.name); return;
                    }
                    getLastAvatarClick().username = username; getLastAvatarClick().time = now;
                    window.openMiniProfile(username, null, zone);
                });
            });
            listEl.querySelectorAll('.sb-friend-name-zone').forEach(zone => {
                zone.addEventListener('click', () => window.openMiniProfile(zone.dataset.username, null, zone));
            });
            listEl.querySelectorAll('.cw-invite-btn').forEach(btn => {
                btn.addEventListener('click', () => window.openBuddyFocusSettingsModal(btn.dataset.username, btn.dataset.name, btn.dataset.color, null));
            });
            listEl.querySelectorAll('.sb-unfriend-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    showUnfriendConfirm(btn.dataset.username, btn.dataset.name || btn.dataset.username);
                });
            });
        };

        setOnlineFriendsPresenceCb(render);
        window.addEventListener('focusai:presence-changed', render);
        render();
    }
}
window.subscribeOnlineFriends = subscribeOnlineFriends;

})();
