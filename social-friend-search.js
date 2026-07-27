// social-friend-search.js
// social.js'ten çıkarıldı (Faz E — çekirdek bölge derin taraması, son tur,
// 2026-07-23): "Kişi Ekle" modalındaki arkadaş arama akışı (doFriendSearch).
// Tek çağıran noktası vardı (Enter tuşu / arama butonu), currentUser'ı
// sadece OKUYOR, hiç mutasyon yok. Tamamen izole.
//
// Dış bağımlılıklar: window.currentUser, window.showPremiumModal (window.*
// üzerinden — showPremiumModal script.js'te tanımlı ve bu loader'dan önce
// yüklenir). searchUser/getFriends/sendFriendRequest/removeFriend
// (social-friends-notifications.js), isBlockedEitherWay (social-block-users.js)
// ve avatarImgHtml/_escapeHtml (social-avatar-utils.js/social.js) artık
// gerçek import — Faz H (2026-07-27): loader sırası bu 3 üretici dosyayı
// bu tüketiciden ÖNCEYE alacak şekilde düzenlendi.
import { searchUser, getFriends, sendFriendRequest, removeFriend } from './social-friends-notifications.js';
import { isBlockedEitherWay } from './social-block-users.js';
import { avatarImgHtml } from './social-avatar-utils.js';
import { _escapeHtml } from './social.js';

(function () {
'use strict';

    async function doFriendSearch() {
        const username = document.getElementById('add-friend-input')?.value?.trim();
        if (!username) return;
        const resultEl = document.getElementById('add-friend-result');
        if (!resultEl) return;

        resultEl.innerHTML = '<p style="color:var(--text-muted); font-size:13px;"><i class="fa-solid fa-spinner fa-spin"></i> Aranıyor...</p>';

        const user = await searchUser(username);

        if (!user) {
            resultEl.innerHTML = `<p style="color:#ff4757; font-size:13px;"><i class="fa-solid fa-circle-xmark"></i> "@${_escapeHtml(username)}" bulunamadı.</p>`;
            return;
        }
        if (username === window.currentUser?.username) {
            resultEl.innerHTML = `<p style="color:#ff9f43; font-size:13px;">Kendinizi ekleyemezsiniz 😄</p>`;
            return;
        }
        if (isBlockedEitherWay(username)) {
            resultEl.innerHTML = `<p style="color:#ff4757; font-size:13px;"><i class="fa-solid fa-circle-xmark"></i> "@${_escapeHtml(username)}" bulunamadı.</p>`;
            return;
        }

        const isFriend = getFriends().includes(username);
        resultEl.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:15px; border-radius:12px; background:rgba(0,0,0,0.3); border:1px solid var(--glass-border);">
                <div style="display:flex; align-items:center; gap:12px;">
                    ${avatarImgHtml(user, 44)}
                    <div>
                        <div style="font-weight:600; color:#fff;">${_escapeHtml(user.displayName)}</div>
                        <div class="si-muted-sm">@${_escapeHtml(username)} · ${user.xp || 0} XP · ${user.online ? '<span class="si-green">Çevrimiçi</span>' : 'Çevrimdışı'}</div>
                    </div>
                </div>
                ${isFriend
                    ? `<button id="af-remove-btn" data-username="${_escapeHtml(username)}" class="control-btn secondary" style="color:#ff4757; border-color:rgba(255,71,87,0.3); font-size:12px; padding:6px 12px;">
                           <i class="fa-solid fa-user-minus"></i> Kaldır
                       </button>`
                    : `<button id="af-add-btn" data-username="${_escapeHtml(username)}" class="primary-btn" style="font-size:12px; padding:6px 14px;">
                           <i class="fa-solid fa-user-plus"></i> Ekle
                       </button>`}
            </div>`;

            document.getElementById('af-add-btn')?.addEventListener('click', async (e) => {
                const targetUser = e.currentTarget.dataset.username;
                const btn = document.getElementById('af-add-btn');
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İstek Gidiyor...';
                }
                
                const res = await sendFriendRequest(targetUser);
                if (res.success) {
                    document.getElementById('add-friend-modal')?.classList.add('hidden');
                    if (typeof window.showPremiumModal === 'function') {
                        window.showPremiumModal({ title: '📨 İstek Gönderildi!', message: `${user.displayName} kullanıcısına arkadaşlık isteği gönderildi. Onayladığında arkadaş olacaksınız.`, type: 'success' });
                    }
                } else {
                    if (typeof window.showPremiumModal === 'function') {
                        window.showPremiumModal({ title: 'Bir Sorun Oluştu', message: res.error || 'İstek gönderilirken bir hata oluştu. Lütfen tekrar dene.', type: 'warning' });
                    }
                    if (btn) { btn.disabled = false; btn.innerHTML = 'Ekle'; }
                }
            });

        document.getElementById('af-remove-btn')?.addEventListener('click', e => {
            removeFriend(e.currentTarget.dataset.username);
            resultEl.innerHTML = `<p style="color:#2ed573; font-size:13px;"><i class="fa-solid fa-check"></i> Arkadaşlıktan çıkarıldı.</p>`;
        });
    }
    window.doFriendSearch = doFriendSearch;

})();
