import { dcShowConfirm } from './social-dc-confirm-toasts.js';
import { renderLeaderboardFromCache, _syncBlockToSupabase, removeFriend } from './social-friends-notifications.js';

import { loadJsonList, saveJsonList, _dcGetBlockedByOthers, renderRecentConversations } from './social-dm-notifications.js';

import { getActiveChatTarget } from './state/active-chat-target-store.js';
// ─── ENGELLE ────────────────────────────────────────────────────────
// social.js dosyasından çıkarıldı (Faz 2, 2026-07-19 — en geniş kapsamlı
// çıkarma: isBlockedEitherWay tek başına ~30 yerde kullanılıyordu, bir kısmı
// `typeof isBlockedEitherWay === 'function'` guard'ıyla — bu guard'lar
// bare identifier kaldırıldığında sessizce 'undefined' dönüp hiç hata
// atmadan engellenen kullanıcıların içeriğinin sızmasına yol açabilirdi.
// social.js'teki TÜM çağrı noktaları (guard'lar dahil) window.* önekine
// çevrildi — bu dosya sadece taşınan 7 fonksiyonun gövdesini içeriyor.
//
// Dış bağımlılıklar:
// - loadJsonList/saveJsonList → window.* köprüsü (social.js'te kalıyor,
//   Sohbet Listesi Eylemleri özelliği de kullanıyor)
// - _blockedByOthers (initSocial() dinleyicisi tarafından yazılan paylaşılan
//   Set, taşınmadı) → _dcGetBlockedByOthers() salt-okunur getter
// - _syncBlockToSupabase / removeFriend → social.js'te kalıyor, window.*
//   köprüsü eklendi
// - renderRecentConversations / syncDcContactList / renderLeaderboardFromCache
//   → zaten window.* köprülüydü
// - _escapeHtml → window.escapeHtml
// - window.dcShowConfirm / window.dcShowToast / getActiveChatTarget() /
//   window.FocusSupabase → zaten global
function isUserBlocked(username) {
    return loadJsonList('focusai_blocked_users').includes(username);
}
window.isUserBlocked = isUserBlocked;

// Ben onu engelledim VEYA o beni engelledi — her iki durumda da
// birbirimizin profilini, mesajlarını ve istatistiklerini göremeyiz.
export function isBlockedEitherWay(username) {
    return isUserBlocked(username) || _dcGetBlockedByOthers().has(username);
}
window.isBlockedEitherWay = isBlockedEitherWay;

function toggleUserBlocked(username) {
    let list = loadJsonList('focusai_blocked_users');
    const nowBlocked = !list.includes(username);
    if (nowBlocked) list.push(username);
    else list = list.filter(u => u !== username);
    saveJsonList('focusai_blocked_users', list);
    _syncBlockToSupabase(username, nowBlocked);

    if (nowBlocked) removeFriend(username);
    if (typeof window.renderRecentConversations === 'function') renderRecentConversations();
    if (typeof refreshBlockSensitiveUI === 'function') refreshBlockSensitiveUI();
    return nowBlocked;
}
window.toggleUserBlocked = toggleUserBlocked;

async function isBlockedByUser(username) {
    return _dcGetBlockedByOthers().has(username);
}
window.isBlockedByUser = isBlockedByUser;

// Engellemeye duyarlı tüm liste/UI parçalarını yeniden çiz —
// bir kullanıcı engellendiğinde/engeli kaldırıldığında her yerden
// anında kaybolması/geri gelmesi için.
function refreshBlockSensitiveUI() {
    if (typeof window.renderRecentConversations === 'function') renderRecentConversations();
    if (typeof window.syncDcContactList === 'function') window.syncDcContactList();
    renderLeaderboardFromCache();
    if (typeof renderBlockedUsersSettings === 'function') renderBlockedUsersSettings();
    document.querySelectorAll('.mini-profile-popup').forEach(el => el.remove());
}
window.refreshBlockSensitiveUI = refreshBlockSensitiveUI;

