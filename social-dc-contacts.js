import { dcShowConfirm } from './social-dc-confirm-toasts.js';
import { getFriends, sendFriendRequest } from './social-friends-notifications.js';

import { markDmRead, hasUnreadDm } from './social-dm-notifications.js';

import { _resolveProfileByUsername } from './social-dc-profile-resolve.js';
import { getLastAvatarClick } from './state/last-avatar-click-store.js';
import { getDB, getUser } from './social-misc-pure-utils.js';
// social-dc-contacts.js
// social.js'ten çıkarıldı (Faz E, 2026-07-23): kişi listesi doldurma
// (syncDcContactList), DM sohbetine geçiş (goToDmChat) ve mini profil
// popup'ı (openMiniProfile). Bu üç fonksiyon social.js'te bitişik değildi
// (aralarında DC init glue kodu — initDcArchitecture bootstrap, sidebar
// profil click-delegation — vardı, o kod social.js'te BİLİNÇLİ OLARAK
// bırakıldı), burada tek dosyada birleştirildi.
//
// Dış bağımlılıklar (window.* üzerinden): getDB, getUser,
// window._escapeHtml, window.dcShowToast, window.openDcDmRoom,
// window.openSetupModalAsEdit, window.avatarImgHtml, window._sanitizeHexColor,
// window.avatarFallbackSrc, hasUnreadDm, markDmRead,
// window.isBlockedEitherWay, sendFriendRequest, window.toggleUserBlocked,
// window.dcShowConfirm, getFriends (gerçek global, social-friends-
// notifications.js'te tanımlı), window.getCommunityPresenceState,
// getLastAvatarClick() (paylaşılan state, sadece okunuyor/property mutasyonu).
(function () {
'use strict';

    // ─── KİŞİLER LİSTESİNİ DC FORMATINDA DOLDUR ─────────
    // Not: eskiden Firebase Realtime DB ("focusai_community/users") kullanıyordu; M2 göçüyle
    // birlikte o veritabanı tamamen kapatıldı (getDB() artık hep null döner), bu yüzden yeni
    // eklenen arkadaşlar hiç render edilmiyordu. Artık Supabase profiles + community-presence
    // kanalından (window.getCommunityPresenceState) okuyor.
    async function syncDcContactList() {
        const container = document.getElementById('sidebar-contacts-list');
        if (!container) return;

        const friends = getFriends();

        if (!friends.length) {
            container.innerHTML = `
                <div class="dc-empty-cta-box dc-empty-cta-box--compact">
                    <div class="dc-empty-cta-sub">Arkadaş ekle, buradan mesajlaş.</div>
                    <button class="dc-empty-cta-btn dc-empty-cta-btn--ghost" data-empty-cta="add-friend">
                        <i class="fa-solid fa-user-plus"></i> Kişi Ekle
                    </button>
                </div>`;
            const badge = document.getElementById('sb-contacts-badge');
            if (badge) badge.textContent = '0';
            return;
        }

        if (!window.FocusSupabase) return;

        const state = window.getCommunityPresenceState ? window.getCommunityPresenceState() : {};
        const onlineUsernames = new Set();
        Object.values(state).forEach(presArr => {
            if (Array.isArray(presArr)) presArr.forEach(p => { if (p.username) onlineUsernames.add(p.username); });
        });

        const visibleFriends = friends.filter(u => !(typeof window.isBlockedEitherWay === 'function' && window.isBlockedEitherWay(u)));

        const profiles = await Promise.all(visibleFriends.map(u => (
            typeof _resolveProfileByUsername === 'function' ? _resolveProfileByUsername(u) : null
        )));

        const sortedFriends = visibleFriends
            .map((username, i) => ({ username, profile: profiles[i], online: onlineUsernames.has(username) }))
            .sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0));

        container.innerHTML = '';
        let onlineCount = 0;
        sortedFriends.forEach(({ username, profile, online: isOnline }) => {
            if (isOnline) onlineCount++;
            const uData = {
                displayName: profile?.display_name || username,
                avatarColor: profile?.avatar_color || '6c5ce7',
                customAvatar: profile?.custom_avatar || null, avatarInitials: profile?.avatar_initials || null,
            };
            const item = document.createElement('div');
            item.className = 'dc-dm-item' + (isOnline ? '' : ' is-offline');
            item.id = 'sb-contact-' + username;

            item.innerHTML = `
                <div class="sb-contact-avatar u-position-relative_flex-shrink-0" >
                    ${window.avatarImgHtml(uData, 30, 'flex-shrink:0;')}
                    <span class="dc-dm-status-dot ${isOnline ? 'online' : 'offline'}"></span>
                    ${typeof window.hasUnreadDm === 'function' && hasUnreadDm(username) ? '<span class="dc-unread-dot"></span>' : ''}
                </div>
                <div class="u-flex-1_min-width-0_overflow-hidden">
                    <span class="dc-dm-name">${window._escapeHtml(uData.displayName)}</span>
                </div>
            `;

            item.addEventListener('click', (e) => {
                document.querySelectorAll('.dc-dm-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                const now = Date.now();
                if (getLastAvatarClick().username === username && (now - getLastAvatarClick().time) < 500) {
                    getLastAvatarClick().username = null; getLastAvatarClick().time = 0;
                    document.querySelectorAll('.mini-profile-popup').forEach(p => p.remove());
                    goToDmChat(username, uData.displayName);
                    return;
                }
                getLastAvatarClick().username = username; getLastAvatarClick().time = now;
                openMiniProfile(username, uData, item);
            });
            container.appendChild(item);
        });
        const badge = document.getElementById('sb-contacts-badge');
        if (badge) badge.textContent = onlineCount;
    }

    // Presence değiştiğinde (biri çevrimiçi/çevrimdışı olunca) listeyi canlı güncelle
    window.addEventListener('focusai:presence-changed', () => {
        if (document.getElementById('sidebar-contacts-list')) syncDcContactList();
    });
    // Bu fonksiyon ayrı bir IIFE içinde tanımlı; arkadaş listesi değiştiğinde
    // (focusai:friends-changed) onu çağırabilmek için global olarak da erişilebilir yapıyoruz —
    // aksi halde dış kapsamdaki "typeof syncDcContactList === 'function'" kontrolü hep
    // false dönüyor ve liste yalnızca sayfa yenilendiğinde (hard reset) güncelleniyordu.
    window.syncDcContactList = syncDcContactList;
    // ─── BİR KULLANICIYLA DM SOHBETİNE GEÇ ──────────────────
    // Sohbet panelini açar, kişiler görünümüne döner, doğru DM odasını yükler
    // ve mesaj kutusuna odaklanır — "Mesaj" butonuna tek tıkla sohbete iniş.
    function goToDmChat(username, displayName) {
        const sidebar = document.getElementById('premium-social-sidebar');
        if (sidebar) sidebar.classList.remove('hidden-sidebar');

        // Bir grup kanalı açıksa ana panele (kişiler/gruplar listesi) dön
        const home  = document.getElementById('dc-home-panel');
        const guild = document.getElementById('dc-guild-panel');
        if (home)  home.style.display  = 'flex';
        if (guild) guild.style.display = 'none';

        if (typeof window.openDcDmRoom === 'function') {
            window.openDcDmRoom(username, displayName);
        }

        if (typeof window.markDmRead === 'function') markDmRead(username);

        setTimeout(() => {
            document.getElementById('sidebar-chat-message-input')?.focus();
        }, 150);
    }
    window.goToDmChat = goToDmChat;

    // ─── MİNİ PROFİL POPUP ──────────────────────────────────
    function openMiniProfile(username, cachedData, anchorEl, groupMemberData) {
        document.querySelectorAll('.mini-profile-popup').forEach(p => p.remove());

        const database = getDB();
        const me = getUser();
        const esc = window._escapeHtml;

        // Engellenen (veya bizi engelleyen) kullanıcıların profili hiçbir
        // şekilde görüntülenemez
        if (me && me.username !== username && typeof window.isBlockedEitherWay === 'function' && window.isBlockedEitherWay(username)) {
                            window.dcShowToast('Bu kullanıcının profilini görüntüleyemezsiniz.');
            return;
        }

        const popup = document.createElement('div');
        popup.className = 'mini-profile-popup';
        popup.innerHTML = `<div class="mp-loading"><i class="fa-solid fa-spinner fa-spin"></i></div>`;
        document.body.appendChild(popup);

        // Konumlandır
        const rect = anchorEl.getBoundingClientRect();
        const spaceRight = window.innerWidth - rect.right;
        const spaceLeft  = rect.left;
        popup.style.top  = Math.min(rect.top, window.innerHeight - 340) + 'px';
        if (spaceRight >= 240) {
            popup.style.left = (rect.right + 8) + 'px';
        } else {
            popup.style.left = Math.max(8, rect.left - 232) + 'px';
        }

        requestAnimationFrame(() => popup.classList.add('mini-profile-popup--open'));

        const close = () => {
            popup.classList.remove('mini-profile-popup--open');
            setTimeout(() => popup.remove(), 180);
        };
        setTimeout(() => document.addEventListener('click', close, { once: true }), 0);
        popup.addEventListener('click', e => e.stopPropagation());

        // Firebase'den güncel veriyi çek
        const renderPopup = (u) => {
            const color     = window._sanitizeHexColor(u.avatarColor);
            const avatarUrl = u.customAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName || username)}&background=${color}&color=fff&size=80`;
            const statusColors = { online:'#2ed573', away:'#ff9f43', dnd:'#ff4757', offline:'#636e72' };
            const statusLabels = { online:'Çevrimiçi', away:'Meşgul', dnd:'Rahatsız Etme', offline:'Çevrimdışı' };
            const stColor = statusColors[u.status || (u.online ? 'online' : 'offline')] || '#636e72';
            const stLabel = statusLabels[u.status || (u.online ? 'online' : 'offline')] || 'Çevrimdışı';
            const xp      = u.xp || 0;
            const focusMin = Math.floor(xp / 10);
            const focusH   = Math.floor(focusMin / 60);
            const focusM   = focusMin % 60;
            const focusStr = focusH > 0 ? `${focusH}s ${focusM}dk` : `${focusM}dk`;
            const isMe     = me && me.username === username;
            const isFriend = !isMe && (getFriends ? getFriends().includes(username) : false);

            const joinedAt = u.joinedAt ? new Date(u.joinedAt).toLocaleDateString('tr-TR', { day:'2-digit', month:'long', year:'numeric' }) : null;
            const groupJoinedAt = groupMemberData && groupMemberData.joinedAt ? new Date(groupMemberData.joinedAt).toLocaleDateString('tr-TR', { day:'2-digit', month:'long', year:'numeric' }) : null;
            const focusStreak = u.focusStreak || 0;
            const completedGoals = u.completedGoals || 0;
            const cgId = 'mp-cg-' + username;

            popup.innerHTML = `
                <div class="mp-banner"></div>
                <div class="mp-head-row">
                    <div class="mp-avatar-wrap">
                        <img class="mp-avatar" src="${esc(avatarUrl)}" onerror="this.onerror=null;this.src='${esc(window.avatarFallbackSrc(u.displayName || username, color))}';" alt="">
                        <span class="mp-status-dot" title="${stLabel}"></span>
                    </div>
                    <div class="mp-names">
                        <span class="mp-display-name">${esc(u.displayName || username)}</span>
                        <span class="mp-username">#${esc(username)}</span>
                    </div>
                </div>
                <div class="mp-body">
                    ${u.statusText ? `<div class="mp-status-text">${esc(u.statusText)}</div>` : ''}
                    <div class="mp-divider"></div>
                    <div class="mp-stats">
                        <div class="mp-stat">
                            <span class="mp-stat-val">${xp.toLocaleString('tr-TR')}</span>
                            <span class="mp-stat-lbl">XP</span>
                        </div>
                        <div class="mp-stat">
                            <span class="mp-stat-val">${focusStr}</span>
                            <span class="mp-stat-lbl">Odak</span>
                        </div>
                        <div class="mp-stat">
                            <span class="mp-stat-val">${focusStreak}<span class="u-font-size-9px_font-weight-400"> gün</span></span>
                            <span class="mp-stat-lbl">🔥 Seri</span>
                        </div>
                    </div>
                    <div class="mp-divider"></div>
                    ${groupJoinedAt ? `<div class="mp-info-row"><i class="fa-solid fa-door-open"></i><span>Gruba katıldı: <b class="u-color-hfff">${groupJoinedAt}</b></span></div>` : ''}
                    ${joinedAt ? `<div class="mp-info-row"><i class="fa-solid fa-calendar-plus"></i><span>Platforma katıldı: <b class="u-color-hfff">${joinedAt}</b></span></div>` : ''}
                    <div class="mp-info-row"><i class="fa-solid fa-trophy"></i><span>Tamamlanan Hedef: <b class="si-yellow">${completedGoals}</b></span></div>
                    <div class="mp-divider"></div>
                    <div class="mp-section-label"><i class="fa-solid fa-users"></i> Ortak Gruplar</div>
                    <div class="mp-common-groups" id="${cgId}"><span class="mp-no-common">Yükleniyor...</span></div>
                    ${!isMe ? `<div class="mp-actions u-margin-top-8px" >
                        <button class="mp-action-btn mp-dm-btn" title="Mesaj Gönder"><i class="fa-solid fa-message"></i> Mesaj</button>
                        ${!isFriend ? `<button class="mp-action-btn mp-add-btn" title="Kişi Ekle" aria-label="Kişi Ekle"><i class="fa-solid fa-user-plus"></i></button>` : `<span class="mp-friend-badge"><i class="fa-solid fa-user-check"></i> Arkadaş</span>`}
                        <button class="mp-action-btn mp-block-btn" title="Engelle" aria-label="Engelle"><i class="fa-solid fa-ban"></i></button>
                    </div>` : `<div class="mp-actions u-margin-top-8px" ><button class="mp-action-btn mp-edit-btn"><i class="fa-solid fa-pen-to-square"></i> Profili Düzenle</button></div>`}
                </div>
            `;
            const bannerEl = popup.querySelector('.mp-banner');
            if (bannerEl) bannerEl.style.background = `linear-gradient(135deg,#${color}55,#${color}22)`;
            const statusDotEl = popup.querySelector('.mp-status-dot');
            if (statusDotEl) statusDotEl.style.background = stColor;

            // Ortak grupları asenkron yükle
            (async () => {
                const cgEl = document.getElementById(cgId);
                if (!cgEl) return;
                const database2 = getDB();
                const me2 = getUser();
                if (!database2 || !me2) { cgEl.innerHTML = '<span class="mp-no-common">—</span>'; return; }
                const targetGroups = u.my_groups ? Object.keys(u.my_groups) : [];
                if (!targetGroups.length) { cgEl.innerHTML = '<span class="mp-no-common">Ortak grup yok</span>'; return; }
                const myGroupsSnap = await database2.ref(`focusai_community/users/${me2.username}/my_groups`).once('value');
                const myGroups = myGroupsSnap.val() ? Object.keys(myGroupsSnap.val()) : [];
                const common = targetGroups.filter(k => myGroups.includes(k));
                if (!common.length) { cgEl.innerHTML = '<span class="mp-no-common">Ortak grup yok</span>'; return; }
                const names = await Promise.all(common.map(k => database2.ref(`focusai_community/groups/${k}/name`).once('value').then(s => s.val() || k)));
                cgEl.innerHTML = names.map(n => `<span class="mp-group-chip" title="${esc(n)}">${esc(n)}</span>`).join('');
            })();

            if (!isMe) {
                popup.querySelector('.mp-dm-btn')?.addEventListener('click', () => {
                    close();
                    goToDmChat(username, u.displayName || username);
                });
                popup.querySelector('.mp-add-btn')?.addEventListener('click', async () => {
                    await sendFriendRequest(username);
                    close();
                });
                popup.querySelector('.mp-block-btn')?.addEventListener('click', () => {
                    if (typeof window.toggleUserBlocked !== 'function') return;
                    dcShowConfirm({
                        title: 'Kullanıcıyı Engelle',
                        message: `@${username} adlı kullanıcıyı engellemek istediğine emin misin? Engellediğin kullanıcılar artık seni hiçbir yerde göremez, sen de onu göremezsin. Engeli daha sonra Ayarlar > Engellenen Kullanıcılar bölümünden kaldırabilirsin.`,
                        confirmText: 'Engelle',
                        cancelText: 'Vazgeç',
                        danger: true,
                        icon: 'fa-ban',
                        onConfirm: () => {
                            window.toggleUserBlocked(username);
                                                            window.dcShowToast(`@${username} engellendi`);
                            close();
                        }
                    });
                });
            } else {
                popup.querySelector('.mp-edit-btn')?.addEventListener('click', () => {
                    close();
                    if (typeof window.openSetupModalAsEdit === 'function') window.openSetupModalAsEdit();
                });
            }
        };

        // Firebase kapatıldığından (M2 göçü) güncel veri Supabase'ten çekilir.
        if (window.FocusSupabase) {
            window.FocusSupabase.from('profiles')
                .select('username, display_name, avatar_color, custom_avatar, avatar_initials, xp, focus_streak, completed_goals, current_status, created_at')
                .eq('username', username).maybeSingle()
                .then(({ data }) => {
                    const presence = window.getCommunityPresenceState ? window.getCommunityPresenceState() : {};
                    const isOnline = Object.values(presence).some(arr => Array.isArray(arr) && arr.some(p => p.username === username));
                    renderPopup({
                        ...cachedData,
                        ...(data ? {
                            displayName: data.display_name || username,
                            avatarColor: data.avatar_color,
                            customAvatar: data.custom_avatar, avatarInitials: data.avatar_initials || null,
                            xp: data.xp,
                            focusStreak: data.focus_streak,
                            completedGoals: data.completed_goals,
                            statusText: data.current_status,
                            joinedAt: data.created_at ? new Date(data.created_at).getTime() : undefined,
                        } : {}),
                        online: isOnline,
                    });
                });
        } else if (database) {
            database.ref(`focusai_community/users/${username}`).once('value', snap => {
                renderPopup(snap.val() || cachedData || {});
            });
        } else {
            renderPopup(cachedData || {});
        }
    }
    window.openMiniProfile = openMiniProfile;

})();

// social-sidebar-profile.js gibi ayrı modüllerin import edebilmesi için ince sarmalayıcı export'lar.
export const goToDmChat = window.goToDmChat;
export const openMiniProfile = window.openMiniProfile;