// DM giriş kutusunun üstünde "engellendi" bilgilendirmesini gösterir/günceller
function updateDcBlockedBanner(targetUsername) {
    const inputBar = document.querySelector('.dc-chat-input-bar');
    const input    = document.getElementById('sidebar-chat-message-input');
    const sendBtn  = document.getElementById('sidebar-chat-send-msg-btn');
    if (!inputBar) return;

    const blocked = isBlockedEitherWay(targetUsername);

    // Bu süre zarfında sohbet değişmiş olabilir
    if (!getActiveChatTarget() || getActiveChatTarget().type !== 'dm' || getActiveChatTarget().username !== targetUsername) return;

    let banner = document.getElementById('dc-blocked-banner');
    if (!blocked) {
        if (banner) banner.remove();
        if (input)   input.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
        return;
    }

    if (input)   input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;

    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'dc-blocked-banner';
        banner.className = 'dc-blocked-banner';
        inputBar.parentNode.insertBefore(banner, inputBar);
    }
    banner.innerHTML = `<i class="fa-solid fa-ban"></i> Bu kullanıcıyla iletişim kuramazsınız.`;
}
window.updateDcBlockedBanner = updateDcBlockedBanner;

// Ayarlar > "Engellenen Kullanıcılar" listesini doldurur — engeli
// kaldırmanın TEK yolu burasıdır.
export async function renderBlockedUsersSettings() {
    const listEl = document.getElementById('settings-blocked-list');
    if (!listEl) return;

    const blocked = loadJsonList('focusai_blocked_users');
    if (!blocked.length) {
        listEl.innerHTML = `<div class="u-font-size-12px_color-var-text-muted_padding-6px0">Engellediğin kimse yok.</div>`;
        return;
    }

    const esc = window.escapeHtml;
    listEl.innerHTML = blocked.map(username => `
        <div class="settings-blocked-item" data-username="${esc(username)}">
            <div class="settings-blocked-avatar" id="settings-blocked-avatar-${esc(username)}">${esc(username.charAt(0).toUpperCase())}</div>
            <div class="settings-blocked-name" id="settings-blocked-name-${esc(username)}">@${esc(username)}</div>
            <button class="control-btn secondary settings-blocked-unblock-btn u-font-size-12px_padding-6px12px" data-username="${esc(username)}" >
                <i class="fa-solid fa-ban"></i> Engeli Kaldır
            </button>
        </div>
    `).join('');

    // Görünen ad/avatarı Supabase'den asenkron doldur
    if (window.FocusSupabase && blocked.length) {
        window.FocusSupabase.from('profiles').select('username, display_name, avatar_color').in('username', blocked).then(({ data }) => {
            (data || []).forEach(u => {
                const nameEl = document.getElementById(`settings-blocked-name-${u.username}`);
                const avatarEl = document.getElementById(`settings-blocked-avatar-${u.username}`);
                if (nameEl) nameEl.textContent = u.display_name || u.username;
                if (avatarEl) {
                    const color = (u.avatar_color || '6c5ce7').replace('#', '');
                    avatarEl.style.background = '#' + color;
                    avatarEl.textContent = (u.display_name || u.username).charAt(0).toUpperCase();
                }
            });
        });
    }

    listEl.querySelectorAll('.settings-blocked-unblock-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const username = btn.dataset.username;
            dcShowConfirm({
                title: 'Engeli Kaldır',
                message: `@${username} adlı kullanıcının engelini kaldırmak istediğine emin misin? Tekrar profilini görebilir, mesajlaşabilir ve aynı gruptaysanız mesajlarını görebilirsiniz.`,
                confirmText: 'Engeli Kaldır',
                cancelText: 'Vazgeç',
                danger: false,
                icon: 'fa-ban',
                onConfirm: () => {
                    toggleUserBlocked(username);
                    window.dcShowToast(`@${username} engeli kaldırıldı`);
                    renderBlockedUsersSettings();
                }
            });
        });
    });
}
window.renderBlockedUsersSettings = renderBlockedUsersSettings;
